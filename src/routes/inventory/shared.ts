import { and, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../../db';
import {
  inventoryBatches,
  inventoryItems,
  merchants,
  productSkus,
  products,
  stockBalances,
  stockMovementItems,
  stockMovements,
  users,
  warehouseLocations,
  warehouses,
} from '../../db/schema';
import { assertMerchantAccess, isPlatformAdmin, merchantScopeCondition } from '../../lib/access';
import { ApiError } from '../../lib/errors';
import type { AuthUser } from '../../types';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const INBOUND_MOVEMENT_TYPES = ['inbound', 'return'] as const;
export const OUTBOUND_MOVEMENT_TYPES = ['outbound'] as const;

export function inventoryScopeCondition(
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

export function quantity(value: number): string {
  return value.toFixed(3);
}

export function money(value: number): string {
  return value.toFixed(2);
}

export function toNumber(value: string | number | null | undefined): number {
  return Number(value ?? 0);
}

export async function getWarehouse(
  warehouseId: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const warehouse = await db.query.warehouses.findFirst({
    where: and(eq(warehouses.id, warehouseId), isNull(warehouses.deletedAt)),
  });
  if (!warehouse) throw ApiError.notFound('Gudang tidak ditemukan');
  const access = await assertMerchantAccess(
    warehouse.merchantId,
    user,
    permissions,
    options,
  );
  return { warehouse, ...access };
}

export async function getWarehouseLocation(
  locationId: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const [row] = await db
    .select({
      location: warehouseLocations,
      warehouse: warehouses,
    })
    .from(warehouseLocations)
    .innerJoin(warehouses, eq(warehouses.id, warehouseLocations.warehouseId))
    .where(
      and(
        eq(warehouseLocations.id, locationId),
        isNull(warehouseLocations.deletedAt),
        isNull(warehouses.deletedAt),
      ),
    )
    .limit(1);

  if (!row) throw ApiError.notFound('Lokasi gudang tidak ditemukan');
  const access = await assertMerchantAccess(
    row.warehouse.merchantId,
    user,
    permissions,
    options,
  );
  return { ...row, ...access };
}

export async function getInventoryItem(
  itemId: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const item = await db.query.inventoryItems.findFirst({
    where: and(eq(inventoryItems.id, itemId), isNull(inventoryItems.deletedAt)),
  });
  if (!item) throw ApiError.notFound('Item persediaan tidak ditemukan');
  const access = await assertMerchantAccess(item.merchantId, user, permissions, options);
  return { item, ...access };
}

export async function getStockMovement(
  movementId: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const movement = await db.query.stockMovements.findFirst({
    where: eq(stockMovements.id, movementId),
  });
  if (!movement) throw ApiError.notFound('Pergerakan stok tidak ditemukan');
  const access = await assertMerchantAccess(
    movement.merchantId,
    user,
    permissions,
    options,
  );
  return { movement, ...access };
}

export async function getBatch(
  batchId: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const batch = await db.query.inventoryBatches.findFirst({
    where: eq(inventoryBatches.id, batchId),
  });
  if (!batch) throw ApiError.notFound('Batch persediaan tidak ditemukan');
  const access = await assertMerchantAccess(batch.merchantId, user, permissions, options);
  return { batch, ...access };
}

export async function adjustStockBalance(
  tx: Tx,
  input: {
    merchantId: string;
    warehouseId: string;
    warehouseLocationId: string;
    inventoryItemId: string;
    delta: number;
    itemLabel?: string;
  },
) {
  const [existing] = await tx
    .select()
    .from(stockBalances)
    .where(
      and(
        eq(stockBalances.warehouseLocationId, input.warehouseLocationId),
        eq(stockBalances.inventoryItemId, input.inventoryItemId),
      ),
    )
    .limit(1);

  const before = toNumber(existing?.quantity);
  const after = before + input.delta;
  if (after < 0) {
    throw ApiError.badRequest(
      `Stok ${input.itemLabel ?? 'item'} tidak mencukupi (tersedia ${quantity(before)})`,
    );
  }

  if (existing) {
    await tx
      .update(stockBalances)
      .set({
        quantity: quantity(after),
        lastMovementAt: new Date(),
      })
      .where(eq(stockBalances.id, existing.id));
    return { balanceId: existing.id, before, after };
  }

  const [created] = await tx
    .insert(stockBalances)
    .values({
      merchantId: input.merchantId,
      warehouseId: input.warehouseId,
      warehouseLocationId: input.warehouseLocationId,
      inventoryItemId: input.inventoryItemId,
      quantity: quantity(after),
      lastMovementAt: new Date(),
    })
    .returning({ id: stockBalances.id });

  return { balanceId: created!.id, before, after };
}

async function applyInboundBatch(
  tx: Tx,
  input: {
    merchantId: string;
    itemId: string;
    warehouseId: string;
    locationId: string;
    quantityToAdd: number;
    unitCost: string;
    createdBy: string | null;
    batchId?: string | null;
    batchNumber?: string | null;
    manufactureDate?: string | null;
    expiryDate?: string | null;
    notes?: string | null;
  },
) {
  const [item] = await tx
    .select({ trackBatches: inventoryItems.trackBatches })
    .from(inventoryItems)
    .where(eq(inventoryItems.id, input.itemId))
    .limit(1);

  if (!item?.trackBatches && !input.batchId && !input.batchNumber) return null;

  if (input.batchId) {
    const [batch] = await tx
      .select()
      .from(inventoryBatches)
      .where(eq(inventoryBatches.id, input.batchId))
      .limit(1);
    if (!batch) throw ApiError.badRequest('Batch tidak ditemukan');
    if (batch.inventoryItemId !== input.itemId) {
      throw ApiError.badRequest('Batch tidak sesuai dengan item');
    }

    if (batch.warehouseLocationId === input.locationId) {
      const nextQuantity = toNumber(batch.quantity) + input.quantityToAdd;
      await tx
        .update(inventoryBatches)
        .set({
          quantity: quantity(nextQuantity),
          status: 'active',
          unitCost: batch.unitCost === '0.00' ? input.unitCost : batch.unitCost,
        })
        .where(eq(inventoryBatches.id, batch.id));
      return batch.id;
    }

    const nextQuantity = input.quantityToAdd;
    const [existing] = await tx
      .select({ id: inventoryBatches.id, quantity: inventoryBatches.quantity })
      .from(inventoryBatches)
      .where(
        and(
          eq(inventoryBatches.inventoryItemId, input.itemId),
          eq(inventoryBatches.warehouseLocationId, input.locationId),
          eq(inventoryBatches.batchNumber, batch.batchNumber),
        ),
      )
      .limit(1);
    if (existing) {
      await tx
        .update(inventoryBatches)
        .set({
          quantity: quantity(toNumber(existing.quantity) + input.quantityToAdd),
          status: 'active',
        })
        .where(eq(inventoryBatches.id, existing.id));
      return existing.id;
    }

    const [created] = await tx
      .insert(inventoryBatches)
      .values({
        merchantId: input.merchantId,
        inventoryItemId: input.itemId,
        warehouseId: input.warehouseId,
        warehouseLocationId: input.locationId,
        batchNumber: batch.batchNumber,
        manufactureDate: batch.manufactureDate,
        expiryDate: batch.expiryDate,
        quantity: quantity(nextQuantity),
        unitCost: input.unitCost,
        status: 'active',
        notes: input.notes ?? batch.notes,
        createdBy: input.createdBy,
      })
      .returning({ id: inventoryBatches.id });
    return created!.id;
  }

  if (input.batchNumber) {
    const [existing] = await tx
      .select()
      .from(inventoryBatches)
      .where(
        and(
          eq(inventoryBatches.inventoryItemId, input.itemId),
          eq(inventoryBatches.warehouseLocationId, input.locationId),
          eq(inventoryBatches.batchNumber, input.batchNumber),
        ),
      )
      .limit(1);

    if (existing) {
      await tx
        .update(inventoryBatches)
        .set({
          quantity: quantity(toNumber(existing.quantity) + input.quantityToAdd),
          status: 'active',
          expiryDate: input.expiryDate ?? existing.expiryDate,
          manufactureDate: input.manufactureDate ?? existing.manufactureDate,
        })
        .where(eq(inventoryBatches.id, existing.id));
      return existing.id;
    }

    const [created] = await tx
      .insert(inventoryBatches)
      .values({
        merchantId: input.merchantId,
        inventoryItemId: input.itemId,
        warehouseId: input.warehouseId,
        warehouseLocationId: input.locationId,
        batchNumber: input.batchNumber,
        manufactureDate: input.manufactureDate ?? null,
        expiryDate: input.expiryDate ?? null,
        quantity: quantity(input.quantityToAdd),
        unitCost: input.unitCost,
        status: 'active',
        notes: input.notes ?? null,
        createdBy: input.createdBy,
      })
      .returning({ id: inventoryBatches.id });
    return created!.id;
  }

  return null;
}

async function applyOutboundBatch(
  tx: Tx,
  input: {
    itemId: string;
    locationId: string;
    quantityToRemove: number;
    batchId?: string | null;
    batchNumber?: string | null;
    itemLabel?: string;
  },
) {
  if (!input.batchId && !input.batchNumber) return;
  const [batch] = input.batchId
    ? await tx
        .select()
        .from(inventoryBatches)
        .where(eq(inventoryBatches.id, input.batchId))
        .limit(1)
    : await tx
        .select()
        .from(inventoryBatches)
        .where(
          and(
            eq(inventoryBatches.inventoryItemId, input.itemId),
            eq(inventoryBatches.warehouseLocationId, input.locationId),
            eq(inventoryBatches.batchNumber, input.batchNumber!),
          ),
        )
        .limit(1);
  if (!batch) {
    throw ApiError.badRequest(
      input.batchNumber
        ? `Batch ${input.batchNumber} tidak ditemukan pada lokasi sumber`
        : 'Batch tidak ditemukan',
    );
  }
  if (batch.inventoryItemId !== input.itemId) {
    throw ApiError.badRequest('Batch tidak sesuai dengan item');
  }
  if (batch.warehouseLocationId !== input.locationId) {
    throw ApiError.badRequest('Batch tidak berada di lokasi sumber');
  }

  const nextQuantity = toNumber(batch.quantity) - input.quantityToRemove;
  if (nextQuantity < 0) {
    throw ApiError.badRequest(
      `Stok batch ${input.itemLabel ?? 'item'} tidak mencukupi (tersedia ${quantity(
        toNumber(batch.quantity),
      )})`,
    );
  }

  await tx
    .update(inventoryBatches)
    .set({
      quantity: quantity(nextQuantity),
      status: nextQuantity === 0 ? 'depleted' : batch.status,
    })
    .where(eq(inventoryBatches.id, batch.id));
}

export interface MovementLineInput {
  inventoryItemId: string;
  quantity: string;
  unitCost: string;
  batchId?: string | null;
  batchNumber?: string | null;
  manufactureDate?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
}

export async function applyMovement(
  tx: Tx,
  input: {
    merchantId: string;
    movementNumber: string;
    type: 'inbound' | 'outbound' | 'transfer' | 'adjustment' | 'stock_count' | 'return';
    sourceWarehouseId?: string | null;
    sourceLocationId?: string | null;
    destinationWarehouseId?: string | null;
    destinationLocationId?: string | null;
    referenceType?: string | null;
    referenceId?: string | null;
    referenceNumber?: string | null;
    notes?: string | null;
    createdBy: string | null;
    lines: MovementLineInput[];
  },
) {
  if (input.lines.length === 0) throw ApiError.badRequest('Item pergerakan wajib diisi');

  let totalQuantity = 0;
  let totalCost = 0;
  for (const line of input.lines) {
    const qty = toNumber(line.quantity);
    if (qty <= 0) throw ApiError.badRequest('Jumlah harus lebih dari 0');
    totalQuantity += qty;
    totalCost += qty * toNumber(line.unitCost);
  }

  const [movement] = await tx
    .insert(stockMovements)
    .values({
      movementNumber: input.movementNumber,
      merchantId: input.merchantId,
      type: input.type,
      status: 'completed',
      sourceWarehouseId: input.sourceWarehouseId ?? null,
      sourceLocationId: input.sourceLocationId ?? null,
      destinationWarehouseId: input.destinationWarehouseId ?? null,
      destinationLocationId: input.destinationLocationId ?? null,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      referenceNumber: input.referenceNumber ?? null,
      notes: input.notes ?? null,
      totalQuantity: quantity(totalQuantity),
      totalCost: money(totalCost),
      createdBy: input.createdBy,
      completedBy: input.createdBy,
      completedAt: new Date(),
    })
    .returning();

  for (const line of input.lines) {
    const item = await tx.query.inventoryItems.findFirst({
      where: and(
        eq(inventoryItems.id, line.inventoryItemId),
        eq(inventoryItems.merchantId, input.merchantId),
        isNull(inventoryItems.deletedAt),
      ),
    });
    if (!item) throw ApiError.badRequest('Item persediaan tidak ditemukan');

    const lineQuantity = toNumber(line.quantity);
    const lineCost = lineQuantity * toNumber(line.unitCost);

    if (input.sourceLocationId) {
      await adjustStockBalance(tx, {
        merchantId: input.merchantId,
        warehouseId: input.sourceWarehouseId!,
        warehouseLocationId: input.sourceLocationId,
        inventoryItemId: line.inventoryItemId,
        delta: -lineQuantity,
        itemLabel: item.skuId ?? undefined,
      });
      await applyOutboundBatch(tx, {
        itemId: line.inventoryItemId,
        locationId: input.sourceLocationId,
        quantityToRemove: lineQuantity,
        batchId: line.batchId,
        batchNumber: line.batchNumber,
        itemLabel: item.skuId ?? undefined,
      });
    }

    if (input.destinationLocationId) {
      await adjustStockBalance(tx, {
        merchantId: input.merchantId,
        warehouseId: input.destinationWarehouseId!,
        warehouseLocationId: input.destinationLocationId,
        inventoryItemId: line.inventoryItemId,
        delta: lineQuantity,
        itemLabel: item.skuId ?? undefined,
      });
      await applyInboundBatch(tx, {
        merchantId: input.merchantId,
        itemId: line.inventoryItemId,
        warehouseId: input.destinationWarehouseId!,
        locationId: input.destinationLocationId,
        quantityToAdd: lineQuantity,
        unitCost: line.unitCost,
        createdBy: input.createdBy,
        batchId: line.batchId,
        batchNumber: line.batchNumber,
        manufactureDate: line.manufactureDate,
        expiryDate: line.expiryDate,
        notes: line.notes,
      });
    }

    await tx.insert(stockMovementItems).values({
      movementId: movement!.id,
      inventoryItemId: line.inventoryItemId,
      batchId: line.batchId ?? null,
      quantity: line.quantity,
      unitCost: line.unitCost,
      totalCost: money(lineCost),
      notes: line.notes ?? null,
    });
  }

  return movement!;
}

export async function getMovementDetail(movementId: string) {
  const sourceWarehouse = alias(warehouses, 'source_warehouse');
  const destinationWarehouse = alias(warehouses, 'destination_warehouse');
  const sourceLocation = alias(warehouseLocations, 'source_location');
  const destinationLocation = alias(warehouseLocations, 'destination_location');

  const [movement] = await db
    .select({
      id: stockMovements.id,
      movementNumber: stockMovements.movementNumber,
      merchantId: stockMovements.merchantId,
      merchantName: merchants.businessName,
      merchantCode: merchants.code,
      type: stockMovements.type,
      status: stockMovements.status,
      sourceWarehouseId: stockMovements.sourceWarehouseId,
      sourceWarehouseName: sourceWarehouse.name,
      sourceLocationId: stockMovements.sourceLocationId,
      sourceLocationName: sourceLocation.name,
      destinationWarehouseId: stockMovements.destinationWarehouseId,
      destinationWarehouseName: destinationWarehouse.name,
      destinationLocationId: stockMovements.destinationLocationId,
      destinationLocationName: destinationLocation.name,
      referenceType: stockMovements.referenceType,
      referenceId: stockMovements.referenceId,
      referenceNumber: stockMovements.referenceNumber,
      notes: stockMovements.notes,
      totalQuantity: stockMovements.totalQuantity,
      totalCost: stockMovements.totalCost,
      createdBy: stockMovements.createdBy,
      createdByName: users.fullName,
      completedAt: stockMovements.completedAt,
      createdAt: stockMovements.createdAt,
      updatedAt: stockMovements.updatedAt,
    })
    .from(stockMovements)
    .innerJoin(merchants, eq(merchants.id, stockMovements.merchantId))
    .leftJoin(sourceWarehouse, eq(sourceWarehouse.id, stockMovements.sourceWarehouseId))
    .leftJoin(
      destinationWarehouse,
      eq(destinationWarehouse.id, stockMovements.destinationWarehouseId),
    )
    .leftJoin(sourceLocation, eq(sourceLocation.id, stockMovements.sourceLocationId))
    .leftJoin(
      destinationLocation,
      eq(destinationLocation.id, stockMovements.destinationLocationId),
    )
    .leftJoin(users, eq(users.id, stockMovements.createdBy))
    .where(eq(stockMovements.id, movementId))
    .limit(1);

  if (!movement) throw ApiError.notFound('Pergerakan stok tidak ditemukan');

  const items = await db
    .select({
      id: stockMovementItems.id,
      inventoryItemId: stockMovementItems.inventoryItemId,
      batchId: stockMovementItems.batchId,
      quantity: stockMovementItems.quantity,
      unitCost: stockMovementItems.unitCost,
      totalCost: stockMovementItems.totalCost,
      notes: stockMovementItems.notes,
      productName: products.name,
      skuCode: productSkus.skuCode,
      createdAt: stockMovementItems.createdAt,
    })
    .from(stockMovementItems)
    .innerJoin(inventoryItems, eq(inventoryItems.id, stockMovementItems.inventoryItemId))
    .innerJoin(products, eq(products.id, inventoryItems.productId))
    .innerJoin(productSkus, eq(productSkus.id, inventoryItems.skuId))
    .where(eq(stockMovementItems.movementId, movementId));

  return { ...movement, items };
}

export async function assertLocationInWarehouse(
  warehouseId: string,
  locationId: string,
) {
  const location = await db.query.warehouseLocations.findFirst({
    where: and(
      eq(warehouseLocations.id, locationId),
      eq(warehouseLocations.warehouseId, warehouseId),
      isNull(warehouseLocations.deletedAt),
    ),
  });
  if (!location) throw ApiError.badRequest('Lokasi tidak termasuk gudang yang dipilih');
  return location;
}

export async function assertItemAccess(
  itemId: string,
  merchantId: string,
) {
  const item = await db.query.inventoryItems.findFirst({
    where: and(
      eq(inventoryItems.id, itemId),
      eq(inventoryItems.merchantId, merchantId),
      isNull(inventoryItems.deletedAt),
    ),
  });
  if (!item) throw ApiError.badRequest('Item persediaan tidak ditemukan');
  return item;
}
