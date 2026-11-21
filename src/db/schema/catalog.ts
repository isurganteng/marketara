import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { merchants, users } from './core';

/**
 * MKT-03 Product & Catalog.
 *
 * Master produk dimiliki merchant. SKU adalah identitas varian yang
 * diperdagangkan; stok tidak disimpan di sini (lihat modul inventory).
 */
export const catalog = pgSchema('catalog');

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const productStatusEnum = catalog.enum('product_status', [
  'draft',
  'active',
  'inactive',
  'archived',
]);

export const variantStatusEnum = catalog.enum('variant_status', ['active', 'inactive']);

export const skuStatusEnum = catalog.enum('sku_status', ['active', 'inactive']);

export const attributeTypeEnum = catalog.enum('attribute_type', [
  'text',
  'number',
  'boolean',
  'select',
]);

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const createdAt = timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = timestamp('updated_at', { withTimezone: true })
  .defaultNow()
  .notNull()
  .$onUpdate(() => new Date());

/* ------------------------------------------------------------------ */
/* Master reference                                                    */
/* ------------------------------------------------------------------ */

export const productCategories = catalog.table(
  'product_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    parentId: uuid('parent_id').references((): AnyPgColumn => productCategories.id, {
      onDelete: 'set null',
    }),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    description: text('description'),
    imageUrl: text('image_url'),
    sortOrder: integer('sort_order').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('product_categories_code_uq').on(t.code),
    uniqueIndex('product_categories_slug_uq').on(t.slug),
    index('product_categories_parent_idx').on(t.parentId),
  ],
);

export const brands = catalog.table(
  'brands',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    description: text('description'),
    logoUrl: text('logo_url'),
    website: varchar('website', { length: 255 }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('brands_code_uq').on(t.code),
    uniqueIndex('brands_slug_uq').on(t.slug),
  ],
);

export const productUnits = catalog.table(
  'product_units',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 32 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    symbol: varchar('symbol', { length: 16 }),
    createdAt,
  },
  (t) => [uniqueIndex('product_units_code_uq').on(t.code)],
);

export const productAttributes = catalog.table(
  'product_attributes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    type: attributeTypeEnum('type').default('text').notNull(),
    isVariantAttribute: boolean('is_variant_attribute').default(false).notNull(),
    isRequired: boolean('is_required').default(false).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [uniqueIndex('product_attributes_code_uq').on(t.code)],
);

export const productAttributeValues = catalog.table(
  'product_attribute_values',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    attributeId: uuid('attribute_id')
      .notNull()
      .references(() => productAttributes.id, { onDelete: 'cascade' }),
    value: varchar('value', { length: 128 }).notNull(),
    label: varchar('label', { length: 128 }),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt,
  },
  (t) => [
    uniqueIndex('product_attribute_values_uq').on(t.attributeId, t.value),
    index('product_attribute_values_attr_idx').on(t.attributeId),
  ],
);

/* ------------------------------------------------------------------ */
/* Product                                                             */
/* ------------------------------------------------------------------ */

export const products = catalog.table(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => productCategories.id, {
      onDelete: 'set null',
    }),
    brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    shortDescription: text('short_description'),
    description: text('description'),
    status: productStatusEnum('status').default('draft').notNull(),
    basePrice: numeric('base_price', { precision: 16, scale: 2 }).default('0').notNull(),
    currency: varchar('currency', { length: 3 }).default('IDR').notNull(),
    weightGram: integer('weight_gram'),
    dimensions: jsonb('dimensions').$type<Record<string, unknown>>(),
    isFeatured: boolean('is_featured').default(false).notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('products_merchant_slug_uq').on(t.merchantId, t.slug),
    index('products_merchant_idx').on(t.merchantId),
    index('products_category_idx').on(t.categoryId),
    index('products_brand_idx').on(t.brandId),
    index('products_status_idx').on(t.status),
  ],
);

export const productVariants = catalog.table(
  'product_variants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    code: varchar('code', { length: 64 }),
    attributes: jsonb('attributes').$type<Record<string, string | number | boolean>>(),
    price: numeric('price', { precision: 16, scale: 2 }),
    isDefault: boolean('is_default').default(false).notNull(),
    status: variantStatusEnum('status').default('active').notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('product_variants_code_uq').on(t.productId, t.code),
    index('product_variants_product_idx').on(t.productId),
  ],
);

export const productSkus = catalog.table(
  'product_skus',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id').references(() => productVariants.id, {
      onDelete: 'set null',
    }),
    unitId: uuid('unit_id').references(() => productUnits.id, { onDelete: 'set null' }),
    skuCode: varchar('sku_code', { length: 100 }).notNull(),
    barcode: varchar('barcode', { length: 100 }),
    price: numeric('price', { precision: 16, scale: 2 }).notNull(),
    costPrice: numeric('cost_price', { precision: 16, scale: 2 }),
    status: skuStatusEnum('status').default('active').notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('product_skus_code_uq').on(t.skuCode),
    uniqueIndex('product_skus_barcode_uq').on(t.barcode),
    index('product_skus_product_idx').on(t.productId),
    index('product_skus_variant_idx').on(t.variantId),
  ],
);

export const productImages = catalog.table(
  'product_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    altText: varchar('alt_text', { length: 255 }),
    isPrimary: boolean('is_primary').default(false).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt,
  },
  (t) => [index('product_images_product_idx').on(t.productId)],
);

export const productAttributeAssignments = catalog.table(
  'product_attribute_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    attributeId: uuid('attribute_id')
      .notNull()
      .references(() => productAttributes.id, { onDelete: 'cascade' }),
    valueId: uuid('value_id').references(() => productAttributeValues.id, {
      onDelete: 'set null',
    }),
    customValue: varchar('custom_value', { length: 255 }),
    createdAt,
  },
  (t) => [
    uniqueIndex('product_attribute_assignments_uq').on(t.productId, t.attributeId),
    index('product_attribute_assignments_product_idx').on(t.productId),
  ],
);

/* ------------------------------------------------------------------ */
/* Catalog collections                                                 */
/* ------------------------------------------------------------------ */

export const productCatalogs = catalog.table(
  'product_catalogs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    description: text('description'),
    isActive: boolean('is_active').default(true).notNull(),
    isPublic: boolean('is_public').default(false).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('product_catalogs_merchant_slug_uq').on(t.merchantId, t.slug),
    index('product_catalogs_merchant_idx').on(t.merchantId),
  ],
);

export const productCatalogItems = catalog.table(
  'product_catalog_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    catalogId: uuid('catalog_id')
      .notNull()
      .references(() => productCatalogs.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    priceOverride: numeric('price_override', { precision: 16, scale: 2 }),
    isVisible: boolean('is_visible').default(true).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt,
  },
  (t) => [
    uniqueIndex('product_catalog_items_uq').on(t.catalogId, t.productId),
    index('product_catalog_items_product_idx').on(t.productId),
  ],
);
