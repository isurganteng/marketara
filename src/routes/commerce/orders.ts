import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
} from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  checkoutSessions,
  merchants,
  orderAddresses,
  orderCancellations,
  orderItems,
  orderNotes,
  orders,
  orderStatusHistories,
  returnItems,
  returns,
  salesTransactions,
  shoppingCarts,
  storefronts,
  users,
} from '../../db/schema';
import { assertOrderAccess, orderScopeCondition } from '../../lib/access';
import { writeAuditLog } from '../../lib/audit';
import type { AppEnv } from '../../lib/app-env';
import { ApiError } from '../../lib/errors';
import { getPagination, ok, paginated } from '../../lib/http';
import { generateCode } from '../../lib/slug';
import { validate } from '../../lib/validator';
import { requirePermission } from '../../middleware/auth';
import { getClientIp } from '../../services/auth';
import { money } from './shared';

type OrderStatus = NonNullable<typeof orders.$inferInsert.status>;

const orderStatusSchema = z.enum([
  'pending',
  'confirmed',
  'processing',
  'completed',
  'cancelled',
  'returned',
]);

const orderNoteVisibilitySchema = z.enum(['internal', 'customer']);

const listOrdersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: orderStatusSchema.optional(),
  merchantId: z.uuid().optional(),
  userId: z.uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const updateOrderStatusSchema = z.object({
  status: z.enum(['confirmed', 'processing', 'completed']),
  note: z.string().trim().max(2000).optional(),
});

const cancelOrderSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
  notes: z.string().trim().max(2000).optional(),
});

const createOrderNoteSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  visibility: orderNoteVisibilitySchema.optional(),
});

const listTransactionsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(['sale', 'cancellation', 'return']).optional(),
  orderId: z.uuid().optional(),
  merchantId: z.uuid().optional(),
  search: z.string().trim().max(100).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const ORDER_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed'],
  confirmed: ['processing'],
  processing: ['completed'],
  completed: [],
  cancelled: [],
  returned: [],
};

const CANCELLABLE_STATUSES = ['pending', 'confirmed', 'processing'] as const;

interface CheckoutItemSnapshot {
  cartItemId?: unknown;
  storefrontProductId?: unknown;
  storefrontId?: unknown;
  storefrontName?: unknown;
  merchantId?: unknown;
  merchantName?: unknown;
  productId?: unknown;
  productName?: unknown;
  productSlug?: unknown;
  skuId?: unknown;
  skuCode?: unknown;
  quantity?: unknown;
  unitPrice?: unknown;
  currency?: unknown;
  lineTotal?: unknown;
}

function textOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function addressValues(
  orderId: string,
  address: Record<string, unknown>,
  fallbackName: string | null,
  fallbackPhone: string | null,
) {
  return {
    orderId,
    type: 'shipping' as const,
    recipientName: String(address.recipientName ?? fallbackName ?? 'Pelanggan'),
    phone: String(address.phone ?? fallbackPhone ?? '-'),
    addressLine1: String(address.addressLine1 ?? '-'),
    addressLine2: textOrNull(address.addressLine2),
    city: String(address.city ?? '-'),
    province: String(address.province ?? '-'),
    postalCode: textOrNull(address.postalCode),
    country: String(address.country ?? 'ID').slice(0, 2).toUpperCase(),
    latitude: textOrNull(address.latitude),
    longitude: textOrNull(address.longitude),
  };
}

export async function getOrderDetailPayload(
  orderId: string,
  options: { includeInternalNotes?: boolean } = {},
) {
  const includeInternalNotes = options.includeInternalNotes ?? true;
  const [order] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      checkoutSessionId: orders.checkoutSessionId,
      merchantId: orders.merchantId,
      merchantName: merchants.businessName,
      merchantCode: merchants.code,
      storefrontId: orders.storefrontId,
      storefrontName: storefronts.name,
      storefrontSlug: storefronts.slug,
      salesChannelId: orders.salesChannelId,
      userId: orders.userId,
      customerName: users.fullName,
      customerEmail: users.email,
      status: orders.status,
      currency: orders.currency,
      itemCount: orders.itemCount,
      subtotal: orders.subtotal,
      discountTotal: orders.discountTotal,
      shippingTotal: orders.shippingTotal,
      grandTotal: orders.grandTotal,
      contactName: orders.contactName,
      contactPhone: orders.contactPhone,
      contactEmail: orders.contactEmail,
      placedAt: orders.placedAt,
      confirmedAt: orders.confirmedAt,
      processingAt: orders.processingAt,
      completedAt: orders.completedAt,
      cancelledAt: orders.cancelledAt,
      returnedAt: orders.returnedAt,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
    })
    .from(orders)
    .innerJoin(merchants, eq(merchants.id, orders.merchantId))
    .leftJoin(storefronts, eq(storefronts.id, orders.storefrontId))
    .leftJoin(users, eq(users.id, orders.userId))
    .where(eq(orders.id, orderId));

  if (!order) throw ApiError.notFound('Order not found');

  const [items, addresses, statusHistory, notes, cancellation, returnRows] =
    await Promise.all([
      db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id))
        .orderBy(asc(orderItems.createdAt)),
      db
        .select()
        .from(orderAddresses)
        .where(eq(orderAddresses.orderId, order.id))
        .orderBy(asc(orderAddresses.createdAt)),
      db
        .select({
          id: orderStatusHistories.id,
          fromStatus: orderStatusHistories.fromStatus,
          toStatus: orderStatusHistories.toStatus,
          note: orderStatusHistories.note,
          changedBy: orderStatusHistories.changedBy,
          changedByName: users.fullName,
          createdAt: orderStatusHistories.createdAt,
        })
        .from(orderStatusHistories)
        .leftJoin(users, eq(users.id, orderStatusHistories.changedBy))
        .where(eq(orderStatusHistories.orderId, order.id))
        .orderBy(asc(orderStatusHistories.createdAt)),
      db
        .select({
          id: orderNotes.id,
          authorUserId: orderNotes.authorUserId,
          authorName: users.fullName,
          visibility: orderNotes.visibility,
          body: orderNotes.body,
          createdAt: orderNotes.createdAt,
        })
        .from(orderNotes)
        .leftJoin(users, eq(users.id, orderNotes.authorUserId))
        .where(
          includeInternalNotes
            ? eq(orderNotes.orderId, order.id)
            : and(eq(orderNotes.orderId, order.id), eq(orderNotes.visibility, 'customer')),
        )
        .orderBy(asc(orderNotes.createdAt)),
      db.query.orderCancellations.findFirst({
        where: eq(orderCancellations.orderId, order.id),
      }),
      db
        .select()
        .from(returns)
        .where(eq(returns.orderId, order.id))
        .orderBy(desc(returns.requestedAt)),
    ]);

  const returnIds = returnRows.map((row) => row.id);
  const returnItemRows =
    returnIds.length > 0
      ? await db
          .select({
            id: returnItems.id,
            returnId: returnItems.returnId,
            orderItemId: returnItems.orderItemId,
            quantity: returnItems.quantity,
            unitPrice: returnItems.unitPrice,
            lineTotal: returnItems.lineTotal,
            condition: returnItems.condition,
            reason: returnItems.reason,
            productName: orderItems.productName,
            skuCode: orderItems.skuCode,
            createdAt: returnItems.createdAt,
          })
          .from(returnItems)
          .innerJoin(orderItems, eq(orderItems.id, returnItems.orderItemId))
          .where(inArray(returnItems.returnId, returnIds))
      : [];

  const returnItemsByReturn = new Map<string, typeof returnItemRows>();
  for (const item of returnItemRows) {
    const list = returnItemsByReturn.get(item.returnId) ?? [];
    list.push(item);
    returnItemsByReturn.set(item.returnId, list);
  }

  const transactions = await db
    .select()
    .from(salesTransactions)
    .where(eq(salesTransactions.orderId, order.id))
    .orderBy(asc(salesTransactions.occurredAt));

  return {
    ...order,
    items,
    addresses,
    statusHistory,
    notes,
    cancellation: cancellation
      ? {
          ...cancellation,
          ...(includeInternalNotes ? {} : { notes: null }),
        }
      : null,
    returns: returnRows.map((row) => ({
      ...row,
      items: returnItemsByReturn.get(row.id) ?? [],
    })),
    transactions,
  };
}

export const commerceOrderRoutes = new Hono<AppEnv>();

commerceOrderRoutes.get(
  '/orders',
  requirePermission('commerce:read'),
  validate('query', listOrdersSchema),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions = [];
    const scope = orderScopeCondition(c.get('user'), c.get('permissions'));

    if (scope) conditions.push(scope);
    if (query.status) conditions.push(eq(orders.status, query.status));
    if (query.merchantId) conditions.push(eq(orders.merchantId, query.merchantId));
    if (query.userId) conditions.push(eq(orders.userId, query.userId));
    if (query.from) conditions.push(gte(orders.placedAt, query.from));
    if (query.to) conditions.push(lte(orders.placedAt, query.to));
    if (query.search) {
      const term = `%${query.search}%`;
      const searchCondition = or(
        ilike(orders.orderNumber, term),
        ilike(orders.contactName, term),
        ilike(merchants.businessName, term),
        ilike(users.fullName, term),
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ value } = { value: 0 }]] = await Promise.all([
      db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          status: orders.status,
          currency: orders.currency,
          itemCount: orders.itemCount,
          subtotal: orders.subtotal,
          grandTotal: orders.grandTotal,
          merchantId: orders.merchantId,
          merchantName: merchants.businessName,
          storefrontId: orders.storefrontId,
          storefrontName: storefronts.name,
          customerId: orders.userId,
          customerName: users.fullName,
          contactName: orders.contactName,
          contactPhone: orders.contactPhone,
          placedAt: orders.placedAt,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .innerJoin(merchants, eq(merchants.id, orders.merchantId))
        .leftJoin(storefronts, eq(storefronts.id, orders.storefrontId))
        .leftJoin(users, eq(users.id, orders.userId))
        .where(where)
        .orderBy(desc(orders.placedAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ value: count() })
        .from(orders)
        .innerJoin(merchants, eq(merchants.id, orders.merchantId))
        .leftJoin(users, eq(users.id, orders.userId))
        .where(where),
    ]);

    return paginated(c, rows, Number(value), pagination);
  },
);

commerceOrderRoutes.post(
  '/orders/from-checkout/:checkoutId',
  requirePermission('commerce:write'),
  async (c) => {
    const checkout = await db.query.checkoutSessions.findFirst({
      where: and(
        eq(checkoutSessions.id, c.req.param('checkoutId')),
        eq(checkoutSessions.userId, c.get('user').id),
      ),
    });
    if (!checkout) throw ApiError.notFound('Checkout session not found');

    if (checkout.status === 'completed') {
      const existing = await db
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.checkoutSessionId, checkout.id))
        .orderBy(asc(orders.createdAt));
      if (existing.length === 0) {
        throw ApiError.conflict('Checkout is completed but orders are missing');
      }
      const payloads = await Promise.all(
        existing.map((row) => getOrderDetailPayload(row.id, { includeInternalNotes: false })),
      );
      return ok(c, { checkoutId: checkout.id, orders: payloads, created: false });
    }

    if (!['draft', 'pending', 'ready'].includes(checkout.status)) {
      throw ApiError.badRequest('Checkout session cannot be converted to an order');
    }
    if (checkout.expiresAt && checkout.expiresAt.getTime() < Date.now()) {
      await db
        .update(checkoutSessions)
        .set({ status: 'expired' })
        .where(eq(checkoutSessions.id, checkout.id));
      throw ApiError.conflict('Checkout session has expired');
    }

    const snapshot = checkout.itemsSnapshot as unknown as CheckoutItemSnapshot[];
    if (!Array.isArray(snapshot) || snapshot.length === 0) {
      throw ApiError.badRequest('Checkout has no items');
    }

    const groups = new Map<string, CheckoutItemSnapshot[]>();
    for (const item of snapshot) {
      const merchantId = textOrNull(item.merchantId);
      const productId = textOrNull(item.productId);
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      if (
        !merchantId ||
        !productId ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        !Number.isFinite(unitPrice) ||
        unitPrice < 0
      ) {
        throw ApiError.badRequest('Checkout item snapshot is invalid');
      }
      const list = groups.get(merchantId) ?? [];
      list.push(item);
      groups.set(merchantId, list);
    }

    const merchantIds = [...groups.keys()];
    const merchantRows = await db
      .select()
      .from(merchants)
      .where(inArray(merchants.id, merchantIds));
    const merchantById = new Map(merchantRows.map((row) => [row.id, row]));

    for (const merchantId of merchantIds) {
      const merchant = merchantById.get(merchantId);
      if (!merchant || merchant.deletedAt) {
        throw ApiError.conflict('Merchant for this order is not available');
      }
      if (merchant.status !== 'verified') {
        throw ApiError.conflict(`Merchant ${merchant.businessName} is not verified`);
      }
    }

    const storefrontIds = [
      ...new Set(
        snapshot
          .map((item) => textOrNull(item.storefrontId))
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    const storefrontRows =
      storefrontIds.length > 0
        ? await db
            .select()
            .from(storefronts)
            .where(inArray(storefronts.id, storefrontIds))
        : [];
    const storefrontById = new Map(storefrontRows.map((row) => [row.id, row]));

    const addressSnapshot = checkout.addressSnapshot as Record<string, unknown> | null;
    const now = new Date();

    const createdOrders = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(checkoutSessions)
        .where(eq(checkoutSessions.id, checkout.id))
        .for('update');
      if (!locked) throw ApiError.notFound('Checkout session not found');
      if (locked.status === 'completed') {
        throw ApiError.conflict('Checkout session has already been converted');
      }

      await tx
        .update(checkoutSessions)
        .set({ status: 'completed', completedAt: now })
        .where(eq(checkoutSessions.id, checkout.id));
      await tx
        .update(shoppingCarts)
        .set({ status: 'converted' })
        .where(eq(shoppingCarts.id, checkout.cartId));

      const created = [];
      for (const [merchantId, items] of groups) {
        const merchant = merchantById.get(merchantId);
        if (!merchant) throw ApiError.internal('Merchant not found');

        const uniqueStorefrontIds = [
          ...new Set(
            items
              .map((item) => textOrNull(item.storefrontId))
              .filter((value): value is string => Boolean(value)),
          ),
        ];
        const storefrontId =
          uniqueStorefrontIds.length === 1 ? uniqueStorefrontIds[0] : null;
        const storefront = storefrontId
          ? storefrontById.get(storefrontId) ?? null
          : null;

        const computedItems = items.map((item) => {
          const quantity = Number(item.quantity);
          const unitPrice = Number(item.unitPrice);
          const lineTotal = money(unitPrice * quantity);
          return {
            item,
            quantity,
            unitPrice: money(unitPrice),
            lineTotal,
            productName: String(item.productName ?? 'Produk'),
          };
        });
        const subtotal = computedItems.reduce(
          (sum, item) => sum + Number(item.lineTotal),
          0,
        );
        const itemCount = computedItems.reduce(
          (sum, item) => sum + item.quantity,
          0,
        );
        const orderNumber = generateCode('ORD');

        const [order] = await tx
          .insert(orders)
          .values({
            orderNumber,
            checkoutSessionId: checkout.id,
            merchantId,
            storefrontId,
            salesChannelId: storefront?.salesChannelId ?? null,
            userId: checkout.userId,
            status: 'pending',
            currency: checkout.currency,
            itemCount,
            subtotal: money(subtotal),
            discountTotal: '0',
            shippingTotal: '0',
            grandTotal: money(subtotal),
            contactName:
              checkout.contactName ??
              textOrNull(addressSnapshot?.recipientName) ??
              null,
            contactPhone:
              checkout.contactPhone ??
              textOrNull(addressSnapshot?.phone) ??
              null,
            contactEmail: checkout.contactEmail,
            placedAt: now,
          })
          .returning();
        if (!order) throw ApiError.internal('Failed to create order');

        await tx.insert(orderItems).values(
          computedItems.map(({ item, quantity, unitPrice, lineTotal, productName }) => ({
            orderId: order.id,
            productId: textOrNull(item.productId),
            skuId: textOrNull(item.skuId),
            storefrontProductId: textOrNull(item.storefrontProductId),
            storefrontId: textOrNull(item.storefrontId),
            productName,
            productSlug: textOrNull(item.productSlug),
            skuCode: textOrNull(item.skuCode),
            quantity,
            unitPrice,
            lineTotal,
            currency: textOrNull(item.currency) ?? checkout.currency,
            itemSnapshot: item as unknown as Record<string, unknown>,
          })),
        );

        if (addressSnapshot) {
          await tx.insert(orderAddresses).values(
            addressValues(
              order.id,
              addressSnapshot,
              checkout.contactName,
              checkout.contactPhone,
            ),
          );
        }

        await tx.insert(orderStatusHistories).values({
          orderId: order.id,
          fromStatus: null,
          toStatus: 'pending',
          note: 'Order dibuat dari checkout',
          changedBy: c.get('user').id,
        });

        if (checkout.notes) {
          await tx.insert(orderNotes).values({
            orderId: order.id,
            authorUserId: checkout.userId,
            visibility: 'customer',
            body: checkout.notes,
          });
        }

        await tx.insert(salesTransactions).values({
          transactionNumber: generateCode('TRX'),
          orderId: order.id,
          merchantId,
          type: 'sale',
          amount: money(subtotal),
          currency: checkout.currency,
          description: `Penjualan ${order.orderNumber}`,
          occurredAt: now,
          createdBy: c.get('user').id,
        });

        created.push(order);
      }

      return created;
    });

    for (const order of createdOrders) {
      await writeAuditLog({
        actorUserId: c.get('user').id,
        action: 'order.create',
        entityType: 'order',
        entityId: order.id,
        newValues: {
          orderNumber: order.orderNumber,
          checkoutSessionId: checkout.id,
          merchantId: order.merchantId,
          grandTotal: order.grandTotal,
        },
        ipAddress: getClientIp(c),
        userAgent: c.req.header('user-agent') ?? null,
      });
    }

    const payloads = await Promise.all(
      createdOrders.map((order) =>
        getOrderDetailPayload(order.id, { includeInternalNotes: false }),
      ),
    );
    return c.json(
      { success: true as const, data: { checkoutId: checkout.id, orders: payloads, created: true } },
      201,
    );
  },
);

commerceOrderRoutes.get(
  '/orders/:orderId',
  requirePermission('commerce:read'),
  async (c) => {
    const access = await assertOrderAccess(
      c.req.param('orderId'),
      c.get('user'),
      c.get('permissions'),
    );
    return ok(
      c,
      await getOrderDetailPayload(access.order.id, {
        includeInternalNotes: access.via !== 'customer',
      }),
    );
  },
);

commerceOrderRoutes.patch(
  '/orders/:orderId/status',
  requirePermission('commerce:write'),
  validate('json', updateOrderStatusSchema),
  async (c) => {
    const access = await assertOrderAccess(
      c.req.param('orderId'),
      c.get('user'),
      c.get('permissions'),
    );
    if (access.via === 'customer') {
      throw ApiError.forbidden('Only merchant or administrator can update order status');
    }

    const body = c.req.valid('json');
    const allowed = ORDER_TRANSITIONS[access.order.status] ?? [];
    if (!allowed.includes(body.status)) {
      throw ApiError.badRequest(
        `Order status cannot change from ${access.order.status} to ${body.status}`,
      );
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(orders)
        .set({
          status: body.status as OrderStatus,
          ...(body.status === 'confirmed' ? { confirmedAt: now } : {}),
          ...(body.status === 'processing' ? { processingAt: now } : {}),
          ...(body.status === 'completed' ? { completedAt: now } : {}),
        })
        .where(eq(orders.id, access.order.id));

      await tx.insert(orderStatusHistories).values({
        orderId: access.order.id,
        fromStatus: access.order.status as OrderStatus,
        toStatus: body.status as OrderStatus,
        note: body.note ?? null,
        changedBy: c.get('user').id,
      });
    });

    await writeAuditLog({
      actorUserId: c.get('user').id,
      action: 'order.status.update',
      entityType: 'order',
      entityId: access.order.id,
      oldValues: { status: access.order.status },
      newValues: { status: body.status, note: body.note ?? null },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });

    return ok(c, await getOrderDetailPayload(access.order.id));
  },
);

commerceOrderRoutes.post(
  '/orders/:orderId/cancel',
  requirePermission('commerce:write'),
  validate('json', cancelOrderSchema),
  async (c) => {
    const access = await assertOrderAccess(
      c.req.param('orderId'),
      c.get('user'),
      c.get('permissions'),
    );
    if (!CANCELLABLE_STATUSES.includes(access.order.status as (typeof CANCELLABLE_STATUSES)[number])) {
      throw ApiError.badRequest('Order cannot be cancelled in its current status');
    }

    const body = c.req.valid('json');
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx
        .update(orders)
        .set({ status: 'cancelled', cancelledAt: now })
        .where(eq(orders.id, access.order.id));
      await tx.insert(orderCancellations).values({
        orderId: access.order.id,
        reason: body.reason,
        notes: body.notes ?? null,
        cancelledBy: c.get('user').id,
      });
      await tx.insert(orderStatusHistories).values({
        orderId: access.order.id,
        fromStatus: access.order.status as OrderStatus,
        toStatus: 'cancelled',
        note: body.reason,
        changedBy: c.get('user').id,
      });
      await tx.insert(salesTransactions).values({
        transactionNumber: generateCode('TRX'),
        orderId: access.order.id,
        merchantId: access.order.merchantId,
        type: 'cancellation',
        amount: money(-Number(access.order.grandTotal)),
        currency: access.order.currency,
        description: `Pembatalan ${access.order.orderNumber}`,
        occurredAt: now,
        createdBy: c.get('user').id,
      });
    });

    await writeAuditLog({
      actorUserId: c.get('user').id,
      action: 'order.cancel',
      entityType: 'order',
      entityId: access.order.id,
      oldValues: { status: access.order.status },
      newValues: { status: 'cancelled', reason: body.reason },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });

    return ok(
      c,
      await getOrderDetailPayload(access.order.id, {
        includeInternalNotes: access.via !== 'customer',
      }),
    );
  },
);

commerceOrderRoutes.post(
  '/orders/:orderId/notes',
  requirePermission('commerce:write'),
  validate('json', createOrderNoteSchema),
  async (c) => {
    const access = await assertOrderAccess(
      c.req.param('orderId'),
      c.get('user'),
      c.get('permissions'),
    );
    const body = c.req.valid('json');
    const visibility = body.visibility ?? (access.via === 'customer' ? 'customer' : 'internal');
    if (visibility === 'internal' && access.via === 'customer') {
      throw ApiError.forbidden('Customers cannot create internal order notes');
    }

    const [note] = await db
      .insert(orderNotes)
      .values({
        orderId: access.order.id,
        authorUserId: c.get('user').id,
        visibility,
        body: body.body,
      })
      .returning();

    await writeAuditLog({
      actorUserId: c.get('user').id,
      action: 'order.note.create',
      entityType: 'order',
      entityId: access.order.id,
      newValues: { visibility, body: body.body },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });

    return c.json({ success: true as const, data: note }, 201);
  },
);

commerceOrderRoutes.get(
  '/transactions',
  requirePermission('commerce:read'),
  validate('query', listTransactionsSchema),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions = [];
    const scope = orderScopeCondition(c.get('user'), c.get('permissions'));

    if (scope) conditions.push(scope);
    if (query.type) conditions.push(eq(salesTransactions.type, query.type));
    if (query.orderId) conditions.push(eq(salesTransactions.orderId, query.orderId));
    if (query.merchantId) {
      conditions.push(eq(salesTransactions.merchantId, query.merchantId));
    }
    if (query.from) conditions.push(gte(salesTransactions.occurredAt, query.from));
    if (query.to) conditions.push(lte(salesTransactions.occurredAt, query.to));
    if (query.search) {
      const term = `%${query.search}%`;
      const searchCondition = or(
        ilike(salesTransactions.transactionNumber, term),
        ilike(orders.orderNumber, term),
        ilike(merchants.businessName, term),
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ value } = { value: 0 }]] = await Promise.all([
      db
        .select({
          id: salesTransactions.id,
          transactionNumber: salesTransactions.transactionNumber,
          orderId: salesTransactions.orderId,
          orderNumber: orders.orderNumber,
          merchantId: salesTransactions.merchantId,
          merchantName: merchants.businessName,
          returnId: salesTransactions.returnId,
          type: salesTransactions.type,
          amount: salesTransactions.amount,
          currency: salesTransactions.currency,
          description: salesTransactions.description,
          occurredAt: salesTransactions.occurredAt,
          createdAt: salesTransactions.createdAt,
        })
        .from(salesTransactions)
        .innerJoin(orders, eq(orders.id, salesTransactions.orderId))
        .innerJoin(merchants, eq(merchants.id, salesTransactions.merchantId))
        .where(where)
        .orderBy(desc(salesTransactions.occurredAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ value: count() })
        .from(salesTransactions)
        .innerJoin(orders, eq(orders.id, salesTransactions.orderId))
        .innerJoin(merchants, eq(merchants.id, salesTransactions.merchantId))
        .where(where),
    ]);

    return paginated(c, rows, Number(value), pagination);
  },
);
