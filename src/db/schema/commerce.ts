import { sql } from 'drizzle-orm';
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
} from 'drizzle-orm/pg-core';
import { productSkus, products } from './catalog';
import { merchants, stores, users } from './core';

/**
 * MKT-04 Marketplace & Omnichannel Commerce.
 *
 * Schema ini menyimpan kanal penjualan, storefront publik, katalog yang
 * ditampilkan di storefront, listing marketplace eksternal, alamat pelanggan,
 * keranjang, dan sesi checkout. Order/pembayaran berada di modul berikutnya
 * (MKT-05/MKT-06) dan akan mereferensikan checkout_session.
 */
export const commerce = pgSchema('commerce');

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const salesChannelTypeEnum = commerce.enum('sales_channel_type', [
  'web',
  'marketplace',
  'social',
  'pos',
  'other',
]);

export const salesChannelStatusEnum = commerce.enum('sales_channel_status', [
  'active',
  'inactive',
]);

export const storefrontStatusEnum = commerce.enum('storefront_status', [
  'draft',
  'published',
  'inactive',
  'suspended',
]);

export const listingStatusEnum = commerce.enum('listing_status', [
  'draft',
  'active',
  'paused',
  'ended',
]);

export const cartStatusEnum = commerce.enum('cart_status', [
  'active',
  'converted',
  'abandoned',
  'expired',
]);

export const checkoutStatusEnum = commerce.enum('checkout_status', [
  'draft',
  'pending',
  'ready',
  'expired',
  'cancelled',
  'completed',
]);

export const addressTypeEnum = commerce.enum('address_type', [
  'home',
  'office',
  'other',
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
/* Sales channel & storefront                                          */
/* ------------------------------------------------------------------ */

export const salesChannels = commerce.table(
  'sales_channels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    type: salesChannelTypeEnum('type').default('web').notNull(),
    status: salesChannelStatusEnum('status').default('active').notNull(),
    description: text('description'),
    logoUrl: text('logo_url'),
    config: jsonb('config').$type<Record<string, unknown>>(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('sales_channels_code_uq').on(t.code),
    index('sales_channels_status_idx').on(t.status),
  ],
);

export const storefronts = commerce.table(
  'storefronts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id').references(() => stores.id, { onDelete: 'set null' }),
    salesChannelId: uuid('sales_channel_id').references(() => salesChannels.id, {
      onDelete: 'set null',
    }),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    description: text('description'),
    logoUrl: text('logo_url'),
    bannerUrl: text('banner_url'),
    status: storefrontStatusEnum('status').default('draft').notNull(),
    currency: varchar('currency', { length: 3 }).default('IDR').notNull(),
    contactName: varchar('contact_name', { length: 255 }),
    contactPhone: varchar('contact_phone', { length: 32 }),
    contactEmail: varchar('contact_email', { length: 255 }),
    settings: jsonb('settings').$type<Record<string, unknown>>(),
    isFeatured: boolean('is_featured').default(false).notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt,
    updatedAt,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('storefronts_slug_uq').on(t.slug),
    index('storefronts_merchant_idx').on(t.merchantId),
    index('storefronts_store_idx').on(t.storeId),
    index('storefronts_channel_idx').on(t.salesChannelId),
    index('storefronts_status_idx').on(t.status),
  ],
);

export const storefrontProducts = commerce.table(
  'storefront_products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storefrontId: uuid('storefront_id')
      .notNull()
      .references(() => storefronts.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    priceOverride: numeric('price_override', { precision: 16, scale: 2 }),
    compareAtPrice: numeric('compare_at_price', { precision: 16, scale: 2 }),
    isVisible: boolean('is_visible').default(true).notNull(),
    isFeatured: boolean('is_featured').default(false).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('storefront_products_uq').on(t.storefrontId, t.productId),
    index('storefront_products_product_idx').on(t.productId),
    index('storefront_products_visible_idx').on(t.storefrontId, t.isVisible),
  ],
);

/**
 * Listing produk di kanal eksternal (mis. marketplace atau social commerce).
 * `storefrontProducts` adalah katalog internal; `channelListings` memetakan
 * produk yang sama ke ID/URL kanal eksternal.
 */
export const channelListings = commerce.table(
  'channel_listings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => salesChannels.id, { onDelete: 'cascade' }),
    storefrontId: uuid('storefront_id')
      .notNull()
      .references(() => storefronts.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    externalListingId: varchar('external_listing_id', { length: 255 }),
    title: varchar('title', { length: 255 }),
    description: text('description'),
    price: numeric('price', { precision: 16, scale: 2 }),
    currency: varchar('currency', { length: 3 }).default('IDR').notNull(),
    status: listingStatusEnum('status').default('draft').notNull(),
    externalUrl: text('external_url'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('channel_listings_external_uq').on(t.channelId, t.externalListingId),
    index('channel_listings_storefront_idx').on(t.storefrontId),
    index('channel_listings_product_idx').on(t.productId),
    index('channel_listings_status_idx').on(t.status),
  ],
);

/* ------------------------------------------------------------------ */
/* Customer, cart, checkout                                            */
/* ------------------------------------------------------------------ */

export const customerAddresses = commerce.table(
  'customer_addresses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 64 }).default('Rumah').notNull(),
    type: addressTypeEnum('type').default('home').notNull(),
    recipientName: varchar('recipient_name', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 32 }).notNull(),
    addressLine1: text('address_line1').notNull(),
    addressLine2: text('address_line2'),
    city: varchar('city', { length: 128 }).notNull(),
    province: varchar('province', { length: 128 }).notNull(),
    postalCode: varchar('postal_code', { length: 16 }),
    country: varchar('country', { length: 2 }).default('ID').notNull(),
    latitude: numeric('latitude', { precision: 10, scale: 7 }),
    longitude: numeric('longitude', { precision: 10, scale: 7 }),
    isDefault: boolean('is_default').default(false).notNull(),
    createdAt,
    updatedAt,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('customer_addresses_user_idx').on(t.userId),
    uniqueIndex('customer_addresses_default_uq')
      .on(t.userId)
      .where(sql`is_default = true and deleted_at is null`),
  ],
);

export const shoppingCarts = commerce.table(
  'shopping_carts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: cartStatusEnum('status').default('active').notNull(),
    currency: varchar('currency', { length: 3 }).default('IDR').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('shopping_carts_user_idx').on(t.userId),
    uniqueIndex('shopping_carts_active_user_uq')
      .on(t.userId)
      .where(sql`status = 'active'`),
  ],
);

export const cartItems = commerce.table(
  'cart_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cartId: uuid('cart_id')
      .notNull()
      .references(() => shoppingCarts.id, { onDelete: 'cascade' }),
    storefrontProductId: uuid('storefront_product_id')
      .notNull()
      .references(() => storefrontProducts.id, { onDelete: 'cascade' }),
    skuId: uuid('sku_id').references(() => productSkus.id, { onDelete: 'set null' }),
    quantity: integer('quantity').default(1).notNull(),
    unitPrice: numeric('unit_price', { precision: 16, scale: 2 }).notNull(),
    productName: varchar('product_name', { length: 255 }).notNull(),
    skuCode: varchar('sku_code', { length: 100 }),
    notes: text('notes'),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('cart_items_cart_idx').on(t.cartId),
    index('cart_items_storefront_product_idx').on(t.storefrontProductId),
  ],
);

export const checkoutSessions = commerce.table(
  'checkout_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cartId: uuid('cart_id')
      .notNull()
      .references(() => shoppingCarts.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: checkoutStatusEnum('status').default('pending').notNull(),
    currency: varchar('currency', { length: 3 }).default('IDR').notNull(),
    itemCount: integer('item_count').default(0).notNull(),
    subtotal: numeric('subtotal', { precision: 16, scale: 2 }).default('0').notNull(),
    discountTotal: numeric('discount_total', { precision: 16, scale: 2 }).default('0').notNull(),
    shippingTotal: numeric('shipping_total', { precision: 16, scale: 2 }).default('0').notNull(),
    grandTotal: numeric('grand_total', { precision: 16, scale: 2 }).default('0').notNull(),
    addressId: uuid('address_id').references(() => customerAddresses.id, {
      onDelete: 'set null',
    }),
    addressSnapshot: jsonb('address_snapshot').$type<Record<string, unknown>>(),
    itemsSnapshot: jsonb('items_snapshot').$type<Array<Record<string, unknown>>>().notNull(),
    contactName: varchar('contact_name', { length: 255 }),
    contactPhone: varchar('contact_phone', { length: 32 }),
    contactEmail: varchar('contact_email', { length: 255 }),
    notes: text('notes'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('checkout_sessions_cart_idx').on(t.cartId),
    index('checkout_sessions_user_idx').on(t.userId),
    index('checkout_sessions_status_idx').on(t.status),
    uniqueIndex('checkout_sessions_active_cart_uq')
      .on(t.cartId)
      .where(sql`status in ('draft', 'pending', 'ready')`),
  ],
);
