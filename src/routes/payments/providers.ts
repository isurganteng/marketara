import { and, asc, count, eq, ilike, or, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import { paymentMethods, paymentProviders } from '../../db/schema';
import { writeAuditLog } from '../../lib/audit';
import type { AppEnv } from '../../lib/app-env';
import { ApiError } from '../../lib/errors';
import { getPagination, ok, paginated } from '../../lib/http';
import { validate } from '../../lib/validator';
import { requirePermission } from '../../middleware/auth';
import { getClientIp } from '../../services/auth';
import { numericString } from '../commerce/shared';

const providerTypeSchema = z.enum([
  'gateway',
  'bank',
  'ewallet',
  'qris',
  'manual',
  'other',
]);

const providerStatusSchema = z.enum(['active', 'inactive']);

const methodTypeSchema = z.enum([
  'qris',
  'ewallet',
  'bank_transfer',
  'virtual_account',
  'credit_card',
  'cash',
  'other',
]);

const methodStatusSchema = z.enum(['active', 'inactive']);

const listProvidersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  status: providerStatusSchema.optional(),
  type: providerTypeSchema.optional(),
});

const createProviderSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9_]+$/, 'Gunakan huruf kecil, angka, atau garis bawah'),
  name: z.string().trim().min(2).max(128),
  type: providerTypeSchema.default('gateway'),
  status: providerStatusSchema.default('active'),
  description: z.string().trim().max(2000).optional(),
  logoUrl: z.string().trim().max(2000).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

const updateProviderSchema = createProviderSchema.partial();

const listMethodsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  search: z.string().trim().max(100).optional(),
  providerId: z.uuid().optional(),
  status: methodStatusSchema.optional(),
  type: methodTypeSchema.optional(),
});

const createMethodSchema = z.object({
  providerId: z.uuid(),
  code: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9_]+$/, 'Gunakan huruf kecil, angka, atau garis bawah'),
  name: z.string().trim().min(2).max(128),
  type: methodTypeSchema.default('other'),
  status: methodStatusSchema.default('active'),
  description: z.string().trim().max(2000).optional(),
  feeFlat: numericString.default('0'),
  feePercent: numericString.default('0'),
  minimumAmount: numericString.default('0'),
  maximumAmount: numericString.optional(),
  instructions: z.string().trim().max(4000).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

const updateMethodSchema = createMethodSchema.partial();

export const paymentProviderRoutes = new Hono<AppEnv>();

paymentProviderRoutes.get(
  '/providers',
  requirePermission('payment:read'),
  validate('query', listProvidersSchema),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.status) conditions.push(eq(paymentProviders.status, query.status));
    if (query.type) conditions.push(eq(paymentProviders.type, query.type));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(paymentProviders.code, term),
          ilike(paymentProviders.name, term),
        ) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(paymentProviders)
        .where(where)
        .orderBy(asc(paymentProviders.sortOrder), asc(paymentProviders.name))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ value: count() }).from(paymentProviders).where(where),
    ]);

    return paginated(c, rows, Number(totalRow?.value ?? 0), pagination);
  },
);

paymentProviderRoutes.post(
  '/providers',
  requirePermission('payment:manage'),
  validate('json', createProviderSchema),
  async (c) => {
    const body = c.req.valid('json');
    const existing = await db.query.paymentProviders.findFirst({
      where: eq(paymentProviders.code, body.code),
    });
    if (existing) throw ApiError.conflict('Kode provider sudah digunakan');

    const [provider] = await db.insert(paymentProviders).values(body).returning();
    if (!provider) throw ApiError.internal('Gagal membuat provider pembayaran');

    await writeAuditLog({
      actorUserId: c.get('user').id,
      action: 'payment_provider.create',
      entityType: 'payment_provider',
      entityId: provider.id,
      newValues: provider,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    });

    return ok(c, provider, 201);
  },
);

paymentProviderRoutes.patch(
  '/providers/:providerId',
  requirePermission('payment:manage'),
  validate('json', updateProviderSchema),
  async (c) => {
    const providerId = c.req.param('providerId');
    const body = c.req.valid('json');
    const existing = await db.query.paymentProviders.findFirst({
      where: eq(paymentProviders.id, providerId),
    });
    if (!existing) throw ApiError.notFound('Provider pembayaran tidak ditemukan');

    if (body.code && body.code !== existing.code) {
      const duplicate = await db.query.paymentProviders.findFirst({
        where: eq(paymentProviders.code, body.code),
      });
      if (duplicate) throw ApiError.conflict('Kode provider sudah digunakan');
    }

    const [provider] = await db
      .update(paymentProviders)
      .set(body)
      .where(eq(paymentProviders.id, providerId))
      .returning();

    await writeAuditLog({
      actorUserId: c.get('user').id,
      action: 'payment_provider.update',
      entityType: 'payment_provider',
      entityId: providerId,
      oldValues: existing,
      newValues: provider,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    });

    return ok(c, provider);
  },
);

paymentProviderRoutes.get(
  '/methods',
  requirePermission('payment:read'),
  validate('query', listMethodsSchema),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.providerId) conditions.push(eq(paymentMethods.providerId, query.providerId));
    if (query.status) conditions.push(eq(paymentMethods.status, query.status));
    if (query.type) conditions.push(eq(paymentMethods.type, query.type));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(paymentMethods.code, term),
          ilike(paymentMethods.name, term),
          ilike(paymentProviders.name, term),
        ) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: paymentMethods.id,
          providerId: paymentMethods.providerId,
          providerCode: paymentProviders.code,
          providerName: paymentProviders.name,
          providerType: paymentProviders.type,
          providerStatus: paymentProviders.status,
          code: paymentMethods.code,
          name: paymentMethods.name,
          type: paymentMethods.type,
          status: paymentMethods.status,
          description: paymentMethods.description,
          feeFlat: paymentMethods.feeFlat,
          feePercent: paymentMethods.feePercent,
          minimumAmount: paymentMethods.minimumAmount,
          maximumAmount: paymentMethods.maximumAmount,
          instructions: paymentMethods.instructions,
          config: paymentMethods.config,
          sortOrder: paymentMethods.sortOrder,
          createdAt: paymentMethods.createdAt,
          updatedAt: paymentMethods.updatedAt,
        })
        .from(paymentMethods)
        .innerJoin(paymentProviders, eq(paymentProviders.id, paymentMethods.providerId))
        .where(where)
        .orderBy(
          asc(paymentMethods.sortOrder),
          asc(paymentProviders.sortOrder),
          asc(paymentMethods.name),
        )
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ value: count() })
        .from(paymentMethods)
        .innerJoin(paymentProviders, eq(paymentProviders.id, paymentMethods.providerId))
        .where(where),
    ]);

    return paginated(c, rows, Number(totalRow?.value ?? 0), pagination);
  },
);

paymentProviderRoutes.post(
  '/methods',
  requirePermission('payment:manage'),
  validate('json', createMethodSchema),
  async (c) => {
    const body = c.req.valid('json');
    const provider = await db.query.paymentProviders.findFirst({
      where: eq(paymentProviders.id, body.providerId),
    });
    if (!provider) throw ApiError.notFound('Provider pembayaran tidak ditemukan');

    const duplicate = await db.query.paymentMethods.findFirst({
      where: and(
        eq(paymentMethods.providerId, body.providerId),
        eq(paymentMethods.code, body.code),
      ),
    });
    if (duplicate) throw ApiError.conflict('Kode metode sudah digunakan pada provider ini');

    const [method] = await db.insert(paymentMethods).values(body).returning();
    if (!method) throw ApiError.internal('Gagal membuat metode pembayaran');

    await writeAuditLog({
      actorUserId: c.get('user').id,
      action: 'payment_method.create',
      entityType: 'payment_method',
      entityId: method.id,
      newValues: method,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    });

    return ok(c, method, 201);
  },
);

paymentProviderRoutes.patch(
  '/methods/:methodId',
  requirePermission('payment:manage'),
  validate('json', updateMethodSchema),
  async (c) => {
    const methodId = c.req.param('methodId');
    const body = c.req.valid('json');
    const existing = await db.query.paymentMethods.findFirst({
      where: eq(paymentMethods.id, methodId),
    });
    if (!existing) throw ApiError.notFound('Metode pembayaran tidak ditemukan');

    if (body.providerId) {
      const provider = await db.query.paymentProviders.findFirst({
        where: eq(paymentProviders.id, body.providerId),
      });
      if (!provider) throw ApiError.notFound('Provider pembayaran tidak ditemukan');
    }
    if (
      (body.code && body.code !== existing.code) ||
      (body.providerId && body.providerId !== existing.providerId)
    ) {
      const duplicate = await db.query.paymentMethods.findFirst({
        where: and(
          eq(paymentMethods.providerId, body.providerId ?? existing.providerId),
          eq(paymentMethods.code, body.code ?? existing.code),
        ),
      });
      if (duplicate) throw ApiError.conflict('Kode metode sudah digunakan pada provider ini');
    }

    const [method] = await db
      .update(paymentMethods)
      .set(body)
      .where(eq(paymentMethods.id, methodId))
      .returning();

    await writeAuditLog({
      actorUserId: c.get('user').id,
      action: 'payment_method.update',
      entityType: 'payment_method',
      entityId: methodId,
      oldValues: existing,
      newValues: method,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    });

    return ok(c, method);
  },
);
