import { and, asc, count, eq, ilike, inArray, isNull, or, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  merchantPaymentAccounts,
  merchants,
  paymentProviders,
} from '../../db/schema';
import { assertMerchantAccess, isPlatformAdmin, merchantScopeCondition } from '../../lib/access';
import { writeAuditLog } from '../../lib/audit';
import type { AppEnv } from '../../lib/app-env';
import { ApiError } from '../../lib/errors';
import { getPagination, ok, paginated } from '../../lib/http';
import { validate } from '../../lib/validator';
import { requirePermission } from '../../middleware/auth';
import { getClientIp } from '../../services/auth';

const accountStatusSchema = z.enum(['pending_verification', 'active', 'inactive']);

const listAccountsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  status: accountStatusSchema.optional(),
});

const createAccountSchema = z.object({
  merchantId: z.uuid(),
  providerId: z.uuid().optional(),
  accountName: z.string().trim().min(2).max(255),
  accountNumber: z.string().trim().min(3).max(64),
  bankName: z.string().trim().max(128).optional(),
  status: accountStatusSchema.default('pending_verification'),
  isDefault: z.boolean().default(false),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const updateAccountSchema = createAccountSchema.partial().omit({ merchantId: true });

function accountScopeCondition(user: AppEnv['Variables']['user'], permissions: Set<string>) {
  if (isPlatformAdmin(permissions)) return undefined;
  const merchantCondition = merchantScopeCondition(user, permissions);
  return inArray(
    merchantPaymentAccounts.merchantId,
    db
      .select({ id: merchants.id })
      .from(merchants)
      .where(and(merchantCondition, isNull(merchants.deletedAt))),
  );
}

export const paymentAccountRoutes = new Hono<AppEnv>();

paymentAccountRoutes.get(
  '/accounts',
  requirePermission('payment:read'),
  validate('query', listAccountsSchema),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = accountScopeCondition(c.get('user'), c.get('permissions'));
    if (scope) conditions.push(scope);
    if (query.merchantId) {
      conditions.push(eq(merchantPaymentAccounts.merchantId, query.merchantId));
    }
    if (query.status) conditions.push(eq(merchantPaymentAccounts.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(merchantPaymentAccounts.accountName, term),
          ilike(merchantPaymentAccounts.accountNumber, term),
          ilike(merchantPaymentAccounts.bankName, term),
          ilike(merchants.businessName, term),
        ) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: merchantPaymentAccounts.id,
          merchantId: merchantPaymentAccounts.merchantId,
          merchantName: merchants.businessName,
          merchantCode: merchants.code,
          providerId: merchantPaymentAccounts.providerId,
          providerName: paymentProviders.name,
          accountName: merchantPaymentAccounts.accountName,
          accountNumber: merchantPaymentAccounts.accountNumber,
          bankName: merchantPaymentAccounts.bankName,
          status: merchantPaymentAccounts.status,
          isDefault: merchantPaymentAccounts.isDefault,
          metadata: merchantPaymentAccounts.metadata,
          createdAt: merchantPaymentAccounts.createdAt,
          updatedAt: merchantPaymentAccounts.updatedAt,
        })
        .from(merchantPaymentAccounts)
        .innerJoin(merchants, eq(merchants.id, merchantPaymentAccounts.merchantId))
        .leftJoin(
          paymentProviders,
          eq(paymentProviders.id, merchantPaymentAccounts.providerId),
        )
        .where(where)
        .orderBy(
          asc(merchants.businessName),
          asc(merchantPaymentAccounts.isDefault),
          asc(merchantPaymentAccounts.createdAt),
        )
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ value: count() })
        .from(merchantPaymentAccounts)
        .innerJoin(merchants, eq(merchants.id, merchantPaymentAccounts.merchantId))
        .where(where),
    ]);

    return paginated(c, rows, Number(totalRow?.value ?? 0), pagination);
  },
);

paymentAccountRoutes.post(
  '/accounts',
  requirePermission('payment:write'),
  validate('json', createAccountSchema),
  async (c) => {
    const body = c.req.valid('json');
    await assertMerchantAccess(body.merchantId, c.get('user'), c.get('permissions'), {
      manage: true,
    });

    if (body.providerId) {
      const provider = await db.query.paymentProviders.findFirst({
        where: eq(paymentProviders.id, body.providerId),
      });
      if (!provider) throw ApiError.notFound('Provider pembayaran tidak ditemukan');
    }

    const account = await db.transaction(async (tx) => {
      if (body.isDefault) {
        await tx
          .update(merchantPaymentAccounts)
          .set({ isDefault: false })
          .where(eq(merchantPaymentAccounts.merchantId, body.merchantId));
      }
      const [created] = await tx
        .insert(merchantPaymentAccounts)
        .values({
          ...body,
          isDefault: body.isDefault,
        })
        .returning();
      return created;
    });
    if (!account) throw ApiError.internal('Gagal membuat akun pembayaran merchant');

    await writeAuditLog({
      actorUserId: c.get('user').id,
      action: 'payment_account.create',
      entityType: 'payment_account',
      entityId: account.id,
      newValues: account,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    });

    return ok(c, account, 201);
  },
);

paymentAccountRoutes.patch(
  '/accounts/:accountId',
  requirePermission('payment:write'),
  validate('json', updateAccountSchema),
  async (c) => {
    const accountId = c.req.param('accountId');
    const body = c.req.valid('json');
    const existing = await db.query.merchantPaymentAccounts.findFirst({
      where: eq(merchantPaymentAccounts.id, accountId),
    });
    if (!existing) throw ApiError.notFound('Akun pembayaran tidak ditemukan');

    await assertMerchantAccess(existing.merchantId, c.get('user'), c.get('permissions'), {
      manage: true,
    });

    if (body.providerId) {
      const provider = await db.query.paymentProviders.findFirst({
        where: eq(paymentProviders.id, body.providerId),
      });
      if (!provider) throw ApiError.notFound('Provider pembayaran tidak ditemukan');
    }

    const account = await db.transaction(async (tx) => {
      if (body.isDefault === true) {
        await tx
          .update(merchantPaymentAccounts)
          .set({ isDefault: false })
          .where(eq(merchantPaymentAccounts.merchantId, existing.merchantId));
      }
      const [updated] = await tx
        .update(merchantPaymentAccounts)
        .set(body)
        .where(eq(merchantPaymentAccounts.id, accountId))
        .returning();
      return updated;
    });

    await writeAuditLog({
      actorUserId: c.get('user').id,
      action: 'payment_account.update',
      entityType: 'payment_account',
      entityId: accountId,
      oldValues: existing,
      newValues: account,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    });

    return ok(c, account);
  },
);
