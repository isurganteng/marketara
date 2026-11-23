import { and, asc, desc, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import { db } from '../../db';
import {
  cashMovements,
  cashRegisters,
  cashierShifts,
  merchants,
  posTerminals,
  posTransactionItems,
  posTransactions,
  stores,
  users,
} from '../../db/schema';
import { assertMerchantAccess, isPlatformAdmin, merchantScopeCondition } from '../../lib/access';
import { ApiError } from '../../lib/errors';
import type { AuthUser } from '../../types';
import { money } from '../commerce/shared';

export const POS_CASH_TYPES = ['cash'] as const;

export function posScopeCondition(
  user: AuthUser,
  permissions: Set<string>,
): SQL | undefined {
  if (isPlatformAdmin(permissions)) return undefined;

  const merchantCondition = merchantScopeCondition(user, permissions);
  return inArray(
    merchants.id,
    db
      .select({ id: merchants.id })
      .from(merchants)
      .where(and(merchantCondition, isNull(merchants.deletedAt))),
  );
}

export async function assertPosStoreAccess(
  merchantId: string,
  storeId: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const access = await assertMerchantAccess(merchantId, user, permissions, options);
  const store = await db.query.stores.findFirst({
    where: and(
      eq(stores.id, storeId),
      eq(stores.merchantId, merchantId),
      isNull(stores.deletedAt),
    ),
  });
  if (!store) throw ApiError.badRequest('Toko tidak ditemukan untuk pedagang ini');
  return { ...access, store };
}

export async function getPosTerminal(
  terminalId: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const terminal = await db.query.posTerminals.findFirst({
    where: and(eq(posTerminals.id, terminalId), isNull(posTerminals.deletedAt)),
  });
  if (!terminal) throw ApiError.notFound('Terminal POS tidak ditemukan');
  const access = await assertMerchantAccess(
    terminal.merchantId,
    user,
    permissions,
    options,
  );
  return { terminal, ...access };
}

export async function getCashRegister(
  registerId: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const register = await db.query.cashRegisters.findFirst({
    where: and(eq(cashRegisters.id, registerId), isNull(cashRegisters.deletedAt)),
  });
  if (!register) throw ApiError.notFound('Cash register tidak ditemukan');
  const access = await assertMerchantAccess(
    register.merchantId,
    user,
    permissions,
    options,
  );
  return { register, ...access };
}

export async function getCashierShift(
  shiftId: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const shift = await db.query.cashierShifts.findFirst({
    where: eq(cashierShifts.id, shiftId),
  });
  if (!shift) throw ApiError.notFound('Shift kasir tidak ditemukan');
  const access = await assertMerchantAccess(
    shift.merchantId,
    user,
    permissions,
    options,
  );
  return { shift, ...access };
}

export async function getPosTransaction(
  transactionId: string,
  user: AuthUser,
  permissions: Set<string>,
) {
  const transaction = await db.query.posTransactions.findFirst({
    where: eq(posTransactions.id, transactionId),
  });
  if (!transaction) throw ApiError.notFound('Transaksi POS tidak ditemukan');
  const access = await assertMerchantAccess(
    transaction.merchantId,
    user,
    permissions,
  );
  return { transaction, ...access };
}

export function signedCashAmount(type: string, amount: number): number {
  if (type === 'cash_out' || type === 'refund') return -amount;
  return amount;
}

export async function getCashBalance(shiftId: string): Promise<number> {
  const rows = await db
    .select({ type: cashMovements.type, amount: cashMovements.amount })
    .from(cashMovements)
    .where(eq(cashMovements.shiftId, shiftId));
  return rows.reduce(
    (total, row) => total + signedCashAmount(row.type, Number(row.amount)),
    0,
  );
}

export async function computeShiftTotals(shiftId: string) {
  const [transactionRows, movementRows] = await Promise.all([
    db
      .select({
        status: posTransactions.status,
        paymentMethod: posTransactions.paymentMethod,
        total: posTransactions.total,
      })
      .from(posTransactions)
      .where(eq(posTransactions.shiftId, shiftId)),
    db
      .select({ type: cashMovements.type, amount: cashMovements.amount })
      .from(cashMovements)
      .where(eq(cashMovements.shiftId, shiftId)),
  ]);

  let totalSales = 0;
  let totalCashSales = 0;
  let totalNonCashSales = 0;
  let transactionCount = 0;
  for (const row of transactionRows) {
    if (row.status !== 'completed') continue;
    const amount = Number(row.total);
    totalSales += amount;
    transactionCount += 1;
    if (row.paymentMethod === 'cash') totalCashSales += amount;
    else totalNonCashSales += amount;
  }

  const expectedCash = movementRows.reduce(
    (total, row) => total + signedCashAmount(row.type, Number(row.amount)),
    0,
  );

  return {
    totalSales: money(totalSales),
    totalCashSales: money(totalCashSales),
    totalNonCashSales: money(totalNonCashSales),
    transactionCount,
    expectedCash: money(expectedCash),
  };
}

export async function getShiftDetail(shiftId: string) {
  const [row] = await db
    .select({
      id: cashierShifts.id,
      shiftNumber: cashierShifts.shiftNumber,
      merchantId: cashierShifts.merchantId,
      merchantName: merchants.businessName,
      merchantCode: merchants.code,
      storeId: cashierShifts.storeId,
      storeName: stores.name,
      terminalId: cashierShifts.terminalId,
      terminalCode: posTerminals.code,
      terminalName: posTerminals.name,
      registerId: cashierShifts.registerId,
      registerCode: cashRegisters.code,
      registerName: cashRegisters.name,
      cashierId: cashierShifts.cashierId,
      cashierName: users.fullName,
      cashierEmail: users.email,
      status: cashierShifts.status,
      openingFloat: cashierShifts.openingFloat,
      expectedCash: cashierShifts.expectedCash,
      countedCash: cashierShifts.countedCash,
      cashDifference: cashierShifts.cashDifference,
      totalSales: cashierShifts.totalSales,
      totalCashSales: cashierShifts.totalCashSales,
      totalNonCashSales: cashierShifts.totalNonCashSales,
      transactionCount: cashierShifts.transactionCount,
      openedAt: cashierShifts.openedAt,
      closedAt: cashierShifts.closedAt,
      openedBy: cashierShifts.openedBy,
      closedBy: cashierShifts.closedBy,
      notes: cashierShifts.notes,
      createdAt: cashierShifts.createdAt,
      updatedAt: cashierShifts.updatedAt,
    })
    .from(cashierShifts)
    .innerJoin(merchants, eq(merchants.id, cashierShifts.merchantId))
    .innerJoin(stores, eq(stores.id, cashierShifts.storeId))
    .innerJoin(posTerminals, eq(posTerminals.id, cashierShifts.terminalId))
    .innerJoin(cashRegisters, eq(cashRegisters.id, cashierShifts.registerId))
    .innerJoin(users, eq(users.id, cashierShifts.cashierId))
    .where(eq(cashierShifts.id, shiftId))
    .limit(1);

  if (!row) throw ApiError.notFound('Shift kasir tidak ditemukan');

  const [movements, totals] = await Promise.all([
    db
      .select({
        id: cashMovements.id,
        type: cashMovements.type,
        amount: cashMovements.amount,
        balanceAfter: cashMovements.balanceAfter,
        referenceNumber: cashMovements.referenceNumber,
        note: cashMovements.note,
        transactionId: cashMovements.transactionId,
        createdBy: cashMovements.createdBy,
        occurredAt: cashMovements.occurredAt,
        createdAt: cashMovements.createdAt,
      })
      .from(cashMovements)
      .where(eq(cashMovements.shiftId, shiftId))
      .orderBy(asc(cashMovements.occurredAt)),
    computeShiftTotals(shiftId),
  ]);

  return {
    ...row,
    expectedCash: totals.expectedCash,
    totalSales: totals.totalSales,
    totalCashSales: totals.totalCashSales,
    totalNonCashSales: totals.totalNonCashSales,
    transactionCount: totals.transactionCount,
    movements,
  };
}

export async function getPosTransactionDetail(transactionId: string) {
  const [row] = await db
    .select({
      id: posTransactions.id,
      transactionNumber: posTransactions.transactionNumber,
      clientTransactionId: posTransactions.clientTransactionId,
      merchantId: posTransactions.merchantId,
      merchantName: merchants.businessName,
      merchantCode: merchants.code,
      storeId: posTransactions.storeId,
      storeName: stores.name,
      terminalId: posTransactions.terminalId,
      terminalCode: posTerminals.code,
      terminalName: posTerminals.name,
      registerId: posTransactions.registerId,
      registerCode: cashRegisters.code,
      registerName: cashRegisters.name,
      shiftId: posTransactions.shiftId,
      shiftNumber: cashierShifts.shiftNumber,
      cashierId: posTransactions.cashierId,
      cashierName: users.fullName,
      cashierEmail: users.email,
      status: posTransactions.status,
      syncStatus: posTransactions.syncStatus,
      paymentMethod: posTransactions.paymentMethod,
      currency: posTransactions.currency,
      itemCount: posTransactions.itemCount,
      subtotal: posTransactions.subtotal,
      discountTotal: posTransactions.discountTotal,
      taxTotal: posTransactions.taxTotal,
      total: posTransactions.total,
      paidAmount: posTransactions.paidAmount,
      changeAmount: posTransactions.changeAmount,
      customerName: posTransactions.customerName,
      customerPhone: posTransactions.customerPhone,
      notes: posTransactions.notes,
      offlineCreatedAt: posTransactions.offlineCreatedAt,
      completedAt: posTransactions.completedAt,
      syncedAt: posTransactions.syncedAt,
      voidedAt: posTransactions.voidedAt,
      voidReason: posTransactions.voidReason,
      metadata: posTransactions.metadata,
      createdAt: posTransactions.createdAt,
      updatedAt: posTransactions.updatedAt,
    })
    .from(posTransactions)
    .innerJoin(merchants, eq(merchants.id, posTransactions.merchantId))
    .innerJoin(stores, eq(stores.id, posTransactions.storeId))
    .innerJoin(posTerminals, eq(posTerminals.id, posTransactions.terminalId))
    .innerJoin(cashRegisters, eq(cashRegisters.id, posTransactions.registerId))
    .innerJoin(cashierShifts, eq(cashierShifts.id, posTransactions.shiftId))
    .innerJoin(users, eq(users.id, posTransactions.cashierId))
    .where(eq(posTransactions.id, transactionId))
    .limit(1);

  if (!row) throw ApiError.notFound('Transaksi POS tidak ditemukan');

  const items = await db
    .select({
      id: posTransactionItems.id,
      productId: posTransactionItems.productId,
      skuId: posTransactionItems.skuId,
      productName: posTransactionItems.productName,
      skuCode: posTransactionItems.skuCode,
      quantity: posTransactionItems.quantity,
      unitPrice: posTransactionItems.unitPrice,
      discountAmount: posTransactionItems.discountAmount,
      lineTotal: posTransactionItems.lineTotal,
      notes: posTransactionItems.notes,
      itemSnapshot: posTransactionItems.itemSnapshot,
    })
    .from(posTransactionItems)
    .where(eq(posTransactionItems.transactionId, transactionId))
    .orderBy(asc(posTransactionItems.createdAt));

  return { ...row, items };
}

export async function listPosTerminalsForScope(
  user: AuthUser,
  permissions: Set<string>,
  merchantId?: string,
) {
  const scope = posScopeCondition(user, permissions);
  const conditions: SQL[] = [isNull(posTerminals.deletedAt)];
  if (scope) conditions.push(scope);
  if (merchantId) conditions.push(eq(posTerminals.merchantId, merchantId));
  return db
    .select()
    .from(posTerminals)
    .where(and(...conditions))
    .orderBy(desc(posTerminals.createdAt));
}
