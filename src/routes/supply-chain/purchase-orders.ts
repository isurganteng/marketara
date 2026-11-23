import { and, asc, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  goodsReceipts,
  inventoryItems,
  merchants,
  procurementApprovals,
  products,
  purchaseOrderItems,
  purchaseOrders,
  purchaseRequisitionItems,
  purchaseRequisitions,
  supplierQuotationItems,
  supplierQuotations,
  suppliers,
  users,
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
  assertSupplyChainAccess,
  createApproval,
  dateOnlySchema,
  getInventoryItem,
  getPurchaseOrder,
  getQuotation,
  getRequisition,
  getSupplier,
  getWarehouse,
  money,
  numericSchema,
  optionalNumericSchema,
  quantity,
  sumLines,
  supplyChainScopeCondition,
  toNumber,
} from './shared';

const orderStatusSchema = z.enum([
  'draft',
  'pending_approval',
  'approved',
  'ordered',
  'partially_received',
  'received',
  'cancelled',
  'closed',
]);

const orderItemSchema = z.object({
  requisitionItemId: z.uuid().optional(),
  inventoryItemId: z.uuid().optional(),
  productId: z.uuid().optional(),
  skuId: z.uuid().optional(),
  description: z.string().trim().min(2).max(500),
  quantity: numericSchema,
  unitPrice: optionalNumericSchema.default('0'),
  notes: z.string().trim().max(1000).optional(),
});

const createOrderSchema = z.object({
  merchantId: z.uuid(),
  supplierId: z.uuid(),
  warehouseId: z.uuid().optional(),
  requisitionId: z.uuid().optional(),
  quotationId: z.uuid().optional(),
  expectedDeliveryDate: dateOnlySchema.optional(),
  paymentTermDays: z.coerce.number().int().min(0).max(3650).default(0),
  discountTotal: optionalNumericSchema.default('0'),
  taxTotal: optionalNumericSchema.default('0'),
  shippingTotal: optionalNumericSchema.default('0'),
  notes: z.string().trim().max(2000).optional(),
  items: z.array(orderItemSchema).min(1).max(100).optional(),
});

const updateOrderSchema = z.object({
  supplierId: z.uuid().optional(),
  warehouseId: z.uuid().nullable().optional(),
  expectedDeliveryDate: dateOnlySchema.nullable().optional(),
  paymentTermDays: z.coerce.number().int().min(0).max(3650).optional(),
  discountTotal: optionalNumericSchema.optional(),
  taxTotal: optionalNumericSchema.optional(),
  shippingTotal: optionalNumericSchema.optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  items: z.array(orderItemSchema).min(1).max(100).optional(),
});

const listOrderSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  supplierId: z.uuid().optional(),
  status: orderStatusSchema.optional(),
});

const convertRequisitionSchema = z.object({
  supplierId: z.uuid(),
  warehouseId: z.uuid().optional(),
  expectedDeliveryDate: dateOnlySchema.optional(),
  paymentTermDays: z.coerce.number().int().min(0).max(3650).default(0),
  notes: z.string().trim().max(2000).optional(),
});

const convertQuotationSchema = z.object({
  warehouseId: z.uuid().optional(),
  expectedDeliveryDate: dateOnlySchema.optional(),
  notes: z.string().trim().max(2000).optional(),
});

async function loadOrderDetail(id: string) {
  const [header] = await db
    .select({
      id: purchaseOrders.id,
      merchantId: purchaseOrders.merchantId,
      merchantName: merchants.businessName,
      orderNumber: purchaseOrders.orderNumber,
      supplierId: purchaseOrders.supplierId,
      supplierName: suppliers.name,
      supplierCode: suppliers.code,
      warehouseId: purchaseOrders.warehouseId,
      requisitionId: purchaseOrders.requisitionId,
      quotationId: purchaseOrders.quotationId,
      status: purchaseOrders.status,
      currency: purchaseOrders.currency,
      subtotal: purchaseOrders.subtotal,
      discountTotal: purchaseOrders.discountTotal,
      taxTotal: purchaseOrders.taxTotal,
      shippingTotal: purchaseOrders.shippingTotal,
      grandTotal: purchaseOrders.grandTotal,
      paymentTermDays: purchaseOrders.paymentTermDays,
      expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
      orderedAt: purchaseOrders.orderedAt,
      approvedAt: purchaseOrders.approvedAt,
      cancelledAt: purchaseOrders.cancelledAt,
      notes: purchaseOrders.notes,
      createdBy: purchaseOrders.createdBy,
      creatorName: users.fullName,
      createdAt: purchaseOrders.createdAt,
      updatedAt: purchaseOrders.updatedAt,
    })
    .from(purchaseOrders)
    .innerJoin(merchants, eq(merchants.id, purchaseOrders.merchantId))
    .innerJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
    .leftJoin(users, eq(users.id, purchaseOrders.createdBy))
    .where(eq(purchaseOrders.id, id))
    .limit(1);
  if (!header) throw ApiError.notFound('Purchase order tidak ditemukan');

  const items = await db
    .select({
      id: purchaseOrderItems.id,
      requisitionItemId: purchaseOrderItems.requisitionItemId,
      inventoryItemId: purchaseOrderItems.inventoryItemId,
      inventoryItemName: products.name,
      productId: purchaseOrderItems.productId,
      skuId: purchaseOrderItems.skuId,
      description: purchaseOrderItems.description,
      quantity: purchaseOrderItems.quantity,
      receivedQuantity: purchaseOrderItems.receivedQuantity,
      unitPrice: purchaseOrderItems.unitPrice,
      lineTotal: purchaseOrderItems.lineTotal,
      notes: purchaseOrderItems.notes,
    })
    .from(purchaseOrderItems)
    .leftJoin(inventoryItems, eq(inventoryItems.id, purchaseOrderItems.inventoryItemId))
    .leftJoin(products, eq(products.id, inventoryItems.productId))
    .where(eq(purchaseOrderItems.purchaseOrderId, id))
    .orderBy(asc(purchaseOrderItems.createdAt));

  const [receiptSummary] = await db
    .select({ total: count() })
    .from(goodsReceipts)
    .where(eq(goodsReceipts.purchaseOrderId, id));

  return { ...header, items, receiptCount: receiptSummary?.total ?? 0 };
}

async function insertOrder(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: {
    merchantId: string;
    supplierId: string;
    warehouseId?: string | null;
    requisitionId?: string | null;
    quotationId?: string | null;
    expectedDeliveryDate?: string | null;
    paymentTermDays: number;
    discountTotal: number;
    taxTotal: number;
    shippingTotal: number;
    notes?: string | null;
    createdBy: string;
    items: Array<{
      requisitionItemId?: string | null;
      inventoryItemId?: string | null;
      productId?: string | null;
      skuId?: string | null;
      description: string;
      quantity: string;
      unitPrice: string;
      notes?: string | null;
    }>;
  },
) {
  const totals = sumLines(
    input.items,
    input.discountTotal,
    input.taxTotal,
    input.shippingTotal,
  );
  const [header] = await tx
    .insert(purchaseOrders)
    .values({
      orderNumber: generateCode('PO'),
      merchantId: input.merchantId,
      warehouseId: input.warehouseId ?? null,
      supplierId: input.supplierId,
      requisitionId: input.requisitionId ?? null,
      quotationId: input.quotationId ?? null,
      expectedDeliveryDate: input.expectedDeliveryDate ?? null,
      paymentTermDays: input.paymentTermDays,
      subtotal: totals.subtotal,
      discountTotal: money(input.discountTotal),
      taxTotal: money(input.taxTotal),
      shippingTotal: money(input.shippingTotal),
      grandTotal: totals.grandTotal,
      notes: input.notes ?? null,
      createdBy: input.createdBy,
    })
    .returning();
  if (!header) throw ApiError.internal('Gagal membuat purchase order');

  for (const item of input.items) {
    const lineQuantity = toNumber(item.quantity);
    const linePrice = toNumber(item.unitPrice);
    await tx.insert(purchaseOrderItems).values({
      purchaseOrderId: header.id,
      requisitionItemId: item.requisitionItemId ?? null,
      inventoryItemId: item.inventoryItemId ?? null,
      productId: item.productId ?? null,
      skuId: item.skuId ?? null,
      description: item.description,
      quantity: quantity(lineQuantity),
      unitPrice: money(linePrice),
      lineTotal: money(lineQuantity * linePrice),
      notes: item.notes ?? null,
    });
  }
  return header;
}

export const supplyChainPurchaseOrderRoutes = new Hono<AppEnv>();

supplyChainPurchaseOrderRoutes.get(
  '/purchase-orders',
  requirePermission('supply_chain:read'),
  validate('query', listOrderSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = supplyChainScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(purchaseOrders.merchantId, query.merchantId));
    if (query.supplierId) conditions.push(eq(purchaseOrders.supplierId, query.supplierId));
    if (query.status) conditions.push(eq(purchaseOrders.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(purchaseOrders.orderNumber, term),
          ilike(suppliers.name, term),
          ilike(purchaseOrders.notes, term),
          ilike(merchants.businessName, term),
        ) as SQL,
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: purchaseOrders.id,
          orderNumber: purchaseOrders.orderNumber,
          merchantId: purchaseOrders.merchantId,
          merchantName: merchants.businessName,
          supplierId: purchaseOrders.supplierId,
          supplierName: suppliers.name,
          status: purchaseOrders.status,
          currency: purchaseOrders.currency,
          grandTotal: purchaseOrders.grandTotal,
          expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
          orderedAt: purchaseOrders.orderedAt,
          createdAt: purchaseOrders.createdAt,
        })
        .from(purchaseOrders)
        .innerJoin(merchants, eq(merchants.id, purchaseOrders.merchantId))
        .innerJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
        .where(where)
        .orderBy(desc(purchaseOrders.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(purchaseOrders)
        .innerJoin(merchants, eq(merchants.id, purchaseOrders.merchantId))
        .innerJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

supplyChainPurchaseOrderRoutes.post(
  '/purchase-orders',
  requirePermission('supply_chain:write'),
  validate('json', createOrderSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertSupplyChainAccess(body.merchantId, user, permissions, { manage: true });

    const { supplier } = await getSupplier(body.supplierId, user, permissions);
    if (supplier.merchantId !== body.merchantId) {
      throw ApiError.badRequest('Supplier tidak sesuai dengan merchant');
    }
    if (body.warehouseId) {
      const { warehouse } = await getWarehouse(body.warehouseId, user, permissions);
      if (warehouse.merchantId !== body.merchantId) {
        throw ApiError.badRequest('Gudang tidak sesuai dengan merchant');
      }
    }

    let requisitionId = body.requisitionId ?? null;
    let quotationId = body.quotationId ?? null;
    const resolvedItems: Array<{
      requisitionItemId?: string | null;
      inventoryItemId?: string | null;
      productId?: string | null;
      skuId?: string | null;
      description: string;
      quantity: string;
      unitPrice: string;
      notes?: string | null;
    }> = [];

    if (body.items) {
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
          resolvedItems.push({
            ...item,
            inventoryItemId: inventoryItem.id,
            quantity: quantity(toNumber(item.quantity)),
            unitPrice: money(toNumber(item.unitPrice)),
          });
        } else {
          resolvedItems.push({
            ...item,
            quantity: quantity(toNumber(item.quantity)),
            unitPrice: money(toNumber(item.unitPrice)),
          });
        }
      }
    } else if (quotationId) {
      const { quotation } = await getQuotation(quotationId, user, permissions);
      if (quotation.merchantId !== body.merchantId) {
        throw ApiError.badRequest('Penawaran tidak sesuai dengan merchant');
      }
      if (quotation.supplierId !== body.supplierId) {
        throw ApiError.badRequest('Supplier penawaran tidak sesuai');
      }
      const rows = await db
        .select()
        .from(supplierQuotationItems)
        .where(eq(supplierQuotationItems.quotationId, quotation.id))
        .orderBy(asc(supplierQuotationItems.createdAt));
      for (const row of rows) {
        resolvedItems.push({
          requisitionItemId: row.requisitionItemId,
          inventoryItemId: row.inventoryItemId,
          productId: row.productId,
          skuId: row.skuId,
          description: row.description,
          quantity: row.quantity,
          unitPrice: row.unitPrice,
          notes: row.notes,
        });
      }
    } else if (requisitionId) {
      const { requisition } = await getRequisition(requisitionId, user, permissions);
      if (requisition.merchantId !== body.merchantId) {
        throw ApiError.badRequest('Permintaan pembelian tidak sesuai dengan merchant');
      }
      if (requisition.status !== 'approved') {
        throw ApiError.badRequest('Permintaan pembelian harus disetujui terlebih dahulu');
      }
      const rows = await db
        .select()
        .from(purchaseRequisitionItems)
        .where(eq(purchaseRequisitionItems.requisitionId, requisition.id))
        .orderBy(asc(purchaseRequisitionItems.createdAt));
      for (const row of rows) {
        resolvedItems.push({
          requisitionItemId: row.id,
          inventoryItemId: row.inventoryItemId,
          productId: row.productId,
          skuId: row.skuId,
          description: row.description,
          quantity: row.quantity,
          unitPrice: row.estimatedUnitPrice,
          notes: row.notes,
        });
      }
    }

    if (resolvedItems.length === 0) {
      throw ApiError.badRequest('Item purchase order wajib diisi');
    }

    const created = await db.transaction(async (tx) => {
      const header = await insertOrder(tx, {
        merchantId: body.merchantId,
        supplierId: body.supplierId,
        warehouseId: body.warehouseId ?? null,
        requisitionId,
        quotationId,
        expectedDeliveryDate: body.expectedDeliveryDate ?? null,
        paymentTermDays: body.paymentTermDays,
        discountTotal: toNumber(body.discountTotal),
        taxTotal: toNumber(body.taxTotal),
        shippingTotal: toNumber(body.shippingTotal),
        notes: body.notes ?? null,
        createdBy: user.id,
        items: resolvedItems,
      });
      if (quotationId) {
        await tx
          .update(supplierQuotations)
          .set({ status: 'accepted', acceptedAt: new Date() })
          .where(eq(supplierQuotations.id, quotationId));
      }
      if (requisitionId) {
        await tx
          .update(purchaseRequisitions)
          .set({ status: 'converted' })
          .where(eq(purchaseRequisitions.id, requisitionId));
      }
      return header;
    });

    await writeAuditLog({
      actorUserId: user.id,
      action: 'supply_chain.purchase_order.create',
      entityType: 'purchase_order',
      entityId: created.id,
      newValues: { number: created.orderNumber, grandTotal: created.grandTotal },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, await loadOrderDetail(created.id), 201);
  },
);

supplyChainPurchaseOrderRoutes.get(
  '/purchase-orders/:id',
  requirePermission('supply_chain:read'),
  async (c) => {
    const { purchaseOrder } = await getPurchaseOrder(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    return ok(c, await loadOrderDetail(purchaseOrder.id));
  },
);

supplyChainPurchaseOrderRoutes.patch(
  '/purchase-orders/:id',
  requirePermission('supply_chain:write'),
  validate('json', updateOrderSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { purchaseOrder } = await getPurchaseOrder(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (purchaseOrder.status !== 'draft') {
      throw ApiError.badRequest('Hanya purchase order draft yang dapat diubah');
    }
    if (body.supplierId) {
      const { supplier } = await getSupplier(body.supplierId, user, permissions);
      if (supplier.merchantId !== purchaseOrder.merchantId) {
        throw ApiError.badRequest('Supplier tidak sesuai dengan merchant');
      }
    }
    if (body.warehouseId) {
      const { warehouse } = await getWarehouse(body.warehouseId, user, permissions);
      if (warehouse.merchantId !== purchaseOrder.merchantId) {
        throw ApiError.badRequest('Gudang tidak sesuai dengan merchant');
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(purchaseOrders)
        .set({
          supplierId: body.supplierId,
          warehouseId: body.warehouseId,
          expectedDeliveryDate: body.expectedDeliveryDate,
          paymentTermDays: body.paymentTermDays,
          discountTotal:
            body.discountTotal === undefined
              ? undefined
              : money(toNumber(body.discountTotal)),
          taxTotal: body.taxTotal === undefined ? undefined : money(toNumber(body.taxTotal)),
          shippingTotal:
            body.shippingTotal === undefined
              ? undefined
              : money(toNumber(body.shippingTotal)),
          notes: body.notes,
        })
        .where(eq(purchaseOrders.id, purchaseOrder.id));

      if (body.items) {
        const rows = await tx
          .select()
          .from(purchaseOrderItems)
          .where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrder.id));
        if (rows.some((row) => toNumber(row.receivedQuantity) > 0)) {
          throw ApiError.badRequest('Item yang sudah diterima tidak dapat diubah');
        }
        await tx
          .delete(purchaseOrderItems)
          .where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrder.id));
        for (const item of body.items) {
          const lineQuantity = toNumber(item.quantity);
          const linePrice = toNumber(item.unitPrice);
          await tx.insert(purchaseOrderItems).values({
            purchaseOrderId: purchaseOrder.id,
            requisitionItemId: item.requisitionItemId ?? null,
            inventoryItemId: item.inventoryItemId ?? null,
            productId: item.productId ?? null,
            skuId: item.skuId ?? null,
            description: item.description,
            quantity: quantity(lineQuantity),
            unitPrice: money(linePrice),
            lineTotal: money(lineQuantity * linePrice),
            notes: item.notes ?? null,
          });
        }
      }

      const [refresh] = await tx
        .select()
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, purchaseOrder.id))
        .limit(1);
      const items = await tx
        .select()
        .from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrder.id));
      const totals = sumLines(
        items.map((item) => ({ quantity: item.quantity, unitPrice: item.unitPrice })),
        toNumber(refresh?.discountTotal),
        toNumber(refresh?.taxTotal),
        toNumber(refresh?.shippingTotal),
      );
      await tx
        .update(purchaseOrders)
        .set({ subtotal: totals.subtotal, grandTotal: totals.grandTotal })
        .where(eq(purchaseOrders.id, purchaseOrder.id));
    });

    return ok(c, await loadOrderDetail(purchaseOrder.id));
  },
);

supplyChainPurchaseOrderRoutes.post(
  '/purchase-orders/:id/submit',
  requirePermission('supply_chain:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { purchaseOrder } = await getPurchaseOrder(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (purchaseOrder.status !== 'draft') {
      throw ApiError.badRequest('Hanya purchase order draft yang dapat diajukan');
    }
    await db.transaction(async (tx) => {
      await tx
        .update(purchaseOrders)
        .set({ status: 'pending_approval' })
        .where(eq(purchaseOrders.id, purchaseOrder.id));
      await createApproval(tx, {
        merchantId: purchaseOrder.merchantId,
        entityType: 'purchase_order',
        entityId: purchaseOrder.id,
        requestedBy: user.id,
      });
    });
    return ok(c, await loadOrderDetail(purchaseOrder.id));
  },
);

supplyChainPurchaseOrderRoutes.post(
  '/purchase-orders/:id/approve',
  requirePermission('supply_chain:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { purchaseOrder } = await getPurchaseOrder(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (purchaseOrder.status !== 'pending_approval') {
      throw ApiError.badRequest('Purchase order tidak menunggu persetujuan');
    }
    await db.transaction(async (tx) => {
      await tx
        .update(purchaseOrders)
        .set({ status: 'approved', approvedAt: new Date(), approvedBy: user.id })
        .where(eq(purchaseOrders.id, purchaseOrder.id));
      await tx
        .update(procurementApprovals)
        .set({ status: 'approved', decidedBy: user.id, decidedAt: new Date() })
        .where(
          and(
            eq(procurementApprovals.entityType, 'purchase_order'),
            eq(procurementApprovals.entityId, purchaseOrder.id),
          ),
        );
    });
    return ok(c, await loadOrderDetail(purchaseOrder.id));
  },
);

supplyChainPurchaseOrderRoutes.post(
  '/purchase-orders/:id/send',
  requirePermission('supply_chain:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { purchaseOrder } = await getPurchaseOrder(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (purchaseOrder.status !== 'approved') {
      throw ApiError.badRequest('Purchase order harus disetujui sebelum dikirim');
    }
    await db
      .update(purchaseOrders)
      .set({ status: 'ordered', orderedAt: new Date() })
      .where(eq(purchaseOrders.id, purchaseOrder.id));
    return ok(c, await loadOrderDetail(purchaseOrder.id));
  },
);

supplyChainPurchaseOrderRoutes.post(
  '/purchase-orders/:id/cancel',
  requirePermission('supply_chain:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { purchaseOrder } = await getPurchaseOrder(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (['received', 'cancelled', 'closed'].includes(purchaseOrder.status)) {
      throw ApiError.badRequest('Purchase order tidak dapat dibatalkan');
    }
    await db
      .update(purchaseOrders)
      .set({ status: 'cancelled', cancelledAt: new Date() })
      .where(eq(purchaseOrders.id, purchaseOrder.id));
    return ok(c, await loadOrderDetail(purchaseOrder.id));
  },
);

supplyChainPurchaseOrderRoutes.post(
  '/purchase-orders/:id/close',
  requirePermission('supply_chain:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { purchaseOrder } = await getPurchaseOrder(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (!['ordered', 'partially_received', 'received'].includes(purchaseOrder.status)) {
      throw ApiError.badRequest('Purchase order belum dapat ditutup');
    }
    await db
      .update(purchaseOrders)
      .set({ status: 'closed' })
      .where(eq(purchaseOrders.id, purchaseOrder.id));
    return ok(c, await loadOrderDetail(purchaseOrder.id));
  },
);

supplyChainPurchaseOrderRoutes.post(
  '/purchase-requisitions/:id/convert',
  requirePermission('supply_chain:write'),
  validate('json', convertRequisitionSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { requisition } = await getRequisition(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (requisition.status !== 'approved') {
      throw ApiError.badRequest('Permintaan pembelian harus disetujui terlebih dahulu');
    }
    const { supplier } = await getSupplier(body.supplierId, user, permissions);
    if (supplier.merchantId !== requisition.merchantId) {
      throw ApiError.badRequest('Supplier tidak sesuai dengan merchant');
    }
    if (body.warehouseId) {
      const { warehouse } = await getWarehouse(body.warehouseId, user, permissions);
      if (warehouse.merchantId !== requisition.merchantId) {
        throw ApiError.badRequest('Gudang tidak sesuai dengan merchant');
      }
    }

    const items = await db
      .select()
      .from(purchaseRequisitionItems)
      .where(eq(purchaseRequisitionItems.requisitionId, requisition.id))
      .orderBy(asc(purchaseRequisitionItems.createdAt));

    const created = await db.transaction(async (tx) => {
      const header = await insertOrder(tx, {
        merchantId: requisition.merchantId,
        supplierId: body.supplierId,
        warehouseId: body.warehouseId ?? requisition.warehouseId,
        requisitionId: requisition.id,
        expectedDeliveryDate: body.expectedDeliveryDate ?? null,
        paymentTermDays: body.paymentTermDays,
        discountTotal: 0,
        taxTotal: 0,
        shippingTotal: 0,
        notes: body.notes ?? null,
        createdBy: user.id,
        items: items.map((item) => ({
          requisitionItemId: item.id,
          inventoryItemId: item.inventoryItemId,
          productId: item.productId,
          skuId: item.skuId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.estimatedUnitPrice,
          notes: item.notes,
        })),
      });
      await tx
        .update(purchaseRequisitions)
        .set({ status: 'converted' })
        .where(eq(purchaseRequisitions.id, requisition.id));
      return header;
    });
    return ok(c, await loadOrderDetail(created.id), 201);
  },
);

supplyChainPurchaseOrderRoutes.post(
  '/supplier-quotations/:id/convert',
  requirePermission('supply_chain:write'),
  validate('json', convertQuotationSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { quotation } = await getQuotation(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (!['requested', 'submitted', 'accepted'].includes(quotation.status)) {
      throw ApiError.badRequest('Penawaran tidak dapat dikonversi menjadi purchase order');
    }
    if (body.warehouseId) {
      const { warehouse } = await getWarehouse(body.warehouseId, user, permissions);
      if (warehouse.merchantId !== quotation.merchantId) {
        throw ApiError.badRequest('Gudang tidak sesuai dengan merchant');
      }
    }
    const items = await db
      .select()
      .from(supplierQuotationItems)
      .where(eq(supplierQuotationItems.quotationId, quotation.id))
      .orderBy(asc(supplierQuotationItems.createdAt));

    const created = await db.transaction(async (tx) => {
      const header = await insertOrder(tx, {
        merchantId: quotation.merchantId,
        supplierId: quotation.supplierId,
        warehouseId: body.warehouseId ?? null,
        requisitionId: quotation.requisitionId,
        quotationId: quotation.id,
        expectedDeliveryDate: body.expectedDeliveryDate ?? null,
        paymentTermDays: quotation.paymentTermDays,
        discountTotal: toNumber(quotation.discountTotal),
        taxTotal: toNumber(quotation.taxTotal),
        shippingTotal: toNumber(quotation.shippingTotal),
        notes: body.notes ?? quotation.notes,
        createdBy: user.id,
        items: items.map((item) => ({
          requisitionItemId: item.requisitionItemId,
          inventoryItemId: item.inventoryItemId,
          productId: item.productId,
          skuId: item.skuId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          notes: item.notes,
        })),
      });
      await tx
        .update(supplierQuotations)
        .set({ status: 'accepted', acceptedAt: new Date() })
        .where(eq(supplierQuotations.id, quotation.id));
      if (quotation.requisitionId) {
        await tx
          .update(purchaseRequisitions)
          .set({ status: 'converted' })
          .where(eq(purchaseRequisitions.id, quotation.requisitionId));
      }
      return header;
    });
    return ok(c, await loadOrderDetail(created.id), 201);
  },
);

/** Daftar approval procurement untuk halaman approval admin. */
supplyChainPurchaseOrderRoutes.get(
  '/procurement-approvals',
  requirePermission('supply_chain:read'),
  validate(
    'query',
    z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(50),
      status: z.enum(['pending', 'approved', 'rejected']).optional(),
      entityType: z.string().trim().max(64).optional(),
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
    if (query.status) conditions.push(eq(procurementApprovals.status, query.status));
    if (query.entityType) {
      conditions.push(eq(procurementApprovals.entityType, query.entityType));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: procurementApprovals.id,
          merchantId: procurementApprovals.merchantId,
          merchantName: merchants.businessName,
          entityType: procurementApprovals.entityType,
          entityId: procurementApprovals.entityId,
          step: procurementApprovals.step,
          status: procurementApprovals.status,
          notes: procurementApprovals.notes,
          requestedBy: procurementApprovals.requestedBy,
          decidedBy: procurementApprovals.decidedBy,
          decidedAt: procurementApprovals.decidedAt,
          createdAt: procurementApprovals.createdAt,
        })
        .from(procurementApprovals)
        .innerJoin(merchants, eq(merchants.id, procurementApprovals.merchantId))
        .where(where)
        .orderBy(desc(procurementApprovals.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(procurementApprovals)
        .innerJoin(merchants, eq(merchants.id, procurementApprovals.merchantId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);
