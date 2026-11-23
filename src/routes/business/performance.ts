import { and, asc, count, desc, eq, gte, ilike, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  businessKpiValues,
  businessKpis,
  businessTargets,
  growthSnapshots,
  merchantPerformanceReports,
  merchants,
  orders,
  performancePeriods,
  products,
} from '../../db/schema';
import { writeAuditLog } from '../../lib/audit';
import type { AppEnv } from '../../lib/app-env';
import { ApiError } from '../../lib/errors';
import { getPagination, ok, paginated } from '../../lib/http';
import { generateCode } from '../../lib/slug';
import { validate } from '../../lib/validator';
import { requirePermission } from '../../middleware/auth';
import { getClientIp } from '../../services/auth';
import {
  assertBusinessAccess,
  businessScopeCondition,
  computeAchievement,
  dateOnlySchema,
  getBusinessKpi,
  getBusinessTarget,
  getPerformancePeriod,
  getPerformanceReport,
  numericSchema,
  optionalText,
  toNumber,
} from './shared';

const periodTypeSchema = z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']);
const periodStatusSchema = z.enum(['open', 'closed']);
const kpiCategorySchema = z.enum([
  'revenue',
  'transaction',
  'customer',
  'product',
  'margin',
  'growth',
  'operational',
  'other',
]);
const kpiValueTypeSchema = z.enum(['currency', 'number', 'percentage', 'ratio']);
const kpiDirectionSchema = z.enum(['higher_better', 'lower_better']);
const reportStatusSchema = z.enum(['draft', 'published']);
const targetStatusSchema = z.enum(['active', 'achieved', 'missed', 'cancelled']);
const codeSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'Gunakan huruf, angka, garis bawah, atau tanda hubung');

const listPeriodSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  status: periodStatusSchema.optional(),
  type: periodTypeSchema.optional(),
});

const createPeriodSchema = z.object({
  merchantId: z.uuid(),
  code: codeSchema.optional(),
  name: z.string().trim().min(2).max(128),
  type: periodTypeSchema.default('monthly'),
  startDate: dateOnlySchema,
  endDate: dateOnlySchema,
  status: periodStatusSchema.default('open'),
  notes: optionalText(),
});

const updatePeriodSchema = createPeriodSchema.omit({ merchantId: true }).partial();

const listKpiSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  category: kpiCategorySchema.optional(),
  active: z.enum(['true', 'false']).optional(),
});

const createKpiSchema = z.object({
  merchantId: z.uuid(),
  code: codeSchema.optional(),
  name: z.string().trim().min(2).max(128),
  description: optionalText(),
  category: kpiCategorySchema.default('other'),
  valueType: kpiValueTypeSchema.default('number'),
  unit: z.string().trim().max(32).optional(),
  direction: kpiDirectionSchema.default('higher_better'),
  formula: optionalText(),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

const updateKpiSchema = createKpiSchema.omit({ merchantId: true }).partial();

const listKpiValueSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  merchantId: z.uuid().optional(),
  kpiId: z.uuid().optional(),
  periodId: z.uuid().optional(),
});

const kpiValueInputSchema = z.object({
  kpiId: z.uuid(),
  periodId: z.uuid(),
  value: numericSchema.default('0'),
  targetValue: numericSchema.optional(),
  previousValue: numericSchema.optional(),
  notes: optionalText(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const updateKpiValueSchema = z.object({
  value: numericSchema.optional(),
  targetValue: numericSchema.nullable().optional(),
  previousValue: numericSchema.nullable().optional(),
  notes: optionalText(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

const listTargetSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  periodId: z.uuid().optional(),
  status: targetStatusSchema.optional(),
});

const createTargetSchema = z.object({
  merchantId: z.uuid(),
  periodId: z.uuid().optional(),
  kpiId: z.uuid().optional(),
  name: z.string().trim().min(2).max(255),
  targetValue: numericSchema,
  actualValue: numericSchema.default('0'),
  unit: z.string().trim().max(32).optional(),
  startDate: dateOnlySchema.optional(),
  endDate: dateOnlySchema.optional(),
  status: targetStatusSchema.default('active'),
  notes: optionalText(),
});

const updateTargetSchema = createTargetSchema.omit({ merchantId: true }).partial();

const listSnapshotSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  merchantId: z.uuid().optional(),
  periodId: z.uuid().optional(),
  metricType: z.string().trim().max(64).optional(),
});

const snapshotInputSchema = z.object({
  merchantId: z.uuid(),
  periodId: z.uuid(),
  snapshotDate: dateOnlySchema,
  metricType: z.string().trim().min(2).max(64),
  currentValue: numericSchema.default('0'),
  previousValue: numericSchema.optional(),
  growthPercent: z.coerce.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const updateSnapshotSchema = snapshotInputSchema
  .omit({ merchantId: true, periodId: true, metricType: true })
  .partial();

const listReportSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  periodId: z.uuid().optional(),
  status: reportStatusSchema.optional(),
});

const generateReportSchema = z.object({
  merchantId: z.uuid(),
  periodId: z.uuid(),
  title: z.string().trim().min(2).max(255).optional(),
  summary: optionalText(),
});

const createReportSchema = generateReportSchema.extend({
  revenue: numericSchema.default('0'),
  orderCount: z.coerce.number().int().min(0).default(0),
  customerCount: z.coerce.number().int().min(0).default(0),
  productCount: z.coerce.number().int().min(0).default(0),
  grossMargin: numericSchema.optional(),
  growthPercent: z.coerce.number().optional(),
  score: z.coerce.number().optional(),
  status: reportStatusSchema.default('draft'),
  data: z.record(z.string(), z.unknown()).optional(),
});

const updateReportSchema = createReportSchema
  .omit({ merchantId: true, periodId: true })
  .partial();

export const businessPerformanceRoutes = new Hono<AppEnv>();

function assertDateRange(start: string, end: string) {
  if (new Date(start) > new Date(end)) {
    throw ApiError.badRequest('Tanggal mulai tidak boleh setelah tanggal akhir');
  }
}

/* ----------------------------- Periods ------------------------------ */

businessPerformanceRoutes.get(
  '/performance-periods',
  requirePermission('business:read'),
  validate('query', listPeriodSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = businessScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(performancePeriods.merchantId, query.merchantId));
    if (query.status) conditions.push(eq(performancePeriods.status, query.status));
    if (query.type) conditions.push(eq(performancePeriods.type, query.type));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(performancePeriods.code, term),
          ilike(performancePeriods.name, term),
          ilike(merchants.businessName, term),
        ) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: performancePeriods.id,
          merchantId: performancePeriods.merchantId,
          merchantName: merchants.businessName,
          code: performancePeriods.code,
          name: performancePeriods.name,
          type: performancePeriods.type,
          startDate: performancePeriods.startDate,
          endDate: performancePeriods.endDate,
          status: performancePeriods.status,
          notes: performancePeriods.notes,
          createdAt: performancePeriods.createdAt,
        })
        .from(performancePeriods)
        .innerJoin(merchants, eq(merchants.id, performancePeriods.merchantId))
        .where(where)
        .orderBy(desc(performancePeriods.startDate), desc(performancePeriods.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(performancePeriods)
        .innerJoin(merchants, eq(merchants.id, performancePeriods.merchantId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

businessPerformanceRoutes.post(
  '/performance-periods',
  requirePermission('business:write'),
  validate('json', createPeriodSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    await assertBusinessAccess(body.merchantId, user, c.get('permissions'), { manage: true });
    assertDateRange(body.startDate, body.endDate);
    const code = body.code ?? generateCode('PER');
    const [existing] = await db
      .select({ id: performancePeriods.id })
      .from(performancePeriods)
      .where(
        and(
          eq(performancePeriods.merchantId, body.merchantId),
          eq(performancePeriods.code, code),
        ),
      )
      .limit(1);
    if (existing) throw ApiError.conflict('Kode periode sudah digunakan');
    const [created] = await db
      .insert(performancePeriods)
      .values({
        merchantId: body.merchantId,
        code,
        name: body.name,
        type: body.type,
        startDate: body.startDate,
        endDate: body.endDate,
        status: body.status,
        notes: body.notes ?? null,
        createdBy: user.id,
      })
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'business.performance.period.create',
      entityType: 'performance_period',
      entityId: created!.id,
      newValues: { code: created!.code, name: created!.name },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created!, 201);
  },
);

businessPerformanceRoutes.patch(
  '/performance-periods/:id',
  requirePermission('business:write'),
  validate('json', updatePeriodSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { period } = await getPerformancePeriod(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (body.startDate || body.endDate) {
      assertDateRange(body.startDate ?? period.startDate, body.endDate ?? period.endDate);
    }
    const [updated] = await db
      .update(performancePeriods)
      .set({
        ...body,
        notes: body.notes ?? undefined,
        code: body.code ?? undefined,
      })
      .where(eq(performancePeriods.id, period.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'business.performance.period.update',
      entityType: 'performance_period',
      entityId: period.id,
      oldValues: { code: period.code, status: period.status },
      newValues: { code: updated!.code, status: updated!.status },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

businessPerformanceRoutes.delete(
  '/performance-periods/:id',
  requirePermission('business:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { period } = await getPerformancePeriod(c.req.param('id'), user, permissions, {
      manage: true,
    });
    await db.delete(performancePeriods).where(eq(performancePeriods.id, period.id));
    await writeAuditLog({
      actorUserId: user.id,
      action: 'business.performance.period.delete',
      entityType: 'performance_period',
      entityId: period.id,
      oldValues: { code: period.code, name: period.name },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, { id: period.id, deleted: true });
  },
);

/* -------------------------------- KPI ------------------------------- */

businessPerformanceRoutes.get(
  '/kpis',
  requirePermission('business:read'),
  validate('query', listKpiSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = businessScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(businessKpis.merchantId, query.merchantId));
    if (query.category) conditions.push(eq(businessKpis.category, query.category));
    if (query.active) conditions.push(eq(businessKpis.isActive, query.active === 'true'));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(businessKpis.code, term),
          ilike(businessKpis.name, term),
          ilike(merchants.businessName, term),
        ) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: businessKpis.id,
          merchantId: businessKpis.merchantId,
          merchantName: merchants.businessName,
          code: businessKpis.code,
          name: businessKpis.name,
          category: businessKpis.category,
          valueType: businessKpis.valueType,
          unit: businessKpis.unit,
          direction: businessKpis.direction,
          isActive: businessKpis.isActive,
          sortOrder: businessKpis.sortOrder,
          createdAt: businessKpis.createdAt,
        })
        .from(businessKpis)
        .innerJoin(merchants, eq(merchants.id, businessKpis.merchantId))
        .where(where)
        .orderBy(asc(businessKpis.sortOrder), asc(businessKpis.name))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(businessKpis)
        .innerJoin(merchants, eq(merchants.id, businessKpis.merchantId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

businessPerformanceRoutes.post(
  '/kpis',
  requirePermission('business:write'),
  validate('json', createKpiSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    await assertBusinessAccess(body.merchantId, user, c.get('permissions'), { manage: true });
    const code = body.code ?? generateCode('KPI');
    const [existing] = await db
      .select({ id: businessKpis.id })
      .from(businessKpis)
      .where(and(eq(businessKpis.merchantId, body.merchantId), eq(businessKpis.code, code)))
      .limit(1);
    if (existing) throw ApiError.conflict('Kode KPI sudah digunakan');
    const [created] = await db
      .insert(businessKpis)
      .values({
        merchantId: body.merchantId,
        code,
        name: body.name,
        description: body.description ?? null,
        category: body.category,
        valueType: body.valueType,
        unit: body.unit ?? null,
        direction: body.direction,
        formula: body.formula ?? null,
        isActive: body.isActive,
        sortOrder: body.sortOrder,
      })
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'business.performance.kpi.create',
      entityType: 'business_kpi',
      entityId: created!.id,
      newValues: { code: created!.code, name: created!.name },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created!, 201);
  },
);

businessPerformanceRoutes.patch(
  '/kpis/:id',
  requirePermission('business:write'),
  validate('json', updateKpiSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { kpi } = await getBusinessKpi(c.req.param('id'), user, permissions, { manage: true });
    const [updated] = await db
      .update(businessKpis)
      .set({
        ...body,
        description: body.description ?? undefined,
        unit: body.unit ?? undefined,
        formula: body.formula ?? undefined,
        code: body.code ?? undefined,
      })
      .where(eq(businessKpis.id, kpi.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'business.performance.kpi.update',
      entityType: 'business_kpi',
      entityId: kpi.id,
      oldValues: { code: kpi.code, isActive: kpi.isActive },
      newValues: { code: updated!.code, isActive: updated!.isActive },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

businessPerformanceRoutes.delete(
  '/kpis/:id',
  requirePermission('business:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { kpi } = await getBusinessKpi(c.req.param('id'), user, permissions, { manage: true });
    await db.delete(businessKpis).where(eq(businessKpis.id, kpi.id));
    await writeAuditLog({
      actorUserId: user.id,
      action: 'business.performance.kpi.delete',
      entityType: 'business_kpi',
      entityId: kpi.id,
      oldValues: { code: kpi.code, name: kpi.name },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, { id: kpi.id, deleted: true });
  },
);

/* ---------------------------- KPI Values ---------------------------- */

businessPerformanceRoutes.get(
  '/kpi-values',
  requirePermission('business:read'),
  validate('query', listKpiValueSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = businessScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(businessKpiValues.merchantId, query.merchantId));
    if (query.kpiId) conditions.push(eq(businessKpiValues.kpiId, query.kpiId));
    if (query.periodId) conditions.push(eq(businessKpiValues.periodId, query.periodId));
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: businessKpiValues.id,
          merchantId: businessKpiValues.merchantId,
          merchantName: merchants.businessName,
          kpiId: businessKpiValues.kpiId,
          kpiName: businessKpis.name,
          kpiCode: businessKpis.code,
          unit: businessKpis.unit,
          valueType: businessKpis.valueType,
          periodId: businessKpiValues.periodId,
          periodName: performancePeriods.name,
          value: businessKpiValues.value,
          targetValue: businessKpiValues.targetValue,
          previousValue: businessKpiValues.previousValue,
          achievementPercent: businessKpiValues.achievementPercent,
          calculatedAt: businessKpiValues.calculatedAt,
          createdAt: businessKpiValues.createdAt,
        })
        .from(businessKpiValues)
        .innerJoin(merchants, eq(merchants.id, businessKpiValues.merchantId))
        .innerJoin(businessKpis, eq(businessKpis.id, businessKpiValues.kpiId))
        .innerJoin(performancePeriods, eq(performancePeriods.id, businessKpiValues.periodId))
        .where(where)
        .orderBy(desc(performancePeriods.startDate), asc(businessKpis.name))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(businessKpiValues)
        .innerJoin(merchants, eq(merchants.id, businessKpiValues.merchantId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

businessPerformanceRoutes.post(
  '/kpi-values',
  requirePermission('business:write'),
  validate('json', kpiValueInputSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { kpi } = await getBusinessKpi(body.kpiId, user, permissions, { manage: true });
    const { period } = await getPerformancePeriod(body.periodId, user, permissions);
    if (kpi.merchantId !== period.merchantId) {
      throw ApiError.badRequest('KPI dan periode berasal dari merchant berbeda');
    }
    const achievement = computeAchievement(body.value, body.targetValue, kpi.direction);
    const [created] = await db
      .insert(businessKpiValues)
      .values({
        merchantId: kpi.merchantId,
        kpiId: kpi.id,
        periodId: period.id,
        value: body.value,
        targetValue: body.targetValue ?? null,
        previousValue: body.previousValue ?? null,
        achievementPercent: achievement,
        notes: body.notes ?? null,
        metadata: body.metadata ?? null,
      })
      .onConflictDoUpdate({
        target: [businessKpiValues.kpiId, businessKpiValues.periodId],
        set: {
          value: body.value,
          targetValue: body.targetValue ?? null,
          previousValue: body.previousValue ?? null,
          achievementPercent: achievement,
          notes: body.notes ?? null,
          metadata: body.metadata ?? null,
          calculatedAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'business.performance.kpi_value.upsert',
      entityType: 'business_kpi_value',
      entityId: created!.id,
      newValues: { kpiId: kpi.id, periodId: period.id, value: created!.value },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created!, 201);
  },
);

businessPerformanceRoutes.patch(
  '/kpi-values/:id',
  requirePermission('business:write'),
  validate('json', updateKpiValueSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const row = await db.query.businessKpiValues.findFirst({
      where: eq(businessKpiValues.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Nilai KPI tidak ditemukan');
    await assertBusinessAccess(row.merchantId, user, permissions, { manage: true });
    const { kpi } = await getBusinessKpi(row.kpiId, user, permissions);
    const value = body.value ?? row.value;
    const target = body.targetValue === undefined ? row.targetValue : body.targetValue;
    const [updated] = await db
      .update(businessKpiValues)
      .set({
        ...body,
        targetValue: target,
        achievementPercent: computeAchievement(value, target, kpi.direction),
        calculatedAt: new Date(),
      })
      .where(eq(businessKpiValues.id, row.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'business.performance.kpi_value.update',
      entityType: 'business_kpi_value',
      entityId: row.id,
      newValues: { value: updated!.value, targetValue: updated!.targetValue },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

businessPerformanceRoutes.delete(
  '/kpi-values/:id',
  requirePermission('business:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const row = await db.query.businessKpiValues.findFirst({
      where: eq(businessKpiValues.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Nilai KPI tidak ditemukan');
    await assertBusinessAccess(row.merchantId, user, permissions, { manage: true });
    await db.delete(businessKpiValues).where(eq(businessKpiValues.id, row.id));
    await writeAuditLog({
      actorUserId: user.id,
      action: 'business.performance.kpi_value.delete',
      entityType: 'business_kpi_value',
      entityId: row.id,
      oldValues: { value: row.value },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, { id: row.id, deleted: true });
  },
);

/* ------------------------------ Targets ----------------------------- */

businessPerformanceRoutes.get(
  '/targets',
  requirePermission('business:read'),
  validate('query', listTargetSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = businessScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(businessTargets.merchantId, query.merchantId));
    if (query.periodId) conditions.push(eq(businessTargets.periodId, query.periodId));
    if (query.status) conditions.push(eq(businessTargets.status, query.status));
    if (query.search) conditions.push(ilike(businessTargets.name, `%${query.search}%`));
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: businessTargets.id,
          merchantId: businessTargets.merchantId,
          merchantName: merchants.businessName,
          periodId: businessTargets.periodId,
          periodName: performancePeriods.name,
          kpiId: businessTargets.kpiId,
          kpiName: businessKpis.name,
          name: businessTargets.name,
          targetValue: businessTargets.targetValue,
          actualValue: businessTargets.actualValue,
          unit: businessTargets.unit,
          startDate: businessTargets.startDate,
          endDate: businessTargets.endDate,
          status: businessTargets.status,
          createdAt: businessTargets.createdAt,
        })
        .from(businessTargets)
        .innerJoin(merchants, eq(merchants.id, businessTargets.merchantId))
        .leftJoin(performancePeriods, eq(performancePeriods.id, businessTargets.periodId))
        .leftJoin(businessKpis, eq(businessKpis.id, businessTargets.kpiId))
        .where(where)
        .orderBy(desc(businessTargets.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(businessTargets)
        .innerJoin(merchants, eq(merchants.id, businessTargets.merchantId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

businessPerformanceRoutes.post(
  '/targets',
  requirePermission('business:write'),
  validate('json', createTargetSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertBusinessAccess(body.merchantId, user, permissions, { manage: true });
    if (body.periodId) {
      const { period } = await getPerformancePeriod(body.periodId, user, permissions);
      if (period.merchantId !== body.merchantId) {
        throw ApiError.badRequest('Periode berasal dari merchant berbeda');
      }
    }
    if (body.kpiId) {
      const { kpi } = await getBusinessKpi(body.kpiId, user, permissions);
      if (kpi.merchantId !== body.merchantId) {
        throw ApiError.badRequest('KPI berasal dari merchant berbeda');
      }
    }
    if (body.startDate && body.endDate) assertDateRange(body.startDate, body.endDate);
    const [created] = await db
      .insert(businessTargets)
      .values({
        merchantId: body.merchantId,
        periodId: body.periodId ?? null,
        kpiId: body.kpiId ?? null,
        name: body.name,
        targetValue: body.targetValue,
        actualValue: body.actualValue,
        unit: body.unit ?? null,
        startDate: body.startDate ?? null,
        endDate: body.endDate ?? null,
        status: body.status,
        notes: body.notes ?? null,
      })
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'business.performance.target.create',
      entityType: 'business_target',
      entityId: created!.id,
      newValues: { name: created!.name, targetValue: created!.targetValue },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created!, 201);
  },
);

businessPerformanceRoutes.patch(
  '/targets/:id',
  requirePermission('business:write'),
  validate('json', updateTargetSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { target } = await getBusinessTarget(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (body.startDate && body.endDate) assertDateRange(body.startDate, body.endDate);
    const [updated] = await db
      .update(businessTargets)
      .set({
        ...body,
        periodId: body.periodId ?? undefined,
        kpiId: body.kpiId ?? undefined,
        unit: body.unit ?? undefined,
        startDate: body.startDate ?? undefined,
        endDate: body.endDate ?? undefined,
        notes: body.notes ?? undefined,
      })
      .where(eq(businessTargets.id, target.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'business.performance.target.update',
      entityType: 'business_target',
      entityId: target.id,
      oldValues: { status: target.status, actualValue: target.actualValue },
      newValues: { status: updated!.status, actualValue: updated!.actualValue },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

businessPerformanceRoutes.delete(
  '/targets/:id',
  requirePermission('business:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { target } = await getBusinessTarget(c.req.param('id'), user, permissions, {
      manage: true,
    });
    await db.delete(businessTargets).where(eq(businessTargets.id, target.id));
    await writeAuditLog({
      actorUserId: user.id,
      action: 'business.performance.target.delete',
      entityType: 'business_target',
      entityId: target.id,
      oldValues: { name: target.name },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, { id: target.id, deleted: true });
  },
);

/* --------------------------- Growth snapshots ----------------------- */

businessPerformanceRoutes.get(
  '/growth-snapshots',
  requirePermission('business:read'),
  validate('query', listSnapshotSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = businessScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(growthSnapshots.merchantId, query.merchantId));
    if (query.periodId) conditions.push(eq(growthSnapshots.periodId, query.periodId));
    if (query.metricType) conditions.push(eq(growthSnapshots.metricType, query.metricType));
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: growthSnapshots.id,
          merchantId: growthSnapshots.merchantId,
          merchantName: merchants.businessName,
          periodId: growthSnapshots.periodId,
          periodName: performancePeriods.name,
          snapshotDate: growthSnapshots.snapshotDate,
          metricType: growthSnapshots.metricType,
          currentValue: growthSnapshots.currentValue,
          previousValue: growthSnapshots.previousValue,
          growthPercent: growthSnapshots.growthPercent,
          createdAt: growthSnapshots.createdAt,
        })
        .from(growthSnapshots)
        .innerJoin(merchants, eq(merchants.id, growthSnapshots.merchantId))
        .innerJoin(performancePeriods, eq(performancePeriods.id, growthSnapshots.periodId))
        .where(where)
        .orderBy(desc(growthSnapshots.snapshotDate), asc(growthSnapshots.metricType))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(growthSnapshots)
        .innerJoin(merchants, eq(merchants.id, growthSnapshots.merchantId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

businessPerformanceRoutes.post(
  '/growth-snapshots',
  requirePermission('business:write'),
  validate('json', snapshotInputSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertBusinessAccess(body.merchantId, user, permissions, { manage: true });
    const { period } = await getPerformancePeriod(body.periodId, user, permissions);
    if (period.merchantId !== body.merchantId) {
      throw ApiError.badRequest('Periode berasal dari merchant berbeda');
    }
    const current = toNumber(body.currentValue);
    const previous = toNumber(body.previousValue);
    const growth =
      body.growthPercent ??
      (previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0);
    const [created] = await db
      .insert(growthSnapshots)
      .values({
        merchantId: body.merchantId,
        periodId: body.periodId,
        snapshotDate: body.snapshotDate,
        metricType: body.metricType,
        currentValue: body.currentValue,
        previousValue: body.previousValue ?? null,
        growthPercent: growth.toFixed(2),
        metadata: body.metadata ?? null,
      })
      .onConflictDoUpdate({
        target: [growthSnapshots.periodId, growthSnapshots.metricType],
        set: {
          snapshotDate: body.snapshotDate,
          currentValue: body.currentValue,
          previousValue: body.previousValue ?? null,
          growthPercent: growth.toFixed(2),
          metadata: body.metadata ?? null,
        },
      })
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'business.performance.snapshot.upsert',
      entityType: 'growth_snapshot',
      entityId: created!.id,
      newValues: {
        metricType: created!.metricType,
        growthPercent: created!.growthPercent,
      },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created!, 201);
  },
);

businessPerformanceRoutes.patch(
  '/growth-snapshots/:id',
  requirePermission('business:write'),
  validate('json', updateSnapshotSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const row = await db.query.growthSnapshots.findFirst({
      where: eq(growthSnapshots.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Snapshot pertumbuhan tidak ditemukan');
    await assertBusinessAccess(row.merchantId, user, permissions, { manage: true });
    const current = toNumber(body.currentValue ?? row.currentValue);
    const previous = toNumber(body.previousValue ?? row.previousValue);
    const growth =
      body.growthPercent ??
      (previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0);
    const [updated] = await db
      .update(growthSnapshots)
      .set({
        snapshotDate: body.snapshotDate ?? undefined,
        currentValue: body.currentValue ?? undefined,
        previousValue: body.previousValue ?? undefined,
        growthPercent: growth.toFixed(2),
        metadata: body.metadata ?? undefined,
      })
      .where(eq(growthSnapshots.id, row.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'business.performance.snapshot.update',
      entityType: 'growth_snapshot',
      entityId: row.id,
      newValues: { growthPercent: updated!.growthPercent },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

businessPerformanceRoutes.delete(
  '/growth-snapshots/:id',
  requirePermission('business:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const row = await db.query.growthSnapshots.findFirst({
      where: eq(growthSnapshots.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Snapshot pertumbuhan tidak ditemukan');
    await assertBusinessAccess(row.merchantId, user, permissions, { manage: true });
    await db.delete(growthSnapshots).where(eq(growthSnapshots.id, row.id));
    await writeAuditLog({
      actorUserId: user.id,
      action: 'business.performance.snapshot.delete',
      entityType: 'growth_snapshot',
      entityId: row.id,
      oldValues: { metricType: row.metricType },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, { id: row.id, deleted: true });
  },
);

/* ----------------------------- Reports ------------------------------ */

businessPerformanceRoutes.get(
  '/reports',
  requirePermission('business:read'),
  validate('query', listReportSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = businessScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(merchantPerformanceReports.merchantId, query.merchantId));
    if (query.periodId) conditions.push(eq(merchantPerformanceReports.periodId, query.periodId));
    if (query.status) conditions.push(eq(merchantPerformanceReports.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(merchantPerformanceReports.reportNumber, term),
          ilike(merchantPerformanceReports.title, term),
          ilike(merchants.businessName, term),
        ) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: merchantPerformanceReports.id,
          merchantId: merchantPerformanceReports.merchantId,
          merchantName: merchants.businessName,
          periodId: merchantPerformanceReports.periodId,
          periodName: performancePeriods.name,
          reportNumber: merchantPerformanceReports.reportNumber,
          title: merchantPerformanceReports.title,
          revenue: merchantPerformanceReports.revenue,
          orderCount: merchantPerformanceReports.orderCount,
          customerCount: merchantPerformanceReports.customerCount,
          productCount: merchantPerformanceReports.productCount,
          growthPercent: merchantPerformanceReports.growthPercent,
          score: merchantPerformanceReports.score,
          status: merchantPerformanceReports.status,
          generatedAt: merchantPerformanceReports.generatedAt,
          publishedAt: merchantPerformanceReports.publishedAt,
          createdAt: merchantPerformanceReports.createdAt,
        })
        .from(merchantPerformanceReports)
        .innerJoin(merchants, eq(merchants.id, merchantPerformanceReports.merchantId))
        .innerJoin(performancePeriods, eq(performancePeriods.id, merchantPerformanceReports.periodId))
        .where(where)
        .orderBy(desc(performancePeriods.startDate), desc(merchantPerformanceReports.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(merchantPerformanceReports)
        .innerJoin(merchants, eq(merchants.id, merchantPerformanceReports.merchantId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

businessPerformanceRoutes.post(
  '/reports',
  requirePermission('business:write'),
  validate('json', createReportSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertBusinessAccess(body.merchantId, user, permissions, { manage: true });
    const { period } = await getPerformancePeriod(body.periodId, user, permissions);
    if (period.merchantId !== body.merchantId) {
      throw ApiError.badRequest('Periode berasal dari merchant berbeda');
    }
    const [created] = await db
      .insert(merchantPerformanceReports)
      .values({
        merchantId: body.merchantId,
        periodId: body.periodId,
        reportNumber: generateCode('PRF'),
        title: body.title ?? `Laporan Kinerja ${period.name}`,
        summary: body.summary ?? null,
        revenue: body.revenue,
        orderCount: body.orderCount,
        customerCount: body.customerCount,
        productCount: body.productCount,
        grossMargin: body.grossMargin ?? null,
        growthPercent: body.growthPercent !== undefined ? String(body.growthPercent) : null,
        score: body.score !== undefined ? String(body.score) : null,
        status: body.status,
        publishedAt: body.status === 'published' ? new Date() : null,
        data: body.data ?? null,
        createdBy: user.id,
      })
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'business.performance.report.create',
      entityType: 'merchant_performance_report',
      entityId: created!.id,
      newValues: { reportNumber: created!.reportNumber, status: created!.status },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created!, 201);
  },
);

businessPerformanceRoutes.post(
  '/reports/generate',
  requirePermission('business:write'),
  validate('json', generateReportSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertBusinessAccess(body.merchantId, user, permissions, { manage: true });
    const { period } = await getPerformancePeriod(body.periodId, user, permissions);
    if (period.merchantId !== body.merchantId) {
      throw ApiError.badRequest('Periode berasal dari merchant berbeda');
    }

    const start = new Date(`${period.startDate}T00:00:00.000Z`);
    const end = new Date(`${period.endDate}T23:59:59.999Z`);
    const [metrics] = await db
      .select({
        revenue: sql<string>`coalesce(sum(${orders.grandTotal}), 0)`,
        orderCount: sql<number>`count(*)::int`,
        customerCount: sql<number>`count(distinct ${orders.userId})::int`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.merchantId, body.merchantId),
          gte(orders.placedAt, start),
          lte(orders.placedAt, end),
          sql`${orders.status} not in ('cancelled', 'returned')`,
        ),
      );
    const [productRow] = await db
      .select({ total: count() })
      .from(products)
      .where(and(eq(products.merchantId, body.merchantId), isNull(products.deletedAt)));

    const [previous] = await db
      .select({
        revenue: merchantPerformanceReports.revenue,
      })
      .from(merchantPerformanceReports)
      .innerJoin(performancePeriods, eq(performancePeriods.id, merchantPerformanceReports.periodId))
      .where(
        and(
          eq(merchantPerformanceReports.merchantId, body.merchantId),
          lte(performancePeriods.endDate, period.startDate),
        ),
      )
      .orderBy(desc(performancePeriods.endDate))
      .limit(1);

    const currentRevenue = toNumber(metrics?.revenue);
    const previousRevenue = toNumber(previous?.revenue);
    const growth =
      previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;
    const score = Math.max(0, Math.min(100, 50 + growth));
    const [existing] = await db
      .select()
      .from(merchantPerformanceReports)
      .where(
        and(
          eq(merchantPerformanceReports.merchantId, body.merchantId),
          eq(merchantPerformanceReports.periodId, period.id),
        ),
      )
      .limit(1);

    const values = {
      title: body.title ?? `Laporan Kinerja ${period.name}`,
      summary:
        body.summary ??
        `Periode ${period.startDate} sampai ${period.endDate}: ${metrics?.orderCount ?? 0} pesanan, pendapatan ${currentRevenue.toFixed(2)}, pertumbuhan ${growth.toFixed(2)}%.`,
      revenue: currentRevenue.toFixed(2),
      orderCount: metrics?.orderCount ?? 0,
      customerCount: metrics?.customerCount ?? 0,
      productCount: productRow?.total ?? 0,
      growthPercent: growth.toFixed(2),
      score: score.toFixed(2),
      generatedAt: new Date(),
      data: {
        periodStart: period.startDate,
        periodEnd: period.endDate,
        previousRevenue: previousRevenue.toFixed(2),
      },
    };

    let report;
    if (existing) {
      [report] = await db
        .update(merchantPerformanceReports)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(merchantPerformanceReports.id, existing.id))
        .returning();
    } else {
      [report] = await db
        .insert(merchantPerformanceReports)
        .values({
          merchantId: body.merchantId,
          periodId: period.id,
          reportNumber: generateCode('PRF'),
          ...values,
          createdBy: user.id,
        })
        .returning();
    }

    const snapshotMetrics = [
      { metricType: 'revenue', currentValue: currentRevenue, previousValue: previousRevenue },
      { metricType: 'orders', currentValue: metrics?.orderCount ?? 0, previousValue: 0 },
      { metricType: 'customers', currentValue: metrics?.customerCount ?? 0, previousValue: 0 },
    ];
    for (const metric of snapshotMetrics) {
      await db
        .insert(growthSnapshots)
        .values({
          merchantId: body.merchantId,
          periodId: period.id,
          snapshotDate: period.endDate,
          metricType: metric.metricType,
          currentValue: metric.currentValue.toFixed(4),
          previousValue: metric.previousValue ? metric.previousValue.toFixed(4) : null,
          growthPercent: growth.toFixed(2),
        })
        .onConflictDoUpdate({
          target: [growthSnapshots.periodId, growthSnapshots.metricType],
          set: {
            currentValue: metric.currentValue.toFixed(4),
            previousValue: metric.previousValue ? metric.previousValue.toFixed(4) : null,
            growthPercent: growth.toFixed(2),
          },
        });
    }

    await writeAuditLog({
      actorUserId: user.id,
      action: 'business.performance.report.generate',
      entityType: 'merchant_performance_report',
      entityId: report!.id,
      newValues: { periodId: period.id, revenue: report!.revenue },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, report!, existing ? 200 : 201);
  },
);

businessPerformanceRoutes.get(
  '/reports/:id',
  requirePermission('business:read'),
  async (c) => {
    const { report } = await getPerformanceReport(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    return ok(c, report);
  },
);

businessPerformanceRoutes.patch(
  '/reports/:id',
  requirePermission('business:write'),
  validate('json', updateReportSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { report } = await getPerformanceReport(c.req.param('id'), user, permissions, {
      manage: true,
    });
    const [updated] = await db
      .update(merchantPerformanceReports)
      .set({
        ...body,
        summary: body.summary ?? undefined,
        grossMargin: body.grossMargin ?? undefined,
        growthPercent: body.growthPercent !== undefined ? String(body.growthPercent) : undefined,
        score: body.score !== undefined ? String(body.score) : undefined,
        data: body.data ?? undefined,
        publishedAt:
          body.status === 'published'
            ? report.publishedAt ?? new Date()
            : body.status === 'draft'
              ? null
              : undefined,
      })
      .where(eq(merchantPerformanceReports.id, report.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'business.performance.report.update',
      entityType: 'merchant_performance_report',
      entityId: report.id,
      oldValues: { status: report.status },
      newValues: { status: updated!.status },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

businessPerformanceRoutes.post(
  '/reports/:id/publish',
  requirePermission('business:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { report } = await getPerformanceReport(c.req.param('id'), user, permissions, {
      manage: true,
    });
    const [updated] = await db
      .update(merchantPerformanceReports)
      .set({ status: 'published', publishedAt: new Date() })
      .where(eq(merchantPerformanceReports.id, report.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'business.performance.report.publish',
      entityType: 'merchant_performance_report',
      entityId: report.id,
      oldValues: { status: report.status },
      newValues: { status: 'published' },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

businessPerformanceRoutes.delete(
  '/reports/:id',
  requirePermission('business:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { report } = await getPerformanceReport(c.req.param('id'), user, permissions, {
      manage: true,
    });
    await db
      .delete(merchantPerformanceReports)
      .where(eq(merchantPerformanceReports.id, report.id));
    await writeAuditLog({
      actorUserId: user.id,
      action: 'business.performance.report.delete',
      entityType: 'merchant_performance_report',
      entityId: report.id,
      oldValues: { reportNumber: report.reportNumber },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, { id: report.id, deleted: true });
  },
);

export { reportStatusSchema };
