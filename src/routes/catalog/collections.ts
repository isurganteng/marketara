import { and, count, eq, ilike, isNull, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import { merchants } from '../../db/schema';
import {
  productCatalogItems,
  productCatalogs,
  products,
} from '../../db/schema/catalog';
import { assertMerchantAccess, merchantScopeCondition } from '../../lib/access';
import { writeAuditLog } from '../../lib/audit';
import { ApiError } from '../../lib/errors';
import { getPagination, ok, paginated } from '../../lib/http';
import type { AppEnv } from '../../lib/app-env';
import { uniqueSlug } from '../../lib/slug';
import { validate } from '../../lib/validator';
import { requirePermission } from '../../middleware/auth';
import { getClientIp } from '../../services/auth';

const numericString = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine((value) => value.trim() !== '' && !Number.isNaN(Number(value)), 'Harus berupa angka');

const createCatalogSchema = z.object({
  merchantId: z.uuid(),
  name: z.string().trim().min(2).max(255),
  description: z.string().trim().max(5000).optional(),
  isActive: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});

const updateCatalogSchema = createCatalogSchema
  .omit({ merchantId: true })
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Minimal satu field harus diisi',
  });

const listCatalogsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  merchantId: z.uuid().optional(),
  search: z.string().trim().max(100).optional(),
  isActive: z.enum(['true', 'false']).optional(),
});

const listItemsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const addItemSchema = z.object({
  productId: z.uuid(),
  priceOverride: numericString.optional(),
  isVisible: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

const updateItemSchema = z
  .object({
    priceOverride: numericString.nullable().optional(),
    isVisible: z.boolean().optional(),
    sortOrder: z.coerce.number().int().min(0).optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Minimal satu field harus diisi',
  });

async function getCatalogOrThrow(catalogId: string) {
  const catalog = await db.query.productCatalogs.findFirst({
    where: eq(productCatalogs.id, catalogId),
  });
  if (!catalog) throw ApiError.notFound('Catalog not found');
  return catalog;
}

export const catalogCollectionRoutes = new Hono<AppEnv>();

catalogCollectionRoutes.get(
  '/catalogs',
  requirePermission('catalog:read'),
  validate('query', listCatalogsSchema),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);

    const conditions = [];
    if (query.merchantId) conditions.push(eq(productCatalogs.merchantId, query.merchantId));
    if (query.isActive) {
      conditions.push(eq(productCatalogs.isActive, query.isActive === 'true'));
    }
    if (query.search) {
      const term = `%${query.search}%`;
      const searchCondition = or(
        ilike(productCatalogs.name, term),
        ilike(productCatalogs.slug, term),
      );
      if (searchCondition) conditions.push(searchCondition);
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const merchantScope = merchantScopeCondition(c.get('user'), c.get('permissions'));
    const scopeCondition = merchantScope
      ? and(merchantScope, isNull(merchants.deletedAt))
      : isNull(merchants.deletedAt);

    const [rows, [{ value } = { value: 0 }]] = await Promise.all([
      db
        .select({
          id: productCatalogs.id,
          merchantId: productCatalogs.merchantId,
          merchantName: merchants.businessName,
          name: productCatalogs.name,
          slug: productCatalogs.slug,
          description: productCatalogs.description,
          isActive: productCatalogs.isActive,
          isPublic: productCatalogs.isPublic,
          createdAt: productCatalogs.createdAt,
        })
        .from(productCatalogs)
        .innerJoin(merchants, eq(merchants.id, productCatalogs.merchantId))
        .where(and(scopeCondition, where))
        .orderBy(productCatalogs.createdAt)
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ value: count() })
        .from(productCatalogs)
        .innerJoin(merchants, eq(merchants.id, productCatalogs.merchantId))
        .where(and(scopeCondition, where)),
    ]);

    return paginated(c, rows, Number(value), pagination);
  },
);

catalogCollectionRoutes.post(
  '/catalogs',
  requirePermission('catalog:write'),
  validate('json', createCatalogSchema),
  async (c) => {
    const body = c.req.valid('json');
    await assertMerchantAccess(body.merchantId, c.get('user'), c.get('permissions'), {
      manage: true,
    });

    const [catalog] = await db
      .insert(productCatalogs)
      .values({
        merchantId: body.merchantId,
        name: body.name,
        slug: uniqueSlug(body.name),
        description: body.description ?? null,
        isActive: body.isActive ?? true,
        isPublic: body.isPublic ?? false,
      })
      .returning();

    await writeAuditLog({
      actorUserId: c.get('user').id,
      action: 'product_catalog.create',
      entityType: 'product_catalog',
      entityId: catalog?.id,
      newValues: { merchantId: body.merchantId, name: body.name },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });

    return c.json({ success: true as const, data: catalog }, 201);
  },
);

catalogCollectionRoutes.get(
  '/catalogs/:catalogId',
  requirePermission('catalog:read'),
  async (c) => {
    const catalog = await getCatalogOrThrow(c.req.param('catalogId'));
    await assertMerchantAccess(catalog.merchantId, c.get('user'), c.get('permissions'));

    const [itemCount] = await db
      .select({ value: count() })
      .from(productCatalogItems)
      .where(eq(productCatalogItems.catalogId, catalog.id));

    return ok(c, { ...catalog, itemCount: Number(itemCount?.value ?? 0) });
  },
);

catalogCollectionRoutes.patch(
  '/catalogs/:catalogId',
  requirePermission('catalog:write'),
  validate('json', updateCatalogSchema),
  async (c) => {
    const catalog = await getCatalogOrThrow(c.req.param('catalogId'));
    await assertMerchantAccess(catalog.merchantId, c.get('user'), c.get('permissions'), {
      manage: true,
    });
    const body = c.req.valid('json');

    const [updated] = await db
      .update(productCatalogs)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.isPublic !== undefined ? { isPublic: body.isPublic } : {}),
      })
      .where(eq(productCatalogs.id, catalog.id))
      .returning();

    return ok(c, updated);
  },
);

catalogCollectionRoutes.delete(
  '/catalogs/:catalogId',
  requirePermission('catalog:write'),
  async (c) => {
    const catalog = await getCatalogOrThrow(c.req.param('catalogId'));
    await assertMerchantAccess(catalog.merchantId, c.get('user'), c.get('permissions'), {
      manage: true,
    });

    await db.delete(productCatalogs).where(eq(productCatalogs.id, catalog.id));
    return ok(c, { message: 'Catalog deleted' });
  },
);

catalogCollectionRoutes.get(
  '/catalogs/:catalogId/items',
  requirePermission('catalog:read'),
  validate('query', listItemsSchema),
  async (c) => {
    const catalog = await getCatalogOrThrow(c.req.param('catalogId'));
    await assertMerchantAccess(catalog.merchantId, c.get('user'), c.get('permissions'));
    const pagination = getPagination(c.req.valid('query'));

    const where = eq(productCatalogItems.catalogId, catalog.id);

    const [rows, [{ value } = { value: 0 }]] = await Promise.all([
      db
        .select({
          id: productCatalogItems.id,
          catalogId: productCatalogItems.catalogId,
          productId: products.id,
          productName: products.name,
          productSlug: products.slug,
          productStatus: products.status,
          basePrice: products.basePrice,
          priceOverride: productCatalogItems.priceOverride,
          isVisible: productCatalogItems.isVisible,
          sortOrder: productCatalogItems.sortOrder,
        })
        .from(productCatalogItems)
        .innerJoin(products, eq(products.id, productCatalogItems.productId))
        .where(and(where, isNull(products.deletedAt)))
        .orderBy(productCatalogItems.sortOrder, products.name)
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ value: count() }).from(productCatalogItems).where(where),
    ]);

    return paginated(c, rows, Number(value), pagination);
  },
);

catalogCollectionRoutes.post(
  '/catalogs/:catalogId/items',
  requirePermission('catalog:write'),
  validate('json', addItemSchema),
  async (c) => {
    const catalog = await getCatalogOrThrow(c.req.param('catalogId'));
    await assertMerchantAccess(catalog.merchantId, c.get('user'), c.get('permissions'), {
      manage: true,
    });
    const body = c.req.valid('json');

    const product = await db.query.products.findFirst({
      where: and(
        eq(products.id, body.productId),
        eq(products.merchantId, catalog.merchantId),
        isNull(products.deletedAt),
      ),
      columns: { id: true },
    });
    if (!product) {
      throw ApiError.badRequest('Product not found or does not belong to this merchant');
    }

    const [item] = await db
      .insert(productCatalogItems)
      .values({
        catalogId: catalog.id,
        productId: product.id,
        priceOverride: body.priceOverride ?? null,
        isVisible: body.isVisible ?? true,
        sortOrder: body.sortOrder ?? 0,
      })
      .onConflictDoUpdate({
        target: [productCatalogItems.catalogId, productCatalogItems.productId],
        set: {
          priceOverride: body.priceOverride ?? null,
          isVisible: body.isVisible ?? true,
          sortOrder: body.sortOrder ?? 0,
        },
      })
      .returning();

    return c.json({ success: true as const, data: item }, 201);
  },
);

catalogCollectionRoutes.patch(
  '/catalogs/:catalogId/items/:itemId',
  requirePermission('catalog:write'),
  validate('json', updateItemSchema),
  async (c) => {
    const catalog = await getCatalogOrThrow(c.req.param('catalogId'));
    await assertMerchantAccess(catalog.merchantId, c.get('user'), c.get('permissions'), {
      manage: true,
    });
    const body = c.req.valid('json');

    const [updated] = await db
      .update(productCatalogItems)
      .set({
        ...(body.priceOverride !== undefined ? { priceOverride: body.priceOverride } : {}),
        ...(body.isVisible !== undefined ? { isVisible: body.isVisible } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      })
      .where(
        and(
          eq(productCatalogItems.id, c.req.param('itemId')),
          eq(productCatalogItems.catalogId, catalog.id),
        ),
      )
      .returning();

    if (!updated) throw ApiError.notFound('Catalog item not found');
    return ok(c, updated);
  },
);

catalogCollectionRoutes.delete(
  '/catalogs/:catalogId/items/:itemId',
  requirePermission('catalog:write'),
  async (c) => {
    const catalog = await getCatalogOrThrow(c.req.param('catalogId'));
    await assertMerchantAccess(catalog.merchantId, c.get('user'), c.get('permissions'), {
      manage: true,
    });

    const [deleted] = await db
      .delete(productCatalogItems)
      .where(
        and(
          eq(productCatalogItems.id, c.req.param('itemId')),
          eq(productCatalogItems.catalogId, catalog.id),
        ),
      )
      .returning({ id: productCatalogItems.id });

    if (!deleted) throw ApiError.notFound('Catalog item not found');
    return ok(c, { message: 'Catalog item removed' });
  },
);
