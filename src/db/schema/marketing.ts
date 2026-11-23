import {
  boolean,
  date,
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
import { orders } from './commerce';
import { merchants, users } from './core';

/**
 * MKT-12 Digital Marketing & Promotion dan MKT-13 Customer Relationship.
 *
 * Schema `marketing` menyatukan kampanye, promosi, kupon, iklan, pelanggan,
 * grup/segmen, loyalty, interaksi, dan keluhan. Seluruh data operasional
 * dimiliki oleh satu merchant agar scoping akses konsisten dengan modul lain.
 */
export const marketing = pgSchema('marketing');

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const createdAt = timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = timestamp('updated_at', { withTimezone: true })
  .defaultNow()
  .notNull()
  .$onUpdate(() => new Date());

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const campaignObjectiveEnum = marketing.enum('campaign_objective', [
  'awareness',
  'acquisition',
  'retention',
  'engagement',
]);

export const campaignStatusEnum = marketing.enum('campaign_status', [
  'draft',
  'scheduled',
  'active',
  'paused',
  'completed',
  'cancelled',
]);

export const campaignChannelTypeEnum = marketing.enum('campaign_channel_type', [
  'storefront',
  'marketplace',
  'social',
  'email',
  'whatsapp',
  'pos',
  'offline',
  'other',
]);

export const promotionTypeEnum = marketing.enum('promotion_type', [
  'percentage',
  'fixed_amount',
  'free_shipping',
  'bundle',
  'buy_x_get_y',
]);

export const promotionStatusEnum = marketing.enum('promotion_status', [
  'draft',
  'scheduled',
  'active',
  'paused',
  'expired',
  'cancelled',
]);

export const discountRuleTypeEnum = marketing.enum('discount_rule_type', [
  'percentage',
  'fixed_amount',
  'free_shipping',
  'buy_x_get_y',
]);

export const discountRuleTargetEnum = marketing.enum('discount_rule_target', [
  'order',
  'product',
  'category',
  'shipping',
]);

export const couponDiscountTypeEnum = marketing.enum('coupon_discount_type', [
  'percentage',
  'fixed_amount',
  'free_shipping',
]);

export const couponStatusEnum = marketing.enum('coupon_status', [
  'active',
  'inactive',
  'expired',
  'exhausted',
]);

export const couponRedemptionStatusEnum = marketing.enum('coupon_redemption_status', [
  'applied',
  'redeemed',
  'cancelled',
]);

export const advertisementTypeEnum = marketing.enum('advertisement_type', [
  'banner',
  'sponsored_product',
  'social_post',
  'email',
  'other',
]);

export const advertisementStatusEnum = marketing.enum('advertisement_status', [
  'draft',
  'scheduled',
  'active',
  'paused',
  'completed',
  'cancelled',
]);

export const customerStatusEnum = marketing.enum('customer_status', [
  'active',
  'inactive',
  'blocked',
]);

export const customerSourceEnum = marketing.enum('customer_source', [
  'storefront',
  'pos',
  'manual',
  'import',
  'marketplace',
  'other',
]);

export const customerGroupStatusEnum = marketing.enum('customer_group_status', [
  'active',
  'inactive',
]);

export const customerSegmentTypeEnum = marketing.enum('customer_segment_type', [
  'manual',
  'dynamic',
]);

export const customerSegmentStatusEnum = marketing.enum('customer_segment_status', [
  'active',
  'inactive',
]);

export const loyaltyTierEnum = marketing.enum('loyalty_tier', [
  'bronze',
  'silver',
  'gold',
  'platinum',
]);

export const loyaltyAccountStatusEnum = marketing.enum('loyalty_account_status', [
  'active',
  'suspended',
  'closed',
]);

export const loyaltyTransactionTypeEnum = marketing.enum('loyalty_transaction_type', [
  'earn',
  'redeem',
  'adjustment',
  'expire',
  'bonus',
]);

export const interactionTypeEnum = marketing.enum('customer_interaction_type', [
  'note',
  'call',
  'email',
  'whatsapp',
  'meeting',
  'complaint',
  'follow_up',
]);

export const interactionDirectionEnum = marketing.enum('customer_interaction_direction', [
  'inbound',
  'outbound',
  'internal',
]);

export const interactionStatusEnum = marketing.enum('customer_interaction_status', [
  'open',
  'completed',
  'cancelled',
]);

export const complaintPriorityEnum = marketing.enum('complaint_priority', [
  'low',
  'normal',
  'high',
  'urgent',
]);

export const complaintStatusEnum = marketing.enum('complaint_status', [
  'open',
  'in_progress',
  'resolved',
  'rejected',
  'closed',
]);

/* ------------------------------------------------------------------ */
/* MKT-12 - Digital Marketing & Promotion                              */
/* ------------------------------------------------------------------ */

export const marketingCampaigns = marketing.table(
  'marketing_campaigns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    objective: campaignObjectiveEnum('objective').default('awareness').notNull(),
    status: campaignStatusEnum('status').default('draft').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    budget: numeric('budget', { precision: 16, scale: 2 }).default('0').notNull(),
    spent: numeric('spent', { precision: 16, scale: 2 }).default('0').notNull(),
    targetRevenue: numeric('target_revenue', { precision: 16, scale: 2 })
      .default('0')
      .notNull(),
    targetAudience: text('target_audience'),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('marketing_campaigns_code_uq').on(t.merchantId, t.code),
    index('marketing_campaigns_merchant_idx').on(t.merchantId),
    index('marketing_campaigns_status_idx').on(t.status),
    index('marketing_campaigns_dates_idx').on(t.startsAt, t.endsAt),
  ],
);

export const campaignChannels = marketing.table(
  'campaign_channels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => marketingCampaigns.id, { onDelete: 'cascade' }),
    channelType: campaignChannelTypeEnum('channel_type').notNull(),
    name: varchar('name', { length: 128 }),
    budget: numeric('budget', { precision: 16, scale: 2 }).default('0').notNull(),
    spent: numeric('spent', { precision: 16, scale: 2 }).default('0').notNull(),
    targetConversions: integer('target_conversions').default(0).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('campaign_channels_campaign_type_uq').on(t.campaignId, t.channelType),
    index('campaign_channels_merchant_idx').on(t.merchantId),
    index('campaign_channels_campaign_idx').on(t.campaignId),
  ],
);

export const promotions = marketing.table(
  'promotions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id').references(() => marketingCampaigns.id, {
      onDelete: 'set null',
    }),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    type: promotionTypeEnum('type').notNull(),
    status: promotionStatusEnum('status').default('draft').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    priority: integer('priority').default(0).notNull(),
    stackable: boolean('stackable').default(false).notNull(),
    minPurchase: numeric('min_purchase', { precision: 16, scale: 2 })
      .default('0')
      .notNull(),
    maxDiscount: numeric('max_discount', { precision: 16, scale: 2 }),
    usageLimit: integer('usage_limit'),
    usedCount: integer('used_count').default(0).notNull(),
    perCustomerLimit: integer('per_customer_limit'),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('promotions_code_uq').on(t.merchantId, t.code),
    index('promotions_merchant_idx').on(t.merchantId),
    index('promotions_campaign_idx').on(t.campaignId),
    index('promotions_status_idx').on(t.status),
  ],
);

export const discountRules = marketing.table(
  'discount_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    promotionId: uuid('promotion_id')
      .notNull()
      .references(() => promotions.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }),
    ruleType: discountRuleTypeEnum('rule_type').notNull(),
    targetType: discountRuleTargetEnum('target_type').default('order').notNull(),
    thresholdAmount: numeric('threshold_amount', { precision: 16, scale: 2 })
      .default('0')
      .notNull(),
    thresholdQuantity: integer('threshold_quantity').default(0).notNull(),
    discountValue: numeric('discount_value', { precision: 16, scale: 2 })
      .default('0')
      .notNull(),
    maxDiscount: numeric('max_discount', { precision: 16, scale: 2 }),
    config: jsonb('config').$type<Record<string, unknown>>(),
    sortOrder: integer('sort_order').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('discount_rules_merchant_idx').on(t.merchantId),
    index('discount_rules_promotion_idx').on(t.promotionId),
  ],
);

export const coupons = marketing.table(
  'coupons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    promotionId: uuid('promotion_id').references(() => promotions.id, {
      onDelete: 'set null',
    }),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }),
    description: text('description'),
    status: couponStatusEnum('status').default('active').notNull(),
    discountType: couponDiscountTypeEnum('discount_type').notNull(),
    discountValue: numeric('discount_value', { precision: 16, scale: 2 })
      .default('0')
      .notNull(),
    minPurchase: numeric('min_purchase', { precision: 16, scale: 2 })
      .default('0')
      .notNull(),
    maxDiscount: numeric('max_discount', { precision: 16, scale: 2 }),
    usageLimit: integer('usage_limit'),
    usedCount: integer('used_count').default(0).notNull(),
    perCustomerLimit: integer('per_customer_limit'),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('coupons_code_uq').on(t.merchantId, t.code),
    index('coupons_merchant_idx').on(t.merchantId),
    index('coupons_promotion_idx').on(t.promotionId),
    index('coupons_status_idx').on(t.status),
  ],
);

export const couponRedemptions = marketing.table(
  'coupon_redemptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    couponId: uuid('coupon_id')
      .notNull()
      .references(() => coupons.id, { onDelete: 'restrict' }),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    customerId: uuid('customer_id'),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    code: varchar('code', { length: 64 }).notNull(),
    discountAmount: numeric('discount_amount', { precision: 16, scale: 2 })
      .default('0')
      .notNull(),
    status: couponRedemptionStatusEnum('status').default('redeemed').notNull(),
    redeemedAt: timestamp('redeemed_at', { withTimezone: true }).defaultNow().notNull(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('coupon_redemptions_coupon_order_uq').on(t.couponId, t.orderId),
    index('coupon_redemptions_merchant_idx').on(t.merchantId),
    index('coupon_redemptions_coupon_idx').on(t.couponId),
    index('coupon_redemptions_customer_idx').on(t.customerId),
    index('coupon_redemptions_status_idx').on(t.status),
  ],
);

export const advertisements = marketing.table(
  'advertisements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id').references(() => marketingCampaigns.id, {
      onDelete: 'set null',
    }),
    name: varchar('name', { length: 255 }).notNull(),
    type: advertisementTypeEnum('type').default('banner').notNull(),
    status: advertisementStatusEnum('status').default('draft').notNull(),
    placement: varchar('placement', { length: 128 }),
    creativeUrl: text('creative_url'),
    targetUrl: text('target_url'),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    budget: numeric('budget', { precision: 16, scale: 2 }).default('0').notNull(),
    spent: numeric('spent', { precision: 16, scale: 2 }).default('0').notNull(),
    impressions: integer('impressions').default(0).notNull(),
    clicks: integer('clicks').default(0).notNull(),
    conversions: integer('conversions').default(0).notNull(),
    revenue: numeric('revenue', { precision: 16, scale: 2 }).default('0').notNull(),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('advertisements_merchant_idx').on(t.merchantId),
    index('advertisements_campaign_idx').on(t.campaignId),
    index('advertisements_status_idx').on(t.status),
  ],
);

export const campaignPerformance = marketing.table(
  'campaign_performance',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => marketingCampaigns.id, { onDelete: 'cascade' }),
    channelId: uuid('channel_id').references(() => campaignChannels.id, {
      onDelete: 'set null',
    }),
    date: date('date').notNull(),
    impressions: integer('impressions').default(0).notNull(),
    clicks: integer('clicks').default(0).notNull(),
    conversions: integer('conversions').default(0).notNull(),
    spend: numeric('spend', { precision: 16, scale: 2 }).default('0').notNull(),
    revenue: numeric('revenue', { precision: 16, scale: 2 }).default('0').notNull(),
    orders: integer('orders').default(0).notNull(),
    newCustomers: integer('new_customers').default(0).notNull(),
    metrics: jsonb('metrics').$type<Record<string, unknown>>(),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('campaign_performance_merchant_idx').on(t.merchantId),
    index('campaign_performance_campaign_idx').on(t.campaignId),
    index('campaign_performance_date_idx').on(t.date),
  ],
);

/* ------------------------------------------------------------------ */
/* MKT-13 - Customer Relationship Management                           */
/* ------------------------------------------------------------------ */

export const customers = marketing.table(
  'customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 32 }),
    status: customerStatusEnum('status').default('active').notNull(),
    source: customerSourceEnum('source').default('manual').notNull(),
    birthDate: date('birth_date'),
    gender: varchar('gender', { length: 32 }),
    tags: jsonb('tags').$type<string[]>(),
    notes: text('notes'),
    totalOrders: integer('total_orders').default(0).notNull(),
    totalSpent: numeric('total_spent', { precision: 16, scale: 2 })
      .default('0')
      .notNull(),
    lastOrderAt: timestamp('last_order_at', { withTimezone: true }),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('customers_code_uq').on(t.merchantId, t.code),
    uniqueIndex('customers_merchant_user_uq').on(t.merchantId, t.userId),
    index('customers_merchant_idx').on(t.merchantId),
    index('customers_email_idx').on(t.email),
    index('customers_phone_idx').on(t.phone),
    index('customers_status_idx').on(t.status),
  ],
);

export const customerProfiles = marketing.table('customer_profiles', {
  customerId: uuid('customer_id')
    .primaryKey()
    .references(() => customers.id, { onDelete: 'cascade' }),
  companyName: varchar('company_name', { length: 255 }),
  taxNumber: varchar('tax_number', { length: 64 }),
  address: text('address'),
  city: varchar('city', { length: 128 }),
  province: varchar('province', { length: 128 }),
  postalCode: varchar('postal_code', { length: 20 }),
  country: varchar('country', { length: 2 }).default('ID').notNull(),
  avatarUrl: text('avatar_url'),
  preferences: jsonb('preferences').$type<Record<string, unknown>>(),
  notes: text('notes'),
  createdAt,
  updatedAt,
});

export const customerGroups = marketing.table(
  'customer_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    discountPercent: numeric('discount_percent', { precision: 5, scale: 2 })
      .default('0')
      .notNull(),
    status: customerGroupStatusEnum('status').default('active').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('customer_groups_code_uq').on(t.merchantId, t.code),
    index('customer_groups_merchant_idx').on(t.merchantId),
    index('customer_groups_status_idx').on(t.status),
  ],
);

export const customerGroupMembers = marketing.table(
  'customer_group_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => customerGroups.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('customer_group_members_uq').on(t.groupId, t.customerId),
    index('customer_group_members_customer_idx').on(t.customerId),
  ],
);

export const customerSegments = marketing.table(
  'customer_segments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    type: customerSegmentTypeEnum('type').default('manual').notNull(),
    criteria: jsonb('criteria').$type<Record<string, unknown>>(),
    status: customerSegmentStatusEnum('status').default('active').notNull(),
    memberCount: integer('member_count').default(0).notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('customer_segments_code_uq').on(t.merchantId, t.code),
    index('customer_segments_merchant_idx').on(t.merchantId),
    index('customer_segments_status_idx').on(t.status),
  ],
);

export const customerSegmentMembers = marketing.table(
  'customer_segment_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    segmentId: uuid('segment_id')
      .notNull()
      .references(() => customerSegments.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('customer_segment_members_uq').on(t.segmentId, t.customerId),
    index('customer_segment_members_customer_idx').on(t.customerId),
  ],
);

export const loyaltyAccounts = marketing.table(
  'loyalty_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    memberCode: varchar('member_code', { length: 64 }).notNull(),
    tier: loyaltyTierEnum('tier').default('bronze').notNull(),
    pointsBalance: integer('points_balance').default(0).notNull(),
    lifetimePoints: integer('lifetime_points').default(0).notNull(),
    lifetimeSpend: numeric('lifetime_spend', { precision: 16, scale: 2 })
      .default('0')
      .notNull(),
    status: loyaltyAccountStatusEnum('status').default('active').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('loyalty_accounts_customer_uq').on(t.customerId),
    uniqueIndex('loyalty_accounts_member_code_uq').on(t.merchantId, t.memberCode),
    index('loyalty_accounts_merchant_idx').on(t.merchantId),
    index('loyalty_accounts_status_idx').on(t.status),
  ],
);

export const loyaltyTransactions = marketing.table(
  'loyalty_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => loyaltyAccounts.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    type: loyaltyTransactionTypeEnum('type').notNull(),
    points: integer('points').notNull(),
    balanceBefore: integer('balance_before').notNull(),
    balanceAfter: integer('balance_after').notNull(),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    reference: varchar('reference', { length: 128 }),
    description: text('description'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
  },
  (t) => [
    index('loyalty_transactions_merchant_idx').on(t.merchantId),
    index('loyalty_transactions_account_idx').on(t.accountId),
    index('loyalty_transactions_customer_idx').on(t.customerId),
    index('loyalty_transactions_type_idx').on(t.type),
  ],
);

export const customerInteractions = marketing.table(
  'customer_interactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    type: interactionTypeEnum('type').notNull(),
    direction: interactionDirectionEnum('direction').default('internal').notNull(),
    subject: varchar('subject', { length: 255 }),
    content: text('content').notNull(),
    status: interactionStatusEnum('status').default('open').notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('customer_interactions_merchant_idx').on(t.merchantId),
    index('customer_interactions_customer_idx').on(t.customerId),
    index('customer_interactions_status_idx').on(t.status),
    index('customer_interactions_scheduled_idx').on(t.scheduledAt),
  ],
);

export const customerComplaints = marketing.table(
  'customer_complaints',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    complaintNumber: varchar('complaint_number', { length: 64 }).notNull(),
    category: varchar('category', { length: 128 }),
    subject: varchar('subject', { length: 255 }).notNull(),
    description: text('description').notNull(),
    priority: complaintPriorityEnum('priority').default('normal').notNull(),
    status: complaintStatusEnum('status').default('open').notNull(),
    assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
    resolution: text('resolution'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('customer_complaints_number_uq').on(t.complaintNumber),
    index('customer_complaints_merchant_idx').on(t.merchantId),
    index('customer_complaints_customer_idx').on(t.customerId),
    index('customer_complaints_status_idx').on(t.status),
    index('customer_complaints_priority_idx').on(t.priority),
  ],
);
