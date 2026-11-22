import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  type SQL,
} from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  merchants,
  orders,
  paymentEvents,
  payments,
  refunds,
  returns,
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
import { money, numericString } from '../commerce/shared';
import {
  ACTIVE_REFUND_STATUSES,
  assertPaymentAccess,
  paymentScopeCondition,
} from './shared';

const refundStatusSchema = z.enum([
  'requested',
  'approved',
  'processing',
  'completed',
  'rejected',
  'cancelled',
  'failed',
]);

const REFUND_TRANSITIONS: Record<string, string[]> = {
  requested: ['approved', 'rejected', 'cancelled'],
  approved: ['processing', 'cancelled'],
  processing: ['completed', 'failed'],
  failed: ['processing', 'cancelled'],
  completed: [],
  rejected: [],
  cancelled: [],
};

const listRefundsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: refundStatusSchema.optional(),
  paymentId: z.uuid().optional(),
  orderId: z.uuid().optional(),
  merchantId: z.uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const createRefundSchema = z.object({
  amount: numericString,
  reason: z.string().trim().min(3).max(2000),
  returnId: z.uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const updateRefundSchema = z.object({
  status: refundStatusSchema,
  note: z.string().trim().max(2000).optional(),
  externalReference: z.string().trim().max(128).optional(),
});

async function getRefundDetail(refundId: string) {
  const rows = await db
    .select({
      id: refunds.id,
      refundNumber: refunds.refundNumber,
      status: refunds.status,
      amount: refunds.amount,
      reason: refunds.reason,
      externalReference: refunds.externalReference,
      failureReason: refunds.failureReason,
      requestedAt: refunds.requestedAt,
      approvedAt: refunds.approvedAt,
      processedAt: refunds.processedAt,
      completedAt: refunds.completedAt,
      rejectedAt: refunds.rejectedAt,
      cancelledAt: refunds.cancelledAt,
      metadata: refunds.metadata,
      createdAt: refunds.createdAt,
      updatedAt: refunds.updatedAt,
      paymentId: refunds.paymentId,
      paymentNumber: payments.paymentNumber,
      paymentStatus: payments.status,
      paymentAmount: payments.amount,
      paymentRefunded: payments.amountRefunded,
      orderId: refunds.orderId,
      orderNumber: orders.orderNumber,
      orderStatus: orders.status,
      merchantId: refunds.merchantId,
      merchantName: merchants.businessName,
      userId: refunds.userId,
      customerName: users.fullName,
      returnId: refunds.returnId,
      returnNumber: returns.returnNumber,
      returnStatus: returns.status,
      currency: payments.currency,
    })
    .from(refunds)
    .innerJoin(payments, eq(payments.id, refunds.paymentId))
    .innerJoin(orders, eq(orders.id, refunds.orderId))
    .innerJoin(merchants, eq(merchants.id, refunds.merchantId))
    .innerJoin(users, eq(users.id, refunds.userId))
    .leftJoin(returns, eq(returns.id, refunds.returnId))
    .where(eq(refunds.id, refundId))
    .limit(1);

  const row = rows[0];
  if (!row) throw ApiError.notFound('Refund tidak ditemukan');
  return row;
}

async function assertRefundAccess(
  refundId: string,
  user: AppEnv['Variables']['user'],
  permissions: Set<string>,
) {
  const refund = await db.query.refunds.findFirst({ where: eq(refunds.id, refundId) });
  if (!refund) throw ApiError.notFound('Refund tidak ditemukan');
  const access = await assertPaymentAccess(refund.paymentId, user, permissions);
  return { refund, access };
}

export const paymentRefundRoutes = new Hono<AppEnv>();

paymentRefundRoutes.get(
  '/refunds',
  requirePermission('payment:read'),
  validate('query', listRefundsSchema),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = paymentScopeCondition(c.get('user'), c.get('permissions'));
    if (scope) conditions.push(scope);
    if (query.status) conditions.push(eq(refunds.status, query.status));
    if (query.paymentId) conditions.push(eq(refunds.paymentId, query.paymentId));
    if (query.orderId) conditions.push(eq(refunds.orderId, query.orderId));
    if (query.merchantId) conditions.push(eq(refunds.merchantId, query.merchantId));
    if (query.from) conditions.push(gte(refunds.requestedAt, query.from));
    if (query.to) conditions.push(lte(refunds.requestedAt, query.to));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(refunds.refundNumber, term),
          ilike(refunds.reason, term),
          ilike(payments.paymentNumber, term),
          ilike(orders.orderNumber, term),
          ilike(merchants.businessName, term),
          ilike(users.fullName, term),
        ) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: refunds.id,
          refundNumber: refunds.refundNumber,
          status: refunds.status,
          amount: refunds.amount,
          reason: refunds.reason,
          requestedAt: refunds.requestedAt,
          completedAt: refunds.completedAt,
          paymentId: refunds.paymentId,
          paymentNumber: payments.paymentNumber,
          orderId: refunds.orderId,
          orderNumber: orders.orderNumber,
          merchantId: refunds.merchantId,
          merchantName: merchants.businessName,
          userId: refunds.userId,
          customerName: users.fullName,
          returnId: refunds.returnId,
          returnNumber: returns.returnNumber,
          currency: payments.currency,
        })
        .from(refunds)
        .innerJoin(payments, eq(payments.id, refunds.paymentId))
        .innerJoin(orders, eq(orders.id, refunds.orderId))
        .innerJoin(merchants, eq(merchants.id, refunds.merchantId))
        .innerJoin(users, eq(users.id, refunds.userId))
        .leftJoin(returns, eq(returns.id, refunds.returnId))
        .where(where)
        .orderBy(desc(refunds.requestedAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ value: count() })
        .from(refunds)
        .innerJoin(payments, eq(payments.id, refunds.paymentId))
        .innerJoin(orders, eq(orders.id, refunds.orderId))
        .innerJoin(merchants, eq(merchants.id, refunds.merchantId))
        .innerJoin(users, eq(users.id, refunds.userId))
        .where(where),
    ]);

    return paginated(c, rows, Number(totalRow?.value ?? 0), pagination);
  },
);

paymentRefundRoutes.get(
  '/refunds/:refundId',
  requirePermission('payment:read'),
  async (c) => {
    const refundId = c.req.param('refundId');
    await assertRefundAccess(refundId, c.get('user'), c.get('permissions'));
    return ok(c, await getRefundDetail(refundId));
  },
);

paymentRefundRoutes.post(
  '/:paymentId/refunds',
  requirePermission('payment:write'),
  validate('json', createRefundSchema),
  async (c) => {
    const paymentId = c.req.param('paymentId');
    const body = c.req.valid('json');
    const amount = Number(body.amount);
    const access = await assertPaymentAccess(
      paymentId,
      c.get('user'),
      c.get('permissions'),
    );

    if (!['paid', 'partially_refunded'].includes(access.payment.status)) {
      throw ApiError.badRequest('Hanya pembayaran lunas yang dapat direfund');
    }
    if (access.via === 'customer') {
      throw ApiError.forbidden('Customer tidak dapat membuat refund');
    }

    if (body.returnId) {
      const ret = await db.query.returns.findFirst({
        where: eq(returns.id, body.returnId),
      });
      if (!ret || ret.orderId !== access.payment.orderId) {
        throw ApiError.badRequest('Retur tidak terkait dengan pesanan pembayaran');
      }
      if (ret.status !== 'completed') {
        throw ApiError.badRequest('Refund hanya dapat dibuat untuk retur yang selesai');
      }
    }

    const result = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(payments)
        .where(eq(payments.id, paymentId))
        .for('update');
      if (!locked) throw ApiError.notFound('Pembayaran tidak ditemukan');
      if (!['paid', 'partially_refunded'].includes(locked.status)) {
        throw ApiError.badRequest('Hanya pembayaran lunas yang dapat direfund');
      }

      const activeRefunds = await tx
        .select({ amount: refunds.amount })
        .from(refunds)
        .where(
          and(
            eq(refunds.paymentId, paymentId),
            inArray(refunds.status, [...ACTIVE_REFUND_STATUSES]),
          ),
        );
      const committed = activeRefunds.reduce(
        (sum, row) => sum + Number(row.amount),
        0,
      );
      const remaining = Number(locked.amount) - Number(locked.amountRefunded) - committed;
      if (!Number.isFinite(amount) || amount <= 0) {
        throw ApiError.badRequest('Nominal refund tidak valid');
      }
      if (amount > remaining + 0.009) {
        throw ApiError.badRequest(
          `Nominal refund melebihi sisa yang dapat direfund (${money(remaining)})`,
        );
      }

      const [refund] = await tx
        .insert(refunds)
        .values({
          refundNumber: generateCode('RFD'),
          paymentId,
          orderId: locked.orderId,
          returnId: body.returnId ?? null,
          merchantId: locked.merchantId,
          userId: locked.userId,
          status: 'requested',
          amount: money(amount),
          reason: body.reason,
          metadata: body.metadata ?? null,
          requestedBy: c.get('user').id,
        })
        .returning();
      if (!refund) throw ApiError.internal('Gagal membuat refund');

      await tx.insert(paymentEvents).values({
        paymentId,
        eventType: 'refund',
        source: 'internal',
        note: `Refund ${refund.refundNumber} diajukan`,
        payload: { refundId: refund.id, amount: money(amount) },
        createdBy: c.get('user').id,
      });

      return refund;
    });

    await writeAuditLog({
      actorUserId: c.get('user').id,
      action: 'refund.create',
      entityType: 'refund',
      entityId: result.id,
      newValues: result,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    });

    return ok(c, await getRefundDetail(result.id), 201);
  },
);

paymentRefundRoutes.patch(
  '/refunds/:refundId/status',
  requirePermission('payment:write'),
  validate('json', updateRefundSchema),
  async (c) => {
    const refundId = c.req.param('refundId');
    const body = c.req.valid('json');
    const { refund, access } = await assertRefundAccess(
      refundId,
      c.get('user'),
      c.get('permissions'),
    );

    if (access.via === 'customer') {
      if (body.status !== 'cancelled') {
        throw ApiError.forbidden('Customer hanya dapat membatalkan refund');
      }
      if (refund.status !== 'requested') {
        throw ApiError.forbidden('Customer hanya dapat membatalkan refund yang diajukan');
      }
    }

    const allowed = REFUND_TRANSITIONS[refund.status] ?? [];
    if (!allowed.includes(body.status)) {
      throw ApiError.badRequest(
        `Refund tidak dapat berubah dari ${refund.status} ke ${body.status}`,
      );
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      const [lockedRefund] = await tx
        .select()
        .from(refunds)
        .where(eq(refunds.id, refundId))
        .for('update');
      if (!lockedRefund) throw ApiError.notFound('Refund tidak ditemukan');
      if (lockedRefund.status !== refund.status) {
        throw ApiError.conflict('Status refund telah berubah, silakan muat ulang data');
      }

      const timestamps: Partial<Record<string, Date>> = {};
      if (body.status === 'approved') timestamps.approvedAt = now;
      if (body.status === 'processing') timestamps.processedAt = now;
      if (body.status === 'completed') timestamps.completedAt = now;
      if (body.status === 'rejected') timestamps.rejectedAt = now;
      if (body.status === 'cancelled') timestamps.cancelledAt = now;

      if (body.status === 'completed') {
        const [lockedPayment] = await tx
          .select()
          .from(payments)
          .where(eq(payments.id, lockedRefund.paymentId))
          .for('update');
        if (!lockedPayment) throw ApiError.notFound('Pembayaran tidak ditemukan');
        const refunded = Number(lockedPayment.amountRefunded) + Number(lockedRefund.amount);
        if (refunded > Number(lockedPayment.amount) + 0.009) {
          throw ApiError.badRequest('Total refund melebihi nominal pembayaran');
        }
        const paymentStatus = refunded >= Number(lockedPayment.amount) - 0.009
          ? 'refunded'
          : 'partially_refunded';
        await tx
          .update(payments)
          .set({ amountRefunded: money(refunded), status: paymentStatus })
          .where(eq(payments.id, lockedPayment.id));
        await tx.insert(paymentEvents).values({
          paymentId: lockedPayment.id,
          eventType: 'refund',
          source: 'internal',
          externalReference: body.externalReference ?? lockedRefund.externalReference ?? null,
          note: body.note ?? `Refund ${lockedRefund.refundNumber} selesai`,
          payload: {
            refundId: lockedRefund.id,
            amount: lockedRefund.amount,
            totalRefunded: money(refunded),
          },
          createdBy: c.get('user').id,
        });
      }

      await tx
        .update(refunds)
        .set({
          status: body.status,
          externalReference: body.externalReference ?? lockedRefund.externalReference,
          failureReason: body.status === 'failed' ? (body.note ?? 'Refund gagal') : null,
          reviewedBy: ['approved', 'rejected'].includes(body.status)
            ? c.get('user').id
            : lockedRefund.reviewedBy,
          processedBy: ['processing', 'completed', 'failed'].includes(body.status)
            ? c.get('user').id
            : lockedRefund.processedBy,
          ...timestamps,
        })
        .where(eq(refunds.id, refundId));
    });

    await writeAuditLog({
      actorUserId: c.get('user').id,
      action: 'refund.status.update',
      entityType: 'refund',
      entityId: refundId,
      oldValues: { status: refund.status },
      newValues: { status: body.status, note: body.note ?? null },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    });

    return ok(c, await getRefundDetail(refundId));
  },
);
