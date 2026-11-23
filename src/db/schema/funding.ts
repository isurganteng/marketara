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
} from 'drizzle-orm/pg-core';
import { businessProfiles } from './business';
import { merchants, organizations, users } from './core';

/**
 * 2MD-03 Business Proposal & Document, 2MD-04 Funding & Investment
 * Marketplace, dan 2MD-05 Financing & Risk Monitoring.
 *
 * Schema `funding` memisahkan proposal/data room, pencarian pendanaan, dan
 * fasilitas pendanaan yang sudah disepakati. Entitas merchant-scoped memakai
 * `merchant_id`; peluang dan profil investor bersifat platform-level dengan
 * kepemilikan `owner_user_id`/`organization_id`.
 */
export const funding = pgSchema('funding');

const createdAt = timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = timestamp('updated_at', { withTimezone: true })
  .defaultNow()
  .notNull()
  .$onUpdate(() => new Date());

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const proposalStatusEnum = funding.enum('proposal_status', [
  'draft',
  'in_review',
  'submitted',
  'published',
  'funded',
  'rejected',
  'archived',
]);

export const proposalVersionStatusEnum = funding.enum('proposal_version_status', [
  'draft',
  'final',
  'archived',
]);

export const businessPlanStatusEnum = funding.enum('business_plan_status', [
  'draft',
  'approved',
  'archived',
]);

export const financialProjectionTypeEnum = funding.enum('financial_projection_type', [
  'revenue',
  'expense',
  'profit',
  'cash_flow',
  'other',
]);

export const fundingRequirementTypeEnum = funding.enum('funding_requirement_type', [
  'equity',
  'debt',
  'grant',
  'working_capital',
  'asset',
  'other',
]);

export const fundUtilizationPlanStatusEnum = funding.enum('fund_utilization_plan_status', [
  'planned',
  'approved',
  'in_progress',
  'completed',
]);

export const fundingDocumentStatusEnum = funding.enum('funding_document_status', [
  'pending',
  'verified',
  'rejected',
  'expired',
]);

export const dataRoomStatusEnum = funding.enum('data_room_status', [
  'draft',
  'active',
  'archived',
]);

export const dataRoomAccessStatusEnum = funding.enum('data_room_access_status', [
  'active',
  'revoked',
  'expired',
]);

export const fundingOpportunityStatusEnum = funding.enum('funding_opportunity_status', [
  'draft',
  'open',
  'closed',
  'archived',
]);

export const fundingInstrumentTypeEnum = funding.enum('funding_instrument_type', [
  'equity',
  'debt',
  'grant',
  'convertible_note',
  'revenue_sharing',
  'other',
]);

export const investorTypeEnum = funding.enum('investor_type', [
  'individual',
  'angel',
  'venture_capital',
  'private_equity',
  'bank',
  'cooperative',
  'government',
  'other',
]);

export const investorStatusEnum = funding.enum('investor_status', [
  'active',
  'inactive',
  'suspended',
]);

export const fundingApplicationStatusEnum = funding.enum('funding_application_status', [
  'draft',
  'submitted',
  'under_review',
  'shortlisted',
  'approved',
  'rejected',
  'withdrawn',
  'funded',
]);

export const fundingMatchStatusEnum = funding.enum('funding_match_status', [
  'suggested',
  'interested',
  'accepted',
  'declined',
  'closed',
]);

export const investorInterestStatusEnum = funding.enum('investor_interest_status', [
  'new',
  'reviewing',
  'interested',
  'declined',
  'converted',
  'withdrawn',
]);

export const referralStatusEnum = funding.enum('referral_status', [
  'pending',
  'contacted',
  'converted',
  'rejected',
]);

export const financingTypeEnum = funding.enum('financing_type', [
  'loan',
  'equity',
  'grant',
  'revenue_sharing',
  'lease',
  'other',
]);

export const financingStatusEnum = funding.enum('financing_status', [
  'draft',
  'active',
  'disbursing',
  'closed',
  'defaulted',
  'cancelled',
]);

export const agreementStatusEnum = funding.enum('financing_agreement_status', [
  'draft',
  'signed',
  'active',
  'terminated',
]);

export const disbursementStatusEnum = funding.enum('disbursement_status', [
  'pending',
  'confirmed',
  'failed',
  'cancelled',
]);

export const repaymentStatusEnum = funding.enum('repayment_status', [
  'scheduled',
  'due',
  'paid',
  'overdue',
  'waived',
  'cancelled',
]);

export const repaymentTransactionStatusEnum = funding.enum('repayment_transaction_status', [
  'pending',
  'completed',
  'failed',
  'reversed',
]);

export const utilizationReportStatusEnum = funding.enum('utilization_report_status', [
  'draft',
  'submitted',
  'approved',
  'rejected',
]);

export const monitoringStatusEnum = funding.enum('monitoring_status', [
  'draft',
  'submitted',
  'reviewed',
  'flagged',
]);

export const riskLevelEnum = funding.enum('risk_level', [
  'low',
  'medium',
  'high',
  'critical',
]);

export const riskIndicatorTypeEnum = funding.enum('risk_indicator_type', [
  'financial',
  'operational',
  'market',
  'compliance',
  'repayment',
  'other',
]);

export const riskAssessmentStatusEnum = funding.enum('risk_assessment_status', [
  'draft',
  'final',
]);

/* ------------------------------------------------------------------ */
/* 2MD-03 - Proposal & Document Management                             */
/* ------------------------------------------------------------------ */

export const businessProposals = funding.table(
  'business_proposals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id').references(() => businessProfiles.id, {
      onDelete: 'set null',
    }),
    code: varchar('code', { length: 64 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    summary: text('summary'),
    status: proposalStatusEnum('status').default('draft').notNull(),
    currentVersion: integer('current_version').default(1).notNull(),
    targetAmount: numeric('target_amount', { precision: 18, scale: 2 }).default('0').notNull(),
    currency: varchar('currency', { length: 3 }).default('IDR').notNull(),
    valuation: numeric('valuation', { precision: 18, scale: 2 }),
    equityOffered: numeric('equity_offered', { precision: 8, scale: 2 }),
    fundingType: fundingInstrumentTypeEnum('funding_type').default('equity').notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('business_proposals_code_uq').on(t.merchantId, t.code),
    index('business_proposals_merchant_idx').on(t.merchantId),
    index('business_proposals_status_idx').on(t.status),
  ],
);

export const proposalVersions = funding.table(
  'proposal_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => businessProposals.id, { onDelete: 'cascade' }),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    summary: text('summary'),
    content: text('content'),
    changeNotes: text('change_notes'),
    fileUrl: text('file_url'),
    status: proposalVersionStatusEnum('status').default('draft').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
  },
  (t) => [
    uniqueIndex('proposal_versions_number_uq').on(t.proposalId, t.version),
    index('proposal_versions_merchant_idx').on(t.merchantId),
  ],
);

export const businessPlans = funding.table(
  'business_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => businessProposals.id, { onDelete: 'cascade' }),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    executiveSummary: text('executive_summary'),
    marketAnalysis: text('market_analysis'),
    businessModel: text('business_model'),
    strategy: text('strategy'),
    team: text('team'),
    milestones: jsonb('milestones').$type<Record<string, unknown>>(),
    status: businessPlanStatusEnum('status').default('draft').notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('business_plans_proposal_idx').on(t.proposalId),
    index('business_plans_merchant_idx').on(t.merchantId),
  ],
);

export const financialProjections = funding.table(
  'financial_projections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => businessProposals.id, { onDelete: 'cascade' }),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    projectionType: financialProjectionTypeEnum('projection_type').notNull(),
    periodLabel: varchar('period_label', { length: 64 }).notNull(),
    periodStart: date('period_start'),
    periodEnd: date('period_end'),
    amount: numeric('amount', { precision: 18, scale: 2 }).default('0').notNull(),
    assumptions: text('assumptions'),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('financial_projections_proposal_idx').on(t.proposalId),
    index('financial_projections_type_idx').on(t.projectionType),
  ],
);

export const fundingRequirements = funding.table(
  'funding_requirements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => businessProposals.id, { onDelete: 'cascade' }),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    requirementType: fundingRequirementTypeEnum('requirement_type').default('equity').notNull(),
    purpose: text('purpose').notNull(),
    amount: numeric('amount', { precision: 18, scale: 2 }).default('0').notNull(),
    currency: varchar('currency', { length: 3 }).default('IDR').notNull(),
    minAmount: numeric('min_amount', { precision: 18, scale: 2 }),
    maxAmount: numeric('max_amount', { precision: 18, scale: 2 }),
    equityPercent: numeric('equity_percent', { precision: 8, scale: 2 }),
    tenorMonths: integer('tenor_months'),
    expectedReturnPercent: numeric('expected_return_percent', { precision: 8, scale: 2 }),
    notes: text('notes'),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('funding_requirements_proposal_idx').on(t.proposalId),
    index('funding_requirements_merchant_idx').on(t.merchantId),
  ],
);

export const fundUtilizationPlans = funding.table(
  'fund_utilization_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => businessProposals.id, { onDelete: 'cascade' }),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    category: varchar('category', { length: 128 }).notNull(),
    description: text('description'),
    amount: numeric('amount', { precision: 18, scale: 2 }).default('0').notNull(),
    percentage: numeric('percentage', { precision: 6, scale: 2 }),
    timeline: varchar('timeline', { length: 128 }),
    status: fundUtilizationPlanStatusEnum('status').default('planned').notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('fund_utilization_plans_proposal_idx').on(t.proposalId),
    index('fund_utilization_plans_merchant_idx').on(t.merchantId),
  ],
);

export const businessDocuments = funding.table(
  'business_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    proposalId: uuid('proposal_id').references(() => businessProposals.id, {
      onDelete: 'set null',
    }),
    profileId: uuid('profile_id').references(() => businessProfiles.id, {
      onDelete: 'set null',
    }),
    documentType: varchar('document_type', { length: 64 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    fileName: varchar('file_name', { length: 255 }),
    fileUrl: text('file_url'),
    version: integer('version').default(1).notNull(),
    status: fundingDocumentStatusEnum('status').default('pending').notNull(),
    isConfidential: boolean('is_confidential').default(false).notNull(),
    expiresAt: date('expires_at'),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    verifiedBy: uuid('verified_by').references(() => users.id, { onDelete: 'set null' }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('business_documents_merchant_idx').on(t.merchantId),
    index('business_documents_proposal_idx').on(t.proposalId),
    index('business_documents_status_idx').on(t.status),
  ],
);

export const dataRooms = funding.table(
  'data_rooms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => businessProposals.id, { onDelete: 'cascade' }),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    status: dataRoomStatusEnum('status').default('draft').notNull(),
    accessLevel: varchar('access_level', { length: 32 }).default('private').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('data_rooms_proposal_uq').on(t.proposalId),
    index('data_rooms_merchant_idx').on(t.merchantId),
  ],
);

export const dataRoomAccessLogs = funding.table(
  'data_room_access_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dataRoomId: uuid('data_room_id')
      .notNull()
      .references(() => dataRooms.id, { onDelete: 'cascade' }),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    email: varchar('email', { length: 255 }),
    action: varchar('action', { length: 64 }).default('view').notNull(),
    status: dataRoomAccessStatusEnum('status').default('active').notNull(),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    accessedAt: timestamp('accessed_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt,
  },
  (t) => [
    index('data_room_access_room_idx').on(t.dataRoomId),
    index('data_room_access_merchant_idx').on(t.merchantId),
  ],
);

/* ------------------------------------------------------------------ */
/* 2MD-04 - Funding & Investment Marketplace                           */
/* ------------------------------------------------------------------ */

export const fundingOpportunities = funding.table(
  'funding_opportunities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 64 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    instrumentType: fundingInstrumentTypeEnum('instrument_type').default('equity').notNull(),
    providerName: varchar('provider_name', { length: 255 }).notNull(),
    providerType: investorTypeEnum('provider_type').default('other').notNull(),
    minAmount: numeric('min_amount', { precision: 18, scale: 2 }).default('0').notNull(),
    maxAmount: numeric('max_amount', { precision: 18, scale: 2 }).default('0').notNull(),
    currency: varchar('currency', { length: 3 }).default('IDR').notNull(),
    interestRate: numeric('interest_rate', { precision: 8, scale: 2 }),
    equityPercent: numeric('equity_percent', { precision: 8, scale: 2 }),
    tenorMonths: integer('tenor_months'),
    eligibility: jsonb('eligibility').$type<Record<string, unknown>>(),
    requirements: text('requirements'),
    status: fundingOpportunityStatusEnum('status').default('draft').notNull(),
    opensAt: timestamp('opens_at', { withTimezone: true }),
    closesAt: timestamp('closes_at', { withTimezone: true }),
    ownerUserId: uuid('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'set null',
    }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('funding_opportunities_code_uq').on(t.code),
    index('funding_opportunities_status_idx').on(t.status),
    index('funding_opportunities_owner_idx').on(t.ownerUserId),
  ],
);

export const investorProfiles = funding.table(
  'investor_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'set null',
    }),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    investorType: investorTypeEnum('investor_type').default('individual').notNull(),
    status: investorStatusEnum('status').default('active').notNull(),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 32 }),
    website: varchar('website', { length: 255 }),
    description: text('description'),
    investmentFocus: jsonb('investment_focus').$type<Record<string, unknown>>(),
    minTicket: numeric('min_ticket', { precision: 18, scale: 2 }),
    maxTicket: numeric('max_ticket', { precision: 18, scale: 2 }),
    currency: varchar('currency', { length: 3 }).default('IDR').notNull(),
    preferredStages: jsonb('preferred_stages').$type<string[]>(),
    preferredSectors: jsonb('preferred_sectors').$type<string[]>(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('investor_profiles_user_idx').on(t.userId),
    index('investor_profiles_org_idx').on(t.organizationId),
    index('investor_profiles_status_idx').on(t.status),
  ],
);

export const fundingApplications = funding.table(
  'funding_applications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => businessProposals.id, { onDelete: 'cascade' }),
    opportunityId: uuid('opportunity_id').references(() => fundingOpportunities.id, {
      onDelete: 'set null',
    }),
    investorProfileId: uuid('investor_profile_id').references(() => investorProfiles.id, {
      onDelete: 'set null',
    }),
    applicationNumber: varchar('application_number', { length: 64 }).notNull(),
    requestedAmount: numeric('requested_amount', { precision: 18, scale: 2 }).notNull(),
    approvedAmount: numeric('approved_amount', { precision: 18, scale: 2 }),
    currency: varchar('currency', { length: 3 }).default('IDR').notNull(),
    status: fundingApplicationStatusEnum('status').default('draft').notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    decisionNotes: text('decision_notes'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('funding_applications_number_uq').on(t.merchantId, t.applicationNumber),
    uniqueIndex('funding_applications_proposal_opportunity_uq').on(
      t.proposalId,
      t.opportunityId,
    ),
    index('funding_applications_merchant_idx').on(t.merchantId),
    index('funding_applications_status_idx').on(t.status),
  ],
);

export const fundingMatches = funding.table(
  'funding_matches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    applicationId: uuid('application_id').references(() => fundingApplications.id, {
      onDelete: 'cascade',
    }),
    opportunityId: uuid('opportunity_id').references(() => fundingOpportunities.id, {
      onDelete: 'cascade',
    }),
    investorProfileId: uuid('investor_profile_id').references(() => investorProfiles.id, {
      onDelete: 'set null',
    }),
    score: numeric('score', { precision: 5, scale: 2 }),
    status: fundingMatchStatusEnum('status').default('suggested').notNull(),
    matchedAt: timestamp('matched_at', { withTimezone: true }).defaultNow().notNull(),
    notes: text('notes'),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('funding_matches_merchant_idx').on(t.merchantId),
    index('funding_matches_application_idx').on(t.applicationId),
    index('funding_matches_status_idx').on(t.status),
  ],
);

export const investorInterests = funding.table(
  'investor_interests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    investorProfileId: uuid('investor_profile_id')
      .notNull()
      .references(() => investorProfiles.id, { onDelete: 'cascade' }),
    proposalId: uuid('proposal_id').references(() => businessProposals.id, {
      onDelete: 'cascade',
    }),
    opportunityId: uuid('opportunity_id').references(() => fundingOpportunities.id, {
      onDelete: 'set null',
    }),
    applicationId: uuid('application_id').references(() => fundingApplications.id, {
      onDelete: 'set null',
    }),
    status: investorInterestStatusEnum('status').default('new').notNull(),
    message: text('message'),
    amount: numeric('amount', { precision: 18, scale: 2 }),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('investor_interests_merchant_idx').on(t.merchantId),
    index('investor_interests_investor_idx').on(t.investorProfileId),
    index('investor_interests_status_idx').on(t.status),
  ],
);

export const fundingApplicationStatuses = funding.table(
  'funding_application_statuses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => fundingApplications.id, { onDelete: 'cascade' }),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    fromStatus: fundingApplicationStatusEnum('from_status'),
    toStatus: fundingApplicationStatusEnum('to_status').notNull(),
    note: text('note'),
    changedBy: uuid('changed_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
  },
  (t) => [index('funding_application_statuses_app_idx').on(t.applicationId)],
);

export const fundingPartnerReferrals = funding.table(
  'funding_partner_referrals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    applicationId: uuid('application_id').references(() => fundingApplications.id, {
      onDelete: 'set null',
    }),
    opportunityId: uuid('opportunity_id').references(() => fundingOpportunities.id, {
      onDelete: 'set null',
    }),
    partnerName: varchar('partner_name', { length: 255 }).notNull(),
    partnerType: investorTypeEnum('partner_type').default('other').notNull(),
    contactName: varchar('contact_name', { length: 255 }),
    contactEmail: varchar('contact_email', { length: 255 }),
    contactPhone: varchar('contact_phone', { length: 32 }),
    status: referralStatusEnum('status').default('pending').notNull(),
    referralCode: varchar('referral_code', { length: 64 }),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('funding_partner_referrals_merchant_idx').on(t.merchantId),
    index('funding_partner_referrals_status_idx').on(t.status),
  ],
);

/* ------------------------------------------------------------------ */
/* 2MD-05 - Financing & Risk Monitoring                                */
/* ------------------------------------------------------------------ */

export const financingRecords = funding.table(
  'financing_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    applicationId: uuid('application_id').references(() => fundingApplications.id, {
      onDelete: 'set null',
    }),
    proposalId: uuid('proposal_id').references(() => businessProposals.id, {
      onDelete: 'set null',
    }),
    investorProfileId: uuid('investor_profile_id').references(() => investorProfiles.id, {
      onDelete: 'set null',
    }),
    facilityNumber: varchar('facility_number', { length: 64 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    financingType: financingTypeEnum('financing_type').default('loan').notNull(),
    principalAmount: numeric('principal_amount', { precision: 18, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).default('IDR').notNull(),
    interestRate: numeric('interest_rate', { precision: 8, scale: 2 }),
    equityPercent: numeric('equity_percent', { precision: 8, scale: 2 }),
    tenorMonths: integer('tenor_months'),
    status: financingStatusEnum('status').default('draft').notNull(),
    startDate: date('start_date'),
    endDate: date('end_date'),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    defaultedAt: timestamp('defaulted_at', { withTimezone: true }),
    notes: text('notes'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('financing_records_number_uq').on(t.merchantId, t.facilityNumber),
    index('financing_records_merchant_idx').on(t.merchantId),
    index('financing_records_status_idx').on(t.status),
  ],
);

export const financingAgreements = funding.table(
  'financing_agreements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    financingId: uuid('financing_id')
      .notNull()
      .references(() => financingRecords.id, { onDelete: 'cascade' }),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    agreementNumber: varchar('agreement_number', { length: 64 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    signedAt: timestamp('signed_at', { withTimezone: true }),
    effectiveAt: date('effective_at'),
    expiresAt: date('expires_at'),
    fileUrl: text('file_url'),
    status: agreementStatusEnum('status').default('draft').notNull(),
    terms: jsonb('terms').$type<Record<string, unknown>>(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('financing_agreements_number_uq').on(t.merchantId, t.agreementNumber),
    index('financing_agreements_financing_idx').on(t.financingId),
  ],
);

export const disbursementRecords = funding.table(
  'disbursement_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    financingId: uuid('financing_id')
      .notNull()
      .references(() => financingRecords.id, { onDelete: 'cascade' }),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    disbursementNumber: varchar('disbursement_number', { length: 64 }).notNull(),
    amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).default('IDR').notNull(),
    status: disbursementStatusEnum('status').default('pending').notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    disbursedAt: timestamp('disbursed_at', { withTimezone: true }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    reference: varchar('reference', { length: 128 }),
    notes: text('notes'),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('disbursement_records_number_uq').on(t.merchantId, t.disbursementNumber),
    index('disbursement_records_financing_idx').on(t.financingId),
    index('disbursement_records_status_idx').on(t.status),
  ],
);

export const repaymentSchedules = funding.table(
  'repayment_schedules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    financingId: uuid('financing_id')
      .notNull()
      .references(() => financingRecords.id, { onDelete: 'cascade' }),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    installmentNumber: integer('installment_number').notNull(),
    dueDate: date('due_date').notNull(),
    principalAmount: numeric('principal_amount', { precision: 18, scale: 2 }).default('0').notNull(),
    interestAmount: numeric('interest_amount', { precision: 18, scale: 2 }).default('0').notNull(),
    feeAmount: numeric('fee_amount', { precision: 18, scale: 2 }).default('0').notNull(),
    totalAmount: numeric('total_amount', { precision: 18, scale: 2 }).notNull(),
    paidAmount: numeric('paid_amount', { precision: 18, scale: 2 }).default('0').notNull(),
    status: repaymentStatusEnum('status').default('scheduled').notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('repayment_schedules_installment_uq').on(t.financingId, t.installmentNumber),
    index('repayment_schedules_merchant_idx').on(t.merchantId),
    index('repayment_schedules_due_idx').on(t.dueDate),
    index('repayment_schedules_status_idx').on(t.status),
  ],
);

export const repaymentTransactions = funding.table(
  'repayment_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scheduleId: uuid('schedule_id')
      .notNull()
      .references(() => repaymentSchedules.id, { onDelete: 'cascade' }),
    financingId: uuid('financing_id')
      .notNull()
      .references(() => financingRecords.id, { onDelete: 'cascade' }),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    transactionNumber: varchar('transaction_number', { length: 64 }).notNull(),
    amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
    status: repaymentTransactionStatusEnum('status').default('pending').notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    method: varchar('method', { length: 64 }),
    reference: varchar('reference', { length: 128 }),
    notes: text('notes'),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('repayment_transactions_number_uq').on(t.merchantId, t.transactionNumber),
    index('repayment_transactions_schedule_idx').on(t.scheduleId),
    index('repayment_transactions_status_idx').on(t.status),
  ],
);

export const fundUtilizationReports = funding.table(
  'fund_utilization_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    financingId: uuid('financing_id')
      .notNull()
      .references(() => financingRecords.id, { onDelete: 'cascade' }),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    reportNumber: varchar('report_number', { length: 64 }).notNull(),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    totalUsed: numeric('total_used', { precision: 18, scale: 2 }).default('0').notNull(),
    description: text('description'),
    breakdown: jsonb('breakdown').$type<Record<string, unknown>>(),
    status: utilizationReportStatusEnum('status').default('draft').notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    notes: text('notes'),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('fund_utilization_reports_number_uq').on(t.merchantId, t.reportNumber),
    index('fund_utilization_reports_financing_idx').on(t.financingId),
    index('fund_utilization_reports_status_idx').on(t.status),
  ],
);

export const financingMonitoringReports = funding.table(
  'financing_monitoring_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    financingId: uuid('financing_id')
      .notNull()
      .references(() => financingRecords.id, { onDelete: 'cascade' }),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    reportNumber: varchar('report_number', { length: 64 }).notNull(),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    revenue: numeric('revenue', { precision: 18, scale: 2 }).default('0').notNull(),
    profit: numeric('profit', { precision: 18, scale: 2 }).default('0').notNull(),
    cashFlow: numeric('cash_flow', { precision: 18, scale: 2 }).default('0').notNull(),
    repaymentCapacity: numeric('repayment_capacity', { precision: 18, scale: 2 }),
    riskLevel: riskLevelEnum('risk_level').default('low').notNull(),
    status: monitoringStatusEnum('status').default('draft').notNull(),
    findings: text('findings'),
    recommendation: text('recommendation'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('financing_monitoring_reports_number_uq').on(t.merchantId, t.reportNumber),
    index('financing_monitoring_reports_financing_idx').on(t.financingId),
    index('financing_monitoring_reports_risk_idx').on(t.riskLevel),
  ],
);

export const riskIndicators = funding.table(
  'risk_indicators',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    category: riskIndicatorTypeEnum('category').default('other').notNull(),
    description: text('description'),
    thresholdLow: numeric('threshold_low', { precision: 18, scale: 4 }),
    thresholdMedium: numeric('threshold_medium', { precision: 18, scale: 4 }),
    thresholdHigh: numeric('threshold_high', { precision: 18, scale: 4 }),
    unit: varchar('unit', { length: 32 }),
    direction: varchar('direction', { length: 32 }).default('higher_better').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('risk_indicators_code_uq').on(t.merchantId, t.code),
    index('risk_indicators_merchant_idx').on(t.merchantId),
  ],
);

export const riskAssessments = funding.table(
  'risk_assessments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    financingId: uuid('financing_id').references(() => financingRecords.id, {
      onDelete: 'cascade',
    }),
    indicatorId: uuid('indicator_id').references(() => riskIndicators.id, {
      onDelete: 'set null',
    }),
    assessmentDate: date('assessment_date').notNull(),
    score: numeric('score', { precision: 8, scale: 2 }).default('0').notNull(),
    riskLevel: riskLevelEnum('risk_level').default('low').notNull(),
    status: riskAssessmentStatusEnum('status').default('draft').notNull(),
    findings: text('findings'),
    mitigation: text('mitigation'),
    assessedBy: uuid('assessed_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('risk_assessments_merchant_idx').on(t.merchantId),
    index('risk_assessments_financing_idx').on(t.financingId),
    index('risk_assessments_level_idx').on(t.riskLevel),
  ],
);
