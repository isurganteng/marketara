import { and, asc, count, desc, eq, ilike, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  inventoryBatches,
  inventoryItems,
  merchants,
  productSkus,
  products,
  stockBalances,
  stockCounts,
  stockMovements,
  stores,
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
  assertLocationInWarehouse,
  getBatch,
  getInventoryItem,
  getWarehouse,
  getWarehouseLocation,
  inventoryScopeCondition,
  money,
  quantity,
  toNumber,
} from './shared';

const statusSchema = z.enum(['active', 'inactive']);
const locationTypeSchema = z.enum([
  'storage',
  'receiving',
  'picking',
  'staging',
  'returns',
  'quarantine',
  'other',
]);
const locationStatusSchema = z.enum(['active', 'inactive', 'blocked']);
const itemStatusSchema = z.enum(['active', 'inactive', 'discontinued']);
const batchStatusSchema = z.enum(['active', 'depleted', 'expired', 'quarantined']);

const codeSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'Gunakan huruf, angka, garis bawah, atau tanda hubung');

const numericSchema = z
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

const listWarehousesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  storeId: z.uuid().optional(),
  status: statusSchema.optional(),
});

const createWarehouseSchema = z.object({
  merchantId: z.uuid(),
  storeId: z.uuid().optional(),
  code: codeSchema.optional(),
  name: z.string().trim().min(2).max(255),
  address: z.string().trim().max(2000).optional(),
  city: z.string().trim().max(120).optional(),
  province: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().max(20).optional(),
  phone: z.string().trim().max(32).optional(),
  isDefault: z.boolean().default(false),
  status: statusSchema.default('active'),
  notes: z.string().trim().max(2000).optional(),
});

const updateWarehouseSchema = createWarehouseSchema
  .omit({ merchantId: true })
  .partial();

const listLocationsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  search: z.string().trim().max(100).optional(),
  warehouseId: z.uuid().optional(),
  type: locationTypeSchema.optional(),
  status: locationStatusSchema.optional(),
});

const createLocationSchema = z.object({
  parentId: z.uuid().optional(),
  code: codeSchema.optional(),
  name: z.string().trim().min(2).max(255),
  type: locationTypeSchema.default('storage'),
  status: locationStatusSchema.default('active'),
  notes: z.string().trim().max(2000).optional(),
});

const updateLocationSchema = createLocationSchema.partial();

const listItemsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  productId: z.uuid().optional(),
  status: itemStatusSchema.optional(),
});

const createItemSchema = z.object({
  merchantId: z.uuid(),
  productId: z.uuid(),
  skuId: z.uuid(),
  status: itemStatusSchema.default('active'),
  minStock: numericSchema.default('0'),
  maxStock: numericSchema.optional(),
  reorderPoint: numericSchema.optional(),
  unitCost: numericSchema.default('0'),
  trackBatches: z.boolean().default(false),
  trackExpiry: z.boolean().default(false),
  notes: z.string().trim().max(2000).optional(),
});

const updateItemSchema = createItemSchema.omit({ merchantId: true, productId: true, skuId: true }).partial();

const listBalancesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  warehouseId: z.uuid().optional(),
  locationId: z.uuid().optional(),
  inventoryItemId: z.uuid().optional(),
  lowStock: z.enum(['true', 'false']).optional(),
});

const listBatchesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  warehouseId: z.uuid().optional(),
  inventoryItemId: z.uuid().optional(),
  status: batchStatusSchema.optional(),
  expiry: z.enum(['expired', 'expiring', 'safe']).optional(),
});

const updateBatchSchema = z
  .object({
    status: batchStatusSchema.optional(),
    manufactureDate: dateOnlySchema.nullable().optional(),
    expiryDate: dateOnlySchema.nullable().optional(),
    supplierReference: z.string().trim().max(255).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .partial();

export const inventoryResourceRoutes = new Hono<AppEnv>();

/* ------------------------------ Summary ----------------------------- */

inventoryResourceRoutes.get(
  '/summary',
  requirePermission('inventory:read'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const scope = inventoryScopeCondition(user, permissions);

    const warehouseWhere = and(isNull(warehouses.deletedAt), scope);
    const itemWhere = and(isNull(inventoryItems.deletedAt), scope);
    const balanceWhere = scope;
    const movementWhere = scope;
    const countWhere = scope;

    const [
      [warehouseRow],
      [locationRow],
      [itemRow],
      [stockRow],
      [lowStockRow],
      [expiringRow],
      [openCountRow],
    ] = await Promise.all([
      db.select({ value: count() }).from(warehouses).innerJoin(merchants, eq(merchants.id, warehouses.merchantId)).where(warehouseWhere),
      db
        .select({ value: count() })
        .from(warehouseLocations)
        .innerJoin(warehouses, eq(warehouses.id, warehouseLocations.warehouseId))
        .innerJoin(merchants, eq(merchants.id, warehouses.merchantId))
        .where(and(isNull(warehouseLocations.deletedAt), isNull(warehouses.deletedAt), scope)),
      db
        .select({ value: count() })
        .from(inventoryItems)
        .innerJoin(merchants, eq(merchants.id, inventoryItems.merchantId))
        .where(itemWhere),
      db
        .select({ value: sql<string>`coalesce(sum(${stockBalances.quantity}), 0)` })
        .from(stockBalances)
        .innerJoin(merchants, eq(merchants.id, stockBalances.merchantId))
        .where(balanceWhere),
      db
        .select({ value: count() })
        .from(stockBalances)
        .innerJoin(merchants, eq(merchants.id, stockBalances.merchantId))
        .innerJoin(inventoryItems, eq(inventoryItems.id, stockBalances.inventoryItemId))
        .where(
          and(
            balanceWhere,
            isNull(inventoryItems.deletedAt),
            lte(stockBalances.quantity, inventoryItems.minStock),
          ),
        ),
      db
        .select({ value: count() })
        .from(inventoryBatches)
        .innerJoin(merchants, eq(merchants.id, inventoryBatches.merchantId))
        .where(
          and(
            scope,
            eq(inventoryBatches.status, 'active'),
            sql`${inventoryBatches.expiryDate} is not null`,
            sql`${inventoryBatches.expiryDate} <= current_date + interval '30 days'`,
          ),
        ),
      db
        .select({ value: count() })
        .from(stockCounts)
        .innerJoin(merchants, eq(merchants.id, stockCounts.merchantId))
        .where(and(countWhere, or(eq(stockCounts.status, 'draft'), eq(stockCounts.status, 'counting')))),
    ]);

    const [movementCountRow] = await db
      .select({ value: count() })
      .from(stockMovements)
      .innerJoin(merchants, eq(merchants.id, stockMovements.merchantId))
      .where(and(movementWhere, eq(stockMovements.status, 'completed')));

    return ok(c, {
      warehouses: Number(warehouseRow?.value ?? 0),
      locations: Number(locationRow?.value ?? 0),
      inventoryItems: Number(itemRow?.value ?? 0),
      totalStock: quantity(toNumber(stockRow?.value)),
      lowStock: Number(lowStockRow?.value ?? 0),
      expiringBatches: Number(expiringRow?.value ?? 0),
      openCounts: Number(openCountRow?.value ?? 0),
      completedMovements: Number(movementCountRow?.value ?? 0),
    });
  },
);

/* ----------------------------- Warehouses --------------------------- */

inventoryResourceRoutes.get(
  '/warehouses',
  requirePermission('inventory:read'),
  validate('query', listWarehousesSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [isNull(warehouses.deletedAt)];

    const scope = inventoryScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(warehouses.merchantId, query.merchantId));
    if (query.storeId) conditions.push(eq(warehouses.storeId, query.storeId));
    if (query.status) conditions.push(eq(warehouses.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(warehouses.code, term),
          ilike(warehouses.name, term),
          ilike(warehouses.city, term),
          ilike(merchants.businessName, term),
        ) as SQL,
      );
    }
    const where = and(...conditions);

    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: warehouses.id,
          merchantId: warehouses.merchantId,
          merchantName: merchants.businessName,
          merchantCode: merchants.code,
          storeId: warehouses.storeId,
          storeName: stores.name,
          code: warehouses.code,
          name: warehouses.name,
          address: warehouses.address,
          city: warehouses.city,
          province: warehouses.province,
          postalCode: warehouses.postalCode,
          phone: warehouses.phone,
          isDefault: warehouses.isDefault,
          status: warehouses.status,
          notes: warehouses.notes,
          createdAt: warehouses.createdAt,
          updatedAt: warehouses.updatedAt,
        })
        .from(warehouses)
        .innerJoin(merchants, eq(merchants.id, warehouses.merchantId))
        .leftJoin(stores, eq(stores.id, warehouses.storeId))
        .where(where)
        .orderBy(desc(warehouses.isDefault), asc(warehouses.name))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ value: count() })
        .from(warehouses)
        .innerJoin(merchants, eq(merchants.id, warehouses.merchantId))
        .where(where),
    ]);

    return paginated(c, rows, Number(totalRow?.value ?? 0), pagination);
  },
);

inventoryResourceRoutes.post(
  '/warehouses',
  requirePermission('inventory:manage'),
  validate('json', createWarehouseSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertMerchantAccess(body.merchantId, user, permissions, { manage: true });

    if (body.storeId) {
      const store = await db.query.stores.findFirst({
        where: and(
          eq(stores.id, body.storeId),
          eq(stores.merchantId, body.merchantId),
          isNull(stores.deletedAt),
        ),
      });
      if (!store) throw ApiError.badRequest('Toko tidak ditemukan untuk pedagang ini');
    }

    const code = body.code ?? generateCode('WH');
    const existing = await db.query.warehouses.findFirst({
      where: and(eq(warehouses.merchantId, body.merchantId), eq(warehouses.code, code)),
    });
    if (existing) throw ApiError.conflict('Kode gudang sudah digunakan');

    if (body.isDefault) {
      await db
        .update(warehouses)
        .set({ isDefault: false })
        .where(and(eq(warehouses.merchantId, body.merchantId), eq(warehouses.isDefault, true)));
    }

    const [created] = await db
      .insert(warehouses)
      .values({
        merchantId: body.merchantId,
        storeId: body.storeId ?? null,
        code,
        name: body.name,
        address: body.address ?? null,
        city: body.city ?? null,
        province: body.province ?? null,
        postalCode: body.postalCode ?? null,
        phone: body.phone ?? null,
        isDefault: body.isDefault,
        status: body.status,
        notes: body.notes ?? null,
      })
      .returning();

    await writeAuditLog({
      actorUserId: user.id,
      action: 'inventory.warehouse.create',
      entityType: 'warehouse',
      entityId: created!.id,
      newValues: { merchantId: body.merchantId, code },
      ipAddress: getClientIp(c),
    });

    return ok(c, created, 201);
  },
);

inventoryResourceRoutes.get(
  '/warehouses/:warehouseId',
  requirePermission('inventory:read'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { warehouse } = await getWarehouse(c.req.param('warehouseId'), user, permissions);

    const [merchant] = await db
      .select({ businessName: merchants.businessName, code: merchants.code })
      .from(merchants)
      .where(eq(merchants.id, warehouse.merchantId))
      .limit(1);
    const [store] = warehouse.storeId
      ? await db
          .select({ name: stores.name })
          .from(stores)
          .where(eq(stores.id, warehouse.storeId))
          .limit(1)
      : [];
    const locations = await db
      .select()
      .from(warehouseLocations)
      .where(
        and(
          eq(warehouseLocations.warehouseId, warehouse.id),
          isNull(warehouseLocations.deletedAt),
        ),
      )
      .orderBy(asc(warehouseLocations.name));

    return ok(c, {
      ...warehouse,
      merchantName: merchant?.businessName ?? null,
      merchantCode: merchant?.code ?? null,
      storeName: store?.name ?? null,
      locations,
    });
  },
);

inventoryResourceRoutes.patch(
  '/warehouses/:warehouseId',
  requirePermission('inventory:manage'),
  validate('json', updateWarehouseSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { warehouse } = await getWarehouse(c.req.param('warehouseId'), user, permissions, {
      manage: true,
    });

    if (body.storeId) {
      const store = await db.query.stores.findFirst({
        where: and(
          eq(stores.id, body.storeId),
          eq(stores.merchantId, warehouse.merchantId),
          isNull(stores.deletedAt),
        ),
      });
      if (!store) throw ApiError.badRequest('Toko tidak ditemukan untuk pedagang ini');
    }

    if (body.code && body.code !== warehouse.code) {
      const existing = await db.query.warehouses.findFirst({
        where: and(
          eq(warehouses.merchantId, warehouse.merchantId),
          eq(warehouses.code, body.code),
        ),
      });
      if (existing) throw ApiError.conflict('Kode gudang sudah digunakan');
    }

    if (body.isDefault) {
      await db
        .update(warehouses)
        .set({ isDefault: false })
        .where(
          and(
            eq(warehouses.merchantId, warehouse.merchantId),
            eq(warehouses.isDefault, true),
          ),
        );
    }

    const [updated] = await db
      .update(warehouses)
      .set({
        ...(body.storeId !== undefined ? { storeId: body.storeId ?? null } : {}),
        ...(body.code !== undefined ? { code: body.code } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.address !== undefined ? { address: body.address ?? null } : {}),
        ...(body.city !== undefined ? { city: body.city ?? null } : {}),
        ...(body.province !== undefined ? { province: body.province ?? null } : {}),
        ...(body.postalCode !== undefined ? { postalCode: body.postalCode ?? null } : {}),
        ...(body.phone !== undefined ? { phone: body.phone ?? null } : {}),
        ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.notes !== undefined ? { notes: body.notes ?? null } : {}),
      })
      .where(eq(warehouses.id, warehouse.id))
      .returning();

    await writeAuditLog({
      actorUserId: user.id,
      action: 'inventory.warehouse.update',
      entityType: 'warehouse',
      entityId: warehouse.id,
      newValues: { changes: body },
      ipAddress: getClientIp(c),
    });

    return ok(c, updated);
  },
);

inventoryResourceRoutes.delete(
  '/warehouses/:warehouseId',
  requirePermission('inventory:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { warehouse } = await getWarehouse(c.req.param('warehouseId'), user, permissions, {
      manage: true,
    });

    const [balanceRow] = await db
      .select({ value: count() })
      .from(stockBalances)
      .where(and(eq(stockBalances.warehouseId, warehouse.id), sql`${stockBalances.quantity} <> 0`));
    if (Number(balanceRow?.value ?? 0) > 0) {
      throw ApiError.badRequest('Gudang masih memiliki stok; kosongkan stok sebelum menghapus');
    }

    await db
      .update(warehouses)
      .set({ deletedAt: new Date(), status: 'inactive' })
      .where(eq(warehouses.id, warehouse.id));

    await writeAuditLog({
      actorUserId: user.id,
      action: 'inventory.warehouse.delete',
      entityType: 'warehouse',
      entityId: warehouse.id,
      newValues: { code: warehouse.code },
      ipAddress: getClientIp(c),
    });

    return ok(c, { id: warehouse.id, deleted: true });
  },
);

/* ------------------------------ Locations --------------------------- */

inventoryResourceRoutes.get(
  '/locations',
  requirePermission('inventory:read'),
  validate('query', listLocationsSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [isNull(warehouseLocations.deletedAt), isNull(warehouses.deletedAt)];

    const scope = inventoryScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.warehouseId) conditions.push(eq(warehouseLocations.warehouseId, query.warehouseId));
    if (query.type) conditions.push(eq(warehouseLocations.type, query.type));
    if (query.status) conditions.push(eq(warehouseLocations.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(warehouseLocations.code, term),
          ilike(warehouseLocations.name, term),
          ilike(warehouses.name, term),
        ) as SQL,
      );
    }
    const where = and(...conditions);

    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: warehouseLocations.id,
          warehouseId: warehouseLocations.warehouseId,
          warehouseName: warehouses.name,
          warehouseCode: warehouses.code,
          merchantId: warehouses.merchantId,
          merchantName: merchants.businessName,
          parentId: warehouseLocations.parentId,
          code: warehouseLocations.code,
          name: warehouseLocations.name,
          type: warehouseLocations.type,
          status: warehouseLocations.status,
          notes: warehouseLocations.notes,
          createdAt: warehouseLocations.createdAt,
          updatedAt: warehouseLocations.updatedAt,
        })
        .from(warehouseLocations)
        .innerJoin(warehouses, eq(warehouses.id, warehouseLocations.warehouseId))
        .innerJoin(merchants, eq(merchants.id, warehouses.merchantId))
        .where(where)
        .orderBy(asc(warehouses.name), asc(warehouseLocations.name))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ value: count() })
        .from(warehouseLocations)
        .innerJoin(warehouses, eq(warehouses.id, warehouseLocations.warehouseId))
        .innerJoin(merchants, eq(merchants.id, warehouses.merchantId))
        .where(where),
    ]);

    return paginated(c, rows, Number(totalRow?.value ?? 0), pagination);
  },
);

inventoryResourceRoutes.get(
  '/warehouses/:warehouseId/locations',
  requirePermission('inventory:read'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { warehouse } = await getWarehouse(c.req.param('warehouseId'), user, permissions);

    const rows = await db
      .select()
      .from(warehouseLocations)
      .where(
        and(
          eq(warehouseLocations.warehouseId, warehouse.id),
          isNull(warehouseLocations.deletedAt),
        ),
      )
      .orderBy(asc(warehouseLocations.name));

    return ok(c, rows);
  },
);

inventoryResourceRoutes.post(
  '/warehouses/:warehouseId/locations',
  requirePermission('inventory:manage'),
  validate('json', createLocationSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { warehouse } = await getWarehouse(c.req.param('warehouseId'), user, permissions, {
      manage: true,
    });

    if (body.parentId) {
      await assertLocationInWarehouse(warehouse.id, body.parentId);
    }

    const code = body.code ?? generateCode('LOC');
    const existing = await db.query.warehouseLocations.findFirst({
      where: and(
        eq(warehouseLocations.warehouseId, warehouse.id),
        eq(warehouseLocations.code, code),
      ),
    });
    if (existing) throw ApiError.conflict('Kode lokasi sudah digunakan di gudang ini');

    const [created] = await db
      .insert(warehouseLocations)
      .values({
        warehouseId: warehouse.id,
        parentId: body.parentId ?? null,
        code,
        name: body.name,
        type: body.type,
        status: body.status,
        notes: body.notes ?? null,
      })
      .returning();

    await writeAuditLog({
      actorUserId: user.id,
      action: 'inventory.location.create',
      entityType: 'warehouse_location',
      entityId: created!.id,
      newValues: { warehouseId: warehouse.id, code },
      ipAddress: getClientIp(c),
    });

    return ok(c, created, 201);
  },
);

inventoryResourceRoutes.patch(
  '/locations/:locationId',
  requirePermission('inventory:manage'),
  validate('json', updateLocationSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { location, warehouse } = await getWarehouseLocation(
      c.req.param('locationId'),
      user,
      permissions,
      { manage: true },
    );

    if (body.parentId) {
      if (body.parentId === location.id) throw ApiError.badRequest('Lokasi tidak boleh menjadi induk dirinya sendiri');
      await assertLocationInWarehouse(warehouse.id, body.parentId);
    }

    if (body.code && body.code !== location.code) {
      const existing = await db.query.warehouseLocations.findFirst({
        where: and(
          eq(warehouseLocations.warehouseId, warehouse.id),
          eq(warehouseLocations.code, body.code),
        ),
      });
      if (existing) throw ApiError.conflict('Kode lokasi sudah digunakan di gudang ini');
    }

    const [updated] = await db
      .update(warehouseLocations)
      .set({
        ...(body.parentId !== undefined ? { parentId: body.parentId ?? null } : {}),
        ...(body.code !== undefined ? { code: body.code } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.notes !== undefined ? { notes: body.notes ?? null } : {}),
      })
      .where(eq(warehouseLocations.id, location.id))
      .returning();

    await writeAuditLog({
      actorUserId: user.id,
      action: 'inventory.location.update',
      entityType: 'warehouse_location',
      entityId: location.id,
      newValues: { changes: body },
      ipAddress: getClientIp(c),
    });

    return ok(c, updated);
  },
);

inventoryResourceRoutes.delete(
  '/locations/:locationId',
  requirePermission('inventory:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { location } = await getWarehouseLocation(c.req.param('locationId'), user, permissions, {
      manage: true,
    });

    const [balanceRow] = await db
      .select({ value: count() })
      .from(stockBalances)
      .where(
        and(
          eq(stockBalances.warehouseLocationId, location.id),
          sql`${stockBalances.quantity} <> 0`,
        ),
      );
    if (Number(balanceRow?.value ?? 0) > 0) {
      throw ApiError.badRequest('Lokasi masih memiliki stok; kosongkan stok sebelum menghapus');
    }

    await db
      .update(warehouseLocations)
      .set({ deletedAt: new Date(), status: 'inactive' })
      .where(eq(warehouseLocations.id, location.id));

    await writeAuditLog({
      actorUserId: user.id,
      action: 'inventory.location.delete',
      entityType: 'warehouse_location',
      entityId: location.id,
      newValues: { code: location.code },
      ipAddress: getClientIp(c),
    });

    return ok(c, { id: location.id, deleted: true });
  },
);

/* ------------------------------- Items ------------------------------ */

inventoryResourceRoutes.get(
  '/items',
  requirePermission('inventory:read'),
  validate('query', listItemsSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [isNull(inventoryItems.deletedAt)];

    const scope = inventoryScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(inventoryItems.merchantId, query.merchantId));
    if (query.productId) conditions.push(eq(inventoryItems.productId, query.productId));
    if (query.status) conditions.push(eq(inventoryItems.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(products.name, term),
          ilike(productSkus.skuCode, term),
          ilike(merchants.businessName, term),
        ) as SQL,
      );
    }
    const where = and(...conditions);

    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: inventoryItems.id,
          merchantId: inventoryItems.merchantId,
          merchantName: merchants.businessName,
          merchantCode: merchants.code,
          productId: inventoryItems.productId,
          productName: products.name,
          skuId: inventoryItems.skuId,
          skuCode: productSkus.skuCode,
          barcode: productSkus.barcode,
          status: inventoryItems.status,
          minStock: inventoryItems.minStock,
          maxStock: inventoryItems.maxStock,
          reorderPoint: inventoryItems.reorderPoint,
          unitCost: inventoryItems.unitCost,
          trackBatches: inventoryItems.trackBatches,
          trackExpiry: inventoryItems.trackExpiry,
          notes: inventoryItems.notes,
          totalStock: sql<string>`coalesce((
            select sum(sb.quantity) from inventory.stock_balances sb
            where sb.inventory_item_id = ${inventoryItems.id}
          ), 0)`,
          createdAt: inventoryItems.createdAt,
          updatedAt: inventoryItems.updatedAt,
        })
        .from(inventoryItems)
        .innerJoin(merchants, eq(merchants.id, inventoryItems.merchantId))
        .innerJoin(products, eq(products.id, inventoryItems.productId))
        .innerJoin(productSkus, eq(productSkus.id, inventoryItems.skuId))
        .where(where)
        .orderBy(asc(products.name), asc(productSkus.skuCode))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ value: count() })
        .from(inventoryItems)
        .innerJoin(merchants, eq(merchants.id, inventoryItems.merchantId))
        .innerJoin(products, eq(products.id, inventoryItems.productId))
        .innerJoin(productSkus, eq(productSkus.id, inventoryItems.skuId))
        .where(where),
    ]);

    return paginated(c, rows, Number(totalRow?.value ?? 0), pagination);
  },
);

inventoryResourceRoutes.post(
  '/items',
  requirePermission('inventory:manage'),
  validate('json', createItemSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertMerchantAccess(body.merchantId, user, permissions, { manage: true });

    const [product] = await db
      .select({ id: products.id, merchantId: products.merchantId, name: products.name })
      .from(products)
      .where(
        and(
          eq(products.id, body.productId),
          eq(products.merchantId, body.merchantId),
          isNull(products.deletedAt),
        ),
      )
      .limit(1);
    if (!product) throw ApiError.badRequest('Produk tidak ditemukan untuk pedagang ini');

    const [sku] = await db
      .select({ id: productSkus.id, productId: productSkus.productId, costPrice: productSkus.costPrice })
      .from(productSkus)
      .where(and(eq(productSkus.id, body.skuId), eq(productSkus.productId, body.productId)))
      .limit(1);
    if (!sku) throw ApiError.badRequest('SKU tidak sesuai dengan produk');

    const existing = await db.query.inventoryItems.findFirst({
      where: and(
        eq(inventoryItems.merchantId, body.merchantId),
        eq(inventoryItems.skuId, body.skuId),
      ),
    });
    if (existing) throw ApiError.conflict('SKU sudah terdaftar sebagai item persediaan');

    const [created] = await db
      .insert(inventoryItems)
      .values({
        merchantId: body.merchantId,
        productId: body.productId,
        skuId: body.skuId,
        status: body.status,
        minStock: quantity(Number(body.minStock)),
        maxStock: body.maxStock ? quantity(Number(body.maxStock)) : null,
        reorderPoint: body.reorderPoint ? quantity(Number(body.reorderPoint)) : null,
        unitCost: money(Number(body.unitCost || sku.costPrice || 0)),
        trackBatches: body.trackBatches,
        trackExpiry: body.trackExpiry,
        notes: body.notes ?? null,
        createdBy: user.id,
      })
      .returning();

    await writeAuditLog({
      actorUserId: user.id,
      action: 'inventory.item.create',
      entityType: 'inventory_item',
      entityId: created!.id,
      newValues: { merchantId: body.merchantId, skuId: body.skuId },
      ipAddress: getClientIp(c),
    });

    return ok(c, created, 201);
  },
);

inventoryResourceRoutes.get(
  '/items/:itemId',
  requirePermission('inventory:read'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { item } = await getInventoryItem(c.req.param('itemId'), user, permissions);

    const balances = await db
      .select({
        id: stockBalances.id,
        warehouseId: stockBalances.warehouseId,
        warehouseName: warehouses.name,
        warehouseLocationId: stockBalances.warehouseLocationId,
        locationName: warehouseLocations.name,
        quantity: stockBalances.quantity,
        reservedQuantity: stockBalances.reservedQuantity,
        updatedAt: stockBalances.updatedAt,
      })
      .from(stockBalances)
      .innerJoin(warehouses, eq(warehouses.id, stockBalances.warehouseId))
      .innerJoin(warehouseLocations, eq(warehouseLocations.id, stockBalances.warehouseLocationId))
      .where(eq(stockBalances.inventoryItemId, item.id));

    return ok(c, { ...item, balances });
  },
);

inventoryResourceRoutes.patch(
  '/items/:itemId',
  requirePermission('inventory:manage'),
  validate('json', updateItemSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { item } = await getInventoryItem(c.req.param('itemId'), user, permissions, {
      manage: true,
    });

    const [updated] = await db
      .update(inventoryItems)
      .set({
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.minStock !== undefined ? { minStock: quantity(Number(body.minStock)) } : {}),
        ...(body.maxStock !== undefined
          ? { maxStock: body.maxStock ? quantity(Number(body.maxStock)) : null }
          : {}),
        ...(body.reorderPoint !== undefined
          ? { reorderPoint: body.reorderPoint ? quantity(Number(body.reorderPoint)) : null }
          : {}),
        ...(body.unitCost !== undefined ? { unitCost: money(Number(body.unitCost)) } : {}),
        ...(body.trackBatches !== undefined ? { trackBatches: body.trackBatches } : {}),
        ...(body.trackExpiry !== undefined ? { trackExpiry: body.trackExpiry } : {}),
        ...(body.notes !== undefined ? { notes: body.notes ?? null } : {}),
      })
      .where(eq(inventoryItems.id, item.id))
      .returning();

    await writeAuditLog({
      actorUserId: user.id,
      action: 'inventory.item.update',
      entityType: 'inventory_item',
      entityId: item.id,
      newValues: { changes: body },
      ipAddress: getClientIp(c),
    });

    return ok(c, updated);
  },
);

inventoryResourceRoutes.delete(
  '/items/:itemId',
  requirePermission('inventory:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { item } = await getInventoryItem(c.req.param('itemId'), user, permissions, {
      manage: true,
    });

    const [balanceRow] = await db
      .select({ value: count() })
      .from(stockBalances)
      .where(
        and(
          eq(stockBalances.inventoryItemId, item.id),
          sql`${stockBalances.quantity} <> 0`,
        ),
      );
    if (Number(balanceRow?.value ?? 0) > 0) {
      throw ApiError.badRequest('Item masih memiliki stok; kosongkan stok sebelum menghapus');
    }

    await db
      .update(inventoryItems)
      .set({ deletedAt: new Date(), status: 'inactive' })
      .where(eq(inventoryItems.id, item.id));

    await writeAuditLog({
      actorUserId: user.id,
      action: 'inventory.item.delete',
      entityType: 'inventory_item',
      entityId: item.id,
      newValues: { skuId: item.skuId },
      ipAddress: getClientIp(c),
    });

    return ok(c, { id: item.id, deleted: true });
  },
);

/* ----------------------------- Balances ----------------------------- */

inventoryResourceRoutes.get(
  '/balances',
  requirePermission('inventory:read'),
  validate('query', listBalancesSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];

    const scope = inventoryScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(stockBalances.merchantId, query.merchantId));
    if (query.warehouseId) conditions.push(eq(stockBalances.warehouseId, query.warehouseId));
    if (query.locationId) conditions.push(eq(stockBalances.warehouseLocationId, query.locationId));
    if (query.inventoryItemId) conditions.push(eq(stockBalances.inventoryItemId, query.inventoryItemId));
    if (query.lowStock === 'true') conditions.push(lte(stockBalances.quantity, inventoryItems.minStock));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(products.name, term),
          ilike(productSkus.skuCode, term),
          ilike(warehouses.name, term),
          ilike(warehouseLocations.name, term),
        ) as SQL,
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const base = db
      .select({
        id: stockBalances.id,
        merchantId: stockBalances.merchantId,
        merchantName: merchants.businessName,
        warehouseId: stockBalances.warehouseId,
        warehouseName: warehouses.name,
        warehouseLocationId: stockBalances.warehouseLocationId,
        locationName: warehouseLocations.name,
        inventoryItemId: stockBalances.inventoryItemId,
        productName: products.name,
        skuCode: productSkus.skuCode,
        quantity: stockBalances.quantity,
        reservedQuantity: stockBalances.reservedQuantity,
        minStock: inventoryItems.minStock,
        maxStock: inventoryItems.maxStock,
        unitCost: inventoryItems.unitCost,
        lastMovementAt: stockBalances.lastMovementAt,
        updatedAt: stockBalances.updatedAt,
      })
      .from(stockBalances)
      .innerJoin(merchants, eq(merchants.id, stockBalances.merchantId))
      .innerJoin(warehouses, eq(warehouses.id, stockBalances.warehouseId))
      .innerJoin(warehouseLocations, eq(warehouseLocations.id, stockBalances.warehouseLocationId))
      .innerJoin(inventoryItems, eq(inventoryItems.id, stockBalances.inventoryItemId))
      .innerJoin(products, eq(products.id, inventoryItems.productId))
      .innerJoin(productSkus, eq(productSkus.id, inventoryItems.skuId));

    const [rows, [totalRow]] = await Promise.all([
      base
        .where(where)
        .orderBy(asc(products.name), asc(warehouses.name))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ value: count() })
        .from(stockBalances)
        .innerJoin(merchants, eq(merchants.id, stockBalances.merchantId))
        .innerJoin(warehouses, eq(warehouses.id, stockBalances.warehouseId))
        .innerJoin(warehouseLocations, eq(warehouseLocations.id, stockBalances.warehouseLocationId))
        .innerJoin(inventoryItems, eq(inventoryItems.id, stockBalances.inventoryItemId))
        .innerJoin(products, eq(products.id, inventoryItems.productId))
        .innerJoin(productSkus, eq(productSkus.id, inventoryItems.skuId))
        .where(where),
    ]);

    const data = rows.map((row) => {
      const qty = toNumber(row.quantity);
      const min = toNumber(row.minStock);
      return {
        ...row,
        stockStatus: qty <= 0 ? 'out' : qty <= min ? 'low' : 'ok',
      };
    });

    return paginated(c, data, Number(totalRow?.value ?? 0), pagination);
  },
);

/* ------------------------------ Batches ----------------------------- */

inventoryResourceRoutes.get(
  '/batches',
  requirePermission('inventory:read'),
  validate('query', listBatchesSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];

    const scope = inventoryScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(inventoryBatches.merchantId, query.merchantId));
    if (query.warehouseId) conditions.push(eq(inventoryBatches.warehouseId, query.warehouseId));
    if (query.inventoryItemId) conditions.push(eq(inventoryBatches.inventoryItemId, query.inventoryItemId));
    if (query.status) conditions.push(eq(inventoryBatches.status, query.status));
    if (query.expiry === 'expired') {
      conditions.push(sql`${inventoryBatches.expiryDate} < current_date`);
    } else if (query.expiry === 'expiring') {
      conditions.push(sql`${inventoryBatches.expiryDate} between current_date and current_date + interval '30 days'`);
    } else if (query.expiry === 'safe') {
      conditions.push(sql`(${inventoryBatches.expiryDate} is null or ${inventoryBatches.expiryDate} > current_date + interval '30 days')`);
    }
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(inventoryBatches.batchNumber, term),
          ilike(products.name, term),
          ilike(productSkus.skuCode, term),
          ilike(warehouses.name, term),
        ) as SQL,
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: inventoryBatches.id,
          merchantId: inventoryBatches.merchantId,
          merchantName: merchants.businessName,
          inventoryItemId: inventoryBatches.inventoryItemId,
          productName: products.name,
          skuCode: productSkus.skuCode,
          warehouseId: inventoryBatches.warehouseId,
          warehouseName: warehouses.name,
          warehouseLocationId: inventoryBatches.warehouseLocationId,
          locationName: warehouseLocations.name,
          batchNumber: inventoryBatches.batchNumber,
          manufactureDate: inventoryBatches.manufactureDate,
          expiryDate: inventoryBatches.expiryDate,
          quantity: inventoryBatches.quantity,
          reservedQuantity: inventoryBatches.reservedQuantity,
          unitCost: inventoryBatches.unitCost,
          status: inventoryBatches.status,
          supplierReference: inventoryBatches.supplierReference,
          notes: inventoryBatches.notes,
          createdAt: inventoryBatches.createdAt,
          updatedAt: inventoryBatches.updatedAt,
        })
        .from(inventoryBatches)
        .innerJoin(merchants, eq(merchants.id, inventoryBatches.merchantId))
        .innerJoin(inventoryItems, eq(inventoryItems.id, inventoryBatches.inventoryItemId))
        .innerJoin(products, eq(products.id, inventoryItems.productId))
        .innerJoin(productSkus, eq(productSkus.id, inventoryItems.skuId))
        .innerJoin(warehouses, eq(warehouses.id, inventoryBatches.warehouseId))
        .innerJoin(warehouseLocations, eq(warehouseLocations.id, inventoryBatches.warehouseLocationId))
        .where(where)
        .orderBy(asc(inventoryBatches.expiryDate), asc(inventoryBatches.batchNumber))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ value: count() })
        .from(inventoryBatches)
        .innerJoin(merchants, eq(merchants.id, inventoryBatches.merchantId))
        .innerJoin(inventoryItems, eq(inventoryItems.id, inventoryBatches.inventoryItemId))
        .innerJoin(products, eq(products.id, inventoryItems.productId))
        .innerJoin(productSkus, eq(productSkus.id, inventoryItems.skuId))
        .innerJoin(warehouses, eq(warehouses.id, inventoryBatches.warehouseId))
        .innerJoin(warehouseLocations, eq(warehouseLocations.id, inventoryBatches.warehouseLocationId))
        .where(where),
    ]);

    const data = rows.map((row) => {
      const expiry = row.expiryDate ? new Date(`${row.expiryDate}T00:00:00`) : null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const days = expiry ? Math.ceil((expiry.getTime() - today.getTime()) / 86400000) : null;
      return {
        ...row,
        daysToExpiry: days,
        expiryStatus:
          days === null ? 'none' : days < 0 ? 'expired' : days <= 30 ? 'expiring' : 'safe',
      };
    });

    return paginated(c, data, Number(totalRow?.value ?? 0), pagination);
  },
);

inventoryResourceRoutes.patch(
  '/batches/:batchId',
  requirePermission('inventory:manage'),
  validate('json', updateBatchSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { batch } = await getBatch(c.req.param('batchId'), user, permissions, {
      manage: true,
    });

    const [updated] = await db
      .update(inventoryBatches)
      .set({
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.manufactureDate !== undefined
          ? { manufactureDate: body.manufactureDate ?? null }
          : {}),
        ...(body.expiryDate !== undefined ? { expiryDate: body.expiryDate ?? null } : {}),
        ...(body.supplierReference !== undefined
          ? { supplierReference: body.supplierReference ?? null }
          : {}),
        ...(body.notes !== undefined ? { notes: body.notes ?? null } : {}),
      })
      .where(eq(inventoryBatches.id, batch.id))
      .returning();

    await writeAuditLog({
      actorUserId: user.id,
      action: 'inventory.batch.update',
      entityType: 'inventory_batch',
      entityId: batch.id,
      newValues: { changes: body },
      ipAddress: getClientIp(c),
    });

    return ok(c, updated);
  },
);
