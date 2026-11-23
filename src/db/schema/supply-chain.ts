import {
  date,
  index,
  integer,
  numeric,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { orderItems, orders, returns } from './commerce';
import { merchants, users } from './core';
import { productSkus, products } from './catalog';
import {
  inventoryItems,
  stockMovements,
  warehouseLocations,
  warehouses,
} from './inventory';

/**
 * SCM-01 B2B Supply Chain & Procurement and SCM-02 Warehouse & Fulfillment.
 *
 * `suppliers` disertakan sebagai master minimum karena SCM-01 belum dapat
 * berjalan tanpa data pemasok. Modul MKT-10 nantinya memperluas master ini
 * dengan profil, katalog produk, price list, dan dokumen supplier.
 */
export const supplyChain = pgSchema('supply_chain');

const createdAt = timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = timestamp('updated_at', { withTimezone: true })
  .defaultNow()
  .notNull()
  .$onUpdate(() => new Date());

export const supplierStatusEnum = supplyChain.enum('supplier_status', [
  'active',
  'inactive',
  'suspended',
]);

export const procurementPriorityEnum = supplyChain.enum('procurement_priority', [
  'low',
  'normal',
  'high',
  'urgent',
]);

export const purchaseRequisitionStatusEnum = supplyChain.enum(
  'purchase_requisition_status',
  ['draft', 'submitted', 'approved', 'rejected', 'converted', 'cancelled'],
);

export const supplierQuotationStatusEnum = supplyChain.enum(
  'supplier_quotation_status',
  ['requested', 'submitted', 'accepted', 'rejected', 'expired', 'cancelled'],
);

export const purchaseOrderStatusEnum = supplyChain.enum('purchase_order_status', [
  'draft',
  'pending_approval',
  'approved',
  'ordered',
  'partially_received',
  'received',
  'cancelled',
  'closed',
]);

export const goodsReceiptStatusEnum = supplyChain.enum('goods_receipt_status', [
  'draft',
  'received',
  'inspected',
  'completed',
  'cancelled',
]);

export const procurementApprovalStatusEnum = supplyChain.enum(
  'procurement_approval_status',
  ['pending', 'approved', 'rejected'],
);

export const collectivePurchaseStatusEnum = supplyChain.enum(
  'collective_purchase_status',
  ['open', 'closed', 'converted', 'cancelled'],
);

export const warehouseReceiptStatusEnum = supplyChain.enum('warehouse_receipt_status', [
  'pending',
  'receiving',
  'received',
  'put_away',
  'cancelled',
]);

export const warehouseReceiptSourceEnum = supplyChain.enum('warehouse_receipt_source', [
  'goods_receipt',
  'transfer',
  'return',
  'manual',
]);

export const putawayTaskStatusEnum = supplyChain.enum('putaway_task_status', [
  'pending',
  'in_progress',
  'completed',
  'cancelled',
]);

export const warehouseAllocationStatusEnum = supplyChain.enum(
  'warehouse_allocation_status',
  ['pending', 'allocated', 'released', 'cancelled'],
);

export const pickingTaskStatusEnum = supplyChain.enum('picking_task_status', [
  'pending',
  'in_progress',
  'picked',
  'cancelled',
]);

export const packingTaskStatusEnum = supplyChain.enum('packing_task_status', [
  'pending',
  'packing',
  'packed',
  'cancelled',
]);

export const dispatchStatusEnum = supplyChain.enum('dispatch_status', [
  'pending',
  'dispatched',
  'in_transit',
  'delivered',
  'failed',
  'returned',
  'cancelled',
]);

export const warehouseReturnStatusEnum = supplyChain.enum('warehouse_return_status', [
  'requested',
  'approved',
  'received',
  'restocked',
  'rejected',
  'cancelled',
]);

/* --------------------------------- SCM-01 -------------------------------- */

export const suppliers = supplyChain.table(
  'suppliers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    legalName: varchar('legal_name', { length: 255 }),
    contactName: varchar('contact_name', { length: 255 }),
    contactEmail: varchar('contact_email', { length: 255 }),
    contactPhone: varchar('contact_phone', { length: 32 }),
    address: text('address'),
    city: varchar('city', { length: 120 }),
    province: varchar('province', { length: 120 }),
    postalCode: varchar('postal_code', { length: 20 }),
    country: varchar('country', { length: 2 }).default('ID').notNull(),
    taxNumber: varchar('tax_number', { length: 64 }),
    paymentTermDays: integer('payment_term_days').default(0).notNull(),
    status: supplierStatusEnum('status').default('active').notNull(),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('suppliers_merchant_code_uq').on(t.merchantId, t.code),
    index('suppliers_merchant_idx').on(t.merchantId),
    index('suppliers_name_idx').on(t.name),
    index('suppliers_status_idx').on(t.status),
  ],
);

export const purchaseRequisitions = supplyChain.table(
  'purchase_requisitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requisitionNumber: varchar('requisition_number', { length: 32 }).notNull(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    warehouseId: uuid('warehouse_id').references(() => warehouses.id, {
      onDelete: 'set null',
    }),
    requestedBy: uuid('requested_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    title: varchar('title', { length: 255 }).notNull(),
    status: purchaseRequisitionStatusEnum('status').default('draft').notNull(),
    priority: procurementPriorityEnum('priority').default('normal').notNull(),
    neededBy: date('needed_by'),
    notes: text('notes'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('purchase_requisitions_number_uq').on(t.requisitionNumber),
    index('purchase_requisitions_merchant_idx').on(t.merchantId),
    index('purchase_requisitions_warehouse_idx').on(t.warehouseId),
    index('purchase_requisitions_status_idx').on(t.status),
    index('purchase_requisitions_requested_idx').on(t.requestedBy),
    index('purchase_requisitions_created_idx').on(t.createdAt),
  ],
);

export const purchaseRequisitionItems = supplyChain.table(
  'purchase_requisition_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requisitionId: uuid('requisition_id')
      .notNull()
      .references(() => purchaseRequisitions.id, { onDelete: 'cascade' }),
    inventoryItemId: uuid('inventory_item_id').references(() => inventoryItems.id, {
      onDelete: 'set null',
    }),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    skuId: uuid('sku_id').references(() => productSkus.id, { onDelete: 'set null' }),
    description: varchar('description', { length: 500 }).notNull(),
    quantity: numeric('quantity', { precision: 16, scale: 3 }).notNull(),
    estimatedUnitPrice: numeric('estimated_unit_price', { precision: 16, scale: 2 })
      .default('0')
      .notNull(),
    notes: text('notes'),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('purchase_requisition_items_requisition_idx').on(t.requisitionId),
    index('purchase_requisition_items_inventory_item_idx').on(t.inventoryItemId),
  ],
);

export const supplierQuotations = supplyChain.table(
  'supplier_quotations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    quotationNumber: varchar('quotation_number', { length: 32 }).notNull(),
    requisitionId: uuid('requisition_id').references(() => purchaseRequisitions.id, {
      onDelete: 'set null',
    }),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'restrict' }),
    status: supplierQuotationStatusEnum('status').default('requested').notNull(),
    currency: varchar('currency', { length: 3 }).default('IDR').notNull(),
    subtotal: numeric('subtotal', { precision: 16, scale: 2 }).default('0').notNull(),
    discountTotal: numeric('discount_total', { precision: 16, scale: 2 })
      .default('0')
      .notNull(),
    taxTotal: numeric('tax_total', { precision: 16, scale: 2 }).default('0').notNull(),
    shippingTotal: numeric('shipping_total', { precision: 16, scale: 2 })
      .default('0')
      .notNull(),
    grandTotal: numeric('grand_total', { precision: 16, scale: 2 }).default('0').notNull(),
    validUntil: date('valid_until'),
    paymentTermDays: integer('payment_term_days').default(0).notNull(),
    deliveryDays: integer('delivery_days'),
    notes: text('notes'),
    requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('supplier_quotations_number_uq').on(t.quotationNumber),
    index('supplier_quotations_requisition_idx').on(t.requisitionId),
    index('supplier_quotations_merchant_idx').on(t.merchantId),
    index('supplier_quotations_supplier_idx').on(t.supplierId),
    index('supplier_quotations_status_idx').on(t.status),
  ],
);

export const supplierQuotationItems = supplyChain.table(
  'supplier_quotation_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    quotationId: uuid('quotation_id')
      .notNull()
      .references(() => supplierQuotations.id, { onDelete: 'cascade' }),
    requisitionItemId: uuid('requisition_item_id').references(
      () => purchaseRequisitionItems.id,
      { onDelete: 'set null' },
    ),
    inventoryItemId: uuid('inventory_item_id').references(() => inventoryItems.id, {
      onDelete: 'set null',
    }),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    skuId: uuid('sku_id').references(() => productSkus.id, { onDelete: 'set null' }),
    description: varchar('description', { length: 500 }).notNull(),
    quantity: numeric('quantity', { precision: 16, scale: 3 }).notNull(),
    unitPrice: numeric('unit_price', { precision: 16, scale: 2 }).notNull(),
    lineTotal: numeric('line_total', { precision: 16, scale: 2 }).notNull(),
    notes: text('notes'),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('supplier_quotation_items_quotation_idx').on(t.quotationId),
    index('supplier_quotation_items_requisition_item_idx').on(t.requisitionItemId),
  ],
);

export const purchaseOrders = supplyChain.table(
  'purchase_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderNumber: varchar('order_number', { length: 32 }).notNull(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    warehouseId: uuid('warehouse_id').references(() => warehouses.id, {
      onDelete: 'set null',
    }),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'restrict' }),
    requisitionId: uuid('requisition_id').references(() => purchaseRequisitions.id, {
      onDelete: 'set null',
    }),
    quotationId: uuid('quotation_id').references(() => supplierQuotations.id, {
      onDelete: 'set null',
    }),
    status: purchaseOrderStatusEnum('status').default('draft').notNull(),
    currency: varchar('currency', { length: 3 }).default('IDR').notNull(),
    subtotal: numeric('subtotal', { precision: 16, scale: 2 }).default('0').notNull(),
    discountTotal: numeric('discount_total', { precision: 16, scale: 2 })
      .default('0')
      .notNull(),
    taxTotal: numeric('tax_total', { precision: 16, scale: 2 }).default('0').notNull(),
    shippingTotal: numeric('shipping_total', { precision: 16, scale: 2 })
      .default('0')
      .notNull(),
    grandTotal: numeric('grand_total', { precision: 16, scale: 2 }).default('0').notNull(),
    paymentTermDays: integer('payment_term_days').default(0).notNull(),
    expectedDeliveryDate: date('expected_delivery_date'),
    orderedAt: timestamp('ordered_at', { withTimezone: true }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('purchase_orders_number_uq').on(t.orderNumber),
    index('purchase_orders_merchant_idx').on(t.merchantId),
    index('purchase_orders_supplier_idx').on(t.supplierId),
    index('purchase_orders_requisition_idx').on(t.requisitionId),
    index('purchase_orders_quotation_idx').on(t.quotationId),
    index('purchase_orders_status_idx').on(t.status),
    index('purchase_orders_created_idx').on(t.createdAt),
  ],
);

export const purchaseOrderItems = supplyChain.table(
  'purchase_order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    purchaseOrderId: uuid('purchase_order_id')
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: 'cascade' }),
    requisitionItemId: uuid('requisition_item_id').references(
      () => purchaseRequisitionItems.id,
      { onDelete: 'set null' },
    ),
    inventoryItemId: uuid('inventory_item_id').references(() => inventoryItems.id, {
      onDelete: 'set null',
    }),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    skuId: uuid('sku_id').references(() => productSkus.id, { onDelete: 'set null' }),
    description: varchar('description', { length: 500 }).notNull(),
    quantity: numeric('quantity', { precision: 16, scale: 3 }).notNull(),
    receivedQuantity: numeric('received_quantity', { precision: 16, scale: 3 })
      .default('0')
      .notNull(),
    unitPrice: numeric('unit_price', { precision: 16, scale: 2 }).notNull(),
    lineTotal: numeric('line_total', { precision: 16, scale: 2 }).notNull(),
    notes: text('notes'),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('purchase_order_items_order_idx').on(t.purchaseOrderId),
    index('purchase_order_items_requisition_item_idx').on(t.requisitionItemId),
    index('purchase_order_items_inventory_item_idx').on(t.inventoryItemId),
  ],
);

export const goodsReceipts = supplyChain.table(
  'goods_receipts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    receiptNumber: varchar('receipt_number', { length: 32 }).notNull(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    warehouseId: uuid('warehouse_id')
      .notNull()
      .references(() => warehouses.id, { onDelete: 'restrict' }),
    warehouseLocationId: uuid('warehouse_location_id')
      .notNull()
      .references(() => warehouseLocations.id, { onDelete: 'restrict' }),
    purchaseOrderId: uuid('purchase_order_id').references(() => purchaseOrders.id, {
      onDelete: 'set null',
    }),
    supplierId: uuid('supplier_id').references(() => suppliers.id, {
      onDelete: 'set null',
    }),
    stockMovementId: uuid('stock_movement_id').references(() => stockMovements.id, {
      onDelete: 'set null',
    }),
    status: goodsReceiptStatusEnum('status').default('draft').notNull(),
    receivedBy: uuid('received_by').references(() => users.id, { onDelete: 'set null' }),
    receivedAt: timestamp('received_at', { withTimezone: true }),
    inspectedAt: timestamp('inspected_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('goods_receipts_number_uq').on(t.receiptNumber),
    index('goods_receipts_merchant_idx').on(t.merchantId),
    index('goods_receipts_warehouse_idx').on(t.warehouseId),
    index('goods_receipts_purchase_order_idx').on(t.purchaseOrderId),
    index('goods_receipts_status_idx').on(t.status),
  ],
);

export const goodsReceiptItems = supplyChain.table(
  'goods_receipt_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    goodsReceiptId: uuid('goods_receipt_id')
      .notNull()
      .references(() => goodsReceipts.id, { onDelete: 'cascade' }),
    purchaseOrderItemId: uuid('purchase_order_item_id').references(
      () => purchaseOrderItems.id,
      { onDelete: 'set null' },
    ),
    inventoryItemId: uuid('inventory_item_id').references(() => inventoryItems.id, {
      onDelete: 'set null',
    }),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    skuId: uuid('sku_id').references(() => productSkus.id, { onDelete: 'set null' }),
    description: varchar('description', { length: 500 }).notNull(),
    quantityReceived: numeric('quantity_received', { precision: 16, scale: 3 })
      .default('0')
      .notNull(),
    quantityRejected: numeric('quantity_rejected', { precision: 16, scale: 3 })
      .default('0')
      .notNull(),
    unitCost: numeric('unit_cost', { precision: 16, scale: 2 }).default('0').notNull(),
    batchNumber: varchar('batch_number', { length: 100 }),
    manufactureDate: date('manufacture_date'),
    expiryDate: date('expiry_date'),
    notes: text('notes'),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('goods_receipt_items_receipt_idx').on(t.goodsReceiptId),
    index('goods_receipt_items_order_item_idx').on(t.purchaseOrderItemId),
    index('goods_receipt_items_inventory_item_idx').on(t.inventoryItemId),
  ],
);

export const procurementApprovals = supplyChain.table(
  'procurement_approvals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    entityType: varchar('entity_type', { length: 64 }).notNull(),
    entityId: uuid('entity_id').notNull(),
    step: integer('step').default(1).notNull(),
    status: procurementApprovalStatusEnum('status').default('pending').notNull(),
    requestedBy: uuid('requested_by').references(() => users.id, { onDelete: 'set null' }),
    decidedBy: uuid('decided_by').references(() => users.id, { onDelete: 'set null' }),
    notes: text('notes'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('procurement_approvals_entity_step_uq').on(
      t.entityType,
      t.entityId,
      t.step,
    ),
    index('procurement_approvals_merchant_idx').on(t.merchantId),
    index('procurement_approvals_status_idx').on(t.status),
    index('procurement_approvals_entity_idx').on(t.entityType, t.entityId),
  ],
);

export const collectivePurchaseGroups = supplyChain.table(
  'collective_purchase_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupNumber: varchar('group_number', { length: 32 }).notNull(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    supplierId: uuid('supplier_id').references(() => suppliers.id, {
      onDelete: 'set null',
    }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    status: collectivePurchaseStatusEnum('status').default('open').notNull(),
    targetQuantity: numeric('target_quantity', { precision: 16, scale: 3 })
      .default('0')
      .notNull(),
    currentQuantity: numeric('current_quantity', { precision: 16, scale: 3 })
      .default('0')
      .notNull(),
    unit: varchar('unit', { length: 32 }).default('pcs').notNull(),
    targetPrice: numeric('target_price', { precision: 16, scale: 2 }).default('0').notNull(),
    closesAt: timestamp('closes_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('collective_purchase_groups_number_uq').on(t.groupNumber),
    index('collective_purchase_groups_merchant_idx').on(t.merchantId),
    index('collective_purchase_groups_supplier_idx').on(t.supplierId),
    index('collective_purchase_groups_status_idx').on(t.status),
  ],
);

/* --------------------------------- SCM-02 -------------------------------- */

export const warehouseReceipts = supplyChain.table(
  'warehouse_receipts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    receiptNumber: varchar('receipt_number', { length: 32 }).notNull(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    warehouseId: uuid('warehouse_id')
      .notNull()
      .references(() => warehouses.id, { onDelete: 'restrict' }),
    warehouseLocationId: uuid('warehouse_location_id')
      .notNull()
      .references(() => warehouseLocations.id, { onDelete: 'restrict' }),
    goodsReceiptId: uuid('goods_receipt_id').references(() => goodsReceipts.id, {
      onDelete: 'set null',
    }),
    purchaseOrderId: uuid('purchase_order_id').references(() => purchaseOrders.id, {
      onDelete: 'set null',
    }),
    stockMovementId: uuid('stock_movement_id').references(() => stockMovements.id, {
      onDelete: 'set null',
    }),
    source: warehouseReceiptSourceEnum('source').default('manual').notNull(),
    status: warehouseReceiptStatusEnum('status').default('pending').notNull(),
    expectedQuantity: numeric('expected_quantity', { precision: 16, scale: 3 })
      .default('0')
      .notNull(),
    receivedQuantity: numeric('received_quantity', { precision: 16, scale: 3 })
      .default('0')
      .notNull(),
    receivedBy: uuid('received_by').references(() => users.id, { onDelete: 'set null' }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('warehouse_receipts_number_uq').on(t.receiptNumber),
    index('warehouse_receipts_merchant_idx').on(t.merchantId),
    index('warehouse_receipts_warehouse_idx').on(t.warehouseId),
    index('warehouse_receipts_goods_receipt_idx').on(t.goodsReceiptId),
    index('warehouse_receipts_status_idx').on(t.status),
  ],
);

export const putawayTasks = supplyChain.table(
  'putaway_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskNumber: varchar('task_number', { length: 32 }).notNull(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    warehouseId: uuid('warehouse_id')
      .notNull()
      .references(() => warehouses.id, { onDelete: 'restrict' }),
    warehouseReceiptId: uuid('warehouse_receipt_id').references(
      () => warehouseReceipts.id,
      { onDelete: 'cascade' },
    ),
    inventoryItemId: uuid('inventory_item_id')
      .notNull()
      .references(() => inventoryItems.id, { onDelete: 'restrict' }),
    sourceLocationId: uuid('source_location_id')
      .notNull()
      .references(() => warehouseLocations.id, { onDelete: 'restrict' }),
    destinationLocationId: uuid('destination_location_id').references(
      () => warehouseLocations.id,
      { onDelete: 'restrict' },
    ),
    quantity: numeric('quantity', { precision: 16, scale: 3 }).notNull(),
    batchNumber: varchar('batch_number', { length: 100 }),
    status: putawayTaskStatusEnum('status').default('pending').notNull(),
    assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('putaway_tasks_number_uq').on(t.taskNumber),
    index('putaway_tasks_merchant_idx').on(t.merchantId),
    index('putaway_tasks_warehouse_idx').on(t.warehouseId),
    index('putaway_tasks_receipt_idx').on(t.warehouseReceiptId),
    index('putaway_tasks_status_idx').on(t.status),
    index('putaway_tasks_item_idx').on(t.inventoryItemId),
  ],
);

export const warehouseAllocations = supplyChain.table(
  'warehouse_allocations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    allocationNumber: varchar('allocation_number', { length: 32 }).notNull(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    warehouseId: uuid('warehouse_id')
      .notNull()
      .references(() => warehouses.id, { onDelete: 'restrict' }),
    warehouseLocationId: uuid('warehouse_location_id')
      .notNull()
      .references(() => warehouseLocations.id, { onDelete: 'restrict' }),
    inventoryItemId: uuid('inventory_item_id')
      .notNull()
      .references(() => inventoryItems.id, { onDelete: 'restrict' }),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    orderItemId: uuid('order_item_id').references(() => orderItems.id, {
      onDelete: 'set null',
    }),
    quantity: numeric('quantity', { precision: 16, scale: 3 }).notNull(),
    status: warehouseAllocationStatusEnum('status').default('pending').notNull(),
    allocatedAt: timestamp('allocated_at', { withTimezone: true }),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('warehouse_allocations_number_uq').on(t.allocationNumber),
    index('warehouse_allocations_merchant_idx').on(t.merchantId),
    index('warehouse_allocations_warehouse_idx').on(t.warehouseId),
    index('warehouse_allocations_item_idx').on(t.inventoryItemId),
    index('warehouse_allocations_order_idx').on(t.orderId),
    index('warehouse_allocations_status_idx').on(t.status),
  ],
);

export const pickingTasks = supplyChain.table(
  'picking_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskNumber: varchar('task_number', { length: 32 }).notNull(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    warehouseId: uuid('warehouse_id')
      .notNull()
      .references(() => warehouses.id, { onDelete: 'restrict' }),
    allocationId: uuid('allocation_id').references(() => warehouseAllocations.id, {
      onDelete: 'set null',
    }),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    status: pickingTaskStatusEnum('status').default('pending').notNull(),
    assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
    priority: procurementPriorityEnum('priority').default('normal').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('picking_tasks_number_uq').on(t.taskNumber),
    index('picking_tasks_merchant_idx').on(t.merchantId),
    index('picking_tasks_warehouse_idx').on(t.warehouseId),
    index('picking_tasks_allocation_idx').on(t.allocationId),
    index('picking_tasks_order_idx').on(t.orderId),
    index('picking_tasks_status_idx').on(t.status),
  ],
);

export const pickingItems = supplyChain.table(
  'picking_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pickingTaskId: uuid('picking_task_id')
      .notNull()
      .references(() => pickingTasks.id, { onDelete: 'cascade' }),
    allocationId: uuid('allocation_id').references(() => warehouseAllocations.id, {
      onDelete: 'set null',
    }),
    inventoryItemId: uuid('inventory_item_id')
      .notNull()
      .references(() => inventoryItems.id, { onDelete: 'restrict' }),
    warehouseLocationId: uuid('warehouse_location_id')
      .notNull()
      .references(() => warehouseLocations.id, { onDelete: 'restrict' }),
    quantity: numeric('quantity', { precision: 16, scale: 3 }).notNull(),
    pickedQuantity: numeric('picked_quantity', { precision: 16, scale: 3 })
      .default('0')
      .notNull(),
    batchNumber: varchar('batch_number', { length: 100 }),
    notes: text('notes'),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('picking_items_task_idx').on(t.pickingTaskId),
    index('picking_items_allocation_idx').on(t.allocationId),
    index('picking_items_item_idx').on(t.inventoryItemId),
  ],
);

export const packingTasks = supplyChain.table(
  'packing_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskNumber: varchar('task_number', { length: 32 }).notNull(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    warehouseId: uuid('warehouse_id')
      .notNull()
      .references(() => warehouses.id, { onDelete: 'restrict' }),
    pickingTaskId: uuid('picking_task_id').references(() => pickingTasks.id, {
      onDelete: 'set null',
    }),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    status: packingTaskStatusEnum('status').default('pending').notNull(),
    packageCount: integer('package_count').default(1).notNull(),
    weightGram: integer('weight_gram'),
    dimensions: varchar('dimensions', { length: 64 }),
    assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('packing_tasks_number_uq').on(t.taskNumber),
    index('packing_tasks_merchant_idx').on(t.merchantId),
    index('packing_tasks_warehouse_idx').on(t.warehouseId),
    index('packing_tasks_picking_idx').on(t.pickingTaskId),
    index('packing_tasks_order_idx').on(t.orderId),
    index('packing_tasks_status_idx').on(t.status),
  ],
);

export const dispatchRecords = supplyChain.table(
  'dispatch_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dispatchNumber: varchar('dispatch_number', { length: 32 }).notNull(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    warehouseId: uuid('warehouse_id')
      .notNull()
      .references(() => warehouses.id, { onDelete: 'restrict' }),
    packingTaskId: uuid('packing_task_id').references(() => packingTasks.id, {
      onDelete: 'set null',
    }),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    status: dispatchStatusEnum('status').default('pending').notNull(),
    courierName: varchar('courier_name', { length: 255 }),
    trackingNumber: varchar('tracking_number', { length: 128 }),
    vehicleNumber: varchar('vehicle_number', { length: 64 }),
    recipientName: varchar('recipient_name', { length: 255 }),
    dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('dispatch_records_number_uq').on(t.dispatchNumber),
    index('dispatch_records_merchant_idx').on(t.merchantId),
    index('dispatch_records_warehouse_idx').on(t.warehouseId),
    index('dispatch_records_packing_idx').on(t.packingTaskId),
    index('dispatch_records_order_idx').on(t.orderId),
    index('dispatch_records_status_idx').on(t.status),
  ],
);

export const warehouseReturns = supplyChain.table(
  'warehouse_returns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    returnNumber: varchar('return_number', { length: 32 }).notNull(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    warehouseId: uuid('warehouse_id')
      .notNull()
      .references(() => warehouses.id, { onDelete: 'restrict' }),
    warehouseLocationId: uuid('warehouse_location_id')
      .notNull()
      .references(() => warehouseLocations.id, { onDelete: 'restrict' }),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    orderReturnId: uuid('order_return_id').references(() => returns.id, {
      onDelete: 'set null',
    }),
    inventoryItemId: uuid('inventory_item_id').references(() => inventoryItems.id, {
      onDelete: 'set null',
    }),
    stockMovementId: uuid('stock_movement_id').references(() => stockMovements.id, {
      onDelete: 'set null',
    }),
    status: warehouseReturnStatusEnum('status').default('requested').notNull(),
    reason: text('reason').notNull(),
    quantity: numeric('quantity', { precision: 16, scale: 3 }).default('0').notNull(),
    requestedBy: uuid('requested_by').references(() => users.id, { onDelete: 'set null' }),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
    receivedAt: timestamp('received_at', { withTimezone: true }),
    restockedAt: timestamp('restocked_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('warehouse_returns_number_uq').on(t.returnNumber),
    index('warehouse_returns_merchant_idx').on(t.merchantId),
    index('warehouse_returns_warehouse_idx').on(t.warehouseId),
    index('warehouse_returns_order_idx').on(t.orderId),
    index('warehouse_returns_status_idx').on(t.status),
  ],
);

export const fulfillmentStatusHistories = supplyChain.table(
  'fulfillment_status_histories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    entityType: varchar('entity_type', { length: 64 }).notNull(),
    entityId: uuid('entity_id').notNull(),
    fromStatus: varchar('from_status', { length: 64 }),
    toStatus: varchar('to_status', { length: 64 }).notNull(),
    note: text('note'),
    changedBy: uuid('changed_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
  },
  (t) => [
    index('fulfillment_status_histories_merchant_idx').on(t.merchantId),
    index('fulfillment_status_histories_entity_idx').on(t.entityType, t.entityId),
    index('fulfillment_status_histories_created_idx').on(t.createdAt),
  ],
);
