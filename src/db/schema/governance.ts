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
import { governance, organizations, users } from './core';

/**
 * SYS-06 Data Governance & Security Management.
 *
 * Klasifikasi data, consent, kebijakan akses, log akses, retensi data,
 * insiden keamanan, dan permintaan privasi. Tabel `governance.audit_logs`
 * didefinisikan di `core.ts` karena dipakai lintas modul sejak awal.
 */
const createdAt = timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = timestamp('updated_at', { withTimezone: true })
  .defaultNow()
  .notNull()
  .$onUpdate(() => new Date());

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const dataClassificationLevelEnum = governance.enum('data_classification_level', [
  'public',
  'internal',
  'confidential',
  'restricted',
]);

export const consentTypeEnum = governance.enum('consent_type', [
  'marketing',
  'analytics',
  'data_sharing',
  'profiling',
  'terms',
  'privacy_policy',
]);

export const consentStatusEnum = governance.enum('consent_status', [
  'pending',
  'granted',
  'withdrawn',
  'expired',
]);

export const accessPolicyTypeEnum = governance.enum('access_policy_type', [
  'role_based',
  'attribute_based',
  'purpose_based',
  'data_sharing',
]);

export const accessPolicyEffectEnum = governance.enum('access_policy_effect', ['allow', 'deny']);

export const accessPolicyStatusEnum = governance.enum('access_policy_status', [
  'draft',
  'active',
  'inactive',
]);

export const dataAccessActionEnum = governance.enum('data_access_action', [
  'read',
  'create',
  'update',
  'delete',
  'export',
  'share',
]);

export const dataAccessStatusEnum = governance.enum('data_access_status', [
  'granted',
  'denied',
  'error',
]);

export const retentionActionEnum = governance.enum('retention_action', [
  'archive',
  'delete',
  'anonymize',
  'review',
]);

export const retentionStatusEnum = governance.enum('retention_status', ['active', 'inactive']);

export const incidentSeverityEnum = governance.enum('incident_severity', [
  'low',
  'medium',
  'high',
  'critical',
]);

export const incidentCategoryEnum = governance.enum('incident_category', [
  'data_breach',
  'unauthorized_access',
  'malware',
  'phishing',
  'denial_of_service',
  'misconfiguration',
  'other',
]);

export const incidentStatusEnum = governance.enum('incident_status', [
  'open',
  'investigating',
  'contained',
  'resolved',
  'closed',
]);

export const privacyRequestTypeEnum = governance.enum('privacy_request_type', [
  'access',
  'correction',
  'deletion',
  'portability',
  'objection',
  'restriction',
]);

export const privacyRequestStatusEnum = governance.enum('privacy_request_status', [
  'submitted',
  'verified',
  'processing',
  'completed',
  'rejected',
  'cancelled',
]);

/* ------------------------------------------------------------------ */
/* Klasifikasi data                                                    */
/* ------------------------------------------------------------------ */

export const dataClassifications = governance.table(
  'data_classifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    description: text('description'),
    category: varchar('category', { length: 64 }),
    sensitivityLevel: dataClassificationLevelEnum('sensitivity_level').default('internal').notNull(),
    retentionDays: integer('retention_days'),
    handlingRules: jsonb('handling_rules').$type<Record<string, unknown>>(),
    isActive: boolean('is_active').default(true).notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('data_classifications_code_uq').on(t.code),
    index('data_classifications_level_idx').on(t.sensitivityLevel),
  ],
);

/* ------------------------------------------------------------------ */
/* Consent                                                             */
/* ------------------------------------------------------------------ */

export const dataConsents = governance.table(
  'data_consents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'set null',
    }),
    consentType: consentTypeEnum('consent_type').notNull(),
    purpose: text('purpose'),
    status: consentStatusEnum('status').default('pending').notNull(),
    version: varchar('version', { length: 32 }).default('1.0').notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true }),
    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    source: varchar('source', { length: 64 }),
    evidence: jsonb('evidence').$type<Record<string, unknown>>(),
    ipAddress: varchar('ip_address', { length: 64 }),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('data_consents_user_idx').on(t.userId),
    index('data_consents_org_idx').on(t.organizationId),
    index('data_consents_status_idx').on(t.status),
  ],
);

/* ------------------------------------------------------------------ */
/* Kebijakan akses                                                     */
/* ------------------------------------------------------------------ */

export const dataAccessPolicies = governance.table(
  'data_access_policies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    description: text('description'),
    dataClassificationId: uuid('data_classification_id').references(() => dataClassifications.id, {
      onDelete: 'set null',
    }),
    policyType: accessPolicyTypeEnum('policy_type').default('role_based').notNull(),
    effect: accessPolicyEffectEnum('effect').default('allow').notNull(),
    subjectType: varchar('subject_type', { length: 64 }),
    subjectId: varchar('subject_id', { length: 64 }),
    resource: varchar('resource', { length: 128 }),
    actions: jsonb('actions').$type<string[]>().default([]).notNull(),
    conditions: jsonb('conditions').$type<Record<string, unknown>>(),
    priority: integer('priority').default(100).notNull(),
    status: accessPolicyStatusEnum('status').default('draft').notNull(),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('data_access_policies_code_uq').on(t.code),
    index('data_access_policies_classification_idx').on(t.dataClassificationId),
    index('data_access_policies_status_idx').on(t.status),
  ],
);

/* ------------------------------------------------------------------ */
/* Log akses data                                                      */
/* ------------------------------------------------------------------ */

export const dataAccessLogs = governance.table(
  'data_access_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    dataClassificationId: uuid('data_classification_id').references(() => dataClassifications.id, {
      onDelete: 'set null',
    }),
    resourceType: varchar('resource_type', { length: 100 }).notNull(),
    resourceId: varchar('resource_id', { length: 64 }),
    action: dataAccessActionEnum('action').notNull(),
    status: dataAccessStatusEnum('status').default('granted').notNull(),
    purpose: varchar('purpose', { length: 255 }),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt,
  },
  (t) => [
    index('data_access_logs_user_idx').on(t.userId),
    index('data_access_logs_resource_idx').on(t.resourceType, t.resourceId),
    index('data_access_logs_created_idx').on(t.createdAt),
  ],
);

/* ------------------------------------------------------------------ */
/* Retensi data                                                        */
/* ------------------------------------------------------------------ */

export const dataRetentionPolicies = governance.table(
  'data_retention_policies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    description: text('description'),
    entityType: varchar('entity_type', { length: 100 }).notNull(),
    dataClassificationId: uuid('data_classification_id').references(() => dataClassifications.id, {
      onDelete: 'set null',
    }),
    retentionDays: integer('retention_days').notNull(),
    action: retentionActionEnum('action').default('archive').notNull(),
    legalBasis: text('legal_basis'),
    status: retentionStatusEnum('status').default('active').notNull(),
    lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('data_retention_policies_code_uq').on(t.code),
    index('data_retention_policies_entity_idx').on(t.entityType),
    index('data_retention_policies_status_idx').on(t.status),
  ],
);

/* ------------------------------------------------------------------ */
/* Insiden keamanan                                                    */
/* ------------------------------------------------------------------ */

export const securityIncidents = governance.table(
  'security_incidents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    incidentNumber: varchar('incident_number', { length: 32 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    category: incidentCategoryEnum('category').default('other').notNull(),
    severity: incidentSeverityEnum('severity').default('medium').notNull(),
    status: incidentStatusEnum('status').default('open').notNull(),
    detectedAt: timestamp('detected_at', { withTimezone: true }).defaultNow().notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    reportedBy: uuid('reported_by').references(() => users.id, { onDelete: 'set null' }),
    assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
    dataClassificationId: uuid('data_classification_id').references(() => dataClassifications.id, {
      onDelete: 'set null',
    }),
    affectedSystems: jsonb('affected_systems').$type<string[]>().default([]).notNull(),
    affectedRecords: integer('affected_records'),
    containmentActions: text('containment_actions'),
    rootCause: text('root_cause'),
    remediation: text('remediation'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('security_incidents_number_uq').on(t.incidentNumber),
    index('security_incidents_status_idx').on(t.status),
    index('security_incidents_severity_idx').on(t.severity),
    index('security_incidents_detected_idx').on(t.detectedAt),
  ],
);

/* ------------------------------------------------------------------ */
/* Permintaan privasi                                                  */
/* ------------------------------------------------------------------ */

export const privacyRequests = governance.table(
  'privacy_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestNumber: varchar('request_number', { length: 32 }).notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    requesterName: varchar('requester_name', { length: 255 }).notNull(),
    requesterEmail: varchar('requester_email', { length: 255 }).notNull(),
    requestType: privacyRequestTypeEnum('request_type').notNull(),
    status: privacyRequestStatusEnum('status').default('submitted').notNull(),
    description: text('description'),
    responseNotes: text('response_notes'),
    receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
    attachments: jsonb('attachments').$type<Record<string, unknown>[]>().default([]).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('privacy_requests_number_uq').on(t.requestNumber),
    index('privacy_requests_status_idx').on(t.status),
    index('privacy_requests_email_idx').on(t.requesterEmail),
  ],
);
