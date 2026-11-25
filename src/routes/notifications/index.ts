import { and, asc, count, desc, eq, ilike, inArray, or, type SQL } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  communicationPreferences,
  notificationChannels,
  notificationDeliveryLogs,
  notificationMessages,
  notificationRecipients,
  notificationTemplates,
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
  .regex(/^[A-Za-z0-9_-]+$/, 'Gunakan huruf, angka, garis bawah, atau tanda hubung');
const optionalText = (max = 4000) => z.string().trim().max(max).optional().nullable();
const channelTypeSchema = z.enum(['email', 'sms', 'whatsapp', 'push', 'in_app', 'webhook']);
const templateStatusSchema = z.enum(['draft', 'active', 'archived']);
const messageStatusSchema = z.enum([
  'queued',
  'scheduled',
  'processing',
  'sent',
  'failed',
  'cancelled',
]);
const recipientStatusSchema = z.enum(['pending', 'sent', 'delivered', 'failed', 'read']);
const deliveryStatusSchema = z.enum(['queued', 'sent', 'delivered', 'failed', 'bounced']);

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
});

const createChannelSchema = z.object({
  code: codeSchema.optional(),
  name: z.string().trim().min(2).max(128),
  type: channelTypeSchema,
  provider: z.string().trim().max(128).optional().nullable(),
  description: optionalText(),
  config: z.record(z.string(), z.unknown()).optional().nullable(),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
});
const updateChannelSchema = createChannelSchema.partial();

const createTemplateSchema = z.object({
  code: codeSchema.optional(),
  name: z.string().trim().min(2).max(255),
  channelId: z.uuid().optional().nullable(),
  channelType: channelTypeSchema.default('email'),
  category: z.string().trim().max(64).default('general'),
  locale: z.string().trim().max(16).default('id-ID'),
  subject: z.string().trim().max(255).optional().nullable(),
  body: z.string().trim().min(1).max(20000),
  variables: z.array(z.string().trim().max(64)).optional().nullable(),
  status: templateStatusSchema.default('draft'),
});
const updateTemplateSchema = createTemplateSchema.partial();

const createMessageSchema = z.object({
  templateId: z.uuid().optional().nullable(),
  channelId: z.uuid().optional().nullable(),
  channelType: channelTypeSchema.default('email'),
  category: z.string().trim().max(64).default('general'),
  subject: z.string().trim().max(255).optional().nullable(),
  body: z.string().trim().min(1).max(20000),
  payload: z.record(z.string(), z.unknown()).optional().nullable(),
  scheduledAt: z.coerce.date().optional().nullable(),
  priority: z.coerce.number().int().min(0).max(100).default(0),
  recipients: z
    .array(
      z.object({
        userId: z.uuid().optional().nullable(),
        name: z.string().trim().max(255).optional().nullable(),
        email: z.string().trim().email().max(255).optional().nullable(),
        phone: z.string().trim().max(32).optional().nullable(),
      }),
    )
    .min(1),
});
const updateMessageSchema = z.object({
  category: z.string().trim().max(64).optional(),
  subject: z.string().trim().max(255).optional().nullable(),
  body: z.string().trim().max(20000).optional(),
  payload: z.record(z.string(), z.unknown()).optional().nullable(),
  status: messageStatusSchema.optional(),
  scheduledAt: z.coerce.date().optional().nullable(),
});

const createPreferenceSchema = z.object({
  userId: z.uuid().optional().nullable(),
  organizationId: z.uuid().optional().nullable(),
  category: z.string().trim().max(64).default('general'),
  channelType: channelTypeSchema,
  isEnabled: z.boolean().default(true),
  quietHoursStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
  quietHoursEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});
const updatePreferenceSchema = createPreferenceSchema.omit({ userId: true, organizationId: true }).partial();

export const notificationRoutes = new Hono<AppEnv>();
notificationRoutes.use('*', requireAuth);

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

/* ------------------------------ Channels ------------------------------ */

notificationRoutes.get(
  '/channels',
  requirePermission('notification:read'),
  validate('query', listSchema.extend({ type: channelTypeSchema.optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.type) conditions.push(eq(notificationChannels.type, query.type));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(ilike(notificationChannels.code, term), ilike(notificationChannels.name, term)) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(notificationChannels)
        .where(where)
        .orderBy(asc(notificationChannels.sortOrder), asc(notificationChannels.name))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(notificationChannels).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

notificationRoutes.post(
  '/channels',
  requirePermission('notification:write'),
  validate('json', createChannelSchema),
  async (c) => {
    const body = c.req.valid('json');
    const code = body.code ?? generateCode('CHN').toLowerCase();
    const [created] = await db
      .insert(notificationChannels)
      .values({ ...body, code, provider: body.provider ?? null })
      .returning();
    await audit(c, 'notification.channel.create', 'notification_channel', created!.id, {
      newValues: { code: created!.code, type: created!.type },
    });
    return ok(c, created!, 201);
  },
);

notificationRoutes.patch(
  '/channels/:id',
  requirePermission('notification:write'),
  validate('json', updateChannelSchema),
  async (c) => {
    const body = c.req.valid('json');
    const row = await db.query.notificationChannels.findFirst({
      where: eq(notificationChannels.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Kanal notifikasi tidak ditemukan');
    const [updated] = await db
      .update(notificationChannels)
      .set({ ...body })
      .where(eq(notificationChannels.id, row.id))
      .returning();
    await audit(c, 'notification.channel.update', 'notification_channel', row.id);
    return ok(c, updated!);
  },
);

notificationRoutes.delete(
  '/channels/:id',
  requirePermission('notification:manage'),
  async (c) => {
    const row = await db.query.notificationChannels.findFirst({
      where: eq(notificationChannels.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Kanal notifikasi tidak ditemukan');
    await db.delete(notificationChannels).where(eq(notificationChannels.id, row.id));
    await audit(c, 'notification.channel.delete', 'notification_channel', row.id);
    return ok(c, { id: row.id, deleted: true });
  },
);

/* ------------------------------ Templates ----------------------------- */

notificationRoutes.get(
  '/templates',
  requirePermission('notification:read'),
  validate('query', listSchema.extend({ status: templateStatusSchema.optional(), channelType: channelTypeSchema.optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.status) conditions.push(eq(notificationTemplates.status, query.status));
    if (query.channelType) conditions.push(eq(notificationTemplates.channelType, query.channelType));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(notificationTemplates.code, term),
          ilike(notificationTemplates.name, term),
          ilike(notificationTemplates.category, term),
        ) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(notificationTemplates)
        .where(where)
        .orderBy(asc(notificationTemplates.name))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(notificationTemplates).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

notificationRoutes.post(
  '/templates',
  requirePermission('notification:write'),
  validate('json', createTemplateSchema),
  async (c) => {
    const body = c.req.valid('json');
    const code = body.code ?? generateCode('TPL').toLowerCase();
    const [created] = await db
      .insert(notificationTemplates)
      .values({
        ...body,
        code,
        channelId: body.channelId ?? null,
        subject: body.subject ?? null,
        variables: body.variables ?? null,
        createdBy: c.get('user').id,
      })
      .returning();
    await audit(c, 'notification.template.create', 'notification_template', created!.id, {
      newValues: { code: created!.code, channelType: created!.channelType },
    });
    return ok(c, created!, 201);
  },
);

notificationRoutes.patch(
  '/templates/:id',
  requirePermission('notification:write'),
  validate('json', updateTemplateSchema),
  async (c) => {
    const body = c.req.valid('json');
    const row = await db.query.notificationTemplates.findFirst({
      where: eq(notificationTemplates.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Template notifikasi tidak ditemukan');
    const [updated] = await db
      .update(notificationTemplates)
      .set({ ...body, version: row.version + 1 })
      .where(eq(notificationTemplates.id, row.id))
      .returning();
    await audit(c, 'notification.template.update', 'notification_template', row.id, {
      oldValues: { status: row.status, version: row.version },
      newValues: { status: updated!.status, version: updated!.version },
    });
    return ok(c, updated!);
  },
);

notificationRoutes.post(
  '/templates/:id/activate',
  requirePermission('notification:write'),
  async (c) => {
    const row = await db.query.notificationTemplates.findFirst({
      where: eq(notificationTemplates.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Template notifikasi tidak ditemukan');
    if (row.status === 'archived') throw ApiError.badRequest('Template sudah diarsipkan');
    const [updated] = await db
      .update(notificationTemplates)
      .set({ status: 'active' })
      .where(eq(notificationTemplates.id, row.id))
      .returning();
    await audit(c, 'notification.template.activate', 'notification_template', row.id);
    return ok(c, updated!);
  },
);

notificationRoutes.delete(
  '/templates/:id',
  requirePermission('notification:manage'),
  async (c) => {
    const row = await db.query.notificationTemplates.findFirst({
      where: eq(notificationTemplates.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Template notifikasi tidak ditemukan');
    await db.delete(notificationTemplates).where(eq(notificationTemplates.id, row.id));
    await audit(c, 'notification.template.delete', 'notification_template', row.id);
    return ok(c, { id: row.id, deleted: true });
  },
);

/* ------------------------------- Messages ----------------------------- */

notificationRoutes.get(
  '/messages',
  requirePermission('notification:read'),
  validate('query', listSchema.extend({ status: messageStatusSchema.optional(), channelType: channelTypeSchema.optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.status) conditions.push(eq(notificationMessages.status, query.status));
    if (query.channelType) conditions.push(eq(notificationMessages.channelType, query.channelType));
    if (!isPlatformAdmin(permissions)) {
      const recipientMessageIds = db
        .select({ id: notificationRecipients.messageId })
        .from(notificationRecipients)
        .where(eq(notificationRecipients.userId, user.id));
      conditions.push(
        or(
          eq(notificationMessages.createdBy, user.id),
          inArray(notificationMessages.id, recipientMessageIds),
        ) as SQL,
      );
    }
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(notificationMessages.messageNumber, term),
          ilike(notificationMessages.subject, term),
          ilike(notificationMessages.category, term),
        ) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(notificationMessages)
        .where(where)
        .orderBy(desc(notificationMessages.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(notificationMessages).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

notificationRoutes.get(
  '/messages/:id',
  requirePermission('notification:read'),
  async (c) => {
    const row = await db.query.notificationMessages.findFirst({
      where: eq(notificationMessages.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Pesan notifikasi tidak ditemukan');
    const user = c.get('user');
    if (!isPlatformAdmin(c.get('permissions')) && row.createdBy !== user.id) {
      const recipient = await db.query.notificationRecipients.findFirst({
        where: and(
          eq(notificationRecipients.messageId, row.id),
          eq(notificationRecipients.userId, user.id),
        ),
      });
      if (!recipient) throw ApiError.notFound('Pesan notifikasi tidak ditemukan');
    }
    const [recipients, logs] = await Promise.all([
      db
        .select()
        .from(notificationRecipients)
        .where(eq(notificationRecipients.messageId, row.id)),
      db
        .select()
        .from(notificationDeliveryLogs)
        .where(eq(notificationDeliveryLogs.messageId, row.id))
        .orderBy(desc(notificationDeliveryLogs.attemptedAt)),
    ]);
    return ok(c, { ...row, recipients, deliveryLogs: logs });
  },
);

notificationRoutes.post(
  '/messages',
  requirePermission('notification:write'),
  validate('json', createMessageSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    let template: typeof notificationTemplates.$inferSelect | undefined;
    if (body.templateId) {
      template = await db.query.notificationTemplates.findFirst({
        where: eq(notificationTemplates.id, body.templateId),
      });
      if (!template) throw ApiError.notFound('Template notifikasi tidak ditemukan');
      if (template.status !== 'active') throw ApiError.badRequest('Template belum aktif');
    }
    const [created] = await db
      .insert(notificationMessages)
      .values({
        messageNumber: generateCode('MSG'),
        templateId: body.templateId ?? null,
        channelId: body.channelId ?? null,
        channelType: body.channelType,
        category: body.category,
        subject: body.subject ?? template?.subject ?? null,
        body: body.body,
        payload: body.payload ?? null,
        status: body.scheduledAt ? 'scheduled' : 'queued',
        priority: body.priority,
        scheduledAt: body.scheduledAt ?? null,
        createdBy: user.id,
      })
      .returning();
    await db.insert(notificationRecipients).values(
      body.recipients.map((recipient) => ({
        messageId: created!.id,
        userId: recipient.userId ?? null,
        name: recipient.name ?? null,
        email: recipient.email ?? null,
        phone: recipient.phone ?? null,
        status: 'pending' as const,
      })),
    );
    await audit(c, 'notification.message.create', 'notification_message', created!.id, {
      newValues: { number: created!.messageNumber, recipients: body.recipients.length },
    });
    return ok(c, created!, 201);
  },
);

notificationRoutes.patch(
  '/messages/:id',
  requirePermission('notification:write'),
  validate('json', updateMessageSchema),
  async (c) => {
    const body = c.req.valid('json');
    const row = await db.query.notificationMessages.findFirst({
      where: eq(notificationMessages.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Pesan notifikasi tidak ditemukan');
    if (['sent', 'cancelled'].includes(row.status)) {
      throw ApiError.badRequest('Pesan yang sudah dikirim atau dibatalkan tidak dapat diubah');
    }
    const [updated] = await db
      .update(notificationMessages)
      .set({ ...body })
      .where(eq(notificationMessages.id, row.id))
      .returning();
    await audit(c, 'notification.message.update', 'notification_message', row.id, {
      oldValues: { status: row.status },
      newValues: { status: updated!.status },
    });
    return ok(c, updated!);
  },
);

notificationRoutes.post(
  '/messages/:id/send',
  requirePermission('notification:write'),
  async (c) => {
    const row = await db.query.notificationMessages.findFirst({
      where: eq(notificationMessages.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Pesan notifikasi tidak ditemukan');
    if (!['queued', 'scheduled', 'failed'].includes(row.status)) {
      throw ApiError.badRequest('Status pesan tidak dapat dikirim');
    }
    const now = new Date();
    const [updated] = await db
      .update(notificationMessages)
      .set({ status: 'sent', sentAt: now })
      .where(eq(notificationMessages.id, row.id))
      .returning();
    await db
      .update(notificationRecipients)
      .set({ status: 'sent' })
      .where(eq(notificationRecipients.messageId, row.id));
    const recipients = await db
      .select()
      .from(notificationRecipients)
      .where(eq(notificationRecipients.messageId, row.id));
    if (recipients.length) {
      await db.insert(notificationDeliveryLogs).values(
        recipients.map((recipient) => ({
          messageId: row.id,
          recipientId: recipient.id,
          channelType: row.channelType,
          provider: 'simulator',
          status: 'sent' as const,
          response: { simulated: true },
          attemptedAt: now,
        })),
      );
    }
    await audit(c, 'notification.message.send', 'notification_message', row.id, {
      newValues: { status: 'sent', recipients: recipients.length },
    });
    return ok(c, updated!);
  },
);

notificationRoutes.post(
  '/messages/:id/cancel',
  requirePermission('notification:write'),
  async (c) => {
    const row = await db.query.notificationMessages.findFirst({
      where: eq(notificationMessages.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Pesan notifikasi tidak ditemukan');
    if (['sent', 'cancelled'].includes(row.status)) {
      throw ApiError.badRequest('Pesan tidak dapat dibatalkan');
    }
    const [updated] = await db
      .update(notificationMessages)
      .set({ status: 'cancelled' })
      .where(eq(notificationMessages.id, row.id))
      .returning();
    await db
      .update(notificationRecipients)
      .set({ status: 'failed', errorMessage: 'Pesan dibatalkan' })
      .where(eq(notificationRecipients.messageId, row.id));
    await audit(c, 'notification.message.cancel', 'notification_message', row.id);
    return ok(c, updated!);
  },
);

notificationRoutes.delete(
  '/messages/:id',
  requirePermission('notification:manage'),
  async (c) => {
    const row = await db.query.notificationMessages.findFirst({
      where: eq(notificationMessages.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Pesan notifikasi tidak ditemukan');
    if (row.status === 'sent') throw ApiError.badRequest('Pesan terkirim tidak dapat dihapus');
    await db.delete(notificationMessages).where(eq(notificationMessages.id, row.id));
    await audit(c, 'notification.message.delete', 'notification_message', row.id);
    return ok(c, { id: row.id, deleted: true });
  },
);

/* --------------------------- Recipients & logs ------------------------ */

notificationRoutes.get(
  '/recipients',
  requirePermission('notification:read'),
  validate('query', listSchema.extend({ messageId: z.uuid().optional(), status: recipientStatusSchema.optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.messageId) conditions.push(eq(notificationRecipients.messageId, query.messageId));
    if (query.status) conditions.push(eq(notificationRecipients.status, query.status));
    if (!isPlatformAdmin(c.get('permissions'))) {
      conditions.push(eq(notificationRecipients.userId, c.get('user').id));
    }
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(notificationRecipients.name, term),
          ilike(notificationRecipients.email, term),
        ) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(notificationRecipients)
        .where(where)
        .orderBy(desc(notificationRecipients.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(notificationRecipients).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

notificationRoutes.get(
  '/delivery-logs',
  requirePermission('notification:read'),
  validate('query', listSchema.extend({ status: deliveryStatusSchema.optional(), messageId: z.uuid().optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.status) conditions.push(eq(notificationDeliveryLogs.status, query.status));
    if (query.messageId) conditions.push(eq(notificationDeliveryLogs.messageId, query.messageId));
    if (!isPlatformAdmin(c.get('permissions'))) {
      const allowedMessages = db
        .select({ id: notificationRecipients.messageId })
        .from(notificationRecipients)
        .where(eq(notificationRecipients.userId, c.get('user').id));
      conditions.push(inArray(notificationDeliveryLogs.messageId, allowedMessages));
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(notificationDeliveryLogs)
        .where(where)
        .orderBy(desc(notificationDeliveryLogs.attemptedAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(notificationDeliveryLogs).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

/* ----------------------------- Preferences ---------------------------- */

notificationRoutes.get(
  '/preferences',
  requirePermission('notification:read'),
  validate('query', listSchema.extend({ channelType: channelTypeSchema.optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.channelType) conditions.push(eq(communicationPreferences.channelType, query.channelType));
    if (!isPlatformAdmin(c.get('permissions'))) {
      conditions.push(eq(communicationPreferences.userId, c.get('user').id));
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(communicationPreferences)
        .where(where)
        .orderBy(asc(communicationPreferences.category))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(communicationPreferences).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

notificationRoutes.post(
  '/preferences',
  requirePermission('notification:write'),
  validate('json', createPreferenceSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    if (!isPlatformAdmin(c.get('permissions'))) {
      if (body.userId && body.userId !== user.id) {
        throw ApiError.forbidden('Hanya dapat mengubah preferensi sendiri');
      }
      if (body.organizationId) {
        throw ApiError.forbidden('Hanya admin yang dapat mengubah preferensi organisasi');
      }
    }
    const userId = body.userId ?? user.id;
    if (!body.organizationId) {
      const [existing] = await db
        .select({ id: communicationPreferences.id })
        .from(communicationPreferences)
        .where(
          and(
            eq(communicationPreferences.userId, userId),
            eq(communicationPreferences.category, body.category),
            eq(communicationPreferences.channelType, body.channelType),
          ),
        )
        .limit(1);
      if (existing) throw ApiError.conflict('Preferensi komunikasi sudah ada');
    }
    const [created] = await db
      .insert(communicationPreferences)
      .values({
        ...body,
        userId,
        organizationId: body.organizationId ?? null,
      })
      .returning();
    await audit(c, 'notification.preference.create', 'communication_preference', created!.id);
    return ok(c, created!, 201);
  },
);

notificationRoutes.patch(
  '/preferences/:id',
  requirePermission('notification:write'),
  validate('json', updatePreferenceSchema),
  async (c) => {
    const body = c.req.valid('json');
    const row = await db.query.communicationPreferences.findFirst({
      where: eq(communicationPreferences.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Preferensi komunikasi tidak ditemukan');
    if (!isPlatformAdmin(c.get('permissions')) && row.userId !== c.get('user').id) {
      throw ApiError.notFound('Preferensi komunikasi tidak ditemukan');
    }
    const [updated] = await db
      .update(communicationPreferences)
      .set({ ...body })
      .where(eq(communicationPreferences.id, row.id))
      .returning();
    await audit(c, 'notification.preference.update', 'communication_preference', row.id);
    return ok(c, updated!);
  },
);

notificationRoutes.delete(
  '/preferences/:id',
  requirePermission('notification:manage'),
  async (c) => {
    const row = await db.query.communicationPreferences.findFirst({
      where: eq(communicationPreferences.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Preferensi komunikasi tidak ditemukan');
    await db.delete(communicationPreferences).where(eq(communicationPreferences.id, row.id));
    await audit(c, 'notification.preference.delete', 'communication_preference', row.id);
    return ok(c, { id: row.id, deleted: true });
  },
);
