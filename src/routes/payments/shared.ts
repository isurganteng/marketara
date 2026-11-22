import { and, desc, eq, inArray, isNull, or, type SQL } from 'drizzle-orm';
import { db } from '../../db';
import {
  merchants,
  orders,
  paymentAttempts,
  paymentEvents,
  paymentMethods,
  paymentProviders,
  payments,
  refunds,
  users,
} from '../../db/schema';
import { assertMerchantAccess, isPlatformAdmin, merchantScopeCondition } from '../../lib/access';
import { ApiError } from '../../lib/errors';
import type { AuthUser } from '../../types';
import { money } from '../commerce/shared';

export const PAYMENT_SETTLED_STATUSES = [
  'paid',
  'partially_refunded',
  'refunded',
] as const;

export const ACTIVE_REFUND_STATUSES = [
  'requested',
  'approved',
  'processing',
] as const;

export function paymentScopeCondition(
  user: AuthUser,
  permissions: Set<string>,
): SQL | undefined {
  if (isPlatformAdmin(permissions)) return undefined;

  const merchantCondition = merchantScopeCondition(user, permissions);
  const merchantIds = merchantCondition
    ? db
        .select({ id: merchants.id })
        .from(merchants)
        .where(and(merchantCondition, isNull(merchants.deletedAt)))
    : undefined;

  return or(
    eq(payments.userId, user.id),
    merchantIds ? inArray(payments.merchantId, merchantIds) : undefined,
  );
}

export function merchantIdScopeCondition(
  user: AuthUser,
  permissions: Set<string>,
): SQL | undefined {
  const condition = merchantScopeCondition(user, permissions);
  if (!condition) return undefined;
  return inArray(
    merchants.id,
    db
      .select({ id: merchants.id })
      .from(merchants)
      .where(and(condition, isNull(merchants.deletedAt))),
  );
}

export async function assertPaymentAccess(
  paymentId: string,
  user: AuthUser,
  permissions: Set<string>,
) {
  const payment = await db.query.payments.findFirst({
    where: eq(payments.id, paymentId),
  });
  if (!payment) throw ApiError.notFound('Payment not found');

  if (isPlatformAdmin(permissions)) {
    return { payment, via: 'admin' as const, role: 'admin' };
  }

  if (payment.userId === user.id) {
    return { payment, via: 'customer' as const, role: 'customer' };
  }

  const access = await assertMerchantAccess(payment.merchantId, user, permissions);
  return { payment, via: access.via, role: access.role };
}

export function computeFee(
  method: { feeFlat?: string | null; feePercent?: string | null },
  amount: number,
): string {
  const flat = Number(method.feeFlat ?? 0);
  const percent = Number(method.feePercent ?? 0);
  return money(Math.max(0, flat + (amount * percent) / 100));
}

export async function getPaymentDetail(paymentId: string) {
  const rows = await db
    .select({
      id: payments.id,
      paymentNumber: payments.paymentNumber,
      status: payments.status,
      currency: payments.currency,
      amount: payments.amount,
      feeAmount: payments.feeAmount,
      netAmount: payments.netAmount,
      amountPaid: payments.amountPaid,
      amountRefunded: payments.amountRefunded,
      externalReference: payments.externalReference,
      checkoutUrl: payments.checkoutUrl,
      expiresAt: payments.expiresAt,
      paidAt: payments.paidAt,
      failedAt: payments.failedAt,
      cancelledAt: payments.cancelledAt,
      expiredAt: payments.expiredAt,
      failureReason: payments.failureReason,
      metadata: payments.metadata,
      createdAt: payments.createdAt,
      updatedAt: payments.updatedAt,
      orderId: payments.orderId,
      merchantId: payments.merchantId,
      merchantName: merchants.businessName,
      merchantCode: merchants.code,
      userId: payments.userId,
      customerName: users.fullName,
      customerEmail: users.email,
      customerPhone: users.phone,
      methodId: payments.methodId,
      methodCode: paymentMethods.code,
      methodName: paymentMethods.name,
      methodType: paymentMethods.type,
      methodStatus: paymentMethods.status,
      providerId: payments.providerId,
      providerCode: paymentProviders.code,
      providerName: paymentProviders.name,
      providerType: paymentProviders.type,
      providerStatus: paymentProviders.status,
    })
    .from(payments)
    .innerJoin(merchants, eq(merchants.id, payments.merchantId))
    .innerJoin(users, eq(users.id, payments.userId))
    .leftJoin(paymentMethods, eq(paymentMethods.id, payments.methodId))
    .leftJoin(paymentProviders, eq(paymentProviders.id, payments.providerId))
    .where(eq(payments.id, paymentId))
    .limit(1);

  const row = rows[0];
  if (!row) throw ApiError.notFound('Payment not found');

  const [attempts, events, refundRows, orderRows] = await Promise.all([
    db
      .select()
      .from(paymentAttempts)
      .where(eq(paymentAttempts.paymentId, paymentId))
      .orderBy(desc(paymentAttempts.attemptNumber)),
    db
      .select()
      .from(paymentEvents)
      .where(eq(paymentEvents.paymentId, paymentId))
      .orderBy(desc(paymentEvents.createdAt)),
    db
      .select()
      .from(refunds)
      .where(eq(refunds.paymentId, paymentId))
      .orderBy(desc(refunds.requestedAt)),
    db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        grandTotal: orders.grandTotal,
        currency: orders.currency,
        contactName: orders.contactName,
        contactPhone: orders.contactPhone,
        contactEmail: orders.contactEmail,
      })
      .from(orders)
      .where(eq(orders.id, row.orderId))
      .limit(1),
  ]);

  const order = orderRows[0];

  return {
    id: row.id,
    paymentNumber: row.paymentNumber,
    status: row.status,
    currency: row.currency,
    amount: row.amount,
    feeAmount: row.feeAmount,
    netAmount: row.netAmount,
    amountPaid: row.amountPaid,
    amountRefunded: row.amountRefunded,
    externalReference: row.externalReference,
    checkoutUrl: row.checkoutUrl,
    expiresAt: row.expiresAt,
    paidAt: row.paidAt,
    failedAt: row.failedAt,
    cancelledAt: row.cancelledAt,
    expiredAt: row.expiredAt,
    failureReason: row.failureReason,
    metadata: row.metadata,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    orderId: row.orderId,
    orderNumber: order?.orderNumber ?? null,
    orderStatus: order?.status ?? null,
    orderGrandTotal: order?.grandTotal ?? null,
    contactName: order?.contactName ?? null,
    contactPhone: order?.contactPhone ?? null,
    contactEmail: order?.contactEmail ?? null,
    merchantId: row.merchantId,
    merchantName: row.merchantName,
    merchantCode: row.merchantCode,
    userId: row.userId,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    customerPhone: row.customerPhone,
    methodId: row.methodId,
    methodCode: row.methodCode,
    methodName: row.methodName,
    methodType: row.methodType,
    methodStatus: row.methodStatus,
    providerId: row.providerId,
    providerCode: row.providerCode,
    providerName: row.providerName,
    providerType: row.providerType,
    providerStatus: row.providerStatus,
    attempts: attempts.map((attempt) => ({
      id: attempt.id,
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      providerReference: attempt.providerReference,
      requestPayload: attempt.requestPayload,
      responsePayload: attempt.responsePayload,
      failureCode: attempt.failureCode,
      failureMessage: attempt.failureMessage,
      expiresAt: attempt.expiresAt,
      processedAt: attempt.processedAt,
      createdAt: attempt.createdAt,
    })),
    events: events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      source: event.source,
      externalReference: event.externalReference,
      payload: event.payload,
      note: event.note,
      createdAt: event.createdAt,
    })),
    refunds: refundRows,
  };
}
