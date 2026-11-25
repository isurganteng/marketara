import { and, asc, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  dataAccessLogs,
  dataAccessPolicies,
  dataClassifications,
  dataConsents,
  dataRetentionPolicies,
  privacyRequests,
  securityIncidents,
  users,
} from '../../db/schema';
import { writeAuditLog } from '../../lib/audit';
import type { AppEnv } from '../../lib/app-env';
import { ApiError } from '../../lib/errors';
import { getPagination, ok, paginated } from '../../lib/http';
import { validate } from '../../lib/validator';
import { requireAuth, requirePermission } from '../../middleware/auth';
import { getClientIp } from '../../services/auth';

const codeSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[A-Za-z0-9_.-]+$/, 'Gunakan huruf, angka, titik, garis bawah, atau tanda hubung');
const optionalText = (max = 8000) => z.string().trim().max(max).optional().nullable();
const classificationLevelSchema = z.enum(['public', 'internal', 'confidential', 'restricted']);
const consentTypeSchema = z.enum([
  'marketing',
  'analytics',
  'data_sharing',
  'profiling',
  'terms',
  'privacy_policy',
]);
const consentStatusSchema = z.enum(['pending', 'granted', 'withdrawn', 'expired']);
const policyTypeSchema = z.enum([
  'role_based',
  'attribute_based',
  'purpose_based',
  'data_sharing',
]);
const policyEffectSchema = z.enum(['allow', 'deny']);
const policyStatusSchema = z.enum(['draft', 'active', 'inactive']);
const accessActionSchema = z.enum(['read', 'create', 'update', 'delete', 'export', 'share']);
const accessStatusSchema = z.enum(['granted', 'denied', 'error']);
const retentionActionSchema = z.enum(['archive', 'delete', 'anonymize', 'review']);
const retentionStatusSchema = z.enum(['active', 'inactive']);
const incidentSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
const incidentCategorySchema = z.enum([
  'data_breach',
  'unauthorized_access',
  'malware',
  'phishing',
  'denial_of_service',
  'misconfiguration',
  'other',
]);
const incidentStatusSchema = z.enum(['open', 'investigating', 'contained', 'resolved', 'closed']);
const privacyRequestTypeSchema = z.enum([
  'access',
  'correction',
  'deletion',
  'portability',
  'objection',
  'restriction',
]);
const privacyRequestStatusSchema = z.enum([
  'submitted',
  'verified',
  'processing',
  'completed',
  'rejected',
  'cancelled',
]);

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
});

const createClassificationSchema = z.object({
  code: codeSchema.optional(),
  name: z.string().trim().min(2).max(128),
  description: optionalText(),
  category: z.string().trim().max(64).optional().nullable(),
  sensitivityLevel: classificationLevelSchema.default('internal'),
  retentionDays: z.coerce.number().int().min(1).max(36500).optional().nullable(),
  handlingRules: z.record(z.string(), z.unknown()).optional().nullable(),
  isActive: z.boolean().default(true),
});
const updateClassificationSchema = createClassificationSchema.partial();

const createConsentSchema = z.object({
  userId: z.uuid().optional().nullable(),
  organizationId: z.uuid().optional().nullable(),
  consentType: consentTypeSchema,
  purpose: optionalText(),
  status: consentStatusSchema.default('pending'),
  version: z.string().trim().max(32).default('1.0'),
  grantedAt: z.coerce.date().optional().nullable(),
  withdrawnAt: z.coerce.date().optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
  source: z.string().trim().max(64).optional().nullable(),
  evidence: z.record(z.string(), z.unknown()).optional().nullable(),
  ipAddress: z.string().trim().max(64).optional().nullable(),
});
const updateConsentSchema = createConsentSchema.partial();

const createPolicySchema = z.object({
  code: codeSchema.optional(),
  name: z.string().trim().min(2).max(128),
  description: optionalText(),
  dataClassificationId: z.uuid().optional().nullable(),
  policyType: policyTypeSchema.default('role_based'),
  effect: policyEffectSchema.default('allow'),
  subjectType: z.string().trim().max(64).optional().nullable(),
  subjectId: z.string().trim().max(64).optional().nullable(),
  resource: z.string().trim().max(128).optional().nullable(),
  actions: z.array(accessActionSchema).default([]),
  conditions: z.record(z.string(), z.unknown()).optional().nullable(),
  priority: z.coerce.number().int().min(0).max(9999).default(100),
  status: policyStatusSchema.default('draft'),
  effectiveFrom: z.coerce.date().optional().nullable(),
  effectiveTo: z.coerce.date().optional().nullable(),
});
const updatePolicySchema = createPolicySchema.partial();

const createAccessLogSchema = z.object({
  userId: z.uuid().optional().nullable(),
  dataClassificationId: z.uuid().optional().nullable(),
  resourceType: z.string().trim().min(2).max(100),
  resourceId: z.string().trim().max(64).optional().nullable(),
  action: accessActionSchema,
  status: accessStatusSchema.default('granted'),
  purpose: z.string().trim().max(255).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

const createRetentionSchema = z.object({
  code: codeSchema.optional(),
  name: z.string().trim().min(2).max(128),
  description: optionalText(),
  entityType: z.string().trim().min(2).max(100),
  dataClassificationId: z.uuid().optional().nullable(),
  retentionDays: z.coerce.number().int().min(1).max(36500),
  action: retentionActionSchema.default('archive'),
  legalBasis: optionalText(),
  status: retentionStatusSchema.default('active'),
  lastReviewedAt: z.coerce.date().optional().nullable(),
});
const updateRetentionSchema = createRetentionSchema.partial();

const createIncidentSchema = z.object({
  title: z.string().trim().min(2).max(255),
  description: optionalText(),
  category: incidentCategorySchema.default('other'),
  severity: incidentSeveritySchema.default('medium'),
  status: incidentStatusSchema.default('open'),
  detectedAt: z.coerce.date().optional(),
  occurredAt: z.coerce.date().optional().nullable(),
  assignedTo: z.uuid().optional().nullable(),
  dataClassificationId: z.uuid().optional().nullable(),
  affectedSystems: z.array(z.string().trim().min(1).max(100)).default([]),
  affectedRecords: z.coerce.number().int().min(0).optional().nullable(),
  containmentActions: optionalText(),
  rootCause: optionalText(),
  remediation: optionalText(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});
const updateIncidentSchema = createIncidentSchema.partial();

const createPrivacyRequestSchema = z.object({
  userId: z.uuid().optional().nullable(),
  requesterName: z.string().trim().min(2).max(255),
  requesterEmail: z.email(),
  requestType: privacyRequestTypeSchema,
  status: privacyRequestStatusSchema.default('submitted'),
  description: optionalText(),
  responseNotes: optionalText(),
  receivedAt: z.coerce.date().optional(),
  dueAt: z.coerce.date().optional().nullable(),
  assignedTo: z.uuid().optional().nullable(),
  attachments: z.array(z.record(z.string(), z.unknown())).default([]),
});
const updatePrivacyRequestSchema = createPrivacyRequestSchema.partial();

export const governanceRoutes = new Hono<AppEnv>();
governanceRoutes.use('*', requireAuth);

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

function makeCode(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}`;
}

/* --------------------------- Klasifikasi data -------------------------- */

governanceRoutes.get(
  '/classifications',
  requirePermission('governance:read'),
  validate('query', listSchema.extend({ sensitivityLevel: classificationLevelSchema.optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.sensitivityLevel) {
      conditions.push(eq(dataClassifications.sensitivityLevel, query.sensitivityLevel));
    }
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(dataClassifications.code, term),
          ilike(dataClassifications.name, term),
        ) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(dataClassifications)
        .where(where)
        .orderBy(asc(dataClassifications.name))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(dataClassifications).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

governanceRoutes.post(
  '/classifications',
  requirePermission('governance:write'),
  validate('json', createClassificationSchema),
  async (c) => {
    const body = c.req.valid('json');
    const [created] = await db
      .insert(dataClassifications)
      .values({
        ...body,
        code: body.code ?? makeCode('dc'),
        description: body.description ?? null,
        category: body.category ?? null,
        retentionDays: body.retentionDays ?? null,
        handlingRules: body.handlingRules ?? null,
        createdBy: c.get('user').id,
      })
      .returning();
    await audit(c, 'governance.classification.create', 'data_classification', created!.id);
    return ok(c, created!, 201);
  },
);

governanceRoutes.patch(
  '/classifications/:id',
  requirePermission('governance:write'),
  validate('json', updateClassificationSchema),
  async (c) => {
    const body = c.req.valid('json');
    const row = await db.query.dataClassifications.findFirst({
      where: eq(dataClassifications.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Klasifikasi data tidak ditemukan');
    const [updated] = await db
      .update(dataClassifications)
      .set({ ...body })
      .where(eq(dataClassifications.id, row.id))
      .returning();
    await audit(c, 'governance.classification.update', 'data_classification', row.id);
    return ok(c, updated!);
  },
);

governanceRoutes.delete(
  '/classifications/:id',
  requirePermission('governance:manage'),
  async (c) => {
    const row = await db.query.dataClassifications.findFirst({
      where: eq(dataClassifications.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Klasifikasi data tidak ditemukan');
    await db.delete(dataClassifications).where(eq(dataClassifications.id, row.id));
    await audit(c, 'governance.classification.delete', 'data_classification', row.id);
    return ok(c, { id: row.id, deleted: true });
  },
);

/* -------------------------------- Consent ------------------------------ */

governanceRoutes.get(
  '/consents',
  requirePermission('governance:read'),
  validate(
    'query',
    listSchema.extend({
      consentType: consentTypeSchema.optional(),
      status: consentStatusSchema.optional(),
      userId: z.uuid().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.consentType) conditions.push(eq(dataConsents.consentType, query.consentType));
    if (query.status) conditions.push(eq(dataConsents.status, query.status));
    if (query.userId) conditions.push(eq(dataConsents.userId, query.userId));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(ilike(users.email, term), ilike(users.fullName, term)) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: dataConsents.id,
          userId: dataConsents.userId,
          userName: users.fullName,
          userEmail: users.email,
          organizationId: dataConsents.organizationId,
          consentType: dataConsents.consentType,
          purpose: dataConsents.purpose,
          status: dataConsents.status,
          version: dataConsents.version,
          grantedAt: dataConsents.grantedAt,
          withdrawnAt: dataConsents.withdrawnAt,
          expiresAt: dataConsents.expiresAt,
          source: dataConsents.source,
          createdAt: dataConsents.createdAt,
          updatedAt: dataConsents.updatedAt,
        })
        .from(dataConsents)
        .leftJoin(users, eq(users.id, dataConsents.userId))
        .where(where)
        .orderBy(desc(dataConsents.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(dataConsents).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

governanceRoutes.post(
  '/consents',
  requirePermission('governance:write'),
  validate('json', createConsentSchema),
  async (c) => {
    const body = c.req.valid('json');
    const [created] = await db
      .insert(dataConsents)
      .values({
        ...body,
        userId: body.userId ?? c.get('user').id,
        organizationId: body.organizationId ?? null,
        purpose: body.purpose ?? null,
        grantedAt: body.grantedAt ?? (body.status === 'granted' ? new Date() : null),
        withdrawnAt: body.withdrawnAt ?? null,
        expiresAt: body.expiresAt ?? null,
        source: body.source ?? 'admin',
        evidence: body.evidence ?? null,
        ipAddress: body.ipAddress ?? getClientIp(c),
      })
      .returning();
    await audit(c, 'governance.consent.create', 'data_consent', created!.id);
    return ok(c, created!, 201);
  },
);

governanceRoutes.patch(
  '/consents/:id',
  requirePermission('governance:write'),
  validate('json', updateConsentSchema),
  async (c) => {
    const body = c.req.valid('json');
    const row = await db.query.dataConsents.findFirst({
      where: eq(dataConsents.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Consent tidak ditemukan');
    const [updated] = await db
      .update(dataConsents)
      .set({ ...body })
      .where(eq(dataConsents.id, row.id))
      .returning();
    await audit(c, 'governance.consent.update', 'data_consent', row.id);
    return ok(c, updated!);
  },
);

governanceRoutes.post(
  '/consents/:id/withdraw',
  requirePermission('governance:write'),
  async (c) => {
    const row = await db.query.dataConsents.findFirst({
      where: eq(dataConsents.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Consent tidak ditemukan');
    if (row.status === 'withdrawn') throw ApiError.badRequest('Consent sudah dicabut');
    const [updated] = await db
      .update(dataConsents)
      .set({ status: 'withdrawn', withdrawnAt: new Date() })
      .where(eq(dataConsents.id, row.id))
      .returning();
    await audit(c, 'governance.consent.withdraw', 'data_consent', row.id);
    return ok(c, updated!);
  },
);

governanceRoutes.delete(
  '/consents/:id',
  requirePermission('governance:manage'),
  async (c) => {
    const row = await db.query.dataConsents.findFirst({
      where: eq(dataConsents.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Consent tidak ditemukan');
    await db.delete(dataConsents).where(eq(dataConsents.id, row.id));
    await audit(c, 'governance.consent.delete', 'data_consent', row.id);
    return ok(c, { id: row.id, deleted: true });
  },
);

/* --------------------------- Kebijakan akses --------------------------- */

governanceRoutes.get(
  '/access-policies',
  requirePermission('governance:read'),
  validate('query', listSchema.extend({ status: policyStatusSchema.optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.status) conditions.push(eq(dataAccessPolicies.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(dataAccessPolicies.code, term),
          ilike(dataAccessPolicies.name, term),
        ) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: dataAccessPolicies.id,
          code: dataAccessPolicies.code,
          name: dataAccessPolicies.name,
          description: dataAccessPolicies.description,
          dataClassificationId: dataAccessPolicies.dataClassificationId,
          classificationName: dataClassifications.name,
          policyType: dataAccessPolicies.policyType,
          effect: dataAccessPolicies.effect,
          subjectType: dataAccessPolicies.subjectType,
          resource: dataAccessPolicies.resource,
          actions: dataAccessPolicies.actions,
          priority: dataAccessPolicies.priority,
          status: dataAccessPolicies.status,
          effectiveFrom: dataAccessPolicies.effectiveFrom,
          effectiveTo: dataAccessPolicies.effectiveTo,
          createdAt: dataAccessPolicies.createdAt,
          updatedAt: dataAccessPolicies.updatedAt,
        })
        .from(dataAccessPolicies)
        .leftJoin(
          dataClassifications,
          eq(dataClassifications.id, dataAccessPolicies.dataClassificationId),
        )
        .where(where)
        .orderBy(asc(dataAccessPolicies.priority), asc(dataAccessPolicies.name))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(dataAccessPolicies).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

governanceRoutes.post(
  '/access-policies',
  requirePermission('governance:write'),
  validate('json', createPolicySchema),
  async (c) => {
    const body = c.req.valid('json');
    const [created] = await db
      .insert(dataAccessPolicies)
      .values({
        ...body,
        code: body.code ?? makeCode('policy'),
        description: body.description ?? null,
        dataClassificationId: body.dataClassificationId ?? null,
        subjectType: body.subjectType ?? null,
        subjectId: body.subjectId ?? null,
        resource: body.resource ?? null,
        conditions: body.conditions ?? null,
        effectiveFrom: body.effectiveFrom ?? null,
        effectiveTo: body.effectiveTo ?? null,
        createdBy: c.get('user').id,
      })
      .returning();
    await audit(c, 'governance.policy.create', 'data_access_policy', created!.id);
    return ok(c, created!, 201);
  },
);

governanceRoutes.patch(
  '/access-policies/:id',
  requirePermission('governance:write'),
  validate('json', updatePolicySchema),
  async (c) => {
    const body = c.req.valid('json');
    const row = await db.query.dataAccessPolicies.findFirst({
      where: eq(dataAccessPolicies.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Kebijakan akses tidak ditemukan');
    const [updated] = await db
      .update(dataAccessPolicies)
      .set({ ...body })
      .where(eq(dataAccessPolicies.id, row.id))
      .returning();
    await audit(c, 'governance.policy.update', 'data_access_policy', row.id);
    return ok(c, updated!);
  },
);

governanceRoutes.delete(
  '/access-policies/:id',
  requirePermission('governance:manage'),
  async (c) => {
    const row = await db.query.dataAccessPolicies.findFirst({
      where: eq(dataAccessPolicies.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Kebijakan akses tidak ditemukan');
    await db.delete(dataAccessPolicies).where(eq(dataAccessPolicies.id, row.id));
    await audit(c, 'governance.policy.delete', 'data_access_policy', row.id);
    return ok(c, { id: row.id, deleted: true });
  },
);

/* ----------------------------- Log akses data -------------------------- */

governanceRoutes.get(
  '/access-logs',
  requirePermission('governance:read'),
  validate(
    'query',
    listSchema.extend({
      action: accessActionSchema.optional(),
      status: accessStatusSchema.optional(),
      resourceType: z.string().trim().max(100).optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.action) conditions.push(eq(dataAccessLogs.action, query.action));
    if (query.status) conditions.push(eq(dataAccessLogs.status, query.status));
    if (query.resourceType) {
      conditions.push(eq(dataAccessLogs.resourceType, query.resourceType));
    }
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(dataAccessLogs.resourceType, term),
          ilike(dataAccessLogs.resourceId, term),
          ilike(users.email, term),
        ) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: dataAccessLogs.id,
          userId: dataAccessLogs.userId,
          userName: users.fullName,
          userEmail: users.email,
          dataClassificationId: dataAccessLogs.dataClassificationId,
          classificationName: dataClassifications.name,
          resourceType: dataAccessLogs.resourceType,
          resourceId: dataAccessLogs.resourceId,
          action: dataAccessLogs.action,
          status: dataAccessLogs.status,
          purpose: dataAccessLogs.purpose,
          ipAddress: dataAccessLogs.ipAddress,
          createdAt: dataAccessLogs.createdAt,
        })
        .from(dataAccessLogs)
        .leftJoin(users, eq(users.id, dataAccessLogs.userId))
        .leftJoin(
          dataClassifications,
          eq(dataClassifications.id, dataAccessLogs.dataClassificationId),
        )
        .where(where)
        .orderBy(desc(dataAccessLogs.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(dataAccessLogs).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

governanceRoutes.post(
  '/access-logs',
  requirePermission('governance:write'),
  validate('json', createAccessLogSchema),
  async (c) => {
    const body = c.req.valid('json');
    const [created] = await db
      .insert(dataAccessLogs)
      .values({
        ...body,
        userId: body.userId ?? c.get('user').id,
        dataClassificationId: body.dataClassificationId ?? null,
        resourceId: body.resourceId ?? null,
        purpose: body.purpose ?? null,
        ipAddress: getClientIp(c),
        userAgent: c.req.header('user-agent') ?? null,
        metadata: body.metadata ?? null,
      })
      .returning();
    return ok(c, created!, 201);
  },
);

/* ------------------------------ Retensi data --------------------------- */

governanceRoutes.get(
  '/retention-policies',
  requirePermission('governance:read'),
  validate('query', listSchema.extend({ status: retentionStatusSchema.optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.status) conditions.push(eq(dataRetentionPolicies.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(dataRetentionPolicies.code, term),
          ilike(dataRetentionPolicies.name, term),
          ilike(dataRetentionPolicies.entityType, term),
        ) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: dataRetentionPolicies.id,
          code: dataRetentionPolicies.code,
          name: dataRetentionPolicies.name,
          description: dataRetentionPolicies.description,
          entityType: dataRetentionPolicies.entityType,
          dataClassificationId: dataRetentionPolicies.dataClassificationId,
          classificationName: dataClassifications.name,
          retentionDays: dataRetentionPolicies.retentionDays,
          action: dataRetentionPolicies.action,
          legalBasis: dataRetentionPolicies.legalBasis,
          status: dataRetentionPolicies.status,
          lastReviewedAt: dataRetentionPolicies.lastReviewedAt,
          createdAt: dataRetentionPolicies.createdAt,
          updatedAt: dataRetentionPolicies.updatedAt,
        })
        .from(dataRetentionPolicies)
        .leftJoin(
          dataClassifications,
          eq(dataClassifications.id, dataRetentionPolicies.dataClassificationId),
        )
        .where(where)
        .orderBy(asc(dataRetentionPolicies.entityType))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(dataRetentionPolicies).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

governanceRoutes.post(
  '/retention-policies',
  requirePermission('governance:write'),
  validate('json', createRetentionSchema),
  async (c) => {
    const body = c.req.valid('json');
    const [created] = await db
      .insert(dataRetentionPolicies)
      .values({
        ...body,
        code: body.code ?? makeCode('ret'),
        description: body.description ?? null,
        dataClassificationId: body.dataClassificationId ?? null,
        legalBasis: body.legalBasis ?? null,
        lastReviewedAt: body.lastReviewedAt ?? null,
        createdBy: c.get('user').id,
      })
      .returning();
    await audit(c, 'governance.retention.create', 'data_retention_policy', created!.id);
    return ok(c, created!, 201);
  },
);

governanceRoutes.patch(
  '/retention-policies/:id',
  requirePermission('governance:write'),
  validate('json', updateRetentionSchema),
  async (c) => {
    const body = c.req.valid('json');
    const row = await db.query.dataRetentionPolicies.findFirst({
      where: eq(dataRetentionPolicies.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Kebijakan retensi tidak ditemukan');
    const [updated] = await db
      .update(dataRetentionPolicies)
      .set({ ...body })
      .where(eq(dataRetentionPolicies.id, row.id))
      .returning();
    await audit(c, 'governance.retention.update', 'data_retention_policy', row.id);
    return ok(c, updated!);
  },
);

governanceRoutes.post(
  '/retention-policies/:id/review',
  requirePermission('governance:write'),
  async (c) => {
    const row = await db.query.dataRetentionPolicies.findFirst({
      where: eq(dataRetentionPolicies.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Kebijakan retensi tidak ditemukan');
    const [updated] = await db
      .update(dataRetentionPolicies)
      .set({ lastReviewedAt: new Date(), reviewedBy: c.get('user').id })
      .where(eq(dataRetentionPolicies.id, row.id))
      .returning();
    await audit(c, 'governance.retention.review', 'data_retention_policy', row.id);
    return ok(c, updated!);
  },
);

governanceRoutes.delete(
  '/retention-policies/:id',
  requirePermission('governance:manage'),
  async (c) => {
    const row = await db.query.dataRetentionPolicies.findFirst({
      where: eq(dataRetentionPolicies.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Kebijakan retensi tidak ditemukan');
    await db.delete(dataRetentionPolicies).where(eq(dataRetentionPolicies.id, row.id));
    await audit(c, 'governance.retention.delete', 'data_retention_policy', row.id);
    return ok(c, { id: row.id, deleted: true });
  },
);

/* ---------------------------- Insiden keamanan ------------------------- */

governanceRoutes.get(
  '/incidents',
  requirePermission('governance:read'),
  validate(
    'query',
    listSchema.extend({ severity: incidentSeveritySchema.optional(), status: incidentStatusSchema.optional() }),
  ),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.severity) conditions.push(eq(securityIncidents.severity, query.severity));
    if (query.status) conditions.push(eq(securityIncidents.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(securityIncidents.incidentNumber, term),
          ilike(securityIncidents.title, term),
        ) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: securityIncidents.id,
          incidentNumber: securityIncidents.incidentNumber,
          title: securityIncidents.title,
          description: securityIncidents.description,
          category: securityIncidents.category,
          severity: securityIncidents.severity,
          status: securityIncidents.status,
          detectedAt: securityIncidents.detectedAt,
          resolvedAt: securityIncidents.resolvedAt,
          dataClassificationId: securityIncidents.dataClassificationId,
          classificationName: dataClassifications.name,
          affectedRecords: securityIncidents.affectedRecords,
          createdAt: securityIncidents.createdAt,
          updatedAt: securityIncidents.updatedAt,
        })
        .from(securityIncidents)
        .leftJoin(
          dataClassifications,
          eq(dataClassifications.id, securityIncidents.dataClassificationId),
        )
        .where(where)
        .orderBy(desc(securityIncidents.detectedAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(securityIncidents).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

governanceRoutes.post(
  '/incidents',
  requirePermission('governance:write'),
  validate('json', createIncidentSchema),
  async (c) => {
    const body = c.req.valid('json');
    const [created] = await db
      .insert(securityIncidents)
      .values({
        ...body,
        incidentNumber: `INC-${Date.now()}`,
        description: body.description ?? null,
        detectedAt: body.detectedAt ?? new Date(),
        occurredAt: body.occurredAt ?? null,
        assignedTo: body.assignedTo ?? null,
        dataClassificationId: body.dataClassificationId ?? null,
        affectedRecords: body.affectedRecords ?? null,
        containmentActions: body.containmentActions ?? null,
        rootCause: body.rootCause ?? null,
        remediation: body.remediation ?? null,
        metadata: body.metadata ?? null,
        reportedBy: c.get('user').id,
      })
      .returning();
    await audit(c, 'governance.incident.create', 'security_incident', created!.id, {
      newValues: { severity: created!.severity, status: created!.status },
    });
    return ok(c, created!, 201);
  },
);

governanceRoutes.patch(
  '/incidents/:id',
  requirePermission('governance:write'),
  validate('json', updateIncidentSchema),
  async (c) => {
    const body = c.req.valid('json');
    const row = await db.query.securityIncidents.findFirst({
      where: eq(securityIncidents.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Insiden keamanan tidak ditemukan');
    const [updated] = await db
      .update(securityIncidents)
      .set({ ...body })
      .where(eq(securityIncidents.id, row.id))
      .returning();
    await audit(c, 'governance.incident.update', 'security_incident', row.id);
    return ok(c, updated!);
  },
);

governanceRoutes.post(
  '/incidents/:id/resolve',
  requirePermission('governance:write'),
  async (c) => {
    const row = await db.query.securityIncidents.findFirst({
      where: eq(securityIncidents.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Insiden keamanan tidak ditemukan');
    if (row.status === 'resolved' || row.status === 'closed') {
      throw ApiError.badRequest('Insiden sudah diselesaikan');
    }
    const [updated] = await db
      .update(securityIncidents)
      .set({ status: 'resolved', resolvedAt: new Date() })
      .where(eq(securityIncidents.id, row.id))
      .returning();
    await audit(c, 'governance.incident.resolve', 'security_incident', row.id);
    return ok(c, updated!);
  },
);

governanceRoutes.delete(
  '/incidents/:id',
  requirePermission('governance:manage'),
  async (c) => {
    const row = await db.query.securityIncidents.findFirst({
      where: eq(securityIncidents.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Insiden keamanan tidak ditemukan');
    await db.delete(securityIncidents).where(eq(securityIncidents.id, row.id));
    await audit(c, 'governance.incident.delete', 'security_incident', row.id);
    return ok(c, { id: row.id, deleted: true });
  },
);

/* --------------------------- Permintaan privasi ------------------------ */

governanceRoutes.get(
  '/privacy-requests',
  requirePermission('governance:read'),
  validate(
    'query',
    listSchema.extend({
      requestType: privacyRequestTypeSchema.optional(),
      status: privacyRequestStatusSchema.optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.requestType) {
      conditions.push(eq(privacyRequests.requestType, query.requestType));
    }
    if (query.status) conditions.push(eq(privacyRequests.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(privacyRequests.requestNumber, term),
          ilike(privacyRequests.requesterName, term),
          ilike(privacyRequests.requesterEmail, term),
        ) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(privacyRequests)
        .where(where)
        .orderBy(desc(privacyRequests.receivedAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(privacyRequests).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

governanceRoutes.post(
  '/privacy-requests',
  requirePermission('governance:write'),
  validate('json', createPrivacyRequestSchema),
  async (c) => {
    const body = c.req.valid('json');
    const [created] = await db
      .insert(privacyRequests)
      .values({
        ...body,
        requestNumber: `PRV-${Date.now()}`,
        userId: body.userId ?? null,
        description: body.description ?? null,
        responseNotes: body.responseNotes ?? null,
        receivedAt: body.receivedAt ?? new Date(),
        dueAt: body.dueAt ?? null,
        assignedTo: body.assignedTo ?? null,
      })
      .returning();
    await audit(c, 'governance.privacy_request.create', 'privacy_request', created!.id);
    return ok(c, created!, 201);
  },
);

governanceRoutes.patch(
  '/privacy-requests/:id',
  requirePermission('governance:write'),
  validate('json', updatePrivacyRequestSchema),
  async (c) => {
    const body = c.req.valid('json');
    const row = await db.query.privacyRequests.findFirst({
      where: eq(privacyRequests.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Permintaan privasi tidak ditemukan');
    const [updated] = await db
      .update(privacyRequests)
      .set({ ...body })
      .where(eq(privacyRequests.id, row.id))
      .returning();
    await audit(c, 'governance.privacy_request.update', 'privacy_request', row.id);
    return ok(c, updated!);
  },
);

governanceRoutes.post(
  '/privacy-requests/:id/complete',
  requirePermission('governance:write'),
  async (c) => {
    const row = await db.query.privacyRequests.findFirst({
      where: eq(privacyRequests.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Permintaan privasi tidak ditemukan');
    if (row.status === 'completed') throw ApiError.badRequest('Permintaan sudah selesai');
    const [updated] = await db
      .update(privacyRequests)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(privacyRequests.id, row.id))
      .returning();
    await audit(c, 'governance.privacy_request.complete', 'privacy_request', row.id);
    return ok(c, updated!);
  },
);

governanceRoutes.delete(
  '/privacy-requests/:id',
  requirePermission('governance:manage'),
  async (c) => {
    const row = await db.query.privacyRequests.findFirst({
      where: eq(privacyRequests.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Permintaan privasi tidak ditemukan');
    await db.delete(privacyRequests).where(eq(privacyRequests.id, row.id));
    await audit(c, 'governance.privacy_request.delete', 'privacy_request', row.id);
    return ok(c, { id: row.id, deleted: true });
  },
);
