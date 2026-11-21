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
  merchants,
  orderItems,
  orders,
  orderStatusHistories,
  returnItems,
  returns,
  salesTransactions,
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

type ReturnStatus = NonNullable<typeof returns.$inferInsert.status>;
type OrderStatus = NonNullable<typeof orders.$inferInsert.status>;

const returnStatusSchema = z.enum([
  'requested',
  'approved',
  'rejected',
  'received',
  'completed',
  'cancelled',
]);

const returnConditionSchema = z.enum([
  'unopened',
  'opened',
  'damaged',
  'defective',
  'other',
]);

const returnItemSchema = z.object({
  orderItemId: z.uuid(),
  quantity: z.coerce.number().int().min(1).max(999),
  condition: returnConditionSchema.optional(),
  reason: z.string().trim().max(1000).optional(),
});

const createReturnSchema = z.object({
  reason: z.string().trim().min(3).max(2000),
  items: z.array(returnItemSchema).min(1).max(100),
});

const updateReturnSchema = z.object({
  status: returnStatusSchema,
  note: z.string().trim().max(2000).optional(),
});

const listReturnsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: returnStatusSchema.optional(),
  orderId: z.uuid().optional(),
  search: z.string().trim().max(100).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const RETURN_TRANSITIONS: Record<string, string[]> = {
  requested: ['approved', 'rejected', 'cancelled'],
  approved: ['received', 'cancelled'],
  received: ['completed'],
  completed: [],
  rejected: [],
  cancelled: [],
};

const ACTIVE_RETURN_STATUSES = ['requested', 'approved', 'received', 'completed'] as const;

export async function getReturnPayload(returnId: string) {
  const [ret] = await db
    .select({
      id: returns.id,
      returnNumber: returns.returnNumber,
      orderId: returns.orderId,
      orderNumber: orders.orderNumber,
      orderStatus: orders.status,
      merchantId: returns.merchantId,
      merchantName: merchants.businessName,
      userId: returns.userId,
      customerName: users.fullName,
      customerEmail: users.email,
      status: returns.status,
      reason: returns.reason,
      resolutionNote: returns.resolutionNote,
      requestedBy: returns.requestedBy,
      reviewedBy: returns.reviewedBy,
      requestedAt: returns.requestedAt,
      approvedAt: returns.approvedAt,
      rejectedAt: returns.rejectedAt,
      receivedAt: returns.receivedAt,
      completedAt: returns.completedAt,
      cancelledAt: returns.cancelledAt,
      createdAt: returns.createdAt,
      updatedAt: returns.updatedAt,
    })
    .from(returns)
    .innerJoin(orders, eq(orders.id, returns.orderId))
    .innerJoin(merchants, eq(merchants.id, returns.merchantId))
    .leftJoin(users, eq(users.id, returns.userId))
    .where(eq(returns.id, returnId));

  if (!ret) throw ApiError.notFound('Return not found');

  const items = await db
    .select({
      id: returnItems.id,
      returnId: returnItems.returnId,
      orderItemId: returnItems.orderItemId,
      productName: orderItems.productName,
      skuCode: orderItems.skuCode,
      quantity: returnItems.quantity,
      unitPrice: returnItems.unitPrice,
      lineTotal: returnItems.lineTotal,
      condition: returnItems.condition,
      reason: returnItems.reason,
      createdAt: returnItems.createdAt,
    })
    .from(returnItems)
    .innerJoin(orderItems, eq(orderItems.id, returnItems.orderItemId))
    .where(eq(returnItems.returnId, ret.id))
    .orderBy(asc(returnItems.createdAt));

  return { ...ret, items };
}

async function getReturnAccess(returnId: string, user: AppEnv['Variables']['user'], permissions: Set<string>) {
  const ret = await db.query.returns.findFirst({
    where: eq(returns.id, returnId),
  });
  if (!ret) throw ApiError.notFound('Return not found');
  const access = await assertOrderAccess(ret.orderId, user, permissions);
  return { ret, access };
}

export const commerceReturnRoutes = new Hono<AppEnv>();

commerceReturnRoutes.get(
  '/returns',
  requirePermission('commerce:read'),
  validate('query', listReturnsSchema),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions = [];
    const scope = orderScopeCondition(c.get('user'), c.get('permissions'));

    if (scope) conditions.push(scope);
    if (query.status) conditions.push(eq(returns.status, query.status));
    if (query.orderId) conditions.push(eq(returns.orderId, query.orderId));
    if (query.from) conditions.push(gte(returns.requestedAt, query.from));
    if (query.to) conditions.push(lte(returns.requestedAt, query.to));
    if (query.search) {
      const term = `%${query.search}%`;
      const searchCondition = or(
        ilike(returns.returnNumber, term),
        ilike(orders.orderNumber, term),
        ilike(returns.reason, term),
        ilike(merchants.businessName, term),
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ value } = { value: 0 }]] = await Promise.all([
      db
        .select({
          id: returns.id,
          returnNumber: returns.returnNumber,
          orderId: returns.orderId,
          orderNumber: orders.orderNumber,
          merchantId: returns.merchantId,
          merchantName: merchants.businessName,
          userId: returns.userId,
          customerName: users.fullName,
          status: returns.status,
          reason: returns.reason,
          requestedAt: returns.requestedAt,
          approvedAt: returns.approvedAt,
          completedAt: returns.completedAt,
          createdAt: returns.createdAt,
        })
        .from(returns)
        .innerJoin(orders, eq(orders.id, returns.orderId))
        .innerJoin(merchants, eq(merchants.id, returns.merchantId))
        .leftJoin(users, eq(users.id, returns.userId))
        .where(where)
        .orderBy(desc(returns.requestedAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ value: count() })
        .from(returns)
        .innerJoin(orders, eq(orders.id, returns.orderId))
        .innerJoin(merchants, eq(merchants.id, returns.merchantId))
        .where(where),
    ]);

    return paginated(c, rows, Number(value), pagination);
  },
);

commerceReturnRoutes.get(
  '/returns/:returnId',
  requirePermission('commerce:read'),
  async (c) => {
    const { ret } = await getReturnAccess(
      c.req.param('returnId'),
      c.get('user'),
      c.get('permissions'),
    );
    return ok(c, await getReturnPayload(ret.id));
  },
);

commerceReturnRoutes.post(
  '/orders/:orderId/returns',
  requirePermission('commerce:write'),
  validate('json', createReturnSchema),
  async (c) => {
    const access = await assertOrderAccess(
      c.req.param('orderId'),
      c.get('user'),
      c.get('permissions'),
    );
    if (access.order.status !== 'completed') {
      throw ApiError.badRequest('Return can only be requested for completed orders');
    }

    const body = c.req.valid('json');
    const uniqueItemIds = new Set(body.items.map((item) => item.orderItemId));
    if (uniqueItemIds.size !== body.items.length) {
      throw ApiError.badRequest('Duplicate order items in return request');
    }

    const orderItemRows = await db
      .select()
      .from(orderItems)
      .where(
        and(
          eq(orderItems.orderId, access.order.id),
          inArray(orderItems.id, [...uniqueItemIds]),
        ),
      );
    const orderItemById = new Map(orderItemRows.map((row) => [row.id, row]));
    if (orderItemById.size !== uniqueItemIds.size) {
      throw ApiError.badRequest('One or more order items do not belong to this order');
    }

    const returnedRows = await db
      .select({
        orderItemId: returnItems.orderItemId,
        quantity: returnItems.quantity,
      })
      .from(returnItems)
      .innerJoin(returns, eq(returns.id, returnItems.returnId))
      .where(
        and(
          eq(returns.orderId, access.order.id),
          inArray(returns.status, [...ACTIVE_RETURN_STATUSES]),
        ),
      );
    const returnedQuantities = new Map<string, number>();
    for (const row of returnedRows) {
      returnedQuantities.set(
        row.orderItemId,
        (returnedQuantities.get(row.orderItemId) ?? 0) + row.quantity,
      );
    }

    for (const requested of body.items) {
      const orderItem = orderItemById.get(requested.orderItemId);
      if (!orderItem) throw ApiError.badRequest('Order item not found');
      const alreadyReturned = returnedQuantities.get(orderItem.id) ?? 0;
      if (requested.quantity > orderItem.quantity - alreadyReturned) {
        throw ApiError.badRequest(
          `Return quantity exceeds remaining quantity for ${orderItem.productName}`,
        );
      }
    }

    const returnNumber = generateCode('RET');
    const created = await db.transaction(async (tx) => {
      const [ret] = await tx
        .insert(returns)
        .values({
          returnNumber,
          orderId: access.order.id,
          merchantId: access.order.merchantId,
          userId: access.order.userId,
          status: 'requested',
          reason: body.reason,
          requestedBy: c.get('user').id,
        })
        .returning();
      if (!ret) throw ApiError.internal('Failed to create return');

      await tx.insert(returnItems).values(
        body.items.map((item) => {
          const orderItem = orderItemById.get(item.orderItemId);
          if (!orderItem) throw ApiError.internal('Order item not found');
          return {
            returnId: ret.id,
            orderItemId: orderItem.id,
            quantity: item.quantity,
            unitPrice: orderItem.unitPrice,
            lineTotal: money(Number(orderItem.unitPrice) * item.quantity),
            condition: item.condition ?? 'other',
            reason: item.reason ?? null,
          };
        }),
      );

      return ret;
    });

    await writeAuditLog({
      actorUserId: c.get('user').id,
      action: 'return.create',
      entityType: 'return',
      entityId: created.id,
      newValues: {
        returnNumber: created.returnNumber,
        orderId: access.order.id,
        itemCount: body.items.length,
      },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });

    return c.json({ success: true as const, data: await getReturnPayload(created.id) }, 201);
  },
);

commerceReturnRoutes.patch(
  '/returns/:returnId/status',
  requirePermission('commerce:write'),
  validate('json', updateReturnSchema),
  async (c) => {
    const { ret, access } = await getReturnAccess(
      c.req.param('returnId'),
      c.get('user'),
      c.get('permissions'),
    );
    const body = c.req.valid('json');
    if (access.via === 'customer' && body.status !== 'cancelled') {
      throw ApiError.forbidden('Customers can only cancel return requests');
    }
    if (access.via === 'customer' && ret.status !== 'requested') {
      throw ApiError.forbidden('Customers can only cancel requested returns');
    }

    const allowed = RETURN_TRANSITIONS[ret.status] ?? [];
    if (!allowed.includes(body.status)) {
      throw ApiError.badRequest(
        `Return status cannot change from ${ret.status} to ${body.status}`,
      );
    }

    const now = new Date();
    let orderMarkedReturned = false;

    await db.transaction(async (tx) => {
      await tx
        .update(returns)
        .set({
          status: body.status as ReturnStatus,
          ...(body.note !== undefined ? { resolutionNote: body.note } : {}),
          ...(body.status === 'approved' || body.status === 'rejected'
            ? { reviewedBy: c.get('user').id }
            : {}),
          ...(body.status === 'approved' ? { approvedAt: now } : {}),
          ...(body.status === 'rejected' ? { rejectedAt: now } : {}),
          ...(body.status === 'received' ? { receivedAt: now } : {}),
          ...(body.status === 'completed' ? { completedAt: now } : {}),
          ...(body.status === 'cancelled' ? { cancelledAt: now } : {}),
        })
        .where(eq(returns.id, ret.id));

      if (body.status === 'completed') {
        const existingTransaction = await tx.query.salesTransactions.findFirst({
          where: eq(salesTransactions.returnId, ret.id),
          columns: { id: true },
        });
        if (!existingTransaction) {
          const returnItemRows = await tx
            .select({ lineTotal: returnItems.lineTotal })
            .from(returnItems)
            .where(eq(returnItems.returnId, ret.id));
          const returnTotal = returnItemRows.reduce(
            (sum, item) => sum + Number(item.lineTotal),
            0,
          );
          await tx.insert(salesTransactions).values({
            transactionNumber: generateCode('TRX'),
            orderId: ret.orderId,
            returnId: ret.id,
            merchantId: ret.merchantId,
            type: 'return',
            amount: money(-returnTotal),
            currency: access.order.currency,
            description: `Retur ${ret.returnNumber}`,
            occurredAt: now,
            createdBy: c.get('user').id,
          });
        }

        const orderItemRows = await tx
          .select({ id: orderItems.id, quantity: orderItems.quantity })
          .from(orderItems)
          .where(eq(orderItems.orderId, ret.orderId));
        const completedRows = await tx
          .select({
            orderItemId: returnItems.orderItemId,
            quantity: returnItems.quantity,
          })
          .from(returnItems)
          .innerJoin(returns, eq(returns.id, returnItems.returnId))
          .where(
            and(
              eq(returns.orderId, ret.orderId),
              eq(returns.status, 'completed'),
            ),
          );
        const completedQuantities = new Map<string, number>();
        for (const row of completedRows) {
          completedQuantities.set(
            row.orderItemId,
            (completedQuantities.get(row.orderItemId) ?? 0) + row.quantity,
          );
        }
        const fullyReturned =
          orderItemRows.length > 0 &&
          orderItemRows.every(
            (item) => (completedQuantities.get(item.id) ?? 0) >= item.quantity,
          );

        if (fullyReturned && access.order.status !== 'returned') {
          await tx
            .update(orders)
            .set({ status: 'returned', returnedAt: now })
            .where(eq(orders.id, ret.orderId));
          await tx.insert(orderStatusHistories).values({
            orderId: ret.orderId,
            fromStatus: access.order.status as OrderStatus,
            toStatus: 'returned',
            note: body.note ?? 'Seluruh item pesanan diretur',
            changedBy: c.get('user').id,
          });
          orderMarkedReturned = true;
        }
      }
    });

    await writeAuditLog({
      actorUserId: c.get('user').id,
      action: 'return.status.update',
      entityType: 'return',
      entityId: ret.id,
      oldValues: { status: ret.status },
      newValues: {
        status: body.status,
        note: body.note ?? null,
        orderMarkedReturned,
      },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });

    return ok(c, await getReturnPayload(ret.id));
  },
);
