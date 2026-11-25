import {
  boolean,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { organizations, users } from './core';

/**
 * SYS-03 API Gateway & Integration Management.
 *
 * Menyimpan katalog provider, koneksi, klien API, kunci API, endpoint,
 * langganan webhook, event webhook, log integrasi, dan aturan pemetaan data.
 */
export const platform = pgSchema('platform');

const createdAt = timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = timestamp('updated_at', { withTimezone: true })
  .defaultNow()
  .notNull()
  .$onUpdate(() => new Date());

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const integrationProviderTypeEnum = platform.enum('integration_provider_type', [
  'marketplace',
  'payment',
  'logistics',
  'government',
  'messaging',
  'analytics',
  'erp',
  'crm',
  'other',
]);

export const integrationStatusEnum = platform.enum('integration_status', [
  'active',
  'inactive',
  'deprecated',
]);

export const integrationConnectionStatusEnum = platform.enum('integration_connection_status', [
  'pending',
  'active',
  'disabled',
  'error',
]);

export const integrationEnvironmentEnum = platform.enum('integration_environment', [
  'sandbox',
  'production',
]);

export const apiClientStatusEnum = platform.enum('api_client_status', [
  'active',
  'suspended',
  'revoked',
]);

export const apiKeyStatusEnum = platform.enum('api_key_status', [
  'active',
  'expired',
  'revoked',
]);

export const httpMethodEnum = platform.enum('api_http_method', [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
]);

export const webhookSubscriptionStatusEnum = platform.enum('webhook_subscription_status', [
  'active',
  'paused',
  'disabled',
]);

export const webhookEventStatusEnum = platform.enum('webhook_event_status', [
  'pending',
  'processing',
  'delivered',
  'failed',
  'dead_letter',
]);

export const integrationLogStatusEnum = platform.enum('integration_log_status', [
  'success',
  'failed',
]);

export const dataMappingDirectionEnum = platform.enum('data_mapping_direction', [
  'inbound',
  'outbound',
  'bidirectional',
]);

/* ------------------------------------------------------------------ */
/* Providers & connections                                             */
/* ------------------------------------------------------------------ */

export const integrationProviders = platform.table(
  'integration_providers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    type: integrationProviderTypeEnum('type').default('other').notNull(),
    description: text('description'),
    baseUrl: text('base_url'),
    docsUrl: text('docs_url'),
    status: integrationStatusEnum('status').default('active').notNull(),
    config: jsonb('config').$type<Record<string, unknown>>(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('integration_providers_code_uq').on(t.code),
    index('integration_providers_type_idx').on(t.type),
    index('integration_providers_status_idx').on(t.status),
  ],
);

export const integrationConnections = platform.table(
  'integration_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    providerId: uuid('provider_id')
      .notNull()
      .references(() => integrationProviders.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'set null',
    }),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    environment: integrationEnvironmentEnum('environment').default('sandbox').notNull(),
    status: integrationConnectionStatusEnum('status').default('pending').notNull(),
    credentialsEncrypted: text('credentials_encrypted'),
    config: jsonb('config').$type<Record<string, unknown>>(),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('integration_connections_code_uq').on(t.code),
    index('integration_connections_provider_idx').on(t.providerId),
    index('integration_connections_org_idx').on(t.organizationId),
    index('integration_connections_status_idx').on(t.status),
  ],
);

/* ------------------------------------------------------------------ */
/* API clients, keys, dan endpoint                                     */
/* ------------------------------------------------------------------ */

export const apiClients = platform.table(
  'api_clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'set null',
    }),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    status: apiClientStatusEnum('status').default('active').notNull(),
    rateLimitPerMinute: integer('rate_limit_per_minute').default(60).notNull(),
    allowedOrigins: jsonb('allowed_origins').$type<string[]>(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('api_clients_code_uq').on(t.code),
    index('api_clients_org_idx').on(t.organizationId),
    index('api_clients_status_idx').on(t.status),
  ],
);

export const apiKeys = platform.table(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => apiClients.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    keyPrefix: varchar('key_prefix', { length: 24 }).notNull(),
    keyHash: varchar('key_hash', { length: 64 }).notNull(),
    scopes: jsonb('scopes').$type<string[]>(),
    status: apiKeyStatusEnum('status').default('active').notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('api_keys_hash_uq').on(t.keyHash),
    index('api_keys_client_idx').on(t.clientId),
    index('api_keys_status_idx').on(t.status),
  ],
);

export const apiEndpoints = platform.table(
  'api_endpoints',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    method: httpMethodEnum('method').notNull(),
    path: varchar('path', { length: 255 }).notNull(),
    version: varchar('version', { length: 16 }).default('v1').notNull(),
    description: text('description'),
    isPublic: boolean('is_public').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    rateLimitPerMinute: integer('rate_limit_per_minute'),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('api_endpoints_code_uq').on(t.code),
    uniqueIndex('api_endpoints_route_uq').on(t.method, t.path, t.version),
    index('api_endpoints_active_idx').on(t.isActive),
  ],
);

/* ------------------------------------------------------------------ */
/* Webhook                                                             */
/* ------------------------------------------------------------------ */

export const webhookSubscriptions = platform.table(
  'webhook_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => apiClients.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    url: text('url').notNull(),
    description: text('description'),
    events: jsonb('events').$type<string[]>().notNull(),
    secretHash: varchar('secret_hash', { length: 64 }),
    status: webhookSubscriptionStatusEnum('status').default('active').notNull(),
    failureCount: integer('failure_count').default(0).notNull(),
    lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('webhook_subscriptions_client_idx').on(t.clientId),
    index('webhook_subscriptions_status_idx').on(t.status),
  ],
);

export const webhookEvents = platform.table(
  'webhook_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subscriptionId: uuid('subscription_id')
      .notNull()
      .references(() => webhookSubscriptions.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 128 }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    status: webhookEventStatusEnum('status').default('pending').notNull(),
    attempts: integer('attempts').default(0).notNull(),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    lastError: text('last_error'),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('webhook_events_subscription_idx').on(t.subscriptionId),
    index('webhook_events_status_idx').on(t.status),
    index('webhook_events_type_idx').on(t.eventType),
  ],
);

/* ------------------------------------------------------------------ */
/* Log & mapping                                                       */
/* ------------------------------------------------------------------ */

export const integrationLogs = platform.table(
  'integration_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    providerId: uuid('provider_id').references(() => integrationProviders.id, {
      onDelete: 'set null',
    }),
    connectionId: uuid('connection_id').references(() => integrationConnections.id, {
      onDelete: 'set null',
    }),
    direction: dataMappingDirectionEnum('direction').default('outbound').notNull(),
    method: httpMethodEnum('method').default('POST').notNull(),
    path: text('path').notNull(),
    statusCode: integer('status_code'),
    requestBody: jsonb('request_body').$type<Record<string, unknown>>(),
    responseBody: jsonb('response_body').$type<Record<string, unknown>>(),
    status: integrationLogStatusEnum('status').default('success').notNull(),
    durationMs: integer('duration_ms'),
    errorMessage: text('error_message'),
    createdAt,
  },
  (t) => [
    index('integration_logs_provider_idx').on(t.providerId),
    index('integration_logs_connection_idx').on(t.connectionId),
    index('integration_logs_status_idx').on(t.status),
    index('integration_logs_created_idx').on(t.createdAt),
  ],
);

export const dataMappingRules = platform.table(
  'data_mapping_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    providerId: uuid('provider_id')
      .notNull()
      .references(() => integrationProviders.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    sourceEntity: varchar('source_entity', { length: 128 }).notNull(),
    targetEntity: varchar('target_entity', { length: 128 }).notNull(),
    direction: dataMappingDirectionEnum('direction').default('inbound').notNull(),
    mapping: jsonb('mapping').$type<Record<string, unknown>>().notNull(),
    transform: jsonb('transform').$type<Record<string, unknown>>(),
    isActive: boolean('is_active').default(true).notNull(),
    priority: integer('priority').default(0).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('data_mapping_rules_provider_idx').on(t.providerId),
    index('data_mapping_rules_entities_idx').on(t.sourceEntity, t.targetEntity),
    index('data_mapping_rules_active_idx').on(t.isActive),
  ],
);
