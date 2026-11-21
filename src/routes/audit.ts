import { and, count, desc, eq, ilike } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db';
import { auditLogs } from '../db/schema';
import { getPagination, paginated } from '../lib/http';
import type { AppEnv } from '../lib/app-env';
import { validate } from '../lib/validator';
import { requireAuth, requirePermission } from '../middleware/auth';

const listAuditSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  action: z.string().trim().max(100).optional(),
  entityType: z.string().trim().max(100).optional(),
  entityId: z.string().trim().max(64).optional(),
  actorUserId: z.uuid().optional(),
});

export const auditRoutes = new Hono<AppEnv>();

auditRoutes.use('*', requireAuth, requirePermission('audit:read'));

auditRoutes.get('/', validate('query', listAuditSchema), async (c) => {
  const query = c.req.valid('query');
  const pagination = getPagination(query);

  const conditions = [];
  if (query.action) conditions.push(ilike(auditLogs.action, `%${query.action}%`));
  if (query.entityType) conditions.push(eq(auditLogs.entityType, query.entityType));
  if (query.entityId) conditions.push(eq(auditLogs.entityId, query.entityId));
  if (query.actorUserId) conditions.push(eq(auditLogs.actorUserId, query.actorUserId));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [{ value } = { value: 0 }]] = await Promise.all([
    db
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset),
    db.select({ value: count() }).from(auditLogs).where(where),
  ]);

  return paginated(c, rows, Number(value), pagination);
});
