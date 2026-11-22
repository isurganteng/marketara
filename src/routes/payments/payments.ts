import {
  and,
  asc,
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
  orders,
  paymentAttempts,
  paymentEvents,
  paymentMethods,
  paymentProviders,
  payments,
  users,
  merchants,
} from '../../db/schema';
import { assertOrderAccess } from '../../lib/access';
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
  assertPaymentAccess,
  computeFee,
  getPaymentDetail,
  paymentScopeCondition,
} from './shared';

const paymentStatusSchema = z.enum([
  'pending',
  'authorized',
  'paid',
  'failed',
  'expired',
  'cancelled',
  'partially_refunded',
  'refunded',
]);

const listPaymentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: paymentStatusSchema.optional(),
  orderId: z.uuid().optional(),
  merchantId: z.uuid().optional(),
  userId: z.uuid().optional(),
  providerId: z.uuid().optional(),
  methodId: z.uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const createPaymentSchema = z.object({
  methodId: z.uuid(),
  amount: numericString.optional(),
  expiresInMinutes: z.coerce.number().int().min(5).max(1440).default(60),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const retryPaymentSchema = z.object({
  methodId: z.uuid().optional(),
  expiresInMinutes: z.coerce.number().int().min(5).max(1440).default(60),
});

const confirmPaymentSchema = z.object({
  status: z.enum(['succeeded', 'failed', 'expired']),
  externalReference: z.string().trim().max(128).optional(),
  note: z.string().trim().max(2000).optional(),
  failureCode: z.string().trim().max(64).optional(),
  failureMessage: z.string().trim().max(2000).optional(),
});

const cancelPaymentSchema = z.object({
  note: z.string().trim().max(2000).optional(),
});

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function latestAttemptNumber(attempts: Array<{ attemptNumber: number }>): number {
  return attempts[0]?.attemptNumber ?? 0;
}

export const paymentRoutes = new Hono<AppEnv>();

paymentRoutes.get(
  '/',
  requirePermission('payment:read'),
  validate('query', listPaymentsSchema),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = paymentScopeCondition(c.get('user'), c.get('permissions'));
    if (scope) conditions.push(scope);
    if (query.status) conditions.push(eq(payments.status, query.status));
    if (query.orderId) conditions.push(eq(payments.orderId, query.orderId));
    if (query.merchantId) conditions.push(eq(payments.merchantId, query.merchantId));
    if (query.userId) conditions.push(eq(payments.userId, query.userId));
    if (query.providerId) conditions.push(eq(payments.providerId, query.providerId));
    if (query.methodId) conditions.push(eq(payments.methodId, query.methodId));
    if (query.from) conditions.push(gte(payments.createdAt, query.from));
    if (query.to) conditions.push(lte(payments.createdAt, query.to));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(payments.paymentNumber, term),
          ilike(payments.externalReference, term),
          ilike(orders.orderNumber, term),
          ilike(merchants.businessName, term),
          ilike(users.fullName, term),
        ) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;

    const baseQuery = db
      .select({
        id: payments.id,
        paymentNumber: payments.paymentNumber,
        orderId: payments.orderId,
        orderNumber: orders.orderNumber,
        orderStatus: orders.status,
        merchantId: payments.merchantId,
        merchantName: merchants.businessName,
        userId: payments.userId,
        customerName: users.fullName,
        customerEmail: users.email,
        methodId: payments.methodId,
        methodName: paymentMethods.name,
        methodType: paymentMethods.type,
        providerId: payments.providerId,
        providerName: paymentProviders.name,
        status: payments.status,
        currency: payments.currency,
        amount: payments.amount,
        feeAmount: payments.feeAmount,
        netAmount: payments.netAmount,
        amountPaid: payments.amountPaid,
        amountRefunded: payments.amountRefunded,
        externalReference: payments.externalReference,
        expiresAt: payments.expiresAt,
        paidAt: payments.paidAt,
        failureReason: payments.failureReason,
        createdAt: payments.createdAt,
        updatedAt: payments.updatedAt,
      })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .innerJoin(merchants, eq(merchants.id, payments.merchantId))
      .innerJoin(users, eq(users.id, payments.userId))
      .leftJoin(paymentMethods, eq(paymentMethods.id, payments.methodId))
      .leftJoin(paymentProviders, eq(paymentProviders.id, payments.providerId))
      .where(where)
      .orderBy(desc(payments.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset);

    const countQuery = db
      .select({ value: count() })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .innerJoin(merchants, eq(merchants.id, payments.merchantId))
      .innerJoin(users, eq(users.id, payments.userId))
      .where(where);

    const [rows, [totalRow]] = await Promise.all([baseQuery, countQuery]);
    return paginated(c, rows, Number(totalRow?.value ?? 0), pagination);
  },
);

paymentRoutes.post(
  '/orders/:orderId',
  requirePermission('payment:write'),
  validate('json', createPaymentSchema),
  async (c) => {
    const orderId = c.req.param('orderId');
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const access = await assertOrderAccess(orderId, user, permissions);

    if (['cancelled', 'returned'].includes(access.order.status)) {
      throw ApiError.badRequest('Pesanan yang dibatalkan atau dikembalikan tidak dapat dibayar');
    }

    const method = await db.query.paymentMethods.findFirst({
      where: eq(paymentMethods.id, body.methodId),
    });
    if (!method) throw ApiError.notFound('Metode pembayaran tidak ditemukan');
    if (method.status !== 'active') throw ApiError.badRequest('Metode pembayaran tidak aktif');

    const provider = method.providerId
      ? await db.query.paymentProviders.findFirst({
          where: eq(paymentProviders.id, method.providerId),
        })
      : null;
    if (!provider || provider.status !== 'active') {
      throw ApiError.badRequest('Provider pembayaran tidak aktif');
    }

    const amount = Number(body.amount ?? access.order.grandTotal);
    const orderTotal = Number(access.order.grandTotal);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw ApiError.badRequest('Nominal pembayaran tidak valid');
    }
    if (Math.abs(amount - orderTotal) > 0.01) {
      throw ApiError.badRequest('Nominal pembayaran harus sama dengan total pesanan');
    }
    if (amount < Number(method.minimumAmount)) {
      throw ApiError.badRequest('Nominal pembayaran di bawah minimum metode');
    }
    if (method.maximumAmount && amount > Number(method.maximumAmount)) {
      throw ApiError.badRequest('Nominal pembayaran melebihi maksimum metode');
    }

    const feeAmount = computeFee(method, amount);
    const netAmount = money(amount - Number(feeAmount));
    const now = new Date();
    const expiresAt = addMinutes(now, body.expiresInMinutes);

    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(payments)
        .where(eq(payments.orderId, orderId))
        .for('update');

      if (existing && ['paid', 'partially_refunded', 'refunded'].includes(existing.status)) {
        throw ApiError.conflict('Pesanan sudah memiliki pembayaran yang lunas');
      }

      if (existing && ['pending', 'authorized'].includes(existing.status)) {
        return { paymentId: existing.id, created: false };
      }

      const paymentNumber = existing?.paymentNumber ?? generateCode('PAY');
      let paymentId = existing?.id;

      if (existing) {
        await tx
          .update(payments)
          .set({
            status: 'pending',
            providerId: provider.id,
            methodId: method.id,
            amount: money(amount),
            feeAmount,
            netAmount,
            amountPaid: '0',
            amountRefunded: '0',
            externalReference: null,
            checkoutUrl: null,
            expiresAt,
            paidAt: null,
            failedAt: null,
            cancelledAt: null,
            expiredAt: null,
            failureReason: null,
            metadata: body.metadata ?? null,
          })
          .where(eq(payments.id, existing.id));
      } else {
        const [created] = await tx
          .insert(payments)
          .values({
            paymentNumber,
            orderId,
            merchantId: access.order.merchantId,
            userId: access.order.userId,
            providerId: provider.id,
            methodId: method.id,
            status: 'pending',
            currency: access.order.currency,
            amount: money(amount),
            feeAmount,
            netAmount,
            amountPaid: '0',
            amountRefunded: '0',
            expiresAt,
            metadata: body.metadata ?? null,
            createdBy: user.id,
          })
          .returning();
        if (!created) throw ApiError.internal('Gagal membuat pembayaran');
        paymentId = created.id;
      }
      if (!paymentId) throw ApiError.internal('Gagal membuat pembayaran');

      const attempts = await tx
        .select({ attemptNumber: paymentAttempts.attemptNumber })
        .from(paymentAttempts)
        .where(eq(paymentAttempts.paymentId, paymentId))
        .orderBy(desc(paymentAttempts.attemptNumber))
        .limit(1);
      const attemptNumber = latestAttemptNumber(attempts) + 1;
      const externalReference = `SIM-${paymentNumber}-${attemptNumber}`;

      const [attempt] = await tx
        .insert(paymentAttempts)
        .values({
          paymentId,
          attemptNumber,
          status: 'pending',
          providerReference: externalReference,
          requestPayload: {
            provider: provider.code,
            method: method.code,
            amount: money(amount),
            orderNumber: access.order.orderNumber,
          },
          expiresAt,
        })
        .returning();

      await tx.insert(paymentEvents).values({
        paymentId,
        attemptId: attempt?.id ?? null,
        eventType: 'created',
        source: 'internal',
        externalReference,
        note: existing ? 'Percobaan pembayaran baru dibuat' : 'Pembayaran dibuat',
        createdBy: user.id,
      });

      return { paymentId, created: !existing };
    });

    await writeAuditLog({
      actorUserId: user.id,
      action: result.created ? 'payment.create' : 'payment.retry',
      entityType: 'payment',
      entityId: result.paymentId,
      newValues: { orderId, amount, methodId: method.id, providerId: provider.id },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    });

    const detail = await getPaymentDetail(result.paymentId);
    return ok(c, detail, result.created ? 201 : 200);
  },
);

paymentRoutes.get(
  '/:paymentId',
  requirePermission('payment:read'),
  async (c) => {
    const paymentId = c.req.param('paymentId');
    await assertPaymentAccess(paymentId, c.get('user'), c.get('permissions'));
    return ok(c, await getPaymentDetail(paymentId));
  },
);

paymentRoutes.post(
  '/:paymentId/retry',
  requirePermission('payment:write'),
  validate('json', retryPaymentSchema),
  async (c) => {
    const paymentId = c.req.param('paymentId');
    const body = c.req.valid('json');
    const access = await assertPaymentAccess(paymentId, c.get('user'), c.get('permissions'));

    if (['paid', 'partially_refunded', 'refunded'].includes(access.payment.status)) {
      throw ApiError.conflict('Pembayaran yang sudah lunas tidak dapat diulang');
    }

    const method = body.methodId
      ? await db.query.paymentMethods.findFirst({
          where: eq(paymentMethods.id, body.methodId),
        })
      : access.payment.methodId
        ? await db.query.paymentMethods.findFirst({
            where: eq(paymentMethods.id, access.payment.methodId),
          })
        : null;
    if (!method) throw ApiError.notFound('Metode pembayaran tidak ditemukan');
    if (method.status !== 'active') throw ApiError.badRequest('Metode pembayaran tidak aktif');

    const provider = method.providerId
      ? await db.query.paymentProviders.findFirst({
          where: eq(paymentProviders.id, method.providerId),
        })
      : null;
    if (!provider || provider.status !== 'active') {
      throw ApiError.badRequest('Provider pembayaran tidak aktif');
    }

    const amount = Number(access.payment.amount);
    const feeAmount = computeFee(method, amount);
    const netAmount = money(amount - Number(feeAmount));
    const expiresAt = addMinutes(new Date(), body.expiresInMinutes);

    const attemptId = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(payments)
        .where(eq(payments.id, paymentId))
        .for('update');
      if (!locked) throw ApiError.notFound('Pembayaran tidak ditemukan');
      if (['paid', 'partially_refunded', 'refunded'].includes(locked.status)) {
        throw ApiError.conflict('Pembayaran yang sudah lunas tidak dapat diulang');
      }

      await tx
        .update(payments)
        .set({
          status: 'pending',
          providerId: provider.id,
          methodId: method.id,
          feeAmount,
          netAmount,
          amountPaid: '0',
          expiresAt,
          failedAt: null,
          cancelledAt: null,
          expiredAt: null,
          failureReason: null,
          externalReference: null,
          checkoutUrl: null,
        })
        .where(eq(payments.id, paymentId));

      const attempts = await tx
        .select({ attemptNumber: paymentAttempts.attemptNumber })
        .from(paymentAttempts)
        .where(eq(paymentAttempts.paymentId, paymentId))
        .orderBy(desc(paymentAttempts.attemptNumber))
        .limit(1);
      const attemptNumber = latestAttemptNumber(attempts) + 1;
      const providerReference = `SIM-${locked.paymentNumber}-${attemptNumber}`;

      const [attempt] = await tx
        .insert(paymentAttempts)
        .values({
          paymentId,
          attemptNumber,
          status: 'pending',
          providerReference,
          requestPayload: {
            provider: provider.code,
            method: method.code,
            amount: money(amount),
          },
          expiresAt,
        })
        .returning();

      await tx.insert(paymentEvents).values({
        paymentId,
        attemptId: attempt?.id ?? null,
        eventType: 'created',
        source: 'retry',
        externalReference: providerReference,
        note: 'Percobaan pembayaran diulang',
        createdBy: c.get('user').id,
      });

      return attempt?.id ?? null;
    });

    await writeAuditLog({
      actorUserId: c.get('user').id,
      action: 'payment.retry',
      entityType: 'payment',
      entityId: paymentId,
      newValues: { methodId: method.id, attemptId },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    });

    return ok(c, await getPaymentDetail(paymentId), 201);
  },
);

paymentRoutes.post(
  '/:paymentId/confirm',
  requirePermission('payment:write'),
  validate('json', confirmPaymentSchema),
  async (c) => {
    const paymentId = c.req.param('paymentId');
    const body = c.req.valid('json');
    const access = await assertPaymentAccess(paymentId, c.get('user'), c.get('permissions'));

    if (body.status === 'succeeded' && access.payment.status === 'paid') {
      return ok(c, await getPaymentDetail(paymentId));
    }
    if (
      ['paid', 'partially_refunded', 'refunded', 'cancelled'].includes(
        access.payment.status,
      )
    ) {
      throw ApiError.conflict('Status pembayaran tidak dapat dikonfirmasi');
    }

    await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(payments)
        .where(eq(payments.id, paymentId))
        .for('update');
      if (!locked) throw ApiError.notFound('Pembayaran tidak ditemukan');

      const [attempt] = await tx
        .select()
        .from(paymentAttempts)
        .where(
          and(
            eq(paymentAttempts.paymentId, paymentId),
            inArray(paymentAttempts.status, ['created', 'pending']),
          ),
        )
        .orderBy(desc(paymentAttempts.attemptNumber))
        .limit(1);
      if (!attempt) throw ApiError.conflict('Tidak ada percobaan pembayaran aktif');

      const now = new Date();
      const externalReference =
        body.externalReference ?? attempt.providerReference ?? `SIM-${locked.paymentNumber}`;

      if (body.status === 'succeeded') {
        await tx
          .update(paymentAttempts)
          .set({
            status: 'succeeded',
            processedAt: now,
            responsePayload: {
              status: 'succeeded',
              externalReference,
              confirmedAt: now.toISOString(),
            },
          })
          .where(eq(paymentAttempts.id, attempt.id));
        await tx
          .update(payments)
          .set({
            status: 'paid',
            amountPaid: locked.amount,
            paidAt: now,
            externalReference,
            failureReason: null,
          })
          .where(eq(payments.id, paymentId));
        await tx.insert(paymentEvents).values({
          paymentId,
          attemptId: attempt.id,
          eventType: 'paid',
          source: 'simulator',
          externalReference,
          note: body.note ?? 'Pembayaran dikonfirmasi lunas',
          payload: { status: 'succeeded' },
          createdBy: c.get('user').id,
        });
      } else if (body.status === 'failed') {
        await tx
          .update(paymentAttempts)
          .set({
            status: 'failed',
            processedAt: now,
            failureCode: body.failureCode ?? 'SIMULATED_FAILURE',
            failureMessage: body.failureMessage ?? body.note ?? 'Pembayaran gagal',
            responsePayload: {
              status: 'failed',
              failureCode: body.failureCode ?? 'SIMULATED_FAILURE',
            },
          })
          .where(eq(paymentAttempts.id, attempt.id));
        await tx
          .update(payments)
          .set({
            status: 'failed',
            failedAt: now,
            failureReason: body.failureMessage ?? body.note ?? 'Pembayaran gagal',
            externalReference,
          })
          .where(eq(payments.id, paymentId));
        await tx.insert(paymentEvents).values({
          paymentId,
          attemptId: attempt.id,
          eventType: 'failed',
          source: 'simulator',
          externalReference,
          note: body.failureMessage ?? body.note ?? 'Pembayaran gagal',
          payload: { status: 'failed' },
          createdBy: c.get('user').id,
        });
      } else {
        await tx
          .update(paymentAttempts)
          .set({
            status: 'expired',
            processedAt: now,
            responsePayload: { status: 'expired' },
          })
          .where(eq(paymentAttempts.id, attempt.id));
        await tx
          .update(payments)
          .set({
            status: 'expired',
            expiredAt: now,
            failureReason: body.note ?? 'Pembayaran kedaluwarsa',
          })
          .where(eq(payments.id, paymentId));
        await tx.insert(paymentEvents).values({
          paymentId,
          attemptId: attempt.id,
          eventType: 'expired',
          source: 'simulator',
          externalReference,
          note: body.note ?? 'Pembayaran kedaluwarsa',
          payload: { status: 'expired' },
          createdBy: c.get('user').id,
        });
      }
    });

    await writeAuditLog({
      actorUserId: c.get('user').id,
      action: 'payment.confirm',
      entityType: 'payment',
      entityId: paymentId,
      newValues: { status: body.status, externalReference: body.externalReference ?? null },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    });

    return ok(c, await getPaymentDetail(paymentId));
  },
);

paymentRoutes.post(
  '/:paymentId/cancel',
  requirePermission('payment:write'),
  validate('json', cancelPaymentSchema),
  async (c) => {
    const paymentId = c.req.param('paymentId');
    const body = c.req.valid('json');
    const access = await assertPaymentAccess(paymentId, c.get('user'), c.get('permissions'));

    if (!['pending', 'authorized'].includes(access.payment.status)) {
      throw ApiError.conflict('Hanya pembayaran yang belum lunas dapat dibatalkan');
    }

    await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(payments)
        .where(eq(payments.id, paymentId))
        .for('update');
      if (!locked) throw ApiError.notFound('Pembayaran tidak ditemukan');
      if (!['pending', 'authorized'].includes(locked.status)) {
        throw ApiError.conflict('Hanya pembayaran yang belum lunas dapat dibatalkan');
      }

      const now = new Date();
      await tx
        .update(paymentAttempts)
        .set({ status: 'cancelled', processedAt: now })
        .where(
          and(
            eq(paymentAttempts.paymentId, paymentId),
            inArray(paymentAttempts.status, ['created', 'pending']),
          ),
        );
      await tx
        .update(payments)
        .set({ status: 'cancelled', cancelledAt: now, failureReason: body.note ?? null })
        .where(eq(payments.id, paymentId));
      await tx.insert(paymentEvents).values({
        paymentId,
        eventType: 'cancelled',
        source: 'internal',
        note: body.note ?? 'Pembayaran dibatalkan',
        createdBy: c.get('user').id,
      });
    });

    await writeAuditLog({
      actorUserId: c.get('user').id,
      action: 'payment.cancel',
      entityType: 'payment',
      entityId: paymentId,
      newValues: { note: body.note ?? null },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    });

    return ok(c, await getPaymentDetail(paymentId));
  },
);
