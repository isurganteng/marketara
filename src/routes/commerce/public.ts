import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  brands,
  marketBlocks,
  markets,
  marketUnits,
  marketZones,
  merchants,
  productAttributeAssignments,
  productAttributeValues,
  productAttributes,
  productCategories,
  productImages,
  productSkus,
  productVariants,
  products,
  salesChannels,
  storefrontProducts,
  storefronts,
  stores,
} from '../../db/schema';
import { ApiError } from '../../lib/errors';
import { getPagination, ok, paginated } from '../../lib/http';
import type { AppEnv } from '../../lib/app-env';
import { validate } from '../../lib/validator';
import { getPrimaryImageMap } from './shared';

const publicStorefrontColumns = {
  id: storefronts.id,
  name: storefronts.name,
  slug: storefronts.slug,
  description: storefronts.description,
  logoUrl: storefronts.logoUrl,
  bannerUrl: storefronts.bannerUrl,
  status: storefronts.status,
  currency: storefronts.currency,
  contactName: storefronts.contactName,
  contactPhone: storefronts.contactPhone,
  contactEmail: storefronts.contactEmail,
  isFeatured: storefronts.isFeatured,
  publishedAt: storefronts.publishedAt,
};

const listStorefrontsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  channelCode: z.string().trim().max(64).optional(),
  city: z.string().trim().max(128).optional(),
  province: z.string().trim().max(128).optional(),
  marketId: z.uuid().optional(),
  featured: z.enum(['true', 'false']).optional(),
});

const productSearchSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  categoryId: z.uuid().optional(),
  marketId: z.uuid().optional(),
  storefrontSlug: z.string().trim().max(255).optional(),
  channelCode: z.string().trim().max(64).optional(),
  sort: z.enum(['newest', 'name', 'price_asc', 'price_desc']).optional(),
});

const publicConditions = () => [
  eq(storefronts.status, 'published'),
  isNull(storefronts.deletedAt),
  eq(merchants.status, 'verified'),
  isNull(merchants.deletedAt),
];

async function getPublishedStorefrontBySlug(slug: string) {
  const [row] = await db
    .select({
      ...publicStorefrontColumns,
      merchantId: merchants.id,
      merchantName: merchants.businessName,
      merchantSlug: merchants.slug,
      merchantLogoUrl: merchants.logoUrl,
      storeId: stores.id,
      storeName: stores.name,
      storeAddress: stores.address,
      city: stores.city,
      province: stores.province,
      salesChannelId: salesChannels.id,
      salesChannelCode: salesChannels.code,
      salesChannelName: salesChannels.name,
      marketId: markets.id,
      marketName: markets.name,
      marketSlug: markets.slug,
    })
    .from(storefronts)
    .innerJoin(merchants, eq(merchants.id, storefronts.merchantId))
    .leftJoin(stores, eq(stores.id, storefronts.storeId))
    .leftJoin(marketUnits, eq(marketUnits.id, stores.marketUnitId))
    .leftJoin(marketBlocks, eq(marketBlocks.id, marketUnits.blockId))
    .leftJoin(marketZones, eq(marketZones.id, marketBlocks.zoneId))
    .leftJoin(markets, eq(markets.id, marketZones.marketId))
    .leftJoin(salesChannels, eq(salesChannels.id, storefronts.salesChannelId))
    .where(and(eq(storefronts.slug, slug), ...publicConditions()));

  if (!row) throw ApiError.notFound('Storefront not found');
  return row;
}

async function getStorefrontProductCounts(storefrontIds: string[]) {
  const map = new Map<string, number>();
  if (storefrontIds.length === 0) return map;

  const rows = await db
    .select({
      storefrontId: storefrontProducts.storefrontId,
      value: count(),
    })
    .from(storefrontProducts)
    .innerJoin(products, eq(products.id, storefrontProducts.productId))
    .where(
      and(
        inArray(storefrontProducts.storefrontId, storefrontIds),
        eq(storefrontProducts.isVisible, true),
        eq(products.status, 'active'),
        isNull(products.deletedAt),
      ),
    )
    .groupBy(storefrontProducts.storefrontId);

  for (const row of rows) map.set(row.storefrontId, Number(row.value));
  return map;
}

async function listPublicProducts(
  query: z.infer<typeof productSearchSchema>,
  forcedStorefrontId?: string,
) {
  const pagination = getPagination(query);
  const conditions = [
    eq(storefrontProducts.isVisible, true),
    eq(products.status, 'active'),
    isNull(products.deletedAt),
  ];

  if (forcedStorefrontId) {
    conditions.push(eq(storefrontProducts.storefrontId, forcedStorefrontId));
  } else if (query.storefrontSlug) {
    conditions.push(eq(storefronts.slug, query.storefrontSlug));
  }
  if (query.categoryId) conditions.push(eq(products.categoryId, query.categoryId));
  if (query.marketId) conditions.push(eq(markets.id, query.marketId));
  if (query.channelCode) {
    conditions.push(eq(salesChannels.code, query.channelCode));
    conditions.push(eq(salesChannels.status, 'active'));
  }
  if (query.search) {
    const term = `%${query.search}%`;
    const searchCondition = or(
      ilike(products.name, term),
      ilike(products.shortDescription, term),
      ilike(productCategories.name, term),
      ilike(brands.name, term),
      ilike(storefronts.name, term),
      ilike(merchants.businessName, term),
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  const where = and(...conditions);
  const priceExpression = sql<string>`coalesce(${storefrontProducts.priceOverride}, ${products.basePrice})`;

  const orderBy =
    query.sort === 'newest'
      ? [desc(products.createdAt)]
      : query.sort === 'name'
        ? [asc(products.name)]
        : query.sort === 'price_asc'
          ? [asc(priceExpression)]
          : query.sort === 'price_desc'
            ? [desc(priceExpression)]
            : [asc(storefrontProducts.sortOrder), asc(products.name)];

  const [rows, [{ value } = { value: 0 }]] = await Promise.all([
    db
      .select({
        storefrontProductId: storefrontProducts.id,
        storefrontId: storefronts.id,
        storefrontName: storefronts.name,
        storefrontSlug: storefronts.slug,
        storefrontLogoUrl: storefronts.logoUrl,
        merchantId: merchants.id,
        merchantName: merchants.businessName,
        productId: products.id,
        productName: products.name,
        productSlug: products.slug,
        shortDescription: products.shortDescription,
        basePrice: products.basePrice,
        priceOverride: storefrontProducts.priceOverride,
        compareAtPrice: storefrontProducts.compareAtPrice,
        price: priceExpression,
        currency: products.currency,
        weightGram: products.weightGram,
        isFeatured: storefrontProducts.isFeatured,
        sortOrder: storefrontProducts.sortOrder,
        categoryName: productCategories.name,
        brandName: brands.name,
        city: stores.city,
        province: stores.province,
        marketName: markets.name,
        createdAt: products.createdAt,
      })
      .from(storefrontProducts)
      .innerJoin(storefronts, eq(storefronts.id, storefrontProducts.storefrontId))
      .innerJoin(merchants, eq(merchants.id, storefronts.merchantId))
      .innerJoin(products, eq(products.id, storefrontProducts.productId))
      .leftJoin(productCategories, eq(productCategories.id, products.categoryId))
      .leftJoin(brands, eq(brands.id, products.brandId))
      .leftJoin(stores, eq(stores.id, storefronts.storeId))
      .leftJoin(marketUnits, eq(marketUnits.id, stores.marketUnitId))
      .leftJoin(marketBlocks, eq(marketBlocks.id, marketUnits.blockId))
      .leftJoin(marketZones, eq(marketZones.id, marketBlocks.zoneId))
      .leftJoin(markets, eq(markets.id, marketZones.marketId))
      .leftJoin(salesChannels, eq(salesChannels.id, storefronts.salesChannelId))
      .where(and(where, ...publicConditions()))
      .orderBy(...orderBy)
      .limit(pagination.limit)
      .offset(pagination.offset),
    db
      .select({ value: count() })
      .from(storefrontProducts)
      .innerJoin(storefronts, eq(storefronts.id, storefrontProducts.storefrontId))
      .innerJoin(merchants, eq(merchants.id, storefronts.merchantId))
      .innerJoin(products, eq(products.id, storefrontProducts.productId))
      .leftJoin(productCategories, eq(productCategories.id, products.categoryId))
      .leftJoin(brands, eq(brands.id, products.brandId))
      .leftJoin(stores, eq(stores.id, storefronts.storeId))
      .leftJoin(marketUnits, eq(marketUnits.id, stores.marketUnitId))
      .leftJoin(marketBlocks, eq(marketBlocks.id, marketUnits.blockId))
      .leftJoin(marketZones, eq(marketZones.id, marketBlocks.zoneId))
      .leftJoin(markets, eq(markets.id, marketZones.marketId))
      .leftJoin(salesChannels, eq(salesChannels.id, storefronts.salesChannelId))
      .where(and(where, ...publicConditions())),
  ]);

  const imageMap = await getPrimaryImageMap(rows.map((row) => row.productId));
  const data = rows.map((row) => ({
    ...row,
    image: imageMap.get(row.productId) ?? null,
  }));

  return { data, total: Number(value), pagination };
}

export const commerceMarketplaceRoutes = new Hono<AppEnv>();

/* ----------------------------- Storefronts --------------------------- */

commerceMarketplaceRoutes.get(
  '/storefronts',
  validate('query', listStorefrontsSchema),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions = publicConditions();

    if (query.featured) {
      conditions.push(eq(storefronts.isFeatured, query.featured === 'true'));
    }
    if (query.channelCode) {
      conditions.push(eq(salesChannels.code, query.channelCode));
      conditions.push(eq(salesChannels.status, 'active'));
    }
    if (query.city) conditions.push(eq(stores.city, query.city));
    if (query.province) conditions.push(eq(stores.province, query.province));
    if (query.marketId) conditions.push(eq(markets.id, query.marketId));
    if (query.search) {
      const term = `%${query.search}%`;
      const searchCondition = or(
        ilike(storefronts.name, term),
        ilike(storefronts.description, term),
        ilike(merchants.businessName, term),
        ilike(markets.name, term),
      );
      if (searchCondition) conditions.push(searchCondition);
    }
    const where = and(...conditions);

    const [rows, [{ value } = { value: 0 }]] = await Promise.all([
      db
        .select({
          ...publicStorefrontColumns,
          merchantId: merchants.id,
          merchantName: merchants.businessName,
          merchantLogoUrl: merchants.logoUrl,
          storeId: stores.id,
          storeName: stores.name,
          city: stores.city,
          province: stores.province,
          salesChannelCode: salesChannels.code,
          salesChannelName: salesChannels.name,
          marketId: markets.id,
          marketName: markets.name,
        })
        .from(storefronts)
        .innerJoin(merchants, eq(merchants.id, storefronts.merchantId))
        .leftJoin(stores, eq(stores.id, storefronts.storeId))
        .leftJoin(marketUnits, eq(marketUnits.id, stores.marketUnitId))
        .leftJoin(marketBlocks, eq(marketBlocks.id, marketUnits.blockId))
        .leftJoin(marketZones, eq(marketZones.id, marketBlocks.zoneId))
        .leftJoin(markets, eq(markets.id, marketZones.marketId))
        .leftJoin(salesChannels, eq(salesChannels.id, storefronts.salesChannelId))
        .where(where)
        .orderBy(
          desc(storefronts.isFeatured),
          desc(storefronts.publishedAt),
          asc(storefronts.name),
        )
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ value: count() })
        .from(storefronts)
        .innerJoin(merchants, eq(merchants.id, storefronts.merchantId))
        .leftJoin(stores, eq(stores.id, storefronts.storeId))
        .leftJoin(marketUnits, eq(marketUnits.id, stores.marketUnitId))
        .leftJoin(marketBlocks, eq(marketBlocks.id, marketUnits.blockId))
        .leftJoin(marketZones, eq(marketZones.id, marketBlocks.zoneId))
        .leftJoin(markets, eq(markets.id, marketZones.marketId))
        .leftJoin(salesChannels, eq(salesChannels.id, storefronts.salesChannelId))
        .where(where),
    ]);

    const countMap = await getStorefrontProductCounts(rows.map((row) => row.id));
    const data = rows.map((row) => ({
      ...row,
      productCount: countMap.get(row.id) ?? 0,
    }));

    return paginated(c, data, Number(value), pagination);
  },
);

commerceMarketplaceRoutes.get('/storefronts/:slug', async (c) => {
  const row = await getPublishedStorefrontBySlug(c.req.param('slug'));
  const countMap = await getStorefrontProductCounts([row.id]);
  return ok(c, { ...row, productCount: countMap.get(row.id) ?? 0 });
});

commerceMarketplaceRoutes.get(
  '/storefronts/:slug/products',
  validate('query', productSearchSchema),
  async (c) => {
    const storefront = await getPublishedStorefrontBySlug(c.req.param('slug'));
    const query = c.req.valid('query');
    const result = await listPublicProducts(
      { ...query, storefrontSlug: storefront.slug },
      storefront.id,
    );
    return paginated(c, result.data, result.total, result.pagination);
  },
);

commerceMarketplaceRoutes.get(
  '/storefronts/:slug/products/:productSlug',
  async (c) => {
    const storefront = await getPublishedStorefrontBySlug(c.req.param('slug'));
    const [row] = await db
      .select({
        storefrontProductId: storefrontProducts.id,
        priceOverride: storefrontProducts.priceOverride,
        compareAtPrice: storefrontProducts.compareAtPrice,
        isFeatured: storefrontProducts.isFeatured,
        sortOrder: storefrontProducts.sortOrder,
        id: products.id,
        merchantId: products.merchantId,
        categoryId: products.categoryId,
        brandId: products.brandId,
        name: products.name,
        slug: products.slug,
        shortDescription: products.shortDescription,
        description: products.description,
        status: products.status,
        basePrice: products.basePrice,
        currency: products.currency,
        weightGram: products.weightGram,
        dimensions: products.dimensions,
        isFeaturedProduct: products.isFeatured,
        categoryName: productCategories.name,
        brandName: brands.name,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
      })
      .from(storefrontProducts)
      .innerJoin(products, eq(products.id, storefrontProducts.productId))
      .leftJoin(productCategories, eq(productCategories.id, products.categoryId))
      .leftJoin(brands, eq(brands.id, products.brandId))
      .where(
        and(
          eq(storefrontProducts.storefrontId, storefront.id),
          eq(storefrontProducts.isVisible, true),
          eq(products.slug, c.req.param('productSlug')),
          eq(products.status, 'active'),
          isNull(products.deletedAt),
        ),
      );

    if (!row) throw ApiError.notFound('Product not found');

    const [variants, skus, images, assignments] = await Promise.all([
      db
        .select()
        .from(productVariants)
        .where(
          and(
            eq(productVariants.productId, row.id),
            eq(productVariants.status, 'active'),
          ),
        )
        .orderBy(productVariants.sortOrder, productVariants.name),
      db
        .select()
        .from(productSkus)
        .where(and(eq(productSkus.productId, row.id), eq(productSkus.status, 'active')))
        .orderBy(productSkus.createdAt),
      db
        .select()
        .from(productImages)
        .where(eq(productImages.productId, row.id))
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
        .where(eq(productAttributeAssignments.productId, row.id)),
    ]);

    const effectivePrice =
      row.priceOverride ?? row.basePrice;

    return ok(c, {
      storefront: {
        id: storefront.id,
        name: storefront.name,
        slug: storefront.slug,
        logoUrl: storefront.logoUrl,
        bannerUrl: storefront.bannerUrl,
        currency: storefront.currency,
      },
      merchant: {
        id: storefront.merchantId,
        name: storefront.merchantName,
        slug: storefront.merchantSlug,
      },
      product: {
        ...row,
        price: effectivePrice,
        variants: variants.map((variant) => ({
          ...variant,
          price: variant.price == null ? null : variant.price,
          effectivePrice: row.priceOverride ?? variant.price ?? row.basePrice,
        })),
        skus: skus.map((sku) => ({
          ...sku,
          effectivePrice: row.priceOverride ?? sku.price,
        })),
        images,
        attributes: assignments,
      },
    });
  },
);

/* ------------------------------- Products ---------------------------- */

commerceMarketplaceRoutes.get(
  '/products',
  validate('query', productSearchSchema),
  async (c) => {
    const query = c.req.valid('query');
    const result = await listPublicProducts(query);
    return paginated(c, result.data, result.total, result.pagination);
  },
);
