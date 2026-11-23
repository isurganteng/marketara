import { and, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import {
  collectivePurchaseGroups,
  dispatchRecords,
  fulfillmentStatusHistories,
  goodsReceipts,
  merchants,
  packingTasks,
  pickingTasks,
  procurementApprovals,
  purchaseOrders,
  purchaseRequisitions,
  putawayTasks,
  supplierQuotations,
  suppliers,
  warehouseAllocations,
  warehouseReceipts,
  warehouseReturns,
} from '../../db/schema';
import { assertMerchantAccess, isPlatformAdmin, merchantScopeCondition } from '../../lib/access';
import { ApiError } from '../../lib/errors';
import type { AuthUser } from '../../types';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export { money, quantity, toNumber } from '../inventory/shared';
export {
  getInventoryItem,
  getWarehouse,
  getWarehouseLocation,
  applyMovement,
  type MovementLineInput,
} from '../inventory/shared';

export const numericSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine(
    (value) => value.trim() !== '' && !Number.isNaN(Number(value)) && Number(value) > 0,
    'Harus berupa angka lebih dari 0',
  );

export const optionalNumericSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine(
    (value) => value.trim() !== '' && !Number.isNaN(Number(value)) && Number(value) >= 0,
    'Harus berupa angka >= 0',
  );

export const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Gunakan format YYYY-MM-DD');

/**
 * Filter data supply chain sesuai merchant yang boleh diakses user.
 * Supplier, PR, PO, dan tugas fulfillment selalu dimiliki satu merchant.
 */
export function supplyChainScopeCondition(
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

export async function assertSupplyChainAccess(
  merchantId: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  return assertMerchantAccess(merchantId, user, permissions, options);
}

export function sumLines(
  lines: Array<{ quantity: string; unitPrice: string }>,
  discountTotal = 0,
  taxTotal = 0,
  shippingTotal = 0,
) {
  const subtotal = lines.reduce(
    (total, line) => total + Number(line.quantity) * Number(line.unitPrice),
    0,
  );
  const grandTotal = subtotal - discountTotal + taxTotal + shippingTotal;
  return {
    subtotal: subtotal.toFixed(2),
    grandTotal: Math.max(grandTotal, 0).toFixed(2),
  };
}

export async function recordFulfillmentHistory(
  tx: Tx,
  input: {
    merchantId: string;
    entityType: string;
    entityId: string;
    fromStatus?: string | null;
    toStatus: string;
    note?: string | null;
    changedBy?: string | null;
  },
) {
  await tx.insert(fulfillmentStatusHistories).values({
    merchantId: input.merchantId,
    entityType: input.entityType,
    entityId: input.entityId,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus,
    note: input.note ?? null,
    changedBy: input.changedBy ?? null,
  });
}

export async function createApproval(
  tx: Tx,
  input: {
    merchantId: string;
    entityType: string;
    entityId: string;
    requestedBy: string;
    step?: number;
    notes?: string | null;
  },
) {
  await tx.insert(procurementApprovals).values({
    merchantId: input.merchantId,
    entityType: input.entityType,
    entityId: input.entityId,
    step: input.step ?? 1,
    status: 'pending',
    requestedBy: input.requestedBy,
    notes: input.notes ?? null,
  });
}

/* ----------------------------- record getters ---------------------------- */

async function accessRecord<T extends { merchantId: string }>(
  record: T | undefined,
  label: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  if (!record) throw ApiError.notFound(`${label} tidak ditemukan`);
  const access = await assertSupplyChainAccess(
    record.merchantId,
    user,
    permissions,
    options,
  );
  return { record, ...access };
}

export async function getSupplier(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const supplier = await db.query.suppliers.findFirst({
    where: and(eq(suppliers.id, id), isNull(suppliers.deletedAt)),
  });
  const result = await accessRecord(supplier, 'Supplier', user, permissions, options);
  return { supplier: result.record, ...result };
}

export async function getRequisition(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.purchaseRequisitions.findFirst({
    where: eq(purchaseRequisitions.id, id),
  });
  const result = await accessRecord(
    row,
    'Permintaan pembelian',
    user,
    permissions,
    options,
  );
  return { requisition: result.record, ...result };
}

export async function getQuotation(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.supplierQuotations.findFirst({
    where: eq(supplierQuotations.id, id),
  });
  const result = await accessRecord(row, 'Penawaran supplier', user, permissions, options);
  return { quotation: result.record, ...result };
}

export async function getPurchaseOrder(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.purchaseOrders.findFirst({
    where: eq(purchaseOrders.id, id),
  });
  const result = await accessRecord(row, 'Purchase order', user, permissions, options);
  return { purchaseOrder: result.record, ...result };
}

export async function getGoodsReceipt(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.goodsReceipts.findFirst({
    where: eq(goodsReceipts.id, id),
  });
  const result = await accessRecord(row, 'Penerimaan barang', user, permissions, options);
  return { goodsReceipt: result.record, ...result };
}

export async function getWarehouseReceipt(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.warehouseReceipts.findFirst({
    where: eq(warehouseReceipts.id, id),
  });
  const result = await accessRecord(row, 'Penerimaan gudang', user, permissions, options);
  return { warehouseReceipt: result.record, ...result };
}

export async function getPutawayTask(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.putawayTasks.findFirst({
    where: eq(putawayTasks.id, id),
  });
  const result = await accessRecord(row, 'Tugas put-away', user, permissions, options);
  return { putawayTask: result.record, ...result };
}

export async function getAllocation(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.warehouseAllocations.findFirst({
    where: eq(warehouseAllocations.id, id),
  });
  const result = await accessRecord(row, 'Alokasi stok', user, permissions, options);
  return { allocation: result.record, ...result };
}

export async function getPickingTask(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.pickingTasks.findFirst({
    where: eq(pickingTasks.id, id),
  });
  const result = await accessRecord(row, 'Tugas picking', user, permissions, options);
  return { pickingTask: result.record, ...result };
}

export async function getPackingTask(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.packingTasks.findFirst({
    where: eq(packingTasks.id, id),
  });
  const result = await accessRecord(row, 'Tugas packing', user, permissions, options);
  return { packingTask: result.record, ...result };
}

export async function getDispatch(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.dispatchRecords.findFirst({
    where: eq(dispatchRecords.id, id),
  });
  const result = await accessRecord(row, 'Pengiriman', user, permissions, options);
  return { dispatch: result.record, ...result };
}

export async function getWarehouseReturn(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.warehouseReturns.findFirst({
    where: eq(warehouseReturns.id, id),
  });
  const result = await accessRecord(row, 'Retur gudang', user, permissions, options);
  return { warehouseReturn: result.record, ...result };
}

export async function getCollectiveGroup(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.collectivePurchaseGroups.findFirst({
    where: eq(collectivePurchaseGroups.id, id),
  });
  const result = await accessRecord(row, 'Grup pembelian bersama', user, permissions, options);
  return { group: result.record, ...result };
}
