import { and, asc, count, desc, eq, ilike, isNull, or, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  goodsReceiptItems,
  goodsReceipts,
  inventoryItems,
  merchants,
  products,
  purchaseOrderItems,
  purchaseOrders,
  putawayTasks,
  suppliers,
  users,
  warehouseReceipts,
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
  dateOnlySchema,
  getGoodsReceipt,
  getInventoryItem,
  getPurchaseOrder,
  getWarehouse,
  getWarehouseLocation,
  money,
  numericSchema,
  optionalNumericSchema,
  quantity,
  recordFulfillmentHistory,
  supplyChainScopeCondition,
  toNumber,
  type MovementLineInput,
} from './shared';

const receiptStatusSchema = z.enum(['draft', 'received', 'inspected', 'completed', 'cancelled']);

const receiptItemSchema = z.object({
  purchaseOrderItemId: z.uuid().optional(),
  inventoryItemId: z.uuid().optional(),
  description: z.string().trim().min(2).max(500),
  quantityReceived: numericSchema,
  quantityRejected: optionalNumericSchema.default('0'),
  unitCost: optionalNumericSchema.default('0'),
  batchNumber: z.string().trim().max(100).optional(),
  manufactureDate: dateOnlySchema.optional(),
  expiryDate: dateOnlySchema.optional(),
  notes: z.string().trim().max(1000).optional(),
});

const createReceiptSchema = z.object({
  merchantId: z.uuid(),
  warehouseId: z.uuid(),
  warehouseLocationId: z.uuid(),
  purchaseOrderId: z.uuid().optional(),
  notes: z.string().trim().max(2000).optional(),
  items: z.array(receiptItemSchema).min(1).max(100),
});

const listReceiptSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  warehouseId: z.uuid().optional(),
  purchaseOrderId: z.uuid().optional(),
  status: receiptStatusSchema.optional(),
});

async function loadReceiptDetail(id: string) {
  const [header] = await db
    .select({
      id: goodsReceipts.id,
      merchantId: goodsReceipts.merchantId,
      merchantName: merchants.businessName,
      receiptNumber: goodsReceipts.receiptNumber,
      warehouseId: goodsReceipts.warehouseId,
      warehouseLocationId: goodsReceipts.warehouseLocationId,
      purchaseOrderId: goodsReceipts.purchaseOrderId,
      purchaseOrderNumber: purchaseOrders.orderNumber,
      supplierId: goodsReceipts.supplierId,
      supplierName: suppliers.name,
      stockMovementId: goodsReceipts.stockMovementId,
      status: goodsReceipts.status,
      receivedBy: goodsReceipts.receivedBy,
      receiverName: users.fullName,
      receivedAt: goodsReceipts.receivedAt,
      inspectedAt: goodsReceipts.inspectedAt,
      notes: goodsReceipts.notes,
      createdAt: goodsReceipts.createdAt,
      updatedAt: goodsReceipts.updatedAt,
    })
    .from(goodsReceipts)
    .innerJoin(merchants, eq(merchants.id, goodsReceipts.merchantId))
    .leftJoin(purchaseOrders, eq(purchaseOrders.id, goodsReceipts.purchaseOrderId))
    .leftJoin(suppliers, eq(suppliers.id, goodsReceipts.supplierId))
    .leftJoin(users, eq(users.id, goodsReceipts.receivedBy))
    .where(eq(goodsReceipts.id, id))
    .limit(1);
  if (!header) throw ApiError.notFound('Penerimaan barang tidak ditemukan');

  const items = await db
    .select({
      id: goodsReceiptItems.id,
      purchaseOrderItemId: goodsReceiptItems.purchaseOrderItemId,
      inventoryItemId: goodsReceiptItems.inventoryItemId,
      inventoryItemName: products.name,
      inventoryItemSku: inventoryItems.skuId,
      productId: goodsReceiptItems.productId,
      skuId: goodsReceiptItems.skuId,
      description: goodsReceiptItems.description,
      quantityReceived: goodsReceiptItems.quantityReceived,
      quantityRejected: goodsReceiptItems.quantityRejected,
      unitCost: goodsReceiptItems.unitCost,
      batchNumber: goodsReceiptItems.batchNumber,
      manufactureDate: goodsReceiptItems.manufactureDate,
      expiryDate: goodsReceiptItems.expiryDate,
      notes: goodsReceiptItems.notes,
    })
    .from(goodsReceiptItems)
    .leftJoin(inventoryItems, eq(inventoryItems.id, goodsReceiptItems.inventoryItemId))
    .leftJoin(products, eq(products.id, inventoryItems.productId))
    .where(eq(goodsReceiptItems.goodsReceiptId, id))
    .orderBy(asc(goodsReceiptItems.createdAt));

  return { ...header, items };
}

export const supplyChainReceivingRoutes = new Hono<AppEnv>();

supplyChainReceivingRoutes.get(
  '/goods-receipts',
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
    if (query.merchantId) conditions.push(eq(goodsReceipts.merchantId, query.merchantId));
    if (query.warehouseId) conditions.push(eq(goodsReceipts.warehouseId, query.warehouseId));
    if (query.purchaseOrderId) {
      conditions.push(eq(goodsReceipts.purchaseOrderId, query.purchaseOrderId));
    }
    if (query.status) conditions.push(eq(goodsReceipts.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(goodsReceipts.receiptNumber, term),
          ilike(purchaseOrders.orderNumber, term),
          ilike(suppliers.name, term),
          ilike(merchants.businessName, term),
        ) as SQL,
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: goodsReceipts.id,
          receiptNumber: goodsReceipts.receiptNumber,
          merchantId: goodsReceipts.merchantId,
          merchantName: merchants.businessName,
          warehouseId: goodsReceipts.warehouseId,
          warehouseLocationId: goodsReceipts.warehouseLocationId,
          purchaseOrderId: goodsReceipts.purchaseOrderId,
          purchaseOrderNumber: purchaseOrders.orderNumber,
          supplierName: suppliers.name,
          status: goodsReceipts.status,
          receivedAt: goodsReceipts.receivedAt,
          createdAt: goodsReceipts.createdAt,
        })
        .from(goodsReceipts)
        .innerJoin(merchants, eq(merchants.id, goodsReceipts.merchantId))
        .leftJoin(purchaseOrders, eq(purchaseOrders.id, goodsReceipts.purchaseOrderId))
        .leftJoin(suppliers, eq(suppliers.id, goodsReceipts.supplierId))
        .where(where)
        .orderBy(desc(goodsReceipts.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(goodsReceipts)
        .innerJoin(merchants, eq(merchants.id, goodsReceipts.merchantId))
        .leftJoin(purchaseOrders, eq(purchaseOrders.id, goodsReceipts.purchaseOrderId))
        .leftJoin(suppliers, eq(suppliers.id, goodsReceipts.supplierId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

supplyChainReceivingRoutes.post(
  '/goods-receipts',
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

    let purchaseOrderId: string | null = null;
    let supplierId: string | null = null;
    let poItems: Array<typeof purchaseOrderItems.$inferSelect> = [];
    if (body.purchaseOrderId) {
      const { purchaseOrder } = await getPurchaseOrder(
        body.purchaseOrderId,
        user,
        permissions,
      );
      if (purchaseOrder.merchantId !== body.merchantId) {
        throw ApiError.badRequest('Purchase order tidak sesuai dengan merchant');
      }
      if (!['ordered', 'partially_received'].includes(purchaseOrder.status)) {
        throw ApiError.badRequest(
          'Purchase order harus berstatus dikirim atau diterima sebagian',
        );
      }
      purchaseOrderId = purchaseOrder.id;
      supplierId = purchaseOrder.supplierId;
      poItems = await db
        .select()
        .from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrder.id));
    }

    for (const item of body.items) {
      if (item.inventoryItemId) {
        const { item: inventoryItem } = await getInventoryItem(
          item.inventoryItemId,
          user,
          permissions,
        );
        if (inventoryItem.merchantId !== body.merchantId) {
          throw ApiError.badRequest('Item persediaan tidak sesuai dengan merchant');
        }
      }
      if (item.purchaseOrderItemId) {
        const poItem = poItems.find((row) => row.id === item.purchaseOrderItemId);
        if (!poItem) {
          throw ApiError.badRequest('Item purchase order tidak ditemukan');
        }
        const remaining =
          toNumber(poItem.quantity) - toNumber(poItem.receivedQuantity);
        if (toNumber(item.quantityReceived) + toNumber(item.quantityRejected) > remaining) {
          throw ApiError.badRequest(
            `Jumlah penerimaan melebihi sisa purchase order (${remaining.toFixed(3)})`,
          );
        }
      }
    }

    const created = await db.transaction(async (tx) => {
      const [header] = await tx
        .insert(goodsReceipts)
        .values({
          receiptNumber: generateCode('GR'),
          merchantId: body.merchantId,
          warehouseId: body.warehouseId,
          warehouseLocationId: body.warehouseLocationId,
          purchaseOrderId,
          supplierId,
          status: 'draft',
          notes: body.notes ?? null,
        })
        .returning();
      if (!header) throw ApiError.internal('Gagal membuat penerimaan barang');

      for (const item of body.items) {
        await tx.insert(goodsReceiptItems).values({
          goodsReceiptId: header.id,
          purchaseOrderItemId: item.purchaseOrderItemId ?? null,
          inventoryItemId: item.inventoryItemId ?? null,
          description: item.description,
          quantityReceived: quantity(toNumber(item.quantityReceived)),
          quantityRejected: quantity(toNumber(item.quantityRejected)),
          unitCost: money(toNumber(item.unitCost)),
          batchNumber: item.batchNumber ?? null,
          manufactureDate: item.manufactureDate ?? null,
          expiryDate: item.expiryDate ?? null,
          notes: item.notes ?? null,
        });
      }
      return header;
    });

    await writeAuditLog({
      actorUserId: user.id,
      action: 'supply_chain.goods_receipt.create',
      entityType: 'goods_receipt',
      entityId: created.id,
      newValues: { number: created.receiptNumber },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, await loadReceiptDetail(created.id), 201);
  },
);

supplyChainReceivingRoutes.get(
  '/goods-receipts/:id',
  requirePermission('supply_chain:read'),
  async (c) => {
    const { goodsReceipt } = await getGoodsReceipt(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    return ok(c, await loadReceiptDetail(goodsReceipt.id));
  },
);

supplyChainReceivingRoutes.post(
  '/goods-receipts/:id/inspect',
  requirePermission('supply_chain:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { goodsReceipt } = await getGoodsReceipt(
      c.req.param('id'),
      user,
      permissions,
      { manage: true },
    );
    if (!['received', 'inspected'].includes(goodsReceipt.status)) {
      throw ApiError.badRequest('Penerimaan belum dapat diperiksa');
    }
    await db
      .update(goodsReceipts)
      .set({ status: 'inspected', inspectedAt: new Date() })
      .where(eq(goodsReceipts.id, goodsReceipt.id));
    return ok(c, await loadReceiptDetail(goodsReceipt.id));
  },
);

supplyChainReceivingRoutes.post(
  '/goods-receipts/:id/complete',
  requirePermission('supply_chain:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { goodsReceipt } = await getGoodsReceipt(
      c.req.param('id'),
      user,
      permissions,
      { manage: true },
    );
    if (!['draft', 'received', 'inspected'].includes(goodsReceipt.status)) {
      throw ApiError.badRequest('Penerimaan barang tidak dapat diselesaikan');
    }

    const result = await db.transaction(async (tx) => {
      const items = await tx
        .select()
        .from(goodsReceiptItems)
        .where(eq(goodsReceiptItems.goodsReceiptId, goodsReceipt.id))
        .orderBy(asc(goodsReceiptItems.createdAt));

      const accepted = items.filter((item) => toNumber(item.quantityReceived) > 0);
      if (accepted.length === 0) {
        throw ApiError.badRequest('Tidak ada jumlah barang yang diterima');
      }
      if (accepted.some((item) => !item.inventoryItemId)) {
        throw ApiError.badRequest(
          'Semua item yang diterima harus terkait item persediaan',
        );
      }

      const lines: MovementLineInput[] = accepted.map((item) => ({
        inventoryItemId: item.inventoryItemId!,
        quantity: item.quantityReceived,
        unitCost: item.unitCost,
        batchNumber: item.batchNumber,
        manufactureDate: item.manufactureDate,
        expiryDate: item.expiryDate,
        notes: item.notes,
      }));

      const movement = await applyMovement(tx, {
        merchantId: goodsReceipt.merchantId,
        movementNumber: generateCode('MOV'),
        type: 'inbound',
        destinationWarehouseId: goodsReceipt.warehouseId,
        destinationLocationId: goodsReceipt.warehouseLocationId,
        referenceType: 'goods_receipt',
        referenceId: goodsReceipt.id,
        referenceNumber: goodsReceipt.receiptNumber,
        notes: `Penerimaan barang ${goodsReceipt.receiptNumber}`,
        createdBy: user.id,
        lines,
      });

      if (goodsReceipt.purchaseOrderId) {
        for (const item of items) {
          if (!item.purchaseOrderItemId) continue;
          const [poItem] = await tx
            .select()
            .from(purchaseOrderItems)
            .where(eq(purchaseOrderItems.id, item.purchaseOrderItemId))
            .limit(1);
          if (!poItem) continue;
          await tx
            .update(purchaseOrderItems)
            .set({
              receivedQuantity: quantity(
                toNumber(poItem.receivedQuantity) + toNumber(item.quantityReceived),
              ),
            })
            .where(eq(purchaseOrderItems.id, poItem.id));
        }

        const allPoItems = await tx
          .select()
          .from(purchaseOrderItems)
          .where(eq(purchaseOrderItems.purchaseOrderId, goodsReceipt.purchaseOrderId));
        const allReceived = allPoItems.every(
          (item) => toNumber(item.receivedQuantity) >= toNumber(item.quantity),
        );
        await tx
          .update(purchaseOrders)
          .set({ status: allReceived ? 'received' : 'partially_received' })
          .where(eq(purchaseOrders.id, goodsReceipt.purchaseOrderId));
      }

      const totalReceived = accepted.reduce(
        (total, item) => total + toNumber(item.quantityReceived),
        0,
      );
      const [warehouseReceipt] = await tx
        .insert(warehouseReceipts)
        .values({
          receiptNumber: generateCode('WRCP'),
          merchantId: goodsReceipt.merchantId,
          warehouseId: goodsReceipt.warehouseId,
          warehouseLocationId: goodsReceipt.warehouseLocationId,
          goodsReceiptId: goodsReceipt.id,
          purchaseOrderId: goodsReceipt.purchaseOrderId,
          stockMovementId: movement.id,
          source: 'goods_receipt',
          status: 'received',
          expectedQuantity: quantity(totalReceived),
          receivedQuantity: quantity(totalReceived),
          receivedBy: user.id,
          startedAt: new Date(),
          completedAt: new Date(),
          notes: `Penerimaan dari ${goodsReceipt.receiptNumber}`,
        })
        .returning();
      if (!warehouseReceipt) throw ApiError.internal('Gagal membuat penerimaan gudang');

      for (const item of accepted) {
        await tx.insert(putawayTasks).values({
          taskNumber: generateCode('PUT'),
          merchantId: goodsReceipt.merchantId,
          warehouseId: goodsReceipt.warehouseId,
          warehouseReceiptId: warehouseReceipt.id,
          inventoryItemId: item.inventoryItemId!,
          sourceLocationId: goodsReceipt.warehouseLocationId,
          quantity: item.quantityReceived,
          batchNumber: item.batchNumber,
          status: 'pending',
          notes: `Put-away dari ${goodsReceipt.receiptNumber}`,
          createdBy: user.id,
        });
      }

      await recordFulfillmentHistory(tx, {
        merchantId: goodsReceipt.merchantId,
        entityType: 'warehouse_receipt',
        entityId: warehouseReceipt.id,
        toStatus: 'received',
        note: 'Barang diterima dan menunggu put-away',
        changedBy: user.id,
      });

      await tx
        .update(goodsReceipts)
        .set({
          status: 'completed',
          receivedBy: user.id,
          receivedAt: new Date(),
          inspectedAt: goodsReceipt.inspectedAt ?? new Date(),
          stockMovementId: movement.id,
        })
        .where(eq(goodsReceipts.id, goodsReceipt.id));

      return { movement, warehouseReceipt };
    });

    await writeAuditLog({
      actorUserId: user.id,
      action: 'supply_chain.goods_receipt.complete',
      entityType: 'goods_receipt',
      entityId: goodsReceipt.id,
      newValues: {
        stockMovementId: result.movement.id,
        warehouseReceiptId: result.warehouseReceipt.id,
      },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, await loadReceiptDetail(goodsReceipt.id));
  },
);

supplyChainReceivingRoutes.post(
  '/goods-receipts/:id/cancel',
  requirePermission('supply_chain:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { goodsReceipt } = await getGoodsReceipt(
      c.req.param('id'),
      user,
      permissions,
      { manage: true },
    );
    if (!['draft', 'received', 'inspected'].includes(goodsReceipt.status)) {
      throw ApiError.badRequest('Penerimaan barang tidak dapat dibatalkan');
    }
    await db
      .update(goodsReceipts)
      .set({ status: 'cancelled' })
      .where(eq(goodsReceipts.id, goodsReceipt.id));
    return ok(c, await loadReceiptDetail(goodsReceipt.id));
  },
);
