import { and, asc, count, desc, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  inventoryItems,
  merchants,
  productSkus,
  products,
  stockAdjustments,
  stockBalances,
  stockCountItems,
  stockCounts,
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
import type { AuthUser } from '../../types';
import {
  applyMovement,
  assertLocationInWarehouse,
  inventoryScopeCondition,
  money,
  quantity,
  toNumber,
} from './shared';

const countStatusSchema = z.enum(['draft', 'counting', 'completed', 'cancelled']);

const numericSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine(
    (value) => value.trim() !== '' && !Number.isNaN(Number(value)) && Number(value) >= 0,
    'Harus berupa angka >= 0',
  );

const listCountsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  warehouseId: z.uuid().optional(),
  status: countStatusSchema.optional(),
});

const createCountSchema = z.object({
  warehouseId: z.uuid(),
  warehouseLocationId: z.uuid(),
  notes: z.string().trim().max(2000).optional(),
});

const updateCountItemSchema = z.object({
  countedQuantity: numericSchema,
  notes: z.string().trim().max(1000).optional(),
});

export const inventoryCountRoutes = new Hono<AppEnv>();

async function getCountRecord(countId: string, user: AuthUser, permissions: Set<string>) {
  const count = await db.query.stockCounts.findFirst({
    where: eq(stockCounts.id, countId),
  });
  if (!count) throw ApiError.notFound('Opname stok tidak ditemukan');
  const access = await assertMerchantAccess(count.merchantId, user, permissions);
  return { count, ...access };
}

inventoryCountRoutes.get(
  '/stock-counts',
  requirePermission('inventory:read'),
  validate('query', listCountsSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];

    const scope = inventoryScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(stockCounts.merchantId, query.merchantId));
    if (query.warehouseId) conditions.push(eq(stockCounts.warehouseId, query.warehouseId));
    if (query.status) conditions.push(eq(stockCounts.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(stockCounts.countNumber, term),
          ilike(stockCounts.notes, term),
          ilike(warehouses.name, term),
          ilike(warehouseLocations.name, term),
        ) as SQL,
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: stockCounts.id,
          countNumber: stockCounts.countNumber,
          merchantId: stockCounts.merchantId,
          merchantName: merchants.businessName,
          warehouseId: stockCounts.warehouseId,
          warehouseName: warehouses.name,
          warehouseLocationId: stockCounts.warehouseLocationId,
          locationName: warehouseLocations.name,
          status: stockCounts.status,
          notes: stockCounts.notes,
          startedAt: stockCounts.startedAt,
          completedAt: stockCounts.completedAt,
          createdBy: stockCounts.createdBy,
          createdByName: users.fullName,
          createdAt: stockCounts.createdAt,
          itemCount: sql<number>`(
            select count(*) from inventory.stock_count_items sci
            where sci.count_id = ${stockCounts.id}
          )`,
          countedCount: sql<number>`(
            select count(*) from inventory.stock_count_items sci
            where sci.count_id = ${stockCounts.id} and sci.counted_quantity is not null
          )`,
        })
        .from(stockCounts)
        .innerJoin(merchants, eq(merchants.id, stockCounts.merchantId))
        .innerJoin(warehouses, eq(warehouses.id, stockCounts.warehouseId))
        .innerJoin(warehouseLocations, eq(warehouseLocations.id, stockCounts.warehouseLocationId))
        .leftJoin(users, eq(users.id, stockCounts.createdBy))
        .where(where)
        .orderBy(desc(stockCounts.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ value: count() })
        .from(stockCounts)
        .innerJoin(merchants, eq(merchants.id, stockCounts.merchantId))
        .innerJoin(warehouses, eq(warehouses.id, stockCounts.warehouseId))
        .innerJoin(warehouseLocations, eq(warehouseLocations.id, stockCounts.warehouseLocationId))
        .where(where),
    ]);

    return paginated(c, rows, Number(totalRow?.value ?? 0), pagination);
  },
);

inventoryCountRoutes.post(
  '/stock-counts',
  requirePermission('inventory:write'),
  validate('json', createCountSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');

    const [warehouse] = await db
      .select()
      .from(warehouses)
      .where(and(eq(warehouses.id, body.warehouseId), isNull(warehouses.deletedAt)))
      .limit(1);
    if (!warehouse) throw ApiError.notFound('Gudang tidak ditemukan');
    await assertMerchantAccess(warehouse.merchantId, user, permissions);
    await assertLocationInWarehouse(body.warehouseId, body.warehouseLocationId);

    const balances = await db
      .select({
        inventoryItemId: stockBalances.inventoryItemId,
        quantity: stockBalances.quantity,
        unitCost: inventoryItems.unitCost,
      })
      .from(stockBalances)
      .innerJoin(inventoryItems, eq(inventoryItems.id, stockBalances.inventoryItemId))
      .where(eq(stockBalances.warehouseLocationId, body.warehouseLocationId));

    if (balances.length === 0) {
      throw ApiError.badRequest('Tidak ada saldo stok pada lokasi ini');
    }

    const created = await db.transaction(async (tx) => {
      const [countRow] = await tx
        .insert(stockCounts)
        .values({
          countNumber: generateCode('CNT'),
          merchantId: warehouse.merchantId,
          warehouseId: body.warehouseId,
          warehouseLocationId: body.warehouseLocationId,
          status: 'counting',
          notes: body.notes ?? null,
          startedAt: new Date(),
          createdBy: user.id,
        })
        .returning();

      await tx.insert(stockCountItems).values(
        balances.map((balance) => ({
          countId: countRow!.id,
          inventoryItemId: balance.inventoryItemId,
          systemQuantity: balance.quantity,
          unitCost: balance.unitCost,
        })),
      );

      return countRow!;
    });

    await writeAuditLog({
      actorUserId: user.id,
      action: 'inventory.stock_count.create',
      entityType: 'stock_count',
      entityId: created.id,
      newValues: { warehouseId: body.warehouseId, locationId: body.warehouseLocationId },
      ipAddress: getClientIp(c),
    });

    return ok(c, created, 201);
  },
);

inventoryCountRoutes.get(
  '/stock-counts/:countId',
  requirePermission('inventory:read'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { count: countRow } = await getCountRecord(c.req.param('countId'), user, permissions);

    const [header] = await db
      .select({
        id: stockCounts.id,
        countNumber: stockCounts.countNumber,
        merchantId: stockCounts.merchantId,
        merchantName: merchants.businessName,
        warehouseId: stockCounts.warehouseId,
        warehouseName: warehouses.name,
        warehouseLocationId: stockCounts.warehouseLocationId,
        locationName: warehouseLocations.name,
        status: stockCounts.status,
        notes: stockCounts.notes,
        startedAt: stockCounts.startedAt,
        completedAt: stockCounts.completedAt,
        createdBy: stockCounts.createdBy,
        createdByName: users.fullName,
        createdAt: stockCounts.createdAt,
        updatedAt: stockCounts.updatedAt,
      })
      .from(stockCounts)
      .innerJoin(merchants, eq(merchants.id, stockCounts.merchantId))
      .innerJoin(warehouses, eq(warehouses.id, stockCounts.warehouseId))
      .innerJoin(warehouseLocations, eq(warehouseLocations.id, stockCounts.warehouseLocationId))
      .leftJoin(users, eq(users.id, stockCounts.createdBy))
      .where(eq(stockCounts.id, countRow.id))
      .limit(1);

    const items = await db
      .select({
        id: stockCountItems.id,
        inventoryItemId: stockCountItems.inventoryItemId,
        productName: products.name,
        skuCode: productSkus.skuCode,
        systemQuantity: stockCountItems.systemQuantity,
        countedQuantity: stockCountItems.countedQuantity,
        differenceQuantity: stockCountItems.differenceQuantity,
        unitCost: stockCountItems.unitCost,
        notes: stockCountItems.notes,
        updatedAt: stockCountItems.updatedAt,
      })
      .from(stockCountItems)
      .innerJoin(inventoryItems, eq(inventoryItems.id, stockCountItems.inventoryItemId))
      .innerJoin(products, eq(products.id, inventoryItems.productId))
      .innerJoin(productSkus, eq(productSkus.id, inventoryItems.skuId))
      .where(eq(stockCountItems.countId, countRow.id))
      .orderBy(asc(products.name), asc(productSkus.skuCode));

    return ok(c, { ...header, items });
  },
);

inventoryCountRoutes.patch(
  '/stock-counts/:countId/items/:itemId',
  requirePermission('inventory:write'),
  validate('json', updateCountItemSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { count: countRow } = await getCountRecord(c.req.param('countId'), user, permissions);

    if (countRow.status !== 'counting' && countRow.status !== 'draft') {
      throw ApiError.badRequest('Opname sudah dikunci dan tidak dapat diubah');
    }

    const [item] = await db
      .select()
      .from(stockCountItems)
      .where(
        and(
          eq(stockCountItems.id, c.req.param('itemId')),
          eq(stockCountItems.countId, countRow.id),
        ),
      )
      .limit(1);
    if (!item) throw ApiError.notFound('Item opname tidak ditemukan');

    const counted = Number(body.countedQuantity);
    const difference = counted - toNumber(item.systemQuantity);

    const [updated] = await db
      .update(stockCountItems)
      .set({
        countedQuantity: quantity(counted),
        differenceQuantity: quantity(difference),
        notes: body.notes ?? null,
      })
      .where(eq(stockCountItems.id, item.id))
      .returning();

    return ok(c, updated);
  },
);

inventoryCountRoutes.post(
  '/stock-counts/:countId/complete',
  requirePermission('inventory:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { count: countRow } = await getCountRecord(c.req.param('countId'), user, permissions);

    if (countRow.status !== 'counting' && countRow.status !== 'draft') {
      throw ApiError.badRequest('Opname tidak dalam status berjalan');
    }

    const items = await db
      .select({
        id: stockCountItems.id,
        inventoryItemId: stockCountItems.inventoryItemId,
        systemQuantity: stockCountItems.systemQuantity,
        countedQuantity: stockCountItems.countedQuantity,
        unitCost: stockCountItems.unitCost,
      })
      .from(stockCountItems)
      .where(eq(stockCountItems.countId, countRow.id));

    const uncounted = items.filter((item) => item.countedQuantity === null);
    if (uncounted.length > 0) {
      throw ApiError.badRequest(
        `Masih ada ${uncounted.length} item yang belum dihitung`,
      );
    }

    await db.transaction(async (tx) => {
      for (const item of items) {
        const [balance] = await tx
          .select({ quantity: stockBalances.quantity })
          .from(stockBalances)
          .where(
            and(
              eq(stockBalances.warehouseLocationId, countRow.warehouseLocationId),
              eq(stockBalances.inventoryItemId, item.inventoryItemId),
            ),
          )
          .limit(1);

        const current = toNumber(balance?.quantity);
        const counted = toNumber(item.countedQuantity);
        const delta = counted - current;
        if (delta === 0) continue;

        const [adjustment] = await tx
          .insert(stockAdjustments)
          .values({
            adjustmentNumber: generateCode('ADJ'),
            merchantId: countRow.merchantId,
            warehouseId: countRow.warehouseId,
            warehouseLocationId: countRow.warehouseLocationId,
            inventoryItemId: item.inventoryItemId,
            type: delta > 0 ? 'increase' : 'decrease',
            quantity: quantity(Math.abs(delta)),
            beforeQuantity: quantity(current),
            afterQuantity: quantity(counted),
            reason: `Opname ${countRow.countNumber}`,
            createdBy: user.id,
            approvedBy: user.id,
            approvedAt: new Date(),
          })
          .returning();

        const movement = await applyMovement(tx, {
          merchantId: countRow.merchantId,
          movementNumber: generateCode('MOV'),
          type: 'stock_count',
          sourceWarehouseId: delta < 0 ? countRow.warehouseId : null,
          sourceLocationId: delta < 0 ? countRow.warehouseLocationId : null,
          destinationWarehouseId: delta > 0 ? countRow.warehouseId : null,
          destinationLocationId: delta > 0 ? countRow.warehouseLocationId : null,
          referenceType: 'stock_count',
          referenceId: countRow.id,
          referenceNumber: countRow.countNumber,
          notes: `Penyesuaian otomatis opname ${countRow.countNumber}`,
          createdBy: user.id,
          lines: [
            {
              inventoryItemId: item.inventoryItemId,
              quantity: quantity(Math.abs(delta)),
              unitCost: money(toNumber(item.unitCost)),
            },
          ],
        });

        await tx
          .update(stockAdjustments)
          .set({ movementId: movement.id })
          .where(eq(stockAdjustments.id, adjustment!.id));
      }

      await tx
        .update(stockCounts)
        .set({
          status: 'completed',
          completedAt: new Date(),
          completedBy: user.id,
        })
        .where(eq(stockCounts.id, countRow.id));
    });

    await writeAuditLog({
      actorUserId: user.id,
      action: 'inventory.stock_count.complete',
      entityType: 'stock_count',
      entityId: countRow.id,
      newValues: { countNumber: countRow.countNumber },
      ipAddress: getClientIp(c),
    });

    return ok(c, {
      id: countRow.id,
      countNumber: countRow.countNumber,
      status: 'completed',
    });
  },
);

inventoryCountRoutes.post(
  '/stock-counts/:countId/cancel',
  requirePermission('inventory:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { count: countRow } = await getCountRecord(c.req.param('countId'), user, permissions);

    if (countRow.status === 'completed') {
      throw ApiError.badRequest('Opname yang sudah selesai tidak dapat dibatalkan');
    }
    if (countRow.status === 'cancelled') {
      return ok(c, { id: countRow.id, status: 'cancelled' });
    }

    await db
      .update(stockCounts)
      .set({ status: 'cancelled', completedAt: new Date(), completedBy: user.id })
      .where(eq(stockCounts.id, countRow.id));

    await writeAuditLog({
      actorUserId: user.id,
      action: 'inventory.stock_count.cancel',
      entityType: 'stock_count',
      entityId: countRow.id,
      newValues: { countNumber: countRow.countNumber },
      ipAddress: getClientIp(c),
    });

    return ok(c, { id: countRow.id, status: 'cancelled' });
  },
);
