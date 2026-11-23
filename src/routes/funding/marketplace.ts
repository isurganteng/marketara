import { and, count, desc, eq, ilike, inArray, isNull, or, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  businessProposals,
  fundingApplicationStatuses,
  fundingApplications,
  fundingMatches,
  fundingOpportunities,
  fundingPartnerReferrals,
  investorInterests,
  investorProfiles,
  merchants,
  organizationMembers,
} from '../../db/schema';
import { isOrgManager, isPlatformAdmin } from '../../lib/access';
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
  assertInvestorManage,
  assertOpportunityManage,
  codeSchema,
  dateOnlySchema,
  fundingMerchantScope,
  getApplication,
  getInvestor,
  getOpportunity,
  getProposal,
  money,
  numericSchema,
  optionalText,
  toNumber,
} from '../funding/shared';

const opportunityStatusSchema = z.enum(['draft', 'open', 'closed', 'archived']);
const instrumentTypeSchema = z.enum([
  'equity',
  'debt',
  'grant',
  'convertible_note',
  'revenue_sharing',
  'other',
]);
const investorTypeSchema = z.enum([
  'individual',
  'angel',
  'venture_capital',
  'private_equity',
  'bank',
  'cooperative',
  'government',
  'other',
]);
const investorStatusSchema = z.enum(['active', 'inactive', 'suspended']);
const applicationStatusSchema = z.enum([
  'draft',
  'submitted',
  'under_review',
  'shortlisted',
  'approved',
  'rejected',
  'withdrawn',
  'funded',
]);
const matchStatusSchema = z.enum(['suggested', 'interested', 'accepted', 'declined', 'closed']);
const interestStatusSchema = z.enum([
  'new',
  'reviewing',
  'interested',
  'declined',
  'converted',
  'withdrawn',
]);
const referralStatusSchema = z.enum(['pending', 'contacted', 'converted', 'rejected']);

/* ------------------------------- Schemas ----------------------------- */

const listOpportunitySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  status: opportunityStatusSchema.optional(),
  instrumentType: instrumentTypeSchema.optional(),
  providerType: investorTypeSchema.optional(),
});

const opportunityInputSchema = z.object({
  code: codeSchema.optional(),
  title: z.string().trim().min(2).max(255),
  description: optionalText(),
  instrumentType: instrumentTypeSchema.default('equity'),
  providerName: z.string().trim().min(2).max(255),
  providerType: investorTypeSchema.default('other'),
  minAmount: numericSchema.default('0'),
  maxAmount: numericSchema.default('0'),
  currency: z.string().trim().length(3).default('IDR'),
  interestRate: numericSchema.optional(),
  equityPercent: numericSchema.optional(),
  tenorMonths: z.coerce.number().int().min(0).optional(),
  eligibility: z.record(z.string(), z.unknown()).optional(),
  requirements: optionalText(),
  status: opportunityStatusSchema.default('draft'),
  opensAt: z.string().datetime({ offset: true }).optional(),
  closesAt: z.string().datetime({ offset: true }).optional(),
  organizationId: z.uuid().optional(),
});

const updateOpportunitySchema = opportunityInputSchema.partial();

const listInvestorSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  status: investorStatusSchema.optional(),
  investorType: investorTypeSchema.optional(),
});

const investorInputSchema = z.object({
  userId: z.uuid().optional(),
  organizationId: z.uuid().optional(),
  displayName: z.string().trim().min(2).max(255),
  investorType: investorTypeSchema.default('individual'),
  status: investorStatusSchema.default('active'),
  email: z.string().trim().email().max(255).optional(),
  phone: optionalText(32),
  website: optionalText(255),
  description: optionalText(),
  investmentFocus: z.record(z.string(), z.unknown()).optional(),
  minTicket: numericSchema.optional(),
  maxTicket: numericSchema.optional(),
  currency: z.string().trim().length(3).default('IDR'),
  preferredStages: z.array(z.string().trim().max(64)).optional(),
  preferredSectors: z.array(z.string().trim().max(128)).optional(),
});

const updateInvestorSchema = investorInputSchema.partial();

const listApplicationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  proposalId: z.uuid().optional(),
  opportunityId: z.uuid().optional(),
  status: applicationStatusSchema.optional(),
});

const createApplicationSchema = z.object({
  merchantId: z.uuid(),
  proposalId: z.uuid(),
  opportunityId: z.uuid().optional(),
  investorProfileId: z.uuid().optional(),
  requestedAmount: numericSchema,
  currency: z.string().trim().length(3).default('IDR'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const updateApplicationSchema = z.object({
  opportunityId: z.uuid().nullable().optional(),
  investorProfileId: z.uuid().nullable().optional(),
  requestedAmount: numericSchema.optional(),
  approvedAmount: numericSchema.nullable().optional(),
  currency: z.string().trim().length(3).optional(),
  decisionNotes: optionalText(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const transitionSchema = z.object({
  status: applicationStatusSchema,
  approvedAmount: numericSchema.optional(),
  note: optionalText(),
});

const listMatchSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  merchantId: z.uuid().optional(),
  applicationId: z.uuid().optional(),
  status: matchStatusSchema.optional(),
});

const createMatchSchema = z.object({
  merchantId: z.uuid(),
  applicationId: z.uuid().optional(),
  opportunityId: z.uuid().optional(),
  investorProfileId: z.uuid().optional(),
  score: z.coerce.number().min(0).max(100).optional(),
  notes: optionalText(),
});

const updateMatchSchema = z.object({
  status: matchStatusSchema.optional(),
  score: z.coerce.number().min(0).max(100).optional(),
  notes: optionalText(),
});

const suggestMatchSchema = z.object({
  merchantId: z.uuid(),
  applicationId: z.uuid().optional(),
});

const listInterestSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  merchantId: z.uuid().optional(),
  investorProfileId: z.uuid().optional(),
  status: interestStatusSchema.optional(),
});

const interestInputSchema = z.object({
  merchantId: z.uuid(),
  investorProfileId: z.uuid(),
  proposalId: z.uuid().optional(),
  opportunityId: z.uuid().optional(),
  applicationId: z.uuid().optional(),
  status: interestStatusSchema.default('new'),
  message: optionalText(),
  amount: numericSchema.optional(),
});

const updateInterestSchema = z.object({
  status: interestStatusSchema.optional(),
  message: optionalText(),
  amount: numericSchema.nullable().optional(),
});

const listReferralSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  merchantId: z.uuid().optional(),
  status: referralStatusSchema.optional(),
  search: z.string().trim().max(100).optional(),
});

const referralInputSchema = z.object({
  merchantId: z.uuid(),
  applicationId: z.uuid().optional(),
  opportunityId: z.uuid().optional(),
  partnerName: z.string().trim().min(2).max(255),
  partnerType: investorTypeSchema.default('other'),
  contactName: optionalText(255),
  contactEmail: z.string().trim().email().max(255).optional(),
  contactPhone: optionalText(32),
  status: referralStatusSchema.default('pending'),
  referralCode: optionalText(64),
  notes: optionalText(),
});

const updateReferralSchema = referralInputSchema.omit({ merchantId: true }).partial();

export const fundingMarketplaceRoutes = new Hono<AppEnv>();

function assertCurrency(currency: string) {
  if (!/^[A-Z]{3}$/.test(currency)) throw ApiError.badRequest('Kode mata uang harus 3 huruf kapital');
}

async function assertOrgManager(organizationId: string, userId: string) {
  const membership = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.userId, userId),
      eq(organizationMembers.status, 'active'),
    ),
  });
  if (!membership) throw ApiError.forbidden('Anda bukan anggota organisasi');
  if (!isOrgManager(membership.role)) {
    throw ApiError.forbidden('Hanya owner atau admin organisasi yang dapat mengelola data ini');
  }
}

function opportunityScope(userId: string, permissions: Set<string>): SQL | undefined {
  if (isPlatformAdmin(permissions)) return undefined;
  return or(
    eq(fundingOpportunities.status, 'open'),
    eq(fundingOpportunities.ownerUserId, userId),
    inArray(
      fundingOpportunities.organizationId,
      db
        .select({ id: organizationMembers.organizationId })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.userId, userId),
            eq(organizationMembers.status, 'active'),
          ),
        ),
    ),
  ) as SQL;
}

function investorScope(userId: string, permissions: Set<string>): SQL | undefined {
  if (isPlatformAdmin(permissions)) return undefined;
  return or(
    eq(investorProfiles.status, 'active'),
    eq(investorProfiles.userId, userId),
    inArray(
      investorProfiles.organizationId,
      db
        .select({ id: organizationMembers.organizationId })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.userId, userId),
            eq(organizationMembers.status, 'active'),
          ),
        ),
    ),
  ) as SQL;
}

async function transitionApplication(
  applicationId: string,
  toStatus: z.infer<typeof applicationStatusSchema>,
  userId: string,
  ipAddress: string | null,
  userAgent: string | null,
  options: { approvedAmount?: string | null; note?: string | null } = {},
) {
  const application = await db.query.fundingApplications.findFirst({
    where: eq(fundingApplications.id, applicationId),
  });
  if (!application) throw ApiError.notFound('Pengajuan pendanaan tidak ditemukan');
  const [updated] = await db
    .update(fundingApplications)
    .set({
      status: toStatus,
      approvedAmount:
        options.approvedAmount === undefined ? application.approvedAmount : options.approvedAmount,
      submittedAt: toStatus === 'submitted' ? new Date() : application.submittedAt,
      reviewedAt:
        toStatus === 'under_review' ||
        toStatus === 'shortlisted' ||
        toStatus === 'approved' ||
        toStatus === 'rejected'
          ? new Date()
          : application.reviewedAt,
      reviewedBy: toStatus === 'draft' ? application.reviewedBy : userId,
      decisionNotes: options.note ?? application.decisionNotes,
    })
    .where(eq(fundingApplications.id, application.id))
    .returning();
  await db.insert(fundingApplicationStatuses).values({
    applicationId: application.id,
    merchantId: application.merchantId,
    fromStatus: application.status,
    toStatus,
    note: options.note ?? null,
    changedBy: userId,
  });
  await writeAuditLog({
    actorUserId: userId,
    action: `funding.application.${toStatus}`,
    entityType: 'funding_application',
    entityId: application.id,
    oldValues: { status: application.status },
    newValues: { status: toStatus, approvedAmount: updated!.approvedAmount },
    ipAddress,
    userAgent,
  });
  return updated!;
}

/* --------------------------- Opportunities --------------------------- */

fundingMarketplaceRoutes.get(
  '/opportunities',
  requirePermission('funding:read'),
  validate('query', listOpportunitySchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = opportunityScope(user.id, permissions);
    if (scope) conditions.push(scope);
    if (query.status) conditions.push(eq(fundingOpportunities.status, query.status));
    if (query.instrumentType) {
      conditions.push(eq(fundingOpportunities.instrumentType, query.instrumentType));
    }
    if (query.providerType) conditions.push(eq(fundingOpportunities.providerType, query.providerType));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(fundingOpportunities.code, term),
          ilike(fundingOpportunities.title, term),
          ilike(fundingOpportunities.providerName, term),
        ) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(fundingOpportunities)
        .where(where)
        .orderBy(desc(fundingOpportunities.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(fundingOpportunities).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

fundingMarketplaceRoutes.post(
  '/opportunities',
  requirePermission('funding:write'),
  validate('json', opportunityInputSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    assertCurrency(body.currency);
    if (body.organizationId) await assertOrgManager(body.organizationId, user.id);
    const code = body.code ?? generateCode('OPP');
    const [existing] = await db
      .select({ id: fundingOpportunities.id })
      .from(fundingOpportunities)
      .where(eq(fundingOpportunities.code, code))
      .limit(1);
    if (existing) throw ApiError.conflict('Kode peluang sudah digunakan');
    const [created] = await db
      .insert(fundingOpportunities)
      .values({
        code,
        title: body.title,
        description: body.description ?? null,
        instrumentType: body.instrumentType,
        providerName: body.providerName,
        providerType: body.providerType,
        minAmount: body.minAmount,
        maxAmount: body.maxAmount,
        currency: body.currency,
        interestRate: body.interestRate ?? null,
        equityPercent: body.equityPercent ?? null,
        tenorMonths: body.tenorMonths ?? null,
        eligibility: body.eligibility ?? null,
        requirements: body.requirements ?? null,
        status: body.status,
        opensAt: body.opensAt ? new Date(body.opensAt) : null,
        closesAt: body.closesAt ? new Date(body.closesAt) : null,
        ownerUserId: user.id,
        organizationId: body.organizationId ?? null,
      })
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'funding.opportunity.create',
      entityType: 'funding_opportunity',
      entityId: created!.id,
      newValues: { code: created!.code, title: created!.title },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created!, 201);
  },
);

fundingMarketplaceRoutes.get(
  '/opportunities/:id',
  requirePermission('funding:read'),
  async (c) => {
    const opportunity = await getOpportunity(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    return ok(c, opportunity);
  },
);

fundingMarketplaceRoutes.patch(
  '/opportunities/:id',
  requirePermission('funding:write'),
  validate('json', updateOpportunitySchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const opportunity = await getOpportunity(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (body.currency) assertCurrency(body.currency);
    if (body.organizationId) await assertOrgManager(body.organizationId, user.id);
    const [updated] = await db
      .update(fundingOpportunities)
      .set({
        ...body,
        description: body.description ?? undefined,
        interestRate: body.interestRate ?? undefined,
        equityPercent: body.equityPercent ?? undefined,
        tenorMonths: body.tenorMonths ?? undefined,
        eligibility: body.eligibility ?? undefined,
        requirements: body.requirements ?? undefined,
        opensAt: body.opensAt ? new Date(body.opensAt) : undefined,
        closesAt: body.closesAt ? new Date(body.closesAt) : undefined,
        organizationId: body.organizationId ?? undefined,
      })
      .where(eq(fundingOpportunities.id, opportunity.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'funding.opportunity.update',
      entityType: 'funding_opportunity',
      entityId: opportunity.id,
      oldValues: { status: opportunity.status },
      newValues: { status: updated!.status },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

fundingMarketplaceRoutes.delete(
  '/opportunities/:id',
  requirePermission('funding:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const opportunity = await getOpportunity(c.req.param('id'), user, permissions, {
      manage: true,
    });
    await db
      .update(fundingOpportunities)
      .set({ status: 'archived' })
      .where(eq(fundingOpportunities.id, opportunity.id));
    await writeAuditLog({
      actorUserId: user.id,
      action: 'funding.opportunity.archive',
      entityType: 'funding_opportunity',
      entityId: opportunity.id,
      oldValues: { status: opportunity.status },
      newValues: { status: 'archived' },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, { id: opportunity.id, status: 'archived' });
  },
);

/* ----------------------------- Investors ----------------------------- */

fundingMarketplaceRoutes.get(
  '/investors',
  requirePermission('funding:read'),
  validate('query', listInvestorSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = investorScope(user.id, permissions);
    if (scope) conditions.push(scope);
    if (query.status) conditions.push(eq(investorProfiles.status, query.status));
    if (query.investorType) conditions.push(eq(investorProfiles.investorType, query.investorType));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(investorProfiles.displayName, term),
          ilike(investorProfiles.email, term),
        ) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(investorProfiles)
        .where(where)
        .orderBy(desc(investorProfiles.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(investorProfiles).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

fundingMarketplaceRoutes.post(
  '/investors',
  requirePermission('funding:write'),
  validate('json', investorInputSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    assertCurrency(body.currency);
    if (body.organizationId) await assertOrgManager(body.organizationId, user.id);
    const [created] = await db
      .insert(investorProfiles)
      .values({
        userId: body.userId ?? user.id,
        organizationId: body.organizationId ?? null,
        displayName: body.displayName,
        investorType: body.investorType,
        status: body.status,
        email: body.email ?? null,
        phone: body.phone ?? null,
        website: body.website ?? null,
        description: body.description ?? null,
        investmentFocus: body.investmentFocus ?? null,
        minTicket: body.minTicket ?? null,
        maxTicket: body.maxTicket ?? null,
        currency: body.currency,
        preferredStages: body.preferredStages ?? null,
        preferredSectors: body.preferredSectors ?? null,
        createdBy: user.id,
      })
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'funding.investor.create',
      entityType: 'investor_profile',
      entityId: created!.id,
      newValues: { displayName: created!.displayName, investorType: created!.investorType },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created!, 201);
  },
);

fundingMarketplaceRoutes.get(
  '/investors/:id',
  requirePermission('funding:read'),
  async (c) => {
    const investor = await getInvestor(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    return ok(c, investor);
  },
);

fundingMarketplaceRoutes.patch(
  '/investors/:id',
  requirePermission('funding:write'),
  validate('json', updateInvestorSchema.partial()),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const investor = await getInvestor(c.req.param('id'), user, permissions, { manage: true });
    if (body.currency) assertCurrency(body.currency);
    if (body.organizationId) await assertOrgManager(body.organizationId, user.id);
    const [updated] = await db
      .update(investorProfiles)
      .set({
        ...body,
        phone: body.phone ?? undefined,
        website: body.website ?? undefined,
        description: body.description ?? undefined,
        investmentFocus: body.investmentFocus ?? undefined,
        minTicket: body.minTicket ?? undefined,
        maxTicket: body.maxTicket ?? undefined,
        preferredStages: body.preferredStages ?? undefined,
        preferredSectors: body.preferredSectors ?? undefined,
        organizationId: body.organizationId ?? undefined,
        verifiedAt: body.status === 'active' ? investor.verifiedAt ?? new Date() : undefined,
      })
      .where(eq(investorProfiles.id, investor.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'funding.investor.update',
      entityType: 'investor_profile',
      entityId: investor.id,
      oldValues: { status: investor.status },
      newValues: { status: updated!.status },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

fundingMarketplaceRoutes.post(
  '/investors/:id/verify',
  requirePermission('funding:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const investor = await getInvestor(c.req.param('id'), user, permissions, { manage: true });
    const [updated] = await db
      .update(investorProfiles)
      .set({ status: 'active', verifiedAt: new Date() })
      .where(eq(investorProfiles.id, investor.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'funding.investor.verify',
      entityType: 'investor_profile',
      entityId: investor.id,
      newValues: { status: 'active' },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

/* ---------------------------- Applications --------------------------- */

fundingMarketplaceRoutes.get(
  '/applications',
  requirePermission('funding:read'),
  validate('query', listApplicationSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = fundingMerchantScope(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(fundingApplications.merchantId, query.merchantId));
    if (query.proposalId) conditions.push(eq(fundingApplications.proposalId, query.proposalId));
    if (query.opportunityId) {
      conditions.push(eq(fundingApplications.opportunityId, query.opportunityId));
    }
    if (query.status) conditions.push(eq(fundingApplications.status, query.status));
    if (query.search) {
      conditions.push(
        or(
          ilike(fundingApplications.applicationNumber, `%${query.search}%`),
          ilike(merchants.businessName, `%${query.search}%`),
          ilike(businessProposals.title, `%${query.search}%`),
        ) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: fundingApplications.id,
          merchantId: fundingApplications.merchantId,
          merchantName: merchants.businessName,
          proposalId: fundingApplications.proposalId,
          proposalTitle: businessProposals.title,
          opportunityId: fundingApplications.opportunityId,
          investorProfileId: fundingApplications.investorProfileId,
          applicationNumber: fundingApplications.applicationNumber,
          requestedAmount: fundingApplications.requestedAmount,
          approvedAmount: fundingApplications.approvedAmount,
          currency: fundingApplications.currency,
          status: fundingApplications.status,
          submittedAt: fundingApplications.submittedAt,
          reviewedAt: fundingApplications.reviewedAt,
          createdAt: fundingApplications.createdAt,
        })
        .from(fundingApplications)
        .innerJoin(merchants, eq(merchants.id, fundingApplications.merchantId))
        .innerJoin(businessProposals, eq(businessProposals.id, fundingApplications.proposalId))
        .where(where)
        .orderBy(desc(fundingApplications.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(fundingApplications)
        .innerJoin(merchants, eq(merchants.id, fundingApplications.merchantId))
        .innerJoin(businessProposals, eq(businessProposals.id, fundingApplications.proposalId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

fundingMarketplaceRoutes.post(
  '/applications',
  requirePermission('funding:write'),
  validate('json', createApplicationSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertFundingAccess(body.merchantId, user, permissions, { manage: true });
    const { proposal } = await getProposal(body.proposalId, user, permissions);
    if (proposal.merchantId !== body.merchantId) {
      throw ApiError.badRequest('Proposal berasal dari merchant berbeda');
    }
    if (proposal.status !== 'published' && proposal.status !== 'submitted') {
      throw ApiError.badRequest('Proposal harus submitted atau published');
    }
    if (body.opportunityId) {
      await getOpportunity(body.opportunityId, user, permissions);
    }
    if (body.investorProfileId) {
      await getInvestor(body.investorProfileId, user, permissions);
    }
    assertCurrency(body.currency);
    if (body.opportunityId) {
      const [existing] = await db
        .select({ id: fundingApplications.id })
        .from(fundingApplications)
        .where(
          and(
            eq(fundingApplications.proposalId, body.proposalId),
            eq(fundingApplications.opportunityId, body.opportunityId),
          ),
        )
        .limit(1);
      if (existing) throw ApiError.conflict('Proposal sudah diajukan ke peluang ini');
    }
    const [created] = await db
      .insert(fundingApplications)
      .values({
        merchantId: body.merchantId,
        proposalId: proposal.id,
        opportunityId: body.opportunityId ?? null,
        investorProfileId: body.investorProfileId ?? null,
        applicationNumber: generateCode('APP'),
        requestedAmount: body.requestedAmount,
        currency: body.currency,
        metadata: body.metadata ?? null,
      })
      .returning();
    await db.insert(fundingApplicationStatuses).values({
      applicationId: created!.id,
      merchantId: body.merchantId,
      fromStatus: null,
      toStatus: 'draft',
      note: 'Pengajuan dibuat',
      changedBy: user.id,
    });
    await writeAuditLog({
      actorUserId: user.id,
      action: 'funding.application.create',
      entityType: 'funding_application',
      entityId: created!.id,
      newValues: {
        applicationNumber: created!.applicationNumber,
        requestedAmount: created!.requestedAmount,
      },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created!, 201);
  },
);

fundingMarketplaceRoutes.get(
  '/applications/:id',
  requirePermission('funding:read'),
  async (c) => {
    const { application } = await getApplication(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    const [statuses, matches] = await Promise.all([
      db
        .select()
        .from(fundingApplicationStatuses)
        .where(eq(fundingApplicationStatuses.applicationId, application.id))
        .orderBy(desc(fundingApplicationStatuses.createdAt)),
      db
        .select()
        .from(fundingMatches)
        .where(eq(fundingMatches.applicationId, application.id))
        .orderBy(desc(fundingMatches.createdAt)),
    ]);
    return ok(c, { ...application, statuses, matches });
  },
);

fundingMarketplaceRoutes.patch(
  '/applications/:id',
  requirePermission('funding:write'),
  validate('json', updateApplicationSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { application } = await getApplication(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (application.status === 'funded' || application.status === 'rejected') {
      throw ApiError.badRequest('Pengajuan yang sudah final tidak dapat diubah');
    }
    if (body.opportunityId) await getOpportunity(body.opportunityId, user, permissions);
    if (body.investorProfileId) await getInvestor(body.investorProfileId, user, permissions);
    if (body.currency) assertCurrency(body.currency);
    const [updated] = await db
      .update(fundingApplications)
      .set({
        ...body,
        opportunityId: body.opportunityId ?? undefined,
        investorProfileId: body.investorProfileId ?? undefined,
        approvedAmount: body.approvedAmount ?? undefined,
        decisionNotes: body.decisionNotes ?? undefined,
        metadata: body.metadata ?? undefined,
      })
      .where(eq(fundingApplications.id, application.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'funding.application.update',
      entityType: 'funding_application',
      entityId: application.id,
      newValues: { requestedAmount: updated!.requestedAmount },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

fundingMarketplaceRoutes.post(
  '/applications/:id/submit',
  requirePermission('funding:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { application } = await getApplication(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (application.status !== 'draft') throw ApiError.badRequest('Hanya draft yang dapat diajukan');
    const updated = await transitionApplication(
      application.id,
      'submitted',
      user.id,
      getClientIp(c),
      c.req.header('user-agent') ?? null,
    );
    return ok(c, updated);
  },
);

fundingMarketplaceRoutes.post(
  '/applications/:id/transition',
  requirePermission('funding:write'),
  validate('json', transitionSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { application } = await getApplication(c.req.param('id'), user, permissions, {
      manage: true,
    });
    const terminal = ['approved', 'rejected', 'withdrawn', 'funded'];
    if (terminal.includes(application.status)) {
      throw ApiError.badRequest('Pengajuan sudah berada pada status final');
    }
    const reviewStatuses = ['under_review', 'shortlisted', 'approved', 'rejected', 'funded'];
    if (reviewStatuses.includes(body.status) && !isPlatformAdmin(permissions)) {
      throw ApiError.forbidden('Transisi review memerlukan izin funding:manage');
    }
    if (body.status === 'withdrawn' && application.status === 'funded') {
      throw ApiError.badRequest('Pengajuan yang sudah didanai tidak dapat ditarik');
    }
    const updated = await transitionApplication(
      application.id,
      body.status,
      user.id,
      getClientIp(c),
      c.req.header('user-agent') ?? null,
      {
        approvedAmount:
          body.approvedAmount === undefined ? undefined : body.approvedAmount,
        note: body.note ?? null,
      },
    );
    return ok(c, updated);
  },
);

/* ------------------------------ Matches ------------------------------ */

fundingMarketplaceRoutes.get(
  '/matches',
  requirePermission('funding:read'),
  validate('query', listMatchSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = fundingMerchantScope(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(fundingMatches.merchantId, query.merchantId));
    if (query.applicationId) {
      conditions.push(eq(fundingMatches.applicationId, query.applicationId));
    }
    if (query.status) conditions.push(eq(fundingMatches.status, query.status));
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: fundingMatches.id,
          merchantId: fundingMatches.merchantId,
          merchantName: merchants.businessName,
          applicationId: fundingMatches.applicationId,
          opportunityId: fundingMatches.opportunityId,
          opportunityTitle: fundingOpportunities.title,
          investorProfileId: fundingMatches.investorProfileId,
          investorName: investorProfiles.displayName,
          score: fundingMatches.score,
          status: fundingMatches.status,
          matchedAt: fundingMatches.matchedAt,
          notes: fundingMatches.notes,
          createdAt: fundingMatches.createdAt,
        })
        .from(fundingMatches)
        .innerJoin(merchants, eq(merchants.id, fundingMatches.merchantId))
        .leftJoin(
          fundingOpportunities,
          eq(fundingOpportunities.id, fundingMatches.opportunityId),
        )
        .leftJoin(investorProfiles, eq(investorProfiles.id, fundingMatches.investorProfileId))
        .where(where)
        .orderBy(desc(fundingMatches.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(fundingMatches)
        .innerJoin(merchants, eq(merchants.id, fundingMatches.merchantId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

fundingMarketplaceRoutes.post(
  '/matches',
  requirePermission('funding:write'),
  validate('json', createMatchSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertFundingAccess(body.merchantId, user, permissions, { manage: true });
    if (body.applicationId) {
      const { application } = await getApplication(body.applicationId, user, permissions);
      if (application.merchantId !== body.merchantId) {
        throw ApiError.badRequest('Pengajuan berasal dari merchant berbeda');
      }
    }
    if (body.opportunityId) await getOpportunity(body.opportunityId, user, permissions);
    if (body.investorProfileId) await getInvestor(body.investorProfileId, user, permissions);
    const [created] = await db
      .insert(fundingMatches)
      .values({
        merchantId: body.merchantId,
        applicationId: body.applicationId ?? null,
        opportunityId: body.opportunityId ?? null,
        investorProfileId: body.investorProfileId ?? null,
        score: body.score !== undefined ? String(body.score) : null,
        notes: body.notes ?? null,
      })
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'funding.match.create',
      entityType: 'funding_match',
      entityId: created!.id,
      newValues: { merchantId: body.merchantId, score: created!.score },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created!, 201);
  },
);

fundingMarketplaceRoutes.patch(
  '/matches/:id',
  requirePermission('funding:write'),
  validate('json', updateMatchSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const row = await db.query.fundingMatches.findFirst({
      where: eq(fundingMatches.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Match pendanaan tidak ditemukan');
    await assertFundingAccess(row.merchantId, user, permissions, { manage: true });
    const [updated] = await db
      .update(fundingMatches)
      .set({
        status: body.status ?? undefined,
        score: body.score !== undefined ? String(body.score) : undefined,
        notes: body.notes ?? undefined,
      })
      .where(eq(fundingMatches.id, row.id))
      .returning();
    return ok(c, updated!);
  },
);

fundingMarketplaceRoutes.post(
  '/matches/suggest',
  requirePermission('funding:write'),
  validate('json', suggestMatchSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertFundingAccess(body.merchantId, user, permissions, { manage: true });
    let amount = 0;
    let application: typeof fundingApplications.$inferSelect | undefined;
    if (body.applicationId) {
      const result = await getApplication(body.applicationId, user, permissions);
      application = result.application;
      if (application.merchantId !== body.merchantId) {
        throw ApiError.badRequest('Pengajuan berasal dari merchant berbeda');
      }
      amount = toNumber(application.requestedAmount);
    }
    const opportunities = await db
      .select()
      .from(fundingOpportunities)
      .where(eq(fundingOpportunities.status, 'open'))
      .limit(20);
    const investors = await db
      .select()
      .from(investorProfiles)
      .where(eq(investorProfiles.status, 'active'))
      .limit(20);
    const created: (typeof fundingMatches.$inferSelect)[] = [];
    for (const opportunity of opportunities) {
      const min = toNumber(opportunity.minAmount);
      const max = toNumber(opportunity.maxAmount);
      if (amount && (amount < min || (max > 0 && amount > max))) continue;
      let score = 70;
      if (amount && max > 0) score = 80;
      if (opportunity.instrumentType === 'equity') score += 5;
      if (application?.opportunityId === opportunity.id) continue;
      const [match] = await db
        .insert(fundingMatches)
        .values({
          merchantId: body.merchantId,
          applicationId: application?.id ?? null,
          opportunityId: opportunity.id,
          score: String(Math.min(score, 99)),
          status: 'suggested',
          notes: 'Rekomendasi otomatis berdasarkan plafon dan instrumen',
        })
        .returning();
      created.push(match!);
      if (created.length >= 5) break;
    }
    if (created.length < 5) {
      for (const investor of investors) {
        if (created.length >= 5) break;
        const min = toNumber(investor.minTicket);
        const max = toNumber(investor.maxTicket);
        if (amount && (amount < min || (max > 0 && amount > max))) continue;
        const [match] = await db
          .insert(fundingMatches)
          .values({
            merchantId: body.merchantId,
            applicationId: application?.id ?? null,
            investorProfileId: investor.id,
            score: '75.00',
            status: 'suggested',
            notes: 'Rekomendasi otomatis berdasarkan tiket investasi',
          })
          .returning();
        created.push(match!);
      }
    }
    await writeAuditLog({
      actorUserId: user.id,
      action: 'funding.match.suggest',
      entityType: 'funding_match',
      newValues: { merchantId: body.merchantId, total: created.length },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created, 201);
  },
);

/* ----------------------------- Interests ----------------------------- */

fundingMarketplaceRoutes.get(
  '/interests',
  requirePermission('funding:read'),
  validate('query', listInterestSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = fundingMerchantScope(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(investorInterests.merchantId, query.merchantId));
    if (query.investorProfileId) {
      conditions.push(eq(investorInterests.investorProfileId, query.investorProfileId));
    }
    if (query.status) conditions.push(eq(investorInterests.status, query.status));
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: investorInterests.id,
          merchantId: investorInterests.merchantId,
          merchantName: merchants.businessName,
          investorProfileId: investorInterests.investorProfileId,
          investorName: investorProfiles.displayName,
          proposalId: investorInterests.proposalId,
          proposalTitle: businessProposals.title,
          opportunityId: investorInterests.opportunityId,
          status: investorInterests.status,
          message: investorInterests.message,
          amount: investorInterests.amount,
          createdAt: investorInterests.createdAt,
        })
        .from(investorInterests)
        .innerJoin(merchants, eq(merchants.id, investorInterests.merchantId))
        .innerJoin(investorProfiles, eq(investorProfiles.id, investorInterests.investorProfileId))
        .leftJoin(businessProposals, eq(businessProposals.id, investorInterests.proposalId))
        .where(where)
        .orderBy(desc(investorInterests.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(investorInterests)
        .innerJoin(merchants, eq(merchants.id, investorInterests.merchantId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

fundingMarketplaceRoutes.post(
  '/interests',
  requirePermission('funding:write'),
  validate('json', interestInputSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertFundingAccess(body.merchantId, user, permissions, { manage: true });
    await getInvestor(body.investorProfileId, user, permissions);
    if (body.proposalId) {
      const { proposal } = await getProposal(body.proposalId, user, permissions);
      if (proposal.merchantId !== body.merchantId) {
        throw ApiError.badRequest('Proposal berasal dari merchant berbeda');
      }
    }
    if (body.applicationId) {
      const { application } = await getApplication(body.applicationId, user, permissions);
      if (application.merchantId !== body.merchantId) {
        throw ApiError.badRequest('Pengajuan berasal dari merchant berbeda');
      }
    }
    if (body.opportunityId) await getOpportunity(body.opportunityId, user, permissions);
    const [created] = await db
      .insert(investorInterests)
      .values({
        merchantId: body.merchantId,
        investorProfileId: body.investorProfileId,
        proposalId: body.proposalId ?? null,
        opportunityId: body.opportunityId ?? null,
        applicationId: body.applicationId ?? null,
        status: body.status,
        message: body.message ?? null,
        amount: body.amount ?? null,
      })
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'funding.interest.create',
      entityType: 'investor_interest',
      entityId: created!.id,
      newValues: { merchantId: body.merchantId, status: created!.status },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created!, 201);
  },
);

fundingMarketplaceRoutes.patch(
  '/interests/:id',
  requirePermission('funding:write'),
  validate('json', updateInterestSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const row = await db.query.investorInterests.findFirst({
      where: eq(investorInterests.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Minat investor tidak ditemukan');
    await assertFundingAccess(row.merchantId, user, permissions, { manage: true });
    const [updated] = await db
      .update(investorInterests)
      .set({
        status: body.status ?? undefined,
        message: body.message ?? undefined,
        amount: body.amount ?? undefined,
      })
      .where(eq(investorInterests.id, row.id))
      .returning();
    return ok(c, updated!);
  },
);

fundingMarketplaceRoutes.post(
  '/interests/:id/withdraw',
  requirePermission('funding:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const row = await db.query.investorInterests.findFirst({
      where: eq(investorInterests.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Minat investor tidak ditemukan');
    await assertFundingAccess(row.merchantId, user, permissions, { manage: true });
    const [updated] = await db
      .update(investorInterests)
      .set({ status: 'withdrawn' })
      .where(eq(investorInterests.id, row.id))
      .returning();
    return ok(c, updated!);
  },
);

/* ----------------------------- Referrals ----------------------------- */

fundingMarketplaceRoutes.get(
  '/referrals',
  requirePermission('funding:read'),
  validate('query', listReferralSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = fundingMerchantScope(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) {
      conditions.push(eq(fundingPartnerReferrals.merchantId, query.merchantId));
    }
    if (query.status) conditions.push(eq(fundingPartnerReferrals.status, query.status));
    if (query.search) {
      conditions.push(
        or(
          ilike(fundingPartnerReferrals.partnerName, `%${query.search}%`),
          ilike(fundingPartnerReferrals.referralCode, `%${query.search}%`),
        ) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(fundingPartnerReferrals)
        .where(where)
        .orderBy(desc(fundingPartnerReferrals.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(fundingPartnerReferrals)
        .innerJoin(merchants, eq(merchants.id, fundingPartnerReferrals.merchantId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

fundingMarketplaceRoutes.post(
  '/referrals',
  requirePermission('funding:write'),
  validate('json', referralInputSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertFundingAccess(body.merchantId, user, permissions, { manage: true });
    if (body.applicationId) {
      const { application } = await getApplication(body.applicationId, user, permissions);
      if (application.merchantId !== body.merchantId) {
        throw ApiError.badRequest('Pengajuan berasal dari merchant berbeda');
      }
    }
    if (body.opportunityId) await getOpportunity(body.opportunityId, user, permissions);
    const [created] = await db
      .insert(fundingPartnerReferrals)
      .values({
        merchantId: body.merchantId,
        applicationId: body.applicationId ?? null,
        opportunityId: body.opportunityId ?? null,
        partnerName: body.partnerName,
        partnerType: body.partnerType,
        contactName: body.contactName ?? null,
        contactEmail: body.contactEmail ?? null,
        contactPhone: body.contactPhone ?? null,
        status: body.status,
        referralCode: body.referralCode ?? generateCode('REF'),
        notes: body.notes ?? null,
        createdBy: user.id,
      })
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'funding.referral.create',
      entityType: 'funding_partner_referral',
      entityId: created!.id,
      newValues: { partnerName: created!.partnerName, status: created!.status },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created!, 201);
  },
);

fundingMarketplaceRoutes.patch(
  '/referrals/:id',
  requirePermission('funding:write'),
  validate('json', updateReferralSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const row = await db.query.fundingPartnerReferrals.findFirst({
      where: eq(fundingPartnerReferrals.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Referral mitra tidak ditemukan');
    await assertFundingAccess(row.merchantId, user, permissions, { manage: true });
    const [updated] = await db
      .update(fundingPartnerReferrals)
      .set({
        ...body,
        contactName: body.contactName ?? undefined,
        contactEmail: body.contactEmail ?? undefined,
        contactPhone: body.contactPhone ?? undefined,
        referralCode: body.referralCode ?? undefined,
        notes: body.notes ?? undefined,
      })
      .where(eq(fundingPartnerReferrals.id, row.id))
      .returning();
    return ok(c, updated!);
  },
);

fundingMarketplaceRoutes.delete(
  '/referrals/:id',
  requirePermission('funding:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const row = await db.query.fundingPartnerReferrals.findFirst({
      where: eq(fundingPartnerReferrals.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Referral mitra tidak ditemukan');
    await assertFundingAccess(row.merchantId, user, permissions, { manage: true });
    await db.delete(fundingPartnerReferrals).where(eq(fundingPartnerReferrals.id, row.id));
    return ok(c, { id: row.id, deleted: true });
  },
);

/* ------------------------- Application history ----------------------- */

fundingMarketplaceRoutes.get(
  '/applications/:id/statuses',
  requirePermission('funding:read'),
  async (c) => {
    const { application } = await getApplication(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    const rows = await db
      .select()
      .from(fundingApplicationStatuses)
      .where(eq(fundingApplicationStatuses.applicationId, application.id))
      .orderBy(desc(fundingApplicationStatuses.createdAt));
    return ok(c, rows);
  },
);
