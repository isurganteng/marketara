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
import { merchants, users } from './core';

/**
 * 2MD-01 Business Performance & Growth dan 2MD-02 Merchant Business Profile.
 *
 * Schema `business` menyimpan identitas/rekam jejak usaha dan seluruh data
 * pengukuran kinerja. Semua entitas operasional dimiliki satu merchant agar
 * scoping akses konsisten dengan modul commerce, pembayaran, POS, inventori,
 * rantai pasok, pemasaran, dan CRM.
 */
export const business = pgSchema('business');

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

export const businessProfileStatusEnum = business.enum('business_profile_status', [
  'draft',
  'active',
  'verified',
  'suspended',
  'archived',
]);

export const businessLegalStatusEnum = business.enum('business_legal_status', [
  'informal',
  'micro',
  'small',
  'medium',
  'cooperative',
  'limited_company',
  'other',
]);

export const businessLocationTypeEnum = business.enum('business_location_type', [
  'headquarters',
  'branch',
  'store',
  'warehouse',
  'production',
  'other',
]);

export const businessDocumentStatusEnum = business.enum('business_document_status', [
  'pending',
  'verified',
  'rejected',
  'expired',
]);

export const businessVerificationStatusEnum = business.enum('business_verification_status', [
  'pending',
  'in_review',
  'verified',
  'rejected',
]);

export const businessProfileShareStatusEnum = business.enum('business_profile_share_status', [
  'active',
  'revoked',
  'expired',
]);

export const performancePeriodTypeEnum = business.enum('performance_period_type', [
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
]);

export const performancePeriodStatusEnum = business.enum('performance_period_status', [
  'open',
  'closed',
]);

export const kpiCategoryEnum = business.enum('kpi_category', [
  'revenue',
  'transaction',
  'customer',
  'product',
  'margin',
  'growth',
  'operational',
  'other',
]);

export const kpiValueTypeEnum = business.enum('kpi_value_type', [
  'currency',
  'number',
  'percentage',
  'ratio',
]);

export const kpiDirectionEnum = business.enum('kpi_direction', [
  'higher_better',
  'lower_better',
]);

export const performanceReportStatusEnum = business.enum('performance_report_status', [
  'draft',
  'published',
]);

export const businessTargetStatusEnum = business.enum('business_target_status', [
  'active',
  'achieved',
  'missed',
  'cancelled',
]);

/* ------------------------------------------------------------------ */
/* 2MD-02 - Merchant Business Profile                                  */
/* ------------------------------------------------------------------ */

export const businessProfiles = business.table(
  'business_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 64 }).notNull(),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    tagline: varchar('tagline', { length: 255 }),
    description: text('description'),
    legalName: varchar('legal_name', { length: 255 }),
    legalStatus: businessLegalStatusEnum('legal_status').default('informal').notNull(),
    businessType: varchar('business_type', { length: 128 }),
    foundedAt: date('founded_at'),
    employeeCount: integer('employee_count'),
    annualRevenue: numeric('annual_revenue', { precision: 18, scale: 2 }),
    website: varchar('website', { length: 255 }),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 32 }),
    logoUrl: text('logo_url'),
    coverUrl: text('cover_url'),
    address: text('address'),
    city: varchar('city', { length: 128 }),
    province: varchar('province', { length: 128 }),
    postalCode: varchar('postal_code', { length: 16 }),
    country: varchar('country', { length: 2 }).default('ID').notNull(),
    latitude: numeric('latitude', { precision: 10, scale: 7 }),
    longitude: numeric('longitude', { precision: 10, scale: 7 }),
    status: businessProfileStatusEnum('status').default('draft').notNull(),
    verificationStatus: businessVerificationStatusEnum('verification_status')
      .default('pending')
      .notNull(),
    completeness: integer('completeness').default(0).notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('business_profiles_merchant_uq').on(t.merchantId),
    uniqueIndex('business_profiles_code_uq').on(t.merchantId, t.code),
    index('business_profiles_status_idx').on(t.status),
    index('business_profiles_verification_idx').on(t.verificationStatus),
  ],
);

export const businessHistory = business.table(
  'business_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => businessProfiles.id, { onDelete: 'cascade' }),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    eventDate: date('event_date').notNull(),
    category: varchar('category', { length: 64 }),
    source: varchar('source', { length: 128 }),
    createdAt,
  },
  (t) => [
    index('business_history_profile_idx').on(t.profileId),
    index('business_history_merchant_date_idx').on(t.merchantId, t.eventDate),
  ],
);

export const businessLocations = business.table(
  'business_locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => businessProfiles.id, { onDelete: 'cascade' }),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    type: businessLocationTypeEnum('type').default('branch').notNull(),
    address: text('address'),
    city: varchar('city', { length: 128 }),
    province: varchar('province', { length: 128 }),
    postalCode: varchar('postal_code', { length: 16 }),
    country: varchar('country', { length: 2 }).default('ID').notNull(),
    latitude: numeric('latitude', { precision: 10, scale: 7 }),
    longitude: numeric('longitude', { precision: 10, scale: 7 }),
    phone: varchar('phone', { length: 32 }),
    isPrimary: boolean('is_primary').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    openingHours: jsonb('opening_hours').$type<Record<string, unknown>>(),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('business_locations_profile_idx').on(t.profileId),
    index('business_locations_merchant_idx').on(t.merchantId),
  ],
);

export const businessLegalDocuments = business.table(
  'business_legal_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => businessProfiles.id, { onDelete: 'cascade' }),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    documentType: varchar('document_type', { length: 64 }).notNull(),
    documentNumber: varchar('document_number', { length: 128 }),
    title: varchar('title', { length: 255 }).notNull(),
    issuedAt: date('issued_at'),
    expiresAt: date('expires_at'),
    issuer: varchar('issuer', { length: 255 }),
    fileName: varchar('file_name', { length: 255 }),
    fileUrl: text('file_url'),
    status: businessDocumentStatusEnum('status').default('pending').notNull(),
    notes: text('notes'),
    verifiedBy: uuid('verified_by').references(() => users.id, { onDelete: 'set null' }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('business_legal_docs_profile_idx').on(t.profileId),
    index('business_legal_docs_status_idx').on(t.status),
  ],
);

export const businessActivityRecords = business.table(
  'business_activity_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => businessProfiles.id, { onDelete: 'cascade' }),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    activityDate: date('activity_date').notNull(),
    activityType: varchar('activity_type', { length: 64 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    amount: numeric('amount', { precision: 18, scale: 2 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt,
  },
  (t) => [
    index('business_activity_profile_idx').on(t.profileId),
    index('business_activity_merchant_date_idx').on(t.merchantId, t.activityDate),
  ],
);

export const businessVerifications = business.table(
  'business_verifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => businessProfiles.id, { onDelete: 'cascade' }),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    status: businessVerificationStatusEnum('status').default('pending').notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    checklist: jsonb('checklist').$type<Record<string, unknown>>(),
    notes: text('notes'),
    createdAt,
  },
  (t) => [
    index('business_verifications_profile_idx').on(t.profileId),
    index('business_verifications_status_idx').on(t.status),
  ],
);

export const businessProfileShares = business.table(
  'business_profile_shares',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => businessProfiles.id, { onDelete: 'cascade' }),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    sharedWithUserId: uuid('shared_with_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    sharedWithEmail: varchar('shared_with_email', { length: 255 }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    permissions: jsonb('permissions').$type<Record<string, unknown>>(),
    status: businessProfileShareStatusEnum('status').default('active').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('business_profile_shares_token_uq').on(t.tokenHash),
    index('business_profile_shares_profile_idx').on(t.profileId),
    index('business_profile_shares_status_idx').on(t.status),
  ],
);

/* ------------------------------------------------------------------ */
/* 2MD-01 - Business Performance                                       */
/* ------------------------------------------------------------------ */

export const performancePeriods = business.table(
  'performance_periods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    type: performancePeriodTypeEnum('type').default('monthly').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    status: performancePeriodStatusEnum('status').default('open').notNull(),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('performance_periods_code_uq').on(t.merchantId, t.code),
    uniqueIndex('performance_periods_range_uq').on(t.merchantId, t.type, t.startDate, t.endDate),
    index('performance_periods_merchant_idx').on(t.merchantId),
  ],
);

export const businessKpis = business.table(
  'business_kpis',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    description: text('description'),
    category: kpiCategoryEnum('category').default('other').notNull(),
    valueType: kpiValueTypeEnum('value_type').default('number').notNull(),
    unit: varchar('unit', { length: 32 }),
    direction: kpiDirectionEnum('direction').default('higher_better').notNull(),
    formula: text('formula'),
    isActive: boolean('is_active').default(true).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('business_kpis_code_uq').on(t.merchantId, t.code),
    index('business_kpis_merchant_idx').on(t.merchantId),
    index('business_kpis_category_idx').on(t.category),
  ],
);

export const businessKpiValues = business.table(
  'business_kpi_values',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    kpiId: uuid('kpi_id')
      .notNull()
      .references(() => businessKpis.id, { onDelete: 'cascade' }),
    periodId: uuid('period_id')
      .notNull()
      .references(() => performancePeriods.id, { onDelete: 'cascade' }),
    value: numeric('value', { precision: 20, scale: 4 }).default('0').notNull(),
    targetValue: numeric('target_value', { precision: 20, scale: 4 }),
    previousValue: numeric('previous_value', { precision: 20, scale: 4 }),
    achievementPercent: numeric('achievement_percent', { precision: 8, scale: 2 }),
    notes: text('notes'),
    calculatedAt: timestamp('calculated_at', { withTimezone: true }).defaultNow().notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('business_kpi_values_period_uq').on(t.kpiId, t.periodId),
    index('business_kpi_values_merchant_idx').on(t.merchantId),
    index('business_kpi_values_period_idx').on(t.periodId),
  ],
);

export const growthSnapshots = business.table(
  'growth_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    periodId: uuid('period_id')
      .notNull()
      .references(() => performancePeriods.id, { onDelete: 'cascade' }),
    snapshotDate: date('snapshot_date').notNull(),
    metricType: varchar('metric_type', { length: 64 }).notNull(),
    currentValue: numeric('current_value', { precision: 20, scale: 4 }).default('0').notNull(),
    previousValue: numeric('previous_value', { precision: 20, scale: 4 }),
    growthPercent: numeric('growth_percent', { precision: 8, scale: 2 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt,
  },
  (t) => [
    uniqueIndex('growth_snapshots_metric_uq').on(t.periodId, t.metricType),
    index('growth_snapshots_merchant_idx').on(t.merchantId),
  ],
);

export const merchantPerformanceReports = business.table(
  'merchant_performance_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    periodId: uuid('period_id')
      .notNull()
      .references(() => performancePeriods.id, { onDelete: 'cascade' }),
    reportNumber: varchar('report_number', { length: 64 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    summary: text('summary'),
    revenue: numeric('revenue', { precision: 18, scale: 2 }).default('0').notNull(),
    orderCount: integer('order_count').default(0).notNull(),
    customerCount: integer('customer_count').default(0).notNull(),
    productCount: integer('product_count').default(0).notNull(),
    grossMargin: numeric('gross_margin', { precision: 18, scale: 2 }),
    growthPercent: numeric('growth_percent', { precision: 8, scale: 2 }),
    score: numeric('score', { precision: 8, scale: 2 }),
    status: performanceReportStatusEnum('status').default('draft').notNull(),
    generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    data: jsonb('data').$type<Record<string, unknown>>(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('merchant_performance_reports_number_uq').on(t.merchantId, t.reportNumber),
    uniqueIndex('merchant_performance_reports_period_uq').on(t.merchantId, t.periodId),
    index('merchant_performance_reports_status_idx').on(t.status),
  ],
);

export const businessTargets = business.table(
  'business_targets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    periodId: uuid('period_id').references(() => performancePeriods.id, {
      onDelete: 'set null',
    }),
    kpiId: uuid('kpi_id').references(() => businessKpis.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 255 }).notNull(),
    targetValue: numeric('target_value', { precision: 20, scale: 4 }).notNull(),
    actualValue: numeric('actual_value', { precision: 20, scale: 4 }).default('0').notNull(),
    unit: varchar('unit', { length: 32 }),
    startDate: date('start_date'),
    endDate: date('end_date'),
    status: businessTargetStatusEnum('status').default('active').notNull(),
    notes: text('notes'),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('business_targets_merchant_idx').on(t.merchantId),
    index('business_targets_period_idx').on(t.periodId),
    index('business_targets_status_idx').on(t.status),
  ],
);
