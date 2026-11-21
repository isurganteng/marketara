import { and, count, eq, ilike, isNull, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  brands,
  productAttributeValues,
  productAttributes,
  productCategories,
  productUnits,
} from '../../db/schema';
import { ApiError } from '../../lib/errors';
import { getPagination, ok, paginated } from '../../lib/http';
import type { AppEnv } from '../../lib/app-env';
import { generateCode, uniqueSlug } from '../../lib/slug';
import { validate } from '../../lib/validator';
import { requirePermission } from '../../middleware/auth';

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  isActive: z.enum(['true', 'false']).optional(),
});

const categoryCreateSchema = z.object({
  parentId: z.uuid().nullable().optional(),
  code: z.string().trim().min(2).max(64).optional(),
  name: z.string().trim().min(2).max(255),
  description: z.string().trim().max(5000).optional(),
  imageUrl: z.string().url().max(2048).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

const categoryUpdateSchema = categoryCreateSchema
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Minimal satu field harus diisi',
  });

const brandCreateSchema = z.object({
  code: z.string().trim().min(2).max(64).optional(),
  name: z.string().trim().min(2).max(255),
  description: z.string().trim().max(5000).optional(),
  logoUrl: z.string().url().max(2048).optional(),
  website: z.string().trim().max(255).optional(),
  isActive: z.boolean().optional(),
});

const brandUpdateSchema = brandCreateSchema
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Minimal satu field harus diisi',
  });

const unitCreateSchema = z.object({
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(128),
  symbol: z.string().trim().max(16).optional(),
});

const attributeCreateSchema = z.object({
  code: z.string().trim().min(2).max(64).optional(),
  name: z.string().trim().min(2).max(128),
  type: z.enum(['text', 'number', 'boolean', 'select']).optional(),
  isVariantAttribute: z.boolean().optional(),
  isRequired: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

const attributeUpdateSchema = attributeCreateSchema
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Minimal satu field harus diisi',
  });

const attributeValueCreateSchema = z.object({
  value: z.string().trim().min(1).max(128),
  label: z.string().trim().max(128).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

const attributeValueUpdateSchema = attributeValueCreateSchema
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Minimal satu field harus diisi',
  });

const categoriesQuerySchema = listQuerySchema.extend({
  parentId: z.uuid().optional(),
  rootOnly: z.enum(['true', 'false']).optional(),
});

export const catalogReferenceRoutes = new Hono<AppEnv>();

/* ----------------------------- Categories --------------------------- */

catalogReferenceRoutes.get(
  '/categories',
  requirePermission('catalog:read'),
  validate('query', categoriesQuerySchema),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);

    const conditions = [];
    if (query.parentId) conditions.push(eq(productCategories.parentId, query.parentId));
    if (query.rootOnly === 'true') conditions.push(isNull(productCategories.parentId));
    if (query.isActive) conditions.push(eq(productCategories.isActive, query.isActive === 'true'));
    if (query.search) {
      const term = `%${query.search}%`;
      const searchCondition = or(
        ilike(productCategories.name, term),
        ilike(productCategories.code, term),
      );
      if (searchCondition) conditions.push(searchCondition);
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ value } = { value: 0 }]] = await Promise.all([
      db
        .select()
        .from(productCategories)
        .where(where)
        .orderBy(productCategories.sortOrder, productCategories.name)
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ value: count() }).from(productCategories).where(where),
    ]);

    return paginated(c, rows, Number(value), pagination);
  },
);

catalogReferenceRoutes.post(
  '/categories',
  requirePermission('catalog:manage'),
  validate('json', categoryCreateSchema),
  async (c) => {
    const body = c.req.valid('json');

    if (body.parentId) {
      const parent = await db.query.productCategories.findFirst({
        where: eq(productCategories.id, body.parentId),
        columns: { id: true },
      });
      if (!parent) throw ApiError.badRequest('Parent category not found');
    }

    const [category] = await db
      .insert(productCategories)
      .values({
        parentId: body.parentId ?? null,
        code: body.code ?? generateCode('CAT'),
        name: body.name,
        slug: uniqueSlug(body.name),
        description: body.description ?? null,
        imageUrl: body.imageUrl ?? null,
        sortOrder: body.sortOrder ?? 0,
        isActive: body.isActive ?? true,
      })
      .returning();

    return c.json({ success: true as const, data: category }, 201);
  },
);

catalogReferenceRoutes.get('/categories/:categoryId', requirePermission('catalog:read'), async (c) => {
  const category = await db.query.productCategories.findFirst({
    where: eq(productCategories.id, c.req.param('categoryId')),
  });
  if (!category) throw ApiError.notFound('Category not found');
  return ok(c, category);
});

catalogReferenceRoutes.patch(
  '/categories/:categoryId',
  requirePermission('catalog:manage'),
  validate('json', categoryUpdateSchema),
  async (c) => {
    const categoryId = c.req.param('categoryId');
    const body = c.req.valid('json');

    if (body.parentId === categoryId) {
      throw ApiError.badRequest('Category cannot be its own parent');
    }
    if (body.parentId) {
      const parent = await db.query.productCategories.findFirst({
        where: eq(productCategories.id, body.parentId),
        columns: { id: true },
      });
      if (!parent) throw ApiError.badRequest('Parent category not found');
    }

    const [updated] = await db
      .update(productCategories)
      .set({
        ...(body.parentId !== undefined ? { parentId: body.parentId } : {}),
        ...(body.code !== undefined ? { code: body.code } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      })
      .where(eq(productCategories.id, categoryId))
      .returning();

    if (!updated) throw ApiError.notFound('Category not found');
    return ok(c, updated);
  },
);

catalogReferenceRoutes.delete(
  '/categories/:categoryId',
  requirePermission('catalog:manage'),
  async (c) => {
    const [updated] = await db
      .update(productCategories)
      .set({ isActive: false })
      .where(eq(productCategories.id, c.req.param('categoryId')))
      .returning({ id: productCategories.id });
    if (!updated) throw ApiError.notFound('Category not found');
    return ok(c, { message: 'Category deactivated' });
  },
);

/* ------------------------------- Brands ----------------------------- */

catalogReferenceRoutes.get(
  '/brands',
  requirePermission('catalog:read'),
  validate('query', listQuerySchema),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);

    const conditions = [];
    if (query.isActive) conditions.push(eq(brands.isActive, query.isActive === 'true'));
    if (query.search) {
      const term = `%${query.search}%`;
      const searchCondition = or(ilike(brands.name, term), ilike(brands.code, term));
      if (searchCondition) conditions.push(searchCondition);
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ value } = { value: 0 }]] = await Promise.all([
      db
        .select()
        .from(brands)
        .where(where)
        .orderBy(brands.name)
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ value: count() }).from(brands).where(where),
    ]);

    return paginated(c, rows, Number(value), pagination);
  },
);

catalogReferenceRoutes.post(
  '/brands',
  requirePermission('catalog:manage'),
  validate('json', brandCreateSchema),
  async (c) => {
    const body = c.req.valid('json');
    const [brand] = await db
      .insert(brands)
      .values({
        code: body.code ?? generateCode('BRD'),
        name: body.name,
        slug: uniqueSlug(body.name),
        description: body.description ?? null,
        logoUrl: body.logoUrl ?? null,
        website: body.website ?? null,
        isActive: body.isActive ?? true,
      })
      .returning();
    return c.json({ success: true as const, data: brand }, 201);
  },
);

catalogReferenceRoutes.patch(
  '/brands/:brandId',
  requirePermission('catalog:manage'),
  validate('json', brandUpdateSchema),
  async (c) => {
    const body = c.req.valid('json');
    const [updated] = await db
      .update(brands)
      .set({
        ...(body.code !== undefined ? { code: body.code } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl } : {}),
        ...(body.website !== undefined ? { website: body.website } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      })
      .where(eq(brands.id, c.req.param('brandId')))
      .returning();
    if (!updated) throw ApiError.notFound('Brand not found');
    return ok(c, updated);
  },
);

catalogReferenceRoutes.delete(
  '/brands/:brandId',
  requirePermission('catalog:manage'),
  async (c) => {
    const [updated] = await db
      .update(brands)
      .set({ isActive: false })
      .where(eq(brands.id, c.req.param('brandId')))
      .returning({ id: brands.id });
    if (!updated) throw ApiError.notFound('Brand not found');
    return ok(c, { message: 'Brand deactivated' });
  },
);

/* -------------------------------- Units ----------------------------- */

catalogReferenceRoutes.get('/units', requirePermission('catalog:read'), async (c) => {
  const rows = await db.select().from(productUnits).orderBy(productUnits.name);
  return ok(c, rows);
});

catalogReferenceRoutes.post(
  '/units',
  requirePermission('catalog:manage'),
  validate('json', unitCreateSchema),
  async (c) => {
    const body = c.req.valid('json');
    const [unit] = await db
      .insert(productUnits)
      .values({
        code: body.code.toLowerCase(),
        name: body.name,
        symbol: body.symbol ?? null,
      })
      .returning();
    return c.json({ success: true as const, data: unit }, 201);
  },
);

/* ----------------------------- Attributes --------------------------- */

catalogReferenceRoutes.get('/attributes', requirePermission('catalog:read'), async (c) => {
  const rows = await db
    .select()
    .from(productAttributes)
    .orderBy(productAttributes.sortOrder, productAttributes.name);
  return ok(c, rows);
});

catalogReferenceRoutes.get(
  '/attributes/:attributeId',
  requirePermission('catalog:read'),
  async (c) => {
    const attribute = await db.query.productAttributes.findFirst({
      where: eq(productAttributes.id, c.req.param('attributeId')),
    });
    if (!attribute) throw ApiError.notFound('Attribute not found');

    const values = await db
      .select()
      .from(productAttributeValues)
      .where(eq(productAttributeValues.attributeId, attribute.id))
      .orderBy(productAttributeValues.sortOrder, productAttributeValues.value);

    return ok(c, { ...attribute, values });
  },
);

catalogReferenceRoutes.post(
  '/attributes',
  requirePermission('catalog:manage'),
  validate('json', attributeCreateSchema),
  async (c) => {
    const body = c.req.valid('json');
    const [attribute] = await db
      .insert(productAttributes)
      .values({
        code: body.code ?? generateCode('ATTR'),
        name: body.name,
        type: body.type ?? 'text',
        isVariantAttribute: body.isVariantAttribute ?? false,
        isRequired: body.isRequired ?? false,
        sortOrder: body.sortOrder ?? 0,
      })
      .returning();
    return c.json({ success: true as const, data: attribute }, 201);
  },
);

catalogReferenceRoutes.patch(
  '/attributes/:attributeId',
  requirePermission('catalog:manage'),
  validate('json', attributeUpdateSchema),
  async (c) => {
    const body = c.req.valid('json');
    const [updated] = await db
      .update(productAttributes)
      .set({
        ...(body.code !== undefined ? { code: body.code } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.isVariantAttribute !== undefined
          ? { isVariantAttribute: body.isVariantAttribute }
          : {}),
        ...(body.isRequired !== undefined ? { isRequired: body.isRequired } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      })
      .where(eq(productAttributes.id, c.req.param('attributeId')))
      .returning();
    if (!updated) throw ApiError.notFound('Attribute not found');
    return ok(c, updated);
  },
);

catalogReferenceRoutes.get(
  '/attributes/:attributeId/values',
  requirePermission('catalog:read'),
  async (c) => {
    const rows = await db
      .select()
      .from(productAttributeValues)
      .where(eq(productAttributeValues.attributeId, c.req.param('attributeId')))
      .orderBy(productAttributeValues.sortOrder, productAttributeValues.value);
    return ok(c, rows);
  },
);

catalogReferenceRoutes.post(
  '/attributes/:attributeId/values',
  requirePermission('catalog:manage'),
  validate('json', attributeValueCreateSchema),
  async (c) => {
    const attributeId = c.req.param('attributeId');
    const attribute = await db.query.productAttributes.findFirst({
      where: eq(productAttributes.id, attributeId),
      columns: { id: true },
    });
    if (!attribute) throw ApiError.notFound('Attribute not found');

    const body = c.req.valid('json');
    const [value] = await db
      .insert(productAttributeValues)
      .values({
        attributeId,
        value: body.value,
        label: body.label ?? null,
        sortOrder: body.sortOrder ?? 0,
      })
      .returning();
    return c.json({ success: true as const, data: value }, 201);
  },
);

catalogReferenceRoutes.patch(
  '/values/:valueId',
  requirePermission('catalog:manage'),
  validate('json', attributeValueUpdateSchema),
  async (c) => {
    const body = c.req.valid('json');
    const [updated] = await db
      .update(productAttributeValues)
      .set({
        ...(body.value !== undefined ? { value: body.value } : {}),
        ...(body.label !== undefined ? { label: body.label } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      })
      .where(eq(productAttributeValues.id, c.req.param('valueId')))
      .returning();
    if (!updated) throw ApiError.notFound('Attribute value not found');
    return ok(c, updated);
  },
);
