import { sql } from 'drizzle-orm';
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
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

/**
 * Core schema (tahap 1):
 * - SYS-01 Identity & Access
 * - SYS-02 Organization & Membership
 * - MKT-01 Market & Physical Asset
 * - MKT-02 Vendor & Merchant
 *
 * Satu database PostgreSQL, schema logis dipisah per domain
 * (lihat dokumen referensi bagian 15).
 */
export const core = pgSchema('core');
export const governance = pgSchema('governance');

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const userStatusEnum = core.enum('user_status', [
  'pending',
  'active',
  'suspended',
  'inactive',
]);

export const authEventEnum = core.enum('auth_event', [
  'login_success',
  'login_failed',
  'logout',
  'session_revoked',
]);

export const orgMemberRoleEnum = core.enum('organization_member_role', [
  'owner',
  'admin',
  'staff',
  'member',
]);

export const memberStatusEnum = core.enum('membership_status', [
  'active',
  'invited',
  'suspended',
  'left',
]);

export const marketStatusEnum = core.enum('market_status', [
  'planned',
  'active',
  'inactive',
  'maintenance',
  'closed',
]);

export const zoneStatusEnum = core.enum('zone_status', ['active', 'inactive', 'maintenance']);

export const unitTypeEnum = core.enum('market_unit_type', [
  'kios',
  'lapak',
  'toko',
  'gudang',
  'lainnya',
]);

export const unitStatusEnum = core.enum('market_unit_status', [
  'available',
  'occupied',
  'reserved',
  'maintenance',
  'inactive',
]);

export const occupancyStatusEnum = core.enum('occupancy_status', ['active', 'ended', 'cancelled']);

export const merchantStatusEnum = core.enum('merchant_status', [
  'draft',
  'pending_verification',
  'verified',
  'rejected',
  'suspended',
  'inactive',
]);

export const merchantMemberRoleEnum = core.enum('merchant_member_role', [
  'owner',
  'manager',
  'staff',
]);

export const documentStatusEnum = core.enum('document_status', [
  'pending',
  'verified',
  'rejected',
  'expired',
]);

export const storeTypeEnum = core.enum('store_type', ['physical', 'online', 'hybrid']);

export const storeStatusEnum = core.enum('store_status', ['active', 'inactive', 'closed']);

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const createdAt = timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = timestamp('updated_at', { withTimezone: true })
  .defaultNow()
  .notNull()
  .$onUpdate(() => new Date());

/* ------------------------------------------------------------------ */
/* SYS-01 — Identity & Access                                          */
/* ------------------------------------------------------------------ */

export const users = core.table(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 32 }),
    fullName: varchar('full_name', { length: 255 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    avatarUrl: text('avatar_url'),
    status: userStatusEnum('status').default('active').notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt,
    updatedAt,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('users_email_uq').on(t.email),
    uniqueIndex('users_phone_uq').on(t.phone),
    index('users_status_idx').on(t.status),
  ],
);

export const roles = core.table(
  'roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    description: text('description'),
    isSystem: boolean('is_system').default(false).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [uniqueIndex('roles_code_uq').on(t.code)],
);

export const permissions = core.table(
  'permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 100 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    module: varchar('module', { length: 64 }).notNull(),
    description: text('description'),
    createdAt,
  },
  (t) => [
    uniqueIndex('permissions_code_uq').on(t.code),
    index('permissions_module_idx').on(t.module),
  ],
);

export const rolePermissions = core.table(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
    createdAt,
  },
  (t) => [uniqueIndex('role_permissions_uq').on(t.roleId, t.permissionId)],
);

/**
 * user_roles bersifat global (organization_id NULL) atau scoped ke organisasi.
 * Middleware saat ini memakai role global; role organisasi dikelola lewat
 * organization_members.
 */
export const userRoles = core.table(
  'user_roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id'),
    assignedBy: uuid('assigned_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
  },
  (t) => [
    uniqueIndex('user_roles_scope_uq').on(t.userId, t.roleId, t.organizationId),
    index('user_roles_user_idx').on(t.userId),
  ],
);

export const userSessions = core.table(
  'user_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt,
  },
  (t) => [
    uniqueIndex('user_sessions_token_uq').on(t.tokenHash),
    index('user_sessions_user_idx').on(t.userId),
  ],
);

export const authenticationLogs = core.table(
  'authentication_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    email: varchar('email', { length: 255 }),
    event: authEventEnum('event').notNull(),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt,
  },
  (t) => [
    index('authentication_logs_user_idx').on(t.userId),
    index('authentication_logs_created_idx').on(t.createdAt),
  ],
);

/* ------------------------------------------------------------------ */
/* SYS-02 — Organization & Membership                                  */
/* ------------------------------------------------------------------ */

export const organizationTypes = core.table(
  'organization_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    description: text('description'),
    createdAt,
  },
  (t) => [uniqueIndex('organization_types_code_uq').on(t.code)],
);

export const organizations = core.table(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    typeId: uuid('type_id').references(() => organizationTypes.id, { onDelete: 'set null' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => organizations.id, {
      onDelete: 'set null',
    }),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    legalName: varchar('legal_name', { length: 255 }),
    registrationNumber: varchar('registration_number', { length: 64 }),
    taxNumber: varchar('tax_number', { length: 64 }),
    description: text('description'),
    logoUrl: text('logo_url'),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 32 }),
    status: varchar('status', { length: 32 }).default('active').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('organizations_slug_uq').on(t.slug),
    index('organizations_type_idx').on(t.typeId),
    index('organizations_parent_idx').on(t.parentId),
  ],
);

export const organizationMembers = core.table(
  'organization_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: orgMemberRoleEnum('role').default('member').notNull(),
    status: memberStatusEnum('status').default('active').notNull(),
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('organization_members_uq').on(t.organizationId, t.userId),
    index('organization_members_user_idx').on(t.userId),
  ],
);

export const organizationBranches = core.table(
  'organization_branches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    address: text('address'),
    city: varchar('city', { length: 128 }),
    province: varchar('province', { length: 128 }),
    postalCode: varchar('postal_code', { length: 16 }),
    phone: varchar('phone', { length: 32 }),
    isMain: boolean('is_main').default(false).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [index('organization_branches_org_idx').on(t.organizationId)],
);

/* ------------------------------------------------------------------ */
/* MKT-01 — Market & Physical Asset                                    */
/* ------------------------------------------------------------------ */

export const markets = core.table(
  'markets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'set null',
    }),
    code: varchar('code', { length: 32 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    description: text('description'),
    address: text('address'),
    city: varchar('city', { length: 128 }),
    province: varchar('province', { length: 128 }),
    postalCode: varchar('postal_code', { length: 16 }),
    latitude: numeric('latitude', { precision: 10, scale: 7 }),
    longitude: numeric('longitude', { precision: 10, scale: 7 }),
    totalArea: numeric('total_area', { precision: 14, scale: 2 }),
    status: marketStatusEnum('status').default('planned').notNull(),
    openedAt: date('opened_at'),
    createdAt,
    updatedAt,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('markets_code_uq').on(t.code),
    uniqueIndex('markets_slug_uq').on(t.slug),
    index('markets_org_idx').on(t.organizationId),
    index('markets_status_idx').on(t.status),
  ],
);

export const marketZones = core.table(
  'market_zones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    marketId: uuid('market_id')
      .notNull()
      .references(() => markets.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 32 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    status: zoneStatusEnum('status').default('active').notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [uniqueIndex('market_zones_code_uq').on(t.marketId, t.code)],
);

export const marketBlocks = core.table(
  'market_blocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    zoneId: uuid('zone_id')
      .notNull()
      .references(() => marketZones.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 32 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    floor: varchar('floor', { length: 32 }),
    description: text('description'),
    status: zoneStatusEnum('status').default('active').notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [uniqueIndex('market_blocks_code_uq').on(t.zoneId, t.code)],
);

export const marketUnits = core.table(
  'market_units',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    blockId: uuid('block_id')
      .notNull()
      .references(() => marketBlocks.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 32 }).notNull(),
    unitNumber: varchar('unit_number', { length: 32 }),
    type: unitTypeEnum('type').default('kios').notNull(),
    status: unitStatusEnum('status').default('available').notNull(),
    areaSize: numeric('area_size', { precision: 12, scale: 2 }),
    monthlyFee: numeric('monthly_fee', { precision: 14, scale: 2 }),
    description: text('description'),
    latitude: numeric('latitude', { precision: 10, scale: 7 }),
    longitude: numeric('longitude', { precision: 10, scale: 7 }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('market_units_code_uq').on(t.blockId, t.code),
    index('market_units_status_idx').on(t.status),
  ],
);

export const marketFacilities = core.table(
  'market_facilities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    marketId: uuid('market_id')
      .notNull()
      .references(() => markets.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    type: varchar('type', { length: 64 }),
    locationDescription: text('location_description'),
    condition: varchar('condition', { length: 32 }).default('good').notNull(),
    isAvailable: boolean('is_available').default(true).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [index('market_facilities_market_idx').on(t.marketId)],
);

/* ------------------------------------------------------------------ */
/* MKT-02 — Vendor & Merchant                                          */
/* ------------------------------------------------------------------ */

export const merchantCategories = core.table(
  'merchant_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    description: text('description'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt,
  },
  (t) => [uniqueIndex('merchant_categories_code_uq').on(t.code)],
);

export const merchants = core.table(
  'merchants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 32 }).notNull(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'set null',
    }),
    categoryId: uuid('category_id').references(() => merchantCategories.id, {
      onDelete: 'set null',
    }),
    businessName: varchar('business_name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    description: text('description'),
    logoUrl: text('logo_url'),
    phone: varchar('phone', { length: 32 }),
    email: varchar('email', { length: 255 }),
    status: merchantStatusEnum('status').default('draft').notNull(),
    verificationNote: text('verification_note'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verifiedBy: uuid('verified_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('merchants_code_uq').on(t.code),
    uniqueIndex('merchants_slug_uq').on(t.slug),
    index('merchants_owner_idx').on(t.ownerUserId),
    index('merchants_org_idx').on(t.organizationId),
    index('merchants_status_idx').on(t.status),
  ],
);

export const merchantProfiles = core.table('merchant_profiles', {
  merchantId: uuid('merchant_id')
    .primaryKey()
    .references(() => merchants.id, { onDelete: 'cascade' }),
  npwp: varchar('npwp', { length: 32 }),
  nib: varchar('nib', { length: 32 }),
  foundedAt: date('founded_at'),
  employeeCount: integer('employee_count'),
  annualRevenue: numeric('annual_revenue', { precision: 18, scale: 2 }),
  website: varchar('website', { length: 255 }),
  instagram: varchar('instagram', { length: 255 }),
  facebook: varchar('facebook', { length: 255 }),
  marketplaceUrl: text('marketplace_url'),
  longDescription: text('long_description'),
  createdAt,
  updatedAt,
});

export const merchantDocuments = core.table(
  'merchant_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    documentType: varchar('document_type', { length: 64 }).notNull(),
    documentNumber: varchar('document_number', { length: 128 }),
    fileName: varchar('file_name', { length: 255 }),
    fileUrl: text('file_url').notNull(),
    issuedAt: date('issued_at'),
    expiresAt: date('expires_at'),
    status: documentStatusEnum('status').default('pending').notNull(),
    note: text('note'),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [index('merchant_documents_merchant_idx').on(t.merchantId)],
);

export const merchantMemberships = core.table(
  'merchant_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: merchantMemberRoleEnum('role').default('staff').notNull(),
    status: memberStatusEnum('status').default('active').notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('merchant_memberships_uq').on(t.merchantId, t.userId),
    index('merchant_memberships_user_idx').on(t.userId),
  ],
);

export const merchantStatusHistories = core.table(
  'merchant_status_histories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    fromStatus: varchar('from_status', { length: 32 }),
    toStatus: varchar('to_status', { length: 32 }).notNull(),
    reason: text('reason'),
    changedBy: uuid('changed_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
  },
  (t) => [index('merchant_status_histories_merchant_idx').on(t.merchantId)],
);

/**
 * Occupancy = penempatan merchant pada unit/kios pasar.
 * Unit hanya boleh punya satu occupancy aktif (partial unique index).
 */
export const occupancyRecords = core.table(
  'occupancy_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    marketUnitId: uuid('market_unit_id')
      .notNull()
      .references(() => marketUnits.id, { onDelete: 'cascade' }),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    status: occupancyStatusEnum('status').default('active').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    monthlyFee: numeric('monthly_fee', { precision: 14, scale: 2 }),
    agreementNumber: varchar('agreement_number', { length: 128 }),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('occupancy_records_merchant_idx').on(t.merchantId),
    index('occupancy_records_unit_idx').on(t.marketUnitId),
    uniqueIndex('occupancy_records_active_unit_uq')
      .on(t.marketUnitId)
      .where(sql`status = 'active'`),
  ],
);

/* ------------------------------------------------------------------ */
/* MKT-02 / MKT-04 — Store                                             */
/* ------------------------------------------------------------------ */

export const stores = core.table(
  'stores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    marketUnitId: uuid('market_unit_id').references(() => marketUnits.id, {
      onDelete: 'set null',
    }),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    type: storeTypeEnum('type').default('physical').notNull(),
    status: storeStatusEnum('status').default('active').notNull(),
    description: text('description'),
    phone: varchar('phone', { length: 32 }),
    email: varchar('email', { length: 255 }),
    address: text('address'),
    city: varchar('city', { length: 128 }),
    province: varchar('province', { length: 128 }),
    latitude: numeric('latitude', { precision: 10, scale: 7 }),
    longitude: numeric('longitude', { precision: 10, scale: 7 }),
    operatingHours: jsonb('operating_hours').$type<Record<string, unknown>>(),
    isPrimary: boolean('is_primary').default(false).notNull(),
    createdAt,
    updatedAt,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('stores_slug_uq').on(t.slug),
    index('stores_merchant_idx').on(t.merchantId),
    index('stores_status_idx').on(t.status),
  ],
);

/* ------------------------------------------------------------------ */
/* SYS-06 — Audit trail (minimal)                                      */
/* ------------------------------------------------------------------ */

export const auditLogs = governance.table(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 100 }).notNull(),
    entityId: varchar('entity_id', { length: 64 }),
    oldValues: jsonb('old_values').$type<Record<string, unknown>>(),
    newValues: jsonb('new_values').$type<Record<string, unknown>>(),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    createdAt,
  },
  (t) => [
    index('audit_logs_entity_idx').on(t.entityType, t.entityId),
    index('audit_logs_actor_idx').on(t.actorUserId),
    index('audit_logs_created_idx').on(t.createdAt),
  ],
);
