import { and, asc, count, desc, eq, ilike, inArray, isNull, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  brands,
  channelListings,
  merchants,
  productCategories,
  products,
  salesChannels,
  storefrontProducts,
  storefronts,
  stores,
} from '../../db/schema';
import {
  assertMerchantAccess,
  assertStorefrontAccess,
  storefrontScopeCondition,
} from '../../lib/access';
import { writeAuditLog } from '../../lib/audit';
import { ApiError } from '../../lib/errors';
import { getPagination, ok, paginated } from '../../lib/http';
import type { AppEnv } from '../../lib/app-env';
import { uniqueSlug } from '../../lib/slug';
import { validate } from '../../lib/validator';
import { requirePermission } from '../../middleware/auth';
import { getClientIp } from '../../services/auth';
import {
  currencySchema,
  getPrimaryImageMap,
  numericString,
  resolvePrice,
} from './shared';

const storefrontStatusSchema = z.enum(['draft', 'published', 'inactive', 'suspended']);
const listingStatusSchema = z.enum(['draft', 'active', 'paused', 'ended']);

const createStorefrontSchema = z.object({
  merchantId: z.uuid(),
  storeId: z.uuid().nullable().optional(),
  salesChannelId: z.uuid().nullable().optional(),
  name: z.string().trim().min(2).max(255),
  description: z.string().trim().max(10000).optional(),
  logoUrl: z.string().url().max(2048).optional(),
  bannerUrl: z.string().url().max(2048).optional(),
  status: storefrontStatusSchema.optional(),
  currency: currencySchema.optional(),
  contactName: z.string().trim().max(255).optional(),
  contactPhone: z.string().trim().max(32).optional(),
  contactEmail: z.string().trim().toLowerCase().max(255).email().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  isFeatured: z.boolean().optional(),
});

const updateStorefrontSchema = createStorefrontSchema
  .omit({ merchantId: true })
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Minimal satu field harus diisi',
  });

const listStorefrontsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  status: storefrontStatusSchema.optional(),
  salesChannelId: z.uuid().optional(),
  isFeatured: z.enum(['true', 'false']).optional(),
});

const addProductSchema = z.object({
  productId: z.uuid(),
  priceOverride: numericString.nullable().optional(),
  compareAtPrice: numericString.nullable().optional(),
  isVisible: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

const updateProductSchema = addProductSchema
  .omit({ productId: true })
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Minimal satu field harus diisi',
  });

const listProductsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
});

const createListingSchema = z.object({
  channelId: z.uuid(),
  storefrontId: z.uuid(),
  productId: z.uuid().optional(),
  externalListingId: z.string().trim().max(255).optional(),
  title: z.string().trim().max(255).optional(),
  description: z.string().trim().max(10000).optional(),
  price: numericString.optional(),
  currency: currencySchema.optional(),
  status: listingStatusSchema.optional(),
  externalUrl: z.string().url().max(2048).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const updateListingSchema = createListingSchema
  .omit({ storefrontId: true, channelId: true })
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Minimal satu field harus diisi',
  });

const listListingsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  channelId: z.uuid().optional(),
  storefrontId: z.uuid().optional(),
  productId: z.uuid().optional(),
  status: listingStatusSchema.optional(),
  search: z.string().trim().max(100).optional(),
});

async function assertStoreBelongsToMerchant(storeId: string, merchantId: string) {
  const store = await db.query.stores.findFirst({
    where: and(
      eq(stores.id, storeId),
      eq(stores.merchantId, merchantId),
      isNull(stores.deletedAt),
    ),
    columns: { id: true },
  });
  if (!store) throw ApiError.badRequest('Store does not belong to this merchant');
}

async function assertChannelExists(channelId: string) {
  const channel = await db.query.salesChannels.findFirst({
    where: eq(salesChannels.id, channelId),
    columns: { id: true },
  });
  if (!channel) throw ApiError.badRequest('Sales channel not found');
}

function assertCanPublish(status: string, merchantStatus: string) {
  if (status === 'published' && merchantStatus !== 'verified') {
    throw ApiError.badRequest('Merchant must be verified before publishing a storefront');
  }
}

async function productCountMap(storefrontIds: string[]) {
  const map = new Map<string, number>();
  if (storefrontIds.length === 0) return map;

  const rows = await db
    .select({ storefrontId: storefrontProducts.storefrontId, value: count() })
    .from(storefrontProducts)
    .where(
      and(
        eq(storefrontProducts.isVisible, true),
        inArray(storefrontProducts.storefrontId, storefrontIds),
      ),
    )
    .groupBy(storefrontProducts.storefrontId);

  for (const row of rows) map.set(row.storefrontId, Number(row.value));
  return map;
}

export const commerceStorefrontRoutes = new Hono<AppEnv>();

/* ----------------------------- Storefronts --------------------------- */

commerceStorefrontRoutes.get(
  '/storefronts',
  requirePermission('commerce:read'),
  validate('query', listStorefrontsSchema),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions = [isNull(storefronts.deletedAt)];

    const scope = storefrontScopeCondition(c.get('user'), c.get('permissions'));
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(storefronts.merchantId, query.merchantId));
    if (query.status) conditions.push(eq(storefronts.status, query.status));
    if (query.salesChannelId) {
      conditions.push(eq(storefronts.salesChannelId, query.salesChannelId));
    }
    if (query.isFeatured) {
      conditions.push(eq(storefronts.isFeatured, query.isFeatured === 'true'));
    }
    if (query.search) {
      const term = `%${query.search}%`;
      const searchCondition = or(
        ilike(storefronts.name, term),
        ilike(storefronts.description, term),
        ilike(merchants.businessName, term),
      );
      if (searchCondition) conditions.push(searchCondition);
    }
    const where = and(...conditions);

    const [rows, [{ value } = { value: 0 }]] = await Promise.all([
      db
        .select({
          id: storefronts.id,
          merchantId: storefronts.merchantId,
          merchantName: merchants.businessName,
          storeId: storefronts.storeId,
          storeName: stores.name,
          salesChannelId: storefronts.salesChannelId,
          salesChannelName: salesChannels.name,
          name: storefronts.name,
          slug: storefronts.slug,
          description: storefronts.description,
          logoUrl: storefronts.logoUrl,
          bannerUrl: storefronts.bannerUrl,
          status: storefronts.status,
          currency: storefronts.currency,
          isFeatured: storefronts.isFeatured,
          publishedAt: storefronts.publishedAt,
          createdAt: storefronts.createdAt,
          updatedAt: storefronts.updatedAt,
        })
        .from(storefronts)
        .innerJoin(merchants, eq(merchants.id, storefronts.merchantId))
        .leftJoin(stores, eq(stores.id, storefronts.storeId))
        .leftJoin(salesChannels, eq(salesChannels.id, storefronts.salesChannelId))
        .where(where)
        .orderBy(desc(storefronts.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ value: count() }).from(storefronts).where(where),
    ]);

    const counts = await productCountMap(rows.map((row) => row.id));
    return paginated(
      c,
      rows.map((row) => ({ ...row, productCount: counts.get(row.id) ?? 0 })),
      Number(value),
      pagination,
    );
  },
);

commerceStorefrontRoutes.post(
  '/storefronts',
  requirePermission('commerce:write'),
  validate('json', createStorefrontSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const { merchant } = await assertMerchantAccess(
      body.merchantId,
      user,
      c.get('permissions'),
      { manage: true },
    );

    if (body.storeId) await assertStoreBelongsToMerchant(body.storeId, merchant.id);
    if (body.salesChannelId) await assertChannelExists(body.salesChannelId);
    const status = body.status ?? 'draft';
    assertCanPublish(status, merchant.status);

    const [storefront] = await db
      .insert(storefronts)
      .values({
        merchantId: merchant.id,
        storeId: body.storeId ?? null,
        salesChannelId: body.salesChannelId ?? null,
        name: body.name,
        slug: uniqueSlug(body.name, merchant.code.toLowerCase()),
        description: body.description ?? null,
        logoUrl: body.logoUrl ?? null,
        bannerUrl: body.bannerUrl ?? null,
        status,
        currency: body.currency ?? 'IDR',
        contactName: body.contactName ?? null,
        contactPhone: body.contactPhone ?? null,
        contactEmail: body.contactEmail ?? null,
        settings: body.settings ?? null,
        isFeatured: body.isFeatured ?? false,
        publishedAt: status === 'published' ? new Date() : null,
      })
      .returning();

    if (!storefront) throw ApiError.internal('Failed to create storefront');

    await writeAuditLog({
      actorUserId: user.id,
      action: 'storefront.create',
      entityType: 'storefront',
      entityId: storefront.id,
      newValues: {
        merchantId: merchant.id,
        name: storefront.name,
        status: storefront.status,
      },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });

    return c.json({ success: true as const, data: storefront }, 201);
  },
);

commerceStorefrontRoutes.get(
  '/storefronts/:storefrontId',
  requirePermission('commerce:read'),
  async (c) => {
    const { storefront, merchant, role } = await assertStorefrontAccess(
      c.req.param('storefrontId'),
      c.get('user'),
      c.get('permissions'),
    );

    const [store, channel, rows] = await Promise.all([
      storefront.storeId
        ? db.query.stores.findFirst({ where: eq(stores.id, storefront.storeId) })
        : Promise.resolve(undefined),
      storefront.salesChannelId
        ? db.query.salesChannels.findFirst({
            where: eq(salesChannels.id, storefront.salesChannelId),
          })
        : Promise.resolve(undefined),
      db
        .select({
          id: storefrontProducts.id,
          storefrontId: storefrontProducts.storefrontId,
          productId: products.id,
          productName: products.name,
          productSlug: products.slug,
          productStatus: products.status,
          basePrice: products.basePrice,
          priceOverride: storefrontProducts.priceOverride,
          compareAtPrice: storefrontProducts.compareAtPrice,
          isVisible: storefrontProducts.isVisible,
          isFeatured: storefrontProducts.isFeatured,
          sortOrder: storefrontProducts.sortOrder,
          currency: products.currency,
          categoryName: productCategories.name,
          brandName: brands.name,
          createdAt: storefrontProducts.createdAt,
          updatedAt: storefrontProducts.updatedAt,
        })
        .from(storefrontProducts)
        .innerJoin(products, eq(products.id, storefrontProducts.productId))
        .leftJoin(productCategories, eq(productCategories.id, products.categoryId))
        .leftJoin(brands, eq(brands.id, products.brandId))
        .where(eq(storefrontProducts.storefrontId, storefront.id))
        .orderBy(asc(storefrontProducts.sortOrder), asc(products.name)),
    ]);

    const images = await getPrimaryImageMap(rows.map((row) => row.productId));

    return ok(c, {
      ...storefront,
      accessRole: role,
      merchant: {
        id: merchant.id,
        code: merchant.code,
        businessName: merchant.businessName,
        slug: merchant.slug,
        status: merchant.status,
        logoUrl: merchant.logoUrl,
      },
      store: store ?? null,
      salesChannel: channel ?? null,
      products: rows.map((row) => ({
        ...row,
        effectivePrice: resolvePrice(row.priceOverride, null, row.basePrice),
        image: images.get(row.productId) ?? null,
      })),
    });
  },
);

commerceStorefrontRoutes.patch(
  '/storefronts/:storefrontId',
  requirePermission('commerce:write'),
  validate('json', updateStorefrontSchema),
  async (c) => {
    const body = c.req.valid('json');
    const { storefront, merchant } = await assertStorefrontAccess(
      c.req.param('storefrontId'),
      c.get('user'),
      c.get('permissions'),
      { manage: true },
    );

    if (body.storeId) await assertStoreBelongsToMerchant(body.storeId, merchant.id);
    if (body.salesChannelId) await assertChannelExists(body.salesChannelId);
    if (body.status) assertCanPublish(body.status, merchant.status);

    const [updated] = await db
      .update(storefronts)
      .set({
        ...(body.storeId !== undefined ? { storeId: body.storeId } : {}),
        ...(body.salesChannelId !== undefined
          ? { salesChannelId: body.salesChannelId }
          : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl } : {}),
        ...(body.bannerUrl !== undefined ? { bannerUrl: body.bannerUrl } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.status === 'published' && !storefront.publishedAt
          ? { publishedAt: new Date() }
          : {}),
        ...(body.currency !== undefined ? { currency: body.currency } : {}),
        ...(body.contactName !== undefined ? { contactName: body.contactName } : {}),
        ...(body.contactPhone !== undefined ? { contactPhone: body.contactPhone } : {}),
        ...(body.contactEmail !== undefined ? { contactEmail: body.contactEmail } : {}),
        ...(body.settings !== undefined ? { settings: body.settings } : {}),
        ...(body.isFeatured !== undefined ? { isFeatured: body.isFeatured } : {}),
      })
      .where(eq(storefronts.id, storefront.id))
      .returning();

    await writeAuditLog({
      actorUserId: c.get('user').id,
      action: 'storefront.update',
      entityType: 'storefront',
      entityId: storefront.id,
      oldValues: { status: storefront.status, name: storefront.name },
      newValues: body as Record<string, unknown>,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });

    return ok(c, updated);
  },
);

commerceStorefrontRoutes.delete(
  '/storefronts/:storefrontId',
  requirePermission('commerce:write'),
  async (c) => {
    const { storefront } = await assertStorefrontAccess(
      c.req.param('storefrontId'),
      c.get('user'),
      c.get('permissions'),
      { manage: true },
    );

    await db
      .update(storefronts)
      .set({ status: 'inactive', deletedAt: new Date() })
      .where(eq(storefronts.id, storefront.id));

    await writeAuditLog({
      actorUserId: c.get('user').id,
      action: 'storefront.archive',
      entityType: 'storefront',
      entityId: storefront.id,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });

    return ok(c, { message: 'Storefront archived' });
  },
);

/* --------------------------- Storefront items ------------------------ */

commerceStorefrontRoutes.get(
  '/storefronts/:storefrontId/products',
  requirePermission('commerce:read'),
  validate('query', listProductsSchema),
  async (c) => {
    const { storefront } = await assertStorefrontAccess(
      c.req.param('storefrontId'),
      c.get('user'),
      c.get('permissions'),
    );
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions = [eq(storefrontProducts.storefrontId, storefront.id)];

    if (query.search) {
      const term = `%${query.search}%`;
      const searchCondition = or(
        ilike(products.name, term),
        ilike(products.slug, term),
        ilike(products.shortDescription, term),
      );
      if (searchCondition) conditions.push(searchCondition);
    }
    const where = and(...conditions);

    const [rows, [{ value } = { value: 0 }]] = await Promise.all([
      db
        .select({
          id: storefrontProducts.id,
          productId: products.id,
          productName: products.name,
          productSlug: products.slug,
          productStatus: products.status,
          basePrice: products.basePrice,
          priceOverride: storefrontProducts.priceOverride,
          compareAtPrice: storefrontProducts.compareAtPrice,
          isVisible: storefrontProducts.isVisible,
          isFeatured: storefrontProducts.isFeatured,
          sortOrder: storefrontProducts.sortOrder,
          currency: products.currency,
          categoryName: productCategories.name,
          brandName: brands.name,
          createdAt: storefrontProducts.createdAt,
          updatedAt: storefrontProducts.updatedAt,
        })
        .from(storefrontProducts)
        .innerJoin(products, eq(products.id, storefrontProducts.productId))
        .leftJoin(productCategories, eq(productCategories.id, products.categoryId))
        .leftJoin(brands, eq(brands.id, products.brandId))
        .where(where)
        .orderBy(asc(storefrontProducts.sortOrder), asc(products.name))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ value: count() })
        .from(storefrontProducts)
        .innerJoin(products, eq(products.id, storefrontProducts.productId))
        .where(where),
    ]);

    const images = await getPrimaryImageMap(rows.map((row) => row.productId));
    return paginated(
      c,
      rows.map((row) => ({
        ...row,
        effectivePrice: resolvePrice(row.priceOverride, null, row.basePrice),
        image: images.get(row.productId) ?? null,
      })),
      Number(value),
      pagination,
    );
  },
);

commerceStorefrontRoutes.post(
  '/storefronts/:storefrontId/products',
  requirePermission('commerce:write'),
  validate('json', addProductSchema),
  async (c) => {
    const { storefront, merchant } = await assertStorefrontAccess(
      c.req.param('storefrontId'),
      c.get('user'),
      c.get('permissions'),
      { manage: true },
    );
    const body = c.req.valid('json');

    const product = await db.query.products.findFirst({
      where: and(
        eq(products.id, body.productId),
        eq(products.merchantId, merchant.id),
        isNull(products.deletedAt),
      ),
      columns: { id: true, status: true },
    });
    if (!product) throw ApiError.notFound('Product not found');
    if (product.status === 'archived') {
      throw ApiError.badRequest('Archived product cannot be added to a storefront');
    }

    const [item] = await db
      .insert(storefrontProducts)
      .values({
        storefrontId: storefront.id,
        productId: product.id,
        priceOverride: body.priceOverride ?? null,
        compareAtPrice: body.compareAtPrice ?? null,
        isVisible: body.isVisible ?? true,
        isFeatured: body.isFeatured ?? false,
        sortOrder: body.sortOrder ?? 0,
      })
      .onConflictDoUpdate({
        target: [storefrontProducts.storefrontId, storefrontProducts.productId],
        set: {
          ...(body.priceOverride !== undefined ? { priceOverride: body.priceOverride } : {}),
          ...(body.compareAtPrice !== undefined
            ? { compareAtPrice: body.compareAtPrice }
            : {}),
          ...(body.isVisible !== undefined ? { isVisible: body.isVisible } : {}),
          ...(body.isFeatured !== undefined ? { isFeatured: body.isFeatured } : {}),
          ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
          updatedAt: new Date(),
        },
      })
      .returning();

    await writeAuditLog({
      actorUserId: c.get('user').id,
      action: 'storefront.product.add',
      entityType: 'storefront_product',
      entityId: item?.id,
      newValues: { storefrontId: storefront.id, productId: product.id },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });

    return c.json({ success: true as const, data: item }, 201);
  },
);

commerceStorefrontRoutes.patch(
  '/storefronts/:storefrontId/products/:itemId',
  requirePermission('commerce:write'),
  validate('json', updateProductSchema),
  async (c) => {
    const { storefront } = await assertStorefrontAccess(
      c.req.param('storefrontId'),
      c.get('user'),
      c.get('permissions'),
      { manage: true },
    );
    const item = await db.query.storefrontProducts.findFirst({
      where: and(
        eq(storefrontProducts.id, c.req.param('itemId')),
        eq(storefrontProducts.storefrontId, storefront.id),
      ),
    });
    if (!item) throw ApiError.notFound('Storefront product not found');

    const body = c.req.valid('json');
    const [updated] = await db
      .update(storefrontProducts)
      .set({
        ...(body.priceOverride !== undefined ? { priceOverride: body.priceOverride } : {}),
        ...(body.compareAtPrice !== undefined
          ? { compareAtPrice: body.compareAtPrice }
          : {}),
        ...(body.isVisible !== undefined ? { isVisible: body.isVisible } : {}),
        ...(body.isFeatured !== undefined ? { isFeatured: body.isFeatured } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      })
      .where(eq(storefrontProducts.id, item.id))
      .returning();

    return ok(c, updated);
  },
);

commerceStorefrontRoutes.delete(
  '/storefronts/:storefrontId/products/:itemId',
  requirePermission('commerce:write'),
  async (c) => {
    const { storefront } = await assertStorefrontAccess(
      c.req.param('storefrontId'),
      c.get('user'),
      c.get('permissions'),
      { manage: true },
    );
    const item = await db.query.storefrontProducts.findFirst({
      where: and(
        eq(storefrontProducts.id, c.req.param('itemId')),
        eq(storefrontProducts.storefrontId, storefront.id),
      ),
      columns: { id: true },
    });
    if (!item) throw ApiError.notFound('Storefront product not found');

    await db.delete(storefrontProducts).where(eq(storefrontProducts.id, item.id));
    return ok(c, { message: 'Product removed from storefront' });
  },
);

/* -------------------------- Channel listings ------------------------- */

commerceStorefrontRoutes.get(
  '/listings',
  requirePermission('commerce:read'),
  validate('query', listListingsSchema),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions = [];

    const scope = storefrontScopeCondition(c.get('user'), c.get('permissions'));
    if (scope) conditions.push(scope);
    if (query.channelId) conditions.push(eq(channelListings.channelId, query.channelId));
    if (query.storefrontId) {
      conditions.push(eq(channelListings.storefrontId, query.storefrontId));
    }
    if (query.productId) conditions.push(eq(channelListings.productId, query.productId));
    if (query.status) conditions.push(eq(channelListings.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      const searchCondition = or(
        ilike(channelListings.title, term),
        ilike(channelListings.externalListingId, term),
      );
      if (searchCondition) conditions.push(searchCondition);
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ value } = { value: 0 }]] = await Promise.all([
      db
        .select({
          id: channelListings.id,
          channelId: channelListings.channelId,
          channelName: salesChannels.name,
          storefrontId: channelListings.storefrontId,
          storefrontName: storefronts.name,
          productId: channelListings.productId,
          productName: products.name,
          externalListingId: channelListings.externalListingId,
          title: channelListings.title,
          price: channelListings.price,
          currency: channelListings.currency,
          status: channelListings.status,
          externalUrl: channelListings.externalUrl,
          lastSyncedAt: channelListings.lastSyncedAt,
          createdAt: channelListings.createdAt,
          updatedAt: channelListings.updatedAt,
        })
        .from(channelListings)
        .innerJoin(storefronts, eq(storefronts.id, channelListings.storefrontId))
        .innerJoin(salesChannels, eq(salesChannels.id, channelListings.channelId))
        .leftJoin(products, eq(products.id, channelListings.productId))
        .where(where)
        .orderBy(desc(channelListings.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ value: count() })
        .from(channelListings)
        .innerJoin(storefronts, eq(storefronts.id, channelListings.storefrontId))
        .where(where),
    ]);

    return paginated(c, rows, Number(value), pagination);
  },
);

async function assertListingExternalIdAvailable(
  channelId: string,
  externalListingId: string,
  exceptId?: string,
) {
  const row = await db.query.channelListings.findFirst({
    where: and(
      eq(channelListings.channelId, channelId),
      eq(channelListings.externalListingId, externalListingId),
    ),
    columns: { id: true },
  });
  if (row && row.id !== exceptId) {
    throw ApiError.conflict('External listing ID already exists for this channel');
  }
}

async function assertListingProduct(
  productId: string,
  storefrontId: string,
  merchantId: string,
) {
  const row = await db.query.products.findFirst({
    where: and(
      eq(products.id, productId),
      eq(products.merchantId, merchantId),
      isNull(products.deletedAt),
    ),
    columns: { id: true },
  });
  if (!row) throw ApiError.badRequest('Product does not belong to this merchant');

  const listed = await db.query.storefrontProducts.findFirst({
    where: and(
      eq(storefrontProducts.storefrontId, storefrontId),
      eq(storefrontProducts.productId, productId),
    ),
    columns: { id: true },
  });
  if (!listed) throw ApiError.badRequest('Product is not listed on this storefront');
}

commerceStorefrontRoutes.post(
  '/listings',
  requirePermission('commerce:write'),
  validate('json', createListingSchema),
  async (c) => {
    const body = c.req.valid('json');
    const { storefront, merchant } = await assertStorefrontAccess(
      body.storefrontId,
      c.get('user'),
      c.get('permissions'),
      { manage: true },
    );
    await assertChannelExists(body.channelId);
    if (body.productId) {
      await assertListingProduct(body.productId, storefront.id, merchant.id);
    }
    if (body.externalListingId) {
      await assertListingExternalIdAvailable(body.channelId, body.externalListingId);
    }

    const [listing] = await db
      .insert(channelListings)
      .values({
        channelId: body.channelId,
        storefrontId: storefront.id,
        productId: body.productId ?? null,
        externalListingId: body.externalListingId ?? null,
        title: body.title ?? null,
        description: body.description ?? null,
        price: body.price ?? null,
        currency: body.currency ?? storefront.currency,
        status: body.status ?? 'draft',
        externalUrl: body.externalUrl ?? null,
        metadata: body.metadata ?? null,
      })
      .returning();

    await writeAuditLog({
      actorUserId: c.get('user').id,
      action: 'channel_listing.create',
      entityType: 'channel_listing',
      entityId: listing?.id,
      newValues: { channelId: body.channelId, storefrontId: storefront.id },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });

    return c.json({ success: true as const, data: listing }, 201);
  },
);

commerceStorefrontRoutes.patch(
  '/listings/:listingId',
  requirePermission('commerce:write'),
  validate('json', updateListingSchema),
  async (c) => {
    const listing = await db.query.channelListings.findFirst({
      where: eq(channelListings.id, c.req.param('listingId')),
    });
    if (!listing) throw ApiError.notFound('Channel listing not found');

    const { merchant } = await assertStorefrontAccess(
      listing.storefrontId,
      c.get('user'),
      c.get('permissions'),
      { manage: true },
    );
    const body = c.req.valid('json');

    if (body.productId) {
      await assertListingProduct(body.productId, listing.storefrontId, merchant.id);
    }
    if (body.externalListingId !== undefined && body.externalListingId !== null) {
      await assertListingExternalIdAvailable(
        listing.channelId,
        body.externalListingId,
        listing.id,
      );
    }

    const [updated] = await db
      .update(channelListings)
      .set({
        ...(body.productId !== undefined ? { productId: body.productId } : {}),
        ...(body.externalListingId !== undefined
          ? { externalListingId: body.externalListingId }
          : {}),
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.price !== undefined ? { price: body.price } : {}),
        ...(body.currency !== undefined ? { currency: body.currency } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.externalUrl !== undefined ? { externalUrl: body.externalUrl } : {}),
        ...(body.metadata !== undefined ? { metadata: body.metadata } : {}),
        ...(body.status === 'active' ? { lastSyncedAt: new Date() } : {}),
      })
      .where(eq(channelListings.id, listing.id))
      .returning();

    return ok(c, updated);
  },
);

commerceStorefrontRoutes.delete(
  '/listings/:listingId',
  requirePermission('commerce:write'),
  async (c) => {
    const listing = await db.query.channelListings.findFirst({
      where: eq(channelListings.id, c.req.param('listingId')),
      columns: { id: true, storefrontId: true },
    });
    if (!listing) throw ApiError.notFound('Channel listing not found');

    await assertStorefrontAccess(listing.storefrontId, c.get('user'), c.get('permissions'), {
      manage: true,
    });

    const [updated] = await db
      .update(channelListings)
      .set({ status: 'ended' })
      .where(eq(channelListings.id, listing.id))
      .returning();

    return ok(c, updated);
  },
);
