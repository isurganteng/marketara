import { and, count, eq, ilike, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import { salesChannels } from '../../db/schema';
import { writeAuditLog } from '../../lib/audit';
import { ApiError } from '../../lib/errors';
import { getPagination, ok, paginated } from '../../lib/http';
import type { AppEnv } from '../../lib/app-env';
import { generateCode } from '../../lib/slug';
import { validate } from '../../lib/validator';
import { requirePermission } from '../../middleware/auth';
import { getClientIp } from '../../services/auth';

const channelTypeSchema = z.enum(['web', 'marketplace', 'social', 'pos', 'other']);
const channelStatusSchema = z.enum(['active', 'inactive']);

const channelCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9_-]+$/, 'Kode hanya boleh huruf kecil, angka, - dan _')
    .optional(),
  name: z.string().trim().min(2).max(128),
  type: channelTypeSchema.optional(),
  status: channelStatusSchema.optional(),
  description: z.string().trim().max(5000).optional(),
  logoUrl: z.string().url().max(2048).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

const channelUpdateSchema = channelCreateSchema
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Minimal satu field harus diisi',
  });

const listChannelsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: channelStatusSchema.optional(),
  type: channelTypeSchema.optional(),
});

async function assertChannelCodeAvailable(code: string, exceptId?: string) {
  const row = await db.query.salesChannels.findFirst({
    where: eq(salesChannels.code, code),
    columns: { id: true },
  });
  if (row && row.id !== exceptId) {
    throw ApiError.conflict(`Sales channel code already exists: ${code}`);
  }
}

export const commerceChannelRoutes = new Hono<AppEnv>();

commerceChannelRoutes.get(
  '/channels',
  requirePermission('commerce:read'),
  validate('query', listChannelsSchema),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions = [];

    if (query.status) conditions.push(eq(salesChannels.status, query.status));
    if (query.type) conditions.push(eq(salesChannels.type, query.type));
    if (query.search) {
      const term = `%${query.search}%`;
      const searchCondition = or(
        ilike(salesChannels.code, term),
        ilike(salesChannels.name, term),
        ilike(salesChannels.description, term),
      );
      if (searchCondition) conditions.push(searchCondition);
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ value } = { value: 0 }]] = await Promise.all([
      db
        .select()
        .from(salesChannels)
        .where(where)
        .orderBy(salesChannels.sortOrder, salesChannels.name)
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ value: count() }).from(salesChannels).where(where),
    ]);

    return paginated(c, rows, Number(value), pagination);
  },
);

commerceChannelRoutes.get(
  '/channels/:channelId',
  requirePermission('commerce:read'),
  async (c) => {
    const channel = await db.query.salesChannels.findFirst({
      where: eq(salesChannels.id, c.req.param('channelId')),
    });
    if (!channel) throw ApiError.notFound('Sales channel not found');
    return ok(c, channel);
  },
);

commerceChannelRoutes.post(
  '/channels',
  requirePermission('commerce:manage'),
  validate('json', channelCreateSchema),
  async (c) => {
    const body = c.req.valid('json');
    const code = body.code ?? generateCode('CHN').toLowerCase();
    await assertChannelCodeAvailable(code);

    const [channel] = await db
      .insert(salesChannels)
      .values({
        code,
        name: body.name,
        type: body.type ?? 'web',
        status: body.status ?? 'active',
        description: body.description ?? null,
        logoUrl: body.logoUrl ?? null,
        config: body.config ?? null,
        sortOrder: body.sortOrder ?? 0,
      })
      .returning();

    if (!channel) throw ApiError.internal('Failed to create sales channel');

    await writeAuditLog({
      actorUserId: c.get('user').id,
      action: 'sales_channel.create',
      entityType: 'sales_channel',
      entityId: channel.id,
      newValues: { code: channel.code, name: channel.name, type: channel.type },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });

    return c.json({ success: true as const, data: channel }, 201);
  },
);

commerceChannelRoutes.patch(
  '/channels/:channelId',
  requirePermission('commerce:manage'),
  validate('json', channelUpdateSchema),
  async (c) => {
    const channelId = c.req.param('channelId');
    const channel = await db.query.salesChannels.findFirst({
      where: eq(salesChannels.id, channelId),
    });
    if (!channel) throw ApiError.notFound('Sales channel not found');

    const body = c.req.valid('json');
    if (body.code !== undefined) {
      await assertChannelCodeAvailable(body.code, channel.id);
    }

    const [updated] = await db
      .update(salesChannels)
      .set({
        ...(body.code !== undefined ? { code: body.code } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl } : {}),
        ...(body.config !== undefined ? { config: body.config } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      })
      .where(eq(salesChannels.id, channel.id))
      .returning();

    await writeAuditLog({
      actorUserId: c.get('user').id,
      action: 'sales_channel.update',
      entityType: 'sales_channel',
      entityId: channel.id,
      oldValues: { code: channel.code, name: channel.name, status: channel.status },
      newValues: body as Record<string, unknown>,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });

    return ok(c, updated);
  },
);

commerceChannelRoutes.delete(
  '/channels/:channelId',
  requirePermission('commerce:manage'),
  async (c) => {
    const channelId = c.req.param('channelId');
    const channel = await db.query.salesChannels.findFirst({
      where: eq(salesChannels.id, channelId),
    });
    if (!channel) throw ApiError.notFound('Sales channel not found');

    const [updated] = await db
      .update(salesChannels)
      .set({ status: 'inactive' })
      .where(eq(salesChannels.id, channel.id))
      .returning();

    await writeAuditLog({
      actorUserId: c.get('user').id,
      action: 'sales_channel.deactivate',
      entityType: 'sales_channel',
      entityId: channel.id,
      oldValues: { code: channel.code, status: channel.status },
      newValues: { status: 'inactive' },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });

    return ok(c, updated);
  },
);
