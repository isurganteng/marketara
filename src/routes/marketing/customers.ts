import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  customerGroupMembers,
  customerGroups,
  customerInteractions,
  customerProfiles,
  customerSegmentMembers,
  customerSegments,
  customers,
  loyaltyAccounts,
  merchants,
  orders,
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
  dateOnlySchema,
  getCustomer,
  getCustomerGroup,
  getCustomerSegment,
  marketingScopeCondition,
  money,
  numericSchema,
  toNumber,
} from './shared';

const customerStatusSchema = z.enum(['active', 'inactive', 'blocked']);
const customerSourceSchema = z.enum([
  'storefront',
  'pos',
  'manual',
  'import',
  'marketplace',
  'other',
]);
const groupStatusSchema = z.enum(['active', 'inactive']);
const segmentTypeSchema = z.enum(['manual', 'dynamic']);
const segmentStatusSchema = z.enum(['active', 'inactive']);
const orderStatusSchema = z.enum([
  'pending',
  'confirmed',
  'processing',
  'completed',
  'cancelled',
  'returned',
]);
const codeSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'Gunakan huruf, angka, garis bawah, atau tanda hubung');

const listCustomerSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  status: customerStatusSchema.optional(),
  source: customerSourceSchema.optional(),
  groupId: z.uuid().optional(),
  segmentId: z.uuid().optional(),
});

const createCustomerSchema = z.object({
  merchantId: z.uuid(),
  userId: z.uuid().optional(),
  code: codeSchema.optional(),
  name: z.string().trim().min(2).max(255),
  email: z.email().max(255).optional(),
  phone: z.string().trim().max(32).optional(),
  status: customerStatusSchema.default('active'),
  source: customerSourceSchema.default('manual'),
  birthDate: dateOnlySchema.optional(),
  gender: z.string().trim().max(32).optional(),
  tags: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
  notes: z.string().trim().max(4000).optional(),
});

const updateCustomerSchema = z.object({
  userId: z.uuid().nullable().optional(),
  code: codeSchema.optional(),
  name: z.string().trim().min(2).max(255).optional(),
  email: z.email().max(255).nullable().optional(),
  phone: z.string().trim().max(32).nullable().optional(),
  status: customerStatusSchema.optional(),
  source: customerSourceSchema.optional(),
  birthDate: dateOnlySchema.nullable().optional(),
  gender: z.string().trim().max(32).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(64)).max(50).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
});

const profileSchema = z.object({
  companyName: z.string().trim().max(255).nullable().optional(),
  taxNumber: z.string().trim().max(64).nullable().optional(),
  address: z.string().trim().max(4000).nullable().optional(),
  city: z.string().trim().max(128).nullable().optional(),
  province: z.string().trim().max(128).nullable().optional(),
  postalCode: z.string().trim().max(20).nullable().optional(),
  country: z.string().trim().length(2).optional(),
  avatarUrl: z.string().trim().max(2048).nullable().optional(),
  preferences: z.record(z.string(), z.unknown()).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
});

const groupInputSchema = z.object({
  code: codeSchema.optional(),
  name: z.string().trim().min(2).max(255),
  description: z.string().trim().max(4000).optional(),
  discountPercent: numericSchema.default('0'),
  status: groupStatusSchema.default('active'),
});

const updateGroupSchema = groupInputSchema.partial().extend({
  description: z.string().trim().max(4000).nullable().optional(),
});

const segmentCriteriaSchema = z
  .object({
    minTotalSpent: numericSchema.optional(),
    minTotalOrders: z.coerce.number().int().min(0).optional(),
    maxTotalOrders: z.coerce.number().int().min(0).optional(),
    status: customerStatusSchema.optional(),
    source: customerSourceSchema.optional(),
    tags: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
    joinedAfter: z.string().datetime({ offset: true }).optional(),
    joinedBefore: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

const segmentInputSchema = z.object({
  code: codeSchema.optional(),
  name: z.string().trim().min(2).max(255),
  description: z.string().trim().max(4000).optional(),
  type: segmentTypeSchema.default('manual'),
  criteria: segmentCriteriaSchema.nullable().optional(),
  status: segmentStatusSchema.default('active'),
});

const updateSegmentSchema = segmentInputSchema.partial().extend({
  description: z.string().trim().max(4000).nullable().optional(),
  criteria: segmentCriteriaSchema.nullable().optional(),
});

const memberInputSchema = z.object({ customerId: z.uuid() });

const refreshMetricsSchema = z.object({
  syncLoyaltySpend: z.boolean().default(true),
});

const listOrdersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: orderStatusSchema.optional(),
});

const listGroupMemberSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const marketingCustomerRoutes = new Hono<AppEnv>();

function customerOrderCondition(customer: typeof customers.$inferSelect): SQL | undefined {
  const identities: SQL[] = [];
  if (customer.userId) identities.push(eq(orders.userId, customer.userId));
  if (customer.email) {
    identities.push(
      sql`lower(${orders.contactEmail}) = ${customer.email.trim().toLowerCase()}`,
    );
  }
  if (customer.phone) identities.push(eq(orders.contactPhone, customer.phone.trim()));
  if (identities.length === 0) return undefined;
  return and(eq(orders.merchantId, customer.merchantId), or(...identities));
}

function tierForLifetime(
  lifetimePoints: number,
  lifetimeSpend: number,
): 'bronze' | 'silver' | 'gold' | 'platinum' {
  if (lifetimePoints >= 5000 || lifetimeSpend >= 10_000_000) return 'platinum';
  if (lifetimePoints >= 2500 || lifetimeSpend >= 5_000_000) return 'gold';
  if (lifetimePoints >= 1000 || lifetimeSpend >= 1_000_000) return 'silver';
  return 'bronze';
}

/* ------------------------------ Customers ------------------------------ */

marketingCustomerRoutes.get(
  '/customers',
  requirePermission('crm:read'),
  validate('query', listCustomerSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [isNull(customers.deletedAt)];
    const scope = marketingScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(customers.merchantId, query.merchantId));
    if (query.status) conditions.push(eq(customers.status, query.status));
    if (query.source) conditions.push(eq(customers.source, query.source));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(customers.code, term),
          ilike(customers.name, term),
          ilike(customers.email, term),
          ilike(customers.phone, term),
          ilike(merchants.businessName, term),
        ) as SQL,
      );
    }
    if (query.groupId) {
      conditions.push(
        inArray(
          customers.id,
          db
            .select({ id: customerGroupMembers.customerId })
            .from(customerGroupMembers)
            .where(eq(customerGroupMembers.groupId, query.groupId)),
        ),
      );
    }
    if (query.segmentId) {
      conditions.push(
        inArray(
          customers.id,
          db
            .select({ id: customerSegmentMembers.customerId })
            .from(customerSegmentMembers)
            .where(eq(customerSegmentMembers.segmentId, query.segmentId)),
        ),
      );
    }
    const where = and(...conditions);
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: customers.id,
          merchantId: customers.merchantId,
          merchantName: merchants.businessName,
          userId: customers.userId,
          code: customers.code,
          name: customers.name,
          email: customers.email,
          phone: customers.phone,
          status: customers.status,
          source: customers.source,
          tags: customers.tags,
          totalOrders: customers.totalOrders,
          totalSpent: customers.totalSpent,
          lastOrderAt: customers.lastOrderAt,
          joinedAt: customers.joinedAt,
          createdAt: customers.createdAt,
        })
        .from(customers)
        .innerJoin(merchants, eq(merchants.id, customers.merchantId))
        .where(where)
        .orderBy(desc(customers.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(customers)
        .innerJoin(merchants, eq(merchants.id, customers.merchantId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

marketingCustomerRoutes.post(
  '/customers',
  requirePermission('crm:write'),
  validate('json', createCustomerSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertMarketingAccess(body.merchantId, user, permissions, { manage: true });

    const code = body.code ?? generateCode('CUS');
    const [codeExists] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.merchantId, body.merchantId), eq(customers.code, code)))
      .limit(1);
    if (codeExists) throw ApiError.conflict('Kode pelanggan sudah digunakan');
    if (body.userId) {
      const [userExists] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(
          and(
            eq(customers.merchantId, body.merchantId),
            eq(customers.userId, body.userId),
            isNull(customers.deletedAt),
          ),
        )
        .limit(1);
      if (userExists) throw ApiError.conflict('Pengguna sudah terdaftar sebagai pelanggan');
    }

    const [created] = await db
      .insert(customers)
      .values({
        merchantId: body.merchantId,
        userId: body.userId ?? null,
        code,
        name: body.name,
        email: body.email ?? null,
        phone: body.phone ?? null,
        status: body.status,
        source: body.source,
        birthDate: body.birthDate ?? null,
        gender: body.gender ?? null,
        tags: body.tags ?? null,
        notes: body.notes ?? null,
        createdBy: user.id,
      })
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'crm.customer.create',
      entityType: 'customer',
      entityId: created!.id,
      newValues: { code: created!.code, name: created!.name },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created!, 201);
  },
);

marketingCustomerRoutes.get(
  '/customers/:id',
  requirePermission('crm:read'),
  async (c) => {
    const { customer } = await getCustomer(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    const [profile, groups, segments, loyalty, recentInteractions] = await Promise.all([
      db.query.customerProfiles.findFirst({
        where: eq(customerProfiles.customerId, customer.id),
      }),
      db
        .select({
          id: customerGroups.id,
          code: customerGroups.code,
          name: customerGroups.name,
          discountPercent: customerGroups.discountPercent,
          joinedAt: customerGroupMembers.joinedAt,
        })
        .from(customerGroupMembers)
        .innerJoin(customerGroups, eq(customerGroups.id, customerGroupMembers.groupId))
        .where(eq(customerGroupMembers.customerId, customer.id))
        .orderBy(asc(customerGroups.name)),
      db
        .select({
          id: customerSegments.id,
          code: customerSegments.code,
          name: customerSegments.name,
          type: customerSegments.type,
          addedAt: customerSegmentMembers.addedAt,
        })
        .from(customerSegmentMembers)
        .innerJoin(customerSegments, eq(customerSegments.id, customerSegmentMembers.segmentId))
        .where(eq(customerSegmentMembers.customerId, customer.id))
        .orderBy(asc(customerSegments.name)),
      db.query.loyaltyAccounts.findFirst({
        where: eq(loyaltyAccounts.customerId, customer.id),
      }),
      db
        .select()
        .from(customerInteractions)
        .where(eq(customerInteractions.customerId, customer.id))
        .orderBy(desc(customerInteractions.createdAt))
        .limit(10),
    ]);
    return ok(c, {
      ...customer,
      profile: profile ?? null,
      groups,
      segments,
      loyaltyAccount: loyalty ?? null,
      recentInteractions,
    });
  },
);

marketingCustomerRoutes.patch(
  '/customers/:id',
  requirePermission('crm:write'),
  validate('json', updateCustomerSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { customer } = await getCustomer(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (body.code && body.code !== customer.code) {
      const [existing] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.merchantId, customer.merchantId), eq(customers.code, body.code)))
        .limit(1);
      if (existing) throw ApiError.conflict('Kode pelanggan sudah digunakan');
    }
    if (body.userId && body.userId !== customer.userId) {
      const [existing] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(
          and(
            eq(customers.merchantId, customer.merchantId),
            eq(customers.userId, body.userId),
            isNull(customers.deletedAt),
          ),
        )
        .limit(1);
      if (existing) throw ApiError.conflict('Pengguna sudah terhubung ke pelanggan lain');
    }
    const [updated] = await db
      .update(customers)
      .set(body)
      .where(eq(customers.id, customer.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'crm.customer.update',
      entityType: 'customer',
      entityId: customer.id,
      oldValues: { name: customer.name, status: customer.status },
      newValues: body,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

marketingCustomerRoutes.delete(
  '/customers/:id',
  requirePermission('crm:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { customer } = await getCustomer(c.req.param('id'), user, permissions, {
      manage: true,
    });
    await db
      .update(customers)
      .set({ deletedAt: new Date(), status: 'inactive', userId: null })
      .where(eq(customers.id, customer.id));
    await writeAuditLog({
      actorUserId: user.id,
      action: 'crm.customer.delete',
      entityType: 'customer',
      entityId: customer.id,
      oldValues: { code: customer.code, name: customer.name },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, { id: customer.id, deleted: true });
  },
);

marketingCustomerRoutes.put(
  '/customers/:id/profile',
  requirePermission('crm:write'),
  validate('json', profileSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { customer } = await getCustomer(c.req.param('id'), user, permissions, {
      manage: true,
    });
    const [saved] = await db
      .insert(customerProfiles)
      .values({ customerId: customer.id, ...body })
      .onConflictDoUpdate({
        target: customerProfiles.customerId,
        set: { ...body, updatedAt: new Date() },
      })
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'crm.customer.profile.upsert',
      entityType: 'customer_profile',
      entityId: customer.id,
      newValues: body,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, saved!);
  },
);

/* --------------------------- Customer orders --------------------------- */

marketingCustomerRoutes.get(
  '/customers/:id/orders',
  requirePermission('crm:read'),
  validate('query', listOrdersSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { customer } = await getCustomer(c.req.param('id'), user, permissions);
    const pagination = getPagination(query);
    const condition = customerOrderCondition(customer);
    if (!condition) {
      return paginated(c, [], 0, pagination);
    }
    const conditions: SQL[] = [condition];
    if (query.status) conditions.push(eq(orders.status, query.status));
    const where = and(...conditions);
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          status: orders.status,
          itemCount: orders.itemCount,
          subtotal: orders.subtotal,
          discountTotal: orders.discountTotal,
          shippingTotal: orders.shippingTotal,
          grandTotal: orders.grandTotal,
          contactName: orders.contactName,
          contactPhone: orders.contactPhone,
          contactEmail: orders.contactEmail,
          placedAt: orders.placedAt,
          completedAt: orders.completedAt,
        })
        .from(orders)
        .where(where)
        .orderBy(desc(orders.placedAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(orders).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

marketingCustomerRoutes.post(
  '/customers/:id/refresh-metrics',
  requirePermission('crm:write'),
  validate('json', refreshMetricsSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { customer } = await getCustomer(c.req.param('id'), user, permissions, {
      manage: true,
    });
    const condition = customerOrderCondition(customer);
    let totalOrders = 0;
    let totalSpent = '0.00';
    let lastOrderAt: Date | null = null;
    if (condition) {
      const [row] = await db
        .select({
          totalOrders: count(),
          totalSpent: sql<string>`coalesce(sum(${orders.grandTotal}), 0)`,
          lastOrderAt: sql<Date | null>`max(${orders.placedAt})`,
        })
        .from(orders)
        .where(
          and(condition, sql`${orders.status} not in ('cancelled', 'returned')`),
        );
      totalOrders = row?.totalOrders ?? 0;
      totalSpent = money(toNumber(row?.totalSpent));
      lastOrderAt = row?.lastOrderAt ? new Date(row.lastOrderAt) : null;
    }
    const [updated] = await db
      .update(customers)
      .set({ totalOrders, totalSpent, lastOrderAt })
      .where(eq(customers.id, customer.id))
      .returning();

    if (body.syncLoyaltySpend) {
      const account = await db.query.loyaltyAccounts.findFirst({
        where: eq(loyaltyAccounts.customerId, customer.id),
      });
      if (account) {
        await db
          .update(loyaltyAccounts)
          .set({
            lifetimeSpend: totalSpent,
            tier: tierForLifetime(account.lifetimePoints, toNumber(totalSpent)),
          })
          .where(eq(loyaltyAccounts.id, account.id));
      }
    }

    await writeAuditLog({
      actorUserId: user.id,
      action: 'crm.customer.metrics.refresh',
      entityType: 'customer',
      entityId: customer.id,
      newValues: { totalOrders, totalSpent, lastOrderAt },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

/* ---------------------------- Customer groups --------------------------- */

marketingCustomerRoutes.get(
  '/customer-groups',
  requirePermission('crm:read'),
  validate('query', listGroupMemberSchema.extend({ merchantId: z.uuid().optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = marketingScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(customerGroups.merchantId, query.merchantId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: customerGroups.id,
          merchantId: customerGroups.merchantId,
          merchantName: merchants.businessName,
          code: customerGroups.code,
          name: customerGroups.name,
          description: customerGroups.description,
          discountPercent: customerGroups.discountPercent,
          status: customerGroups.status,
          createdAt: customerGroups.createdAt,
        })
        .from(customerGroups)
        .innerJoin(merchants, eq(merchants.id, customerGroups.merchantId))
        .where(where)
        .orderBy(asc(customerGroups.name))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(customerGroups)
        .innerJoin(merchants, eq(merchants.id, customerGroups.merchantId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

marketingCustomerRoutes.post(
  '/customer-groups',
  requirePermission('crm:write'),
  validate('json', groupInputSchema.extend({ merchantId: z.uuid() })),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertMarketingAccess(body.merchantId, user, permissions, { manage: true });
    const code = body.code ?? generateCode('GRP');
    const [existing] = await db
      .select({ id: customerGroups.id })
      .from(customerGroups)
      .where(
        and(eq(customerGroups.merchantId, body.merchantId), eq(customerGroups.code, code)),
      )
      .limit(1);
    if (existing) throw ApiError.conflict('Kode grup sudah digunakan');
    const [created] = await db
      .insert(customerGroups)
      .values({
        merchantId: body.merchantId,
        code,
        name: body.name,
        description: body.description ?? null,
        discountPercent: body.discountPercent,
        status: body.status,
        createdBy: user.id,
      })
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'crm.customer.group.create',
      entityType: 'customer_group',
      entityId: created!.id,
      newValues: { code: created!.code, name: created!.name },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created!, 201);
  },
);

marketingCustomerRoutes.get(
  '/customer-groups/:id',
  requirePermission('crm:read'),
  async (c) => {
    const { group } = await getCustomerGroup(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    const members = await db
      .select({
        id: customers.id,
        code: customers.code,
        name: customers.name,
        email: customers.email,
        phone: customers.phone,
        status: customers.status,
        joinedAt: customerGroupMembers.joinedAt,
      })
      .from(customerGroupMembers)
      .innerJoin(customers, eq(customers.id, customerGroupMembers.customerId))
      .where(eq(customerGroupMembers.groupId, group.id))
      .orderBy(asc(customers.name));
    return ok(c, { ...group, members, memberCount: members.length });
  },
);

marketingCustomerRoutes.patch(
  '/customer-groups/:id',
  requirePermission('crm:write'),
  validate('json', updateGroupSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { group } = await getCustomerGroup(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (body.code && body.code !== group.code) {
      const [existing] = await db
        .select({ id: customerGroups.id })
        .from(customerGroups)
        .where(
          and(eq(customerGroups.merchantId, group.merchantId), eq(customerGroups.code, body.code)),
        )
        .limit(1);
      if (existing) throw ApiError.conflict('Kode grup sudah digunakan');
    }
    const [updated] = await db
      .update(customerGroups)
      .set(body)
      .where(eq(customerGroups.id, group.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'crm.customer.group.update',
      entityType: 'customer_group',
      entityId: group.id,
      newValues: body,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

marketingCustomerRoutes.delete(
  '/customer-groups/:id',
  requirePermission('crm:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { group } = await getCustomerGroup(c.req.param('id'), user, permissions, {
      manage: true,
    });
    await db.delete(customerGroups).where(eq(customerGroups.id, group.id));
    await writeAuditLog({
      actorUserId: user.id,
      action: 'crm.customer.group.delete',
      entityType: 'customer_group',
      entityId: group.id,
      oldValues: { code: group.code, name: group.name },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, { id: group.id, deleted: true });
  },
);

marketingCustomerRoutes.post(
  '/customer-groups/:id/members',
  requirePermission('crm:write'),
  validate('json', memberInputSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { group } = await getCustomerGroup(c.req.param('id'), user, permissions, {
      manage: true,
    });
    const { customer } = await getCustomer(body.customerId, user, permissions);
    if (customer.merchantId !== group.merchantId) {
      throw ApiError.badRequest('Pelanggan dan grup berasal dari merchant berbeda');
    }
    const [created] = await db
      .insert(customerGroupMembers)
      .values({ groupId: group.id, customerId: customer.id })
      .onConflictDoNothing()
      .returning();
    if (!created) throw ApiError.conflict('Pelanggan sudah menjadi anggota grup');
    await writeAuditLog({
      actorUserId: user.id,
      action: 'crm.customer.group.member.add',
      entityType: 'customer_group_member',
      entityId: created.id,
      newValues: { groupId: group.id, customerId: customer.id },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created, 201);
  },
);

marketingCustomerRoutes.delete(
  '/customer-groups/:id/members/:customerId',
  requirePermission('crm:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { group } = await getCustomerGroup(c.req.param('id'), user, permissions, {
      manage: true,
    });
    const [deleted] = await db
      .delete(customerGroupMembers)
      .where(
        and(
          eq(customerGroupMembers.groupId, group.id),
          eq(customerGroupMembers.customerId, c.req.param('customerId')),
        ),
      )
      .returning();
    if (!deleted) throw ApiError.notFound('Anggota grup tidak ditemukan');
    await writeAuditLog({
      actorUserId: user.id,
      action: 'crm.customer.group.member.remove',
      entityType: 'customer_group_member',
      entityId: deleted.id,
      oldValues: { groupId: group.id, customerId: deleted.customerId },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, { id: deleted.id, removed: true });
  },
);

/* ---------------------------- Customer segments ------------------------- */

marketingCustomerRoutes.get(
  '/customer-segments',
  requirePermission('crm:read'),
  validate('query', listGroupMemberSchema.extend({ merchantId: z.uuid().optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = marketingScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(customerSegments.merchantId, query.merchantId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: customerSegments.id,
          merchantId: customerSegments.merchantId,
          merchantName: merchants.businessName,
          code: customerSegments.code,
          name: customerSegments.name,
          description: customerSegments.description,
          type: customerSegments.type,
          criteria: customerSegments.criteria,
          status: customerSegments.status,
          memberCount: customerSegments.memberCount,
          createdAt: customerSegments.createdAt,
        })
        .from(customerSegments)
        .innerJoin(merchants, eq(merchants.id, customerSegments.merchantId))
        .where(where)
        .orderBy(asc(customerSegments.name))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(customerSegments)
        .innerJoin(merchants, eq(merchants.id, customerSegments.merchantId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

marketingCustomerRoutes.post(
  '/customer-segments',
  requirePermission('crm:write'),
  validate('json', segmentInputSchema.extend({ merchantId: z.uuid() })),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertMarketingAccess(body.merchantId, user, permissions, { manage: true });
    if (body.type === 'dynamic' && !body.criteria) {
      throw ApiError.badRequest('Segmen dinamis wajib memiliki kriteria');
    }
    const code = body.code ?? generateCode('SEG');
    const [existing] = await db
      .select({ id: customerSegments.id })
      .from(customerSegments)
      .where(
        and(eq(customerSegments.merchantId, body.merchantId), eq(customerSegments.code, code)),
      )
      .limit(1);
    if (existing) throw ApiError.conflict('Kode segmen sudah digunakan');
    const [created] = await db
      .insert(customerSegments)
      .values({
        merchantId: body.merchantId,
        code,
        name: body.name,
        description: body.description ?? null,
        type: body.type,
        criteria: body.criteria ?? null,
        status: body.status,
        createdBy: user.id,
      })
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'crm.customer.segment.create',
      entityType: 'customer_segment',
      entityId: created!.id,
      newValues: { code: created!.code, name: created!.name, type: created!.type },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created!, 201);
  },
);

marketingCustomerRoutes.get(
  '/customer-segments/:id',
  requirePermission('crm:read'),
  async (c) => {
    const { segment } = await getCustomerSegment(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    const members = await db
      .select({
        id: customers.id,
        code: customers.code,
        name: customers.name,
        email: customers.email,
        phone: customers.phone,
        status: customers.status,
        totalOrders: customers.totalOrders,
        totalSpent: customers.totalSpent,
        addedAt: customerSegmentMembers.addedAt,
      })
      .from(customerSegmentMembers)
      .innerJoin(customers, eq(customers.id, customerSegmentMembers.customerId))
      .where(eq(customerSegmentMembers.segmentId, segment.id))
      .orderBy(asc(customers.name));
    return ok(c, { ...segment, members, memberCount: members.length });
  },
);

marketingCustomerRoutes.patch(
  '/customer-segments/:id',
  requirePermission('crm:write'),
  validate('json', updateSegmentSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { segment } = await getCustomerSegment(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (body.code && body.code !== segment.code) {
      const [existing] = await db
        .select({ id: customerSegments.id })
        .from(customerSegments)
        .where(
          and(
            eq(customerSegments.merchantId, segment.merchantId),
            eq(customerSegments.code, body.code),
          ),
        )
        .limit(1);
      if (existing) throw ApiError.conflict('Kode segmen sudah digunakan');
    }
    const [updated] = await db
      .update(customerSegments)
      .set(body)
      .where(eq(customerSegments.id, segment.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'crm.customer.segment.update',
      entityType: 'customer_segment',
      entityId: segment.id,
      newValues: body,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

marketingCustomerRoutes.delete(
  '/customer-segments/:id',
  requirePermission('crm:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { segment } = await getCustomerSegment(c.req.param('id'), user, permissions, {
      manage: true,
    });
    await db.delete(customerSegments).where(eq(customerSegments.id, segment.id));
    await writeAuditLog({
      actorUserId: user.id,
      action: 'crm.customer.segment.delete',
      entityType: 'customer_segment',
      entityId: segment.id,
      oldValues: { code: segment.code, name: segment.name },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, { id: segment.id, deleted: true });
  },
);

marketingCustomerRoutes.post(
  '/customer-segments/:id/members',
  requirePermission('crm:write'),
  validate('json', memberInputSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { segment } = await getCustomerSegment(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (segment.type === 'dynamic') {
      throw ApiError.badRequest('Anggota segmen dinamis diperbarui melalui refresh');
    }
    const { customer } = await getCustomer(body.customerId, user, permissions);
    if (customer.merchantId !== segment.merchantId) {
      throw ApiError.badRequest('Pelanggan dan segmen berasal dari merchant berbeda');
    }
    const created = await db.transaction(async (tx) => {
      const [member] = await tx
        .insert(customerSegmentMembers)
        .values({ segmentId: segment.id, customerId: customer.id })
        .onConflictDoNothing()
        .returning();
      if (!member) return null;
      const [row] = await tx
        .select({ total: count() })
        .from(customerSegmentMembers)
        .where(eq(customerSegmentMembers.segmentId, segment.id));
      await tx
        .update(customerSegments)
        .set({ memberCount: row?.total ?? 0 })
        .where(eq(customerSegments.id, segment.id));
      return member;
    });
    if (!created) throw ApiError.conflict('Pelanggan sudah menjadi anggota segmen');
    await writeAuditLog({
      actorUserId: user.id,
      action: 'crm.customer.segment.member.add',
      entityType: 'customer_segment_member',
      entityId: created.id,
      newValues: { segmentId: segment.id, customerId: customer.id },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created, 201);
  },
);

marketingCustomerRoutes.delete(
  '/customer-segments/:id/members/:customerId',
  requirePermission('crm:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { segment } = await getCustomerSegment(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (segment.type === 'dynamic') {
      throw ApiError.badRequest('Anggota segmen dinamis diperbarui melalui refresh');
    }
    const deleted = await db.transaction(async (tx) => {
      const [removed] = await tx
        .delete(customerSegmentMembers)
        .where(
          and(
            eq(customerSegmentMembers.segmentId, segment.id),
            eq(customerSegmentMembers.customerId, c.req.param('customerId')),
          ),
        )
        .returning();
      if (!removed) return null;
      const [row] = await tx
        .select({ total: count() })
        .from(customerSegmentMembers)
        .where(eq(customerSegmentMembers.segmentId, segment.id));
      await tx
        .update(customerSegments)
        .set({ memberCount: row?.total ?? 0 })
        .where(eq(customerSegments.id, segment.id));
      return removed;
    });
    if (!deleted) throw ApiError.notFound('Anggota segmen tidak ditemukan');
    await writeAuditLog({
      actorUserId: user.id,
      action: 'crm.customer.segment.member.remove',
      entityType: 'customer_segment_member',
      entityId: deleted.id,
      oldValues: { segmentId: segment.id, customerId: deleted.customerId },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, { id: deleted.id, removed: true });
  },
);

marketingCustomerRoutes.post(
  '/customer-segments/:id/refresh',
  requirePermission('crm:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { segment } = await getCustomerSegment(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (segment.type !== 'dynamic' || !segment.criteria) {
      throw ApiError.badRequest('Hanya segmen dinamis dengan kriteria yang dapat di-refresh');
    }
    const criteria = segmentCriteriaSchema.parse(segment.criteria);
    const conditions: SQL[] = [
      eq(customers.merchantId, segment.merchantId),
      isNull(customers.deletedAt),
    ];
    if (criteria.status) conditions.push(eq(customers.status, criteria.status));
    if (criteria.source) conditions.push(eq(customers.source, criteria.source));
    if (criteria.minTotalSpent) {
      conditions.push(sql`${customers.totalSpent} >= ${criteria.minTotalSpent}`);
    }
    if (criteria.minTotalOrders !== undefined) {
      conditions.push(sql`${customers.totalOrders} >= ${criteria.minTotalOrders}`);
    }
    if (criteria.maxTotalOrders !== undefined) {
      conditions.push(sql`${customers.totalOrders} <= ${criteria.maxTotalOrders}`);
    }
    if (criteria.joinedAfter) {
      conditions.push(sql`${customers.joinedAt} >= ${new Date(criteria.joinedAfter)}`);
    }
    if (criteria.joinedBefore) {
      conditions.push(sql`${customers.joinedAt} <= ${new Date(criteria.joinedBefore)}`);
    }
    if (criteria.tags?.length) {
      conditions.push(sql`${customers.tags} @> ${JSON.stringify(criteria.tags)}::jsonb`);
    }
    const matched = await db
      .select({ id: customers.id })
      .from(customers)
      .where(and(...conditions));
    const result = await db.transaction(async (tx) => {
      await tx
        .delete(customerSegmentMembers)
        .where(eq(customerSegmentMembers.segmentId, segment.id));
      if (matched.length > 0) {
        await tx.insert(customerSegmentMembers).values(
          matched.map((row) => ({ segmentId: segment.id, customerId: row.id })),
        );
      }
      const [updated] = await tx
        .update(customerSegments)
        .set({ memberCount: matched.length })
        .where(eq(customerSegments.id, segment.id))
        .returning();
      return updated!;
    });
    await writeAuditLog({
      actorUserId: user.id,
      action: 'crm.customer.segment.refresh',
      entityType: 'customer_segment',
      entityId: segment.id,
      newValues: { memberCount: matched.length },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, { ...result, matchedCount: matched.length });
  },
);
