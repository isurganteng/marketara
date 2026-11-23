import { and, asc, count, desc, eq, ilike, isNull, or, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  inventoryBatches,
  inventoryItems,
  merchants,
  productSkus,
  products,
  stockAdjustments,
  stockBalances,
  stockMovementItems,
  stockMovements,
  users,
  warehouseLocations,
  warehouses,
} from '../../db/schema';
import { assertMerchantAccess } from '../../lib/access';
import { writeAuditLog } from '../../lib/audit';
import type { AppEnv } from '../../lib/app-env';
import { ApiError } from '../../lib/errors';
import { getPagination, ok, paginated } from '../../lib/http';
import { generateCode } from '../../lib/slug';
import { validate } from '../../lib/validator';
import { requirePermission } from '../../middleware/auth';
import { getClientIp } from '../../services/auth';
import {
  applyMovement,
  assertItemAccess,
  assertLocationInWarehouse,
  getMovementDetail,
  getStockMovement,
  getWarehouse,
  inventoryScopeCondition,
  money,
  quantity,
  toNumber,
  type MovementLineInput,
} from './shared';

const movementTypeSchema = z.enum(['inbound', 'outbound', 'transfer', 'return']);
const movementStatusSchema = z.enum(['completed', 'cancelled']);
const adjustmentTypeSchema = z.enum([
  'increase',
  'decrease',
  'correction',
  'damage',
  'loss',
  'other',
]);

const numericSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine(
    (value) => value.trim() !== '' && !Number.isNaN(Number(value)) && Number(value) > 0,
    'Harus berupa angka lebih dari 0',
  );

const optionalNumericSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine(
    (value) => value.trim() !== '' && !Number.isNaN(Number(value)) && Number(value) >= 0,
    'Harus berupa angka >= 0',
  );

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Gunakan format YYYY-MM-DD');

const listMovementsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  warehouseId: z.uuid().optional(),
  type: z.enum(['inbound', 'outbound', 'transfer', 'adjustment', 'stock_count', 'return']).optional(),
  status: movementStatusSchema.optional(),
});

const movementLineSchema = z.object({
  inventoryItemId: z.uuid(),
  quantity: numericSchema,
  unitCost: optionalNumericSchema.optional(),
  batchId: z.uuid().optional(),
  batchNumber: z.string().trim().max(100).optional(),
  manufactureDate: dateOnlySchema.optional(),
  expiryDate: dateOnlySchema.optional(),
  notes: z.string().trim().max(1000).optional(),
});

const createMovementSchema = z.object({
  type: movementTypeSchema,
  sourceWarehouseId: z.uuid().optional(),
  sourceLocationId: z.uuid().optional(),
  destinationWarehouseId: z.uuid().optional(),
  destinationLocationId: z.uuid().optional(),
  referenceType: z.string().trim().max(64).optional(),
  referenceNumber: z.string().trim().max(128).optional(),
  notes: z.string().trim().max(2000).optional(),
  items: z.array(movementLineSchema).min(1).max(100),
});

const listAdjustmentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  warehouseId: z.uuid().optional(),
  type: adjustmentTypeSchema.optional(),
});

const createAdjustmentSchema = z.object({
  warehouseId: z.uuid(),
  warehouseLocationId: z.uuid(),
  inventoryItemId: z.uuid(),
  type: adjustmentTypeSchema,
  quantity: optionalNumericSchema,
  reason: z.string().trim().min(3).max(2000),
  notes: z.string().trim().max(2000).optional(),
});

export const inventoryMovementRoutes = new Hono<AppEnv>();

/* ----------------------------- Movements ---------------------------- */

inventoryMovementRoutes.get(
  '/movements',
  requirePermission('inventory:read'),
  validate('query', listMovementsSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];

    const scope = inventoryScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(stockMovements.merchantId, query.merchantId));
    if (query.warehouseId) {
      conditions.push(
        or(
          eq(stockMovements.sourceWarehouseId, query.warehouseId),
          eq(stockMovements.destinationWarehouseId, query.warehouseId),
        ) as SQL,
      );
    }
    if (query.type) conditions.push(eq(stockMovements.type, query.type));
    if (query.status) conditions.push(eq(stockMovements.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(stockMovements.movementNumber, term),
          ilike(stockMovements.referenceNumber, term),
          ilike(stockMovements.notes, term),
          ilike(merchants.businessName, term),
        ) as SQL,
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: stockMovements.id,
          movementNumber: stockMovements.movementNumber,
          merchantId: stockMovements.merchantId,
          merchantName: merchants.businessName,
          merchantCode: merchants.code,
          type: stockMovements.type,
          status: stockMovements.status,
          sourceWarehouseId: stockMovements.sourceWarehouseId,
          sourceLocationId: stockMovements.sourceLocationId,
          destinationWarehouseId: stockMovements.destinationWarehouseId,
          destinationLocationId: stockMovements.destinationLocationId,
          referenceType: stockMovements.referenceType,
          referenceNumber: stockMovements.referenceNumber,
          notes: stockMovements.notes,
          totalQuantity: stockMovements.totalQuantity,
          totalCost: stockMovements.totalCost,
          createdBy: stockMovements.createdBy,
          createdByName: users.fullName,
          completedAt: stockMovements.completedAt,
          createdAt: stockMovements.createdAt,
        })
        .from(stockMovements)
        .innerJoin(merchants, eq(merchants.id, stockMovements.merchantId))
        .leftJoin(users, eq(users.id, stockMovements.createdBy))
        .where(where)
        .orderBy(desc(stockMovements.completedAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ value: count() })
        .from(stockMovements)
        .innerJoin(merchants, eq(merchants.id, stockMovements.merchantId))
        .where(where),
    ]);

    const enriched = await Promise.all(
      rows.map(async (row) => {
        const [sourceWarehouse] = row.sourceWarehouseId
          ? await db
              .select({ name: warehouses.name })
              .from(warehouses)
              .where(eq(warehouses.id, row.sourceWarehouseId))
              .limit(1)
          : [];
        const [destinationWarehouse] = row.destinationWarehouseId
          ? await db
              .select({ name: warehouses.name })
              .from(warehouses)
              .where(eq(warehouses.id, row.destinationWarehouseId))
              .limit(1)
          : [];
        return {
          ...row,
          sourceWarehouseName: sourceWarehouse?.name ?? null,
          destinationWarehouseName: destinationWarehouse?.name ?? null,
        };
      }),
    );

    return paginated(c, enriched, Number(totalRow?.value ?? 0), pagination);
  },
);

inventoryMovementRoutes.get(
  '/movements/:movementId',
  requirePermission('inventory:read'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    await getStockMovement(c.req.param('movementId'), user, permissions);
    const detail = await getMovementDetail(c.req.param('movementId'));
    return ok(c, detail);
  },
);

inventoryMovementRoutes.post(
  '/movements',
  requirePermission('inventory:write'),
  validate('json', createMovementSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');

    let merchantId: string | null = null;

    if (body.sourceWarehouseId) {
      const access = await getWarehouse(body.sourceWarehouseId, user, permissions);
      merchantId = access.warehouse.merchantId;
    }
    if (body.destinationWarehouseId) {
      const access = await getWarehouse(body.destinationWarehouseId, user, permissions);
      if (merchantId && merchantId !== access.warehouse.merchantId) {
        throw ApiError.badRequest('Gudang sumber dan tujuan harus milik pedagang yang sama');
      }
      merchantId = access.warehouse.merchantId;
    }

    if (!merchantId) throw ApiError.badRequest('Gudang sumber atau tujuan wajib diisi');

    if (body.sourceLocationId) {
      if (!body.sourceWarehouseId) throw ApiError.badRequest('Gudang sumber wajib diisi');
      await assertLocationInWarehouse(body.sourceWarehouseId, body.sourceLocationId);
    }
    if (body.destinationLocationId) {
      if (!body.destinationWarehouseId) throw ApiError.badRequest('Gudang tujuan wajib diisi');
      await assertLocationInWarehouse(body.destinationWarehouseId, body.destinationLocationId);
    }

    const hasSource = Boolean(body.sourceLocationId);
    const hasDestination = Boolean(body.destinationLocationId);
    if ((body.type === 'inbound' || body.type === 'return') && !hasDestination) {
      throw ApiError.badRequest('Lokasi tujuan wajib diisi untuk barang masuk');
    }
    if ((body.type === 'inbound' || body.type === 'return') && hasSource) {
      throw ApiError.badRequest('Barang masuk hanya memerlukan lokasi tujuan');
    }
    if (body.type === 'outbound' && !hasSource) {
      throw ApiError.badRequest('Lokasi sumber wajib diisi untuk barang keluar');
    }
    if (body.type === 'outbound' && hasDestination) {
      throw ApiError.badRequest('Barang keluar hanya memerlukan lokasi sumber');
    }
    if (body.type === 'transfer' && (!hasSource || !hasDestination)) {
      throw ApiError.badRequest('Lokasi sumber dan tujuan wajib diisi untuk transfer');
    }
    if (body.type === 'transfer' && body.sourceLocationId === body.destinationLocationId) {
      throw ApiError.badRequest('Lokasi sumber dan tujuan transfer tidak boleh sama');
    }

    const lines: MovementLineInput[] = [];
    for (const line of body.items) {
      const item = await assertItemAccess(line.inventoryItemId, merchantId);
      const unitCost =
        line.unitCost !== undefined && Number(line.unitCost) >= 0
          ? money(Number(line.unitCost))
          : money(toNumber(item.unitCost));
      if (line.batchId) {
        const batch = await db.query.inventoryBatches.findFirst({
          where: and(
            eq(inventoryBatches.id, line.batchId),
            eq(inventoryBatches.merchantId, merchantId),
          ),
        });
        if (!batch) throw ApiError.badRequest('Batch tidak ditemukan');
      }
      lines.push({
        inventoryItemId: line.inventoryItemId,
        quantity: quantity(Number(line.quantity)),
        unitCost,
        batchId: line.batchId ?? null,
        batchNumber: line.batchNumber ?? null,
        manufactureDate: line.manufactureDate ?? null,
        expiryDate: line.expiryDate ?? null,
        notes: line.notes ?? null,
      });
    }

    const movement = await db.transaction(async (tx) => {
      return applyMovement(tx, {
        merchantId,
        movementNumber: generateCode('MOV'),
        type: body.type,
        sourceWarehouseId: hasSource ? body.sourceWarehouseId : null,
        sourceLocationId: hasSource ? body.sourceLocationId : null,
        destinationWarehouseId: hasDestination ? body.destinationWarehouseId : null,
        destinationLocationId: hasDestination ? body.destinationLocationId : null,
        referenceType: body.referenceType ?? null,
        referenceNumber: body.referenceNumber ?? null,
        notes: body.notes ?? null,
        createdBy: user.id,
        lines,
      });
    });

    await writeAuditLog({
      actorUserId: user.id,
      action: 'inventory.movement.create',
      entityType: 'stock_movement',
      entityId: movement.id,
      newValues: {
        merchantId,
        type: movement.type,
        sourceWarehouseId: body.sourceWarehouseId,
        destinationWarehouseId: body.destinationWarehouseId,
      },
      ipAddress: getClientIp(c),
    });

    return ok(c, await getMovementDetail(movement.id), 201);
  },
);

/* ---------------------------- Adjustments --------------------------- */

inventoryMovementRoutes.get(
  '/adjustments',
  requirePermission('inventory:read'),
  validate('query', listAdjustmentsSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];

    const scope = inventoryScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(stockAdjustments.merchantId, query.merchantId));
    if (query.warehouseId) conditions.push(eq(stockAdjustments.warehouseId, query.warehouseId));
    if (query.type) conditions.push(eq(stockAdjustments.type, query.type));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(stockAdjustments.adjustmentNumber, term),
          ilike(stockAdjustments.reason, term),
          ilike(products.name, term),
          ilike(productSkus.skuCode, term),
        ) as SQL,
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: stockAdjustments.id,
          adjustmentNumber: stockAdjustments.adjustmentNumber,
          merchantId: stockAdjustments.merchantId,
          merchantName: merchants.businessName,
          warehouseId: stockAdjustments.warehouseId,
          warehouseName: warehouses.name,
          warehouseLocationId: stockAdjustments.warehouseLocationId,
          locationName: warehouseLocations.name,
          inventoryItemId: stockAdjustments.inventoryItemId,
          productName: products.name,
          skuCode: productSkus.skuCode,
          type: stockAdjustments.type,
          quantity: stockAdjustments.quantity,
          beforeQuantity: stockAdjustments.beforeQuantity,
          afterQuantity: stockAdjustments.afterQuantity,
          reason: stockAdjustments.reason,
          movementId: stockAdjustments.movementId,
          createdBy: stockAdjustments.createdBy,
          createdByName: users.fullName,
          approvedAt: stockAdjustments.approvedAt,
          createdAt: stockAdjustments.createdAt,
        })
        .from(stockAdjustments)
        .innerJoin(merchants, eq(merchants.id, stockAdjustments.merchantId))
        .innerJoin(warehouses, eq(warehouses.id, stockAdjustments.warehouseId))
        .innerJoin(warehouseLocations, eq(warehouseLocations.id, stockAdjustments.warehouseLocationId))
        .innerJoin(inventoryItems, eq(inventoryItems.id, stockAdjustments.inventoryItemId))
        .innerJoin(products, eq(products.id, inventoryItems.productId))
        .innerJoin(productSkus, eq(productSkus.id, inventoryItems.skuId))
        .leftJoin(users, eq(users.id, stockAdjustments.createdBy))
        .where(where)
        .orderBy(desc(stockAdjustments.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ value: count() })
        .from(stockAdjustments)
        .innerJoin(merchants, eq(merchants.id, stockAdjustments.merchantId))
        .innerJoin(inventoryItems, eq(inventoryItems.id, stockAdjustments.inventoryItemId))
        .innerJoin(products, eq(products.id, inventoryItems.productId))
        .innerJoin(productSkus, eq(productSkus.id, inventoryItems.skuId))
        .where(where),
    ]);

    return paginated(c, rows, Number(totalRow?.value ?? 0), pagination);
  },
);

inventoryMovementRoutes.get(
  '/adjustments/:adjustmentId',
  requirePermission('inventory:read'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');

    const [row] = await db
      .select({
        id: stockAdjustments.id,
        adjustmentNumber: stockAdjustments.adjustmentNumber,
        merchantId: stockAdjustments.merchantId,
        merchantName: merchants.businessName,
        warehouseId: stockAdjustments.warehouseId,
        warehouseName: warehouses.name,
        warehouseLocationId: stockAdjustments.warehouseLocationId,
        locationName: warehouseLocations.name,
        inventoryItemId: stockAdjustments.inventoryItemId,
        productName: products.name,
        skuCode: productSkus.skuCode,
        type: stockAdjustments.type,
        quantity: stockAdjustments.quantity,
        beforeQuantity: stockAdjustments.beforeQuantity,
        afterQuantity: stockAdjustments.afterQuantity,
        reason: stockAdjustments.reason,
        movementId: stockAdjustments.movementId,
        createdBy: stockAdjustments.createdBy,
        createdByName: users.fullName,
        approvedAt: stockAdjustments.approvedAt,
        createdAt: stockAdjustments.createdAt,
      })
      .from(stockAdjustments)
      .innerJoin(merchants, eq(merchants.id, stockAdjustments.merchantId))
      .innerJoin(warehouses, eq(warehouses.id, stockAdjustments.warehouseId))
      .innerJoin(warehouseLocations, eq(warehouseLocations.id, stockAdjustments.warehouseLocationId))
      .innerJoin(inventoryItems, eq(inventoryItems.id, stockAdjustments.inventoryItemId))
      .innerJoin(products, eq(products.id, inventoryItems.productId))
      .innerJoin(productSkus, eq(productSkus.id, inventoryItems.skuId))
      .leftJoin(users, eq(users.id, stockAdjustments.createdBy))
      .where(eq(stockAdjustments.id, c.req.param('adjustmentId')))
      .limit(1);

    if (!row) throw ApiError.notFound('Penyesuaian stok tidak ditemukan');
    await assertMerchantAccess(row.merchantId, user, permissions);
    return ok(c, row);
  },
);

inventoryMovementRoutes.post(
  '/adjustments',
  requirePermission('inventory:write'),
  validate('json', createAdjustmentSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');

    const { warehouse } = await getWarehouse(body.warehouseId, user, permissions);
    await assertLocationInWarehouse(body.warehouseId, body.warehouseLocationId);
    const item = await assertItemAccess(body.inventoryItemId, warehouse.merchantId);

    const [balance] = await db
      .select({ quantity: stockBalances.quantity })
      .from(stockBalances)
      .where(
        and(
          eq(stockBalances.warehouseLocationId, body.warehouseLocationId),
          eq(stockBalances.inventoryItemId, body.inventoryItemId),
        ),
      )
      .limit(1);

    const before = toNumber(balance?.quantity);
    const inputQuantity = Number(body.quantity);
    if (body.type !== 'correction' && inputQuantity <= 0) {
      throw ApiError.badRequest('Jumlah penyesuaian harus lebih dari 0');
    }
    const delta =
      body.type === 'correction'
        ? inputQuantity - before
        : body.type === 'increase' || body.type === 'other'
          ? inputQuantity
          : -inputQuantity;

    if (delta === 0) throw ApiError.badRequest('Tidak ada perubahan stok');

    const adjustment = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(stockAdjustments)
        .values({
          adjustmentNumber: generateCode('ADJ'),
          merchantId: warehouse.merchantId,
          warehouseId: body.warehouseId,
          warehouseLocationId: body.warehouseLocationId,
          inventoryItemId: body.inventoryItemId,
          type: body.type,
          quantity: quantity(inputQuantity),
          beforeQuantity: quantity(before),
          afterQuantity: quantity(before + delta),
          reason: body.reason,
          createdBy: user.id,
          approvedBy: user.id,
          approvedAt: new Date(),
        })
        .returning();

      const movement = await applyMovement(tx, {
        merchantId: warehouse.merchantId,
        movementNumber: generateCode('MOV'),
        type: 'adjustment',
        sourceWarehouseId: delta < 0 ? body.warehouseId : null,
        sourceLocationId: delta < 0 ? body.warehouseLocationId : null,
        destinationWarehouseId: delta > 0 ? body.warehouseId : null,
        destinationLocationId: delta > 0 ? body.warehouseLocationId : null,
        referenceType: 'stock_adjustment',
        referenceId: created!.id,
        referenceNumber: created!.adjustmentNumber,
        notes: body.notes ?? body.reason,
        createdBy: user.id,
        lines: [
          {
            inventoryItemId: body.inventoryItemId,
            quantity: quantity(Math.abs(delta)),
            unitCost: money(toNumber(item.unitCost)),
            notes: body.notes ?? null,
          },
        ],
      });

      await tx
        .update(stockAdjustments)
        .set({ movementId: movement.id })
        .where(eq(stockAdjustments.id, created!.id));

      return { ...created!, movementId: movement.id };
    });

    await writeAuditLog({
      actorUserId: user.id,
      action: 'inventory.adjustment.create',
      entityType: 'stock_adjustment',
      entityId: adjustment.id,
      newValues: {
        merchantId: warehouse.merchantId,
        type: body.type,
        before,
        after: before + delta,
      },
      ipAddress: getClientIp(c),
    });

    return ok(c, adjustment, 201);
  },
);
