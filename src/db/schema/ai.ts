import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { merchants, organizations, users } from './core';
import { platform } from './integration';

/**
 * SYS-07 AI Assistant & Intelligent Services.
 *
 * Model, sesi, pesan, request/response, rekomendasi, forecast, dan log usage.
 */
const createdAt = timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = timestamp('updated_at', { withTimezone: true })
  .defaultNow()
  .notNull()
  .$onUpdate(() => new Date());

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const aiModelTypeEnum = platform.enum('ai_model_type', [
  'chat',
  'embedding',
  'image',
  'speech',
  'recommendation',
  'forecasting',
]);

export const aiModelStatusEnum = platform.enum('ai_model_status', [
  'active',
  'inactive',
  'deprecated',
]);

export const aiSessionStatusEnum = platform.enum('ai_session_status', [
  'active',
  'archived',
  'closed',
]);

export const aiMessageRoleEnum = platform.enum('ai_message_role', [
  'system',
  'user',
  'assistant',
  'tool',
]);

export const aiRequestStatusEnum = platform.enum('ai_request_status', [
  'queued',
  'processing',
  'completed',
  'failed',
]);

export const aiResponseStatusEnum = platform.enum('ai_response_status', [
  'completed',
  'failed',
  'filtered',
]);

export const recommendationTypeEnum = platform.enum('recommendation_type', [
  'product',
  'funding',
  'merchant',
  'market',
  'content',
]);

export const recommendationStatusEnum = platform.enum('recommendation_status', [
  'generated',
  'viewed',
  'accepted',
  'dismissed',
]);

export const forecastTypeEnum = platform.enum('forecast_type', [
  'sales',
  'demand',
  'revenue',
  'cashflow',
  'inventory',
]);

export const forecastJobStatusEnum = platform.enum('forecast_job_status', [
  'queued',
  'running',
  'completed',
  'failed',
]);

/* ------------------------------------------------------------------ */
/* Models & sessions                                                   */
/* ------------------------------------------------------------------ */

export const aiModels = platform.table(
  'ai_models',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    provider: varchar('provider', { length: 128 }).notNull(),
    type: aiModelTypeEnum('type').default('chat').notNull(),
    version: varchar('version', { length: 64 }),
    description: text('description'),
    capabilities: jsonb('capabilities').$type<string[]>(),
    config: jsonb('config').$type<Record<string, unknown>>(),
    status: aiModelStatusEnum('status').default('active').notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('ai_models_code_uq').on(t.code),
    index('ai_models_type_idx').on(t.type),
    index('ai_models_status_idx').on(t.status),
  ],
);

export const aiSessions = platform.table(
  'ai_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionKey: varchar('session_key', { length: 64 }).notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'set null',
    }),
    merchantId: uuid('merchant_id').references(() => merchants.id, { onDelete: 'set null' }),
    modelId: uuid('model_id').references(() => aiModels.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 255 }),
    contextType: varchar('context_type', { length: 64 }),
    contextId: uuid('context_id'),
    status: aiSessionStatusEnum('status').default('active').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('ai_sessions_key_uq').on(t.sessionKey),
    index('ai_sessions_user_idx').on(t.userId),
    index('ai_sessions_merchant_idx').on(t.merchantId),
    index('ai_sessions_status_idx').on(t.status),
  ],
);

export const aiMessages = platform.table(
  'ai_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => aiSessions.id, { onDelete: 'cascade' }),
    role: aiMessageRoleEnum('role').notNull(),
    content: text('content').notNull(),
    tokens: integer('tokens').default(0).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt,
  },
  (t) => [
    index('ai_messages_session_idx').on(t.sessionId),
    index('ai_messages_role_idx').on(t.role),
    index('ai_messages_created_idx').on(t.createdAt),
  ],
);

/* ------------------------------------------------------------------ */
/* Requests & responses                                                */
/* ------------------------------------------------------------------ */

export const aiRequests = platform.table(
  'ai_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestNumber: varchar('request_number', { length: 64 }).notNull(),
    sessionId: uuid('session_id').references(() => aiSessions.id, { onDelete: 'set null' }),
    modelId: uuid('model_id').references(() => aiModels.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    feature: varchar('feature', { length: 64 }).default('assistant').notNull(),
    prompt: text('prompt').notNull(),
    parameters: jsonb('parameters').$type<Record<string, unknown>>(),
    status: aiRequestStatusEnum('status').default('queued').notNull(),
    latencyMs: integer('latency_ms'),
    errorMessage: text('error_message'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('ai_requests_number_uq').on(t.requestNumber),
    index('ai_requests_session_idx').on(t.sessionId),
    index('ai_requests_user_idx').on(t.userId),
    index('ai_requests_status_idx').on(t.status),
  ],
);

export const aiResponses = platform.table(
  'ai_responses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => aiRequests.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    finishReason: varchar('finish_reason', { length: 64 }),
    promptTokens: integer('prompt_tokens').default(0).notNull(),
    completionTokens: integer('completion_tokens').default(0).notNull(),
    totalTokens: integer('total_tokens').default(0).notNull(),
    status: aiResponseStatusEnum('status').default('completed').notNull(),
    safety: jsonb('safety').$type<Record<string, unknown>>(),
    createdAt,
  },
  (t) => [
    uniqueIndex('ai_responses_request_uq').on(t.requestId),
    index('ai_responses_status_idx').on(t.status),
  ],
);

/* ------------------------------------------------------------------ */
/* Recommendation, forecast, usage                                     */
/* ------------------------------------------------------------------ */

export const recommendationResults = platform.table(
  'recommendation_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    merchantId: uuid('merchant_id').references(() => merchants.id, { onDelete: 'set null' }),
    modelId: uuid('model_id').references(() => aiModels.id, { onDelete: 'set null' }),
    type: recommendationTypeEnum('type').default('product').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    summary: text('summary'),
    items: jsonb('items').$type<Record<string, unknown>[]>(),
    score: numeric('score', { precision: 8, scale: 4 }),
    status: recommendationStatusEnum('status').default('generated').notNull(),
    source: varchar('source', { length: 128 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('recommendation_results_user_idx').on(t.userId),
    index('recommendation_results_merchant_idx').on(t.merchantId),
    index('recommendation_results_type_idx').on(t.type),
    index('recommendation_results_status_idx').on(t.status),
  ],
);

export const forecastJobs = platform.table(
  'forecast_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobNumber: varchar('job_number', { length: 64 }).notNull(),
    type: forecastTypeEnum('type').default('sales').notNull(),
    merchantId: uuid('merchant_id').references(() => merchants.id, { onDelete: 'set null' }),
    dataSource: varchar('data_source', { length: 128 }),
    horizonDays: integer('horizon_days').default(30).notNull(),
    parameters: jsonb('parameters').$type<Record<string, unknown>>(),
    status: forecastJobStatusEnum('status').default('queued').notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    result: jsonb('result').$type<Record<string, unknown>>(),
    errorMessage: text('error_message'),
    requestedBy: uuid('requested_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('forecast_jobs_number_uq').on(t.jobNumber),
    index('forecast_jobs_merchant_idx').on(t.merchantId),
    index('forecast_jobs_status_idx').on(t.status),
    index('forecast_jobs_type_idx').on(t.type),
  ],
);

export const aiUsageLogs = platform.table(
  'ai_usage_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    modelId: uuid('model_id').references(() => aiModels.id, { onDelete: 'set null' }),
    requestId: uuid('request_id').references(() => aiRequests.id, { onDelete: 'set null' }),
    feature: varchar('feature', { length: 64 }).default('assistant').notNull(),
    promptTokens: integer('prompt_tokens').default(0).notNull(),
    completionTokens: integer('completion_tokens').default(0).notNull(),
    totalTokens: integer('total_tokens').default(0).notNull(),
    cost: numeric('cost', { precision: 14, scale: 6 }).default('0').notNull(),
    status: aiRequestStatusEnum('status').default('completed').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt,
  },
  (t) => [
    index('ai_usage_logs_user_idx').on(t.userId),
    index('ai_usage_logs_model_idx').on(t.modelId),
    index('ai_usage_logs_created_idx').on(t.createdAt),
  ],
);
