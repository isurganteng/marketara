import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  disbursementRecords,
  financingAgreements,
  financingMonitoringReports,
  financingRecords,
  fundUtilizationReports,
  fundingApplications,
  investorProfiles,
  merchants,
  repaymentSchedules,
  repaymentTransactions,
  riskAssessments,
  riskIndicators,
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
  assertFundingAccess,
  codeSchema,
  computeRiskLevel,
  dateOnlySchema,
  fundingMerchantScope,
  getApplication,
  getFinancing,
  getInvestor,
  money,
  numericSchema,
  optionalText,
  toNumber,
} from '../funding/shared';

const financingTypeSchema = z.enum(['loan', 'equity', 'grant', 'revenue_sharing', 'lease', 'other']);
const financingStatusSchema = z.enum([
  'draft',
  'active',
  'disbursing',
  'closed',
  'defaulted',
  'cancelled',
]);
const agreementStatusSchema = z.enum(['draft', 'signed', 'active', 'terminated']);
const disbursementStatusSchema = z.enum(['pending', 'confirmed', 'failed', 'cancelled']);
const repaymentStatusSchema = z.enum([
  'scheduled',
  'due',
  'paid',
  'overdue',
  'waived',
  'cancelled',
]);
const repaymentTransactionStatusSchema = z.enum(['pending', 'completed', 'failed', 'reversed']);
const utilizationStatusSchema = z.enum(['draft', 'submitted', 'approved', 'rejected']);
const monitoringStatusSchema = z.enum(['draft', 'submitted', 'reviewed', 'flagged']);
const riskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);
const riskIndicatorTypeSchema = z.enum([
  'financial',
  'operational',
  'market',
  'compliance',
  'repayment',
  'other',
]);
const riskAssessmentStatusSchema = z.enum(['draft', 'final']);

/* ------------------------------- Schemas ----------------------------- */

const listFinancingSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  status: financingStatusSchema.optional(),
  financingType: financingTypeSchema.optional(),
});

const financingInputSchema = z.object({
  merchantId: z.uuid(),
  applicationId: z.uuid().optional(),
  proposalId: z.uuid().optional(),
  investorProfileId: z.uuid().optional(),
  facilityNumber: codeSchema.optional(),
  title: z.string().trim().min(2).max(255),
  financingType: financingTypeSchema.default('loan'),
  principalAmount: numericSchema,
  currency: z.string().trim().length(3).default('IDR'),
  interestRate: numericSchema.optional(),
  equityPercent: numericSchema.optional(),
  tenorMonths: z.coerce.number().int().min(0).optional(),
  startDate: dateOnlySchema.optional(),
  endDate: dateOnlySchema.optional(),
  notes: optionalText(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const updateFinancingSchema = financingInputSchema.omit({ merchantId: true }).partial();

const agreementInputSchema = z.object({
  agreementNumber: codeSchema.optional(),
  title: z.string().trim().min(2).max(255),
  signedAt: z.string().datetime({ offset: true }).optional(),
  effectiveAt: dateOnlySchema.optional(),
  expiresAt: dateOnlySchema.optional(),
  fileUrl: optionalText(2048),
  status: agreementStatusSchema.default('draft'),
  terms: z.record(z.string(), z.unknown()).optional(),
});

const updateAgreementSchema = agreementInputSchema.partial();

const disbursementInputSchema = z.object({
  disbursementNumber: codeSchema.optional(),
  amount: numericSchema,
  currency: z.string().trim().length(3).default('IDR'),
  status: disbursementStatusSchema.default('pending'),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
  disbursedAt: z.string().datetime({ offset: true }).optional(),
  reference: optionalText(128),
  notes: optionalText(),
});

const updateDisbursementSchema = disbursementInputSchema.partial();

const repaymentInputSchema = z.object({
  installmentNumber: z.coerce.number().int().min(1).optional(),
  dueDate: dateOnlySchema,
  principalAmount: numericSchema.default('0'),
  interestAmount: numericSchema.default('0'),
  feeAmount: numericSchema.default('0'),
  totalAmount: numericSchema.optional(),
  status: repaymentStatusSchema.default('scheduled'),
});

const updateRepaymentSchema = repaymentInputSchema.partial();

const generateScheduleSchema = z.object({
  installmentCount: z.coerce.number().int().min(1).max(120).optional(),
  firstDueDate: dateOnlySchema,
  intervalMonths: z.coerce.number().int().min(1).max(12).default(1),
});

const repaymentPaymentSchema = z.object({
  amount: numericSchema,
  method: optionalText(64),
  reference: optionalText(128),
  paidAt: z.string().datetime({ offset: true }).optional(),
  notes: optionalText(),
});

const utilizationInputSchema = z.object({
  reportNumber: codeSchema.optional(),
  periodStart: dateOnlySchema,
  periodEnd: dateOnlySchema,
  totalUsed: numericSchema.default('0'),
  description: optionalText(),
  breakdown: z.record(z.string(), z.unknown()).optional(),
  status: utilizationStatusSchema.default('draft'),
  notes: optionalText(),
});

const updateUtilizationSchema = utilizationInputSchema
  .omit({ periodStart: true, periodEnd: true })
  .partial();

const monitoringInputSchema = z.object({
  reportNumber: codeSchema.optional(),
  periodStart: dateOnlySchema,
  periodEnd: dateOnlySchema,
  revenue: numericSchema.default('0'),
  profit: numericSchema.default('0'),
  cashFlow: numericSchema.default('0'),
  repaymentCapacity: numericSchema.optional(),
  riskLevel: riskLevelSchema.default('low'),
  status: monitoringStatusSchema.default('draft'),
  findings: optionalText(),
  recommendation: optionalText(),
});

const updateMonitoringSchema = monitoringInputSchema
  .omit({ periodStart: true, periodEnd: true })
  .partial();

const listRiskIndicatorSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  merchantId: z.uuid().optional(),
  category: riskIndicatorTypeSchema.optional(),
  search: z.string().trim().max(100).optional(),
});

const riskIndicatorInputSchema = z.object({
  merchantId: z.uuid(),
  code: codeSchema.optional(),
  name: z.string().trim().min(2).max(255),
  category: riskIndicatorTypeSchema.default('other'),
  description: optionalText(),
  thresholdLow: numericSchema.optional(),
  thresholdMedium: numericSchema.optional(),
  thresholdHigh: numericSchema.optional(),
  unit: optionalText(32),
  direction: z.string().trim().max(32).default('higher_better'),
  isActive: z.boolean().default(true),
});

const updateRiskIndicatorSchema = riskIndicatorInputSchema.omit({ merchantId: true }).partial();

const listRiskAssessmentSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  merchantId: z.uuid().optional(),
  financingId: z.uuid().optional(),
  riskLevel: riskLevelSchema.optional(),
  status: riskAssessmentStatusSchema.optional(),
});

const riskAssessmentInputSchema = z.object({
  merchantId: z.uuid(),
  financingId: z.uuid().optional(),
  indicatorId: z.uuid().optional(),
  assessmentDate: dateOnlySchema,
  score: z.coerce.number().min(0).max(100).default(0),
  riskLevel: riskLevelSchema.optional(),
  status: riskAssessmentStatusSchema.default('draft'),
  findings: optionalText(),
  mitigation: optionalText(),
});

const updateRiskAssessmentSchema = riskAssessmentInputSchema.omit({ merchantId: true }).partial();

const calculateRiskSchema = z.object({
  merchantId: z.uuid(),
  financingId: z.uuid().optional(),
});

export const fundingFinancingRoutes = new Hono<AppEnv>();

function assertCurrency(currency: string) {
  if (!/^[A-Z]{3}$/.test(currency)) throw ApiError.badRequest('Kode mata uang harus 3 huruf kapital');
}

function assertDateRange(start: string, end: string) {
  if (new Date(start) > new Date(end)) {
    throw ApiError.badRequest('Tanggal mulai tidak boleh setelah tanggal akhir');
  }
}

/* ----------------------------- Financing ----------------------------- */

fundingFinancingRoutes.get(
  '/financings',
  requirePermission('funding:read'),
  validate('query', listFinancingSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = fundingMerchantScope(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(financingRecords.merchantId, query.merchantId));
    if (query.status) conditions.push(eq(financingRecords.status, query.status));
    if (query.financingType) conditions.push(eq(financingRecords.financingType, query.financingType));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(financingRecords.facilityNumber, term),
          ilike(financingRecords.title, term),
          ilike(merchants.businessName, term),
        ) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: financingRecords.id,
          merchantId: financingRecords.merchantId,
          merchantName: merchants.businessName,
          facilityNumber: financingRecords.facilityNumber,
          title: financingRecords.title,
          financingType: financingRecords.financingType,
          principalAmount: financingRecords.principalAmount,
          currency: financingRecords.currency,
          interestRate: financingRecords.interestRate,
          tenorMonths: financingRecords.tenorMonths,
          status: financingRecords.status,
          startDate: financingRecords.startDate,
          endDate: financingRecords.endDate,
          createdAt: financingRecords.createdAt,
        })
        .from(financingRecords)
        .innerJoin(merchants, eq(merchants.id, financingRecords.merchantId))
        .where(where)
        .orderBy(desc(financingRecords.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(financingRecords)
        .innerJoin(merchants, eq(merchants.id, financingRecords.merchantId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

fundingFinancingRoutes.post(
  '/financings',
  requirePermission('funding:write'),
  validate('json', financingInputSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertFundingAccess(body.merchantId, user, permissions, { manage: true });
    assertCurrency(body.currency);
    if (body.startDate && body.endDate) assertDateRange(body.startDate, body.endDate);
    if (body.applicationId) {
      const { application } = await getApplication(body.applicationId, user, permissions);
      if (application.merchantId !== body.merchantId) {
        throw ApiError.badRequest('Pengajuan berasal dari merchant berbeda');
      }
    }
    if (body.investorProfileId) {
      await getInvestor(body.investorProfileId, user, permissions);
    }
    const facilityNumber = body.facilityNumber ?? generateCode('FIN');
    const [existing] = await db
      .select({ id: financingRecords.id })
      .from(financingRecords)
      .where(
        and(
          eq(financingRecords.merchantId, body.merchantId),
          eq(financingRecords.facilityNumber, facilityNumber),
        ),
      )
      .limit(1);
    if (existing) throw ApiError.conflict('Nomor fasilitas sudah digunakan');
    const [created] = await db
      .insert(financingRecords)
      .values({
        merchantId: body.merchantId,
        applicationId: body.applicationId ?? null,
        proposalId: body.proposalId ?? null,
        investorProfileId: body.investorProfileId ?? null,
        facilityNumber,
        title: body.title,
        financingType: body.financingType,
        principalAmount: body.principalAmount,
        currency: body.currency,
        interestRate: body.interestRate ?? null,
        equityPercent: body.equityPercent ?? null,
        tenorMonths: body.tenorMonths ?? null,
        startDate: body.startDate ?? null,
        endDate: body.endDate ?? null,
        notes: body.notes ?? null,
        metadata: body.metadata ?? null,
        createdBy: user.id,
      })
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'funding.financing.create',
      entityType: 'financing_record',
      entityId: created!.id,
      newValues: {
        facilityNumber: created!.facilityNumber,
        principalAmount: created!.principalAmount,
      },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created!, 201);
  },
);

fundingFinancingRoutes.get(
  '/financings/:id',
  requirePermission('funding:read'),
  async (c) => {
    const { financing } = await getFinancing(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    const [
      agreements,
      disbursements,
      schedules,
      transactions,
      utilizationReports,
      monitoringReports,
      assessments,
    ] = await Promise.all([
      db
        .select()
        .from(financingAgreements)
        .where(eq(financingAgreements.financingId, financing.id))
        .orderBy(desc(financingAgreements.createdAt)),
      db
        .select()
        .from(disbursementRecords)
        .where(eq(disbursementRecords.financingId, financing.id))
        .orderBy(desc(disbursementRecords.createdAt)),
      db
        .select()
        .from(repaymentSchedules)
        .where(eq(repaymentSchedules.financingId, financing.id))
        .orderBy(asc(repaymentSchedules.installmentNumber)),
      db
        .select()
        .from(repaymentTransactions)
        .where(eq(repaymentTransactions.financingId, financing.id))
        .orderBy(desc(repaymentTransactions.createdAt)),
      db
        .select()
        .from(fundUtilizationReports)
        .where(eq(fundUtilizationReports.financingId, financing.id))
        .orderBy(desc(fundUtilizationReports.createdAt)),
      db
        .select()
        .from(financingMonitoringReports)
        .where(eq(financingMonitoringReports.financingId, financing.id))
        .orderBy(desc(financingMonitoringReports.createdAt)),
      db
        .select()
        .from(riskAssessments)
        .where(eq(riskAssessments.financingId, financing.id))
        .orderBy(desc(riskAssessments.assessmentDate)),
    ]);
    return ok(c, {
      ...financing,
      agreements,
      disbursements,
      repaymentSchedules: schedules,
      repaymentTransactions: transactions,
      utilizationReports,
      monitoringReports,
      riskAssessments: assessments,
    });
  },
);

fundingFinancingRoutes.patch(
  '/financings/:id',
  requirePermission('funding:write'),
  validate('json', updateFinancingSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { financing } = await getFinancing(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (body.currency) assertCurrency(body.currency);
    if (body.startDate && body.endDate) assertDateRange(body.startDate, body.endDate);
    if (body.applicationId) {
      const { application } = await getApplication(body.applicationId, user, permissions);
      if (application.merchantId !== financing.merchantId) {
        throw ApiError.badRequest('Pengajuan berasal dari merchant berbeda');
      }
    }
    if (body.investorProfileId) {
      await getInvestor(body.investorProfileId, user, permissions);
    }
    const [updated] = await db
      .update(financingRecords)
      .set({
        ...body,
        applicationId: body.applicationId ?? undefined,
        proposalId: body.proposalId ?? undefined,
        investorProfileId: body.investorProfileId ?? undefined,
        facilityNumber: body.facilityNumber ?? undefined,
        interestRate: body.interestRate ?? undefined,
        equityPercent: body.equityPercent ?? undefined,
        tenorMonths: body.tenorMonths ?? undefined,
        startDate: body.startDate ?? undefined,
        endDate: body.endDate ?? undefined,
        notes: body.notes ?? undefined,
        metadata: body.metadata ?? undefined,
      })
      .where(eq(financingRecords.id, financing.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'funding.financing.update',
      entityType: 'financing_record',
      entityId: financing.id,
      oldValues: { status: financing.status, principalAmount: financing.principalAmount },
      newValues: { status: updated!.status, principalAmount: updated!.principalAmount },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

fundingFinancingRoutes.post(
  '/financings/:id/activate',
  requirePermission('funding:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { financing } = await getFinancing(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (financing.status === 'closed' || financing.status === 'defaulted') {
      throw ApiError.badRequest('Fasilitas sudah final');
    }
    const [updated] = await db
      .update(financingRecords)
      .set({
        status: 'active',
        startDate: financing.startDate ?? new Date().toISOString().slice(0, 10),
      })
      .where(eq(financingRecords.id, financing.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'funding.financing.activate',
      entityType: 'financing_record',
      entityId: financing.id,
      oldValues: { status: financing.status },
      newValues: { status: 'active' },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

fundingFinancingRoutes.post(
  '/financings/:id/close',
  requirePermission('funding:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { financing } = await getFinancing(c.req.param('id'), user, permissions, {
      manage: true,
    });
    const [updated] = await db
      .update(financingRecords)
      .set({ status: 'closed', closedAt: new Date() })
      .where(eq(financingRecords.id, financing.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'funding.financing.close',
      entityType: 'financing_record',
      entityId: financing.id,
      oldValues: { status: financing.status },
      newValues: { status: 'closed' },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

fundingFinancingRoutes.post(
  '/financings/:id/default',
  requirePermission('funding:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { financing } = await getFinancing(c.req.param('id'), user, permissions, {
      manage: true,
    });
    const [updated] = await db
      .update(financingRecords)
      .set({ status: 'defaulted', defaultedAt: new Date() })
      .where(eq(financingRecords.id, financing.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'funding.financing.default',
      entityType: 'financing_record',
      entityId: financing.id,
      oldValues: { status: financing.status },
      newValues: { status: 'defaulted' },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

/* ----------------------------- Agreements ---------------------------- */

fundingFinancingRoutes.get(
  '/financings/:id/agreements',
  requirePermission('funding:read'),
  async (c) => {
    const { financing } = await getFinancing(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    const rows = await db
      .select()
      .from(financingAgreements)
      .where(eq(financingAgreements.financingId, financing.id))
      .orderBy(desc(financingAgreements.createdAt));
    return ok(c, rows);
  },
);

fundingFinancingRoutes.post(
  '/financings/:id/agreements',
  requirePermission('funding:write'),
  validate('json', agreementInputSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { financing } = await getFinancing(c.req.param('id'), user, permissions, {
      manage: true,
    });
    const agreementNumber = body.agreementNumber ?? generateCode('AGR');
    const [created] = await db
      .insert(financingAgreements)
      .values({
        financingId: financing.id,
        merchantId: financing.merchantId,
        agreementNumber,
        title: body.title,
        signedAt: body.signedAt ? new Date(body.signedAt) : null,
        effectiveAt: body.effectiveAt ?? null,
        expiresAt: body.expiresAt ?? null,
        fileUrl: body.fileUrl ?? null,
        status: body.status,
        terms: body.terms ?? null,
      })
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'funding.agreement.create',
      entityType: 'financing_agreement',
      entityId: created!.id,
      newValues: { agreementNumber: created!.agreementNumber },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created!, 201);
  },
);

fundingFinancingRoutes.patch(
  '/financing-agreements/:id',
  requirePermission('funding:write'),
  validate('json', updateAgreementSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const row = await db.query.financingAgreements.findFirst({
      where: eq(financingAgreements.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Perjanjian pendanaan tidak ditemukan');
    await assertFundingAccess(row.merchantId, user, permissions, { manage: true });
    const [updated] = await db
      .update(financingAgreements)
      .set({
        ...body,
        agreementNumber: body.agreementNumber ?? undefined,
        signedAt: body.signedAt ? new Date(body.signedAt) : undefined,
        effectiveAt: body.effectiveAt ?? undefined,
        expiresAt: body.expiresAt ?? undefined,
        fileUrl: body.fileUrl ?? undefined,
        terms: body.terms ?? undefined,
      })
      .where(eq(financingAgreements.id, row.id))
      .returning();
    return ok(c, updated!);
  },
);

fundingFinancingRoutes.delete(
  '/financing-agreements/:id',
  requirePermission('funding:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const row = await db.query.financingAgreements.findFirst({
      where: eq(financingAgreements.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Perjanjian pendanaan tidak ditemukan');
    await assertFundingAccess(row.merchantId, user, permissions, { manage: true });
    await db.delete(financingAgreements).where(eq(financingAgreements.id, row.id));
    return ok(c, { id: row.id, deleted: true });
  },
);

/* ---------------------------- Disbursements -------------------------- */

fundingFinancingRoutes.get(
  '/financings/:id/disbursements',
  requirePermission('funding:read'),
  async (c) => {
    const { financing } = await getFinancing(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    const rows = await db
      .select()
      .from(disbursementRecords)
      .where(eq(disbursementRecords.financingId, financing.id))
      .orderBy(desc(disbursementRecords.createdAt));
    return ok(c, rows);
  },
);

fundingFinancingRoutes.post(
  '/financings/:id/disbursements',
  requirePermission('funding:write'),
  validate('json', disbursementInputSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { financing } = await getFinancing(c.req.param('id'), user, permissions, {
      manage: true,
    });
    assertCurrency(body.currency);
    const [created] = await db
      .insert(disbursementRecords)
      .values({
        financingId: financing.id,
        merchantId: financing.merchantId,
        disbursementNumber: body.disbursementNumber ?? generateCode('DIS'),
        amount: body.amount,
        currency: body.currency,
        status: body.status,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        disbursedAt: body.disbursedAt ? new Date(body.disbursedAt) : null,
        reference: body.reference ?? null,
        notes: body.notes ?? null,
      })
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'funding.disbursement.create',
      entityType: 'disbursement_record',
      entityId: created!.id,
      newValues: { amount: created!.amount, status: created!.status },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created!, 201);
  },
);

fundingFinancingRoutes.patch(
  '/disbursements/:id',
  requirePermission('funding:write'),
  validate('json', updateDisbursementSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const row = await db.query.disbursementRecords.findFirst({
      where: eq(disbursementRecords.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Pencairan dana tidak ditemukan');
    await assertFundingAccess(row.merchantId, user, permissions, { manage: true });
    if (body.currency) assertCurrency(body.currency);
    const [updated] = await db
      .update(disbursementRecords)
      .set({
        ...body,
        disbursementNumber: body.disbursementNumber ?? undefined,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
        disbursedAt: body.disbursedAt ? new Date(body.disbursedAt) : undefined,
        reference: body.reference ?? undefined,
        notes: body.notes ?? undefined,
      })
      .where(eq(disbursementRecords.id, row.id))
      .returning();
    return ok(c, updated!);
  },
);

fundingFinancingRoutes.post(
  '/disbursements/:id/confirm',
  requirePermission('funding:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const row = await db.query.disbursementRecords.findFirst({
      where: eq(disbursementRecords.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Pencairan dana tidak ditemukan');
    await assertFundingAccess(row.merchantId, user, permissions, { manage: true });
    const now = new Date();
    const [updated] = await db
      .update(disbursementRecords)
      .set({
        status: 'confirmed',
        disbursedAt: row.disbursedAt ?? now,
        confirmedAt: now,
      })
      .where(eq(disbursementRecords.id, row.id))
      .returning();
    await db
      .update(financingRecords)
      .set({ status: 'active' })
      .where(
        and(
          eq(financingRecords.id, row.financingId),
          eq(financingRecords.status, 'draft'),
        ),
      );
    await writeAuditLog({
      actorUserId: user.id,
      action: 'funding.disbursement.confirm',
      entityType: 'disbursement_record',
      entityId: row.id,
      oldValues: { status: row.status },
      newValues: { status: 'confirmed' },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

/* --------------------------- Repayment ------------------------------- */

fundingFinancingRoutes.get(
  '/financings/:id/repayment-schedules',
  requirePermission('funding:read'),
  async (c) => {
    const { financing } = await getFinancing(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    const rows = await db
      .select()
      .from(repaymentSchedules)
      .where(eq(repaymentSchedules.financingId, financing.id))
      .orderBy(asc(repaymentSchedules.installmentNumber));
    return ok(c, rows);
  },
);

fundingFinancingRoutes.post(
  '/financings/:id/repayment-schedules',
  requirePermission('funding:write'),
  validate('json', repaymentInputSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { financing } = await getFinancing(c.req.param('id'), user, permissions, {
      manage: true,
    });
    const [last] = await db
      .select({ installmentNumber: repaymentSchedules.installmentNumber })
      .from(repaymentSchedules)
      .where(eq(repaymentSchedules.financingId, financing.id))
      .orderBy(desc(repaymentSchedules.installmentNumber))
      .limit(1);
    const installmentNumber = body.installmentNumber ?? (last?.installmentNumber ?? 0) + 1;
    const total =
      body.totalAmount ??
      money(
        toNumber(body.principalAmount) +
          toNumber(body.interestAmount) +
          toNumber(body.feeAmount),
      );
    const [created] = await db
      .insert(repaymentSchedules)
      .values({
        financingId: financing.id,
        merchantId: financing.merchantId,
        installmentNumber,
        dueDate: body.dueDate,
        principalAmount: body.principalAmount,
        interestAmount: body.interestAmount,
        feeAmount: body.feeAmount,
        totalAmount: total,
        status: body.status,
      })
      .returning();
    return ok(c, created!, 201);
  },
);

fundingFinancingRoutes.post(
  '/financings/:id/generate-schedule',
  requirePermission('funding:write'),
  validate('json', generateScheduleSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { financing } = await getFinancing(c.req.param('id'), user, permissions, {
      manage: true,
    });
    const existing = await db
      .select({ total: count() })
      .from(repaymentSchedules)
      .where(eq(repaymentSchedules.financingId, financing.id));
    if ((existing[0]?.total ?? 0) > 0) {
      throw ApiError.conflict('Jadwal pembayaran sudah ada');
    }
    const countInstallments = body.installmentCount ?? financing.tenorMonths ?? 1;
    const principal = toNumber(financing.principalAmount);
    const annualRate = toNumber(financing.interestRate);
    const principalPerInstallment = principal / countInstallments;
    const interestPerInstallment = (principal * (annualRate / 100)) / 12;
    const firstDue = new Date(`${body.firstDueDate}T00:00:00.000Z`);
    const rows = await db.transaction(async (tx) => {
      const created: (typeof repaymentSchedules.$inferSelect)[] = [];
      for (let index = 1; index <= countInstallments; index += 1) {
        const due = new Date(firstDue);
        due.setUTCMonth(due.getUTCMonth() + (index - 1) * body.intervalMonths);
        const total = principalPerInstallment + interestPerInstallment;
        const [row] = await tx
          .insert(repaymentSchedules)
          .values({
            financingId: financing.id,
            merchantId: financing.merchantId,
            installmentNumber: index,
            dueDate: due.toISOString().slice(0, 10),
            principalAmount: principalPerInstallment.toFixed(2),
            interestAmount: interestPerInstallment.toFixed(2),
            feeAmount: '0',
            totalAmount: total.toFixed(2),
            status: 'scheduled',
          })
          .returning();
        created.push(row!);
      }
      return created;
    });
    await writeAuditLog({
      actorUserId: user.id,
      action: 'funding.financing.schedule.generate',
      entityType: 'financing_record',
      entityId: financing.id,
      newValues: { installments: rows.length },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, rows, 201);
  },
);

fundingFinancingRoutes.patch(
  '/repayment-schedules/:id',
  requirePermission('funding:write'),
  validate('json', updateRepaymentSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const row = await db.query.repaymentSchedules.findFirst({
      where: eq(repaymentSchedules.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Jadwal pembayaran tidak ditemukan');
    await assertFundingAccess(row.merchantId, user, permissions, { manage: true });
    const total =
      body.totalAmount ??
      money(
        toNumber(body.principalAmount ?? row.principalAmount) +
          toNumber(body.interestAmount ?? row.interestAmount) +
          toNumber(body.feeAmount ?? row.feeAmount),
      );
    const [updated] = await db
      .update(repaymentSchedules)
      .set({
        ...body,
        totalAmount: total,
      })
      .where(eq(repaymentSchedules.id, row.id))
      .returning();
    return ok(c, updated!);
  },
);

fundingFinancingRoutes.post(
  '/repayment-schedules/:id/pay',
  requirePermission('funding:write'),
  validate('json', repaymentPaymentSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const row = await db.query.repaymentSchedules.findFirst({
      where: eq(repaymentSchedules.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Jadwal pembayaran tidak ditemukan');
    await assertFundingAccess(row.merchantId, user, permissions, { manage: true });
    if (row.status === 'paid' || row.status === 'waived') {
      throw ApiError.badRequest('Jadwal sudah dibayar atau dibebaskan');
    }
    const amount = toNumber(body.amount);
    if (amount <= 0) throw ApiError.badRequest('Nominal pembayaran harus lebih dari 0');
    const paidAmount = Math.min(toNumber(row.totalAmount), toNumber(row.paidAmount) + amount);
    const fullyPaid = paidAmount >= toNumber(row.totalAmount);
    const paidAt = body.paidAt ? new Date(body.paidAt) : new Date();
    const result = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(repaymentSchedules)
        .set({
          paidAmount: paidAmount.toFixed(2),
          status: fullyPaid ? 'paid' : 'due',
          paidAt: fullyPaid ? paidAt : null,
        })
        .where(eq(repaymentSchedules.id, row.id))
        .returning();
      const [transaction] = await tx
        .insert(repaymentTransactions)
        .values({
          scheduleId: row.id,
          financingId: row.financingId,
          merchantId: row.merchantId,
          transactionNumber: generateCode('PAY'),
          amount: amount.toFixed(2),
          status: 'completed',
          paidAt,
          method: body.method ?? null,
          reference: body.reference ?? null,
          notes: body.notes ?? null,
        })
        .returning();
      return { schedule: updated!, transaction: transaction! };
    });
    await writeAuditLog({
      actorUserId: user.id,
      action: 'funding.repayment.pay',
      entityType: 'repayment_schedule',
      entityId: row.id,
      oldValues: { paidAmount: row.paidAmount, status: row.status },
      newValues: { paidAmount: result.schedule.paidAmount, status: result.schedule.status },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, result, 201);
  },
);

fundingFinancingRoutes.get(
  '/repayment-transactions',
  requirePermission('funding:read'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const page = Number(c.req.query('page') ?? 1);
    const limit = Math.min(Number(c.req.query('limit') ?? 50), 100);
    const pagination = { page, limit, offset: (page - 1) * limit };
    const conditions: SQL[] = [];
    const scope = fundingMerchantScope(user, permissions);
    if (scope) conditions.push(scope);
    const merchantId = c.req.query('merchantId');
    if (merchantId) conditions.push(eq(repaymentTransactions.merchantId, merchantId));
    const financingId = c.req.query('financingId');
    if (financingId) conditions.push(eq(repaymentTransactions.financingId, financingId));
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: repaymentTransactions.id,
          merchantId: repaymentTransactions.merchantId,
          merchantName: merchants.businessName,
          financingId: repaymentTransactions.financingId,
          scheduleId: repaymentTransactions.scheduleId,
          transactionNumber: repaymentTransactions.transactionNumber,
          amount: repaymentTransactions.amount,
          status: repaymentTransactions.status,
          paidAt: repaymentTransactions.paidAt,
          method: repaymentTransactions.method,
          reference: repaymentTransactions.reference,
          createdAt: repaymentTransactions.createdAt,
        })
        .from(repaymentTransactions)
        .innerJoin(merchants, eq(merchants.id, repaymentTransactions.merchantId))
        .where(where)
        .orderBy(desc(repaymentTransactions.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(repaymentTransactions)
        .innerJoin(merchants, eq(merchants.id, repaymentTransactions.merchantId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

/* ------------------------ Utilization reports ------------------------ */

fundingFinancingRoutes.get(
  '/financings/:id/utilization-reports',
  requirePermission('funding:read'),
  async (c) => {
    const { financing } = await getFinancing(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    const rows = await db
      .select()
      .from(fundUtilizationReports)
      .where(eq(fundUtilizationReports.financingId, financing.id))
      .orderBy(desc(fundUtilizationReports.createdAt));
    return ok(c, rows);
  },
);

fundingFinancingRoutes.post(
  '/financings/:id/utilization-reports',
  requirePermission('funding:write'),
  validate('json', utilizationInputSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { financing } = await getFinancing(c.req.param('id'), user, permissions, {
      manage: true,
    });
    assertDateRange(body.periodStart, body.periodEnd);
    const [created] = await db
      .insert(fundUtilizationReports)
      .values({
        financingId: financing.id,
        merchantId: financing.merchantId,
        reportNumber: body.reportNumber ?? generateCode('UTL'),
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
        totalUsed: body.totalUsed,
        description: body.description ?? null,
        breakdown: body.breakdown ?? null,
        status: body.status,
        submittedAt: body.status === 'submitted' ? new Date() : null,
        notes: body.notes ?? null,
      })
      .returning();
    return ok(c, created!, 201);
  },
);

fundingFinancingRoutes.patch(
  '/utilization-reports/:id',
  requirePermission('funding:write'),
  validate('json', updateUtilizationSchema.extend({ status: utilizationStatusSchema.optional() })),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const row = await db.query.fundUtilizationReports.findFirst({
      where: eq(fundUtilizationReports.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Laporan penggunaan dana tidak ditemukan');
    await assertFundingAccess(row.merchantId, user, permissions, { manage: true });
    const [updated] = await db
      .update(fundUtilizationReports)
      .set({
        ...body,
        reportNumber: body.reportNumber ?? undefined,
        description: body.description ?? undefined,
        breakdown: body.breakdown ?? undefined,
        notes: body.notes ?? undefined,
        submittedAt: body.status === 'submitted' ? new Date() : undefined,
        reviewedAt:
          body.status === 'approved' || body.status === 'rejected' ? new Date() : undefined,
        reviewedBy: body.status === 'approved' || body.status === 'rejected' ? user.id : undefined,
      })
      .where(eq(fundUtilizationReports.id, row.id))
      .returning();
    return ok(c, updated!);
  },
);

/* ------------------------ Monitoring reports ------------------------- */

fundingFinancingRoutes.get(
  '/financings/:id/monitoring-reports',
  requirePermission('funding:read'),
  async (c) => {
    const { financing } = await getFinancing(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    const rows = await db
      .select()
      .from(financingMonitoringReports)
      .where(eq(financingMonitoringReports.financingId, financing.id))
      .orderBy(desc(financingMonitoringReports.createdAt));
    return ok(c, rows);
  },
);

fundingFinancingRoutes.post(
  '/financings/:id/monitoring-reports',
  requirePermission('funding:write'),
  validate('json', monitoringInputSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { financing } = await getFinancing(c.req.param('id'), user, permissions, {
      manage: true,
    });
    assertDateRange(body.periodStart, body.periodEnd);
    const [created] = await db
      .insert(financingMonitoringReports)
      .values({
        financingId: financing.id,
        merchantId: financing.merchantId,
        reportNumber: body.reportNumber ?? generateCode('MON'),
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
        revenue: body.revenue,
        profit: body.profit,
        cashFlow: body.cashFlow,
        repaymentCapacity: body.repaymentCapacity ?? null,
        riskLevel: body.riskLevel,
        status: body.status,
        findings: body.findings ?? null,
        recommendation: body.recommendation ?? null,
        submittedAt: body.status === 'submitted' ? new Date() : null,
      })
      .returning();
    return ok(c, created!, 201);
  },
);

fundingFinancingRoutes.patch(
  '/monitoring-reports/:id',
  requirePermission('funding:write'),
  validate('json', updateMonitoringSchema.extend({ status: monitoringStatusSchema.optional() })),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const row = await db.query.financingMonitoringReports.findFirst({
      where: eq(financingMonitoringReports.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Laporan monitoring tidak ditemukan');
    await assertFundingAccess(row.merchantId, user, permissions, { manage: true });
    const [updated] = await db
      .update(financingMonitoringReports)
      .set({
        ...body,
        reportNumber: body.reportNumber ?? undefined,
        repaymentCapacity: body.repaymentCapacity ?? undefined,
        findings: body.findings ?? undefined,
        recommendation: body.recommendation ?? undefined,
        submittedAt: body.status === 'submitted' ? new Date() : undefined,
        reviewedAt:
          body.status === 'reviewed' || body.status === 'flagged' ? new Date() : undefined,
      })
      .where(eq(financingMonitoringReports.id, row.id))
      .returning();
    return ok(c, updated!);
  },
);

/* --------------------------- Risk indicators ------------------------- */

fundingFinancingRoutes.get(
  '/risk-indicators',
  requirePermission('funding:read'),
  validate('query', listRiskIndicatorSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = fundingMerchantScope(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(riskIndicators.merchantId, query.merchantId));
    if (query.category) conditions.push(eq(riskIndicators.category, query.category));
    if (query.search) {
      conditions.push(
        or(
          ilike(riskIndicators.code, `%${query.search}%`),
          ilike(riskIndicators.name, `%${query.search}%`),
        ) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(riskIndicators)
        .innerJoin(merchants, eq(merchants.id, riskIndicators.merchantId))
        .where(where)
        .orderBy(asc(riskIndicators.category), asc(riskIndicators.name))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(riskIndicators)
        .innerJoin(merchants, eq(merchants.id, riskIndicators.merchantId))
        .where(where),
    ]);
    return paginated(c, rows.map((row) => row.risk_indicators), totalRow?.total ?? 0, pagination);
  },
);

fundingFinancingRoutes.post(
  '/risk-indicators',
  requirePermission('funding:write'),
  validate('json', riskIndicatorInputSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertFundingAccess(body.merchantId, user, permissions, { manage: true });
    const code = body.code ?? generateCode('RSK');
    const [created] = await db
      .insert(riskIndicators)
      .values({
        merchantId: body.merchantId,
        code,
        name: body.name,
        category: body.category,
        description: body.description ?? null,
        thresholdLow: body.thresholdLow ?? null,
        thresholdMedium: body.thresholdMedium ?? null,
        thresholdHigh: body.thresholdHigh ?? null,
        unit: body.unit ?? null,
        direction: body.direction,
        isActive: body.isActive,
      })
      .returning();
    return ok(c, created!, 201);
  },
);

fundingFinancingRoutes.patch(
  '/risk-indicators/:id',
  requirePermission('funding:write'),
  validate('json', updateRiskIndicatorSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const row = await db.query.riskIndicators.findFirst({
      where: eq(riskIndicators.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Indikator risiko tidak ditemukan');
    await assertFundingAccess(row.merchantId, user, permissions, { manage: true });
    const [updated] = await db
      .update(riskIndicators)
      .set({
        ...body,
        description: body.description ?? undefined,
        thresholdLow: body.thresholdLow ?? undefined,
        thresholdMedium: body.thresholdMedium ?? undefined,
        thresholdHigh: body.thresholdHigh ?? undefined,
        unit: body.unit ?? undefined,
      })
      .where(eq(riskIndicators.id, row.id))
      .returning();
    return ok(c, updated!);
  },
);

fundingFinancingRoutes.delete(
  '/risk-indicators/:id',
  requirePermission('funding:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const row = await db.query.riskIndicators.findFirst({
      where: eq(riskIndicators.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Indikator risiko tidak ditemukan');
    await assertFundingAccess(row.merchantId, user, permissions, { manage: true });
    await db.delete(riskIndicators).where(eq(riskIndicators.id, row.id));
    return ok(c, { id: row.id, deleted: true });
  },
);

/* --------------------------- Risk assessments ------------------------ */

fundingFinancingRoutes.get(
  '/risk-assessments',
  requirePermission('funding:read'),
  validate('query', listRiskAssessmentSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = fundingMerchantScope(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(riskAssessments.merchantId, query.merchantId));
    if (query.financingId) conditions.push(eq(riskAssessments.financingId, query.financingId));
    if (query.riskLevel) conditions.push(eq(riskAssessments.riskLevel, query.riskLevel));
    if (query.status) conditions.push(eq(riskAssessments.status, query.status));
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: riskAssessments.id,
          merchantId: riskAssessments.merchantId,
          merchantName: merchants.businessName,
          financingId: riskAssessments.financingId,
          indicatorId: riskAssessments.indicatorId,
          indicatorName: riskIndicators.name,
          assessmentDate: riskAssessments.assessmentDate,
          score: riskAssessments.score,
          riskLevel: riskAssessments.riskLevel,
          status: riskAssessments.status,
          findings: riskAssessments.findings,
          mitigation: riskAssessments.mitigation,
          createdAt: riskAssessments.createdAt,
        })
        .from(riskAssessments)
        .innerJoin(merchants, eq(merchants.id, riskAssessments.merchantId))
        .leftJoin(riskIndicators, eq(riskIndicators.id, riskAssessments.indicatorId))
        .where(where)
        .orderBy(desc(riskAssessments.assessmentDate), desc(riskAssessments.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(riskAssessments)
        .innerJoin(merchants, eq(merchants.id, riskAssessments.merchantId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

fundingFinancingRoutes.post(
  '/risk-assessments',
  requirePermission('funding:write'),
  validate('json', riskAssessmentInputSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertFundingAccess(body.merchantId, user, permissions, { manage: true });
    if (body.financingId) {
      const { financing } = await getFinancing(body.financingId, user, permissions);
      if (financing.merchantId !== body.merchantId) {
        throw ApiError.badRequest('Fasilitas berasal dari merchant berbeda');
      }
    }
    if (body.indicatorId) {
      const indicator = await db.query.riskIndicators.findFirst({
        where: eq(riskIndicators.id, body.indicatorId),
      });
      if (!indicator || indicator.merchantId !== body.merchantId) {
        throw ApiError.badRequest('Indikator risiko tidak cocok');
      }
    }
    const riskLevel = body.riskLevel ?? computeRiskLevel(body.score);
    const [created] = await db
      .insert(riskAssessments)
      .values({
        merchantId: body.merchantId,
        financingId: body.financingId ?? null,
        indicatorId: body.indicatorId ?? null,
        assessmentDate: body.assessmentDate,
        score: String(body.score),
        riskLevel,
        status: body.status,
        findings: body.findings ?? null,
        mitigation: body.mitigation ?? null,
        assessedBy: user.id,
      })
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'funding.risk.assessment.create',
      entityType: 'risk_assessment',
      entityId: created!.id,
      newValues: { score: created!.score, riskLevel: created!.riskLevel },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created!, 201);
  },
);

fundingFinancingRoutes.patch(
  '/risk-assessments/:id',
  requirePermission('funding:write'),
  validate('json', updateRiskAssessmentSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const row = await db.query.riskAssessments.findFirst({
      where: eq(riskAssessments.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Penilaian risiko tidak ditemukan');
    await assertFundingAccess(row.merchantId, user, permissions, { manage: true });
    const score = body.score ?? toNumber(row.score);
    const [updated] = await db
      .update(riskAssessments)
      .set({
        ...body,
        score: body.score !== undefined ? String(body.score) : undefined,
        riskLevel: body.riskLevel ?? computeRiskLevel(score),
        findings: body.findings ?? undefined,
        mitigation: body.mitigation ?? undefined,
        financingId: body.financingId ?? undefined,
        indicatorId: body.indicatorId ?? undefined,
      })
      .where(eq(riskAssessments.id, row.id))
      .returning();
    return ok(c, updated!);
  },
);

fundingFinancingRoutes.delete(
  '/risk-assessments/:id',
  requirePermission('funding:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const row = await db.query.riskAssessments.findFirst({
      where: eq(riskAssessments.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Penilaian risiko tidak ditemukan');
    await assertFundingAccess(row.merchantId, user, permissions, { manage: true });
    await db.delete(riskAssessments).where(eq(riskAssessments.id, row.id));
    return ok(c, { id: row.id, deleted: true });
  },
);

fundingFinancingRoutes.post(
  '/risk-assessments/calculate',
  requirePermission('funding:write'),
  validate('json', calculateRiskSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertFundingAccess(body.merchantId, user, permissions, { manage: true });
    if (body.financingId) {
      const { financing } = await getFinancing(body.financingId, user, permissions);
      if (financing.merchantId !== body.merchantId) {
        throw ApiError.badRequest('Fasilitas berasal dari merchant berbeda');
      }
    }
    const scheduleConditions: SQL[] = [eq(repaymentSchedules.merchantId, body.merchantId)];
    if (body.financingId) {
      scheduleConditions.push(eq(repaymentSchedules.financingId, body.financingId));
    }
    const [scheduleStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        overdue: sql<number>`count(*) filter (where ${repaymentSchedules.status} = 'overdue' or (${repaymentSchedules.status} = 'scheduled' and ${repaymentSchedules.dueDate} < current_date))::int`,
        outstanding: sql<string>`coalesce(sum(${repaymentSchedules.totalAmount} - ${repaymentSchedules.paidAmount}), 0)`,
      })
      .from(repaymentSchedules)
      .where(and(...scheduleConditions));
    const overdueRatio =
      scheduleStats && scheduleStats.total > 0
        ? scheduleStats.overdue / scheduleStats.total
        : 0;
    const score = Math.min(100, overdueRatio * 100);
    const riskLevel = computeRiskLevel(score);
    const [created] = await db
      .insert(riskAssessments)
      .values({
        merchantId: body.merchantId,
        financingId: body.financingId ?? null,
        assessmentDate: new Date().toISOString().slice(0, 10),
        score: score.toFixed(2),
        riskLevel,
        status: 'final',
        findings: `${scheduleStats?.overdue ?? 0} dari ${scheduleStats?.total ?? 0} jadwal menunggak. Sisa kewajiban ${scheduleStats?.outstanding ?? '0'}.`,
        mitigation: overdueRatio > 0.3 ? 'Perlu restrukturisasi atau pendampingan pembayaran.' : null,
        assessedBy: user.id,
      })
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'funding.risk.assessment.calculate',
      entityType: 'risk_assessment',
      entityId: created!.id,
      newValues: { score: created!.score, riskLevel: created!.riskLevel },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created!, 201);
  },
);
