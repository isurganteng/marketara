import {
  boolean,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './core';
import { platform } from './integration';

/**
 * SYS-05 Platform Administration & Configuration.
 *
 * Pengaturan sistem, grup konfigurasi, kode referensi, feature flag,
 * parameter layanan, dan lokalisasi.
 */
const createdAt = timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = timestamp('updated_at', { withTimezone: true })
  .defaultNow()
  .notNull()
  .$onUpdate(() => new Date());

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const configurationValueTypeEnum = platform.enum('configuration_value_type', [
  'string',
  'number',
  'boolean',
  'json',
  'secret',
]);

export const configurationScopeEnum = platform.enum('configuration_scope', [
  'global',
  'organization',
  'merchant',
  'user',
]);

export const configurationStatusEnum = platform.enum('configuration_status', [
  'active',
  'archived',
]);

export const featureFlagStatusEnum = platform.enum('feature_flag_status', [
  'enabled',
  'disabled',
  'rollout',
]);

export const localizationStatusEnum = platform.enum('localization_status', [
  'active',
  'inactive',
]);

/* ------------------------------------------------------------------ */
/* Groups & settings                                                   */
/* ------------------------------------------------------------------ */

export const configurationGroups = platform.table(
  'configuration_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    description: text('description'),
    sortOrder: integer('sort_order').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [uniqueIndex('configuration_groups_code_uq').on(t.code)],
);

export const systemSettings = platform.table(
  'system_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id').references(() => configurationGroups.id, {
      onDelete: 'set null',
    }),
    key: varchar('key', { length: 128 }).notNull(),
    label: varchar('label', { length: 255 }).notNull(),
    description: text('description'),
    valueType: configurationValueTypeEnum('value_type').default('string').notNull(),
    value: text('value'),
    defaultValue: text('default_value'),
    scope: configurationScopeEnum('scope').default('global').notNull(),
    scopeId: uuid('scope_id'),
    isSecret: boolean('is_secret').default(false).notNull(),
    isEditable: boolean('is_editable').default(true).notNull(),
    status: configurationStatusEnum('status').default('active').notNull(),
    version: integer('version').default(1).notNull(),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('system_settings_key_scope_uq').on(t.key, t.scope, t.scopeId),
    index('system_settings_group_idx').on(t.groupId),
    index('system_settings_status_idx').on(t.status),
  ],
);

/* ------------------------------------------------------------------ */
/* Reference data                                                      */
/* ------------------------------------------------------------------ */

export const referenceCodes = platform.table(
  'reference_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    description: text('description'),
    isSystem: boolean('is_system').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [uniqueIndex('reference_codes_code_uq').on(t.code)],
);

export const referenceValues = platform.table(
  'reference_values',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    codeId: uuid('code_id')
      .notNull()
      .references(() => referenceCodes.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 64 }).notNull(),
    label: varchar('label', { length: 128 }).notNull(),
    value: text('value'),
    sortOrder: integer('sort_order').default(0).notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('reference_values_code_uq').on(t.codeId, t.code),
    index('reference_values_code_id_idx').on(t.codeId),
  ],
);

/* ------------------------------------------------------------------ */
/* Feature flags, service parameters, localization                     */
/* ------------------------------------------------------------------ */

export const featureFlags = platform.table(
  'feature_flags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: varchar('key', { length: 128 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    status: featureFlagStatusEnum('status').default('disabled').notNull(),
    rolloutPercentage: integer('rollout_percentage').default(0).notNull(),
    audience: jsonb('audience').$type<Record<string, unknown>>(),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('feature_flags_key_uq').on(t.key),
    index('feature_flags_status_idx').on(t.status),
  ],
);

export const serviceParameters = platform.table(
  'service_parameters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    service: varchar('service', { length: 64 }).notNull(),
    key: varchar('key', { length: 128 }).notNull(),
    label: varchar('label', { length: 255 }).notNull(),
    description: text('description'),
    valueType: configurationValueTypeEnum('value_type').default('string').notNull(),
    value: text('value'),
    isSecret: boolean('is_secret').default(false).notNull(),
    version: integer('version').default(1).notNull(),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [uniqueIndex('service_parameters_key_uq').on(t.service, t.key)],
);

export const localizationSettings = platform.table(
  'localization_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    locale: varchar('locale', { length: 16 }).notNull(),
    language: varchar('language', { length: 64 }).notNull(),
    currency: varchar('currency', { length: 3 }).default('IDR').notNull(),
    timezone: varchar('timezone', { length: 64 }).default('Asia/Jakarta').notNull(),
    dateFormat: varchar('date_format', { length: 32 }).default('DD/MM/YYYY').notNull(),
    numberFormat: varchar('number_format', { length: 32 }).default('id-ID').notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    status: localizationStatusEnum('status').default('active').notNull(),
    translations: jsonb('translations').$type<Record<string, unknown>>(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('localization_settings_locale_uq').on(t.locale),
    index('localization_settings_status_idx').on(t.status),
  ],
);
