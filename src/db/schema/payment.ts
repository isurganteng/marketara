import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { merchants, users } from './core';
import { orders, returns } from './commerce';

/**
 * MKT-06 Integrated Payment Management.
 *
 * Schema ini menyimpan master provider/metode pembayaran, akun pencairan
 * merchant, payment intent per order, attempt gateway, event pembayaran,
 * refund, settlement, dan rekonsiliasi.
 *
 * Pembayaran tidak mengubah status order secara otomatis; status order tetap
 * dikelola oleh MKT-05. Payment hanya mencatat status finansial.
 */
export const payment = pgSchema('payment');

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const paymentProviderTypeEnum = payment.enum('payment_provider_type', [
  'gateway',
  'bank',
  'ewallet',
  'qris',
  'manual',
  'other',
]);

export const paymentProviderStatusEnum = payment.enum('payment_provider_status', [
  'active',
  'inactive',
]);

export const paymentMethodTypeEnum = payment.enum('payment_method_type', [
  'qris',
  'ewallet',
  'bank_transfer',
  'virtual_account',
  'credit_card',
  'cash',
  'other',
]);

export const paymentMethodStatusEnum = payment.enum('payment_method_status', [
  'active',
  'inactive',
]);

export const paymentStatusEnum = payment.enum('payment_status', [
  'pending',
  'authorized',
  'paid',
  'failed',
  'expired',
  'cancelled',
  'partially_refunded',
  'refunded',
]);

export const paymentAttemptStatusEnum = payment.enum('payment_attempt_status', [
  'created',
  'pending',
  'succeeded',
  'failed',
  'expired',
  'cancelled',
]);

export const paymentEventTypeEnum = payment.enum('payment_event_type', [
  'created',
  'authorized',
  'paid',
  'failed',
  'expired',
  'cancelled',
  'refund',
  'settlement',
  'callback',
  'other',
]);

export const merchantPaymentAccountStatusEnum = payment.enum(
  'merchant_payment_account_status',
  ['pending_verification', 'active', 'inactive'],
);

export const refundStatusEnum = payment.enum('refund_status', [
  'requested',
  'approved',
  'processing',
  'completed',
  'rejected',
  'cancelled',
  'failed',
]);

export const settlementStatusEnum = payment.enum('settlement_status', [
  'draft',
  'pending',
  'processing',
  'completed',
  'cancelled',
]);

export const reconciliationStatusEnum = payment.enum('reconciliation_status', [
  'draft',
  'completed',
  'discrepancy',
  'failed',
]);

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const createdAt = timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = timestamp('updated_at', { withTimezone: true })
  .defaultNow()
  .notNull()
  .$onUpdate(() => new Date());

/* ------------------------------------------------------------------ */
/* Provider, metode, dan akun pencairan                                */
/* ------------------------------------------------------------------ */

export const paymentProviders = payment.table(
  'payment_providers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    type: paymentProviderTypeEnum('type').default('gateway').notNull(),
    status: paymentProviderStatusEnum('status').default('active').notNull(),
    description: text('description'),
    logoUrl: text('logo_url'),
    config: jsonb('config').$type<Record<string, unknown>>(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('payment_providers_code_uq').on(t.code),
    index('payment_providers_status_idx').on(t.status),
    index('payment_providers_type_idx').on(t.type),
  ],
);

export const paymentMethods = payment.table(
  'payment_methods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    providerId: uuid('provider_id')
      .notNull()
      .references(() => paymentProviders.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    type: paymentMethodTypeEnum('type').default('other').notNull(),
    status: paymentMethodStatusEnum('status').default('active').notNull(),
    description: text('description'),
    feeFlat: numeric('fee_flat', { precision: 16, scale: 2 }).default('0').notNull(),
    feePercent: numeric('fee_percent', { precision: 5, scale: 2 }).default('0').notNull(),
    minimumAmount: numeric('minimum_amount', { precision: 16, scale: 2 })
      .default('0')
      .notNull(),
    maximumAmount: numeric('maximum_amount', { precision: 16, scale: 2 }),
    instructions: text('instructions'),
    config: jsonb('config').$type<Record<string, unknown>>(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('payment_methods_provider_code_uq').on(t.providerId, t.code),
    index('payment_methods_provider_idx').on(t.providerId),
    index('payment_methods_status_idx').on(t.status),
    index('payment_methods_type_idx').on(t.type),
  ],
);

export const merchantPaymentAccounts = payment.table(
  'merchant_payment_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    providerId: uuid('provider_id').references(() => paymentProviders.id, {
      onDelete: 'set null',
    }),
    accountName: varchar('account_name', { length: 255 }).notNull(),
    accountNumber: varchar('account_number', { length: 64 }).notNull(),
    bankName: varchar('bank_name', { length: 128 }),
    status: merchantPaymentAccountStatusEnum('status')
      .default('pending_verification')
      .notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('merchant_payment_accounts_merchant_idx').on(t.merchantId),
    index('merchant_payment_accounts_status_idx').on(t.status),
    uniqueIndex('merchant_payment_accounts_default_uq')
      .on(t.merchantId)
      .where(sql`is_default = true`),
  ],
);

/* ------------------------------------------------------------------ */
/* Payment intent, attempt, dan event                                  */
/* ------------------------------------------------------------------ */

export const payments = payment.table(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    paymentNumber: varchar('payment_number', { length: 32 }).notNull(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'restrict' }),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    providerId: uuid('provider_id').references(() => paymentProviders.id, {
      onDelete: 'set null',
    }),
    methodId: uuid('method_id').references(() => paymentMethods.id, {
      onDelete: 'set null',
    }),
    status: paymentStatusEnum('status').default('pending').notNull(),
    currency: varchar('currency', { length: 3 }).default('IDR').notNull(),
    amount: numeric('amount', { precision: 16, scale: 2 }).notNull(),
    feeAmount: numeric('fee_amount', { precision: 16, scale: 2 }).default('0').notNull(),
    netAmount: numeric('net_amount', { precision: 16, scale: 2 }).default('0').notNull(),
    amountPaid: numeric('amount_paid', { precision: 16, scale: 2 }).default('0').notNull(),
    amountRefunded: numeric('amount_refunded', { precision: 16, scale: 2 })
      .default('0')
      .notNull(),
    externalReference: varchar('external_reference', { length: 128 }),
    checkoutUrl: text('checkout_url'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    expiredAt: timestamp('expired_at', { withTimezone: true }),
    failureReason: text('failure_reason'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('payments_number_uq').on(t.paymentNumber),
    uniqueIndex('payments_order_uq').on(t.orderId),
    index('payments_merchant_idx').on(t.merchantId),
    index('payments_customer_idx').on(t.userId),
    index('payments_status_idx').on(t.status),
    index('payments_provider_idx').on(t.providerId),
    index('payments_method_idx').on(t.methodId),
    index('payments_created_idx').on(t.createdAt),
    index('payments_paid_idx').on(t.paidAt),
  ],
);

export const paymentAttempts = payment.table(
  'payment_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'cascade' }),
    attemptNumber: integer('attempt_number').notNull(),
    status: paymentAttemptStatusEnum('status').default('pending').notNull(),
    providerReference: varchar('provider_reference', { length: 128 }),
    requestPayload: jsonb('request_payload').$type<Record<string, unknown>>(),
    responsePayload: jsonb('response_payload').$type<Record<string, unknown>>(),
    failureCode: varchar('failure_code', { length: 64 }),
    failureMessage: text('failure_message'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('payment_attempts_number_uq').on(t.paymentId, t.attemptNumber),
    index('payment_attempts_payment_idx').on(t.paymentId),
    index('payment_attempts_status_idx').on(t.status),
    index('payment_attempts_created_idx').on(t.createdAt),
  ],
);

export const paymentEvents = payment.table(
  'payment_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'cascade' }),
    attemptId: uuid('attempt_id').references(() => paymentAttempts.id, {
      onDelete: 'set null',
    }),
    eventType: paymentEventTypeEnum('event_type').notNull(),
    source: varchar('source', { length: 32 }).default('internal').notNull(),
    externalReference: varchar('external_reference', { length: 128 }),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    note: text('note'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
  },
  (t) => [
    index('payment_events_payment_idx').on(t.paymentId),
    index('payment_events_type_idx').on(t.eventType),
    index('payment_events_created_idx').on(t.createdAt),
  ],
);

/* ------------------------------------------------------------------ */
/* Refund                                                              */
/* ------------------------------------------------------------------ */

export const refunds = payment.table(
  'refunds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    refundNumber: varchar('refund_number', { length: 32 }).notNull(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'restrict' }),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'restrict' }),
    returnId: uuid('return_id').references(() => returns.id, { onDelete: 'set null' }),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    status: refundStatusEnum('status').default('requested').notNull(),
    amount: numeric('amount', { precision: 16, scale: 2 }).notNull(),
    reason: text('reason').notNull(),
    externalReference: varchar('external_reference', { length: 128 }),
    failureReason: text('failure_reason'),
    requestedBy: uuid('requested_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    processedBy: uuid('processed_by').references(() => users.id, { onDelete: 'set null' }),
    requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('refunds_number_uq').on(t.refundNumber),
    index('refunds_payment_idx').on(t.paymentId),
    index('refunds_order_idx').on(t.orderId),
    index('refunds_return_idx').on(t.returnId),
    index('refunds_merchant_idx').on(t.merchantId),
    index('refunds_customer_idx').on(t.userId),
    index('refunds_status_idx').on(t.status),
    index('refunds_requested_idx').on(t.requestedAt),
  ],
);

/* ------------------------------------------------------------------ */
/* Settlement                                                          */
/* ------------------------------------------------------------------ */

export const settlements = payment.table(
  'settlements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    settlementNumber: varchar('settlement_number', { length: 32 }).notNull(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'restrict' }),
    accountId: uuid('account_id').references(() => merchantPaymentAccounts.id, {
      onDelete: 'set null',
    }),
    status: settlementStatusEnum('status').default('draft').notNull(),
    currency: varchar('currency', { length: 3 }).default('IDR').notNull(),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    grossAmount: numeric('gross_amount', { precision: 16, scale: 2 }).default('0').notNull(),
    feeAmount: numeric('fee_amount', { precision: 16, scale: 2 }).default('0').notNull(),
    refundAmount: numeric('refund_amount', { precision: 16, scale: 2 })
      .default('0')
      .notNull(),
    netAmount: numeric('net_amount', { precision: 16, scale: 2 }).default('0').notNull(),
    paymentCount: integer('payment_count').default(0).notNull(),
    notes: text('notes'),
    generatedBy: uuid('generated_by').references(() => users.id, { onDelete: 'set null' }),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('settlements_number_uq').on(t.settlementNumber),
    index('settlements_merchant_idx').on(t.merchantId),
    index('settlements_status_idx').on(t.status),
    index('settlements_period_idx').on(t.periodStart, t.periodEnd),
  ],
);

export const settlementItems = payment.table(
  'settlement_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    settlementId: uuid('settlement_id')
      .notNull()
      .references(() => settlements.id, { onDelete: 'cascade' }),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'restrict' }),
    amount: numeric('amount', { precision: 16, scale: 2 }).notNull(),
    feeAmount: numeric('fee_amount', { precision: 16, scale: 2 }).default('0').notNull(),
    refundAmount: numeric('refund_amount', { precision: 16, scale: 2 })
      .default('0')
      .notNull(),
    netAmount: numeric('net_amount', { precision: 16, scale: 2 }).notNull(),
    createdAt,
  },
  (t) => [
    uniqueIndex('settlement_items_payment_uq').on(t.paymentId),
    uniqueIndex('settlement_items_settlement_payment_uq').on(t.settlementId, t.paymentId),
    index('settlement_items_settlement_idx').on(t.settlementId),
  ],
);

/* ------------------------------------------------------------------ */
/* Rekonsiliasi                                                        */
/* ------------------------------------------------------------------ */

export const reconciliations = payment.table(
  'reconciliations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reconciliationNumber: varchar('reconciliation_number', { length: 32 }).notNull(),
    providerId: uuid('provider_id')
      .notNull()
      .references(() => paymentProviders.id, { onDelete: 'restrict' }),
    status: reconciliationStatusEnum('status').default('draft').notNull(),
    currency: varchar('currency', { length: 3 }).default('IDR').notNull(),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    internalAmount: numeric('internal_amount', { precision: 16, scale: 2 })
      .default('0')
      .notNull(),
    externalAmount: numeric('external_amount', { precision: 16, scale: 2 })
      .default('0')
      .notNull(),
    differenceAmount: numeric('difference_amount', { precision: 16, scale: 2 })
      .default('0')
      .notNull(),
    matchedCount: integer('matched_count').default(0).notNull(),
    unmatchedCount: integer('unmatched_count').default(0).notNull(),
    details: jsonb('details').$type<Record<string, unknown>>(),
    notes: text('notes'),
    reconciledBy: uuid('reconciled_by').references(() => users.id, { onDelete: 'set null' }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('reconciliations_number_uq').on(t.reconciliationNumber),
    index('reconciliations_provider_idx').on(t.providerId),
    index('reconciliations_status_idx').on(t.status),
    index('reconciliations_period_idx').on(t.periodStart, t.periodEnd),
  ],
);
