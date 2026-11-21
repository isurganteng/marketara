import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  cartItems,
  checkoutSessions,
  customerAddresses,
  merchants,
  productSkus,
  products,
  shoppingCarts,
  storefrontProducts,
  storefronts,
} from '../../db/schema';
import { writeAuditLog } from '../../lib/audit';
import { ApiError } from '../../lib/errors';
import { ok } from '../../lib/http';
import type { AppEnv } from '../../lib/app-env';
import { validate } from '../../lib/validator';
import { requirePermission } from '../../middleware/auth';
import { getClientIp } from '../../services/auth';
import {
  addMinutes,
  getPrimaryImageMap,
  money,
  numericString,
  resolvePrice,
} from './shared';

const addressTypeSchema = z.enum(['home', 'office', 'other']);

const addressCreateSchema = z.object({
  label: z.string().trim().max(64).optional(),
  type: addressTypeSchema.optional(),
  recipientName: z.string().trim().min(2).max(255),
  phone: z.string().trim().min(6).max(32),
  addressLine1: z.string().trim().min(3).max(2000),
  addressLine2: z.string().trim().max(2000).optional(),
  city: z.string().trim().min(2).max(128),
  province: z.string().trim().min(2).max(128),
  postalCode: z.string().trim().max(16).optional(),
  country: z.string().trim().length(2).transform((value) => value.toUpperCase()).optional(),
  latitude: numericString.nullable().optional(),
  longitude: numericString.nullable().optional(),
  isDefault: z.boolean().optional(),
});

const addressUpdateSchema = addressCreateSchema
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Minimal satu field harus diisi',
  });

const addCartItemSchema = z.object({
  storefrontProductId: z.uuid(),
  skuId: z.uuid().nullable().optional(),
  quantity: z.coerce.number().int().min(1).max(999).default(1),
  notes: z.string().trim().max(500).optional(),
});

const updateCartItemSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(999),
  notes: z.string().trim().max(500).nullable().optional(),
});

const checkoutCreateSchema = z.object({
  addressId: z.uuid().nullable().optional(),
  contactName: z.string().trim().max(255).optional(),
  contactPhone: z.string().trim().max(32).optional(),
  contactEmail: z.string().trim().toLowerCase().max(255).email().optional(),
  notes: z.string().trim().max(2000).optional(),
});

const checkoutUpdateSchema = checkoutCreateSchema
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Minimal satu field harus diisi',
  });

const ACTIVE_CHECKOUT_STATUSES = ['draft', 'pending', 'ready'] as const;
const CART_TTL_DAYS = 30;
const CHECKOUT_TTL_MINUTES = 30;

function cartExpiry() {
  return addMinutes(new Date(), CART_TTL_DAYS * 24 * 60);
}

async function getOrCreateCart(userId: string) {
  let cart = await db.query.shoppingCarts.findFirst({
    where: and(eq(shoppingCarts.userId, userId), eq(shoppingCarts.status, 'active')),
  });

  if (cart?.expiresAt && cart.expiresAt.getTime() < Date.now()) {
    await db
      .update(shoppingCarts)
      .set({ status: 'expired' })
      .where(eq(shoppingCarts.id, cart.id));
    cart = undefined;
  }
  if (cart) return cart;

  try {
    const [created] = await db
      .insert(shoppingCarts)
      .values({ userId, status: 'active', expiresAt: cartExpiry() })
      .returning();
    if (!created) throw ApiError.internal('Failed to create cart');
    return created;
  } catch (error) {
    // Unique index aktif per user: request paralel bisa lebih dulu membuat cart.
    const existing = await db.query.shoppingCarts.findFirst({
      where: and(eq(shoppingCarts.userId, userId), eq(shoppingCarts.status, 'active')),
    });
    if (existing) return existing;
    throw error;
  }
}

async function buildCartPayload(cartId: string) {
  const cart = await db.query.shoppingCarts.findFirst({
    where: eq(shoppingCarts.id, cartId),
  });
  if (!cart) throw ApiError.notFound('Cart not found');

  const rows = await db
    .select({
      id: cartItems.id,
      cartId: cartItems.cartId,
      quantity: cartItems.quantity,
      unitPrice: cartItems.unitPrice,
      productName: cartItems.productName,
      skuCode: cartItems.skuCode,
      notes: cartItems.notes,
      storefrontProductId: storefrontProducts.id,
      storefrontId: storefronts.id,
      storefrontName: storefronts.name,
      storefrontSlug: storefronts.slug,
      storefrontLogoUrl: storefronts.logoUrl,
      storefrontStatus: storefronts.status,
      merchantId: merchants.id,
      merchantName: merchants.businessName,
      merchantStatus: merchants.status,
      productId: products.id,
      currentProductName: products.name,
      productSlug: products.slug,
      productStatus: products.status,
      productDeletedAt: products.deletedAt,
      basePrice: products.basePrice,
      currency: products.currency,
      priceOverride: storefrontProducts.priceOverride,
      isVisible: storefrontProducts.isVisible,
      skuId: productSkus.id,
      skuPrice: productSkus.price,
      skuStatus: productSkus.status,
      currentSkuCode: productSkus.skuCode,
      createdAt: cartItems.createdAt,
      updatedAt: cartItems.updatedAt,
    })
    .from(cartItems)
    .innerJoin(storefrontProducts, eq(storefrontProducts.id, cartItems.storefrontProductId))
    .innerJoin(storefronts, eq(storefronts.id, storefrontProducts.storefrontId))
    .innerJoin(merchants, eq(merchants.id, storefronts.merchantId))
    .innerJoin(products, eq(products.id, storefrontProducts.productId))
    .leftJoin(productSkus, eq(productSkus.id, cartItems.skuId))
    .where(eq(cartItems.cartId, cart.id))
    .orderBy(asc(cartItems.createdAt));

  const images = await getPrimaryImageMap(rows.map((row) => row.productId));

  const items = rows.map((row) => {
    const currentPrice = resolvePrice(row.priceOverride, row.skuPrice, row.basePrice);
    const available =
      row.storefrontStatus === 'published' &&
      row.merchantStatus === 'verified' &&
      row.productStatus === 'active' &&
      row.productDeletedAt == null &&
      row.isVisible &&
      (row.skuId == null || row.skuStatus === 'active');
    const unitPrice = Number(row.unitPrice);
    const price = Number(currentPrice);

    return {
      ...row,
      image: images.get(row.productId) ?? null,
      currentUnitPrice: currentPrice,
      currentSkuCode: row.currentSkuCode ?? null,
      lineTotal: money(unitPrice * row.quantity),
      currentLineTotal: money(price * row.quantity),
      priceChanged: unitPrice !== price,
      available,
    };
  });

  const subtotal = items.reduce((sum, item) => sum + Number(item.lineTotal), 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    ...cart,
    items,
    summary: {
      itemCount,
      lineCount: items.length,
      subtotal: money(subtotal),
      currency: cart.currency,
      hasUnavailableItems: items.some((item) => !item.available),
      hasPriceChanges: items.some((item) => item.priceChanged),
    },
  };
}

async function getOwnedAddress(addressId: string, userId: string) {
  const address = await db.query.customerAddresses.findFirst({
    where: and(
      eq(customerAddresses.id, addressId),
      eq(customerAddresses.userId, userId),
      isNull(customerAddresses.deletedAt),
    ),
  });
  if (!address) throw ApiError.notFound('Address not found');
  return address;
}

export const commerceCartRoutes = new Hono<AppEnv>();

/* ------------------------------ Addresses ---------------------------- */

commerceCartRoutes.get('/addresses', requirePermission('commerce:read'), async (c) => {
  const rows = await db
    .select()
    .from(customerAddresses)
    .where(
      and(
        eq(customerAddresses.userId, c.get('user').id),
        isNull(customerAddresses.deletedAt),
      ),
    )
    .orderBy(
      sql`${customerAddresses.isDefault} desc`,
      asc(customerAddresses.createdAt),
    );
  return ok(c, rows);
});

commerceCartRoutes.post(
  '/addresses',
  requirePermission('commerce:write'),
  validate('json', addressCreateSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');

    const existing = await db
      .select({ id: customerAddresses.id })
      .from(customerAddresses)
      .where(
        and(
          eq(customerAddresses.userId, user.id),
          isNull(customerAddresses.deletedAt),
        ),
      )
      .limit(1);
    const isDefault = body.isDefault ?? existing.length === 0;

    const address = await db.transaction(async (tx) => {
      if (isDefault) {
        await tx
          .update(customerAddresses)
          .set({ isDefault: false })
          .where(eq(customerAddresses.userId, user.id));
      }
      const [created] = await tx
        .insert(customerAddresses)
        .values({
          userId: user.id,
          label: body.label ?? 'Rumah',
          type: body.type ?? 'home',
          recipientName: body.recipientName,
          phone: body.phone,
          addressLine1: body.addressLine1,
          addressLine2: body.addressLine2 ?? null,
          city: body.city,
          province: body.province,
          postalCode: body.postalCode ?? null,
          country: body.country ?? 'ID',
          latitude: body.latitude ?? null,
          longitude: body.longitude ?? null,
          isDefault,
        })
        .returning();
      return created;
    });

    return c.json({ success: true as const, data: address }, 201);
  },
);

commerceCartRoutes.patch(
  '/addresses/:addressId',
  requirePermission('commerce:write'),
  validate('json', addressUpdateSchema),
  async (c) => {
    const address = await getOwnedAddress(c.req.param('addressId'), c.get('user').id);
    const body = c.req.valid('json');

    const updated = await db.transaction(async (tx) => {
      if (body.isDefault === true) {
        await tx
          .update(customerAddresses)
          .set({ isDefault: false })
          .where(eq(customerAddresses.userId, c.get('user').id));
      }
      const [row] = await tx
        .update(customerAddresses)
        .set({
          ...(body.label !== undefined ? { label: body.label } : {}),
          ...(body.type !== undefined ? { type: body.type } : {}),
          ...(body.recipientName !== undefined
            ? { recipientName: body.recipientName }
            : {}),
          ...(body.phone !== undefined ? { phone: body.phone } : {}),
          ...(body.addressLine1 !== undefined
            ? { addressLine1: body.addressLine1 }
            : {}),
          ...(body.addressLine2 !== undefined ? { addressLine2: body.addressLine2 } : {}),
          ...(body.city !== undefined ? { city: body.city } : {}),
          ...(body.province !== undefined ? { province: body.province } : {}),
          ...(body.postalCode !== undefined ? { postalCode: body.postalCode } : {}),
          ...(body.country !== undefined ? { country: body.country } : {}),
          ...(body.latitude !== undefined ? { latitude: body.latitude } : {}),
          ...(body.longitude !== undefined ? { longitude: body.longitude } : {}),
          ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
        })
        .where(eq(customerAddresses.id, address.id))
        .returning();
      return row;
    });

    return ok(c, updated);
  },
);

commerceCartRoutes.delete(
  '/addresses/:addressId',
  requirePermission('commerce:write'),
  async (c) => {
    const address = await getOwnedAddress(c.req.param('addressId'), c.get('user').id);
    await db
      .update(customerAddresses)
      .set({ deletedAt: new Date(), isDefault: false })
      .where(eq(customerAddresses.id, address.id));
    return ok(c, { message: 'Address deleted' });
  },
);

/* -------------------------------- Cart ------------------------------- */

commerceCartRoutes.get('/cart', requirePermission('commerce:read'), async (c) => {
  const cart = await getOrCreateCart(c.get('user').id);
  return ok(c, await buildCartPayload(cart.id));
});

commerceCartRoutes.delete('/cart', requirePermission('commerce:write'), async (c) => {
  const cart = await getOrCreateCart(c.get('user').id);
  await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
  return ok(c, await buildCartPayload(cart.id));
});

commerceCartRoutes.post(
  '/cart/items',
  requirePermission('commerce:write'),
  validate('json', addCartItemSchema),
  async (c) => {
    const body = c.req.valid('json');
    const cart = await getOrCreateCart(c.get('user').id);

    const [product] = await db
      .select({
        storefrontProductId: storefrontProducts.id,
        productId: products.id,
        productName: products.name,
        basePrice: products.basePrice,
        currency: products.currency,
        priceOverride: storefrontProducts.priceOverride,
        isVisible: storefrontProducts.isVisible,
        storefrontStatus: storefronts.status,
        merchantStatus: merchants.status,
        productStatus: products.status,
        productDeletedAt: products.deletedAt,
      })
      .from(storefrontProducts)
      .innerJoin(storefronts, eq(storefronts.id, storefrontProducts.storefrontId))
      .innerJoin(merchants, eq(merchants.id, storefronts.merchantId))
      .innerJoin(products, eq(products.id, storefrontProducts.productId))
      .where(eq(storefrontProducts.id, body.storefrontProductId));

    if (
      !product ||
      !product.isVisible ||
      product.storefrontStatus !== 'published' ||
      product.merchantStatus !== 'verified' ||
      product.productStatus !== 'active' ||
      product.productDeletedAt != null
    ) {
      throw ApiError.badRequest('Product is not available on this storefront');
    }

    const sku = body.skuId
      ? await db.query.productSkus.findFirst({
          where: and(
            eq(productSkus.id, body.skuId),
            eq(productSkus.productId, product.productId),
            eq(productSkus.status, 'active'),
          ),
        })
      : undefined;
    if (body.skuId && !sku) throw ApiError.badRequest('SKU is not available');

    const unitPrice = resolvePrice(product.priceOverride, sku?.price, product.basePrice);
    const existing = await db.query.cartItems.findFirst({
      where: and(
        eq(cartItems.cartId, cart.id),
        eq(cartItems.storefrontProductId, product.storefrontProductId),
        body.skuId ? eq(cartItems.skuId, body.skuId) : isNull(cartItems.skuId),
      ),
    });

    if (existing) {
      await db
        .update(cartItems)
        .set({
          quantity: Math.min(999, existing.quantity + body.quantity),
          unitPrice,
          productName: product.productName,
          skuCode: sku?.skuCode ?? null,
          notes: body.notes ?? existing.notes,
        })
        .where(eq(cartItems.id, existing.id));
    } else {
      await db.insert(cartItems).values({
        cartId: cart.id,
        storefrontProductId: product.storefrontProductId,
        skuId: sku?.id ?? null,
        quantity: body.quantity,
        unitPrice,
        productName: product.productName,
        skuCode: sku?.skuCode ?? null,
        notes: body.notes ?? null,
      });
    }

    return c.json(
      { success: true as const, data: await buildCartPayload(cart.id) },
      201,
    );
  },
);

commerceCartRoutes.patch(
  '/cart/items/:itemId',
  requirePermission('commerce:write'),
  validate('json', updateCartItemSchema),
  async (c) => {
    const cart = await getOrCreateCart(c.get('user').id);
    const item = await db.query.cartItems.findFirst({
      where: and(
        eq(cartItems.id, c.req.param('itemId')),
        eq(cartItems.cartId, cart.id),
      ),
    });
    if (!item) throw ApiError.notFound('Cart item not found');

    const body = c.req.valid('json');
    await db
      .update(cartItems)
      .set({
        quantity: body.quantity,
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      })
      .where(eq(cartItems.id, item.id));

    return ok(c, await buildCartPayload(cart.id));
  },
);

commerceCartRoutes.delete(
  '/cart/items/:itemId',
  requirePermission('commerce:write'),
  async (c) => {
    const cart = await getOrCreateCart(c.get('user').id);
    const item = await db.query.cartItems.findFirst({
      where: and(
        eq(cartItems.id, c.req.param('itemId')),
        eq(cartItems.cartId, cart.id),
      ),
      columns: { id: true },
    });
    if (!item) throw ApiError.notFound('Cart item not found');

    await db.delete(cartItems).where(eq(cartItems.id, item.id));
    return ok(c, await buildCartPayload(cart.id));
  },
);

/* ------------------------------ Checkout ----------------------------- */

commerceCartRoutes.post(
  '/checkout',
  requirePermission('commerce:write'),
  validate('json', checkoutCreateSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const cart = await getOrCreateCart(user.id);
    const payload = await buildCartPayload(cart.id);
    if (payload.items.length === 0) throw ApiError.badRequest('Cart is empty');

    const unavailable = payload.items.filter((item) => !item.available);
    if (unavailable.length > 0) {
      throw ApiError.conflict('Some cart items are no longer available', {
        items: unavailable.map((item) => ({
          id: item.id,
          productName: item.productName,
        })),
      });
    }

    const address = body.addressId
      ? await getOwnedAddress(body.addressId, user.id)
      : undefined;

    // Harga dihitung ulang saat checkout agar tidak memakai snapshot yang basi.
    const itemsSnapshot = payload.items.map((item) => {
      const unitPrice = item.currentUnitPrice;
      return {
        cartItemId: item.id,
        storefrontProductId: item.storefrontProductId,
        storefrontId: item.storefrontId,
        storefrontName: item.storefrontName,
        merchantId: item.merchantId,
        merchantName: item.merchantName,
        productId: item.productId,
        productName: item.currentProductName,
        productSlug: item.productSlug,
        skuId: item.skuId,
        skuCode: item.currentSkuCode,
        quantity: item.quantity,
        unitPrice,
        currency: item.currency,
        lineTotal: money(Number(unitPrice) * item.quantity),
      };
    });
    const subtotal = itemsSnapshot.reduce(
      (sum, item) => sum + Number(item.lineTotal),
      0,
    );
    const grandTotal = subtotal;
    const itemCount = itemsSnapshot.reduce((sum, item) => sum + item.quantity, 0);

    const session = await db.transaction(async (tx) => {
      for (const item of payload.items) {
        if (item.priceChanged) {
          await tx
            .update(cartItems)
            .set({ unitPrice: item.currentUnitPrice })
            .where(eq(cartItems.id, item.id));
        }
      }

      await tx
        .update(checkoutSessions)
        .set({ status: 'cancelled' })
        .where(
          and(
            eq(checkoutSessions.cartId, cart.id),
            inArray(checkoutSessions.status, [...ACTIVE_CHECKOUT_STATUSES]),
          ),
        );

      const [created] = await tx
        .insert(checkoutSessions)
        .values({
          cartId: cart.id,
          userId: user.id,
          status: 'pending',
          currency: cart.currency,
          itemCount,
          subtotal: money(subtotal),
          discountTotal: '0',
          shippingTotal: '0',
          grandTotal: money(grandTotal),
          addressId: address?.id ?? null,
          addressSnapshot: address ? { ...address } : null,
          itemsSnapshot,
          contactName: body.contactName ?? user.fullName,
          contactPhone: body.contactPhone ?? null,
          contactEmail: body.contactEmail ?? user.email,
          notes: body.notes ?? null,
          expiresAt: addMinutes(new Date(), CHECKOUT_TTL_MINUTES),
        })
        .returning();
      return created;
    });

    await writeAuditLog({
      actorUserId: user.id,
      action: 'checkout.create',
      entityType: 'checkout_session',
      entityId: session?.id,
      newValues: { cartId: cart.id, grandTotal: money(grandTotal), itemCount },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });

    return c.json({ success: true as const, data: session }, 201);
  },
);

commerceCartRoutes.get(
  '/checkout/:checkoutId',
  requirePermission('commerce:read'),
  async (c) => {
    const session = await db.query.checkoutSessions.findFirst({
      where: and(
        eq(checkoutSessions.id, c.req.param('checkoutId')),
        eq(checkoutSessions.userId, c.get('user').id),
      ),
    });
    if (!session) throw ApiError.notFound('Checkout session not found');
    return ok(c, session);
  },
);

commerceCartRoutes.patch(
  '/checkout/:checkoutId',
  requirePermission('commerce:write'),
  validate('json', checkoutUpdateSchema),
  async (c) => {
    const session = await db.query.checkoutSessions.findFirst({
      where: and(
        eq(checkoutSessions.id, c.req.param('checkoutId')),
        eq(checkoutSessions.userId, c.get('user').id),
      ),
    });
    if (!session) throw ApiError.notFound('Checkout session not found');
    if (!ACTIVE_CHECKOUT_STATUSES.includes(session.status as (typeof ACTIVE_CHECKOUT_STATUSES)[number])) {
      throw ApiError.badRequest('Checkout session is no longer editable');
    }

    const body = c.req.valid('json');
    let addressSnapshot: Record<string, unknown> | null | undefined;
    if (body.addressId === null) {
      addressSnapshot = null;
    } else if (body.addressId) {
      addressSnapshot = { ...(await getOwnedAddress(body.addressId, c.get('user').id)) };
    }

    const [updated] = await db
      .update(checkoutSessions)
      .set({
        ...(body.addressId !== undefined ? { addressId: body.addressId } : {}),
        ...(addressSnapshot !== undefined ? { addressSnapshot } : {}),
        ...(body.contactName !== undefined ? { contactName: body.contactName } : {}),
        ...(body.contactPhone !== undefined ? { contactPhone: body.contactPhone } : {}),
        ...(body.contactEmail !== undefined ? { contactEmail: body.contactEmail } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      })
      .where(eq(checkoutSessions.id, session.id))
      .returning();

    return ok(c, updated);
  },
);

commerceCartRoutes.post(
  '/checkout/:checkoutId/cancel',
  requirePermission('commerce:write'),
  async (c) => {
    const session = await db.query.checkoutSessions.findFirst({
      where: and(
        eq(checkoutSessions.id, c.req.param('checkoutId')),
        eq(checkoutSessions.userId, c.get('user').id),
      ),
    });
    if (!session) throw ApiError.notFound('Checkout session not found');
    if (session.status === 'completed') {
      throw ApiError.badRequest('Completed checkout cannot be cancelled');
    }

    const [updated] = await db
      .update(checkoutSessions)
      .set({ status: 'cancelled' })
      .where(eq(checkoutSessions.id, session.id))
      .returning();
    return ok(c, updated);
  },
);
