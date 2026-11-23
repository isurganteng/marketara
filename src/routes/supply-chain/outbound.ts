import { and, asc, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  dispatchRecords,
  fulfillmentStatusHistories,
  inventoryItems,
  merchants,
  orders,
  packingTasks,
  pickingItems,
  pickingTasks,
  products,
  stockBalances,
  users,
  warehouseAllocations,
  warehouseLocations,
  warehouseReturns,
  warehouses,
} from '../../db/schema';
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
  assertSupplyChainAccess,
  getAllocation,
  getDispatch,
  getInventoryItem,
  getPackingTask,
  getPickingTask,
  getWarehouse,
  getWarehouseLocation,
  getWarehouseReturn,
  numericSchema,
  optionalNumericSchema,
  quantity,
  recordFulfillmentHistory,
  supplyChainScopeCondition,
  toNumber,
  type MovementLineInput,
} from './shared';

const prioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);
const pickingStatusSchema = z.enum(['pending', 'in_progress', 'picked', 'cancelled']);
const packingStatusSchema = z.enum(['pending', 'packing', 'packed', 'cancelled']);
const dispatchStatusSchema = z.enum([
  'pending',
  'dispatched',
  'in_transit',
  'delivered',
  'failed',
  'returned',
  'cancelled',
]);
const returnStatusSchema = z.enum([
  'requested',
  'approved',
  'received',
  'restocked',
  'rejected',
  'cancelled',
]);

const pickingItemInputSchema = z.object({
  allocationId: z.uuid().optional(),
  inventoryItemId: z.uuid().optional(),
  warehouseLocationId: z.uuid().optional(),
  quantity: numericSchema.optional(),
  batchNumber: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(1000).optional(),
});

const createPickingSchema = z.object({
  merchantId: z.uuid(),
  warehouseId: z.uuid(),
  allocationId: z.uuid().optional(),
  orderId: z.uuid().optional(),
  priority: prioritySchema.default('normal'),
  assignedTo: z.uuid().optional(),
  notes: z.string().trim().max(2000).optional(),
  items: z.array(pickingItemInputSchema).max(100).optional(),
});

const completePickingSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.uuid(),
        pickedQuantity: optionalNumericSchema,
      }),
    )
    .default([]),
});

const listPickingSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  warehouseId: z.uuid().optional(),
  orderId: z.uuid().optional(),
  status: pickingStatusSchema.optional(),
});

const createPackingSchema = z.object({
  merchantId: z.uuid(),
  warehouseId: z.uuid(),
  pickingTaskId: z.uuid().optional(),
  orderId: z.uuid().optional(),
  packageCount: z.coerce.number().int().min(1).max(1000).default(1),
  weightGram: z.coerce.number().int().min(0).optional(),
  dimensions: z.string().trim().max(64).optional(),
  assignedTo: z.uuid().optional(),
  notes: z.string().trim().max(2000).optional(),
});

const listPackingSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  warehouseId: z.uuid().optional(),
  orderId: z.uuid().optional(),
  status: packingStatusSchema.optional(),
});

const createDispatchSchema = z.object({
  merchantId: z.uuid(),
  warehouseId: z.uuid(),
  packingTaskId: z.uuid().optional(),
  orderId: z.uuid().optional(),
  courierName: z.string().trim().max(255).optional(),
  trackingNumber: z.string().trim().max(128).optional(),
  vehicleNumber: z.string().trim().max(64).optional(),
  recipientName: z.string().trim().max(255).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const listDispatchSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  warehouseId: z.uuid().optional(),
  orderId: z.uuid().optional(),
  status: dispatchStatusSchema.optional(),
});

const createReturnSchema = z.object({
  merchantId: z.uuid(),
  warehouseId: z.uuid(),
  warehouseLocationId: z.uuid(),
  orderId: z.uuid().optional(),
  orderReturnId: z.uuid().optional(),
  inventoryItemId: z.uuid().optional(),
  quantity: numericSchema,
  reason: z.string().trim().min(3).max(2000),
  notes: z.string().trim().max(2000).optional(),
});

const restockReturnSchema = z.object({
  inventoryItemId: z.uuid().optional(),
  quantity: numericSchema.optional(),
  batchNumber: z.string().trim().max(100).optional(),
});

const listReturnSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  warehouseId: z.uuid().optional(),
  orderId: z.uuid().optional(),
  status: returnStatusSchema.optional(),
});

async function loadPickingDetail(id: string) {
  const [header] = await db
    .select({
      id: pickingTasks.id,
      taskNumber: pickingTasks.taskNumber,
      merchantId: pickingTasks.merchantId,
      merchantName: merchants.businessName,
      warehouseId: pickingTasks.warehouseId,
      warehouseName: warehouses.name,
      allocationId: pickingTasks.allocationId,
      orderId: pickingTasks.orderId,
      orderNumber: orders.orderNumber,
      status: pickingTasks.status,
      priority: pickingTasks.priority,
      assignedTo: pickingTasks.assignedTo,
      assigneeName: users.fullName,
      startedAt: pickingTasks.startedAt,
      completedAt: pickingTasks.completedAt,
      notes: pickingTasks.notes,
      createdAt: pickingTasks.createdAt,
      updatedAt: pickingTasks.updatedAt,
    })
    .from(pickingTasks)
    .innerJoin(merchants, eq(merchants.id, pickingTasks.merchantId))
    .innerJoin(warehouses, eq(warehouses.id, pickingTasks.warehouseId))
    .leftJoin(orders, eq(orders.id, pickingTasks.orderId))
    .leftJoin(users, eq(users.id, pickingTasks.assignedTo))
    .where(eq(pickingTasks.id, id))
    .limit(1);
  if (!header) throw ApiError.notFound('Tugas picking tidak ditemukan');

  const items = await db
    .select({
      id: pickingItems.id,
      allocationId: pickingItems.allocationId,
      inventoryItemId: pickingItems.inventoryItemId,
      inventoryItemName: products.name,
      inventoryItemSku: inventoryItems.skuId,
      warehouseLocationId: pickingItems.warehouseLocationId,
      locationName: warehouseLocations.name,
      quantity: pickingItems.quantity,
      pickedQuantity: pickingItems.pickedQuantity,
      batchNumber: pickingItems.batchNumber,
      notes: pickingItems.notes,
    })
    .from(pickingItems)
    .innerJoin(inventoryItems, eq(inventoryItems.id, pickingItems.inventoryItemId))
    .innerJoin(products, eq(products.id, inventoryItems.productId))
    .innerJoin(warehouseLocations, eq(warehouseLocations.id, pickingItems.warehouseLocationId))
    .where(eq(pickingItems.pickingTaskId, id))
    .orderBy(asc(pickingItems.createdAt));

  return { ...header, items };
}

async function loadPackingDetail(id: string) {
  const [header] = await db
    .select({
      id: packingTasks.id,
      taskNumber: packingTasks.taskNumber,
      merchantId: packingTasks.merchantId,
      merchantName: merchants.businessName,
      warehouseId: packingTasks.warehouseId,
      warehouseName: warehouses.name,
      pickingTaskId: packingTasks.pickingTaskId,
      pickingTaskNumber: pickingTasks.taskNumber,
      orderId: packingTasks.orderId,
      orderNumber: orders.orderNumber,
      status: packingTasks.status,
      packageCount: packingTasks.packageCount,
      weightGram: packingTasks.weightGram,
      dimensions: packingTasks.dimensions,
      assignedTo: packingTasks.assignedTo,
      assigneeName: users.fullName,
      startedAt: packingTasks.startedAt,
      completedAt: packingTasks.completedAt,
      notes: packingTasks.notes,
      createdAt: packingTasks.createdAt,
      updatedAt: packingTasks.updatedAt,
    })
    .from(packingTasks)
    .innerJoin(merchants, eq(merchants.id, packingTasks.merchantId))
    .innerJoin(warehouses, eq(warehouses.id, packingTasks.warehouseId))
    .leftJoin(pickingTasks, eq(pickingTasks.id, packingTasks.pickingTaskId))
    .leftJoin(orders, eq(orders.id, packingTasks.orderId))
    .leftJoin(users, eq(users.id, packingTasks.assignedTo))
    .where(eq(packingTasks.id, id))
    .limit(1);
  if (!header) throw ApiError.notFound('Tugas packing tidak ditemukan');
  return header;
}

async function loadDispatchDetail(id: string) {
  const [header] = await db
    .select({
      id: dispatchRecords.id,
      dispatchNumber: dispatchRecords.dispatchNumber,
      merchantId: dispatchRecords.merchantId,
      merchantName: merchants.businessName,
      warehouseId: dispatchRecords.warehouseId,
      warehouseName: warehouses.name,
      packingTaskId: dispatchRecords.packingTaskId,
      packingTaskNumber: packingTasks.taskNumber,
      orderId: dispatchRecords.orderId,
      orderNumber: orders.orderNumber,
      status: dispatchRecords.status,
      courierName: dispatchRecords.courierName,
      trackingNumber: dispatchRecords.trackingNumber,
      vehicleNumber: dispatchRecords.vehicleNumber,
      recipientName: dispatchRecords.recipientName,
      dispatchedAt: dispatchRecords.dispatchedAt,
      deliveredAt: dispatchRecords.deliveredAt,
      notes: dispatchRecords.notes,
      createdAt: dispatchRecords.createdAt,
      updatedAt: dispatchRecords.updatedAt,
    })
    .from(dispatchRecords)
    .innerJoin(merchants, eq(merchants.id, dispatchRecords.merchantId))
    .innerJoin(warehouses, eq(warehouses.id, dispatchRecords.warehouseId))
    .leftJoin(packingTasks, eq(packingTasks.id, dispatchRecords.packingTaskId))
    .leftJoin(orders, eq(orders.id, dispatchRecords.orderId))
    .where(eq(dispatchRecords.id, id))
    .limit(1);
  if (!header) throw ApiError.notFound('Pengiriman tidak ditemukan');
  return header;
}

async function loadReturnDetail(id: string) {
  const [header] = await db
    .select({
      id: warehouseReturns.id,
      returnNumber: warehouseReturns.returnNumber,
      merchantId: warehouseReturns.merchantId,
      merchantName: merchants.businessName,
      warehouseId: warehouseReturns.warehouseId,
      warehouseName: warehouses.name,
      warehouseLocationId: warehouseReturns.warehouseLocationId,
      locationName: warehouseLocations.name,
      orderId: warehouseReturns.orderId,
      orderNumber: orders.orderNumber,
      orderReturnId: warehouseReturns.orderReturnId,
      inventoryItemId: warehouseReturns.inventoryItemId,
      inventoryItemName: products.name,
      stockMovementId: warehouseReturns.stockMovementId,
      status: warehouseReturns.status,
      reason: warehouseReturns.reason,
      quantity: warehouseReturns.quantity,
      requestedBy: warehouseReturns.requestedBy,
      requesterName: users.fullName,
      approvedBy: warehouseReturns.approvedBy,
      receivedAt: warehouseReturns.receivedAt,
      restockedAt: warehouseReturns.restockedAt,
      notes: warehouseReturns.notes,
      createdAt: warehouseReturns.createdAt,
      updatedAt: warehouseReturns.updatedAt,
    })
    .from(warehouseReturns)
    .innerJoin(merchants, eq(merchants.id, warehouseReturns.merchantId))
    .innerJoin(warehouses, eq(warehouses.id, warehouseReturns.warehouseId))
    .innerJoin(warehouseLocations, eq(warehouseLocations.id, warehouseReturns.warehouseLocationId))
    .leftJoin(orders, eq(orders.id, warehouseReturns.orderId))
    .leftJoin(inventoryItems, eq(inventoryItems.id, warehouseReturns.inventoryItemId))
    .leftJoin(products, eq(products.id, inventoryItems.productId))
    .leftJoin(users, eq(users.id, warehouseReturns.requestedBy))
    .where(eq(warehouseReturns.id, id))
    .limit(1);
  if (!header) throw ApiError.notFound('Retur gudang tidak ditemukan');
  return header;
}

export const supplyChainOutboundRoutes = new Hono<AppEnv>();

/* -------------------------------- Picking -------------------------------- */

supplyChainOutboundRoutes.get(
  '/picking-tasks',
  requirePermission('supply_chain:read'),
  validate('query', listPickingSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = supplyChainScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(pickingTasks.merchantId, query.merchantId));
    if (query.warehouseId) conditions.push(eq(pickingTasks.warehouseId, query.warehouseId));
    if (query.orderId) conditions.push(eq(pickingTasks.orderId, query.orderId));
    if (query.status) conditions.push(eq(pickingTasks.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(pickingTasks.taskNumber, term),
          ilike(orders.orderNumber, term),
          ilike(merchants.businessName, term),
        ) as SQL,
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: pickingTasks.id,
          taskNumber: pickingTasks.taskNumber,
          merchantId: pickingTasks.merchantId,
          merchantName: merchants.businessName,
          warehouseId: pickingTasks.warehouseId,
          warehouseName: warehouses.name,
          orderId: pickingTasks.orderId,
          orderNumber: orders.orderNumber,
          status: pickingTasks.status,
          priority: pickingTasks.priority,
          createdAt: pickingTasks.createdAt,
        })
        .from(pickingTasks)
        .innerJoin(merchants, eq(merchants.id, pickingTasks.merchantId))
        .innerJoin(warehouses, eq(warehouses.id, pickingTasks.warehouseId))
        .leftJoin(orders, eq(orders.id, pickingTasks.orderId))
        .where(where)
        .orderBy(desc(pickingTasks.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(pickingTasks)
        .innerJoin(merchants, eq(merchants.id, pickingTasks.merchantId))
        .innerJoin(warehouses, eq(warehouses.id, pickingTasks.warehouseId))
        .leftJoin(orders, eq(orders.id, pickingTasks.orderId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

supplyChainOutboundRoutes.post(
  '/picking-tasks',
  requirePermission('supply_chain:write'),
  validate('json', createPickingSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertSupplyChainAccess(body.merchantId, user, permissions, { manage: true });
    const { warehouse } = await getWarehouse(body.warehouseId, user, permissions);
    if (warehouse.merchantId !== body.merchantId) {
      throw ApiError.badRequest('Gudang tidak sesuai dengan merchant');
    }

    const prepared: Array<{
      allocationId: string | null;
      inventoryItemId: string;
      warehouseLocationId: string;
      quantity: string;
      batchNumber: string | null;
      notes: string | null;
    }> = [];

    if (body.allocationId) {
      const { allocation } = await getAllocation(body.allocationId, user, permissions);
      if (allocation.merchantId !== body.merchantId || allocation.warehouseId !== body.warehouseId) {
        throw ApiError.badRequest('Alokasi tidak sesuai dengan merchant atau gudang');
      }
      if (allocation.status !== 'allocated') {
        throw ApiError.badRequest('Alokasi tidak aktif');
      }
      prepared.push({
        allocationId: allocation.id,
        inventoryItemId: allocation.inventoryItemId,
        warehouseLocationId: allocation.warehouseLocationId,
        quantity: allocation.quantity,
        batchNumber: null,
        notes: null,
      });
    } else if (body.items && body.items.length > 0) {
      for (const item of body.items) {
        if (!item.inventoryItemId || !item.warehouseLocationId || !item.quantity) {
          throw ApiError.badRequest(
            'Item picking wajib memiliki item, lokasi, dan jumlah',
          );
        }
        const { item: inventoryItem } = await getInventoryItem(
          item.inventoryItemId,
          user,
          permissions,
        );
        if (inventoryItem.merchantId !== body.merchantId) {
          throw ApiError.badRequest('Item persediaan tidak sesuai dengan merchant');
        }
        const { location } = await getWarehouseLocation(
          item.warehouseLocationId,
          user,
          permissions,
        );
        if (location.warehouseId !== body.warehouseId) {
          throw ApiError.badRequest('Lokasi picking tidak sesuai dengan gudang');
        }
        prepared.push({
          allocationId: item.allocationId ?? null,
          inventoryItemId: item.inventoryItemId,
          warehouseLocationId: item.warehouseLocationId,
          quantity: quantity(toNumber(item.quantity)),
          batchNumber: item.batchNumber ?? null,
          notes: item.notes ?? null,
        });
      }
    } else {
      throw ApiError.badRequest('Item picking wajib diisi');
    }

    const orderId = body.orderId ?? null;
    if (orderId) {
      const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
      if (!order) throw ApiError.notFound('Order tidak ditemukan');
      if (order.merchantId !== body.merchantId) {
        throw ApiError.badRequest('Order tidak sesuai dengan merchant');
      }
    }

    const created = await db.transaction(async (tx) => {
      const [header] = await tx
        .insert(pickingTasks)
        .values({
          taskNumber: generateCode('PICK'),
          merchantId: body.merchantId,
          warehouseId: body.warehouseId,
          allocationId: body.allocationId ?? null,
          orderId,
          priority: body.priority,
          assignedTo: body.assignedTo ?? null,
          notes: body.notes ?? null,
          createdBy: user.id,
        })
        .returning();
      if (!header) throw ApiError.internal('Gagal membuat tugas picking');
      for (const item of prepared) {
        await tx.insert(pickingItems).values({
          pickingTaskId: header.id,
          allocationId: item.allocationId,
          inventoryItemId: item.inventoryItemId,
          warehouseLocationId: item.warehouseLocationId,
          quantity: item.quantity,
          batchNumber: item.batchNumber,
          notes: item.notes,
        });
      }
      await recordFulfillmentHistory(tx, {
        merchantId: body.merchantId,
        entityType: 'picking_task',
        entityId: header.id,
        toStatus: 'pending',
        note: 'Tugas picking dibuat',
        changedBy: user.id,
      });
      return header;
    });

    await writeAuditLog({
      actorUserId: user.id,
      action: 'supply_chain.picking.create',
      entityType: 'picking_task',
      entityId: created.id,
      newValues: { number: created.taskNumber },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, await loadPickingDetail(created.id), 201);
  },
);

supplyChainOutboundRoutes.get(
  '/picking-tasks/:id',
  requirePermission('supply_chain:read'),
  async (c) => {
    const { pickingTask } = await getPickingTask(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    return ok(c, await loadPickingDetail(pickingTask.id));
  },
);

supplyChainOutboundRoutes.post(
  '/picking-tasks/:id/start',
  requirePermission('supply_chain:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { pickingTask } = await getPickingTask(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (pickingTask.status !== 'pending') {
      throw ApiError.badRequest('Tugas picking tidak dapat dimulai');
    }
    await db
      .update(pickingTasks)
      .set({ status: 'in_progress', startedAt: new Date(), assignedTo: user.id })
      .where(eq(pickingTasks.id, pickingTask.id));
    return ok(c, await loadPickingDetail(pickingTask.id));
  },
);

supplyChainOutboundRoutes.post(
  '/picking-tasks/:id/complete',
  requirePermission('supply_chain:write'),
  validate('json', completePickingSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { pickingTask } = await getPickingTask(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (!['pending', 'in_progress'].includes(pickingTask.status)) {
      throw ApiError.badRequest('Tugas picking tidak dapat diselesaikan');
    }

    await db.transaction(async (tx) => {
      const items = await tx
        .select()
        .from(pickingItems)
        .where(eq(pickingItems.pickingTaskId, pickingTask.id))
        .orderBy(asc(pickingItems.createdAt));
      const inputMap = new Map(body.items.map((item) => [item.id, item.pickedQuantity]));
      const lines: MovementLineInput[] = [];
      const allocationIds = new Set<string>();

      for (const item of items) {
        const picked = toNumber(inputMap.get(item.id) ?? item.quantity);
        if (picked <= 0) throw ApiError.badRequest('Jumlah picking harus lebih dari 0');
        if (picked > toNumber(item.quantity)) {
          throw ApiError.badRequest('Jumlah picking melebihi jumlah permintaan');
        }
        lines.push({
          inventoryItemId: item.inventoryItemId,
          quantity: quantity(picked),
          unitCost: '0',
          batchNumber: item.batchNumber,
        });
        if (item.allocationId) allocationIds.add(item.allocationId);
        await tx
          .update(pickingItems)
          .set({ pickedQuantity: quantity(picked) })
          .where(eq(pickingItems.id, item.id));
      }

      const linesByLocation = new Map<string, MovementLineInput[]>();
      for (let index = 0; index < items.length; index += 1) {
        const locationId = items[index]!.warehouseLocationId;
        const group = linesByLocation.get(locationId) ?? [];
        group.push(lines[index]!);
        linesByLocation.set(locationId, group);
      }
      for (const [locationId, locationLines] of linesByLocation) {
        await applyMovement(tx, {
          merchantId: pickingTask.merchantId,
          movementNumber: generateCode('MOV'),
          type: 'outbound',
          sourceWarehouseId: pickingTask.warehouseId,
          sourceLocationId: locationId,
          referenceType: 'picking_task',
          referenceId: pickingTask.id,
          referenceNumber: pickingTask.taskNumber,
          notes: `Picking ${pickingTask.taskNumber}`,
          createdBy: user.id,
          lines: locationLines,
        });
      }

      for (const allocationId of allocationIds) {
        const [allocation] = await tx
          .select()
          .from(warehouseAllocations)
          .where(eq(warehouseAllocations.id, allocationId))
          .limit(1);
        if (!allocation || allocation.status !== 'allocated') continue;
        const [balance] = await tx
          .select()
          .from(stockBalances)
          .where(
            and(
              eq(stockBalances.warehouseLocationId, allocation.warehouseLocationId),
              eq(stockBalances.inventoryItemId, allocation.inventoryItemId),
            ),
          )
          .limit(1);
        if (balance) {
          await tx
            .update(stockBalances)
            .set({
              reservedQuantity: quantity(
                Math.max(
                  toNumber(balance.reservedQuantity) - toNumber(allocation.quantity),
                  0,
                ),
              ),
            })
            .where(eq(stockBalances.id, balance.id));
        }
        await tx
          .update(warehouseAllocations)
          .set({ status: 'released', releasedAt: new Date() })
          .where(eq(warehouseAllocations.id, allocation.id));
        await recordFulfillmentHistory(tx, {
          merchantId: pickingTask.merchantId,
          entityType: 'warehouse_allocation',
          entityId: allocation.id,
          fromStatus: 'allocated',
          toStatus: 'released',
          note: 'Alokasi terpakai oleh picking',
          changedBy: user.id,
        });
      }

      await tx
        .update(pickingTasks)
        .set({
          status: 'picked',
          completedAt: new Date(),
          assignedTo: pickingTask.assignedTo ?? user.id,
        })
        .where(eq(pickingTasks.id, pickingTask.id));
      await recordFulfillmentHistory(tx, {
        merchantId: pickingTask.merchantId,
        entityType: 'picking_task',
        entityId: pickingTask.id,
        fromStatus: pickingTask.status,
        toStatus: 'picked',
        note: 'Picking selesai dan stok dikeluarkan',
        changedBy: user.id,
      });
    });

    return ok(c, await loadPickingDetail(pickingTask.id));
  },
);

supplyChainOutboundRoutes.post(
  '/picking-tasks/:id/cancel',
  requirePermission('supply_chain:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { pickingTask } = await getPickingTask(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (!['pending', 'in_progress'].includes(pickingTask.status)) {
      throw ApiError.badRequest('Tugas picking tidak dapat dibatalkan');
    }
    await db
      .update(pickingTasks)
      .set({ status: 'cancelled' })
      .where(eq(pickingTasks.id, pickingTask.id));
    return ok(c, await loadPickingDetail(pickingTask.id));
  },
);

/* -------------------------------- Packing -------------------------------- */

supplyChainOutboundRoutes.get(
  '/packing-tasks',
  requirePermission('supply_chain:read'),
  validate('query', listPackingSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = supplyChainScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(packingTasks.merchantId, query.merchantId));
    if (query.warehouseId) conditions.push(eq(packingTasks.warehouseId, query.warehouseId));
    if (query.orderId) conditions.push(eq(packingTasks.orderId, query.orderId));
    if (query.status) conditions.push(eq(packingTasks.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(packingTasks.taskNumber, term),
          ilike(orders.orderNumber, term),
          ilike(merchants.businessName, term),
        ) as SQL,
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: packingTasks.id,
          taskNumber: packingTasks.taskNumber,
          merchantId: packingTasks.merchantId,
          merchantName: merchants.businessName,
          warehouseId: packingTasks.warehouseId,
          warehouseName: warehouses.name,
          pickingTaskId: packingTasks.pickingTaskId,
          orderId: packingTasks.orderId,
          orderNumber: orders.orderNumber,
          status: packingTasks.status,
          packageCount: packingTasks.packageCount,
          weightGram: packingTasks.weightGram,
          createdAt: packingTasks.createdAt,
        })
        .from(packingTasks)
        .innerJoin(merchants, eq(merchants.id, packingTasks.merchantId))
        .innerJoin(warehouses, eq(warehouses.id, packingTasks.warehouseId))
        .leftJoin(orders, eq(orders.id, packingTasks.orderId))
        .where(where)
        .orderBy(desc(packingTasks.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(packingTasks)
        .innerJoin(merchants, eq(merchants.id, packingTasks.merchantId))
        .innerJoin(warehouses, eq(warehouses.id, packingTasks.warehouseId))
        .leftJoin(orders, eq(orders.id, packingTasks.orderId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

supplyChainOutboundRoutes.post(
  '/packing-tasks',
  requirePermission('supply_chain:write'),
  validate('json', createPackingSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertSupplyChainAccess(body.merchantId, user, permissions, { manage: true });
    const { warehouse } = await getWarehouse(body.warehouseId, user, permissions);
    if (warehouse.merchantId !== body.merchantId) {
      throw ApiError.badRequest('Gudang tidak sesuai dengan merchant');
    }
    if (body.pickingTaskId) {
      const { pickingTask } = await getPickingTask(
        body.pickingTaskId,
        user,
        permissions,
      );
      if (pickingTask.merchantId !== body.merchantId) {
        throw ApiError.badRequest('Tugas picking tidak sesuai dengan merchant');
      }
      if (pickingTask.status !== 'picked') {
        throw ApiError.badRequest('Tugas picking belum selesai');
      }
    }
    const [created] = await db
      .insert(packingTasks)
      .values({
        taskNumber: generateCode('PACK'),
        merchantId: body.merchantId,
        warehouseId: body.warehouseId,
        pickingTaskId: body.pickingTaskId ?? null,
        orderId: body.orderId ?? null,
        packageCount: body.packageCount,
        weightGram: body.weightGram ?? null,
        dimensions: body.dimensions ?? null,
        assignedTo: body.assignedTo ?? null,
        notes: body.notes ?? null,
        createdBy: user.id,
      })
      .returning();
    return ok(c, await loadPackingDetail(created!.id), 201);
  },
);

supplyChainOutboundRoutes.get(
  '/packing-tasks/:id',
  requirePermission('supply_chain:read'),
  async (c) => {
    const { packingTask } = await getPackingTask(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    return ok(c, await loadPackingDetail(packingTask.id));
  },
);

supplyChainOutboundRoutes.post(
  '/packing-tasks/:id/start',
  requirePermission('supply_chain:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { packingTask } = await getPackingTask(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (packingTask.status !== 'pending') {
      throw ApiError.badRequest('Tugas packing tidak dapat dimulai');
    }
    await db
      .update(packingTasks)
      .set({ status: 'packing', startedAt: new Date(), assignedTo: user.id })
      .where(eq(packingTasks.id, packingTask.id));
    return ok(c, await loadPackingDetail(packingTask.id));
  },
);

supplyChainOutboundRoutes.post(
  '/packing-tasks/:id/complete',
  requirePermission('supply_chain:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { packingTask } = await getPackingTask(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (!['pending', 'packing'].includes(packingTask.status)) {
      throw ApiError.badRequest('Tugas packing tidak dapat diselesaikan');
    }
    await db.transaction(async (tx) => {
      await tx
        .update(packingTasks)
        .set({ status: 'packed', completedAt: new Date(), assignedTo: user.id })
        .where(eq(packingTasks.id, packingTask.id));
      await recordFulfillmentHistory(tx, {
        merchantId: packingTask.merchantId,
        entityType: 'packing_task',
        entityId: packingTask.id,
        fromStatus: packingTask.status,
        toStatus: 'packed',
        note: 'Packing selesai',
        changedBy: user.id,
      });
    });
    return ok(c, await loadPackingDetail(packingTask.id));
  },
);

supplyChainOutboundRoutes.post(
  '/packing-tasks/:id/cancel',
  requirePermission('supply_chain:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { packingTask } = await getPackingTask(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (!['pending', 'packing'].includes(packingTask.status)) {
      throw ApiError.badRequest('Tugas packing tidak dapat dibatalkan');
    }
    await db
      .update(packingTasks)
      .set({ status: 'cancelled' })
      .where(eq(packingTasks.id, packingTask.id));
    return ok(c, await loadPackingDetail(packingTask.id));
  },
);

/* -------------------------------- Dispatch ------------------------------- */

supplyChainOutboundRoutes.get(
  '/dispatch-records',
  requirePermission('supply_chain:read'),
  validate('query', listDispatchSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = supplyChainScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(dispatchRecords.merchantId, query.merchantId));
    if (query.warehouseId) conditions.push(eq(dispatchRecords.warehouseId, query.warehouseId));
    if (query.orderId) conditions.push(eq(dispatchRecords.orderId, query.orderId));
    if (query.status) conditions.push(eq(dispatchRecords.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(dispatchRecords.dispatchNumber, term),
          ilike(dispatchRecords.trackingNumber, term),
          ilike(orders.orderNumber, term),
          ilike(merchants.businessName, term),
        ) as SQL,
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: dispatchRecords.id,
          dispatchNumber: dispatchRecords.dispatchNumber,
          merchantId: dispatchRecords.merchantId,
          merchantName: merchants.businessName,
          warehouseId: dispatchRecords.warehouseId,
          warehouseName: warehouses.name,
          orderId: dispatchRecords.orderId,
          orderNumber: orders.orderNumber,
          status: dispatchRecords.status,
          courierName: dispatchRecords.courierName,
          trackingNumber: dispatchRecords.trackingNumber,
          dispatchedAt: dispatchRecords.dispatchedAt,
          deliveredAt: dispatchRecords.deliveredAt,
          createdAt: dispatchRecords.createdAt,
        })
        .from(dispatchRecords)
        .innerJoin(merchants, eq(merchants.id, dispatchRecords.merchantId))
        .innerJoin(warehouses, eq(warehouses.id, dispatchRecords.warehouseId))
        .leftJoin(orders, eq(orders.id, dispatchRecords.orderId))
        .where(where)
        .orderBy(desc(dispatchRecords.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(dispatchRecords)
        .innerJoin(merchants, eq(merchants.id, dispatchRecords.merchantId))
        .innerJoin(warehouses, eq(warehouses.id, dispatchRecords.warehouseId))
        .leftJoin(orders, eq(orders.id, dispatchRecords.orderId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

supplyChainOutboundRoutes.post(
  '/dispatch-records',
  requirePermission('supply_chain:write'),
  validate('json', createDispatchSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertSupplyChainAccess(body.merchantId, user, permissions, { manage: true });
    const { warehouse } = await getWarehouse(body.warehouseId, user, permissions);
    if (warehouse.merchantId !== body.merchantId) {
      throw ApiError.badRequest('Gudang tidak sesuai dengan merchant');
    }
    if (body.packingTaskId) {
      const { packingTask } = await getPackingTask(
        body.packingTaskId,
        user,
        permissions,
      );
      if (packingTask.merchantId !== body.merchantId) {
        throw ApiError.badRequest('Tugas packing tidak sesuai dengan merchant');
      }
      if (packingTask.status !== 'packed') {
        throw ApiError.badRequest('Tugas packing belum selesai');
      }
    }
    const [created] = await db
      .insert(dispatchRecords)
      .values({
        dispatchNumber: generateCode('DSP'),
        merchantId: body.merchantId,
        warehouseId: body.warehouseId,
        packingTaskId: body.packingTaskId ?? null,
        orderId: body.orderId ?? null,
        status: 'pending',
        courierName: body.courierName ?? null,
        trackingNumber: body.trackingNumber ?? null,
        vehicleNumber: body.vehicleNumber ?? null,
        recipientName: body.recipientName ?? null,
        notes: body.notes ?? null,
        createdBy: user.id,
      })
      .returning();
    return ok(c, await loadDispatchDetail(created!.id), 201);
  },
);

supplyChainOutboundRoutes.get(
  '/dispatch-records/:id',
  requirePermission('supply_chain:read'),
  async (c) => {
    const { dispatch } = await getDispatch(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    return ok(c, await loadDispatchDetail(dispatch.id));
  },
);

supplyChainOutboundRoutes.post(
  '/dispatch-records/:id/dispatch',
  requirePermission('supply_chain:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { dispatch } = await getDispatch(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (dispatch.status !== 'pending') {
      throw ApiError.badRequest('Pengiriman tidak dapat diberangkatkan');
    }
    await db.transaction(async (tx) => {
      await tx
        .update(dispatchRecords)
        .set({ status: 'dispatched', dispatchedAt: new Date() })
        .where(eq(dispatchRecords.id, dispatch.id));
      await recordFulfillmentHistory(tx, {
        merchantId: dispatch.merchantId,
        entityType: 'dispatch_record',
        entityId: dispatch.id,
        fromStatus: dispatch.status,
        toStatus: 'dispatched',
        note: 'Paket diberangkatkan',
        changedBy: user.id,
      });
    });
    return ok(c, await loadDispatchDetail(dispatch.id));
  },
);

supplyChainOutboundRoutes.post(
  '/dispatch-records/:id/deliver',
  requirePermission('supply_chain:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { dispatch } = await getDispatch(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (!['dispatched', 'in_transit'].includes(dispatch.status)) {
      throw ApiError.badRequest('Pengiriman belum dalam perjalanan');
    }
    await db.transaction(async (tx) => {
      await tx
        .update(dispatchRecords)
        .set({ status: 'delivered', deliveredAt: new Date() })
        .where(eq(dispatchRecords.id, dispatch.id));
      await recordFulfillmentHistory(tx, {
        merchantId: dispatch.merchantId,
        entityType: 'dispatch_record',
        entityId: dispatch.id,
        fromStatus: dispatch.status,
        toStatus: 'delivered',
        note: 'Paket diterima penerima',
        changedBy: user.id,
      });
    });
    return ok(c, await loadDispatchDetail(dispatch.id));
  },
);

supplyChainOutboundRoutes.post(
  '/dispatch-records/:id/cancel',
  requirePermission('supply_chain:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { dispatch } = await getDispatch(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (!['pending', 'dispatched', 'in_transit'].includes(dispatch.status)) {
      throw ApiError.badRequest('Pengiriman tidak dapat dibatalkan');
    }
    await db
      .update(dispatchRecords)
      .set({ status: 'cancelled' })
      .where(eq(dispatchRecords.id, dispatch.id));
    return ok(c, await loadDispatchDetail(dispatch.id));
  },
);

/* ----------------------------- Warehouse return -------------------------- */

supplyChainOutboundRoutes.get(
  '/warehouse-returns',
  requirePermission('supply_chain:read'),
  validate('query', listReturnSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = supplyChainScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(warehouseReturns.merchantId, query.merchantId));
    if (query.warehouseId) conditions.push(eq(warehouseReturns.warehouseId, query.warehouseId));
    if (query.orderId) conditions.push(eq(warehouseReturns.orderId, query.orderId));
    if (query.status) conditions.push(eq(warehouseReturns.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(warehouseReturns.returnNumber, term),
          ilike(warehouseReturns.reason, term),
          ilike(orders.orderNumber, term),
          ilike(merchants.businessName, term),
        ) as SQL,
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: warehouseReturns.id,
          returnNumber: warehouseReturns.returnNumber,
          merchantId: warehouseReturns.merchantId,
          merchantName: merchants.businessName,
          warehouseId: warehouseReturns.warehouseId,
          warehouseName: warehouses.name,
          orderId: warehouseReturns.orderId,
          orderNumber: orders.orderNumber,
          status: warehouseReturns.status,
          reason: warehouseReturns.reason,
          quantity: warehouseReturns.quantity,
          createdAt: warehouseReturns.createdAt,
        })
        .from(warehouseReturns)
        .innerJoin(merchants, eq(merchants.id, warehouseReturns.merchantId))
        .innerJoin(warehouses, eq(warehouses.id, warehouseReturns.warehouseId))
        .leftJoin(orders, eq(orders.id, warehouseReturns.orderId))
        .where(where)
        .orderBy(desc(warehouseReturns.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(warehouseReturns)
        .innerJoin(merchants, eq(merchants.id, warehouseReturns.merchantId))
        .innerJoin(warehouses, eq(warehouses.id, warehouseReturns.warehouseId))
        .leftJoin(orders, eq(orders.id, warehouseReturns.orderId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

supplyChainOutboundRoutes.post(
  '/warehouse-returns',
  requirePermission('supply_chain:write'),
  validate('json', createReturnSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertSupplyChainAccess(body.merchantId, user, permissions, { manage: true });
    const { warehouse } = await getWarehouse(body.warehouseId, user, permissions);
    if (warehouse.merchantId !== body.merchantId) {
      throw ApiError.badRequest('Gudang tidak sesuai dengan merchant');
    }
    const { location } = await getWarehouseLocation(
      body.warehouseLocationId,
      user,
      permissions,
    );
    if (location.warehouseId !== body.warehouseId) {
      throw ApiError.badRequest('Lokasi tidak berada pada gudang yang dipilih');
    }
    if (body.inventoryItemId) {
      const { item } = await getInventoryItem(body.inventoryItemId, user, permissions);
      if (item.merchantId !== body.merchantId) {
        throw ApiError.badRequest('Item persediaan tidak sesuai dengan merchant');
      }
    }
    if (body.orderId) {
      const order = await db.query.orders.findFirst({ where: eq(orders.id, body.orderId) });
      if (!order) throw ApiError.notFound('Order tidak ditemukan');
      if (order.merchantId !== body.merchantId) {
        throw ApiError.badRequest('Order tidak sesuai dengan merchant');
      }
    }
    const [created] = await db
      .insert(warehouseReturns)
      .values({
        returnNumber: generateCode('WRET'),
        merchantId: body.merchantId,
        warehouseId: body.warehouseId,
        warehouseLocationId: body.warehouseLocationId,
        orderId: body.orderId ?? null,
        orderReturnId: body.orderReturnId ?? null,
        inventoryItemId: body.inventoryItemId ?? null,
        status: 'requested',
        reason: body.reason,
        quantity: quantity(toNumber(body.quantity)),
        requestedBy: user.id,
        notes: body.notes ?? null,
      })
      .returning();
    return ok(c, await loadReturnDetail(created!.id), 201);
  },
);

supplyChainOutboundRoutes.get(
  '/warehouse-returns/:id',
  requirePermission('supply_chain:read'),
  async (c) => {
    const { warehouseReturn } = await getWarehouseReturn(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    return ok(c, await loadReturnDetail(warehouseReturn.id));
  },
);

supplyChainOutboundRoutes.post(
  '/warehouse-returns/:id/approve',
  requirePermission('supply_chain:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { warehouseReturn } = await getWarehouseReturn(
      c.req.param('id'),
      user,
      permissions,
      { manage: true },
    );
    if (warehouseReturn.status !== 'requested') {
      throw ApiError.badRequest('Retur tidak dapat disetujui');
    }
    await db
      .update(warehouseReturns)
      .set({ status: 'approved', approvedBy: user.id })
      .where(eq(warehouseReturns.id, warehouseReturn.id));
    return ok(c, await loadReturnDetail(warehouseReturn.id));
  },
);

supplyChainOutboundRoutes.post(
  '/warehouse-returns/:id/receive',
  requirePermission('supply_chain:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { warehouseReturn } = await getWarehouseReturn(
      c.req.param('id'),
      user,
      permissions,
      { manage: true },
    );
    if (!['approved', 'requested'].includes(warehouseReturn.status)) {
      throw ApiError.badRequest('Retur belum dapat diterima');
    }
    await db
      .update(warehouseReturns)
      .set({ status: 'received', receivedAt: new Date() })
      .where(eq(warehouseReturns.id, warehouseReturn.id));
    return ok(c, await loadReturnDetail(warehouseReturn.id));
  },
);

supplyChainOutboundRoutes.post(
  '/warehouse-returns/:id/restock',
  requirePermission('supply_chain:write'),
  validate('json', restockReturnSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { warehouseReturn } = await getWarehouseReturn(
      c.req.param('id'),
      user,
      permissions,
      { manage: true },
    );
    if (!['approved', 'received'].includes(warehouseReturn.status)) {
      throw ApiError.badRequest('Retur belum dapat dikembalikan ke stok');
    }
    const inventoryItemId = body.inventoryItemId ?? warehouseReturn.inventoryItemId;
    if (!inventoryItemId) {
      throw ApiError.badRequest('Item persediaan retur wajib dipilih');
    }
    const { item } = await getInventoryItem(inventoryItemId, user, permissions);
    if (item.merchantId !== warehouseReturn.merchantId) {
      throw ApiError.badRequest('Item persediaan tidak sesuai dengan merchant');
    }
    const restockQuantity = toNumber(body.quantity ?? warehouseReturn.quantity);
    if (restockQuantity <= 0) throw ApiError.badRequest('Jumlah retur harus lebih dari 0');

    const movement = await db.transaction(async (tx) => {
      const created = await applyMovement(tx, {
        merchantId: warehouseReturn.merchantId,
        movementNumber: generateCode('MOV'),
        type: 'return',
        destinationWarehouseId: warehouseReturn.warehouseId,
        destinationLocationId: warehouseReturn.warehouseLocationId,
        referenceType: 'warehouse_return',
        referenceId: warehouseReturn.id,
        referenceNumber: warehouseReturn.returnNumber,
        notes: `Retur gudang ${warehouseReturn.returnNumber}`,
        createdBy: user.id,
        lines: [
          {
            inventoryItemId,
            quantity: quantity(restockQuantity),
            unitCost: '0',
            batchNumber: body.batchNumber,
          },
        ],
      });
      await tx
        .update(warehouseReturns)
        .set({
          status: 'restocked',
          stockMovementId: created.id,
          restockedAt: new Date(),
          inventoryItemId,
          quantity: quantity(restockQuantity),
        })
        .where(eq(warehouseReturns.id, warehouseReturn.id));
      await recordFulfillmentHistory(tx, {
        merchantId: warehouseReturn.merchantId,
        entityType: 'warehouse_return',
        entityId: warehouseReturn.id,
        fromStatus: warehouseReturn.status,
        toStatus: 'restocked',
        note: 'Retur dikembalikan ke stok',
        changedBy: user.id,
      });
      return created;
    });

    await writeAuditLog({
      actorUserId: user.id,
      action: 'supply_chain.return.restock',
      entityType: 'warehouse_return',
      entityId: warehouseReturn.id,
      newValues: { stockMovementId: movement.id, quantity: quantity(restockQuantity) },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, await loadReturnDetail(warehouseReturn.id));
  },
);

supplyChainOutboundRoutes.post(
  '/warehouse-returns/:id/reject',
  requirePermission('supply_chain:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { warehouseReturn } = await getWarehouseReturn(
      c.req.param('id'),
      user,
      permissions,
      { manage: true },
    );
    if (['restocked', 'rejected', 'cancelled'].includes(warehouseReturn.status)) {
      throw ApiError.badRequest('Retur tidak dapat ditolak');
    }
    await db
      .update(warehouseReturns)
      .set({ status: 'rejected' })
      .where(eq(warehouseReturns.id, warehouseReturn.id));
    return ok(c, await loadReturnDetail(warehouseReturn.id));
  },
);

supplyChainOutboundRoutes.post(
  '/warehouse-returns/:id/cancel',
  requirePermission('supply_chain:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { warehouseReturn } = await getWarehouseReturn(
      c.req.param('id'),
      user,
      permissions,
      { manage: true },
    );
    if (!['requested', 'approved', 'received'].includes(warehouseReturn.status)) {
      throw ApiError.badRequest('Retur tidak dapat dibatalkan');
    }
    await db
      .update(warehouseReturns)
      .set({ status: 'cancelled' })
      .where(eq(warehouseReturns.id, warehouseReturn.id));
    return ok(c, await loadReturnDetail(warehouseReturn.id));
  },
);

/* --------------------------- Fulfillment history ------------------------- */

supplyChainOutboundRoutes.get(
  '/fulfillment-status-histories',
  requirePermission('supply_chain:read'),
  validate(
    'query',
    z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(50),
      merchantId: z.uuid().optional(),
      entityType: z.string().trim().max(64).optional(),
      entityId: z.uuid().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = supplyChainScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) {
      conditions.push(eq(fulfillmentStatusHistories.merchantId, query.merchantId));
    }
    if (query.entityType) {
      conditions.push(eq(fulfillmentStatusHistories.entityType, query.entityType));
    }
    if (query.entityId) {
      conditions.push(eq(fulfillmentStatusHistories.entityId, query.entityId));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: fulfillmentStatusHistories.id,
          merchantId: fulfillmentStatusHistories.merchantId,
          merchantName: merchants.businessName,
          entityType: fulfillmentStatusHistories.entityType,
          entityId: fulfillmentStatusHistories.entityId,
          fromStatus: fulfillmentStatusHistories.fromStatus,
          toStatus: fulfillmentStatusHistories.toStatus,
          note: fulfillmentStatusHistories.note,
          changedByName: users.fullName,
          createdAt: fulfillmentStatusHistories.createdAt,
        })
        .from(fulfillmentStatusHistories)
        .innerJoin(merchants, eq(merchants.id, fulfillmentStatusHistories.merchantId))
        .leftJoin(users, eq(users.id, fulfillmentStatusHistories.changedBy))
        .where(where)
        .orderBy(desc(fulfillmentStatusHistories.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(fulfillmentStatusHistories)
        .innerJoin(merchants, eq(merchants.id, fulfillmentStatusHistories.merchantId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);
