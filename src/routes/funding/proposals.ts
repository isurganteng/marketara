import { and, asc, count, desc, eq, ilike, isNull, or, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  businessDocuments,
  businessPlans,
  businessProfiles,
  businessProposals,
  dataRoomAccessLogs,
  dataRooms,
  financialProjections,
  fundUtilizationPlans,
  fundingRequirements,
  merchants,
  proposalVersions,
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
  dateOnlySchema,
  fundingMerchantScope,
  getDataRoom,
  getProposal,
  numericSchema,
  optionalText,
  toNumber,
} from '../funding/shared';

const proposalStatusSchema = z.enum([
  'draft',
  'in_review',
  'submitted',
  'published',
  'funded',
  'rejected',
  'archived',
]);
const proposalVersionStatusSchema = z.enum(['draft', 'final', 'archived']);
const planStatusSchema = z.enum(['draft', 'approved', 'archived']);
const projectionTypeSchema = z.enum(['revenue', 'expense', 'profit', 'cash_flow', 'other']);
const requirementTypeSchema = z.enum([
  'equity',
  'debt',
  'grant',
  'working_capital',
  'asset',
  'other',
]);
const utilizationStatusSchema = z.enum(['planned', 'approved', 'in_progress', 'completed']);
const documentStatusSchema = z.enum(['pending', 'verified', 'rejected', 'expired']);
const dataRoomStatusSchema = z.enum(['draft', 'active', 'archived']);
const instrumentTypeSchema = z.enum([
  'equity',
  'debt',
  'grant',
  'convertible_note',
  'revenue_sharing',
  'other',
]);

/* ------------------------------- Schemas ----------------------------- */

const listProposalSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  status: proposalStatusSchema.optional(),
  fundingType: instrumentTypeSchema.optional(),
});

const createProposalSchema = z.object({
  merchantId: z.uuid(),
  profileId: z.uuid().optional(),
  code: codeSchema.optional(),
  title: z.string().trim().min(2).max(255),
  summary: optionalText(),
  targetAmount: numericSchema.default('0'),
  currency: z.string().trim().length(3).default('IDR'),
  valuation: numericSchema.optional(),
  equityOffered: numericSchema.optional(),
  fundingType: instrumentTypeSchema.default('equity'),
  expiresAt: z.string().datetime({ offset: true }).optional(),
});

const updateProposalSchema = z.object({
  profileId: z.uuid().nullable().optional(),
  code: codeSchema.optional(),
  title: z.string().trim().min(2).max(255).optional(),
  summary: optionalText(),
  status: proposalStatusSchema.optional(),
  targetAmount: numericSchema.optional(),
  currency: z.string().trim().length(3).optional(),
  valuation: numericSchema.nullable().optional(),
  equityOffered: numericSchema.nullable().optional(),
  fundingType: instrumentTypeSchema.optional(),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
});

const versionInputSchema = z.object({
  title: z.string().trim().min(2).max(255),
  summary: optionalText(),
  content: optionalText(20000),
  changeNotes: optionalText(),
  fileUrl: optionalText(2048),
  status: proposalVersionStatusSchema.default('draft'),
});

const planInputSchema = z.object({
  title: z.string().trim().min(2).max(255),
  executiveSummary: optionalText(),
  marketAnalysis: optionalText(),
  businessModel: optionalText(),
  strategy: optionalText(),
  team: optionalText(),
  milestones: z.record(z.string(), z.unknown()).optional(),
  status: planStatusSchema.default('draft'),
});

const projectionInputSchema = z.object({
  projectionType: projectionTypeSchema,
  periodLabel: z.string().trim().min(1).max(64),
  periodStart: dateOnlySchema.optional(),
  periodEnd: dateOnlySchema.optional(),
  amount: numericSchema.default('0'),
  assumptions: optionalText(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

const requirementInputSchema = z.object({
  requirementType: requirementTypeSchema.default('equity'),
  purpose: z.string().trim().min(2).max(4000),
  amount: numericSchema.default('0'),
  currency: z.string().trim().length(3).default('IDR'),
  minAmount: numericSchema.optional(),
  maxAmount: numericSchema.optional(),
  equityPercent: numericSchema.optional(),
  tenorMonths: z.coerce.number().int().min(0).optional(),
  expectedReturnPercent: numericSchema.optional(),
  notes: optionalText(),
});

const utilizationInputSchema = z.object({
  category: z.string().trim().min(2).max(128),
  description: optionalText(),
  amount: numericSchema.default('0'),
  percentage: numericSchema.optional(),
  timeline: optionalText(128),
  status: utilizationStatusSchema.default('planned'),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

const documentInputSchema = z.object({
  profileId: z.uuid().optional(),
  documentType: z.string().trim().min(2).max(64),
  title: z.string().trim().min(2).max(255),
  fileName: optionalText(255),
  fileUrl: optionalText(2048),
  version: z.coerce.number().int().min(1).default(1),
  status: documentStatusSchema.default('pending'),
  isConfidential: z.boolean().default(false),
  expiresAt: dateOnlySchema.optional(),
  notes: optionalText(),
});

const dataRoomInputSchema = z.object({
  name: z.string().trim().min(2).max(255),
  description: optionalText(),
  status: dataRoomStatusSchema.default('draft'),
  accessLevel: z.string().trim().max(32).default('private'),
});

const accessLogInputSchema = z.object({
  userId: z.uuid().optional(),
  email: z.string().trim().email().max(255).optional(),
  action: z.string().trim().max(64).default('grant'),
  expiresAt: z.string().datetime({ offset: true }).optional(),
});

const listDocumentSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  merchantId: z.uuid().optional(),
  proposalId: z.uuid().optional(),
  status: documentStatusSchema.optional(),
  search: z.string().trim().max(100).optional(),
});

/** Koersi opsional yang aman untuk update parsial. */
const optionalNumeric = numericSchema.optional().nullable();

export const fundingProposalRoutes = new Hono<AppEnv>();

function assertCurrency(value: string) {
  if (!/^[A-Z]{3}$/.test(value)) throw ApiError.badRequest('Kode mata uang harus 3 huruf kapital');
}

/* ------------------------------ Proposals ---------------------------- */

fundingProposalRoutes.get(
  '/proposals',
  requirePermission('funding:read'),
  validate('query', listProposalSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [isNull(businessProposals.deletedAt)];
    const scope = fundingMerchantScope(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(businessProposals.merchantId, query.merchantId));
    if (query.status) conditions.push(eq(businessProposals.status, query.status));
    if (query.fundingType) conditions.push(eq(businessProposals.fundingType, query.fundingType));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(businessProposals.code, term),
          ilike(businessProposals.title, term),
          ilike(merchants.businessName, term),
        ) as SQL,
      );
    }
    const where = and(...conditions);
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: businessProposals.id,
          merchantId: businessProposals.merchantId,
          merchantName: merchants.businessName,
          code: businessProposals.code,
          title: businessProposals.title,
          status: businessProposals.status,
          currentVersion: businessProposals.currentVersion,
          targetAmount: businessProposals.targetAmount,
          currency: businessProposals.currency,
          valuation: businessProposals.valuation,
          equityOffered: businessProposals.equityOffered,
          fundingType: businessProposals.fundingType,
          submittedAt: businessProposals.submittedAt,
          publishedAt: businessProposals.publishedAt,
          expiresAt: businessProposals.expiresAt,
          createdAt: businessProposals.createdAt,
        })
        .from(businessProposals)
        .innerJoin(merchants, eq(merchants.id, businessProposals.merchantId))
        .where(where)
        .orderBy(desc(businessProposals.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(businessProposals)
        .innerJoin(merchants, eq(merchants.id, businessProposals.merchantId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

fundingProposalRoutes.post(
  '/proposals',
  requirePermission('funding:write'),
  validate('json', createProposalSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertFundingAccess(body.merchantId, user, permissions, { manage: true });
    assertCurrency(body.currency);
    const code = body.code ?? generateCode('PRP');
    const [existing] = await db
      .select({ id: businessProposals.id })
      .from(businessProposals)
      .where(
        and(
          eq(businessProposals.merchantId, body.merchantId),
          eq(businessProposals.code, code),
        ),
      )
      .limit(1);
    if (existing) throw ApiError.conflict('Kode proposal sudah digunakan');
    if (body.profileId) {
      const profile = await db.query.businessProfiles.findFirst({
        where: eq(businessProfiles.id, body.profileId),
      });
      if (!profile || profile.merchantId !== body.merchantId) {
        throw ApiError.badRequest('Profil bisnis tidak cocok dengan merchant');
      }
    }
    const created = await db.transaction(async (tx) => {
      const [proposal] = await tx
        .insert(businessProposals)
        .values({
          merchantId: body.merchantId,
          profileId: body.profileId ?? null,
          code,
          title: body.title,
          summary: body.summary ?? null,
          targetAmount: body.targetAmount,
          currency: body.currency,
          valuation: body.valuation ?? null,
          equityOffered: body.equityOffered ?? null,
          fundingType: body.fundingType,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
          createdBy: user.id,
        })
        .returning();
      await tx.insert(proposalVersions).values({
        proposalId: proposal!.id,
        merchantId: body.merchantId,
        version: 1,
        title: body.title,
        summary: body.summary ?? null,
        status: 'draft',
        createdBy: user.id,
      });
      await tx.insert(dataRooms).values({
        proposalId: proposal!.id,
        merchantId: body.merchantId,
        name: `Data room ${body.title}`,
        status: 'draft',
        createdBy: user.id,
      });
      return proposal!;
    });
    await writeAuditLog({
      actorUserId: user.id,
      action: 'funding.proposal.create',
      entityType: 'business_proposal',
      entityId: created.id,
      newValues: { code: created.code, title: created.title },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created, 201);
  },
);

fundingProposalRoutes.get(
  '/proposals/:id',
  requirePermission('funding:read'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { proposal } = await getProposal(c.req.param('id'), user, permissions);
    const [
      versions,
      plans,
      projections,
      requirements,
      utilizationPlans,
      documents,
      dataRoom,
    ] = await Promise.all([
      db
        .select()
        .from(proposalVersions)
        .where(eq(proposalVersions.proposalId, proposal.id))
        .orderBy(desc(proposalVersions.version)),
      db
        .select()
        .from(businessPlans)
        .where(eq(businessPlans.proposalId, proposal.id))
        .orderBy(desc(businessPlans.createdAt)),
      db
        .select()
        .from(financialProjections)
        .where(eq(financialProjections.proposalId, proposal.id))
        .orderBy(asc(financialProjections.sortOrder), asc(financialProjections.periodLabel)),
      db
        .select()
        .from(fundingRequirements)
        .where(eq(fundingRequirements.proposalId, proposal.id))
        .orderBy(desc(fundingRequirements.createdAt)),
      db
        .select()
        .from(fundUtilizationPlans)
        .where(eq(fundUtilizationPlans.proposalId, proposal.id))
        .orderBy(asc(fundUtilizationPlans.sortOrder)),
      db
        .select()
        .from(businessDocuments)
        .where(eq(businessDocuments.proposalId, proposal.id))
        .orderBy(desc(businessDocuments.createdAt)),
      db.query.dataRooms.findFirst({
        where: eq(dataRooms.proposalId, proposal.id),
      }),
    ]);
    return ok(c, {
      ...proposal,
      versions,
      plans,
      projections,
      requirements,
      utilizationPlans,
      documents,
      dataRoom,
    });
  },
);

fundingProposalRoutes.patch(
  '/proposals/:id',
  requirePermission('funding:write'),
  validate('json', updateProposalSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { proposal } = await getProposal(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (body.currency) assertCurrency(body.currency);
    if (body.profileId) {
      const profile = await db.query.businessProfiles.findFirst({
        where: eq(businessProfiles.id, body.profileId),
      });
      if (!profile || profile.merchantId !== proposal.merchantId) {
        throw ApiError.badRequest('Profil bisnis tidak cocok dengan merchant');
      }
    }
    const [updated] = await db
      .update(businessProposals)
      .set({
        ...body,
        profileId: body.profileId ?? undefined,
        summary: body.summary ?? undefined,
        valuation: body.valuation ?? undefined,
        equityOffered: body.equityOffered ?? undefined,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
        publishedAt:
          body.status === 'published' ? proposal.publishedAt ?? new Date() : proposal.publishedAt,
      })
      .where(eq(businessProposals.id, proposal.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'funding.proposal.update',
      entityType: 'business_proposal',
      entityId: proposal.id,
      oldValues: { status: proposal.status, targetAmount: proposal.targetAmount },
      newValues: { status: updated!.status, targetAmount: updated!.targetAmount },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

fundingProposalRoutes.post(
  '/proposals/:id/submit',
  requirePermission('funding:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { proposal } = await getProposal(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (proposal.status === 'archived') throw ApiError.badRequest('Proposal sudah diarsipkan');
    const [updated] = await db
      .update(businessProposals)
      .set({ status: 'submitted', submittedAt: new Date() })
      .where(eq(businessProposals.id, proposal.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'funding.proposal.submit',
      entityType: 'business_proposal',
      entityId: proposal.id,
      oldValues: { status: proposal.status },
      newValues: { status: 'submitted' },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

fundingProposalRoutes.post(
  '/proposals/:id/publish',
  requirePermission('funding:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { proposal } = await getProposal(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (proposal.status === 'archived') throw ApiError.badRequest('Proposal sudah diarsipkan');
    const [updated] = await db
      .update(businessProposals)
      .set({ status: 'published', publishedAt: new Date() })
      .where(eq(businessProposals.id, proposal.id))
      .returning();
    await db
      .update(dataRooms)
      .set({ status: 'active' })
      .where(eq(dataRooms.proposalId, proposal.id));
    await writeAuditLog({
      actorUserId: user.id,
      action: 'funding.proposal.publish',
      entityType: 'business_proposal',
      entityId: proposal.id,
      oldValues: { status: proposal.status },
      newValues: { status: 'published' },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

fundingProposalRoutes.post(
  '/proposals/:id/archive',
  requirePermission('funding:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { proposal } = await getProposal(c.req.param('id'), user, permissions, {
      manage: true,
    });
    const [updated] = await db
      .update(businessProposals)
      .set({ status: 'archived' })
      .where(eq(businessProposals.id, proposal.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'funding.proposal.archive',
      entityType: 'business_proposal',
      entityId: proposal.id,
      oldValues: { status: proposal.status },
      newValues: { status: 'archived' },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

fundingProposalRoutes.delete(
  '/proposals/:id',
  requirePermission('funding:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { proposal } = await getProposal(c.req.param('id'), user, permissions, {
      manage: true,
    });
    await db
      .update(businessProposals)
      .set({ status: 'archived', deletedAt: new Date() })
      .where(eq(businessProposals.id, proposal.id));
    await writeAuditLog({
      actorUserId: user.id,
      action: 'funding.proposal.delete',
      entityType: 'business_proposal',
      entityId: proposal.id,
      oldValues: { code: proposal.code, title: proposal.title },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, { id: proposal.id, deleted: true });
  },
);

/* ------------------------------ Versions ----------------------------- */

fundingProposalRoutes.get(
  '/proposals/:id/versions',
  requirePermission('funding:read'),
  async (c) => {
    const { proposal } = await getProposal(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    const rows = await db
      .select()
      .from(proposalVersions)
      .where(eq(proposalVersions.proposalId, proposal.id))
      .orderBy(desc(proposalVersions.version));
    return ok(c, rows);
  },
);

fundingProposalRoutes.post(
  '/proposals/:id/versions',
  requirePermission('funding:write'),
  validate('json', versionInputSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { proposal } = await getProposal(c.req.param('id'), user, permissions, {
      manage: true,
    });
    const [last] = await db
      .select({ version: proposalVersions.version })
      .from(proposalVersions)
      .where(eq(proposalVersions.proposalId, proposal.id))
      .orderBy(desc(proposalVersions.version))
      .limit(1);
    const nextVersion = (last?.version ?? 0) + 1;
    const created = await db.transaction(async (tx) => {
      if (body.status === 'final') {
        await tx
          .update(proposalVersions)
          .set({ status: 'archived' })
          .where(
            and(
              eq(proposalVersions.proposalId, proposal.id),
              eq(proposalVersions.status, 'final'),
            ),
          );
      }
      const [version] = await tx
        .insert(proposalVersions)
        .values({
          proposalId: proposal.id,
          merchantId: proposal.merchantId,
          version: nextVersion,
          title: body.title,
          summary: body.summary ?? null,
          content: body.content ?? null,
          changeNotes: body.changeNotes ?? null,
          fileUrl: body.fileUrl ?? null,
          status: body.status,
          createdBy: user.id,
        })
        .returning();
      await tx
        .update(businessProposals)
        .set({
          currentVersion: nextVersion,
          title: body.title,
          summary: body.summary ?? proposal.summary,
        })
        .where(eq(businessProposals.id, proposal.id));
      return version!;
    });
    await writeAuditLog({
      actorUserId: user.id,
      action: 'funding.proposal.version.create',
      entityType: 'proposal_version',
      entityId: created.id,
      newValues: { proposalId: proposal.id, version: created.version },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created, 201);
  },
);

fundingProposalRoutes.patch(
  '/proposal-versions/:id',
  requirePermission('funding:write'),
  validate('json', versionInputSchema.partial()),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const row = await db.query.proposalVersions.findFirst({
      where: eq(proposalVersions.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Versi proposal tidak ditemukan');
    await assertFundingAccess(row.merchantId, user, permissions, { manage: true });
    const [updated] = await db
      .update(proposalVersions)
      .set({
        ...body,
        summary: body.summary ?? undefined,
        content: body.content ?? undefined,
        changeNotes: body.changeNotes ?? undefined,
        fileUrl: body.fileUrl ?? undefined,
      })
      .where(eq(proposalVersions.id, row.id))
      .returning();
    return ok(c, updated!);
  },
);

/* --------------------------- Business plans -------------------------- */

fundingProposalRoutes.get(
  '/proposals/:id/plans',
  requirePermission('funding:read'),
  async (c) => {
    const { proposal } = await getProposal(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    const rows = await db
      .select()
      .from(businessPlans)
      .where(eq(businessPlans.proposalId, proposal.id))
      .orderBy(desc(businessPlans.createdAt));
    return ok(c, rows);
  },
);

fundingProposalRoutes.post(
  '/proposals/:id/plans',
  requirePermission('funding:write'),
  validate('json', planInputSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { proposal } = await getProposal(c.req.param('id'), user, permissions, {
      manage: true,
    });
    const [created] = await db
      .insert(businessPlans)
      .values({
        proposalId: proposal.id,
        merchantId: proposal.merchantId,
        title: body.title,
        executiveSummary: body.executiveSummary ?? null,
        marketAnalysis: body.marketAnalysis ?? null,
        businessModel: body.businessModel ?? null,
        strategy: body.strategy ?? null,
        team: body.team ?? null,
        milestones: body.milestones ?? null,
        status: body.status,
      })
      .returning();
    return ok(c, created!, 201);
  },
);

fundingProposalRoutes.patch(
  '/business-plans/:id',
  requirePermission('funding:write'),
  validate('json', planInputSchema.partial()),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const row = await db.query.businessPlans.findFirst({
      where: eq(businessPlans.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Rencana bisnis tidak ditemukan');
    await assertFundingAccess(row.merchantId, user, permissions, { manage: true });
    const [updated] = await db
      .update(businessPlans)
      .set({
        ...body,
        executiveSummary: body.executiveSummary ?? undefined,
        marketAnalysis: body.marketAnalysis ?? undefined,
        businessModel: body.businessModel ?? undefined,
        strategy: body.strategy ?? undefined,
        team: body.team ?? undefined,
        milestones: body.milestones ?? undefined,
      })
      .where(eq(businessPlans.id, row.id))
      .returning();
    return ok(c, updated!);
  },
);

fundingProposalRoutes.delete(
  '/business-plans/:id',
  requirePermission('funding:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const row = await db.query.businessPlans.findFirst({
      where: eq(businessPlans.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Rencana bisnis tidak ditemukan');
    await assertFundingAccess(row.merchantId, user, permissions, { manage: true });
    await db.delete(businessPlans).where(eq(businessPlans.id, row.id));
    return ok(c, { id: row.id, deleted: true });
  },
);

/* ------------------------ Financial projections ---------------------- */

fundingProposalRoutes.get(
  '/proposals/:id/projections',
  requirePermission('funding:read'),
  async (c) => {
    const { proposal } = await getProposal(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    const rows = await db
      .select()
      .from(financialProjections)
      .where(eq(financialProjections.proposalId, proposal.id))
      .orderBy(asc(financialProjections.sortOrder), asc(financialProjections.periodLabel));
    return ok(c, rows);
  },
);

fundingProposalRoutes.post(
  '/proposals/:id/projections',
  requirePermission('funding:write'),
  validate('json', projectionInputSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { proposal } = await getProposal(c.req.param('id'), user, permissions, {
      manage: true,
    });
    const [created] = await db
      .insert(financialProjections)
      .values({
        proposalId: proposal.id,
        merchantId: proposal.merchantId,
        projectionType: body.projectionType,
        periodLabel: body.periodLabel,
        periodStart: body.periodStart ?? null,
        periodEnd: body.periodEnd ?? null,
        amount: body.amount,
        assumptions: body.assumptions ?? null,
        sortOrder: body.sortOrder,
      })
      .returning();
    return ok(c, created!, 201);
  },
);

fundingProposalRoutes.patch(
  '/financial-projections/:id',
  requirePermission('funding:write'),
  validate('json', projectionInputSchema.partial()),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const row = await db.query.financialProjections.findFirst({
      where: eq(financialProjections.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Proyeksi keuangan tidak ditemukan');
    await assertFundingAccess(row.merchantId, user, permissions, { manage: true });
    const [updated] = await db
      .update(financialProjections)
      .set({
        ...body,
        periodStart: body.periodStart ?? undefined,
        periodEnd: body.periodEnd ?? undefined,
        assumptions: body.assumptions ?? undefined,
      })
      .where(eq(financialProjections.id, row.id))
      .returning();
    return ok(c, updated!);
  },
);

fundingProposalRoutes.delete(
  '/financial-projections/:id',
  requirePermission('funding:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const row = await db.query.financialProjections.findFirst({
      where: eq(financialProjections.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Proyeksi keuangan tidak ditemukan');
    await assertFundingAccess(row.merchantId, user, permissions, { manage: true });
    await db.delete(financialProjections).where(eq(financialProjections.id, row.id));
    return ok(c, { id: row.id, deleted: true });
  },
);

/* ------------------------- Funding requirements ---------------------- */

fundingProposalRoutes.get(
  '/proposals/:id/requirements',
  requirePermission('funding:read'),
  async (c) => {
    const { proposal } = await getProposal(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    const rows = await db
      .select()
      .from(fundingRequirements)
      .where(eq(fundingRequirements.proposalId, proposal.id))
      .orderBy(desc(fundingRequirements.createdAt));
    return ok(c, rows);
  },
);

fundingProposalRoutes.post(
  '/proposals/:id/requirements',
  requirePermission('funding:write'),
  validate('json', requirementInputSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { proposal } = await getProposal(c.req.param('id'), user, permissions, {
      manage: true,
    });
    assertCurrency(body.currency);
    const [created] = await db
      .insert(fundingRequirements)
      .values({
        proposalId: proposal.id,
        merchantId: proposal.merchantId,
        requirementType: body.requirementType,
        purpose: body.purpose,
        amount: body.amount,
        currency: body.currency,
        minAmount: body.minAmount ?? null,
        maxAmount: body.maxAmount ?? null,
        equityPercent: body.equityPercent ?? null,
        tenorMonths: body.tenorMonths ?? null,
        expectedReturnPercent: body.expectedReturnPercent ?? null,
        notes: body.notes ?? null,
      })
      .returning();
    return ok(c, created!, 201);
  },
);

fundingProposalRoutes.patch(
  '/funding-requirements/:id',
  requirePermission('funding:write'),
  validate('json', requirementInputSchema.partial()),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const row = await db.query.fundingRequirements.findFirst({
      where: eq(fundingRequirements.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Kebutuhan pendanaan tidak ditemukan');
    await assertFundingAccess(row.merchantId, user, permissions, { manage: true });
    if (body.currency) assertCurrency(body.currency);
    const [updated] = await db
      .update(fundingRequirements)
      .set({
        ...body,
        minAmount: body.minAmount ?? undefined,
        maxAmount: body.maxAmount ?? undefined,
        equityPercent: body.equityPercent ?? undefined,
        tenorMonths: body.tenorMonths ?? undefined,
        expectedReturnPercent: body.expectedReturnPercent ?? undefined,
        notes: body.notes ?? undefined,
      })
      .where(eq(fundingRequirements.id, row.id))
      .returning();
    return ok(c, updated!);
  },
);

fundingProposalRoutes.delete(
  '/funding-requirements/:id',
  requirePermission('funding:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const row = await db.query.fundingRequirements.findFirst({
      where: eq(fundingRequirements.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Kebutuhan pendanaan tidak ditemukan');
    await assertFundingAccess(row.merchantId, user, permissions, { manage: true });
    await db.delete(fundingRequirements).where(eq(fundingRequirements.id, row.id));
    return ok(c, { id: row.id, deleted: true });
  },
);

/* --------------------------- Fund utilization ------------------------ */

fundingProposalRoutes.get(
  '/proposals/:id/utilization-plans',
  requirePermission('funding:read'),
  async (c) => {
    const { proposal } = await getProposal(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    const rows = await db
      .select()
      .from(fundUtilizationPlans)
      .where(eq(fundUtilizationPlans.proposalId, proposal.id))
      .orderBy(asc(fundUtilizationPlans.sortOrder));
    return ok(c, rows);
  },
);

fundingProposalRoutes.post(
  '/proposals/:id/utilization-plans',
  requirePermission('funding:write'),
  validate('json', utilizationInputSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { proposal } = await getProposal(c.req.param('id'), user, permissions, {
      manage: true,
    });
    const [created] = await db
      .insert(fundUtilizationPlans)
      .values({
        proposalId: proposal.id,
        merchantId: proposal.merchantId,
        category: body.category,
        description: body.description ?? null,
        amount: body.amount,
        percentage: body.percentage ?? null,
        timeline: body.timeline ?? null,
        status: body.status,
        sortOrder: body.sortOrder,
      })
      .returning();
    return ok(c, created!, 201);
  },
);

fundingProposalRoutes.patch(
  '/fund-utilization-plans/:id',
  requirePermission('funding:write'),
  validate('json', utilizationInputSchema.partial()),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const row = await db.query.fundUtilizationPlans.findFirst({
      where: eq(fundUtilizationPlans.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Rencana penggunaan dana tidak ditemukan');
    await assertFundingAccess(row.merchantId, user, permissions, { manage: true });
    const [updated] = await db
      .update(fundUtilizationPlans)
      .set({
        ...body,
        description: body.description ?? undefined,
        percentage: body.percentage ?? undefined,
        timeline: body.timeline ?? undefined,
      })
      .where(eq(fundUtilizationPlans.id, row.id))
      .returning();
    return ok(c, updated!);
  },
);

fundingProposalRoutes.delete(
  '/fund-utilization-plans/:id',
  requirePermission('funding:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const row = await db.query.fundUtilizationPlans.findFirst({
      where: eq(fundUtilizationPlans.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Rencana penggunaan dana tidak ditemukan');
    await assertFundingAccess(row.merchantId, user, permissions, { manage: true });
    await db.delete(fundUtilizationPlans).where(eq(fundUtilizationPlans.id, row.id));
    return ok(c, { id: row.id, deleted: true });
  },
);

/* ----------------------------- Documents ----------------------------- */

fundingProposalRoutes.get(
  '/documents',
  requirePermission('funding:read'),
  validate('query', listDocumentSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = fundingMerchantScope(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(businessDocuments.merchantId, query.merchantId));
    if (query.proposalId) conditions.push(eq(businessDocuments.proposalId, query.proposalId));
    if (query.status) conditions.push(eq(businessDocuments.status, query.status));
    if (query.search) {
      conditions.push(
        or(
          ilike(businessDocuments.title, `%${query.search}%`),
          ilike(businessDocuments.documentType, `%${query.search}%`),
        ) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: businessDocuments.id,
          merchantId: businessDocuments.merchantId,
          merchantName: merchants.businessName,
          proposalId: businessDocuments.proposalId,
          documentType: businessDocuments.documentType,
          title: businessDocuments.title,
          fileName: businessDocuments.fileName,
          fileUrl: businessDocuments.fileUrl,
          version: businessDocuments.version,
          status: businessDocuments.status,
          isConfidential: businessDocuments.isConfidential,
          expiresAt: businessDocuments.expiresAt,
          createdAt: businessDocuments.createdAt,
        })
        .from(businessDocuments)
        .innerJoin(merchants, eq(merchants.id, businessDocuments.merchantId))
        .where(where)
        .orderBy(desc(businessDocuments.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(businessDocuments)
        .innerJoin(merchants, eq(merchants.id, businessDocuments.merchantId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

fundingProposalRoutes.get(
  '/proposals/:id/documents',
  requirePermission('funding:read'),
  async (c) => {
    const { proposal } = await getProposal(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    const rows = await db
      .select()
      .from(businessDocuments)
      .where(eq(businessDocuments.proposalId, proposal.id))
      .orderBy(desc(businessDocuments.createdAt));
    return ok(c, rows);
  },
);

fundingProposalRoutes.post(
  '/proposals/:id/documents',
  requirePermission('funding:write'),
  validate('json', documentInputSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { proposal } = await getProposal(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (body.profileId) {
      const profile = await db.query.businessProfiles.findFirst({
        where: eq(businessProfiles.id, body.profileId),
      });
      if (!profile || profile.merchantId !== proposal.merchantId) {
        throw ApiError.badRequest('Profil bisnis tidak cocok dengan merchant');
      }
    }
    const [created] = await db
      .insert(businessDocuments)
      .values({
        merchantId: proposal.merchantId,
        proposalId: proposal.id,
        profileId: body.profileId ?? proposal.profileId,
        documentType: body.documentType,
        title: body.title,
        fileName: body.fileName ?? null,
        fileUrl: body.fileUrl ?? null,
        version: body.version,
        status: body.status,
        isConfidential: body.isConfidential,
        expiresAt: body.expiresAt ?? null,
        notes: body.notes ?? null,
        uploadedBy: user.id,
      })
      .returning();
    return ok(c, created!, 201);
  },
);

fundingProposalRoutes.patch(
  '/business-documents/:id',
  requirePermission('funding:write'),
  validate('json', documentInputSchema.partial()),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const row = await db.query.businessDocuments.findFirst({
      where: eq(businessDocuments.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Dokumen bisnis tidak ditemukan');
    await assertFundingAccess(row.merchantId, user, permissions, { manage: true });
    const [updated] = await db
      .update(businessDocuments)
      .set({
        ...body,
        fileName: body.fileName ?? undefined,
        fileUrl: body.fileUrl ?? undefined,
        expiresAt: body.expiresAt ?? undefined,
        notes: body.notes ?? undefined,
        verifiedBy: body.status === 'verified' ? user.id : undefined,
        verifiedAt: body.status === 'verified' ? new Date() : undefined,
      })
      .where(eq(businessDocuments.id, row.id))
      .returning();
    return ok(c, updated!);
  },
);

fundingProposalRoutes.delete(
  '/business-documents/:id',
  requirePermission('funding:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const row = await db.query.businessDocuments.findFirst({
      where: eq(businessDocuments.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Dokumen bisnis tidak ditemukan');
    await assertFundingAccess(row.merchantId, user, permissions, { manage: true });
    await db.delete(businessDocuments).where(eq(businessDocuments.id, row.id));
    return ok(c, { id: row.id, deleted: true });
  },
);

/* ------------------------------ Data room ---------------------------- */

fundingProposalRoutes.get(
  '/proposals/:id/data-room',
  requirePermission('funding:read'),
  async (c) => {
    const { proposal } = await getProposal(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    const dataRoom = await db.query.dataRooms.findFirst({
      where: eq(dataRooms.proposalId, proposal.id),
    });
    if (!dataRoom) throw ApiError.notFound('Data room belum dibuat');
    const logs = await db
      .select()
      .from(dataRoomAccessLogs)
      .where(eq(dataRoomAccessLogs.dataRoomId, dataRoom.id))
      .orderBy(desc(dataRoomAccessLogs.accessedAt));
    return ok(c, { ...dataRoom, accessLogs: logs });
  },
);

fundingProposalRoutes.patch(
  '/proposals/:id/data-room',
  requirePermission('funding:write'),
  validate('json', dataRoomInputSchema.partial()),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { proposal } = await getProposal(c.req.param('id'), user, permissions, {
      manage: true,
    });
    let dataRoom = await db.query.dataRooms.findFirst({
      where: eq(dataRooms.proposalId, proposal.id),
    });
    if (!dataRoom) {
      [dataRoom] = await db
        .insert(dataRooms)
        .values({
          proposalId: proposal.id,
          merchantId: proposal.merchantId,
          name: body.name ?? `Data room ${proposal.title}`,
          description: body.description ?? null,
          status: body.status ?? 'draft',
          accessLevel: body.accessLevel ?? 'private',
          createdBy: user.id,
        })
        .returning();
    } else {
      [dataRoom] = await db
        .update(dataRooms)
        .set({
          ...body,
          description: body.description ?? undefined,
        })
        .where(eq(dataRooms.id, dataRoom.id))
        .returning();
    }
    return ok(c, dataRoom!);
  },
);

fundingProposalRoutes.get(
  '/data-rooms/:id/access-logs',
  requirePermission('funding:read'),
  async (c) => {
    const { dataRoom } = await getDataRoom(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    const rows = await db
      .select()
      .from(dataRoomAccessLogs)
      .where(eq(dataRoomAccessLogs.dataRoomId, dataRoom.id))
      .orderBy(desc(dataRoomAccessLogs.accessedAt));
    return ok(c, rows);
  },
);

fundingProposalRoutes.post(
  '/data-rooms/:id/access',
  requirePermission('funding:write'),
  validate('json', accessLogInputSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { dataRoom } = await getDataRoom(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (!body.userId && !body.email) throw ApiError.badRequest('Penerima akses wajib diisi');
    const [created] = await db
      .insert(dataRoomAccessLogs)
      .values({
        dataRoomId: dataRoom.id,
        merchantId: dataRoom.merchantId,
        userId: body.userId ?? null,
        email: body.email ?? null,
        action: body.action,
        status: 'active',
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      })
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'funding.data_room.access.grant',
      entityType: 'data_room_access_log',
      entityId: created!.id,
      newValues: { dataRoomId: dataRoom.id, email: created!.email },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created!, 201);
  },
);

fundingProposalRoutes.post(
  '/data-room-access/:id/revoke',
  requirePermission('funding:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const row = await db.query.dataRoomAccessLogs.findFirst({
      where: eq(dataRoomAccessLogs.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Akses data room tidak ditemukan');
    await assertFundingAccess(row.merchantId, user, permissions, { manage: true });
    const [updated] = await db
      .update(dataRoomAccessLogs)
      .set({ status: 'revoked', revokedAt: new Date() })
      .where(eq(dataRoomAccessLogs.id, row.id))
      .returning();
    return ok(c, updated!);
  },
);
