import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  notInArray,
  or,
  type SQL,
} from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  merchantPaymentAccounts,
  merchants,
  orders,
  paymentEvents,
  payments,
  settlementItems,
  settlements,
} from '../../db/schema';
import { assertMerchantAccess, isPlatformAdmin, merchantScopeCondition } from '../../lib/access';
import { writeAuditLog } from '../../lib/audit';
import type { AppEnv } from '../../lib/app-env';
import { ApiError } from '../../lib/errors';
import { getPagination, ok, paginated } from '../../lib/http';
import { generateCode } from '../../lib/slug';
import { validate } from '../../lib/validator';
import { requirePermission } from '../../middleware/auth';
import { getClientIp } from '../../services/auth';
import { money } from '../commerce/shared';
import { PAYMENT_SETTLED_STATUSES } from './shared';

const settlementStatusSchema = z.enum([
  'draft',
  'pending',
  'processing',
  'completed',
  'cancelled',
]);

const SETTLEMENT_TRANSITIONS: Record<string, string[]> = {
  draft: ['pending', 'cancelled'],
  pending: ['processing', 'cancelled'],
  processing: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

const listSettlementsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: settlementStatusSchema.optional(),
  merchantId: z.uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const createSettlementSchema = z.object({
  merchantId: z.uuid(),
  accountId: z.uuid().optional(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  notes: z.string().trim().max(2000).optional(),
});

const updateSettlementSchema = z.object({
  status: settlementStatusSchema,
  note: z.string().trim().max(2000).optional(),
});

function settlementScopeCondition(
  user: AppEnv['Variables']['user'],
  permissions: Set<string>,
): SQL | undefined {
  if (isPlatformAdmin(permissions)) return undefined;
  const merchantCondition = merchantScopeCondition(user, permissions);
  return inArray(
    settlements.merchantId,
    db
      .select({ id: merchants.id })
      .from(merchants)
      .where(and(merchantCondition, isNull(merchants.deletedAt))),
  );
}

async function getSettlementDetail(settlementId: string) {
  const [settlement] = await db
    .select({
      id: settlements.id,
      settlementNumber: settlements.settlementNumber,
      merchantId: settlements.merchantId,
      merchantName: merchants.businessName,
      merchantCode: merchants.code,
      accountId: settlements.accountId,
      accountName: merchantPaymentAccounts.accountName,
      accountNumber: merchantPaymentAccounts.accountNumber,
      bankName: merchantPaymentAccounts.bankName,
      status: settlements.status,
      currency: settlements.currency,
      periodStart: settlements.periodStart,
      periodEnd: settlements.periodEnd,
      grossAmount: settlements.grossAmount,
      feeAmount: settlements.feeAmount,
      refundAmount: settlements.refundAmount,
      netAmount: settlements.netAmount,
      paymentCount: settlements.paymentCount,
      notes: settlements.notes,
      processedAt: settlements.processedAt,
      completedAt: settlements.completedAt,
      cancelledAt: settlements.cancelledAt,
      createdAt: settlements.createdAt,
      updatedAt: settlements.updatedAt,
    })
    .from(settlements)
    .innerJoin(merchants, eq(merchants.id, settlements.merchantId))
    .leftJoin(
      merchantPaymentAccounts,
      eq(merchantPaymentAccounts.id, settlements.accountId),
    )
    .where(eq(settlements.id, settlementId))
    .limit(1);
  if (!settlement) throw ApiError.notFound('Settlement tidak ditemukan');

  const items = await db
    .select({
      id: settlementItems.id,
      paymentId: settlementItems.paymentId,
      paymentNumber: payments.paymentNumber,
      orderId: payments.orderId,
      orderNumber: orders.orderNumber,
      amount: settlementItems.amount,
      feeAmount: settlementItems.feeAmount,
      refundAmount: settlementItems.refundAmount,
      netAmount: settlementItems.netAmount,
      createdAt: settlementItems.createdAt,
    })
    .from(settlementItems)
    .innerJoin(payments, eq(payments.id, settlementItems.paymentId))
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(eq(settlementItems.settlementId, settlementId))
    .orderBy(asc(settlementItems.createdAt));

  return { ...settlement, items };
}

export const paymentSettlementRoutes = new Hono<AppEnv>();

paymentSettlementRoutes.get(
  '/settlements',
  requirePermission('payment:read'),
  validate('query', listSettlementsSchema),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = settlementScopeCondition(c.get('user'), c.get('permissions'));
    if (scope) conditions.push(scope);
    if (query.status) conditions.push(eq(settlements.status, query.status));
    if (query.merchantId) conditions.push(eq(settlements.merchantId, query.merchantId));
    if (query.from) conditions.push(gte(settlements.periodStart, query.from));
    if (query.to) conditions.push(lte(settlements.periodEnd, query.to));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(settlements.settlementNumber, term),
          ilike(merchants.businessName, term),
        ) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: settlements.id,
          settlementNumber: settlements.settlementNumber,
          merchantId: settlements.merchantId,
          merchantName: merchants.businessName,
          status: settlements.status,
          currency: settlements.currency,
          periodStart: settlements.periodStart,
          periodEnd: settlements.periodEnd,
          grossAmount: settlements.grossAmount,
          feeAmount: settlements.feeAmount,
          refundAmount: settlements.refundAmount,
          netAmount: settlements.netAmount,
          paymentCount: settlements.paymentCount,
          createdAt: settlements.createdAt,
          completedAt: settlements.completedAt,
        })
        .from(settlements)
        .innerJoin(merchants, eq(merchants.id, settlements.merchantId))
        .where(where)
        .orderBy(desc(settlements.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ value: count() })
        .from(settlements)
        .innerJoin(merchants, eq(merchants.id, settlements.merchantId))
        .where(where),
    ]);

    return paginated(c, rows, Number(totalRow?.value ?? 0), pagination);
  },
);

paymentSettlementRoutes.get(
  '/settlements/:settlementId',
  requirePermission('payment:read'),
  async (c) => {
    const settlementId = c.req.param('settlementId');
    const settlement = await db.query.settlements.findFirst({
      where: eq(settlements.id, settlementId),
    });
    if (!settlement) throw ApiError.notFound('Settlement tidak ditemukan');
    await assertMerchantAccess(
      settlement.merchantId,
      c.get('user'),
      c.get('permissions'),
    );
    return ok(c, await getSettlementDetail(settlementId));
  },
);

paymentSettlementRoutes.post(
  '/settlements',
  requirePermission('payment:write'),
  validate('json', createSettlementSchema),
  async (c) => {
    const body = c.req.valid('json');
    if (body.periodEnd <= body.periodStart) {
      throw ApiError.badRequest('Periode settlement tidak valid');
    }
    await assertMerchantAccess(body.merchantId, c.get('user'), c.get('permissions'), {
      manage: true,
    });

    if (body.accountId) {
      const account = await db.query.merchantPaymentAccounts.findFirst({
        where: and(
          eq(merchantPaymentAccounts.id, body.accountId),
          eq(merchantPaymentAccounts.merchantId, body.merchantId),
        ),
      });
      if (!account) throw ApiError.notFound('Akun pembayaran merchant tidak ditemukan');
    }

    const result = await db.transaction(async (tx) => {
      const account =
        body.accountId ??
        (
          await tx
            .select({ id: merchantPaymentAccounts.id })
            .from(merchantPaymentAccounts)
            .where(
              and(
                eq(merchantPaymentAccounts.merchantId, body.merchantId),
                eq(merchantPaymentAccounts.isDefault, true),
                eq(merchantPaymentAccounts.status, 'active'),
              ),
            )
            .limit(1)
        )[0]?.id ??
        null;

      const rows = await tx
        .select({
          id: payments.id,
          amount: payments.amount,
          feeAmount: payments.feeAmount,
          amountRefunded: payments.amountRefunded,
          currency: payments.currency,
        })
        .from(payments)
        .where(
          and(
            eq(payments.merchantId, body.merchantId),
            inArray(payments.status, [...PAYMENT_SETTLED_STATUSES]),
            gte(payments.paidAt, body.periodStart),
            lte(payments.paidAt, body.periodEnd),
            notInArray(
              payments.id,
              tx
                .select({ id: settlementItems.paymentId })
                .from(settlementItems),
            ),
          ),
        )
        .orderBy(asc(payments.paidAt));

      if (rows.length === 0) {
        throw ApiError.badRequest('Tidak ada pembayaran yang dapat disettlekan pada periode ini');
      }

      const grossAmount = rows.reduce((sum, row) => sum + Number(row.amount), 0);
      const feeAmount = rows.reduce((sum, row) => sum + Number(row.feeAmount), 0);
      const refundAmount = rows.reduce(
        (sum, row) => sum + Number(row.amountRefunded),
        0,
      );
      const netAmount = rows.reduce(
        (sum, row) =>
          sum + Math.max(0, Number(row.amount) - Number(row.feeAmount) - Number(row.amountRefunded)),
        0,
      );
      const currency = rows[0]?.currency ?? 'IDR';

      const [settlement] = await tx
        .insert(settlements)
        .values({
          settlementNumber: generateCode('STL'),
          merchantId: body.merchantId,
          accountId: account,
          status: 'draft',
          currency,
          periodStart: body.periodStart,
          periodEnd: body.periodEnd,
          grossAmount: money(grossAmount),
          feeAmount: money(feeAmount),
          refundAmount: money(refundAmount),
          netAmount: money(netAmount),
          paymentCount: rows.length,
          notes: body.notes ?? null,
          generatedBy: c.get('user').id,
        })
        .returning();
      if (!settlement) throw ApiError.internal('Gagal membuat settlement');

      await tx.insert(settlementItems).values(
        rows.map((row) => ({
          settlementId: settlement.id,
          paymentId: row.id,
          amount: row.amount,
          feeAmount: row.feeAmount,
          refundAmount: row.amountRefunded,
          netAmount: money(
            Math.max(0, Number(row.amount) - Number(row.feeAmount) - Number(row.amountRefunded)),
          ),
        })),
      );

      for (const row of rows) {
        await tx.insert(paymentEvents).values({
          paymentId: row.id,
          eventType: 'settlement',
          source: 'internal',
          note: `Masuk settlement ${settlement.settlementNumber}`,
          payload: { settlementId: settlement.id },
          createdBy: c.get('user').id,
        });
      }

      return settlement;
    });

    await writeAuditLog({
      actorUserId: c.get('user').id,
      action: 'settlement.create',
      entityType: 'settlement',
      entityId: result.id,
      newValues: result,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    });

    return ok(c, await getSettlementDetail(result.id), 201);
  },
);

paymentSettlementRoutes.patch(
  '/settlements/:settlementId/status',
  requirePermission('payment:write'),
  validate('json', updateSettlementSchema),
  async (c) => {
    const settlementId = c.req.param('settlementId');
    const body = c.req.valid('json');
    const settlement = await db.query.settlements.findFirst({
      where: eq(settlements.id, settlementId),
    });
    if (!settlement) throw ApiError.notFound('Settlement tidak ditemukan');
    await assertMerchantAccess(
      settlement.merchantId,
      c.get('user'),
      c.get('permissions'),
      { manage: true },
    );

    const allowed = SETTLEMENT_TRANSITIONS[settlement.status] ?? [];
    if (!allowed.includes(body.status)) {
      throw ApiError.badRequest(
        `Settlement tidak dapat berubah dari ${settlement.status} ke ${body.status}`,
      );
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(settlements)
        .where(eq(settlements.id, settlementId))
        .for('update');
      if (!locked) throw ApiError.notFound('Settlement tidak ditemukan');
      if (locked.status !== settlement.status) {
        throw ApiError.conflict('Status settlement telah berubah, silakan muat ulang data');
      }

      await tx
        .update(settlements)
        .set({
          status: body.status,
          processedAt: ['processing', 'completed'].includes(body.status)
            ? now
            : locked.processedAt,
          completedAt: body.status === 'completed' ? now : locked.completedAt,
          cancelledAt: body.status === 'cancelled' ? now : locked.cancelledAt,
          notes: body.note ?? locked.notes,
        })
        .where(eq(settlements.id, settlementId));

      if (body.status === 'cancelled') {
        await tx
          .delete(settlementItems)
          .where(eq(settlementItems.settlementId, settlementId));
      }
    });

    await writeAuditLog({
      actorUserId: c.get('user').id,
      action: 'settlement.status.update',
      entityType: 'settlement',
      entityId: settlementId,
      oldValues: { status: settlement.status },
      newValues: { status: body.status, note: body.note ?? null },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    });

    return ok(c, await getSettlementDetail(settlementId));
  },
);
