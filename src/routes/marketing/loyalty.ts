import {
  and,
  count,
  desc,
  eq,
  ilike,
  isNull,
  or,
  type SQL,
} from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  customers,
  loyaltyAccounts,
  loyaltyTransactions,
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
  getCustomer,
  getLoyaltyAccount,
  marketingScopeCondition,
  toNumber,
} from './shared';

const tierSchema = z.enum(['bronze', 'silver', 'gold', 'platinum']);
const accountStatusSchema = z.enum(['active', 'suspended', 'closed']);
const transactionTypeSchema = z.enum(['earn', 'redeem', 'adjustment', 'expire', 'bonus']);
const memberCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'Gunakan huruf, angka, garis bawah, atau tanda hubung');

const listAccountSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  customerId: z.uuid().optional(),
  status: accountStatusSchema.optional(),
  tier: tierSchema.optional(),
});

const createAccountSchema = z.object({
  merchantId: z.uuid(),
  customerId: z.uuid(),
  memberCode: memberCodeSchema.optional(),
  tier: tierSchema.default('bronze'),
  status: accountStatusSchema.default('active'),
});

const updateAccountSchema = z.object({
  memberCode: memberCodeSchema.optional(),
  tier: tierSchema.optional(),
  status: accountStatusSchema.optional(),
});

const transactionInputSchema = z.object({
  type: transactionTypeSchema,
  points: z.coerce.number().int().refine((value) => value !== 0, 'Poin tidak boleh 0'),
  orderId: z.uuid().optional(),
  reference: z.string().trim().max(128).optional(),
  description: z.string().trim().max(4000).optional(),
  expiresAt: z.string().datetime({ offset: true }).optional(),
});

const listTransactionSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  merchantId: z.uuid().optional(),
  accountId: z.uuid().optional(),
  customerId: z.uuid().optional(),
  type: transactionTypeSchema.optional(),
});

export const marketingLoyaltyRoutes = new Hono<AppEnv>();

function tierForAccount(lifetimePoints: number, lifetimeSpend: number) {
  if (lifetimePoints >= 5000 || lifetimeSpend >= 10_000_000) return 'platinum' as const;
  if (lifetimePoints >= 2500 || lifetimeSpend >= 5_000_000) return 'gold' as const;
  if (lifetimePoints >= 1000 || lifetimeSpend >= 1_000_000) return 'silver' as const;
  return 'bronze' as const;
}

/* --------------------------- Loyalty accounts -------------------------- */

marketingLoyaltyRoutes.get(
  '/loyalty-accounts',
  requirePermission('crm:read'),
  validate('query', listAccountSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [isNull(customers.deletedAt)];
    const scope = marketingScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(loyaltyAccounts.merchantId, query.merchantId));
    if (query.customerId) conditions.push(eq(loyaltyAccounts.customerId, query.customerId));
    if (query.status) conditions.push(eq(loyaltyAccounts.status, query.status));
    if (query.tier) conditions.push(eq(loyaltyAccounts.tier, query.tier));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(loyaltyAccounts.memberCode, term),
          ilike(customers.name, term),
          ilike(customers.email, term),
          ilike(customers.phone, term),
          ilike(merchants.businessName, term),
        ) as SQL,
      );
    }
    const where = and(...conditions);
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: loyaltyAccounts.id,
          merchantId: loyaltyAccounts.merchantId,
          merchantName: merchants.businessName,
          customerId: loyaltyAccounts.customerId,
          customerName: customers.name,
          customerCode: customers.code,
          customerEmail: customers.email,
          customerPhone: customers.phone,
          memberCode: loyaltyAccounts.memberCode,
          tier: loyaltyAccounts.tier,
          pointsBalance: loyaltyAccounts.pointsBalance,
          lifetimePoints: loyaltyAccounts.lifetimePoints,
          lifetimeSpend: loyaltyAccounts.lifetimeSpend,
          status: loyaltyAccounts.status,
          joinedAt: loyaltyAccounts.joinedAt,
          lastActivityAt: loyaltyAccounts.lastActivityAt,
        })
        .from(loyaltyAccounts)
        .innerJoin(customers, eq(customers.id, loyaltyAccounts.customerId))
        .innerJoin(merchants, eq(merchants.id, loyaltyAccounts.merchantId))
        .where(where)
        .orderBy(desc(loyaltyAccounts.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(loyaltyAccounts)
        .innerJoin(customers, eq(customers.id, loyaltyAccounts.customerId))
        .innerJoin(merchants, eq(merchants.id, loyaltyAccounts.merchantId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

marketingLoyaltyRoutes.post(
  '/loyalty-accounts',
  requirePermission('crm:write'),
  validate('json', createAccountSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertMarketingAccess(body.merchantId, user, permissions, { manage: true });
    const { customer } = await getCustomer(body.customerId, user, permissions);
    if (customer.merchantId !== body.merchantId) {
      throw ApiError.badRequest('Pelanggan tidak dimiliki merchant ini');
    }
    const [existing] = await db
      .select({ id: loyaltyAccounts.id })
      .from(loyaltyAccounts)
      .where(eq(loyaltyAccounts.customerId, customer.id))
      .limit(1);
    if (existing) throw ApiError.conflict('Pelanggan sudah memiliki akun loyalty');
    const memberCode = body.memberCode ?? generateCode('LYL');
    const [codeExists] = await db
      .select({ id: loyaltyAccounts.id })
      .from(loyaltyAccounts)
      .where(
        and(
          eq(loyaltyAccounts.merchantId, body.merchantId),
          eq(loyaltyAccounts.memberCode, memberCode),
        ),
      )
      .limit(1);
    if (codeExists) throw ApiError.conflict('Kode member sudah digunakan');
    const [created] = await db
      .insert(loyaltyAccounts)
      .values({
        merchantId: body.merchantId,
        customerId: customer.id,
        memberCode,
        tier: body.tier,
        status: body.status,
        createdBy: user.id,
      })
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'crm.loyalty.account.create',
      entityType: 'loyalty_account',
      entityId: created!.id,
      newValues: { memberCode: created!.memberCode, tier: created!.tier },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created!, 201);
  },
);

marketingLoyaltyRoutes.get(
  '/loyalty-accounts/:id',
  requirePermission('crm:read'),
  async (c) => {
    const { account } = await getLoyaltyAccount(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    const [customer, transactions] = await Promise.all([
      db.query.customers.findFirst({ where: eq(customers.id, account.customerId) }),
      db
        .select()
        .from(loyaltyTransactions)
        .where(eq(loyaltyTransactions.accountId, account.id))
        .orderBy(desc(loyaltyTransactions.createdAt))
        .limit(30),
    ]);
    return ok(c, { ...account, customer: customer ?? null, transactions });
  },
);

marketingLoyaltyRoutes.patch(
  '/loyalty-accounts/:id',
  requirePermission('crm:write'),
  validate('json', updateAccountSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { account } = await getLoyaltyAccount(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (body.memberCode && body.memberCode !== account.memberCode) {
      const [existing] = await db
        .select({ id: loyaltyAccounts.id })
        .from(loyaltyAccounts)
        .where(
          and(
            eq(loyaltyAccounts.merchantId, account.merchantId),
            eq(loyaltyAccounts.memberCode, body.memberCode),
          ),
        )
        .limit(1);
      if (existing) throw ApiError.conflict('Kode member sudah digunakan');
    }
    const [updated] = await db
      .update(loyaltyAccounts)
      .set(body)
      .where(eq(loyaltyAccounts.id, account.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'crm.loyalty.account.update',
      entityType: 'loyalty_account',
      entityId: account.id,
      newValues: body,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

for (const action of ['activate', 'suspend', 'close'] as const) {
  marketingLoyaltyRoutes.post(
    `/loyalty-accounts/:id/${action}`,
    requirePermission('crm:manage'),
    async (c) => {
      const statusByAction = {
        activate: 'active',
        suspend: 'suspended',
        close: 'closed',
      } as const;
      const user = c.get('user');
      const permissions = c.get('permissions');
      const { account } = await getLoyaltyAccount(c.req.param('id'), user, permissions, {
        manage: true,
      });
      const [updated] = await db
        .update(loyaltyAccounts)
        .set({ status: statusByAction[action] })
        .where(eq(loyaltyAccounts.id, account.id))
        .returning();
      await writeAuditLog({
        actorUserId: user.id,
        action: `crm.loyalty.account.${action}`,
        entityType: 'loyalty_account',
        entityId: account.id,
        oldValues: { status: account.status },
        newValues: { status: statusByAction[action] },
        ipAddress: getClientIp(c),
        userAgent: c.req.header('user-agent') ?? null,
      });
      return ok(c, updated!);
    },
  );
}

/* ------------------------- Loyalty transactions ------------------------ */

marketingLoyaltyRoutes.get(
  '/loyalty-accounts/:id/transactions',
  requirePermission('crm:read'),
  validate('query', listTransactionSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { account } = await getLoyaltyAccount(c.req.param('id'), user, permissions);
    const pagination = getPagination(query);
    const conditions: SQL[] = [eq(loyaltyTransactions.accountId, account.id)];
    if (query.type) conditions.push(eq(loyaltyTransactions.type, query.type));
    const where = and(...conditions);
    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(loyaltyTransactions)
        .where(where)
        .orderBy(desc(loyaltyTransactions.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(loyaltyTransactions).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

marketingLoyaltyRoutes.post(
  '/loyalty-accounts/:id/transactions',
  requirePermission('crm:write'),
  validate('json', transactionInputSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { account } = await getLoyaltyAccount(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (account.status !== 'active') {
      throw ApiError.badRequest('Akun loyalty tidak aktif');
    }
    if (body.orderId) {
      const order = await db.query.orders.findFirst({ where: eq(orders.id, body.orderId) });
      if (!order) throw ApiError.notFound('Order tidak ditemukan');
      if (order.merchantId !== account.merchantId) {
        throw ApiError.badRequest('Order tidak dimiliki merchant ini');
      }
    }

    let points = body.points;
    if (body.type === 'redeem' || body.type === 'expire') {
      points = -Math.abs(points);
    } else if (body.type === 'earn' || body.type === 'bonus') {
      points = Math.abs(points);
    }

    const result = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(loyaltyAccounts)
        .where(eq(loyaltyAccounts.id, account.id))
        .for('update');
      if (!locked) throw ApiError.notFound('Akun loyalty tidak ditemukan');
      const balanceBefore = locked.pointsBalance;
      const balanceAfter = balanceBefore + points;
      if (balanceAfter < 0) {
        throw ApiError.badRequest(
          `Saldo poin tidak mencukupi (tersedia ${balanceBefore} poin)`,
        );
      }
      const lifetimePoints =
        body.type === 'earn' || body.type === 'bonus' || body.type === 'adjustment'
          ? locked.lifetimePoints + Math.max(points, 0)
          : locked.lifetimePoints;
      const tier = tierForAccount(lifetimePoints, toNumber(locked.lifetimeSpend));
      const [transaction] = await tx
        .insert(loyaltyTransactions)
        .values({
          merchantId: account.merchantId,
          accountId: account.id,
          customerId: account.customerId,
          type: body.type,
          points,
          balanceBefore,
          balanceAfter,
          orderId: body.orderId ?? null,
          reference: body.reference ?? null,
          description: body.description ?? null,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
          createdBy: user.id,
        })
        .returning();
      const [updatedAccount] = await tx
        .update(loyaltyAccounts)
        .set({
          pointsBalance: balanceAfter,
          lifetimePoints,
          tier,
          lastActivityAt: new Date(),
        })
        .where(eq(loyaltyAccounts.id, account.id))
        .returning();
      return { transaction: transaction!, account: updatedAccount! };
    });

    await writeAuditLog({
      actorUserId: user.id,
      action: `crm.loyalty.transaction.${body.type}`,
      entityType: 'loyalty_transaction',
      entityId: result.transaction.id,
      newValues: {
        accountId: account.id,
        points,
        balanceAfter: result.transaction.balanceAfter,
      },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, result, 201);
  },
);

marketingLoyaltyRoutes.get(
  '/loyalty-transactions',
  requirePermission('crm:read'),
  validate('query', listTransactionSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = marketingScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) {
      conditions.push(eq(loyaltyTransactions.merchantId, query.merchantId));
    }
    if (query.accountId) conditions.push(eq(loyaltyTransactions.accountId, query.accountId));
    if (query.customerId) conditions.push(eq(loyaltyTransactions.customerId, query.customerId));
    if (query.type) conditions.push(eq(loyaltyTransactions.type, query.type));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: loyaltyTransactions.id,
          merchantId: loyaltyTransactions.merchantId,
          merchantName: merchants.businessName,
          accountId: loyaltyTransactions.accountId,
          memberCode: loyaltyAccounts.memberCode,
          customerId: loyaltyTransactions.customerId,
          customerName: customers.name,
          type: loyaltyTransactions.type,
          points: loyaltyTransactions.points,
          balanceBefore: loyaltyTransactions.balanceBefore,
          balanceAfter: loyaltyTransactions.balanceAfter,
          orderId: loyaltyTransactions.orderId,
          orderNumber: orders.orderNumber,
          reference: loyaltyTransactions.reference,
          description: loyaltyTransactions.description,
          expiresAt: loyaltyTransactions.expiresAt,
          createdAt: loyaltyTransactions.createdAt,
          createdByName: users.fullName,
        })
        .from(loyaltyTransactions)
        .innerJoin(merchants, eq(merchants.id, loyaltyTransactions.merchantId))
        .innerJoin(loyaltyAccounts, eq(loyaltyAccounts.id, loyaltyTransactions.accountId))
        .innerJoin(customers, eq(customers.id, loyaltyTransactions.customerId))
        .leftJoin(orders, eq(orders.id, loyaltyTransactions.orderId))
        .leftJoin(users, eq(users.id, loyaltyTransactions.createdBy))
        .where(where)
        .orderBy(desc(loyaltyTransactions.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(loyaltyTransactions)
        .innerJoin(merchants, eq(merchants.id, loyaltyTransactions.merchantId))
        .innerJoin(loyaltyAccounts, eq(loyaltyAccounts.id, loyaltyTransactions.accountId))
        .innerJoin(customers, eq(customers.id, loyaltyTransactions.customerId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);
