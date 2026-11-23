import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  ne,
  or,

  type SQL,
} from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  inventoryItems,
  merchants,
  procurementApprovals,
  products,
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

const prioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);
const requisitionStatusSchema = z.enum([
  'draft',
  'submitted',
  'approved',
  'rejected',
  'converted',
  'cancelled',
]);
const quotationStatusSchema = z.enum([
  'requested',
  'submitted',
  'accepted',
  'rejected',
  'expired',
  'cancelled',
]);

const requisitionItemSchema = z.object({
  inventoryItemId: z.uuid().optional(),
  productId: z.uuid().optional(),
  skuId: z.uuid().optional(),
  description: z.string().trim().min(2).max(500),
  quantity: numericSchema,
  estimatedUnitPrice: optionalNumericSchema.default('0'),
  notes: z.string().trim().max(1000).optional(),
});

const createRequisitionSchema = z.object({
  merchantId: z.uuid(),
  warehouseId: z.uuid().optional(),
  title: z.string().trim().min(3).max(255),
  priority: prioritySchema.default('normal'),
  neededBy: dateOnlySchema.optional(),
  notes: z.string().trim().max(2000).optional(),
  items: z.array(requisitionItemSchema).min(1).max(100),
});

const updateRequisitionSchema = z.object({
  warehouseId: z.uuid().nullable().optional(),
  title: z.string().trim().min(3).max(255).optional(),
  priority: prioritySchema.optional(),
  neededBy: dateOnlySchema.nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  items: z.array(requisitionItemSchema).min(1).max(100).optional(),
});

const listRequisitionSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  status: requisitionStatusSchema.optional(),
  priority: prioritySchema.optional(),
});

const quotationItemSchema = z.object({
  requisitionItemId: z.uuid().optional(),
  inventoryItemId: z.uuid().optional(),
  productId: z.uuid().optional(),
  skuId: z.uuid().optional(),
  description: z.string().trim().min(2).max(500),
  quantity: numericSchema,
  unitPrice: optionalNumericSchema.default('0'),
  notes: z.string().trim().max(1000).optional(),
});

const createQuotationSchema = z.object({
  merchantId: z.uuid(),
  supplierId: z.uuid(),
  requisitionId: z.uuid().optional(),
  validUntil: dateOnlySchema.optional(),
  paymentTermDays: z.coerce.number().int().min(0).max(3650).default(0),
  deliveryDays: z.coerce.number().int().min(0).max(3650).optional(),
  discountTotal: optionalNumericSchema.default('0'),
  taxTotal: optionalNumericSchema.default('0'),
  shippingTotal: optionalNumericSchema.default('0'),
  notes: z.string().trim().max(2000).optional(),
  items: z.array(quotationItemSchema).min(1).max(100),
});

const listQuotationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  supplierId: z.uuid().optional(),
  requisitionId: z.uuid().optional(),
  status: quotationStatusSchema.optional(),
});

async function loadRequisitionDetail(id: string) {
  const [header] = await db
    .select({
      id: purchaseRequisitions.id,
      merchantId: purchaseRequisitions.merchantId,
      merchantName: merchants.businessName,
      requisitionNumber: purchaseRequisitions.requisitionNumber,
      warehouseId: purchaseRequisitions.warehouseId,
      title: purchaseRequisitions.title,
      status: purchaseRequisitions.status,
      priority: purchaseRequisitions.priority,
      neededBy: purchaseRequisitions.neededBy,
      notes: purchaseRequisitions.notes,
      requestedBy: purchaseRequisitions.requestedBy,
      requesterName: users.fullName,
      submittedAt: purchaseRequisitions.submittedAt,
      approvedAt: purchaseRequisitions.approvedAt,
      rejectedAt: purchaseRequisitions.rejectedAt,
      createdAt: purchaseRequisitions.createdAt,
      updatedAt: purchaseRequisitions.updatedAt,
    })
    .from(purchaseRequisitions)
    .innerJoin(merchants, eq(merchants.id, purchaseRequisitions.merchantId))
    .leftJoin(users, eq(users.id, purchaseRequisitions.requestedBy))
    .where(eq(purchaseRequisitions.id, id))
    .limit(1);
  if (!header) throw ApiError.notFound('Permintaan pembelian tidak ditemukan');

  const items = await db
    .select({
      id: purchaseRequisitionItems.id,
      inventoryItemId: purchaseRequisitionItems.inventoryItemId,
      inventoryItemName: products.name,
      productId: purchaseRequisitionItems.productId,
      skuId: purchaseRequisitionItems.skuId,
      description: purchaseRequisitionItems.description,
      quantity: purchaseRequisitionItems.quantity,
      estimatedUnitPrice: purchaseRequisitionItems.estimatedUnitPrice,
      notes: purchaseRequisitionItems.notes,
    })
    .from(purchaseRequisitionItems)
    .leftJoin(inventoryItems, eq(inventoryItems.id, purchaseRequisitionItems.inventoryItemId))
    .leftJoin(products, eq(products.id, inventoryItems.productId))
    .where(eq(purchaseRequisitionItems.requisitionId, id))
    .orderBy(asc(purchaseRequisitionItems.createdAt));

  return { ...header, items };
}

async function loadQuotationDetail(id: string) {
  const [header] = await db
    .select({
      id: supplierQuotations.id,
      merchantId: supplierQuotations.merchantId,
      merchantName: merchants.businessName,
      quotationNumber: supplierQuotations.quotationNumber,
      requisitionId: supplierQuotations.requisitionId,
      supplierId: supplierQuotations.supplierId,
      supplierName: suppliers.name,
      supplierCode: suppliers.code,
      status: supplierQuotations.status,
      currency: supplierQuotations.currency,
      subtotal: supplierQuotations.subtotal,
      discountTotal: supplierQuotations.discountTotal,
      taxTotal: supplierQuotations.taxTotal,
      shippingTotal: supplierQuotations.shippingTotal,
      grandTotal: supplierQuotations.grandTotal,
      validUntil: supplierQuotations.validUntil,
      paymentTermDays: supplierQuotations.paymentTermDays,
      deliveryDays: supplierQuotations.deliveryDays,
      notes: supplierQuotations.notes,
      requestedAt: supplierQuotations.requestedAt,
      submittedAt: supplierQuotations.submittedAt,
      acceptedAt: supplierQuotations.acceptedAt,
      createdAt: supplierQuotations.createdAt,
      updatedAt: supplierQuotations.updatedAt,
    })
    .from(supplierQuotations)
    .innerJoin(merchants, eq(merchants.id, supplierQuotations.merchantId))
    .innerJoin(suppliers, eq(suppliers.id, supplierQuotations.supplierId))
    .where(eq(supplierQuotations.id, id))
    .limit(1);
  if (!header) throw ApiError.notFound('Penawaran supplier tidak ditemukan');

  const items = await db
    .select({
      id: supplierQuotationItems.id,
      requisitionItemId: supplierQuotationItems.requisitionItemId,
      inventoryItemId: supplierQuotationItems.inventoryItemId,
      inventoryItemName: products.name,
      productId: supplierQuotationItems.productId,
      skuId: supplierQuotationItems.skuId,
      description: supplierQuotationItems.description,
      quantity: supplierQuotationItems.quantity,
      unitPrice: supplierQuotationItems.unitPrice,
      lineTotal: supplierQuotationItems.lineTotal,
      notes: supplierQuotationItems.notes,
    })
    .from(supplierQuotationItems)
    .leftJoin(inventoryItems, eq(inventoryItems.id, supplierQuotationItems.inventoryItemId))
    .leftJoin(products, eq(products.id, inventoryItems.productId))
    .where(eq(supplierQuotationItems.quotationId, id))
    .orderBy(asc(supplierQuotationItems.createdAt));

  return { ...header, items };
}

export const supplyChainProcurementRoutes = new Hono<AppEnv>();

/* --------------------------- Purchase requisition ------------------------- */

supplyChainProcurementRoutes.get(
  '/purchase-requisitions',
  requirePermission('supply_chain:read'),
  validate('query', listRequisitionSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = supplyChainScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(purchaseRequisitions.merchantId, query.merchantId));
    if (query.status) conditions.push(eq(purchaseRequisitions.status, query.status));
    if (query.priority) conditions.push(eq(purchaseRequisitions.priority, query.priority));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(purchaseRequisitions.requisitionNumber, term),
          ilike(purchaseRequisitions.title, term),
          ilike(merchants.businessName, term),
          ilike(users.fullName, term),
        ) as SQL,
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: purchaseRequisitions.id,
          requisitionNumber: purchaseRequisitions.requisitionNumber,
          merchantId: purchaseRequisitions.merchantId,
          merchantName: merchants.businessName,
          title: purchaseRequisitions.title,
          status: purchaseRequisitions.status,
          priority: purchaseRequisitions.priority,
          neededBy: purchaseRequisitions.neededBy,
          requesterName: users.fullName,
          submittedAt: purchaseRequisitions.submittedAt,
          approvedAt: purchaseRequisitions.approvedAt,
          createdAt: purchaseRequisitions.createdAt,
        })
        .from(purchaseRequisitions)
        .innerJoin(merchants, eq(merchants.id, purchaseRequisitions.merchantId))
        .leftJoin(users, eq(users.id, purchaseRequisitions.requestedBy))
        .where(where)
        .orderBy(desc(purchaseRequisitions.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(purchaseRequisitions)
        .innerJoin(merchants, eq(merchants.id, purchaseRequisitions.merchantId))
        .leftJoin(users, eq(users.id, purchaseRequisitions.requestedBy))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

supplyChainProcurementRoutes.post(
  '/purchase-requisitions',
  requirePermission('supply_chain:write'),
  validate('json', createRequisitionSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertSupplyChainAccess(body.merchantId, user, permissions, { manage: true });

    const created = await db.transaction(async (tx) => {
      if (body.warehouseId) {
        const [warehouse] = await tx
          .select({ merchantId: merchants.id })
          .from(merchants)
          .where(eq(merchants.id, body.merchantId))
          .limit(1);
        if (!warehouse) throw ApiError.notFound('Merchant tidak ditemukan');
        const { warehouse: wh } = await getWarehouse(
          body.warehouseId,
          user,
          permissions,
        );
        if (wh.merchantId !== body.merchantId) {
          throw ApiError.badRequest('Gudang tidak sesuai dengan merchant');
        }
      }

      const [header] = await tx
        .insert(purchaseRequisitions)
        .values({
          requisitionNumber: generateCode('PR'),
          merchantId: body.merchantId,
          warehouseId: body.warehouseId ?? null,
          requestedBy: user.id,
          title: body.title,
          priority: body.priority,
          neededBy: body.neededBy ?? null,
          notes: body.notes ?? null,
        })
        .returning();
      if (!header) throw ApiError.internal('Gagal membuat permintaan pembelian');

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
        await tx.insert(purchaseRequisitionItems).values({
          requisitionId: header.id,
          inventoryItemId: item.inventoryItemId ?? null,
          productId: item.productId ?? null,
          skuId: item.skuId ?? null,
          description: item.description,
          quantity: quantity(toNumber(item.quantity)),
          estimatedUnitPrice: money(toNumber(item.estimatedUnitPrice)),
          notes: item.notes ?? null,
        });
      }
      return header;
    });

    await writeAuditLog({
      actorUserId: user.id,
      action: 'supply_chain.requisition.create',
      entityType: 'purchase_requisition',
      entityId: created.id,
      newValues: { number: created.requisitionNumber, title: created.title },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, await loadRequisitionDetail(created.id), 201);
  },
);

supplyChainProcurementRoutes.get(
  '/purchase-requisitions/:id',
  requirePermission('supply_chain:read'),
  async (c) => {
    const { requisition } = await getRequisition(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    return ok(c, await loadRequisitionDetail(requisition.id));
  },
);

supplyChainProcurementRoutes.patch(
  '/purchase-requisitions/:id',
  requirePermission('supply_chain:write'),
  validate('json', updateRequisitionSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { requisition } = await getRequisition(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (requisition.status !== 'draft') {
      throw ApiError.badRequest('Hanya permintaan berstatus draft yang dapat diubah');
    }
    if (body.warehouseId) {
      const { warehouse } = await getWarehouse(body.warehouseId, user, permissions);
      if (warehouse.merchantId !== requisition.merchantId) {
        throw ApiError.badRequest('Gudang tidak sesuai dengan merchant');
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(purchaseRequisitions)
        .set({
          warehouseId: body.warehouseId,
          title: body.title,
          priority: body.priority,
          neededBy: body.neededBy,
          notes: body.notes,
        })
        .where(eq(purchaseRequisitions.id, requisition.id));
      if (body.items) {
        await tx
          .delete(purchaseRequisitionItems)
          .where(eq(purchaseRequisitionItems.requisitionId, requisition.id));
        for (const item of body.items) {
          await tx.insert(purchaseRequisitionItems).values({
            requisitionId: requisition.id,
            inventoryItemId: item.inventoryItemId ?? null,
            productId: item.productId ?? null,
            skuId: item.skuId ?? null,
            description: item.description,
            quantity: quantity(toNumber(item.quantity)),
            estimatedUnitPrice: money(toNumber(item.estimatedUnitPrice)),
            notes: item.notes ?? null,
          });
        }
      }
    });

    await writeAuditLog({
      actorUserId: user.id,
      action: 'supply_chain.requisition.update',
      entityType: 'purchase_requisition',
      entityId: requisition.id,
      oldValues: { status: requisition.status, title: requisition.title },
      newValues: { title: body.title },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, await loadRequisitionDetail(requisition.id));
  },
);

supplyChainProcurementRoutes.post(
  '/purchase-requisitions/:id/submit',
  requirePermission('supply_chain:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { requisition } = await getRequisition(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (requisition.status !== 'draft') {
      throw ApiError.badRequest('Hanya permintaan draft yang dapat diajukan');
    }
    await db.transaction(async (tx) => {
      await tx
        .update(purchaseRequisitions)
        .set({ status: 'submitted', submittedAt: new Date() })
        .where(eq(purchaseRequisitions.id, requisition.id));
      await createApproval(tx, {
        merchantId: requisition.merchantId,
        entityType: 'purchase_requisition',
        entityId: requisition.id,
        requestedBy: user.id,
      });
    });
    return ok(c, await loadRequisitionDetail(requisition.id));
  },
);

supplyChainProcurementRoutes.post(
  '/purchase-requisitions/:id/approve',
  requirePermission('supply_chain:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { requisition } = await getRequisition(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (requisition.status !== 'submitted') {
      throw ApiError.badRequest('Hanya permintaan yang diajukan dapat disetujui');
    }
    await db.transaction(async (tx) => {
      await tx
        .update(purchaseRequisitions)
        .set({ status: 'approved', approvedAt: new Date() })
        .where(eq(purchaseRequisitions.id, requisition.id));
      await tx
        .update(procurementApprovals)
        .set({ status: 'approved', decidedBy: user.id, decidedAt: new Date() })
        .where(
          and(
            eq(procurementApprovals.entityType, 'purchase_requisition'),
            eq(procurementApprovals.entityId, requisition.id),
          ),
        );
    });
    return ok(c, await loadRequisitionDetail(requisition.id));
  },
);

supplyChainProcurementRoutes.post(
  '/purchase-requisitions/:id/reject',
  requirePermission('supply_chain:manage'),
  validate(
    'json',
    z.object({ notes: z.string().trim().max(2000).optional() }),
  ),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { requisition } = await getRequisition(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (!['submitted', 'draft'].includes(requisition.status)) {
      throw ApiError.badRequest('Permintaan tidak dapat ditolak pada status ini');
    }
    await db.transaction(async (tx) => {
      await tx
        .update(purchaseRequisitions)
        .set({ status: 'rejected', rejectedAt: new Date() })
        .where(eq(purchaseRequisitions.id, requisition.id));
      await tx
        .update(procurementApprovals)
        .set({
          status: 'rejected',
          decidedBy: user.id,
          decidedAt: new Date(),
          notes: body.notes ?? null,
        })
        .where(
          and(
            eq(procurementApprovals.entityType, 'purchase_requisition'),
            eq(procurementApprovals.entityId, requisition.id),
          ),
        );
    });
    return ok(c, await loadRequisitionDetail(requisition.id));
  },
);

supplyChainProcurementRoutes.post(
  '/purchase-requisitions/:id/cancel',
  requirePermission('supply_chain:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { requisition } = await getRequisition(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (['converted', 'cancelled'].includes(requisition.status)) {
      throw ApiError.badRequest('Permintaan tidak dapat dibatalkan');
    }
    await db
      .update(purchaseRequisitions)
      .set({ status: 'cancelled', cancelledAt: new Date() })
      .where(eq(purchaseRequisitions.id, requisition.id));
    return ok(c, await loadRequisitionDetail(requisition.id));
  },
);

/* ---------------------------- Supplier quotation ------------------------- */

supplyChainProcurementRoutes.get(
  '/supplier-quotations',
  requirePermission('supply_chain:read'),
  validate('query', listQuotationSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = supplyChainScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(supplierQuotations.merchantId, query.merchantId));
    if (query.supplierId) conditions.push(eq(supplierQuotations.supplierId, query.supplierId));
    if (query.requisitionId) {
      conditions.push(eq(supplierQuotations.requisitionId, query.requisitionId));
    }
    if (query.status) conditions.push(eq(supplierQuotations.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(supplierQuotations.quotationNumber, term),
          ilike(suppliers.name, term),
          ilike(merchants.businessName, term),
        ) as SQL,
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: supplierQuotations.id,
          quotationNumber: supplierQuotations.quotationNumber,
          merchantId: supplierQuotations.merchantId,
          merchantName: merchants.businessName,
          requisitionId: supplierQuotations.requisitionId,
          supplierId: supplierQuotations.supplierId,
          supplierName: suppliers.name,
          status: supplierQuotations.status,
          currency: supplierQuotations.currency,
          grandTotal: supplierQuotations.grandTotal,
          validUntil: supplierQuotations.validUntil,
          submittedAt: supplierQuotations.submittedAt,
          createdAt: supplierQuotations.createdAt,
        })
        .from(supplierQuotations)
        .innerJoin(merchants, eq(merchants.id, supplierQuotations.merchantId))
        .innerJoin(suppliers, eq(suppliers.id, supplierQuotations.supplierId))
        .where(where)
        .orderBy(desc(supplierQuotations.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(supplierQuotations)
        .innerJoin(merchants, eq(merchants.id, supplierQuotations.merchantId))
        .innerJoin(suppliers, eq(suppliers.id, supplierQuotations.supplierId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

supplyChainProcurementRoutes.post(
  '/supplier-quotations',
  requirePermission('supply_chain:write'),
  validate('json', createQuotationSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertSupplyChainAccess(body.merchantId, user, permissions, { manage: true });
    const { supplier } = await getSupplier(body.supplierId, user, permissions);
    if (supplier.merchantId !== body.merchantId) {
      throw ApiError.badRequest('Supplier tidak sesuai dengan merchant');
    }
    if (body.requisitionId) {
      const { requisition } = await getRequisition(body.requisitionId, user, permissions);
      if (requisition.merchantId !== body.merchantId) {
        throw ApiError.badRequest('Permintaan pembelian tidak sesuai dengan merchant');
      }
    }

    const lines = body.items.map((item) => ({
      quantity: quantity(toNumber(item.quantity)),
      unitPrice: money(toNumber(item.unitPrice)),
    }));
    const totals = sumLines(
      lines,
      toNumber(body.discountTotal),
      toNumber(body.taxTotal),
      toNumber(body.shippingTotal),
    );

    const created = await db.transaction(async (tx) => {
      const [header] = await tx
        .insert(supplierQuotations)
        .values({
          quotationNumber: generateCode('RFQ'),
          requisitionId: body.requisitionId ?? null,
          merchantId: body.merchantId,
          supplierId: body.supplierId,
          status: 'requested',
          subtotal: totals.subtotal,
          discountTotal: money(toNumber(body.discountTotal)),
          taxTotal: money(toNumber(body.taxTotal)),
          shippingTotal: money(toNumber(body.shippingTotal)),
          grandTotal: totals.grandTotal,
          validUntil: body.validUntil ?? null,
          paymentTermDays: body.paymentTermDays,
          deliveryDays: body.deliveryDays ?? null,
          notes: body.notes ?? null,
        })
        .returning();
      if (!header) throw ApiError.internal('Gagal membuat penawaran supplier');

      for (const item of body.items) {
        const lineQuantity = toNumber(item.quantity);
        const linePrice = toNumber(item.unitPrice);
        await tx.insert(supplierQuotationItems).values({
          quotationId: header.id,
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
    });

    await writeAuditLog({
      actorUserId: user.id,
      action: 'supply_chain.quotation.create',
      entityType: 'supplier_quotation',
      entityId: created.id,
      newValues: { number: created.quotationNumber, grandTotal: created.grandTotal },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, await loadQuotationDetail(created.id), 201);
  },
);

supplyChainProcurementRoutes.get(
  '/supplier-quotations/:id',
  requirePermission('supply_chain:read'),
  async (c) => {
    const { quotation } = await getQuotation(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    return ok(c, await loadQuotationDetail(quotation.id));
  },
);

supplyChainProcurementRoutes.post(
  '/supplier-quotations/:id/submit',
  requirePermission('supply_chain:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { quotation } = await getQuotation(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (!['requested', 'submitted'].includes(quotation.status)) {
      throw ApiError.badRequest('Penawaran tidak dapat diajukan pada status ini');
    }
    await db
      .update(supplierQuotations)
      .set({ status: 'submitted', submittedAt: new Date() })
      .where(eq(supplierQuotations.id, quotation.id));
    return ok(c, await loadQuotationDetail(quotation.id));
  },
);

supplyChainProcurementRoutes.post(
  '/supplier-quotations/:id/accept',
  requirePermission('supply_chain:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { quotation } = await getQuotation(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (!['submitted', 'requested'].includes(quotation.status)) {
      throw ApiError.badRequest('Penawaran tidak dapat diterima pada status ini');
    }
    await db.transaction(async (tx) => {
      await tx
        .update(supplierQuotations)
        .set({ status: 'accepted', acceptedAt: new Date() })
        .where(eq(supplierQuotations.id, quotation.id));
      if (quotation.requisitionId) {
        const siblings = await tx
          .select({ id: supplierQuotations.id })
          .from(supplierQuotations)
          .where(
            and(
              eq(supplierQuotations.requisitionId, quotation.requisitionId),
              ne(supplierQuotations.id, quotation.id),
            ),
          );
        if (siblings.length > 0) {
          await tx
            .update(supplierQuotations)
            .set({ status: 'rejected' })
            .where(
              inArray(
                supplierQuotations.id,
                siblings.map((row) => row.id),
              ),
            );
        }
      }
    });
    return ok(c, await loadQuotationDetail(quotation.id));
  },
);

supplyChainProcurementRoutes.post(
  '/supplier-quotations/:id/reject',
  requirePermission('supply_chain:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { quotation } = await getQuotation(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (['accepted', 'cancelled'].includes(quotation.status)) {
      throw ApiError.badRequest('Penawaran tidak dapat ditolak');
    }
    await db
      .update(supplierQuotations)
      .set({ status: 'rejected' })
      .where(eq(supplierQuotations.id, quotation.id));
    return ok(c, await loadQuotationDetail(quotation.id));
  },
);

supplyChainProcurementRoutes.post(
  '/supplier-quotations/:id/cancel',
  requirePermission('supply_chain:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { quotation } = await getQuotation(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (['accepted', 'cancelled'].includes(quotation.status)) {
      throw ApiError.badRequest('Penawaran tidak dapat dibatalkan');
    }
    await db
      .update(supplierQuotations)
      .set({ status: 'cancelled' })
      .where(eq(supplierQuotations.id, quotation.id));
    return ok(c, await loadQuotationDetail(quotation.id));
  },
);
