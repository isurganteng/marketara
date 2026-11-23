import { and, asc, count, desc, eq, ilike, inArray, or, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  inventoryItems,
  merchants,
  orderItems,
  orders,
  products,
  putawayTasks,
  stockBalances,
  users,
  warehouseAllocations,
  warehouseLocations,
  warehouseReceipts,
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
  getInventoryItem,
  getPutawayTask,
  getWarehouse,
  getWarehouseLocation,
  getWarehouseReceipt,
  money,
  numericSchema,
  optionalNumericSchema,
  quantity,
  recordFulfillmentHistory,
  supplyChainScopeCondition,
  toNumber,
} from './shared';

const receiptStatusSchema = z.enum([
  'pending',
  'receiving',
  'received',
  'put_away',
  'cancelled',
]);
const putawayStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'cancelled']);
const allocationStatusSchema = z.enum(['pending', 'allocated', 'released', 'cancelled']);

const listReceiptSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  warehouseId: z.uuid().optional(),
  status: receiptStatusSchema.optional(),
});

const createReceiptSchema = z.object({
  merchantId: z.uuid(),
  warehouseId: z.uuid(),
  warehouseLocationId: z.uuid(),
  expectedQuantity: optionalNumericSchema.default('0'),
  notes: z.string().trim().max(2000).optional(),
});

const listPutawaySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  warehouseId: z.uuid().optional(),
  warehouseReceiptId: z.uuid().optional(),
  status: putawayStatusSchema.optional(),
});

const createPutawaySchema = z.object({
  merchantId: z.uuid(),
  warehouseId: z.uuid(),
  warehouseReceiptId: z.uuid().optional(),
  inventoryItemId: z.uuid(),
  sourceLocationId: z.uuid(),
  destinationLocationId: z.uuid().optional(),
  quantity: numericSchema,
  batchNumber: z.string().trim().max(100).optional(),
  assignedTo: z.uuid().optional(),
  notes: z.string().trim().max(2000).optional(),
});

const updatePutawaySchema = z.object({
  destinationLocationId: z.uuid().nullable().optional(),
  quantity: numericSchema.optional(),
  batchNumber: z.string().trim().max(100).nullable().optional(),
  assignedTo: z.uuid().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

const listAllocationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  warehouseId: z.uuid().optional(),
  orderId: z.uuid().optional(),
  status: allocationStatusSchema.optional(),
});

const createAllocationSchema = z.object({
  merchantId: z.uuid(),
  warehouseId: z.uuid(),
  warehouseLocationId: z.uuid(),
  inventoryItemId: z.uuid(),
  orderId: z.uuid().optional(),
  orderItemId: z.uuid().optional(),
  quantity: numericSchema,
  notes: z.string().trim().max(2000).optional(),
});

async function loadWarehouseReceiptDetail(id: string) {
  const [header] = await db
    .select({
      id: warehouseReceipts.id,
      receiptNumber: warehouseReceipts.receiptNumber,
      merchantId: warehouseReceipts.merchantId,
      merchantName: merchants.businessName,
      warehouseId: warehouseReceipts.warehouseId,
      warehouseName: warehouses.name,
      warehouseLocationId: warehouseReceipts.warehouseLocationId,
      locationName: warehouseLocations.name,
      goodsReceiptId: warehouseReceipts.goodsReceiptId,
      purchaseOrderId: warehouseReceipts.purchaseOrderId,
      stockMovementId: warehouseReceipts.stockMovementId,
      source: warehouseReceipts.source,
      status: warehouseReceipts.status,
      expectedQuantity: warehouseReceipts.expectedQuantity,
      receivedQuantity: warehouseReceipts.receivedQuantity,
      receiverName: users.fullName,
      startedAt: warehouseReceipts.startedAt,
      completedAt: warehouseReceipts.completedAt,
      notes: warehouseReceipts.notes,
      createdAt: warehouseReceipts.createdAt,
      updatedAt: warehouseReceipts.updatedAt,
    })
    .from(warehouseReceipts)
    .innerJoin(merchants, eq(merchants.id, warehouseReceipts.merchantId))
    .innerJoin(warehouses, eq(warehouses.id, warehouseReceipts.warehouseId))
    .innerJoin(warehouseLocations, eq(warehouseLocations.id, warehouseReceipts.warehouseLocationId))
    .leftJoin(users, eq(users.id, warehouseReceipts.receivedBy))
    .where(eq(warehouseReceipts.id, id))
    .limit(1);
  if (!header) throw ApiError.notFound('Penerimaan gudang tidak ditemukan');

  const tasks = await db
    .select({
      id: putawayTasks.id,
      taskNumber: putawayTasks.taskNumber,
      inventoryItemId: putawayTasks.inventoryItemId,
      inventoryItemName: products.name,
      sourceLocationId: putawayTasks.sourceLocationId,
      destinationLocationId: putawayTasks.destinationLocationId,
      quantity: putawayTasks.quantity,
      batchNumber: putawayTasks.batchNumber,
      status: putawayTasks.status,
      createdAt: putawayTasks.createdAt,
    })
    .from(putawayTasks)
    .innerJoin(inventoryItems, eq(inventoryItems.id, putawayTasks.inventoryItemId))
    .innerJoin(products, eq(products.id, inventoryItems.productId))
    .where(eq(putawayTasks.warehouseReceiptId, id))
    .orderBy(asc(putawayTasks.createdAt));

  return { ...header, tasks };
}

async function loadPutawayDetail(id: string) {
  const [header] = await db
    .select({
      id: putawayTasks.id,
      taskNumber: putawayTasks.taskNumber,
      merchantId: putawayTasks.merchantId,
      merchantName: merchants.businessName,
      warehouseId: putawayTasks.warehouseId,
      warehouseName: warehouses.name,
      warehouseReceiptId: putawayTasks.warehouseReceiptId,
      receiptNumber: warehouseReceipts.receiptNumber,
      inventoryItemId: putawayTasks.inventoryItemId,
      inventoryItemName: products.name,
      inventoryItemSku: inventoryItems.skuId,
      sourceLocationId: putawayTasks.sourceLocationId,
      destinationLocationId: putawayTasks.destinationLocationId,
      quantity: putawayTasks.quantity,
      batchNumber: putawayTasks.batchNumber,
      status: putawayTasks.status,
      assignedTo: putawayTasks.assignedTo,
      assigneeName: users.fullName,
      startedAt: putawayTasks.startedAt,
      completedAt: putawayTasks.completedAt,
      notes: putawayTasks.notes,
      createdAt: putawayTasks.createdAt,
      updatedAt: putawayTasks.updatedAt,
    })
    .from(putawayTasks)
    .innerJoin(merchants, eq(merchants.id, putawayTasks.merchantId))
    .innerJoin(warehouses, eq(warehouses.id, putawayTasks.warehouseId))
    .innerJoin(inventoryItems, eq(inventoryItems.id, putawayTasks.inventoryItemId))
    .innerJoin(products, eq(products.id, inventoryItems.productId))
    .leftJoin(warehouseReceipts, eq(warehouseReceipts.id, putawayTasks.warehouseReceiptId))
    .leftJoin(users, eq(users.id, putawayTasks.assignedTo))
    .where(eq(putawayTasks.id, id))
    .limit(1);
  if (!header) throw ApiError.notFound('Tugas put-away tidak ditemukan');
  return header;
}

async function loadAllocationDetail(id: string) {
  const [header] = await db
    .select({
      id: warehouseAllocations.id,
      allocationNumber: warehouseAllocations.allocationNumber,
      merchantId: warehouseAllocations.merchantId,
      merchantName: merchants.businessName,
      warehouseId: warehouseAllocations.warehouseId,
      warehouseName: warehouses.name,
      warehouseLocationId: warehouseAllocations.warehouseLocationId,
      locationName: warehouseLocations.name,
      inventoryItemId: warehouseAllocations.inventoryItemId,
      inventoryItemName: products.name,
      inventoryItemSku: inventoryItems.skuId,
      orderId: warehouseAllocations.orderId,
      orderNumber: orders.orderNumber,
      orderItemId: warehouseAllocations.orderItemId,
      quantity: warehouseAllocations.quantity,
      status: warehouseAllocations.status,
      allocatedAt: warehouseAllocations.allocatedAt,
      releasedAt: warehouseAllocations.releasedAt,
      notes: warehouseAllocations.notes,
      createdAt: warehouseAllocations.createdAt,
      updatedAt: warehouseAllocations.updatedAt,
    })
    .from(warehouseAllocations)
    .innerJoin(merchants, eq(merchants.id, warehouseAllocations.merchantId))
    .innerJoin(warehouses, eq(warehouses.id, warehouseAllocations.warehouseId))
    .innerJoin(warehouseLocations, eq(warehouseLocations.id, warehouseAllocations.warehouseLocationId))
    .innerJoin(inventoryItems, eq(inventoryItems.id, warehouseAllocations.inventoryItemId))
    .innerJoin(products, eq(products.id, inventoryItems.productId))
    .leftJoin(orders, eq(orders.id, warehouseAllocations.orderId))
    .where(eq(warehouseAllocations.id, id))
    .limit(1);
  if (!header) throw ApiError.notFound('Alokasi stok tidak ditemukan');
  return header;
}

export const supplyChainWarehouseRoutes = new Hono<AppEnv>();

/* --------------------------- Warehouse receipts -------------------------- */

supplyChainWarehouseRoutes.get(
  '/warehouse-receipts',
  requirePermission('supply_chain:read'),
  validate('query', listReceiptSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = supplyChainScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(warehouseReceipts.merchantId, query.merchantId));
    if (query.warehouseId) conditions.push(eq(warehouseReceipts.warehouseId, query.warehouseId));
    if (query.status) conditions.push(eq(warehouseReceipts.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(warehouseReceipts.receiptNumber, term),
          ilike(warehouses.name, term),
          ilike(merchants.businessName, term),
        ) as SQL,
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: warehouseReceipts.id,
          receiptNumber: warehouseReceipts.receiptNumber,
          merchantId: warehouseReceipts.merchantId,
          merchantName: merchants.businessName,
          warehouseId: warehouseReceipts.warehouseId,
          warehouseName: warehouses.name,
          source: warehouseReceipts.source,
          status: warehouseReceipts.status,
          expectedQuantity: warehouseReceipts.expectedQuantity,
          receivedQuantity: warehouseReceipts.receivedQuantity,
          createdAt: warehouseReceipts.createdAt,
        })
        .from(warehouseReceipts)
        .innerJoin(merchants, eq(merchants.id, warehouseReceipts.merchantId))
        .innerJoin(warehouses, eq(warehouses.id, warehouseReceipts.warehouseId))
        .where(where)
        .orderBy(desc(warehouseReceipts.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(warehouseReceipts)
        .innerJoin(merchants, eq(merchants.id, warehouseReceipts.merchantId))
        .innerJoin(warehouses, eq(warehouses.id, warehouseReceipts.warehouseId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

supplyChainWarehouseRoutes.post(
  '/warehouse-receipts',
  requirePermission('supply_chain:write'),
  validate('json', createReceiptSchema),
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
    const [created] = await db
      .insert(warehouseReceipts)
      .values({
        receiptNumber: generateCode('WRCP'),
        merchantId: body.merchantId,
        warehouseId: body.warehouseId,
        warehouseLocationId: body.warehouseLocationId,
        source: 'manual',
        status: 'pending',
        expectedQuantity: quantity(toNumber(body.expectedQuantity)),
        notes: body.notes ?? null,
      })
      .returning();
    return ok(c, await loadWarehouseReceiptDetail(created!.id), 201);
  },
);

supplyChainWarehouseRoutes.get(
  '/warehouse-receipts/:id',
  requirePermission('supply_chain:read'),
  async (c) => {
    const { warehouseReceipt } = await getWarehouseReceipt(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    return ok(c, await loadWarehouseReceiptDetail(warehouseReceipt.id));
  },
);

supplyChainWarehouseRoutes.post(
  '/warehouse-receipts/:id/start',
  requirePermission('supply_chain:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { warehouseReceipt } = await getWarehouseReceipt(
      c.req.param('id'),
      user,
      permissions,
      { manage: true },
    );
    if (warehouseReceipt.status !== 'pending') {
      throw ApiError.badRequest('Penerimaan gudang tidak dapat dimulai');
    }
    await db
      .update(warehouseReceipts)
      .set({
        status: 'receiving',
        startedAt: new Date(),
        receivedBy: user.id,
      })
      .where(eq(warehouseReceipts.id, warehouseReceipt.id));
    return ok(c, await loadWarehouseReceiptDetail(warehouseReceipt.id));
  },
);

supplyChainWarehouseRoutes.post(
  '/warehouse-receipts/:id/complete',
  requirePermission('supply_chain:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { warehouseReceipt } = await getWarehouseReceipt(
      c.req.param('id'),
      user,
      permissions,
      { manage: true },
    );
    if (!['pending', 'receiving', 'received'].includes(warehouseReceipt.status)) {
      throw ApiError.badRequest('Penerimaan gudang tidak dapat diselesaikan');
    }
    const tasks = await db
      .select()
      .from(putawayTasks)
      .where(eq(putawayTasks.warehouseReceiptId, warehouseReceipt.id));
    if (tasks.some((task) => !['completed', 'cancelled'].includes(task.status))) {
      throw ApiError.badRequest('Masih ada tugas put-away yang belum selesai');
    }
    await db
      .update(warehouseReceipts)
      .set({ status: 'put_away', completedAt: new Date() })
      .where(eq(warehouseReceipts.id, warehouseReceipt.id));
    return ok(c, await loadWarehouseReceiptDetail(warehouseReceipt.id));
  },
);

supplyChainWarehouseRoutes.post(
  '/warehouse-receipts/:id/cancel',
  requirePermission('supply_chain:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { warehouseReceipt } = await getWarehouseReceipt(
      c.req.param('id'),
      user,
      permissions,
      { manage: true },
    );
    if (['put_away', 'cancelled'].includes(warehouseReceipt.status)) {
      throw ApiError.badRequest('Penerimaan gudang tidak dapat dibatalkan');
    }
    await db.transaction(async (tx) => {
      await tx
        .update(warehouseReceipts)
        .set({ status: 'cancelled' })
        .where(eq(warehouseReceipts.id, warehouseReceipt.id));
      await tx
        .update(putawayTasks)
        .set({ status: 'cancelled' })
        .where(
          and(
            eq(putawayTasks.warehouseReceiptId, warehouseReceipt.id),
            inArray(putawayTasks.status, ['pending', 'in_progress']),
          ),
        );
    });
    return ok(c, await loadWarehouseReceiptDetail(warehouseReceipt.id));
  },
);

/* ------------------------------ Put-away task ---------------------------- */

supplyChainWarehouseRoutes.get(
  '/putaway-tasks',
  requirePermission('supply_chain:read'),
  validate('query', listPutawaySchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = supplyChainScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(putawayTasks.merchantId, query.merchantId));
    if (query.warehouseId) conditions.push(eq(putawayTasks.warehouseId, query.warehouseId));
    if (query.warehouseReceiptId) {
      conditions.push(eq(putawayTasks.warehouseReceiptId, query.warehouseReceiptId));
    }
    if (query.status) conditions.push(eq(putawayTasks.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(putawayTasks.taskNumber, term),
          ilike(products.name, term),
          ilike(merchants.businessName, term),
        ) as SQL,
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: putawayTasks.id,
          taskNumber: putawayTasks.taskNumber,
          merchantId: putawayTasks.merchantId,
          merchantName: merchants.businessName,
          warehouseId: putawayTasks.warehouseId,
          warehouseName: warehouses.name,
          warehouseReceiptId: putawayTasks.warehouseReceiptId,
          inventoryItemId: putawayTasks.inventoryItemId,
          inventoryItemName: products.name,
          sourceLocationId: putawayTasks.sourceLocationId,
          destinationLocationId: putawayTasks.destinationLocationId,
          quantity: putawayTasks.quantity,
          batchNumber: putawayTasks.batchNumber,
          status: putawayTasks.status,
          createdAt: putawayTasks.createdAt,
        })
        .from(putawayTasks)
        .innerJoin(merchants, eq(merchants.id, putawayTasks.merchantId))
        .innerJoin(warehouses, eq(warehouses.id, putawayTasks.warehouseId))
        .innerJoin(inventoryItems, eq(inventoryItems.id, putawayTasks.inventoryItemId))
        .innerJoin(products, eq(products.id, inventoryItems.productId))
        .where(where)
        .orderBy(desc(putawayTasks.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(putawayTasks)
        .innerJoin(merchants, eq(merchants.id, putawayTasks.merchantId))
        .innerJoin(warehouses, eq(warehouses.id, putawayTasks.warehouseId))
        .innerJoin(inventoryItems, eq(inventoryItems.id, putawayTasks.inventoryItemId))
        .innerJoin(products, eq(products.id, inventoryItems.productId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

supplyChainWarehouseRoutes.post(
  '/putaway-tasks',
  requirePermission('supply_chain:write'),
  validate('json', createPutawaySchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertSupplyChainAccess(body.merchantId, user, permissions, { manage: true });
    const { warehouse } = await getWarehouse(body.warehouseId, user, permissions);
    if (warehouse.merchantId !== body.merchantId) {
      throw ApiError.badRequest('Gudang tidak sesuai dengan merchant');
    }
    const { item } = await getInventoryItem(body.inventoryItemId, user, permissions);
    if (item.merchantId !== body.merchantId) {
      throw ApiError.badRequest('Item persediaan tidak sesuai dengan merchant');
    }
    const { location: source } = await getWarehouseLocation(
      body.sourceLocationId,
      user,
      permissions,
    );
    if (source.warehouseId !== body.warehouseId) {
      throw ApiError.badRequest('Lokasi sumber tidak berada pada gudang yang dipilih');
    }
    if (body.destinationLocationId) {
      const { location: destination } = await getWarehouseLocation(
        body.destinationLocationId,
        user,
        permissions,
      );
      if (destination.warehouseId !== body.warehouseId) {
        throw ApiError.badRequest('Lokasi tujuan tidak berada pada gudang yang dipilih');
      }
    }
    if (body.warehouseReceiptId) {
      const { warehouseReceipt } = await getWarehouseReceipt(
        body.warehouseReceiptId,
        user,
        permissions,
      );
      if (warehouseReceipt.merchantId !== body.merchantId) {
        throw ApiError.badRequest('Penerimaan gudang tidak sesuai dengan merchant');
      }
    }
    const [created] = await db
      .insert(putawayTasks)
      .values({
        taskNumber: generateCode('PUT'),
        merchantId: body.merchantId,
        warehouseId: body.warehouseId,
        warehouseReceiptId: body.warehouseReceiptId ?? null,
        inventoryItemId: body.inventoryItemId,
        sourceLocationId: body.sourceLocationId,
        destinationLocationId: body.destinationLocationId ?? null,
        quantity: quantity(toNumber(body.quantity)),
        batchNumber: body.batchNumber ?? null,
        assignedTo: body.assignedTo ?? null,
        status: 'pending',
        notes: body.notes ?? null,
        createdBy: user.id,
      })
      .returning();
    return ok(c, await loadPutawayDetail(created!.id), 201);
  },
);

supplyChainWarehouseRoutes.get(
  '/putaway-tasks/:id',
  requirePermission('supply_chain:read'),
  async (c) => {
    const { putawayTask } = await getPutawayTask(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    return ok(c, await loadPutawayDetail(putawayTask.id));
  },
);

supplyChainWarehouseRoutes.patch(
  '/putaway-tasks/:id',
  requirePermission('supply_chain:write'),
  validate('json', updatePutawaySchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { putawayTask } = await getPutawayTask(
      c.req.param('id'),
      user,
      permissions,
      { manage: true },
    );
    if (!['pending', 'in_progress'].includes(putawayTask.status)) {
      throw ApiError.badRequest('Tugas put-away tidak dapat diubah');
    }
    if (body.destinationLocationId) {
      const { location } = await getWarehouseLocation(
        body.destinationLocationId,
        user,
        permissions,
      );
      if (location.warehouseId !== putawayTask.warehouseId) {
        throw ApiError.badRequest('Lokasi tujuan tidak sesuai dengan gudang');
      }
    }
    await db
      .update(putawayTasks)
      .set({
        destinationLocationId: body.destinationLocationId,
        quantity: body.quantity ? quantity(toNumber(body.quantity)) : undefined,
        batchNumber: body.batchNumber,
        assignedTo: body.assignedTo,
        notes: body.notes,
      })
      .where(eq(putawayTasks.id, putawayTask.id));
    return ok(c, await loadPutawayDetail(putawayTask.id));
  },
);

supplyChainWarehouseRoutes.post(
  '/putaway-tasks/:id/start',
  requirePermission('supply_chain:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { putawayTask } = await getPutawayTask(
      c.req.param('id'),
      user,
      permissions,
      { manage: true },
    );
    if (putawayTask.status !== 'pending') {
      throw ApiError.badRequest('Tugas put-away tidak dapat dimulai');
    }
    await db
      .update(putawayTasks)
      .set({ status: 'in_progress', startedAt: new Date(), assignedTo: user.id })
      .where(eq(putawayTasks.id, putawayTask.id));
    return ok(c, await loadPutawayDetail(putawayTask.id));
  },
);

supplyChainWarehouseRoutes.post(
  '/putaway-tasks/:id/complete',
  requirePermission('supply_chain:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { putawayTask } = await getPutawayTask(
      c.req.param('id'),
      user,
      permissions,
      { manage: true },
    );
    if (!['pending', 'in_progress'].includes(putawayTask.status)) {
      throw ApiError.badRequest('Tugas put-away tidak dapat diselesaikan');
    }
    if (!putawayTask.destinationLocationId) {
      throw ApiError.badRequest('Lokasi tujuan put-away wajib diisi');
    }
    if (putawayTask.destinationLocationId === putawayTask.sourceLocationId) {
      throw ApiError.badRequest('Lokasi tujuan harus berbeda dari lokasi sumber');
    }
    const { location: destination } = await getWarehouseLocation(
      putawayTask.destinationLocationId,
      user,
      permissions,
    );
    if (destination.warehouseId !== putawayTask.warehouseId) {
      throw ApiError.badRequest('Lokasi tujuan tidak sesuai dengan gudang');
    }

    await db.transaction(async (tx) => {
      await applyMovement(tx, {
        merchantId: putawayTask.merchantId,
        movementNumber: generateCode('MOV'),
        type: 'transfer',
        sourceWarehouseId: putawayTask.warehouseId,
        sourceLocationId: putawayTask.sourceLocationId,
        destinationWarehouseId: putawayTask.warehouseId,
        destinationLocationId: putawayTask.destinationLocationId!,
        referenceType: 'putaway_task',
        referenceId: putawayTask.id,
        referenceNumber: putawayTask.taskNumber,
        notes: `Put-away ${putawayTask.taskNumber}`,
        createdBy: user.id,
        lines: [
          {
            inventoryItemId: putawayTask.inventoryItemId,
            quantity: putawayTask.quantity,
            unitCost: '0',
            batchNumber: putawayTask.batchNumber,
          },
        ],
      });
      await tx
        .update(putawayTasks)
        .set({ status: 'completed', completedAt: new Date(), assignedTo: user.id })
        .where(eq(putawayTasks.id, putawayTask.id));
      await recordFulfillmentHistory(tx, {
        merchantId: putawayTask.merchantId,
        entityType: 'putaway_task',
        entityId: putawayTask.id,
        fromStatus: putawayTask.status,
        toStatus: 'completed',
        note: 'Stok dipindahkan ke lokasi penyimpanan',
        changedBy: user.id,
      });

      if (putawayTask.warehouseReceiptId) {
        const tasks = await tx
          .select({ status: putawayTasks.status })
          .from(putawayTasks)
          .where(eq(putawayTasks.warehouseReceiptId, putawayTask.warehouseReceiptId));
        if (tasks.every((task) => ['completed', 'cancelled'].includes(task.status))) {
          await tx
            .update(warehouseReceipts)
            .set({ status: 'put_away', completedAt: new Date() })
            .where(eq(warehouseReceipts.id, putawayTask.warehouseReceiptId));
          await recordFulfillmentHistory(tx, {
            merchantId: putawayTask.merchantId,
            entityType: 'warehouse_receipt',
            entityId: putawayTask.warehouseReceiptId,
            fromStatus: 'received',
            toStatus: 'put_away',
            note: 'Semua tugas put-away selesai',
            changedBy: user.id,
          });
        }
      }
    });
    return ok(c, await loadPutawayDetail(putawayTask.id));
  },
);

supplyChainWarehouseRoutes.post(
  '/putaway-tasks/:id/cancel',
  requirePermission('supply_chain:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { putawayTask } = await getPutawayTask(
      c.req.param('id'),
      user,
      permissions,
      { manage: true },
    );
    if (!['pending', 'in_progress'].includes(putawayTask.status)) {
      throw ApiError.badRequest('Tugas put-away tidak dapat dibatalkan');
    }
    await db
      .update(putawayTasks)
      .set({ status: 'cancelled' })
      .where(eq(putawayTasks.id, putawayTask.id));
    return ok(c, await loadPutawayDetail(putawayTask.id));
  },
);

/* --------------------------- Warehouse allocation ------------------------ */

supplyChainWarehouseRoutes.get(
  '/warehouse-allocations',
  requirePermission('supply_chain:read'),
  validate('query', listAllocationSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = supplyChainScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(warehouseAllocations.merchantId, query.merchantId));
    if (query.warehouseId) {
      conditions.push(eq(warehouseAllocations.warehouseId, query.warehouseId));
    }
    if (query.orderId) conditions.push(eq(warehouseAllocations.orderId, query.orderId));
    if (query.status) conditions.push(eq(warehouseAllocations.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(warehouseAllocations.allocationNumber, term),
          ilike(products.name, term),
          ilike(orders.orderNumber, term),
          ilike(merchants.businessName, term),
        ) as SQL,
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: warehouseAllocations.id,
          allocationNumber: warehouseAllocations.allocationNumber,
          merchantId: warehouseAllocations.merchantId,
          merchantName: merchants.businessName,
          warehouseId: warehouseAllocations.warehouseId,
          warehouseName: warehouses.name,
          warehouseLocationId: warehouseAllocations.warehouseLocationId,
          inventoryItemId: warehouseAllocations.inventoryItemId,
          inventoryItemName: products.name,
          orderId: warehouseAllocations.orderId,
          orderNumber: orders.orderNumber,
          quantity: warehouseAllocations.quantity,
          status: warehouseAllocations.status,
          createdAt: warehouseAllocations.createdAt,
        })
        .from(warehouseAllocations)
        .innerJoin(merchants, eq(merchants.id, warehouseAllocations.merchantId))
        .innerJoin(warehouses, eq(warehouses.id, warehouseAllocations.warehouseId))
        .innerJoin(inventoryItems, eq(inventoryItems.id, warehouseAllocations.inventoryItemId))
        .innerJoin(products, eq(products.id, inventoryItems.productId))
        .leftJoin(orders, eq(orders.id, warehouseAllocations.orderId))
        .where(where)
        .orderBy(desc(warehouseAllocations.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(warehouseAllocations)
        .innerJoin(merchants, eq(merchants.id, warehouseAllocations.merchantId))
        .innerJoin(warehouses, eq(warehouses.id, warehouseAllocations.warehouseId))
        .innerJoin(inventoryItems, eq(inventoryItems.id, warehouseAllocations.inventoryItemId))
        .innerJoin(products, eq(products.id, inventoryItems.productId))
        .leftJoin(orders, eq(orders.id, warehouseAllocations.orderId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

supplyChainWarehouseRoutes.post(
  '/warehouse-allocations',
  requirePermission('supply_chain:write'),
  validate('json', createAllocationSchema),
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
    const { item } = await getInventoryItem(body.inventoryItemId, user, permissions);
    if (item.merchantId !== body.merchantId) {
      throw ApiError.badRequest('Item persediaan tidak sesuai dengan merchant');
    }
    if (body.orderId) {
      const order = await db.query.orders.findFirst({
        where: eq(orders.id, body.orderId),
      });
      if (!order) throw ApiError.notFound('Order tidak ditemukan');
      if (order.merchantId !== body.merchantId) {
        throw ApiError.badRequest('Order tidak sesuai dengan merchant');
      }
    }
    if (body.orderItemId) {
      const orderItem = await db.query.orderItems.findFirst({
        where: eq(orderItems.id, body.orderItemId),
      });
      if (!orderItem) throw ApiError.notFound('Item order tidak ditemukan');
      if (body.orderId && orderItem.orderId !== body.orderId) {
        throw ApiError.badRequest('Item order tidak sesuai dengan order');
      }
      if (!body.orderId) {
        const parent = await db.query.orders.findFirst({
          where: eq(orders.id, orderItem.orderId),
        });
        if (!parent || parent.merchantId !== body.merchantId) {
          throw ApiError.badRequest('Order item tidak sesuai dengan merchant');
        }
      }
    }

    const created = await db.transaction(async (tx) => {
      const [balance] = await tx
        .select()
        .from(stockBalances)
        .where(
          and(
            eq(stockBalances.warehouseLocationId, body.warehouseLocationId),
            eq(stockBalances.inventoryItemId, body.inventoryItemId),
          ),
        )
        .limit(1);
      const available =
        toNumber(balance?.quantity) - toNumber(balance?.reservedQuantity);
      if (!balance || available < toNumber(body.quantity)) {
        throw ApiError.badRequest(
          `Stok tersedia tidak mencukupi (tersedia ${Math.max(available, 0).toFixed(3)})`,
        );
      }
      const [header] = await tx
        .insert(warehouseAllocations)
        .values({
          allocationNumber: generateCode('ALL'),
          merchantId: body.merchantId,
          warehouseId: body.warehouseId,
          warehouseLocationId: body.warehouseLocationId,
          inventoryItemId: body.inventoryItemId,
          orderId: body.orderId ?? null,
          orderItemId: body.orderItemId ?? null,
          quantity: quantity(toNumber(body.quantity)),
          status: 'allocated',
          allocatedAt: new Date(),
          notes: body.notes ?? null,
          createdBy: user.id,
        })
        .returning();
      if (!header) throw ApiError.internal('Gagal membuat alokasi stok');
      await tx
        .update(stockBalances)
        .set({
          reservedQuantity: quantity(
            toNumber(balance.reservedQuantity) + toNumber(body.quantity),
          ),
        })
        .where(eq(stockBalances.id, balance.id));
      await recordFulfillmentHistory(tx, {
        merchantId: body.merchantId,
        entityType: 'warehouse_allocation',
        entityId: header.id,
        toStatus: 'allocated',
        note: 'Stok dialokasikan untuk order',
        changedBy: user.id,
      });
      return header;
    });

    await writeAuditLog({
      actorUserId: user.id,
      action: 'supply_chain.allocation.create',
      entityType: 'warehouse_allocation',
      entityId: created.id,
      newValues: { number: created.allocationNumber, quantity: created.quantity },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, await loadAllocationDetail(created.id), 201);
  },
);

supplyChainWarehouseRoutes.get(
  '/warehouse-allocations/:id',
  requirePermission('supply_chain:read'),
  async (c) => {
    const { allocation } = await getAllocation(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    return ok(c, await loadAllocationDetail(allocation.id));
  },
);

supplyChainWarehouseRoutes.post(
  '/warehouse-allocations/:id/release',
  requirePermission('supply_chain:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { allocation } = await getAllocation(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (allocation.status !== 'allocated') {
      throw ApiError.badRequest('Hanya alokasi aktif yang dapat dilepas');
    }
    await db.transaction(async (tx) => {
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
        merchantId: allocation.merchantId,
        entityType: 'warehouse_allocation',
        entityId: allocation.id,
        fromStatus: 'allocated',
        toStatus: 'released',
        note: 'Alokasi stok dilepas',
        changedBy: user.id,
      });
    });
    return ok(c, await loadAllocationDetail(allocation.id));
  },
);

supplyChainWarehouseRoutes.post(
  '/warehouse-allocations/:id/cancel',
  requirePermission('supply_chain:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { allocation } = await getAllocation(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (allocation.status !== 'pending') {
      throw ApiError.badRequest('Hanya alokasi pending yang dapat dibatalkan');
    }
    await db
      .update(warehouseAllocations)
      .set({ status: 'cancelled' })
      .where(eq(warehouseAllocations.id, allocation.id));
    return ok(c, await loadAllocationDetail(allocation.id));
  },
);
