import { and, asc, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  apiClients,
  apiEndpoints,
  apiKeys,
  dataMappingRules,
  integrationConnections,
  integrationLogs,
  integrationProviders,
  webhookEvents,
  webhookSubscriptions,
} from '../../db/schema';
import { writeAuditLog } from '../../lib/audit';
import type { AppEnv } from '../../lib/app-env';
import { generateSessionToken, hashToken } from '../../lib/crypto';
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
  .regex(/^[A-Za-z0-9_-]+$/, 'Gunakan huruf, angka, garis bawah, atau tanda hubung');
const optionalText = (max = 4000) => z.string().trim().max(max).optional().nullable();

const providerTypeSchema = z.enum([
  'marketplace',
  'payment',
  'logistics',
  'government',
  'messaging',
  'analytics',
  'erp',
  'crm',
  'other',
]);
const statusSchema = z.enum(['active', 'inactive', 'deprecated']);
const connectionStatusSchema = z.enum(['pending', 'active', 'disabled', 'error']);
const environmentSchema = z.enum(['sandbox', 'production']);
const clientStatusSchema = z.enum(['active', 'suspended', 'revoked']);
const keyStatusSchema = z.enum(['active', 'expired', 'revoked']);
const methodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const webhookStatusSchema = z.enum(['active', 'paused', 'disabled']);
const eventStatusSchema = z.enum(['pending', 'processing', 'delivered', 'failed', 'dead_letter']);
const logStatusSchema = z.enum(['success', 'failed']);
const directionSchema = z.enum(['inbound', 'outbound', 'bidirectional']);

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
});

const createProviderSchema = z.object({
  code: codeSchema.optional(),
  name: z.string().trim().min(2).max(255),
  type: providerTypeSchema.default('other'),
  description: optionalText(),
  baseUrl: z.string().trim().url().max(500).optional().nullable(),
  docsUrl: z.string().trim().url().max(500).optional().nullable(),
  status: statusSchema.default('active'),
  config: z.record(z.string(), z.unknown()).optional().nullable(),
});
const updateProviderSchema = createProviderSchema.partial();

const createConnectionSchema = z.object({
  providerId: z.uuid(),
  organizationId: z.uuid().optional().nullable(),
  code: codeSchema.optional(),
  name: z.string().trim().min(2).max(255),
  environment: environmentSchema.default('sandbox'),
  status: connectionStatusSchema.default('pending'),
  credentialsEncrypted: optionalText(),
  config: z.record(z.string(), z.unknown()).optional().nullable(),
});
const updateConnectionSchema = createConnectionSchema.omit({ providerId: true }).partial();

const createClientSchema = z.object({
  organizationId: z.uuid().optional().nullable(),
  code: codeSchema.optional(),
  name: z.string().trim().min(2).max(255),
  description: optionalText(),
  status: clientStatusSchema.default('active'),
  rateLimitPerMinute: z.coerce.number().int().min(1).max(100000).default(60),
  allowedOrigins: z.array(z.string().trim().max(255)).optional().nullable(),
});
const updateClientSchema = createClientSchema.partial();

const createKeySchema = z.object({
  name: z.string().trim().min(2).max(255),
  scopes: z.array(z.string().trim().max(64)).default([]),
  expiresAt: z.coerce.date().optional().nullable(),
});

const createEndpointSchema = z.object({
  code: codeSchema.optional(),
  name: z.string().trim().min(2).max(255),
  method: methodSchema,
  path: z.string().trim().min(1).max(255),
  version: z.string().trim().max(16).default('v1'),
  description: optionalText(),
  isPublic: z.boolean().default(false),
  isActive: z.boolean().default(true),
  rateLimitPerMinute: z.coerce.number().int().min(1).max(100000).optional().nullable(),
});
const updateEndpointSchema = createEndpointSchema.partial();

const createWebhookSchema = z.object({
  clientId: z.uuid(),
  name: z.string().trim().min(2).max(255),
  url: z.string().trim().url().max(1000),
  description: optionalText(),
  events: z.array(z.string().trim().min(1).max(128)).min(1),
  status: webhookStatusSchema.default('active'),
});
const updateWebhookSchema = createWebhookSchema.omit({ clientId: true }).partial();

const createEventSchema = z.object({
  subscriptionId: z.uuid(),
  eventType: z.string().trim().min(1).max(128),
  payload: z.record(z.string(), z.unknown()),
});
const updateEventSchema = z.object({
  status: eventStatusSchema.optional(),
  lastError: optionalText(),
  nextAttemptAt: z.coerce.date().optional().nullable(),
});

const createLogSchema = z.object({
  providerId: z.uuid().optional().nullable(),
  connectionId: z.uuid().optional().nullable(),
  direction: directionSchema.default('outbound'),
  method: methodSchema.default('POST'),
  path: z.string().trim().min(1).max(1000),
  statusCode: z.coerce.number().int().min(100).max(599).optional().nullable(),
  requestBody: z.record(z.string(), z.unknown()).optional().nullable(),
  responseBody: z.record(z.string(), z.unknown()).optional().nullable(),
  status: logStatusSchema.default('success'),
  durationMs: z.coerce.number().int().min(0).optional().nullable(),
  errorMessage: optionalText(),
});

const createMappingSchema = z.object({
  providerId: z.uuid(),
  name: z.string().trim().min(2).max(255),
  sourceEntity: z.string().trim().min(1).max(128),
  targetEntity: z.string().trim().min(1).max(128),
  direction: directionSchema.default('inbound'),
  mapping: z.record(z.string(), z.unknown()),
  transform: z.record(z.string(), z.unknown()).optional().nullable(),
  isActive: z.boolean().default(true),
  priority: z.coerce.number().int().min(0).default(0),
});
const updateMappingSchema = createMappingSchema.omit({ providerId: true }).partial();

export const integrationRoutes = new Hono<AppEnv>();
integrationRoutes.use('*', requireAuth);

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

/* ------------------------------ Providers ----------------------------- */

integrationRoutes.get(
  '/providers',
  requirePermission('integration:read'),
  validate('query', listSchema.extend({ type: providerTypeSchema.optional(), status: statusSchema.optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.type) conditions.push(eq(integrationProviders.type, query.type));
    if (query.status) conditions.push(eq(integrationProviders.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(integrationProviders.code, term),
          ilike(integrationProviders.name, term),
          ilike(integrationProviders.type, term),
        ) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(integrationProviders)
        .where(where)
        .orderBy(asc(integrationProviders.name))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(integrationProviders).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

integrationRoutes.get(
  '/providers/:id',
  requirePermission('integration:read'),
  async (c) => {
    const row = await db.query.integrationProviders.findFirst({
      where: eq(integrationProviders.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Provider integrasi tidak ditemukan');
    return ok(c, row);
  },
);

integrationRoutes.post(
  '/providers',
  requirePermission('integration:write'),
  validate('json', createProviderSchema),
  async (c) => {
    const body = c.req.valid('json');
    const code = body.code ?? generateCode('PRV').toLowerCase();
    const [existing] = await db
      .select({ id: integrationProviders.id })
      .from(integrationProviders)
      .where(eq(integrationProviders.code, code))
      .limit(1);
    if (existing) throw ApiError.conflict('Kode provider sudah digunakan');
    const [created] = await db
      .insert(integrationProviders)
      .values({
        code,
        name: body.name,
        type: body.type,
        description: body.description ?? null,
        baseUrl: body.baseUrl ?? null,
        docsUrl: body.docsUrl ?? null,
        status: body.status,
        config: body.config ?? null,
      })
      .returning();
    await audit(c, 'integration.provider.create', 'integration_provider', created!.id, {
      newValues: { code: created!.code, name: created!.name },
    });
    return ok(c, created!, 201);
  },
);

integrationRoutes.patch(
  '/providers/:id',
  requirePermission('integration:write'),
  validate('json', updateProviderSchema),
  async (c) => {
    const body = c.req.valid('json');
    const row = await db.query.integrationProviders.findFirst({
      where: eq(integrationProviders.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Provider integrasi tidak ditemukan');
    const [updated] = await db
      .update(integrationProviders)
      .set({ ...body })
      .where(eq(integrationProviders.id, row.id))
      .returning();
    await audit(c, 'integration.provider.update', 'integration_provider', row.id, {
      oldValues: { code: row.code, status: row.status },
      newValues: { code: updated!.code, status: updated!.status },
    });
    return ok(c, updated!);
  },
);

integrationRoutes.delete(
  '/providers/:id',
  requirePermission('integration:manage'),
  async (c) => {
    const row = await db.query.integrationProviders.findFirst({
      where: eq(integrationProviders.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Provider integrasi tidak ditemukan');
    await db.delete(integrationProviders).where(eq(integrationProviders.id, row.id));
    await audit(c, 'integration.provider.delete', 'integration_provider', row.id, {
      oldValues: { code: row.code, name: row.name },
    });
    return ok(c, { id: row.id, deleted: true });
  },
);

/* ----------------------------- Connections ---------------------------- */

integrationRoutes.get(
  '/connections',
  requirePermission('integration:read'),
  validate('query', listSchema.extend({ providerId: z.uuid().optional(), status: connectionStatusSchema.optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.providerId) conditions.push(eq(integrationConnections.providerId, query.providerId));
    if (query.status) conditions.push(eq(integrationConnections.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(integrationConnections.code, term),
          ilike(integrationConnections.name, term),
          ilike(integrationProviders.name, term),
        ) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: integrationConnections.id,
          providerId: integrationConnections.providerId,
          providerName: integrationProviders.name,
          providerType: integrationProviders.type,
          organizationId: integrationConnections.organizationId,
          code: integrationConnections.code,
          name: integrationConnections.name,
          environment: integrationConnections.environment,
          status: integrationConnections.status,
          lastSyncAt: integrationConnections.lastSyncAt,
          lastError: integrationConnections.lastError,
          createdAt: integrationConnections.createdAt,
        })
        .from(integrationConnections)
        .innerJoin(
          integrationProviders,
          eq(integrationProviders.id, integrationConnections.providerId),
        )
        .where(where)
        .orderBy(desc(integrationConnections.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(integrationConnections)
        .innerJoin(
          integrationProviders,
          eq(integrationProviders.id, integrationConnections.providerId),
        )
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

integrationRoutes.post(
  '/connections',
  requirePermission('integration:write'),
  validate('json', createConnectionSchema),
  async (c) => {
    const body = c.req.valid('json');
    const provider = await db.query.integrationProviders.findFirst({
      where: eq(integrationProviders.id, body.providerId),
    });
    if (!provider) throw ApiError.notFound('Provider integrasi tidak ditemukan');
    const code = body.code ?? generateCode('CONN').toLowerCase();
    const [created] = await db
      .insert(integrationConnections)
      .values({
        providerId: body.providerId,
        organizationId: body.organizationId ?? null,
        code,
        name: body.name,
        environment: body.environment,
        status: body.status,
        credentialsEncrypted: body.credentialsEncrypted ?? null,
        config: body.config ?? null,
        createdBy: c.get('user').id,
      })
      .returning();
    await audit(c, 'integration.connection.create', 'integration_connection', created!.id, {
      newValues: { code: created!.code, providerId: created!.providerId },
    });
    return ok(c, created!, 201);
  },
);

integrationRoutes.patch(
  '/connections/:id',
  requirePermission('integration:write'),
  validate('json', updateConnectionSchema),
  async (c) => {
    const body = c.req.valid('json');
    const row = await db.query.integrationConnections.findFirst({
      where: eq(integrationConnections.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Koneksi integrasi tidak ditemukan');
    const [updated] = await db
      .update(integrationConnections)
      .set({ ...body })
      .where(eq(integrationConnections.id, row.id))
      .returning();
    await audit(c, 'integration.connection.update', 'integration_connection', row.id, {
      oldValues: { code: row.code, status: row.status },
      newValues: { code: updated!.code, status: updated!.status },
    });
    return ok(c, updated!);
  },
);

integrationRoutes.delete(
  '/connections/:id',
  requirePermission('integration:manage'),
  async (c) => {
    const row = await db.query.integrationConnections.findFirst({
      where: eq(integrationConnections.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Koneksi integrasi tidak ditemukan');
    await db.delete(integrationConnections).where(eq(integrationConnections.id, row.id));
    await audit(c, 'integration.connection.delete', 'integration_connection', row.id, {
      oldValues: { code: row.code, name: row.name },
    });
    return ok(c, { id: row.id, deleted: true });
  },
);

integrationRoutes.post(
  '/connections/:id/test',
  requirePermission('integration:write'),
  async (c) => {
    const row = await db.query.integrationConnections.findFirst({
      where: eq(integrationConnections.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Koneksi integrasi tidak ditemukan');
    const [updated] = await db
      .update(integrationConnections)
      .set({ status: 'active', lastSyncAt: new Date(), lastError: null })
      .where(eq(integrationConnections.id, row.id))
      .returning();
    await audit(c, 'integration.connection.test', 'integration_connection', row.id, {
      newValues: { status: updated!.status },
    });
    return ok(c, updated!);
  },
);

/* ------------------------------ API clients --------------------------- */

integrationRoutes.get(
  '/clients',
  requirePermission('integration:read'),
  validate('query', listSchema.extend({ status: clientStatusSchema.optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.status) conditions.push(eq(apiClients.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(ilike(apiClients.code, term), ilike(apiClients.name, term)) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(apiClients)
        .where(where)
        .orderBy(asc(apiClients.name))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(apiClients).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

integrationRoutes.post(
  '/clients',
  requirePermission('integration:write'),
  validate('json', createClientSchema),
  async (c) => {
    const body = c.req.valid('json');
    const code = body.code ?? generateCode('CLI').toLowerCase();
    const [created] = await db
      .insert(apiClients)
      .values({
        organizationId: body.organizationId ?? null,
        code,
        name: body.name,
        description: body.description ?? null,
        status: body.status,
        rateLimitPerMinute: body.rateLimitPerMinute,
        allowedOrigins: body.allowedOrigins ?? null,
        createdBy: c.get('user').id,
      })
      .returning();
    await audit(c, 'integration.client.create', 'api_client', created!.id, {
      newValues: { code: created!.code, name: created!.name },
    });
    return ok(c, created!, 201);
  },
);

integrationRoutes.patch(
  '/clients/:id',
  requirePermission('integration:write'),
  validate('json', updateClientSchema),
  async (c) => {
    const body = c.req.valid('json');
    const row = await db.query.apiClients.findFirst({
      where: eq(apiClients.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Klien API tidak ditemukan');
    const [updated] = await db
      .update(apiClients)
      .set({ ...body })
      .where(eq(apiClients.id, row.id))
      .returning();
    await audit(c, 'integration.client.update', 'api_client', row.id, {
      oldValues: { code: row.code, status: row.status },
      newValues: { code: updated!.code, status: updated!.status },
    });
    return ok(c, updated!);
  },
);

integrationRoutes.delete(
  '/clients/:id',
  requirePermission('integration:manage'),
  async (c) => {
    const row = await db.query.apiClients.findFirst({
      where: eq(apiClients.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Klien API tidak ditemukan');
    await db.delete(apiClients).where(eq(apiClients.id, row.id));
    await audit(c, 'integration.client.delete', 'api_client', row.id, {
      oldValues: { code: row.code, name: row.name },
    });
    return ok(c, { id: row.id, deleted: true });
  },
);

/* -------------------------------- API keys ---------------------------- */

integrationRoutes.get(
  '/clients/:id/keys',
  requirePermission('integration:read'),
  async (c) => {
    const client = await db.query.apiClients.findFirst({
      where: eq(apiClients.id, c.req.param('id')),
    });
    if (!client) throw ApiError.notFound('Klien API tidak ditemukan');
    const rows = await db
      .select({
        id: apiKeys.id,
        clientId: apiKeys.clientId,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        scopes: apiKeys.scopes,
        status: apiKeys.status,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        revokedAt: apiKeys.revokedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.clientId, client.id))
      .orderBy(desc(apiKeys.createdAt));
    return ok(c, rows);
  },
);

integrationRoutes.post(
  '/clients/:id/keys',
  requirePermission('integration:write'),
  validate('json', createKeySchema),
  async (c) => {
    const body = c.req.valid('json');
    const client = await db.query.apiClients.findFirst({
      where: eq(apiClients.id, c.req.param('id')),
    });
    if (!client) throw ApiError.notFound('Klien API tidak ditemukan');
    if (client.status !== 'active') throw ApiError.badRequest('Klien API tidak aktif');
    const token = `mk_${generateSessionToken().replace(/[^A-Za-z0-9]/g, '').slice(0, 40)}`;
    const prefix = token.slice(0, 12);
    const [created] = await db
      .insert(apiKeys)
      .values({
        clientId: client.id,
        name: body.name,
        keyPrefix: prefix,
        keyHash: hashToken(token),
        scopes: body.scopes,
        status: 'active',
        expiresAt: body.expiresAt ?? null,
        createdBy: c.get('user').id,
      })
      .returning();
    await audit(c, 'integration.api_key.create', 'api_key', created!.id, {
      newValues: { clientId: client.id, prefix },
    });
    return ok(c, { ...created!, key: token }, 201);
  },
);

integrationRoutes.post(
  '/keys/:id/revoke',
  requirePermission('integration:write'),
  async (c) => {
    const row = await db.query.apiKeys.findFirst({
      where: eq(apiKeys.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Kunci API tidak ditemukan');
    if (row.status === 'revoked') return ok(c, row);
    const [updated] = await db
      .update(apiKeys)
      .set({ status: 'revoked', revokedAt: new Date() })
      .where(eq(apiKeys.id, row.id))
      .returning();
    await audit(c, 'integration.api_key.revoke', 'api_key', row.id);
    return ok(c, updated!);
  },
);

/* ------------------------------ Endpoints ----------------------------- */

integrationRoutes.get(
  '/endpoints',
  requirePermission('integration:read'),
  validate('query', listSchema.extend({ method: methodSchema.optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.method) conditions.push(eq(apiEndpoints.method, query.method));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(or(ilike(apiEndpoints.path, term), ilike(apiEndpoints.name, term)) as SQL);
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(apiEndpoints)
        .where(where)
        .orderBy(asc(apiEndpoints.path))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(apiEndpoints).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

integrationRoutes.post(
  '/endpoints',
  requirePermission('integration:write'),
  validate('json', createEndpointSchema),
  async (c) => {
    const body = c.req.valid('json');
    const code = body.code ?? generateCode('EP').toLowerCase();
    const [created] = await db
      .insert(apiEndpoints)
      .values({ ...body, code, rateLimitPerMinute: body.rateLimitPerMinute ?? null })
      .returning();
    await audit(c, 'integration.endpoint.create', 'api_endpoint', created!.id, {
      newValues: { method: created!.method, path: created!.path },
    });
    return ok(c, created!, 201);
  },
);

integrationRoutes.patch(
  '/endpoints/:id',
  requirePermission('integration:write'),
  validate('json', updateEndpointSchema),
  async (c) => {
    const body = c.req.valid('json');
    const row = await db.query.apiEndpoints.findFirst({
      where: eq(apiEndpoints.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Endpoint API tidak ditemukan');
    const [updated] = await db
      .update(apiEndpoints)
      .set({ ...body })
      .where(eq(apiEndpoints.id, row.id))
      .returning();
    await audit(c, 'integration.endpoint.update', 'api_endpoint', row.id);
    return ok(c, updated!);
  },
);

integrationRoutes.delete(
  '/endpoints/:id',
  requirePermission('integration:manage'),
  async (c) => {
    const row = await db.query.apiEndpoints.findFirst({
      where: eq(apiEndpoints.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Endpoint API tidak ditemukan');
    await db.delete(apiEndpoints).where(eq(apiEndpoints.id, row.id));
    await audit(c, 'integration.endpoint.delete', 'api_endpoint', row.id, {
      oldValues: { method: row.method, path: row.path },
    });
    return ok(c, { id: row.id, deleted: true });
  },
);

/* ------------------------------- Webhooks ----------------------------- */

integrationRoutes.get(
  '/webhooks',
  requirePermission('integration:read'),
  validate('query', listSchema.extend({ status: webhookStatusSchema.optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.status) conditions.push(eq(webhookSubscriptions.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(webhookSubscriptions.name, term),
          ilike(webhookSubscriptions.url, term),
        ) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: webhookSubscriptions.id,
          clientId: webhookSubscriptions.clientId,
          clientName: apiClients.name,
          name: webhookSubscriptions.name,
          url: webhookSubscriptions.url,
          events: webhookSubscriptions.events,
          status: webhookSubscriptions.status,
          failureCount: webhookSubscriptions.failureCount,
          lastTriggeredAt: webhookSubscriptions.lastTriggeredAt,
          lastSuccessAt: webhookSubscriptions.lastSuccessAt,
          createdAt: webhookSubscriptions.createdAt,
        })
        .from(webhookSubscriptions)
        .innerJoin(apiClients, eq(apiClients.id, webhookSubscriptions.clientId))
        .where(where)
        .orderBy(desc(webhookSubscriptions.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(webhookSubscriptions)
        .innerJoin(apiClients, eq(apiClients.id, webhookSubscriptions.clientId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

integrationRoutes.post(
  '/webhooks',
  requirePermission('integration:write'),
  validate('json', createWebhookSchema),
  async (c) => {
    const body = c.req.valid('json');
    const client = await db.query.apiClients.findFirst({
      where: eq(apiClients.id, body.clientId),
    });
    if (!client) throw ApiError.notFound('Klien API tidak ditemukan');
    const secret = generateSessionToken();
    const [created] = await db
      .insert(webhookSubscriptions)
      .values({
        clientId: body.clientId,
        name: body.name,
        url: body.url,
        description: body.description ?? null,
        events: body.events,
        secretHash: hashToken(secret),
        status: body.status,
        createdBy: c.get('user').id,
      })
      .returning();
    await audit(c, 'integration.webhook.create', 'webhook_subscription', created!.id, {
      newValues: { name: created!.name, url: created!.url },
    });
    return ok(c, { ...created!, secret }, 201);
  },
);

integrationRoutes.patch(
  '/webhooks/:id',
  requirePermission('integration:write'),
  validate('json', updateWebhookSchema),
  async (c) => {
    const body = c.req.valid('json');
    const row = await db.query.webhookSubscriptions.findFirst({
      where: eq(webhookSubscriptions.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Langganan webhook tidak ditemukan');
    const [updated] = await db
      .update(webhookSubscriptions)
      .set({ ...body })
      .where(eq(webhookSubscriptions.id, row.id))
      .returning();
    await audit(c, 'integration.webhook.update', 'webhook_subscription', row.id);
    return ok(c, updated!);
  },
);

integrationRoutes.delete(
  '/webhooks/:id',
  requirePermission('integration:manage'),
  async (c) => {
    const row = await db.query.webhookSubscriptions.findFirst({
      where: eq(webhookSubscriptions.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Langganan webhook tidak ditemukan');
    await db.delete(webhookSubscriptions).where(eq(webhookSubscriptions.id, row.id));
    await audit(c, 'integration.webhook.delete', 'webhook_subscription', row.id);
    return ok(c, { id: row.id, deleted: true });
  },
);

integrationRoutes.get(
  '/webhook-events',
  requirePermission('integration:read'),
  validate('query', listSchema.extend({ status: eventStatusSchema.optional(), eventType: z.string().max(128).optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.status) conditions.push(eq(webhookEvents.status, query.status));
    if (query.eventType) conditions.push(eq(webhookEvents.eventType, query.eventType));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(ilike(webhookEvents.eventType, term), ilike(webhookSubscriptions.name, term)) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: webhookEvents.id,
          subscriptionId: webhookEvents.subscriptionId,
          subscriptionName: webhookSubscriptions.name,
          eventType: webhookEvents.eventType,
          payload: webhookEvents.payload,
          status: webhookEvents.status,
          attempts: webhookEvents.attempts,
          lastError: webhookEvents.lastError,
          deliveredAt: webhookEvents.deliveredAt,
          createdAt: webhookEvents.createdAt,
        })
        .from(webhookEvents)
        .innerJoin(
          webhookSubscriptions,
          eq(webhookSubscriptions.id, webhookEvents.subscriptionId),
        )
        .where(where)
        .orderBy(desc(webhookEvents.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(webhookEvents)
        .innerJoin(
          webhookSubscriptions,
          eq(webhookSubscriptions.id, webhookEvents.subscriptionId),
        )
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

integrationRoutes.post(
  '/webhook-events',
  requirePermission('integration:write'),
  validate('json', createEventSchema),
  async (c) => {
    const body = c.req.valid('json');
    const sub = await db.query.webhookSubscriptions.findFirst({
      where: eq(webhookSubscriptions.id, body.subscriptionId),
    });
    if (!sub) throw ApiError.notFound('Langganan webhook tidak ditemukan');
    const [created] = await db
      .insert(webhookEvents)
      .values({
        subscriptionId: sub.id,
        eventType: body.eventType,
        payload: body.payload,
        status: 'pending',
      })
      .returning();
    await db
      .update(webhookSubscriptions)
      .set({ lastTriggeredAt: new Date() })
      .where(eq(webhookSubscriptions.id, sub.id));
    await audit(c, 'integration.webhook_event.create', 'webhook_event', created!.id);
    return ok(c, created!, 201);
  },
);

integrationRoutes.patch(
  '/webhook-events/:id',
  requirePermission('integration:write'),
  validate('json', updateEventSchema),
  async (c) => {
    const body = c.req.valid('json');
    const row = await db.query.webhookEvents.findFirst({
      where: eq(webhookEvents.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Event webhook tidak ditemukan');
    const [updated] = await db
      .update(webhookEvents)
      .set({ ...body })
      .where(eq(webhookEvents.id, row.id))
      .returning();
    await audit(c, 'integration.webhook_event.update', 'webhook_event', row.id, {
      oldValues: { status: row.status },
      newValues: { status: updated!.status },
    });
    return ok(c, updated!);
  },
);

integrationRoutes.post(
  '/webhook-events/:id/retry',
  requirePermission('integration:write'),
  async (c) => {
    const row = await db.query.webhookEvents.findFirst({
      where: eq(webhookEvents.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Event webhook tidak ditemukan');
    const [updated] = await db
      .update(webhookEvents)
      .set({
        status: 'pending',
        attempts: row.attempts + 1,
        nextAttemptAt: new Date(),
        lastError: null,
      })
      .where(eq(webhookEvents.id, row.id))
      .returning();
    await audit(c, 'integration.webhook_event.retry', 'webhook_event', row.id);
    return ok(c, updated!);
  },
);

/* ---------------------------- Integration logs ------------------------ */

integrationRoutes.get(
  '/logs',
  requirePermission('integration:read'),
  validate('query', listSchema.extend({ status: logStatusSchema.optional(), connectionId: z.uuid().optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.status) conditions.push(eq(integrationLogs.status, query.status));
    if (query.connectionId) conditions.push(eq(integrationLogs.connectionId, query.connectionId));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(ilike(integrationLogs.path, term), ilike(integrationLogs.errorMessage, term)) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(integrationLogs)
        .where(where)
        .orderBy(desc(integrationLogs.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(integrationLogs).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

integrationRoutes.post(
  '/logs',
  requirePermission('integration:write'),
  validate('json', createLogSchema),
  async (c) => {
    const body = c.req.valid('json');
    const [created] = await db.insert(integrationLogs).values({ ...body }).returning();
    return ok(c, created!, 201);
  },
);

/* ----------------------------- Mapping rules -------------------------- */

integrationRoutes.get(
  '/mapping-rules',
  requirePermission('integration:read'),
  validate('query', listSchema.extend({ providerId: z.uuid().optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.providerId) conditions.push(eq(dataMappingRules.providerId, query.providerId));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(dataMappingRules.name, term),
          ilike(dataMappingRules.sourceEntity, term),
          ilike(dataMappingRules.targetEntity, term),
        ) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: dataMappingRules.id,
          providerId: dataMappingRules.providerId,
          providerName: integrationProviders.name,
          name: dataMappingRules.name,
          sourceEntity: dataMappingRules.sourceEntity,
          targetEntity: dataMappingRules.targetEntity,
          direction: dataMappingRules.direction,
          mapping: dataMappingRules.mapping,
          transform: dataMappingRules.transform,
          isActive: dataMappingRules.isActive,
          priority: dataMappingRules.priority,
          createdAt: dataMappingRules.createdAt,
        })
        .from(dataMappingRules)
        .innerJoin(
          integrationProviders,
          eq(integrationProviders.id, dataMappingRules.providerId),
        )
        .where(where)
        .orderBy(asc(dataMappingRules.priority), asc(dataMappingRules.name))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(dataMappingRules)
        .innerJoin(
          integrationProviders,
          eq(integrationProviders.id, dataMappingRules.providerId),
        )
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

integrationRoutes.post(
  '/mapping-rules',
  requirePermission('integration:write'),
  validate('json', createMappingSchema),
  async (c) => {
    const body = c.req.valid('json');
    const provider = await db.query.integrationProviders.findFirst({
      where: eq(integrationProviders.id, body.providerId),
    });
    if (!provider) throw ApiError.notFound('Provider integrasi tidak ditemukan');
    const [created] = await db
      .insert(dataMappingRules)
      .values({
        ...body,
        transform: body.transform ?? null,
      })
      .returning();
    await audit(c, 'integration.mapping.create', 'data_mapping_rule', created!.id, {
      newValues: { name: created!.name },
    });
    return ok(c, created!, 201);
  },
);

integrationRoutes.patch(
  '/mapping-rules/:id',
  requirePermission('integration:write'),
  validate('json', updateMappingSchema),
  async (c) => {
    const body = c.req.valid('json');
    const row = await db.query.dataMappingRules.findFirst({
      where: eq(dataMappingRules.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Aturan pemetaan tidak ditemukan');
    const [updated] = await db
      .update(dataMappingRules)
      .set({ ...body })
      .where(eq(dataMappingRules.id, row.id))
      .returning();
    await audit(c, 'integration.mapping.update', 'data_mapping_rule', row.id);
    return ok(c, updated!);
  },
);

integrationRoutes.delete(
  '/mapping-rules/:id',
  requirePermission('integration:manage'),
  async (c) => {
    const row = await db.query.dataMappingRules.findFirst({
      where: eq(dataMappingRules.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Aturan pemetaan tidak ditemukan');
    await db.delete(dataMappingRules).where(eq(dataMappingRules.id, row.id));
    await audit(c, 'integration.mapping.delete', 'data_mapping_rule', row.id);
    return ok(c, { id: row.id, deleted: true });
  },
);
