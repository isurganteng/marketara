import {
  date,
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
import { users } from './core';

/**
 * SYS-08 Reporting & Data Warehouse.
 *
 * Sumber data, job ETL, log load, data mart, definisi laporan, eksekusi
 * laporan, dan snapshot historis untuk kebutuhan analitik.
 */
export const analytics = pgSchema('analytics');

const createdAt = timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = timestamp('updated_at', { withTimezone: true })
  .defaultNow()
  .notNull()
  .$onUpdate(() => new Date());

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const dataSourceTypeEnum = analytics.enum('data_source_type', [
  'postgres',
  'api',
  'file',
  'manual',
]);

export const dataSourceStatusEnum = analytics.enum('data_source_status', [
  'active',
  'inactive',
  'error',
]);

export const etlJobTypeEnum = analytics.enum('etl_job_type', [
  'extract',
  'transform',
  'load',
  'full',
  'incremental',
]);

export const etlJobStatusEnum = analytics.enum('etl_job_status', [
  'scheduled',
  'running',
  'completed',
  'failed',
  'paused',
]);

export const dataLoadStatusEnum = analytics.enum('data_load_status', [
  'success',
  'failed',
  'partial',
]);

export const dataMartStatusEnum = analytics.enum('data_mart_status', [
  'draft',
  'active',
  'archived',
]);

export const reportDefinitionStatusEnum = analytics.enum('report_definition_status', [
  'draft',
  'active',
  'archived',
]);

export const reportRunStatusEnum = analytics.enum('report_run_status', [
  'queued',
  'running',
  'completed',
  'failed',
]);

export const reportFormatEnum = analytics.enum('report_format', [
  'table',
  'csv',
  'json',
  'pdf',
]);

export const refreshModeEnum = analytics.enum('refresh_mode', [
  'manual',
  'scheduled',
]);

export const snapshotStatusEnum = analytics.enum('snapshot_status', [
  'active',
  'archived',
]);

/* ------------------------------------------------------------------ */
/* Data sources, ETL, load logs                                        */
/* ------------------------------------------------------------------ */

export const dataSources = analytics.table(
  'data_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    type: dataSourceTypeEnum('type').default('postgres').notNull(),
    description: text('description'),
    connectionConfig: jsonb('connection_config').$type<Record<string, unknown>>(),
    status: dataSourceStatusEnum('status').default('active').notNull(),
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('data_sources_code_uq').on(t.code),
    index('data_sources_type_idx').on(t.type),
    index('data_sources_status_idx').on(t.status),
  ],
);

export const etlJobs = analytics.table(
  'etl_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    dataSourceId: uuid('data_source_id').references(() => dataSources.id, {
      onDelete: 'set null',
    }),
    type: etlJobTypeEnum('type').default('full').notNull(),
    schedule: varchar('schedule', { length: 64 }),
    sourceQuery: text('source_query'),
    targetTable: varchar('target_table', { length: 255 }),
    status: etlJobStatusEnum('status').default('scheduled').notNull(),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    nextRunAt: timestamp('next_run_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('etl_jobs_code_uq').on(t.code),
    index('etl_jobs_source_idx').on(t.dataSourceId),
    index('etl_jobs_status_idx').on(t.status),
  ],
);

export const dataLoadLogs = analytics.table(
  'data_load_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => etlJobs.id, { onDelete: 'cascade' }),
    status: dataLoadStatusEnum('status').default('success').notNull(),
    rowsRead: integer('rows_read').default(0).notNull(),
    rowsLoaded: integer('rows_loaded').default(0).notNull(),
    rowsFailed: integer('rows_failed').default(0).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    errorMessage: text('error_message'),
    details: jsonb('details').$type<Record<string, unknown>>(),
    createdAt,
  },
  (t) => [
    index('data_load_logs_job_idx').on(t.jobId),
    index('data_load_logs_status_idx').on(t.status),
    index('data_load_logs_started_idx').on(t.startedAt),
  ],
);

/* ------------------------------------------------------------------ */
/* Data marts & reports                                                */
/* ------------------------------------------------------------------ */

export const dataMarts = analytics.table(
  'data_marts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    schemaName: varchar('schema_name', { length: 64 }).default('analytics').notNull(),
    tableName: varchar('table_name', { length: 128 }).notNull(),
    status: dataMartStatusEnum('status').default('draft').notNull(),
    refreshMode: refreshModeEnum('refresh_mode').default('manual').notNull(),
    lastRefreshedAt: timestamp('last_refreshed_at', { withTimezone: true }),
    definition: jsonb('definition').$type<Record<string, unknown>>(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('data_marts_code_uq').on(t.code),
    uniqueIndex('data_marts_table_uq').on(t.schemaName, t.tableName),
    index('data_marts_status_idx').on(t.status),
  ],
);

export const reportDefinitions = analytics.table(
  'report_definitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    dataMartId: uuid('data_mart_id').references(() => dataMarts.id, {
      onDelete: 'set null',
    }),
    category: varchar('category', { length: 64 }).default('general').notNull(),
    query: text('query'),
    parameters: jsonb('parameters').$type<Record<string, unknown>>(),
    format: reportFormatEnum('format').default('table').notNull(),
    status: reportDefinitionStatusEnum('status').default('draft').notNull(),
    version: integer('version').default(1).notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('report_definitions_code_uq').on(t.code),
    index('report_definitions_mart_idx').on(t.dataMartId),
    index('report_definitions_status_idx').on(t.status),
    index('report_definitions_category_idx').on(t.category),
  ],
);

export const reportRuns = analytics.table(
  'report_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reportId: uuid('report_id')
      .notNull()
      .references(() => reportDefinitions.id, { onDelete: 'cascade' }),
    runNumber: varchar('run_number', { length: 64 }).notNull(),
    requestedBy: uuid('requested_by').references(() => users.id, { onDelete: 'set null' }),
    parameters: jsonb('parameters').$type<Record<string, unknown>>(),
    status: reportRunStatusEnum('status').default('queued').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    rowCount: integer('row_count').default(0).notNull(),
    outputUrl: text('output_url'),
    errorMessage: text('error_message'),
    result: jsonb('result').$type<Record<string, unknown>>(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('report_runs_number_uq').on(t.runNumber),
    index('report_runs_report_idx').on(t.reportId),
    index('report_runs_status_idx').on(t.status),
    index('report_runs_created_idx').on(t.createdAt),
  ],
);

/* ------------------------------------------------------------------ */
/* Historical snapshots                                                */
/* ------------------------------------------------------------------ */

export const historicalSnapshots = analytics.table(
  'historical_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    snapshotKey: varchar('snapshot_key', { length: 128 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    entityType: varchar('entity_type', { length: 64 }).notNull(),
    entityId: uuid('entity_id'),
    snapshotDate: date('snapshot_date').notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().notNull(),
    rowCount: integer('row_count').default(0).notNull(),
    status: snapshotStatusEnum('status').default('active').notNull(),
    createdAt,
  },
  (t) => [
    uniqueIndex('historical_snapshots_key_uq').on(t.snapshotKey),
    index('historical_snapshots_entity_idx').on(t.entityType, t.entityId),
    index('historical_snapshots_date_idx').on(t.snapshotDate),
    index('historical_snapshots_status_idx').on(t.status),
  ],
);
