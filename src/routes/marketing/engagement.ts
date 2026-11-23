import {
  and,
  count,
  desc,
  eq,
  ilike,
  or,
  type SQL,
} from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  customerComplaints,
  customerInteractions,
  customers,
  merchants,
  orders,
  users,
} from '../../db/schema';
import { writeAuditLog } from '../../lib/audit';
import type { AppEnv } from '../../lib/app-env';
import { ApiError } from '../../lib/errors';
import { getPagination, ok, paginated } from '../../lib/http';
import { generateCode } from '../../lib/slug';
import { validate } from '../../lib/validator';
import { requirePermission } from '../../middleware/auth';
import { getClientIp } from '../../services/auth';
import {
  assertMarketingAccess,
  getComplaint,
  getCustomer,
  getInteraction,
  marketingScopeCondition,
} from './shared';

const interactionTypeSchema = z.enum([
  'note',
  'call',
  'email',
  'whatsapp',
  'meeting',
  'complaint',
  'follow_up',
]);
const interactionDirectionSchema = z.enum(['inbound', 'outbound', 'internal']);
const interactionStatusSchema = z.enum(['open', 'completed', 'cancelled']);
const complaintPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);
const complaintStatusSchema = z.enum([
  'open',
  'in_progress',
  'resolved',
  'rejected',
  'closed',
]);

const listInteractionSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  customerId: z.uuid().optional(),
  type: interactionTypeSchema.optional(),
  direction: interactionDirectionSchema.optional(),
  status: interactionStatusSchema.optional(),
});

const interactionInputSchema = z.object({
  customerId: z.uuid(),
  type: interactionTypeSchema.default('note'),
  direction: interactionDirectionSchema.default('internal'),
  subject: z.string().trim().max(255).optional(),
  content: z.string().trim().min(1).max(8000),
  status: interactionStatusSchema.default('open'),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
});

const updateInteractionSchema = interactionInputSchema.partial().extend({
  subject: z.string().trim().max(255).nullable().optional(),
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
});

const listComplaintSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  customerId: z.uuid().optional(),
  orderId: z.uuid().optional(),
  status: complaintStatusSchema.optional(),
  priority: complaintPrioritySchema.optional(),
});

const createComplaintSchema = z.object({
  merchantId: z.uuid(),
  customerId: z.uuid(),
  orderId: z.uuid().optional(),
  complaintNumber: z.string().trim().max(64).optional(),
  category: z.string().trim().max(128).optional(),
  subject: z.string().trim().min(2).max(255),
  description: z.string().trim().min(2).max(8000),
  priority: complaintPrioritySchema.default('normal'),
  assignedTo: z.uuid().optional(),
});

const updateComplaintSchema = z.object({
  category: z.string().trim().max(128).nullable().optional(),
  subject: z.string().trim().min(2).max(255).optional(),
  description: z.string().trim().min(2).max(8000).optional(),
  priority: complaintPrioritySchema.optional(),
  assignedTo: z.uuid().nullable().optional(),
});

const resolutionSchema = z.object({
  resolution: z.string().trim().min(2).max(8000),
});

export const marketingEngagementRoutes = new Hono<AppEnv>();

async function assertCustomerMerchant(
  customerId: string,
  merchantId: string,
  user: Parameters<typeof getCustomer>[1],
  permissions: Set<string>,
) {
  const { customer } = await getCustomer(customerId, user, permissions);
  if (customer.merchantId !== merchantId) {
    throw ApiError.badRequest('Pelanggan tidak dimiliki merchant ini');
  }
  return customer;
}

/* ----------------------------- Interactions ---------------------------- */

marketingEngagementRoutes.get(
  '/interactions',
  requirePermission('crm:read'),
  validate('query', listInteractionSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = marketingScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) {
      conditions.push(eq(customerInteractions.merchantId, query.merchantId));
    }
    if (query.customerId) {
      conditions.push(eq(customerInteractions.customerId, query.customerId));
    }
    if (query.type) conditions.push(eq(customerInteractions.type, query.type));
    if (query.direction) {
      conditions.push(eq(customerInteractions.direction, query.direction));
    }
    if (query.status) conditions.push(eq(customerInteractions.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(customerInteractions.subject, term),
          ilike(customerInteractions.content, term),
          ilike(customers.name, term),
          ilike(merchants.businessName, term),
        ) as SQL,
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: customerInteractions.id,
          merchantId: customerInteractions.merchantId,
          merchantName: merchants.businessName,
          customerId: customerInteractions.customerId,
          customerName: customers.name,
          customerCode: customers.code,
          type: customerInteractions.type,
          direction: customerInteractions.direction,
          subject: customerInteractions.subject,
          content: customerInteractions.content,
          status: customerInteractions.status,
          scheduledAt: customerInteractions.scheduledAt,
          completedAt: customerInteractions.completedAt,
          createdAt: customerInteractions.createdAt,
          createdByName: users.fullName,
        })
        .from(customerInteractions)
        .innerJoin(merchants, eq(merchants.id, customerInteractions.merchantId))
        .innerJoin(customers, eq(customers.id, customerInteractions.customerId))
        .leftJoin(users, eq(users.id, customerInteractions.createdBy))
        .where(where)
        .orderBy(desc(customerInteractions.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(customerInteractions)
        .innerJoin(merchants, eq(merchants.id, customerInteractions.merchantId))
        .innerJoin(customers, eq(customers.id, customerInteractions.customerId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

marketingEngagementRoutes.post(
  '/interactions',
  requirePermission('crm:write'),
  validate('json', interactionInputSchema.extend({ merchantId: z.uuid() })),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertMarketingAccess(body.merchantId, user, permissions, { manage: true });
    await assertCustomerMerchant(body.customerId, body.merchantId, user, permissions);
    const [created] = await db
      .insert(customerInteractions)
      .values({
        merchantId: body.merchantId,
        customerId: body.customerId,
        type: body.type,
        direction: body.direction,
        subject: body.subject ?? null,
        content: body.content,
        status: body.status,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        createdBy: user.id,
      })
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'crm.interaction.create',
      entityType: 'customer_interaction',
      entityId: created!.id,
      newValues: { type: created!.type, customerId: created!.customerId },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created!, 201);
  },
);

marketingEngagementRoutes.get(
  '/interactions/:id',
  requirePermission('crm:read'),
  async (c) => {
    const { interaction } = await getInteraction(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    return ok(c, interaction);
  },
);

marketingEngagementRoutes.patch(
  '/interactions/:id',
  requirePermission('crm:write'),
  validate('json', updateInteractionSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { interaction } = await getInteraction(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (body.customerId) {
      await assertCustomerMerchant(
        body.customerId,
        interaction.merchantId,
        user,
        permissions,
      );
    }
    const [updated] = await db
      .update(customerInteractions)
      .set({
        ...body,
        scheduledAt:
          body.scheduledAt === undefined
            ? undefined
            : body.scheduledAt
              ? new Date(body.scheduledAt)
              : null,
        completedAt:
          body.status === undefined
            ? undefined
            : body.status === 'completed'
              ? new Date()
              : null,
      })
      .where(eq(customerInteractions.id, interaction.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'crm.interaction.update',
      entityType: 'customer_interaction',
      entityId: interaction.id,
      oldValues: { status: interaction.status, type: interaction.type },
      newValues: body,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

for (const action of ['complete', 'cancel'] as const) {
  marketingEngagementRoutes.post(
    `/interactions/:id/${action}`,
    requirePermission('crm:write'),
    async (c) => {
      const user = c.get('user');
      const permissions = c.get('permissions');
      const { interaction } = await getInteraction(
        c.req.param('id'),
        user,
        permissions,
        { manage: true },
      );
      const status = action === 'complete' ? 'completed' : 'cancelled';
      const [updated] = await db
        .update(customerInteractions)
        .set({
          status,
          completedAt: action === 'complete' ? new Date() : interaction.completedAt,
        })
        .where(eq(customerInteractions.id, interaction.id))
        .returning();
      await writeAuditLog({
        actorUserId: user.id,
        action: `crm.interaction.${action}`,
        entityType: 'customer_interaction',
        entityId: interaction.id,
        oldValues: { status: interaction.status },
        newValues: { status },
        ipAddress: getClientIp(c),
        userAgent: c.req.header('user-agent') ?? null,
      });
      return ok(c, updated!);
    },
  );
}

marketingEngagementRoutes.delete(
  '/interactions/:id',
  requirePermission('crm:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { interaction } = await getInteraction(c.req.param('id'), user, permissions, {
      manage: true,
    });
    await db
      .update(customerInteractions)
      .set({ status: 'cancelled' })
      .where(eq(customerInteractions.id, interaction.id));
    await writeAuditLog({
      actorUserId: user.id,
      action: 'crm.interaction.delete',
      entityType: 'customer_interaction',
      entityId: interaction.id,
      oldValues: { status: interaction.status, type: interaction.type },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, { id: interaction.id, cancelled: true });
  },
);

/* ------------------------------ Complaints ----------------------------- */

marketingEngagementRoutes.get(
  '/complaints',
  requirePermission('crm:read'),
  validate('query', listComplaintSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = marketingScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(customerComplaints.merchantId, query.merchantId));
    if (query.customerId) conditions.push(eq(customerComplaints.customerId, query.customerId));
    if (query.orderId) conditions.push(eq(customerComplaints.orderId, query.orderId));
    if (query.status) conditions.push(eq(customerComplaints.status, query.status));
    if (query.priority) conditions.push(eq(customerComplaints.priority, query.priority));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(customerComplaints.complaintNumber, term),
          ilike(customerComplaints.subject, term),
          ilike(customerComplaints.category, term),
          ilike(customers.name, term),
          ilike(merchants.businessName, term),
        ) as SQL,
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: customerComplaints.id,
          merchantId: customerComplaints.merchantId,
          merchantName: merchants.businessName,
          customerId: customerComplaints.customerId,
          customerName: customers.name,
          customerCode: customers.code,
          orderId: customerComplaints.orderId,
          orderNumber: orders.orderNumber,
          complaintNumber: customerComplaints.complaintNumber,
          category: customerComplaints.category,
          subject: customerComplaints.subject,
          priority: customerComplaints.priority,
          status: customerComplaints.status,
          assignedTo: customerComplaints.assignedTo,
          assignedToName: users.fullName,
          resolvedAt: customerComplaints.resolvedAt,
          closedAt: customerComplaints.closedAt,
          createdAt: customerComplaints.createdAt,
        })
        .from(customerComplaints)
        .innerJoin(merchants, eq(merchants.id, customerComplaints.merchantId))
        .innerJoin(customers, eq(customers.id, customerComplaints.customerId))
        .leftJoin(orders, eq(orders.id, customerComplaints.orderId))
        .leftJoin(users, eq(users.id, customerComplaints.assignedTo))
        .where(where)
        .orderBy(desc(customerComplaints.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(customerComplaints)
        .innerJoin(merchants, eq(merchants.id, customerComplaints.merchantId))
        .innerJoin(customers, eq(customers.id, customerComplaints.customerId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

marketingEngagementRoutes.post(
  '/complaints',
  requirePermission('crm:write'),
  validate('json', createComplaintSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertMarketingAccess(body.merchantId, user, permissions, { manage: true });
    await assertCustomerMerchant(body.customerId, body.merchantId, user, permissions);
    if (body.orderId) {
      const order = await db.query.orders.findFirst({ where: eq(orders.id, body.orderId) });
      if (!order) throw ApiError.notFound('Order tidak ditemukan');
      if (order.merchantId !== body.merchantId) {
        throw ApiError.badRequest('Order tidak dimiliki merchant ini');
      }
    }
    const complaintNumber = body.complaintNumber ?? generateCode('CLM');
    const [existing] = await db
      .select({ id: customerComplaints.id })
      .from(customerComplaints)
      .where(eq(customerComplaints.complaintNumber, complaintNumber))
      .limit(1);
    if (existing) throw ApiError.conflict('Nomor keluhan sudah digunakan');
    const [created] = await db
      .insert(customerComplaints)
      .values({
        merchantId: body.merchantId,
        customerId: body.customerId,
        orderId: body.orderId ?? null,
        complaintNumber,
        category: body.category ?? null,
        subject: body.subject,
        description: body.description,
        priority: body.priority,
        assignedTo: body.assignedTo ?? null,
        createdBy: user.id,
      })
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'crm.complaint.create',
      entityType: 'customer_complaint',
      entityId: created!.id,
      newValues: {
        complaintNumber: created!.complaintNumber,
        priority: created!.priority,
      },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created!, 201);
  },
);

marketingEngagementRoutes.get(
  '/complaints/:id',
  requirePermission('crm:read'),
  async (c) => {
    const { complaint } = await getComplaint(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    const [customer, order] = await Promise.all([
      db.query.customers.findFirst({ where: eq(customers.id, complaint.customerId) }),
      complaint.orderId
        ? db.query.orders.findFirst({ where: eq(orders.id, complaint.orderId) })
        : Promise.resolve(null),
    ]);
    return ok(c, { ...complaint, customer: customer ?? null, order: order ?? null });
  },
);

marketingEngagementRoutes.patch(
  '/complaints/:id',
  requirePermission('crm:write'),
  validate('json', updateComplaintSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { complaint } = await getComplaint(c.req.param('id'), user, permissions, {
      manage: true,
    });
    const [updated] = await db
      .update(customerComplaints)
      .set(body)
      .where(eq(customerComplaints.id, complaint.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'crm.complaint.update',
      entityType: 'customer_complaint',
      entityId: complaint.id,
      oldValues: { status: complaint.status, priority: complaint.priority },
      newValues: body,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

marketingEngagementRoutes.post(
  '/complaints/:id/start',
  requirePermission('crm:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { complaint } = await getComplaint(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (complaint.status !== 'open') {
      throw ApiError.badRequest('Hanya keluhan berstatus open yang dapat diproses');
    }
    const [updated] = await db
      .update(customerComplaints)
      .set({ status: 'in_progress' })
      .where(eq(customerComplaints.id, complaint.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'crm.complaint.start',
      entityType: 'customer_complaint',
      entityId: complaint.id,
      oldValues: { status: complaint.status },
      newValues: { status: 'in_progress' },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

for (const action of ['resolve', 'reject'] as const) {
  marketingEngagementRoutes.post(
    `/complaints/:id/${action}`,
    requirePermission('crm:write'),
    validate('json', resolutionSchema),
    async (c) => {
      const body = c.req.valid('json');
      const user = c.get('user');
      const permissions = c.get('permissions');
      const { complaint } = await getComplaint(c.req.param('id'), user, permissions, {
        manage: true,
      });
      if (!['open', 'in_progress'].includes(complaint.status)) {
        throw ApiError.badRequest('Keluhan sudah diselesaikan atau ditutup');
      }
      const status = action === 'resolve' ? 'resolved' : 'rejected';
      const [updated] = await db
        .update(customerComplaints)
        .set({ status, resolution: body.resolution, resolvedAt: new Date() })
        .where(eq(customerComplaints.id, complaint.id))
        .returning();
      await writeAuditLog({
        actorUserId: user.id,
        action: `crm.complaint.${action}`,
        entityType: 'customer_complaint',
        entityId: complaint.id,
        oldValues: { status: complaint.status },
        newValues: { status, resolution: body.resolution },
        ipAddress: getClientIp(c),
        userAgent: c.req.header('user-agent') ?? null,
      });
      return ok(c, updated!);
    },
  );
}

marketingEngagementRoutes.post(
  '/complaints/:id/close',
  requirePermission('crm:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { complaint } = await getComplaint(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (!['resolved', 'rejected'].includes(complaint.status)) {
      throw ApiError.badRequest('Keluhan harus diselesaikan atau ditolak sebelum ditutup');
    }
    const [updated] = await db
      .update(customerComplaints)
      .set({ status: 'closed', closedAt: new Date() })
      .where(eq(customerComplaints.id, complaint.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'crm.complaint.close',
      entityType: 'customer_complaint',
      entityId: complaint.id,
      oldValues: { status: complaint.status },
      newValues: { status: 'closed' },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);
