import {
  boolean,
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
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { productSkus, products } from './catalog';
import { merchants, stores, users } from './core';

/**
 * MKT-08 Inventory & Warehouse Management.
 *
 * Stok dicatat per SKU dan lokasi. Saldo (`stock_balances`) dibentuk dari
 * histori `stock_movements`; batch/expiry bersifat opsional per item.
 */
export const inventory = pgSchema('inventory');

export const warehouseStatusEnum = inventory.enum('warehouse_status', [
  'active',
  'inactive',
]);

export const warehouseLocationTypeEnum = inventory.enum('warehouse_location_type', [
  'storage',
  'receiving',
  'picking',
  'staging',
  'returns',
  'quarantine',
  'other',
]);

export const warehouseLocationStatusEnum = inventory.enum('warehouse_location_status', [
  'active',
  'inactive',
  'blocked',
]);

export const inventoryItemStatusEnum = inventory.enum('inventory_item_status', [
  'active',
  'inactive',
  'discontinued',
]);

export const stockMovementTypeEnum = inventory.enum('stock_movement_type', [
  'inbound',
  'outbound',
  'transfer',
  'adjustment',
  'stock_count',
  'return',
]);

export const stockMovementStatusEnum = inventory.enum('stock_movement_status', [
  'completed',
  'cancelled',
]);

export const stockAdjustmentTypeEnum = inventory.enum('stock_adjustment_type', [
  'increase',
  'decrease',
  'correction',
  'damage',
  'loss',
  'other',
]);

export const stockCountStatusEnum = inventory.enum('stock_count_status', [
  'draft',
  'counting',
  'completed',
  'cancelled',
]);

export const inventoryBatchStatusEnum = inventory.enum('inventory_batch_status', [
  'active',
  'depleted',
  'expired',
  'quarantined',
]);

const createdAt = timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = timestamp('updated_at', { withTimezone: true })
  .defaultNow()
  .notNull()
  .$onUpdate(() => new Date());

export const warehouses = inventory.table(
  'warehouses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id').references(() => stores.id, { onDelete: 'set null' }),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    address: text('address'),
    city: varchar('city', { length: 120 }),
    province: varchar('province', { length: 120 }),
    postalCode: varchar('postal_code', { length: 20 }),
    phone: varchar('phone', { length: 32 }),
    isDefault: boolean('is_default').default(false).notNull(),
    status: warehouseStatusEnum('status').default('active').notNull(),
    notes: text('notes'),
    createdAt,
    updatedAt,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('warehouses_merchant_code_uq').on(t.merchantId, t.code),
    index('warehouses_merchant_idx').on(t.merchantId),
    index('warehouses_store_idx').on(t.storeId),
    index('warehouses_status_idx').on(t.status),
  ],
);

export const warehouseLocations = inventory.table(
  'warehouse_locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    warehouseId: uuid('warehouse_id')
      .notNull()
      .references(() => warehouses.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => warehouseLocations.id, {
      onDelete: 'set null',
    }),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    type: warehouseLocationTypeEnum('type').default('storage').notNull(),
    status: warehouseLocationStatusEnum('status').default('active').notNull(),
    notes: text('notes'),
    createdAt,
    updatedAt,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('warehouse_locations_warehouse_code_uq').on(t.warehouseId, t.code),
    index('warehouse_locations_warehouse_idx').on(t.warehouseId),
    index('warehouse_locations_parent_idx').on(t.parentId),
    index('warehouse_locations_status_idx').on(t.status),
  ],
);

export const inventoryItems = inventory.table(
  'inventory_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    skuId: uuid('sku_id')
      .notNull()
      .references(() => productSkus.id, { onDelete: 'cascade' }),
    status: inventoryItemStatusEnum('status').default('active').notNull(),
    minStock: numeric('min_stock', { precision: 16, scale: 3 }).default('0').notNull(),
    maxStock: numeric('max_stock', { precision: 16, scale: 3 }),
    reorderPoint: numeric('reorder_point', { precision: 16, scale: 3 }),
    unitCost: numeric('unit_cost', { precision: 16, scale: 2 }).default('0').notNull(),
    trackBatches: boolean('track_batches').default(false).notNull(),
    trackExpiry: boolean('track_expiry').default(false).notNull(),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('inventory_items_merchant_sku_uq').on(t.merchantId, t.skuId),
    index('inventory_items_merchant_idx').on(t.merchantId),
    index('inventory_items_product_idx').on(t.productId),
    index('inventory_items_sku_idx').on(t.skuId),
    index('inventory_items_status_idx').on(t.status),
  ],
);

export const stockBalances = inventory.table(
  'stock_balances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    warehouseId: uuid('warehouse_id')
      .notNull()
      .references(() => warehouses.id, { onDelete: 'cascade' }),
    warehouseLocationId: uuid('warehouse_location_id')
      .notNull()
      .references(() => warehouseLocations.id, { onDelete: 'cascade' }),
    inventoryItemId: uuid('inventory_item_id')
      .notNull()
      .references(() => inventoryItems.id, { onDelete: 'cascade' }),
    quantity: numeric('quantity', { precision: 16, scale: 3 }).default('0').notNull(),
    reservedQuantity: numeric('reserved_quantity', { precision: 16, scale: 3 })
      .default('0')
      .notNull(),
    lastMovementAt: timestamp('last_movement_at', { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('stock_balances_location_item_uq').on(t.warehouseLocationId, t.inventoryItemId),
    index('stock_balances_merchant_idx').on(t.merchantId),
    index('stock_balances_warehouse_idx').on(t.warehouseId),
    index('stock_balances_item_idx').on(t.inventoryItemId),
  ],
);

export const inventoryBatches = inventory.table(
  'inventory_batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    inventoryItemId: uuid('inventory_item_id')
      .notNull()
      .references(() => inventoryItems.id, { onDelete: 'cascade' }),
    warehouseId: uuid('warehouse_id')
      .notNull()
      .references(() => warehouses.id, { onDelete: 'restrict' }),
    warehouseLocationId: uuid('warehouse_location_id')
      .notNull()
      .references(() => warehouseLocations.id, { onDelete: 'restrict' }),
    batchNumber: varchar('batch_number', { length: 100 }).notNull(),
    manufactureDate: date('manufacture_date'),
    expiryDate: date('expiry_date'),
    quantity: numeric('quantity', { precision: 16, scale: 3 }).default('0').notNull(),
    reservedQuantity: numeric('reserved_quantity', { precision: 16, scale: 3 })
      .default('0')
      .notNull(),
    unitCost: numeric('unit_cost', { precision: 16, scale: 2 }).default('0').notNull(),
    status: inventoryBatchStatusEnum('status').default('active').notNull(),
    supplierReference: varchar('supplier_reference', { length: 255 }),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('inventory_batches_item_location_number_uq').on(
      t.inventoryItemId,
      t.warehouseLocationId,
      t.batchNumber,
    ),
    index('inventory_batches_merchant_idx').on(t.merchantId),
    index('inventory_batches_item_idx').on(t.inventoryItemId),
    index('inventory_batches_warehouse_idx').on(t.warehouseId),
    index('inventory_batches_expiry_idx').on(t.expiryDate),
    index('inventory_batches_status_idx').on(t.status),
  ],
);

export const stockMovements = inventory.table(
  'stock_movements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    movementNumber: varchar('movement_number', { length: 32 }).notNull(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    type: stockMovementTypeEnum('type').notNull(),
    status: stockMovementStatusEnum('status').default('completed').notNull(),
    sourceWarehouseId: uuid('source_warehouse_id').references(() => warehouses.id, {
      onDelete: 'restrict',
    }),
    sourceLocationId: uuid('source_location_id').references(() => warehouseLocations.id, {
      onDelete: 'restrict',
    }),
    destinationWarehouseId: uuid('destination_warehouse_id').references(
      () => warehouses.id,
      { onDelete: 'restrict' },
    ),
    destinationLocationId: uuid('destination_location_id').references(
      () => warehouseLocations.id,
      { onDelete: 'restrict' },
    ),
    referenceType: varchar('reference_type', { length: 64 }),
    referenceId: uuid('reference_id'),
    referenceNumber: varchar('reference_number', { length: 128 }),
    notes: text('notes'),
    totalQuantity: numeric('total_quantity', { precision: 16, scale: 3 })
      .default('0')
      .notNull(),
    totalCost: numeric('total_cost', { precision: 16, scale: 2 }).default('0').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    completedBy: uuid('completed_by').references(() => users.id, { onDelete: 'set null' }),
    completedAt: timestamp('completed_at', { withTimezone: true }).defaultNow().notNull(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('stock_movements_number_uq').on(t.movementNumber),
    index('stock_movements_merchant_idx').on(t.merchantId),
    index('stock_movements_type_idx').on(t.type),
    index('stock_movements_status_idx').on(t.status),
    index('stock_movements_source_warehouse_idx').on(t.sourceWarehouseId),
    index('stock_movements_destination_warehouse_idx').on(t.destinationWarehouseId),
    index('stock_movements_completed_idx').on(t.completedAt),
  ],
);

export const stockMovementItems = inventory.table(
  'stock_movement_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    movementId: uuid('movement_id')
      .notNull()
      .references(() => stockMovements.id, { onDelete: 'cascade' }),
    inventoryItemId: uuid('inventory_item_id')
      .notNull()
      .references(() => inventoryItems.id, { onDelete: 'restrict' }),
    batchId: uuid('batch_id').references(() => inventoryBatches.id, {
      onDelete: 'set null',
    }),
    quantity: numeric('quantity', { precision: 16, scale: 3 }).notNull(),
    unitCost: numeric('unit_cost', { precision: 16, scale: 2 }).default('0').notNull(),
    totalCost: numeric('total_cost', { precision: 16, scale: 2 }).default('0').notNull(),
    notes: text('notes'),
    createdAt,
  },
  (t) => [
    index('stock_movement_items_movement_idx').on(t.movementId),
    index('stock_movement_items_item_idx').on(t.inventoryItemId),
    index('stock_movement_items_batch_idx').on(t.batchId),
  ],
);

export const stockAdjustments = inventory.table(
  'stock_adjustments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adjustmentNumber: varchar('adjustment_number', { length: 32 }).notNull(),
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
    type: stockAdjustmentTypeEnum('type').notNull(),
    quantity: numeric('quantity', { precision: 16, scale: 3 }).notNull(),
    beforeQuantity: numeric('before_quantity', { precision: 16, scale: 3 }).notNull(),
    afterQuantity: numeric('after_quantity', { precision: 16, scale: 3 }).notNull(),
    reason: text('reason').notNull(),
    movementId: uuid('movement_id').references(() => stockMovements.id, {
      onDelete: 'set null',
    }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('stock_adjustments_number_uq').on(t.adjustmentNumber),
    index('stock_adjustments_merchant_idx').on(t.merchantId),
    index('stock_adjustments_warehouse_idx').on(t.warehouseId),
    index('stock_adjustments_item_idx').on(t.inventoryItemId),
    index('stock_adjustments_movement_idx').on(t.movementId),
  ],
);

export const stockCounts = inventory.table(
  'stock_counts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    countNumber: varchar('count_number', { length: 32 }).notNull(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    warehouseId: uuid('warehouse_id')
      .notNull()
      .references(() => warehouses.id, { onDelete: 'restrict' }),
    warehouseLocationId: uuid('warehouse_location_id')
      .notNull()
      .references(() => warehouseLocations.id, { onDelete: 'restrict' }),
    status: stockCountStatusEnum('status').default('draft').notNull(),
    notes: text('notes'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    completedBy: uuid('completed_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('stock_counts_number_uq').on(t.countNumber),
    index('stock_counts_merchant_idx').on(t.merchantId),
    index('stock_counts_warehouse_idx').on(t.warehouseId),
    index('stock_counts_status_idx').on(t.status),
    index('stock_counts_started_idx').on(t.startedAt),
  ],
);

export const stockCountItems = inventory.table(
  'stock_count_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    countId: uuid('count_id')
      .notNull()
      .references(() => stockCounts.id, { onDelete: 'cascade' }),
    inventoryItemId: uuid('inventory_item_id')
      .notNull()
      .references(() => inventoryItems.id, { onDelete: 'restrict' }),
    systemQuantity: numeric('system_quantity', { precision: 16, scale: 3 }).notNull(),
    countedQuantity: numeric('counted_quantity', { precision: 16, scale: 3 }),
    differenceQuantity: numeric('difference_quantity', { precision: 16, scale: 3 }),
    unitCost: numeric('unit_cost', { precision: 16, scale: 2 }).default('0').notNull(),
    notes: text('notes'),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('stock_count_items_count_item_uq').on(t.countId, t.inventoryItemId),
    index('stock_count_items_count_idx').on(t.countId),
    index('stock_count_items_item_idx').on(t.inventoryItemId),
  ],
);
