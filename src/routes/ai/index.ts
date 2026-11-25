import { and, asc, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  aiMessages,
  aiModels,
  aiRequests,
  aiResponses,
  aiSessions,
  aiUsageLogs,
  forecastJobs,
  merchants,
  recommendationResults,
} from '../../db/schema';
import { isPlatformAdmin } from '../../lib/access';
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
const modelTypeSchema = z.enum([
  'chat',
  'embedding',
  'image',
  'speech',
  'recommendation',
  'forecasting',
]);
const modelStatusSchema = z.enum(['active', 'inactive', 'deprecated']);
const sessionStatusSchema = z.enum(['active', 'archived', 'closed']);
const messageRoleSchema = z.enum(['system', 'user', 'assistant', 'tool']);
const requestStatusSchema = z.enum(['queued', 'processing', 'completed', 'failed']);
const responseStatusSchema = z.enum(['completed', 'failed', 'filtered']);
const recommendationTypeSchema = z.enum(['product', 'funding', 'merchant', 'market', 'content']);
const recommendationStatusSchema = z.enum(['generated', 'viewed', 'accepted', 'dismissed']);
const forecastTypeSchema = z.enum(['sales', 'demand', 'revenue', 'cashflow', 'inventory']);
const forecastStatusSchema = z.enum(['queued', 'running', 'completed', 'failed']);

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
});

const createModelSchema = z.object({
  code: codeSchema,
  name: z.string().trim().min(2).max(255),
  provider: z.string().trim().min(1).max(128),
  type: modelTypeSchema.default('chat'),
  version: z.string().trim().max(64).optional().nullable(),
  description: optionalText(),
  capabilities: z.array(z.string().trim().max(64)).optional().nullable(),
  config: z.record(z.string(), z.unknown()).optional().nullable(),
  status: modelStatusSchema.default('active'),
  isDefault: z.boolean().default(false),
});
const updateModelSchema = createModelSchema.partial();

const createSessionSchema = z.object({
  title: z.string().trim().max(255).optional().nullable(),
  modelId: z.uuid().optional().nullable(),
  merchantId: z.uuid().optional().nullable(),
  contextType: z.string().trim().max(64).optional().nullable(),
  contextId: z.uuid().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});
const updateSessionSchema = createSessionSchema.extend({ status: sessionStatusSchema.optional() }).partial();

const createMessageSchema = z.object({
  role: messageRoleSchema,
  content: z.string().trim().min(1).max(50000),
  tokens: z.coerce.number().int().min(0).default(0),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

const createRequestSchema = z.object({
  sessionId: z.uuid().optional().nullable(),
  modelId: z.uuid().optional().nullable(),
  feature: z.string().trim().max(64).default('assistant'),
  prompt: z.string().trim().min(1).max(50000),
  parameters: z.record(z.string(), z.unknown()).optional().nullable(),
});
const completeRequestSchema = z.object({
  content: z.string().trim().min(1).max(100000),
  finishReason: z.string().trim().max(64).optional().nullable(),
  promptTokens: z.coerce.number().int().min(0).default(0),
  completionTokens: z.coerce.number().int().min(0).default(0),
  status: responseStatusSchema.default('completed'),
  safety: z.record(z.string(), z.unknown()).optional().nullable(),
  latencyMs: z.coerce.number().int().min(0).optional().nullable(),
  cost: z.union([z.string(), z.number()]).optional(),
});

const createRecommendationSchema = z.object({
  userId: z.uuid().optional().nullable(),
  merchantId: z.uuid().optional().nullable(),
  modelId: z.uuid().optional().nullable(),
  type: recommendationTypeSchema.default('product'),
  title: z.string().trim().min(2).max(255),
  summary: optionalText(),
  items: z.array(z.record(z.string(), z.unknown())).optional().nullable(),
  score: z.union([z.string(), z.number()]).optional().nullable(),
  source: z.string().trim().max(128).optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
});
const updateRecommendationSchema = z.object({
  status: recommendationStatusSchema.optional(),
  title: z.string().trim().min(2).max(255).optional(),
  summary: optionalText(),
});

const createForecastSchema = z.object({
  type: forecastTypeSchema.default('sales'),
  merchantId: z.uuid().optional().nullable(),
  dataSource: z.string().trim().max(128).optional().nullable(),
  horizonDays: z.coerce.number().int().min(1).max(3650).default(30),
  parameters: z.record(z.string(), z.unknown()).optional().nullable(),
  scheduledAt: z.coerce.date().optional().nullable(),
});
const updateForecastSchema = z.object({
  status: forecastStatusSchema.optional(),
  parameters: z.record(z.string(), z.unknown()).optional().nullable(),
  scheduledAt: z.coerce.date().optional().nullable(),
});

export const aiRoutes = new Hono<AppEnv>();
aiRoutes.use('*', requireAuth);

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

async function getSession(c: Context<AppEnv>, id: string) {
  const row = await db.query.aiSessions.findFirst({ where: eq(aiSessions.id, id) });
  if (!row) throw ApiError.notFound('Sesi AI tidak ditemukan');
  if (!isPlatformAdmin(c.get('permissions')) && row.userId !== c.get('user').id) {
    throw ApiError.notFound('Sesi AI tidak ditemukan');
  }
  return row;
}

/* -------------------------------- Models ------------------------------ */

aiRoutes.get(
  '/models',
  requirePermission('ai:read'),
  validate('query', listSchema.extend({ type: modelTypeSchema.optional(), status: modelStatusSchema.optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.type) conditions.push(eq(aiModels.type, query.type));
    if (query.status) conditions.push(eq(aiModels.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(ilike(aiModels.code, term), ilike(aiModels.name, term), ilike(aiModels.provider, term)) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(aiModels)
        .where(where)
        .orderBy(desc(aiModels.isDefault), asc(aiModels.name))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(aiModels).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

aiRoutes.post(
  '/models',
  requirePermission('ai:write'),
  validate('json', createModelSchema),
  async (c) => {
    const body = c.req.valid('json');
    if (body.isDefault) {
      await db.update(aiModels).set({ isDefault: false });
    }
    const [created] = await db.insert(aiModels).values({ ...body }).returning();
    await audit(c, 'ai.model.create', 'ai_model', created!.id, {
      newValues: { code: created!.code, type: created!.type },
    });
    return ok(c, created!, 201);
  },
);

aiRoutes.patch(
  '/models/:id',
  requirePermission('ai:write'),
  validate('json', updateModelSchema),
  async (c) => {
    const body = c.req.valid('json');
    const row = await db.query.aiModels.findFirst({ where: eq(aiModels.id, c.req.param('id')) });
    if (!row) throw ApiError.notFound('Model AI tidak ditemukan');
    if (body.isDefault) {
      await db.update(aiModels).set({ isDefault: false });
    }
    const [updated] = await db
      .update(aiModels)
      .set({ ...body })
      .where(eq(aiModels.id, row.id))
      .returning();
    await audit(c, 'ai.model.update', 'ai_model', row.id);
    return ok(c, updated!);
  },
);

aiRoutes.delete(
  '/models/:id',
  requirePermission('ai:manage'),
  async (c) => {
    const row = await db.query.aiModels.findFirst({ where: eq(aiModels.id, c.req.param('id')) });
    if (!row) throw ApiError.notFound('Model AI tidak ditemukan');
    await db.delete(aiModels).where(eq(aiModels.id, row.id));
    await audit(c, 'ai.model.delete', 'ai_model', row.id);
    return ok(c, { id: row.id, deleted: true });
  },
);

/* -------------------------------- Sessions ---------------------------- */

aiRoutes.get(
  '/sessions',
  requirePermission('ai:read'),
  validate('query', listSchema.extend({ status: sessionStatusSchema.optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.status) conditions.push(eq(aiSessions.status, query.status));
    if (!isPlatformAdmin(c.get('permissions'))) {
      conditions.push(eq(aiSessions.userId, c.get('user').id));
    }
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(ilike(aiSessions.sessionKey, term), ilike(aiSessions.title, term)) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: aiSessions.id,
          sessionKey: aiSessions.sessionKey,
          userId: aiSessions.userId,
          merchantId: aiSessions.merchantId,
          merchantName: merchants.businessName,
          modelId: aiSessions.modelId,
          title: aiSessions.title,
          contextType: aiSessions.contextType,
          contextId: aiSessions.contextId,
          status: aiSessions.status,
          startedAt: aiSessions.startedAt,
          endedAt: aiSessions.endedAt,
          createdAt: aiSessions.createdAt,
        })
        .from(aiSessions)
        .leftJoin(merchants, eq(merchants.id, aiSessions.merchantId))
        .where(where)
        .orderBy(desc(aiSessions.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(aiSessions).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

aiRoutes.get(
  '/sessions/:id',
  requirePermission('ai:read'),
  async (c) => {
    const session = await getSession(c, c.req.param('id'));
    const messages = await db
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.sessionId, session.id))
      .orderBy(asc(aiMessages.createdAt));
    return ok(c, { ...session, messages });
  },
);

aiRoutes.post(
  '/sessions',
  requirePermission('ai:write'),
  validate('json', createSessionSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    if (body.merchantId) {
      const merchant = await db.query.merchants.findFirst({
        where: eq(merchants.id, body.merchantId),
      });
      if (!merchant) throw ApiError.notFound('Merchant tidak ditemukan');
    }
    if (body.modelId) {
      const model = await db.query.aiModels.findFirst({ where: eq(aiModels.id, body.modelId) });
      if (!model) throw ApiError.notFound('Model AI tidak ditemukan');
    }
    const [created] = await db
      .insert(aiSessions)
      .values({
        ...body,
        sessionKey: generateCode('AIS'),
        userId: user.id,
        merchantId: body.merchantId ?? null,
        modelId: body.modelId ?? null,
        contextType: body.contextType ?? null,
        contextId: body.contextId ?? null,
        metadata: body.metadata ?? null,
      })
      .returning();
    await audit(c, 'ai.session.create', 'ai_session', created!.id);
    return ok(c, created!, 201);
  },
);

aiRoutes.patch(
  '/sessions/:id',
  requirePermission('ai:write'),
  validate('json', updateSessionSchema),
  async (c) => {
    const body = c.req.valid('json');
    const session = await getSession(c, c.req.param('id'));
    const [updated] = await db
      .update(aiSessions)
      .set({ ...body, endedAt: body.status && body.status !== 'active' ? new Date() : undefined })
      .where(eq(aiSessions.id, session.id))
      .returning();
    await audit(c, 'ai.session.update', 'ai_session', session.id);
    return ok(c, updated!);
  },
);

aiRoutes.delete(
  '/sessions/:id',
  requirePermission('ai:manage'),
  async (c) => {
    const session = await getSession(c, c.req.param('id'));
    await db.delete(aiSessions).where(eq(aiSessions.id, session.id));
    await audit(c, 'ai.session.delete', 'ai_session', session.id);
    return ok(c, { id: session.id, deleted: true });
  },
);

aiRoutes.get(
  '/sessions/:id/messages',
  requirePermission('ai:read'),
  async (c) => {
    const session = await getSession(c, c.req.param('id'));
    const rows = await db
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.sessionId, session.id))
      .orderBy(asc(aiMessages.createdAt));
    return ok(c, rows);
  },
);

aiRoutes.post(
  '/sessions/:id/messages',
  requirePermission('ai:write'),
  validate('json', createMessageSchema),
  async (c) => {
    const body = c.req.valid('json');
    const session = await getSession(c, c.req.param('id'));
    if (session.status !== 'active') throw ApiError.badRequest('Sesi AI tidak aktif');
    const [created] = await db
      .insert(aiMessages)
      .values({ ...body, sessionId: session.id })
      .returning();
    await audit(c, 'ai.message.create', 'ai_message', created!.id);
    return ok(c, created!, 201);
  },
);

aiRoutes.delete(
  '/messages/:id',
  requirePermission('ai:manage'),
  async (c) => {
    const row = await db.query.aiMessages.findFirst({
      where: eq(aiMessages.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Pesan AI tidak ditemukan');
    const session = await getSession(c, row.sessionId);
    await db.delete(aiMessages).where(eq(aiMessages.id, row.id));
    await audit(c, 'ai.message.delete', 'ai_message', row.id);
    return ok(c, { id: row.id, deleted: true, sessionId: session.id });
  },
);

/* ---------------------------- Requests/responses ---------------------- */

aiRoutes.get(
  '/requests',
  requirePermission('ai:read'),
  validate('query', listSchema.extend({ status: requestStatusSchema.optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.status) conditions.push(eq(aiRequests.status, query.status));
    if (!isPlatformAdmin(c.get('permissions'))) {
      conditions.push(eq(aiRequests.userId, c.get('user').id));
    }
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(ilike(aiRequests.requestNumber, term), ilike(aiRequests.feature, term)) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: aiRequests.id,
          requestNumber: aiRequests.requestNumber,
          sessionId: aiRequests.sessionId,
          modelId: aiRequests.modelId,
          modelName: aiModels.name,
          userId: aiRequests.userId,
          feature: aiRequests.feature,
          status: aiRequests.status,
          latencyMs: aiRequests.latencyMs,
          errorMessage: aiRequests.errorMessage,
          completedAt: aiRequests.completedAt,
          createdAt: aiRequests.createdAt,
        })
        .from(aiRequests)
        .leftJoin(aiModels, eq(aiModels.id, aiRequests.modelId))
        .where(where)
        .orderBy(desc(aiRequests.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(aiRequests).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

aiRoutes.post(
  '/requests',
  requirePermission('ai:write'),
  validate('json', createRequestSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    if (body.sessionId) {
      const session = await getSession(c, body.sessionId);
      if (session.status !== 'active') throw ApiError.badRequest('Sesi AI tidak aktif');
    }
    if (body.modelId) {
      const model = await db.query.aiModels.findFirst({ where: eq(aiModels.id, body.modelId) });
      if (!model) throw ApiError.notFound('Model AI tidak ditemukan');
    }
    const [created] = await db
      .insert(aiRequests)
      .values({
        requestNumber: generateCode('AIR'),
        sessionId: body.sessionId ?? null,
        modelId: body.modelId ?? null,
        userId: user.id,
        feature: body.feature,
        prompt: body.prompt,
        parameters: body.parameters ?? null,
        status: 'queued',
      })
      .returning();
    await audit(c, 'ai.request.create', 'ai_request', created!.id);
    return ok(c, created!, 201);
  },
);

aiRoutes.post(
  '/requests/:id/complete',
  requirePermission('ai:write'),
  validate('json', completeRequestSchema),
  async (c) => {
    const body = c.req.valid('json');
    const request = await db.query.aiRequests.findFirst({
      where: eq(aiRequests.id, c.req.param('id')),
    });
    if (!request) throw ApiError.notFound('Request AI tidak ditemukan');
    if (!isPlatformAdmin(c.get('permissions')) && request.userId !== c.get('user').id) {
      throw ApiError.notFound('Request AI tidak ditemukan');
    }
    if (request.status === 'completed') throw ApiError.badRequest('Request AI sudah selesai');
    const totalTokens = body.promptTokens + body.completionTokens;
    const now = new Date();
    const [response] = await db
      .insert(aiResponses)
      .values({
        requestId: request.id,
        content: body.content,
        finishReason: body.finishReason ?? null,
        promptTokens: body.promptTokens,
        completionTokens: body.completionTokens,
        totalTokens,
        status: body.status,
        safety: body.safety ?? null,
      })
      .returning();
    const [updated] = await db
      .update(aiRequests)
      .set({
        status: body.status === 'failed' ? 'failed' : 'completed',
        latencyMs: body.latencyMs ?? null,
        completedAt: now,
      })
      .where(eq(aiRequests.id, request.id))
      .returning();
    await db.insert(aiUsageLogs).values({
      userId: request.userId,
      modelId: request.modelId,
      requestId: request.id,
      feature: request.feature,
      promptTokens: body.promptTokens,
      completionTokens: body.completionTokens,
      totalTokens,
      cost: body.cost === undefined ? '0' : String(body.cost),
      status: updated!.status,
    });
    if (request.sessionId) {
      await db.insert(aiMessages).values({
        sessionId: request.sessionId,
        role: 'assistant',
        content: body.content,
        tokens: totalTokens,
      });
    }
    await audit(c, 'ai.request.complete', 'ai_request', request.id, {
      newValues: { totalTokens, status: updated!.status },
    });
    return ok(c, { request: updated, response });
  },
);

aiRoutes.get(
  '/responses',
  requirePermission('ai:read'),
  validate('query', listSchema.extend({ requestId: z.uuid().optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.requestId) conditions.push(eq(aiResponses.requestId, query.requestId));
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(aiResponses)
        .where(where)
        .orderBy(desc(aiResponses.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(aiResponses).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

/* --------------------------- Recommendations -------------------------- */

aiRoutes.get(
  '/recommendations',
  requirePermission('ai:read'),
  validate('query', listSchema.extend({ type: recommendationTypeSchema.optional(), status: recommendationStatusSchema.optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.type) conditions.push(eq(recommendationResults.type, query.type));
    if (query.status) conditions.push(eq(recommendationResults.status, query.status));
    if (!isPlatformAdmin(c.get('permissions'))) {
      conditions.push(eq(recommendationResults.userId, c.get('user').id));
    }
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(ilike(recommendationResults.title, term));
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(recommendationResults)
        .where(where)
        .orderBy(desc(recommendationResults.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(recommendationResults).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

aiRoutes.post(
  '/recommendations',
  requirePermission('ai:write'),
  validate('json', createRecommendationSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    if (!isPlatformAdmin(c.get('permissions'))) {
      if (body.userId && body.userId !== user.id) {
        throw ApiError.forbidden('Hanya dapat membuat rekomendasi untuk diri sendiri');
      }
    }
    const [created] = await db
      .insert(recommendationResults)
      .values({
        ...body,
        userId: body.userId ?? user.id,
        merchantId: body.merchantId ?? null,
        modelId: body.modelId ?? null,
        summary: body.summary ?? null,
        items: body.items ?? null,
        score: body.score === undefined || body.score === null ? null : String(body.score),
        source: body.source ?? null,
        expiresAt: body.expiresAt ?? null,
      })
      .returning();
    await audit(c, 'ai.recommendation.create', 'recommendation_result', created!.id);
    return ok(c, created!, 201);
  },
);

aiRoutes.patch(
  '/recommendations/:id',
  requirePermission('ai:write'),
  validate('json', updateRecommendationSchema),
  async (c) => {
    const body = c.req.valid('json');
    const row = await db.query.recommendationResults.findFirst({
      where: eq(recommendationResults.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Rekomendasi tidak ditemukan');
    if (!isPlatformAdmin(c.get('permissions')) && row.userId !== c.get('user').id) {
      throw ApiError.notFound('Rekomendasi tidak ditemukan');
    }
    const [updated] = await db
      .update(recommendationResults)
      .set({ ...body })
      .where(eq(recommendationResults.id, row.id))
      .returning();
    await audit(c, 'ai.recommendation.update', 'recommendation_result', row.id);
    return ok(c, updated!);
  },
);

/* ------------------------------ Forecast jobs ------------------------- */

aiRoutes.get(
  '/forecast-jobs',
  requirePermission('ai:read'),
  validate('query', listSchema.extend({ status: forecastStatusSchema.optional(), type: forecastTypeSchema.optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.status) conditions.push(eq(forecastJobs.status, query.status));
    if (query.type) conditions.push(eq(forecastJobs.type, query.type));
    if (!isPlatformAdmin(c.get('permissions'))) {
      conditions.push(eq(forecastJobs.requestedBy, c.get('user').id));
    }
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(ilike(forecastJobs.jobNumber, term), ilike(forecastJobs.dataSource, term)) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(forecastJobs)
        .where(where)
        .orderBy(desc(forecastJobs.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(forecastJobs).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

aiRoutes.post(
  '/forecast-jobs',
  requirePermission('ai:write'),
  validate('json', createForecastSchema),
  async (c) => {
    const body = c.req.valid('json');
    if (body.merchantId) {
      const merchant = await db.query.merchants.findFirst({
        where: eq(merchants.id, body.merchantId),
      });
      if (!merchant) throw ApiError.notFound('Merchant tidak ditemukan');
    }
    const [created] = await db
      .insert(forecastJobs)
      .values({
        ...body,
        jobNumber: generateCode('FCJ'),
        merchantId: body.merchantId ?? null,
        dataSource: body.dataSource ?? null,
        parameters: body.parameters ?? null,
        scheduledAt: body.scheduledAt ?? null,
        requestedBy: c.get('user').id,
      })
      .returning();
    await audit(c, 'ai.forecast.create', 'forecast_job', created!.id);
    return ok(c, created!, 201);
  },
);

aiRoutes.post(
  '/forecast-jobs/:id/run',
  requirePermission('ai:write'),
  async (c) => {
    const row = await db.query.forecastJobs.findFirst({
      where: eq(forecastJobs.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Job forecast tidak ditemukan');
    if (row.status === 'running') throw ApiError.badRequest('Job forecast sedang berjalan');
    const now = new Date();
    const points = Array.from({ length: Math.min(row.horizonDays, 30) }, (_, index) => ({
      day: index + 1,
      value: Number((100 + Math.sin(index / 3) * 12).toFixed(2)),
    }));
    const [updated] = await db
      .update(forecastJobs)
      .set({
        status: 'completed',
        startedAt: now,
        completedAt: now,
        result: { method: 'simulator', points },
      })
      .where(eq(forecastJobs.id, row.id))
      .returning();
    await audit(c, 'ai.forecast.run', 'forecast_job', row.id);
    return ok(c, updated!);
  },
);

aiRoutes.patch(
  '/forecast-jobs/:id',
  requirePermission('ai:write'),
  validate('json', updateForecastSchema),
  async (c) => {
    const body = c.req.valid('json');
    const row = await db.query.forecastJobs.findFirst({
      where: eq(forecastJobs.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Job forecast tidak ditemukan');
    const [updated] = await db
      .update(forecastJobs)
      .set({ ...body })
      .where(eq(forecastJobs.id, row.id))
      .returning();
    await audit(c, 'ai.forecast.update', 'forecast_job', row.id);
    return ok(c, updated!);
  },
);

/* ------------------------------- Usage logs --------------------------- */

aiRoutes.get(
  '/usage-logs',
  requirePermission('ai:read'),
  validate('query', listSchema),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (!isPlatformAdmin(c.get('permissions'))) {
      conditions.push(eq(aiUsageLogs.userId, c.get('user').id));
    }
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(ilike(aiUsageLogs.feature, term));
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(aiUsageLogs)
        .where(where)
        .orderBy(desc(aiUsageLogs.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(aiUsageLogs).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);
