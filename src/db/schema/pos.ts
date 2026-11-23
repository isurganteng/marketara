import {
  index,
  integer,
  jsonb,
  numeric,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { productSkus, products } from './catalog';
import { commerce } from './commerce';
import { merchants, stores, users } from './core';

/**
 * MKT-07 POS & Offline Transaction Management.
 *
 * Tabel POS berada di schema `commerce` agar sejalan dengan kanal penjualan,
 * order, dan ledger transaksi. Modul ini mengelola terminal, cash register,
 * shift kasir, transaksi POS, item transaksi, pergerakan kas, dan log
 * sinkronisasi transaksi offline.
 */
export const posTerminalStatusEnum = commerce.enum('pos_terminal_status', [
  'active',
  'inactive',
  'maintenance',
]);

export const cashRegisterStatusEnum = commerce.enum('cash_register_status', [
  'active',
  'inactive',
]);

export const cashierShiftStatusEnum = commerce.enum('cashier_shift_status', [
  'open',
  'closed',
  'cancelled',
]);

export const posTransactionStatusEnum = commerce.enum('pos_transaction_status', [
  'completed',
  'voided',
]);

export const posSyncStatusEnum = commerce.enum('pos_sync_status', [
  'pending',
  'synced',
  'failed',
  'conflict',
]);

export const posPaymentMethodEnum = commerce.enum('pos_payment_method', [
  'cash',
  'qris',
  'debit_card',
  'credit_card',
  'ewallet',
  'bank_transfer',
  'other',
]);

export const cashMovementTypeEnum = commerce.enum('cash_movement_type', [
  'opening',
  'sale',
  'refund',
  'cash_in',
  'cash_out',
  'adjustment',
]);

export const posSyncDirectionEnum = commerce.enum('pos_sync_direction', [
  'upload',
  'download',
]);

export const posSyncLogStatusEnum = commerce.enum('pos_sync_log_status', [
  'success',
  'failed',
  'conflict',
]);

const createdAt = timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = timestamp('updated_at', { withTimezone: true })
  .defaultNow()
  .notNull()
  .$onUpdate(() => new Date());

export const posTerminals = commerce.table(
  'pos_terminals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    location: varchar('location', { length: 255 }),
    deviceIdentifier: varchar('device_identifier', { length: 128 }),
    status: posTerminalStatusEnum('status').default('active').notNull(),
    settings: jsonb('settings').$type<Record<string, unknown>>(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    createdAt,
    updatedAt,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('pos_terminals_merchant_code_uq').on(t.merchantId, t.code),
    index('pos_terminals_merchant_idx').on(t.merchantId),
    index('pos_terminals_store_idx').on(t.storeId),
    index('pos_terminals_status_idx').on(t.status),
  ],
);

export const cashRegisters = commerce.table(
  'cash_registers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    terminalId: uuid('terminal_id').references(() => posTerminals.id, {
      onDelete: 'set null',
    }),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    status: cashRegisterStatusEnum('status').default('active').notNull(),
    notes: text('notes'),
    createdAt,
    updatedAt,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('cash_registers_merchant_code_uq').on(t.merchantId, t.code),
    index('cash_registers_merchant_idx').on(t.merchantId),
    index('cash_registers_store_idx').on(t.storeId),
    index('cash_registers_terminal_idx').on(t.terminalId),
    index('cash_registers_status_idx').on(t.status),
  ],
);

export const cashierShifts = commerce.table(
  'cashier_shifts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shiftNumber: varchar('shift_number', { length: 32 }).notNull(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    terminalId: uuid('terminal_id')
      .notNull()
      .references(() => posTerminals.id, { onDelete: 'restrict' }),
    registerId: uuid('register_id')
      .notNull()
      .references(() => cashRegisters.id, { onDelete: 'restrict' }),
    cashierId: uuid('cashier_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    status: cashierShiftStatusEnum('status').default('open').notNull(),
    openingFloat: numeric('opening_float', { precision: 16, scale: 2 })
      .default('0')
      .notNull(),
    expectedCash: numeric('expected_cash', { precision: 16, scale: 2 })
      .default('0')
      .notNull(),
    countedCash: numeric('counted_cash', { precision: 16, scale: 2 }),
    cashDifference: numeric('cash_difference', { precision: 16, scale: 2 }),
    totalSales: numeric('total_sales', { precision: 16, scale: 2 })
      .default('0')
      .notNull(),
    totalCashSales: numeric('total_cash_sales', { precision: 16, scale: 2 })
      .default('0')
      .notNull(),
    totalNonCashSales: numeric('total_non_cash_sales', { precision: 16, scale: 2 })
      .default('0')
      .notNull(),
    transactionCount: integer('transaction_count').default(0).notNull(),
    openedAt: timestamp('opened_at', { withTimezone: true }).defaultNow().notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    openedBy: uuid('opened_by').references(() => users.id, { onDelete: 'set null' }),
    closedBy: uuid('closed_by').references(() => users.id, { onDelete: 'set null' }),
    notes: text('notes'),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('cashier_shifts_number_uq').on(t.shiftNumber),
    uniqueIndex('cashier_shifts_open_register_uq')
      .on(t.registerId)
      .where(sql`status = 'open'`),
    index('cashier_shifts_merchant_idx').on(t.merchantId),
    index('cashier_shifts_terminal_idx').on(t.terminalId),
    index('cashier_shifts_register_idx').on(t.registerId),
    index('cashier_shifts_cashier_idx').on(t.cashierId),
    index('cashier_shifts_status_idx').on(t.status),
    index('cashier_shifts_opened_idx').on(t.openedAt),
  ],
);

export const posTransactions = commerce.table(
  'pos_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    transactionNumber: varchar('transaction_number', { length: 32 }).notNull(),
    clientTransactionId: varchar('client_transaction_id', { length: 128 }),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'restrict' }),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'restrict' }),
    terminalId: uuid('terminal_id')
      .notNull()
      .references(() => posTerminals.id, { onDelete: 'restrict' }),
    registerId: uuid('register_id')
      .notNull()
      .references(() => cashRegisters.id, { onDelete: 'restrict' }),
    shiftId: uuid('shift_id')
      .notNull()
      .references(() => cashierShifts.id, { onDelete: 'restrict' }),
    cashierId: uuid('cashier_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    status: posTransactionStatusEnum('status').default('completed').notNull(),
    syncStatus: posSyncStatusEnum('sync_status').default('pending').notNull(),
    paymentMethod: posPaymentMethodEnum('payment_method').notNull(),
    currency: varchar('currency', { length: 3 }).default('IDR').notNull(),
    itemCount: integer('item_count').default(0).notNull(),
    subtotal: numeric('subtotal', { precision: 16, scale: 2 }).default('0').notNull(),
    discountTotal: numeric('discount_total', { precision: 16, scale: 2 })
      .default('0')
      .notNull(),
    taxTotal: numeric('tax_total', { precision: 16, scale: 2 }).default('0').notNull(),
    total: numeric('total', { precision: 16, scale: 2 }).default('0').notNull(),
    paidAmount: numeric('paid_amount', { precision: 16, scale: 2 })
      .default('0')
      .notNull(),
    changeAmount: numeric('change_amount', { precision: 16, scale: 2 })
      .default('0')
      .notNull(),
    customerName: varchar('customer_name', { length: 255 }),
    customerPhone: varchar('customer_phone', { length: 32 }),
    notes: text('notes'),
    offlineCreatedAt: timestamp('offline_created_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    syncedAt: timestamp('synced_at', { withTimezone: true }),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidReason: text('void_reason'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('pos_transactions_number_uq').on(t.transactionNumber),
    uniqueIndex('pos_transactions_client_uq')
      .on(t.terminalId, t.clientTransactionId)
      .where(sql`client_transaction_id is not null`),
    index('pos_transactions_merchant_idx').on(t.merchantId),
    index('pos_transactions_store_idx').on(t.storeId),
    index('pos_transactions_terminal_idx').on(t.terminalId),
    index('pos_transactions_register_idx').on(t.registerId),
    index('pos_transactions_shift_idx').on(t.shiftId),
    index('pos_transactions_cashier_idx').on(t.cashierId),
    index('pos_transactions_status_idx').on(t.status),
    index('pos_transactions_sync_idx').on(t.syncStatus),
    index('pos_transactions_completed_idx').on(t.completedAt),
  ],
);

export const posTransactionItems = commerce.table(
  'pos_transaction_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => posTransactions.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id, {
      onDelete: 'set null',
    }),
    skuId: uuid('sku_id').references(() => productSkus.id, { onDelete: 'set null' }),
    productName: varchar('product_name', { length: 255 }).notNull(),
    skuCode: varchar('sku_code', { length: 100 }),
    quantity: integer('quantity').notNull(),
    unitPrice: numeric('unit_price', { precision: 16, scale: 2 }).notNull(),
    discountAmount: numeric('discount_amount', { precision: 16, scale: 2 })
      .default('0')
      .notNull(),
    lineTotal: numeric('line_total', { precision: 16, scale: 2 }).notNull(),
    notes: text('notes'),
    itemSnapshot: jsonb('item_snapshot').$type<Record<string, unknown>>(),
    createdAt,
  },
  (t) => [
    index('pos_transaction_items_transaction_idx').on(t.transactionId),
    index('pos_transaction_items_product_idx').on(t.productId),
    index('pos_transaction_items_sku_idx').on(t.skuId),
  ],
);

export const cashMovements = commerce.table(
  'cash_movements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    shiftId: uuid('shift_id')
      .notNull()
      .references(() => cashierShifts.id, { onDelete: 'cascade' }),
    registerId: uuid('register_id')
      .notNull()
      .references(() => cashRegisters.id, { onDelete: 'restrict' }),
    transactionId: uuid('transaction_id').references(() => posTransactions.id, {
      onDelete: 'set null',
    }),
    type: cashMovementTypeEnum('type').notNull(),
    amount: numeric('amount', { precision: 16, scale: 2 }).notNull(),
    balanceAfter: numeric('balance_after', { precision: 16, scale: 2 }),
    referenceNumber: varchar('reference_number', { length: 128 }),
    note: text('note'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt,
  },
  (t) => [
    index('cash_movements_shift_idx').on(t.shiftId),
    index('cash_movements_register_idx').on(t.registerId),
    index('cash_movements_transaction_idx').on(t.transactionId),
    index('cash_movements_type_idx').on(t.type),
    index('cash_movements_occurred_idx').on(t.occurredAt),
  ],
);

export const posSyncLogs = commerce.table(
  'pos_sync_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    terminalId: uuid('terminal_id')
      .notNull()
      .references(() => posTerminals.id, { onDelete: 'cascade' }),
    transactionId: uuid('transaction_id').references(() => posTransactions.id, {
      onDelete: 'set null',
    }),
    direction: posSyncDirectionEnum('direction').default('upload').notNull(),
    status: posSyncLogStatusEnum('status').notNull(),
    recordsCount: integer('records_count').default(0).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    message: text('message'),
    errorDetails: jsonb('error_details').$type<Record<string, unknown>>(),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
  },
  (t) => [
    index('pos_sync_logs_merchant_idx').on(t.merchantId),
    index('pos_sync_logs_terminal_idx').on(t.terminalId),
    index('pos_sync_logs_transaction_idx').on(t.transactionId),
    index('pos_sync_logs_status_idx').on(t.status),
    index('pos_sync_logs_created_idx').on(t.createdAt),
  ],
);
