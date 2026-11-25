import { and, asc, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  dataLoadLogs,
  dataMarts,
  dataSources,
  etlJobs,
  historicalSnapshots,
  reportDefinitions,
  reportRuns,
} from '../../db/schema';
import { writeAuditLog } from '../../lib/audit';
import type { AppEnv } from '../../lib/app-env';
import { ApiError } from '../../lib/errors';
import { getPagination, ok, paginated } from '../../lib/http';
import { generateCode } from '../../lib/slug';
import { validate } from '../../lib/validator';
import { requireAuth, requirePermission } from '../../middleware/auth';
import { getClientIp } from '../../services/auth';

const codeSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[A-Za-z0-9_.-]+$/, 'Gunakan huruf, angka, titik, garis bawah, atau tanda hubung');
const optionalText = (max = 20000) => z.string().trim().max(max).optional().nullable();
const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Gunakan format YYYY-MM-DD');
const sourceTypeSchema = z.enum(['postgres', 'api', 'file', 'manual']);
const sourceStatusSchema = z.enum(['active', 'inactive', 'error']);
const jobTypeSchema = z.enum(['extract', 'transform', 'load', 'full', 'incremental']);
const jobStatusSchema = z.enum(['scheduled', 'running', 'completed', 'failed', 'paused']);
const loadStatusSchema = z.enum(['success', 'failed', 'partial']);
const martStatusSchema = z.enum(['draft', 'active', 'archived']);
const reportStatusSchema = z.enum(['draft', 'active', 'archived']);
const runStatusSchema = z.enum(['queued', 'running', 'completed', 'failed']);
const formatSchema = z.enum(['table', 'csv', 'json', 'pdf']);
const refreshModeSchema = z.enum(['manual', 'scheduled']);
const snapshotStatusSchema = z.enum(['active', 'archived']);

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
});

const createSourceSchema = z.object({
  code: codeSchema.optional(),
  name: z.string().trim().min(2).max(255),
  type: sourceTypeSchema.default('postgres'),
  description: optionalText(),
  connectionConfig: z.record(z.string(), z.unknown()).optional().nullable(),
  status: sourceStatusSchema.default('active'),
});
const updateSourceSchema = createSourceSchema.partial();

const createJobSchema = z.object({
  code: codeSchema.optional(),
  name: z.string().trim().min(2).max(255),
  dataSourceId: z.uuid().optional().nullable(),
  type: jobTypeSchema.default('full'),
  schedule: z.string().trim().max(64).optional().nullable(),
  sourceQuery: optionalText(),
  targetTable: z.string().trim().max(255).optional().nullable(),
  status: jobStatusSchema.default('scheduled'),
  nextRunAt: z.coerce.date().optional().nullable(),
});
const updateJobSchema = createJobSchema.partial();

const createMartSchema = z.object({
  code: codeSchema.optional(),
  name: z.string().trim().min(2).max(255),
  description: optionalText(),
  schemaName: z.string().trim().max(64).default('analytics'),
  tableName: z.string().trim().min(2).max(128),
  status: martStatusSchema.default('draft'),
  refreshMode: refreshModeSchema.default('manual'),
  definition: z.record(z.string(), z.unknown()).optional().nullable(),
});
const updateMartSchema = createMartSchema.partial();

const createReportSchema = z.object({
  code: codeSchema.optional(),
  name: z.string().trim().min(2).max(255),
  description: optionalText(),
  dataMartId: z.uuid().optional().nullable(),
  category: z.string().trim().max(64).default('general'),
  query: optionalText(),
  parameters: z.record(z.string(), z.unknown()).optional().nullable(),
  format: formatSchema.default('table'),
  status: reportStatusSchema.default('draft'),
});
const updateReportSchema = createReportSchema.partial();

const runReportSchema = z.object({
  parameters: z.record(z.string(), z.unknown()).optional().nullable(),
});

const createSnapshotSchema = z.object({
  snapshotKey: z.string().trim().max(128).optional(),
  name: z.string().trim().min(2).max(255),
  entityType: z.string().trim().min(1).max(64),
  entityId: z.uuid().optional().nullable(),
  snapshotDate: dateOnlySchema,
  data: z.record(z.string(), z.unknown()),
  rowCount: z.coerce.number().int().min(0).default(0),
});
const updateSnapshotSchema = z.object({
  name: z.string().trim().min(2).max(255).optional(),
  status: snapshotStatusSchema.optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  rowCount: z.coerce.number().int().min(0).optional(),
});

export const analyticsRoutes = new Hono<AppEnv>();
analyticsRoutes.use('*', requireAuth);

function audit(
  c: Context<AppEnv>,
  action: string,
  entityType: string,
  entityId: string,
  values?: { oldValues?: Record<string, unknown>; newValues?: Record<string, unknown> },
) {
  return writeAuditLog({
    actorUserId: c.get('user').id,
    action,
    entityType,
    entityId,
    oldValues: values?.oldValues ?? null,
    newValues: values?.newValues ?? null,
    ipAddress: getClientIp(c),
    userAgent: c.req.header('user-agent') ?? null,
  });
}

/* ----------------------------- Data sources --------------------------- */

analyticsRoutes.get(
  '/data-sources',
  requirePermission('analytics:read'),
  validate('query', listSchema.extend({ type: sourceTypeSchema.optional(), status: sourceStatusSchema.optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.type) conditions.push(eq(dataSources.type, query.type));
    if (query.status) conditions.push(eq(dataSources.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(ilike(dataSources.code, term), ilike(dataSources.name, term)) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: dataSources.id,
          code: dataSources.code,
          name: dataSources.name,
          type: dataSources.type,
          description: dataSources.description,
          status: dataSources.status,
          lastCheckedAt: dataSources.lastCheckedAt,
          createdAt: dataSources.createdAt,
        })
        .from(dataSources)
        .where(where)
        .orderBy(asc(dataSources.name))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(dataSources).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

analyticsRoutes.post(
  '/data-sources',
  requirePermission('analytics:write'),
  validate('json', createSourceSchema),
  async (c) => {
    const body = c.req.valid('json');
    const [created] = await db
      .insert(dataSources)
      .values({
        ...body,
        code: body.code ?? generateCode('SRC').toLowerCase(),
        connectionConfig: body.connectionConfig ?? null,
        createdBy: c.get('user').id,
      })
      .returning();
    await audit(c, 'analytics.source.create', 'data_source', created!.id);
    return ok(c, created!, 201);
  },
);

analyticsRoutes.patch(
  '/data-sources/:id',
  requirePermission('analytics:write'),
  validate('json', updateSourceSchema),
  async (c) => {
    const body = c.req.valid('json');
    const row = await db.query.dataSources.findFirst({
      where: eq(dataSources.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Sumber data tidak ditemukan');
    const [updated] = await db
      .update(dataSources)
      .set({ ...body })
      .where(eq(dataSources.id, row.id))
      .returning();
    await audit(c, 'analytics.source.update', 'data_source', row.id);
    return ok(c, updated!);
  },
);

analyticsRoutes.delete(
  '/data-sources/:id',
  requirePermission('analytics:manage'),
  async (c) => {
    const row = await db.query.dataSources.findFirst({
      where: eq(dataSources.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Sumber data tidak ditemukan');
    await db.delete(dataSources).where(eq(dataSources.id, row.id));
    await audit(c, 'analytics.source.delete', 'data_source', row.id);
    return ok(c, { id: row.id, deleted: true });
  },
);

/* -------------------------------- ETL jobs ---------------------------- */

analyticsRoutes.get(
  '/etl-jobs',
  requirePermission('analytics:read'),
  validate('query', listSchema.extend({ status: jobStatusSchema.optional(), type: jobTypeSchema.optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.status) conditions.push(eq(etlJobs.status, query.status));
    if (query.type) conditions.push(eq(etlJobs.type, query.type));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(or(ilike(etlJobs.code, term), ilike(etlJobs.name, term)) as SQL);
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: etlJobs.id,
          code: etlJobs.code,
          name: etlJobs.name,
          dataSourceId: etlJobs.dataSourceId,
          dataSourceName: dataSources.name,
          type: etlJobs.type,
          schedule: etlJobs.schedule,
          targetTable: etlJobs.targetTable,
          status: etlJobs.status,
          lastRunAt: etlJobs.lastRunAt,
          nextRunAt: etlJobs.nextRunAt,
          createdAt: etlJobs.createdAt,
        })
        .from(etlJobs)
        .leftJoin(dataSources, eq(dataSources.id, etlJobs.dataSourceId))
        .where(where)
        .orderBy(asc(etlJobs.name))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(etlJobs).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

analyticsRoutes.post(
  '/etl-jobs',
  requirePermission('analytics:write'),
  validate('json', createJobSchema),
  async (c) => {
    const body = c.req.valid('json');
    if (body.dataSourceId) {
      const source = await db.query.dataSources.findFirst({
        where: eq(dataSources.id, body.dataSourceId),
      });
      if (!source) throw ApiError.notFound('Sumber data tidak ditemukan');
    }
    const [created] = await db
      .insert(etlJobs)
      .values({
        ...body,
        code: body.code ?? generateCode('ETL').toLowerCase(),
        dataSourceId: body.dataSourceId ?? null,
        schedule: body.schedule ?? null,
        sourceQuery: body.sourceQuery ?? null,
        targetTable: body.targetTable ?? null,
        nextRunAt: body.nextRunAt ?? null,
        createdBy: c.get('user').id,
      })
      .returning();
    await audit(c, 'analytics.etl.create', 'etl_job', created!.id);
    return ok(c, created!, 201);
  },
);

analyticsRoutes.patch(
  '/etl-jobs/:id',
  requirePermission('analytics:write'),
  validate('json', updateJobSchema),
  async (c) => {
    const body = c.req.valid('json');
    const row = await db.query.etlJobs.findFirst({ where: eq(etlJobs.id, c.req.param('id')) });
    if (!row) throw ApiError.notFound('Job ETL tidak ditemukan');
    const [updated] = await db
      .update(etlJobs)
      .set({ ...body })
      .where(eq(etlJobs.id, row.id))
      .returning();
    await audit(c, 'analytics.etl.update', 'etl_job', row.id);
    return ok(c, updated!);
  },
);

analyticsRoutes.post(
  '/etl-jobs/:id/run',
  requirePermission('analytics:write'),
  async (c) => {
    const row = await db.query.etlJobs.findFirst({ where: eq(etlJobs.id, c.req.param('id')) });
    if (!row) throw ApiError.notFound('Job ETL tidak ditemukan');
    if (row.status === 'running') throw ApiError.badRequest('Job ETL sedang berjalan');
    const now = new Date();
    const rowsRead = 120 + Math.floor(Math.random() * 400);
    const rowsFailed = Math.floor(Math.random() * 4);
    const [updated] = await db
      .update(etlJobs)
      .set({ status: 'completed', lastRunAt: now })
      .where(eq(etlJobs.id, row.id))
      .returning();
    const [log] = await db
      .insert(dataLoadLogs)
      .values({
        jobId: row.id,
        status: rowsFailed > 0 ? 'partial' : 'success',
        rowsRead,
        rowsLoaded: rowsRead - rowsFailed,
        rowsFailed,
        startedAt: now,
        finishedAt: new Date(),
        details: { simulated: true },
      })
      .returning();
    await audit(c, 'analytics.etl.run', 'etl_job', row.id, {
      newValues: { rowsRead, rowsFailed },
    });
    return ok(c, { job: updated, log });
  },
);

analyticsRoutes.delete(
  '/etl-jobs/:id',
  requirePermission('analytics:manage'),
  async (c) => {
    const row = await db.query.etlJobs.findFirst({ where: eq(etlJobs.id, c.req.param('id')) });
    if (!row) throw ApiError.notFound('Job ETL tidak ditemukan');
    await db.delete(etlJobs).where(eq(etlJobs.id, row.id));
    await audit(c, 'analytics.etl.delete', 'etl_job', row.id);
    return ok(c, { id: row.id, deleted: true });
  },
);

analyticsRoutes.get(
  '/load-logs',
  requirePermission('analytics:read'),
  validate('query', listSchema.extend({ jobId: z.uuid().optional(), status: loadStatusSchema.optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.jobId) conditions.push(eq(dataLoadLogs.jobId, query.jobId));
    if (query.status) conditions.push(eq(dataLoadLogs.status, query.status));
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: dataLoadLogs.id,
          jobId: dataLoadLogs.jobId,
          jobName: etlJobs.name,
          status: dataLoadLogs.status,
          rowsRead: dataLoadLogs.rowsRead,
          rowsLoaded: dataLoadLogs.rowsLoaded,
          rowsFailed: dataLoadLogs.rowsFailed,
          startedAt: dataLoadLogs.startedAt,
          finishedAt: dataLoadLogs.finishedAt,
          errorMessage: dataLoadLogs.errorMessage,
          createdAt: dataLoadLogs.createdAt,
        })
        .from(dataLoadLogs)
        .innerJoin(etlJobs, eq(etlJobs.id, dataLoadLogs.jobId))
        .where(where)
        .orderBy(desc(dataLoadLogs.startedAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(dataLoadLogs)
        .innerJoin(etlJobs, eq(etlJobs.id, dataLoadLogs.jobId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

/* ------------------------------- Data marts --------------------------- */

analyticsRoutes.get(
  '/data-marts',
  requirePermission('analytics:read'),
  validate('query', listSchema.extend({ status: martStatusSchema.optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.status) conditions.push(eq(dataMarts.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(or(ilike(dataMarts.code, term), ilike(dataMarts.name, term)) as SQL);
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(dataMarts)
        .where(where)
        .orderBy(asc(dataMarts.name))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(dataMarts).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

analyticsRoutes.post(
  '/data-marts',
  requirePermission('analytics:write'),
  validate('json', createMartSchema),
  async (c) => {
    const body = c.req.valid('json');
    const [created] = await db
      .insert(dataMarts)
      .values({
        ...body,
        code: body.code ?? generateCode('MART').toLowerCase(),
        definition: body.definition ?? null,
      })
      .returning();
    await audit(c, 'analytics.mart.create', 'data_mart', created!.id);
    return ok(c, created!, 201);
  },
);

analyticsRoutes.patch(
  '/data-marts/:id',
  requirePermission('analytics:write'),
  validate('json', updateMartSchema),
  async (c) => {
    const body = c.req.valid('json');
    const row = await db.query.dataMarts.findFirst({ where: eq(dataMarts.id, c.req.param('id')) });
    if (!row) throw ApiError.notFound('Data mart tidak ditemukan');
    const [updated] = await db
      .update(dataMarts)
      .set({ ...body })
      .where(eq(dataMarts.id, row.id))
      .returning();
    await audit(c, 'analytics.mart.update', 'data_mart', row.id);
    return ok(c, updated!);
  },
);

analyticsRoutes.post(
  '/data-marts/:id/refresh',
  requirePermission('analytics:write'),
  async (c) => {
    const row = await db.query.dataMarts.findFirst({ where: eq(dataMarts.id, c.req.param('id')) });
    if (!row) throw ApiError.notFound('Data mart tidak ditemukan');
    const [updated] = await db
      .update(dataMarts)
      .set({ lastRefreshedAt: new Date(), status: 'active' })
      .where(eq(dataMarts.id, row.id))
      .returning();
    await audit(c, 'analytics.mart.refresh', 'data_mart', row.id);
    return ok(c, updated!);
  },
);

analyticsRoutes.delete(
  '/data-marts/:id',
  requirePermission('analytics:manage'),
  async (c) => {
    const row = await db.query.dataMarts.findFirst({ where: eq(dataMarts.id, c.req.param('id')) });
    if (!row) throw ApiError.notFound('Data mart tidak ditemukan');
    await db.delete(dataMarts).where(eq(dataMarts.id, row.id));
    await audit(c, 'analytics.mart.delete', 'data_mart', row.id);
    return ok(c, { id: row.id, deleted: true });
  },
);

/* ---------------------------- Report definitions ---------------------- */

analyticsRoutes.get(
  '/reports',
  requirePermission('analytics:read'),
  validate('query', listSchema.extend({ status: reportStatusSchema.optional(), category: z.string().max(64).optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.status) conditions.push(eq(reportDefinitions.status, query.status));
    if (query.category) conditions.push(eq(reportDefinitions.category, query.category));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(reportDefinitions.code, term),
          ilike(reportDefinitions.name, term),
          ilike(reportDefinitions.category, term),
        ) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: reportDefinitions.id,
          code: reportDefinitions.code,
          name: reportDefinitions.name,
          description: reportDefinitions.description,
          dataMartId: reportDefinitions.dataMartId,
          dataMartName: dataMarts.name,
          category: reportDefinitions.category,
          format: reportDefinitions.format,
          status: reportDefinitions.status,
          version: reportDefinitions.version,
          createdAt: reportDefinitions.createdAt,
        })
        .from(reportDefinitions)
        .leftJoin(dataMarts, eq(dataMarts.id, reportDefinitions.dataMartId))
        .where(where)
        .orderBy(asc(reportDefinitions.name))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(reportDefinitions).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

analyticsRoutes.post(
  '/reports',
  requirePermission('analytics:write'),
  validate('json', createReportSchema),
  async (c) => {
    const body = c.req.valid('json');
    if (body.dataMartId) {
      const mart = await db.query.dataMarts.findFirst({
        where: eq(dataMarts.id, body.dataMartId),
      });
      if (!mart) throw ApiError.notFound('Data mart tidak ditemukan');
    }
    const [created] = await db
      .insert(reportDefinitions)
      .values({
        ...body,
        code: body.code ?? generateCode('RPT').toLowerCase(),
        dataMartId: body.dataMartId ?? null,
        query: body.query ?? null,
        parameters: body.parameters ?? null,
        createdBy: c.get('user').id,
      })
      .returning();
    await audit(c, 'analytics.report.create', 'report_definition', created!.id);
    return ok(c, created!, 201);
  },
);

analyticsRoutes.patch(
  '/reports/:id',
  requirePermission('analytics:write'),
  validate('json', updateReportSchema),
  async (c) => {
    const body = c.req.valid('json');
    const row = await db.query.reportDefinitions.findFirst({
      where: eq(reportDefinitions.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Definisi laporan tidak ditemukan');
    const [updated] = await db
      .update(reportDefinitions)
      .set({ ...body, version: row.version + 1 })
      .where(eq(reportDefinitions.id, row.id))
      .returning();
    await audit(c, 'analytics.report.update', 'report_definition', row.id);
    return ok(c, updated!);
  },
);

analyticsRoutes.delete(
  '/reports/:id',
  requirePermission('analytics:manage'),
  async (c) => {
    const row = await db.query.reportDefinitions.findFirst({
      where: eq(reportDefinitions.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Definisi laporan tidak ditemukan');
    await db.delete(reportDefinitions).where(eq(reportDefinitions.id, row.id));
    await audit(c, 'analytics.report.delete', 'report_definition', row.id);
    return ok(c, { id: row.id, deleted: true });
  },
);

analyticsRoutes.post(
  '/reports/:id/run',
  requirePermission('analytics:write'),
  validate('json', runReportSchema),
  async (c) => {
    const body = c.req.valid('json');
    const definition = await db.query.reportDefinitions.findFirst({
      where: eq(reportDefinitions.id, c.req.param('id')),
    });
    if (!definition) throw ApiError.notFound('Definisi laporan tidak ditemukan');
    if (definition.status === 'archived') throw ApiError.badRequest('Laporan sudah diarsipkan');
    const now = new Date();
    const [run] = await db
      .insert(reportRuns)
      .values({
        reportId: definition.id,
        runNumber: generateCode('RUN'),
        requestedBy: c.get('user').id,
        parameters: body.parameters ?? null,
        status: 'completed',
        startedAt: now,
        completedAt: now,
        rowCount: 12,
        result: {
          columns: ['kategori', 'jumlah', 'nilai'],
          rows: [
            { kategori: 'Penjualan', jumlah: 42, nilai: 12500000 },
            { kategori: 'Pembayaran', jumlah: 38, nilai: 11800000 },
          ],
          simulated: true,
        },
      })
      .returning();
    await audit(c, 'analytics.report.run', 'report_run', run!.id, {
      newValues: { reportId: definition.id, rowCount: run!.rowCount },
    });
    return ok(c, run!, 201);
  },
);

analyticsRoutes.get(
  '/report-runs',
  requirePermission('analytics:read'),
  validate('query', listSchema.extend({ reportId: z.uuid().optional(), status: runStatusSchema.optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.reportId) conditions.push(eq(reportRuns.reportId, query.reportId));
    if (query.status) conditions.push(eq(reportRuns.status, query.status));
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: reportRuns.id,
          reportId: reportRuns.reportId,
          reportName: reportDefinitions.name,
          runNumber: reportRuns.runNumber,
          requestedBy: reportRuns.requestedBy,
          status: reportRuns.status,
          startedAt: reportRuns.startedAt,
          completedAt: reportRuns.completedAt,
          rowCount: reportRuns.rowCount,
          outputUrl: reportRuns.outputUrl,
          errorMessage: reportRuns.errorMessage,
          createdAt: reportRuns.createdAt,
        })
        .from(reportRuns)
        .innerJoin(reportDefinitions, eq(reportDefinitions.id, reportRuns.reportId))
        .where(where)
        .orderBy(desc(reportRuns.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(reportRuns)
        .innerJoin(reportDefinitions, eq(reportDefinitions.id, reportRuns.reportId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

analyticsRoutes.get(
  '/report-runs/:id',
  requirePermission('analytics:read'),
  async (c) => {
    const row = await db.query.reportRuns.findFirst({
      where: eq(reportRuns.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Eksekusi laporan tidak ditemukan');
    return ok(c, row);
  },
);

/* --------------------------- Historical snapshots --------------------- */

analyticsRoutes.get(
  '/snapshots',
  requirePermission('analytics:read'),
  validate('query', listSchema.extend({ entityType: z.string().max(64).optional(), status: snapshotStatusSchema.optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.entityType) conditions.push(eq(historicalSnapshots.entityType, query.entityType));
    if (query.status) conditions.push(eq(historicalSnapshots.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(historicalSnapshots.name, term),
          ilike(historicalSnapshots.snapshotKey, term),
        ) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(historicalSnapshots)
        .where(where)
        .orderBy(desc(historicalSnapshots.snapshotDate))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(historicalSnapshots).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

analyticsRoutes.post(
  '/snapshots',
  requirePermission('analytics:write'),
  validate('json', createSnapshotSchema),
  async (c) => {
    const body = c.req.valid('json');
    const [created] = await db
      .insert(historicalSnapshots)
      .values({
        ...body,
        snapshotKey: body.snapshotKey ?? generateCode('SNP').toLowerCase(),
        entityId: body.entityId ?? null,
      })
      .returning();
    await audit(c, 'analytics.snapshot.create', 'historical_snapshot', created!.id);
    return ok(c, created!, 201);
  },
);

analyticsRoutes.patch(
  '/snapshots/:id',
  requirePermission('analytics:write'),
  validate('json', updateSnapshotSchema),
  async (c) => {
    const body = c.req.valid('json');
    const row = await db.query.historicalSnapshots.findFirst({
      where: eq(historicalSnapshots.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Snapshot historis tidak ditemukan');
    const [updated] = await db
      .update(historicalSnapshots)
      .set({ ...body })
      .where(eq(historicalSnapshots.id, row.id))
      .returning();
    await audit(c, 'analytics.snapshot.update', 'historical_snapshot', row.id);
    return ok(c, updated!);
  },
);

analyticsRoutes.delete(
  '/snapshots/:id',
  requirePermission('analytics:manage'),
  async (c) => {
    const row = await db.query.historicalSnapshots.findFirst({
      where: eq(historicalSnapshots.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Snapshot historis tidak ditemukan');
    await db.delete(historicalSnapshots).where(eq(historicalSnapshots.id, row.id));
    await audit(c, 'analytics.snapshot.delete', 'historical_snapshot', row.id);
    return ok(c, { id: row.id, deleted: true });
  },
);
