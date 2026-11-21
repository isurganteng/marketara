import { and, count, eq, ilike, isNull, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  brands,
  productAttributeAssignments,
  productAttributeValues,
  productAttributes,
  productCategories,
  productImages,
  productSkus,
  productUnits,
  productVariants,
  products,
} from '../../db/schema';
import { merchants } from '../../db/schema';
import {
  assertMerchantAccess,
  assertProductAccess,
  productScopeCondition,
} from '../../lib/access';
import { writeAuditLog } from '../../lib/audit';
import { ApiError } from '../../lib/errors';
import { getPagination, ok, paginated } from '../../lib/http';
import type { AppEnv } from '../../lib/app-env';
import { generateCode, uniqueSlug } from '../../lib/slug';
import { validate } from '../../lib/validator';
import { requirePermission } from '../../middleware/auth';
import { getClientIp } from '../../services/auth';

const numericString = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine((value) => value.trim() !== '' && !Number.isNaN(Number(value)), 'Harus berupa angka');
const productStatusSchema = z.enum(['draft', 'active', 'inactive', 'archived']);

const createProductSchema = z.object({
  merchantId: z.uuid(),
  categoryId: z.uuid().nullable().optional(),
  brandId: z.uuid().nullable().optional(),
  name: z.string().trim().min(2).max(255),
  shortDescription: z.string().trim().max(1000).optional(),
  description: z.string().trim().max(20000).optional(),
  status: productStatusSchema.optional(),
  basePrice: numericString.optional(),
  currency: z.string().trim().length(3).optional(),
  weightGram: z.coerce.number().int().min(0).optional(),
  dimensions: z.record(z.string(), z.unknown()).optional(),
  isFeatured: z.boolean().optional(),
});

const updateProductSchema = createProductSchema
  .omit({ merchantId: true })
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Minimal satu field harus diisi',
  });

const listProductsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  categoryId: z.uuid().optional(),
  brandId: z.uuid().optional(),
  status: productStatusSchema.optional(),
  isFeatured: z.enum(['true', 'false']).optional(),
});

const variantCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  code: z.string().trim().max(64).optional(),
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  price: numericString.optional(),
  isDefault: z.boolean().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

const variantUpdateSchema = variantCreateSchema
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Minimal satu field harus diisi',
  });

const skuCreateSchema = z.object({
  variantId: z.uuid().nullable().optional(),
  unitId: z.uuid().nullable().optional(),
  skuCode: z.string().trim().min(2).max(100).optional(),
  barcode: z.string().trim().max(100).nullable().optional(),
  price: numericString,
  costPrice: numericString.optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

const skuUpdateSchema = skuCreateSchema
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Minimal satu field harus diisi',
  });

const imageCreateSchema = z.object({
  url: z.string().url().max(2048),
  altText: z.string().trim().max(255).optional(),
  isPrimary: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

const imageUpdateSchema = imageCreateSchema
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Minimal satu field harus diisi',
  });

const attributeAssignmentSchema = z
  .object({
    attributeId: z.uuid(),
    valueId: z.uuid().nullable().optional(),
    customValue: z.string().trim().max(255).nullable().optional(),
  })
  .refine((data) => data.valueId != null || (data.customValue != null && data.customValue !== ''), {
    message: 'valueId atau customValue wajib diisi',
  });

async function assertCategoryExists(categoryId?: string | null) {
  if (!categoryId) return;
  const row = await db.query.productCategories.findFirst({
    where: eq(productCategories.id, categoryId),
    columns: { id: true },
  });
  if (!row) throw ApiError.badRequest('Category not found');
}

async function assertBrandExists(brandId?: string | null) {
  if (!brandId) return;
  const row = await db.query.brands.findFirst({
    where: eq(brands.id, brandId),
    columns: { id: true },
  });
  if (!row) throw ApiError.badRequest('Brand not found');
}

export const catalogProductRoutes = new Hono<AppEnv>();

/* ------------------------------ Products ---------------------------- */

catalogProductRoutes.get(
  '/products',
  requirePermission('catalog:read'),
  validate('query', listProductsSchema),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);

    const conditions = [isNull(products.deletedAt)];
    const scope = productScopeCondition(c.get('user'), c.get('permissions'));
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(products.merchantId, query.merchantId));
    if (query.categoryId) conditions.push(eq(products.categoryId, query.categoryId));
    if (query.brandId) conditions.push(eq(products.brandId, query.brandId));
    if (query.status) conditions.push(eq(products.status, query.status));
    if (query.isFeatured) conditions.push(eq(products.isFeatured, query.isFeatured === 'true'));
    if (query.search) {
      const term = `%${query.search}%`;
      const searchCondition = or(
        ilike(products.name, term),
        ilike(products.shortDescription, term),
      );
      if (searchCondition) conditions.push(searchCondition);
    }
    const where = and(...conditions);

    const [rows, [{ value } = { value: 0 }]] = await Promise.all([
      db
        .select({
          id: products.id,
          merchantId: products.merchantId,
          merchantName: merchants.businessName,
          name: products.name,
          slug: products.slug,
          status: products.status,
          basePrice: products.basePrice,
          currency: products.currency,
          isFeatured: products.isFeatured,
          categoryId: products.categoryId,
          categoryName: productCategories.name,
          brandId: products.brandId,
          brandName: brands.name,
          createdAt: products.createdAt,
          updatedAt: products.updatedAt,
        })
        .from(products)
        .innerJoin(merchants, eq(merchants.id, products.merchantId))
        .leftJoin(productCategories, eq(productCategories.id, products.categoryId))
        .leftJoin(brands, eq(brands.id, products.brandId))
        .where(where)
        .orderBy(products.createdAt)
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ value: count() }).from(products).where(where),
    ]);

    return paginated(c, rows, Number(value), pagination);
  },
);

catalogProductRoutes.post(
  '/products',
  requirePermission('catalog:write'),
  validate('json', createProductSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');

    await assertMerchantAccess(body.merchantId, user, c.get('permissions'), { manage: true });
    await Promise.all([
      assertCategoryExists(body.categoryId),
      assertBrandExists(body.brandId),
    ]);

    const [product] = await db
      .insert(products)
      .values({
        merchantId: body.merchantId,
        categoryId: body.categoryId ?? null,
        brandId: body.brandId ?? null,
        name: body.name,
        slug: uniqueSlug(body.name),
        shortDescription: body.shortDescription ?? null,
        description: body.description ?? null,
        status: body.status ?? 'draft',
        basePrice: body.basePrice ?? '0',
        currency: (body.currency ?? 'IDR').toUpperCase(),
        weightGram: body.weightGram ?? null,
        dimensions: body.dimensions ?? null,
        isFeatured: body.isFeatured ?? false,
        createdBy: user.id,
      })
      .returning();

    if (!product) throw ApiError.internal('Failed to create product');

    await writeAuditLog({
      actorUserId: user.id,
      action: 'product.create',
      entityType: 'product',
      entityId: product.id,
      newValues: { merchantId: product.merchantId, name: product.name },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });

    return c.json({ success: true as const, data: product }, 201);
  },
);

catalogProductRoutes.get('/products/:productId', requirePermission('catalog:read'), async (c) => {
  const { product, merchant, role } = await assertProductAccess(
    c.req.param('productId'),
    c.get('user'),
    c.get('permissions'),
  );

  const [variants, skus, images, assignments, category, brand] = await Promise.all([
    db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, product.id))
      .orderBy(productVariants.sortOrder, productVariants.name),
    db
      .select()
      .from(productSkus)
      .where(eq(productSkus.productId, product.id))
      .orderBy(productSkus.createdAt),
    db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, product.id))
      .orderBy(productImages.sortOrder, productImages.createdAt),
    db
      .select({
        id: productAttributeAssignments.id,
        attributeId: productAttributes.id,
        attributeCode: productAttributes.code,
        attributeName: productAttributes.name,
        attributeType: productAttributes.type,
        valueId: productAttributeValues.id,
        value: productAttributeValues.value,
        label: productAttributeValues.label,
        customValue: productAttributeAssignments.customValue,
      })
      .from(productAttributeAssignments)
      .innerJoin(
        productAttributes,
        eq(productAttributes.id, productAttributeAssignments.attributeId),
      )
      .leftJoin(
        productAttributeValues,
        eq(productAttributeValues.id, productAttributeAssignments.valueId),
      )
      .where(eq(productAttributeAssignments.productId, product.id)),
    product.categoryId
      ? db.query.productCategories.findFirst({
          where: eq(productCategories.id, product.categoryId),
          columns: { name: true },
        })
      : Promise.resolve(undefined),
    product.brandId
      ? db.query.brands.findFirst({
          where: eq(brands.id, product.brandId),
          columns: { name: true },
        })
      : Promise.resolve(undefined),
  ]);

  return ok(c, {
    ...product,
    merchantName: merchant.businessName,
    categoryName: category?.name ?? null,
    brandName: brand?.name ?? null,
    accessRole: role,
    variants,
    skus,
    images,
    attributes: assignments,
  });
});

catalogProductRoutes.patch(
  '/products/:productId',
  requirePermission('catalog:write'),
  validate('json', updateProductSchema),
  async (c) => {
    const { product } = await assertProductAccess(
      c.req.param('productId'),
      c.get('user'),
      c.get('permissions'),
      { manage: true },
    );
    const body = c.req.valid('json');

    await Promise.all([
      body.categoryId !== undefined ? assertCategoryExists(body.categoryId) : undefined,
      body.brandId !== undefined ? assertBrandExists(body.brandId) : undefined,
    ]);

    const [updated] = await db
      .update(products)
      .set({
        ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
        ...(body.brandId !== undefined ? { brandId: body.brandId } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.shortDescription !== undefined
          ? { shortDescription: body.shortDescription }
          : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.basePrice !== undefined ? { basePrice: body.basePrice } : {}),
        ...(body.currency !== undefined ? { currency: body.currency.toUpperCase() } : {}),
        ...(body.weightGram !== undefined ? { weightGram: body.weightGram } : {}),
        ...(body.dimensions !== undefined ? { dimensions: body.dimensions } : {}),
        ...(body.isFeatured !== undefined ? { isFeatured: body.isFeatured } : {}),
        ...(body.status !== undefined && body.status !== 'archived'
          ? { deletedAt: null }
          : {}),
        ...(body.status === 'archived' ? { deletedAt: new Date() } : {}),
      })
      .where(eq(products.id, product.id))
      .returning();

    await writeAuditLog({
      actorUserId: c.get('user').id,
      action: 'product.update',
      entityType: 'product',
      entityId: product.id,
      oldValues: { status: product.status, name: product.name },
      newValues: body as Record<string, unknown>,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });

    return ok(c, updated);
  },
);

catalogProductRoutes.delete(
  '/products/:productId',
  requirePermission('catalog:write'),
  async (c) => {
    const { product } = await assertProductAccess(
      c.req.param('productId'),
      c.get('user'),
      c.get('permissions'),
      { manage: true },
    );

    await db
      .update(products)
      .set({ status: 'archived', deletedAt: new Date() })
      .where(eq(products.id, product.id));

    await writeAuditLog({
      actorUserId: c.get('user').id,
      action: 'product.archive',
      entityType: 'product',
      entityId: product.id,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });

    return ok(c, { message: 'Product archived' });
  },
);

/* ------------------------------ Variants ---------------------------- */

catalogProductRoutes.post(
  '/products/:productId/variants',
  requirePermission('catalog:write'),
  validate('json', variantCreateSchema),
  async (c) => {
    const { product } = await assertProductAccess(
      c.req.param('productId'),
      c.get('user'),
      c.get('permissions'),
      { manage: true },
    );
    const body = c.req.valid('json');

    const variant = await db.transaction(async (tx) => {
      if (body.isDefault) {
        await tx
          .update(productVariants)
          .set({ isDefault: false })
          .where(eq(productVariants.productId, product.id));
      }

      const [created] = await tx
        .insert(productVariants)
        .values({
          productId: product.id,
          name: body.name,
          code: body.code ?? null,
          attributes: body.attributes ?? null,
          price: body.price ?? null,
          isDefault: body.isDefault ?? false,
          status: body.status ?? 'active',
          sortOrder: body.sortOrder ?? 0,
        })
        .returning();
      return created;
    });

    return c.json({ success: true as const, data: variant }, 201);
  },
);

catalogProductRoutes.patch(
  '/variants/:variantId',
  requirePermission('catalog:write'),
  validate('json', variantUpdateSchema),
  async (c) => {
    const variant = await db.query.productVariants.findFirst({
      where: eq(productVariants.id, c.req.param('variantId')),
    });
    if (!variant) throw ApiError.notFound('Variant not found');

    await assertProductAccess(variant.productId, c.get('user'), c.get('permissions'), {
      manage: true,
    });
    const body = c.req.valid('json');

    const updated = await db.transaction(async (tx) => {
      if (body.isDefault) {
        await tx
          .update(productVariants)
          .set({ isDefault: false })
          .where(eq(productVariants.productId, variant.productId));
      }

      const [row] = await tx
        .update(productVariants)
        .set({
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.code !== undefined ? { code: body.code } : {}),
          ...(body.attributes !== undefined ? { attributes: body.attributes } : {}),
          ...(body.price !== undefined ? { price: body.price } : {}),
          ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        })
        .where(eq(productVariants.id, variant.id))
        .returning();
      return row;
    });

    return ok(c, updated);
  },
);

catalogProductRoutes.delete(
  '/variants/:variantId',
  requirePermission('catalog:write'),
  async (c) => {
    const variant = await db.query.productVariants.findFirst({
      where: eq(productVariants.id, c.req.param('variantId')),
    });
    if (!variant) throw ApiError.notFound('Variant not found');

    await assertProductAccess(variant.productId, c.get('user'), c.get('permissions'), {
      manage: true,
    });

    const [skuCount] = await db
      .select({ value: count() })
      .from(productSkus)
      .where(eq(productSkus.variantId, variant.id));
    if (Number(skuCount?.value ?? 0) > 0) {
      throw ApiError.conflict('Variant still has SKUs. Remove or reassign the SKUs first.');
    }

    await db.delete(productVariants).where(eq(productVariants.id, variant.id));
    return ok(c, { message: 'Variant deleted' });
  },
);

/* -------------------------------- SKUs ------------------------------ */

catalogProductRoutes.post(
  '/products/:productId/skus',
  requirePermission('catalog:write'),
  validate('json', skuCreateSchema),
  async (c) => {
    const { product } = await assertProductAccess(
      c.req.param('productId'),
      c.get('user'),
      c.get('permissions'),
      { manage: true },
    );
    const body = c.req.valid('json');

    if (body.variantId) {
      const variant = await db.query.productVariants.findFirst({
        where: and(
          eq(productVariants.id, body.variantId),
          eq(productVariants.productId, product.id),
        ),
        columns: { id: true },
      });
      if (!variant) throw ApiError.badRequest('Variant does not belong to this product');
    }
    if (body.unitId) {
      const unit = await db.query.productUnits.findFirst({
        where: eq(productUnits.id, body.unitId),
        columns: { id: true },
      });
      if (!unit) throw ApiError.badRequest('Unit not found');
    }

    const [sku] = await db
      .insert(productSkus)
      .values({
        productId: product.id,
        variantId: body.variantId ?? null,
        unitId: body.unitId ?? null,
        skuCode: body.skuCode ?? generateCode('SKU'),
        barcode: body.barcode ?? null,
        price: body.price,
        costPrice: body.costPrice ?? null,
        status: body.status ?? 'active',
      })
      .returning();

    return c.json({ success: true as const, data: sku }, 201);
  },
);

catalogProductRoutes.patch(
  '/skus/:skuId',
  requirePermission('catalog:write'),
  validate('json', skuUpdateSchema),
  async (c) => {
    const sku = await db.query.productSkus.findFirst({
      where: eq(productSkus.id, c.req.param('skuId')),
    });
    if (!sku) throw ApiError.notFound('SKU not found');

    await assertProductAccess(sku.productId, c.get('user'), c.get('permissions'), {
      manage: true,
    });
    const body = c.req.valid('json');

    if (body.variantId) {
      const variant = await db.query.productVariants.findFirst({
        where: and(
          eq(productVariants.id, body.variantId),
          eq(productVariants.productId, sku.productId),
        ),
        columns: { id: true },
      });
      if (!variant) throw ApiError.badRequest('Variant does not belong to this product');
    }

    const [updated] = await db
      .update(productSkus)
      .set({
        ...(body.variantId !== undefined ? { variantId: body.variantId } : {}),
        ...(body.unitId !== undefined ? { unitId: body.unitId } : {}),
        ...(body.skuCode !== undefined ? { skuCode: body.skuCode } : {}),
        ...(body.barcode !== undefined ? { barcode: body.barcode } : {}),
        ...(body.price !== undefined ? { price: body.price } : {}),
        ...(body.costPrice !== undefined ? { costPrice: body.costPrice } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
      })
      .where(eq(productSkus.id, sku.id))
      .returning();

    return ok(c, updated);
  },
);

catalogProductRoutes.delete('/skus/:skuId', requirePermission('catalog:write'), async (c) => {
  const sku = await db.query.productSkus.findFirst({
    where: eq(productSkus.id, c.req.param('skuId')),
  });
  if (!sku) throw ApiError.notFound('SKU not found');

  await assertProductAccess(sku.productId, c.get('user'), c.get('permissions'), {
    manage: true,
  });

  await db.delete(productSkus).where(eq(productSkus.id, sku.id));
  return ok(c, { message: 'SKU deleted' });
});

/* ------------------------------- Images ----------------------------- */

catalogProductRoutes.post(
  '/products/:productId/images',
  requirePermission('catalog:write'),
  validate('json', imageCreateSchema),
  async (c) => {
    const { product } = await assertProductAccess(
      c.req.param('productId'),
      c.get('user'),
      c.get('permissions'),
      { manage: true },
    );
    const body = c.req.valid('json');

    const image = await db.transaction(async (tx) => {
      if (body.isPrimary) {
        await tx
          .update(productImages)
          .set({ isPrimary: false })
          .where(eq(productImages.productId, product.id));
      }

      const [created] = await tx
        .insert(productImages)
        .values({
          productId: product.id,
          url: body.url,
          altText: body.altText ?? null,
          isPrimary: body.isPrimary ?? false,
          sortOrder: body.sortOrder ?? 0,
        })
        .returning();
      return created;
    });

    return c.json({ success: true as const, data: image }, 201);
  },
);

catalogProductRoutes.patch(
  '/images/:imageId',
  requirePermission('catalog:write'),
  validate('json', imageUpdateSchema),
  async (c) => {
    const image = await db.query.productImages.findFirst({
      where: eq(productImages.id, c.req.param('imageId')),
    });
    if (!image) throw ApiError.notFound('Image not found');

    await assertProductAccess(image.productId, c.get('user'), c.get('permissions'), {
      manage: true,
    });
    const body = c.req.valid('json');

    const updated = await db.transaction(async (tx) => {
      if (body.isPrimary) {
        await tx
          .update(productImages)
          .set({ isPrimary: false })
          .where(eq(productImages.productId, image.productId));
      }

      const [row] = await tx
        .update(productImages)
        .set({
          ...(body.url !== undefined ? { url: body.url } : {}),
          ...(body.altText !== undefined ? { altText: body.altText } : {}),
          ...(body.isPrimary !== undefined ? { isPrimary: body.isPrimary } : {}),
          ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        })
        .where(eq(productImages.id, image.id))
        .returning();
      return row;
    });

    return ok(c, updated);
  },
);

catalogProductRoutes.delete(
  '/images/:imageId',
  requirePermission('catalog:write'),
  async (c) => {
    const image = await db.query.productImages.findFirst({
      where: eq(productImages.id, c.req.param('imageId')),
    });
    if (!image) throw ApiError.notFound('Image not found');

    await assertProductAccess(image.productId, c.get('user'), c.get('permissions'), {
      manage: true,
    });

    await db.delete(productImages).where(eq(productImages.id, image.id));
    return ok(c, { message: 'Image deleted' });
  },
);

/* ----------------------------- Attributes --------------------------- */

catalogProductRoutes.post(
  '/products/:productId/attributes',
  requirePermission('catalog:write'),
  validate('json', attributeAssignmentSchema),
  async (c) => {
    const { product } = await assertProductAccess(
      c.req.param('productId'),
      c.get('user'),
      c.get('permissions'),
      { manage: true },
    );
    const body = c.req.valid('json');

    const attribute = await db.query.productAttributes.findFirst({
      where: eq(productAttributes.id, body.attributeId),
    });
    if (!attribute) throw ApiError.badRequest('Attribute not found');

    if (body.valueId) {
      const value = await db.query.productAttributeValues.findFirst({
        where: and(
          eq(productAttributeValues.id, body.valueId),
          eq(productAttributeValues.attributeId, attribute.id),
        ),
        columns: { id: true },
      });
      if (!value) throw ApiError.badRequest('Attribute value does not belong to attribute');
    }

    const [assignment] = await db
      .insert(productAttributeAssignments)
      .values({
        productId: product.id,
        attributeId: attribute.id,
        valueId: body.valueId ?? null,
        customValue: body.customValue ?? null,
      })
      .onConflictDoUpdate({
        target: [
          productAttributeAssignments.productId,
          productAttributeAssignments.attributeId,
        ],
        set: {
          valueId: body.valueId ?? null,
          customValue: body.customValue ?? null,
        },
      })
      .returning();

    return c.json({ success: true as const, data: assignment }, 201);
  },
);

catalogProductRoutes.delete(
  '/products/:productId/attributes/:attributeId',
  requirePermission('catalog:write'),
  async (c) => {
    const { product } = await assertProductAccess(
      c.req.param('productId'),
      c.get('user'),
      c.get('permissions'),
      { manage: true },
    );

    const [deleted] = await db
      .delete(productAttributeAssignments)
      .where(
        and(
          eq(productAttributeAssignments.productId, product.id),
          eq(productAttributeAssignments.attributeId, c.req.param('attributeId')),
        ),
      )
      .returning({ id: productAttributeAssignments.id });

    if (!deleted) throw ApiError.notFound('Attribute assignment not found');
    return ok(c, { message: 'Attribute removed from product' });
  },
);
