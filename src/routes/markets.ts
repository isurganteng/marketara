import { and, count, eq, ilike, isNull, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db';
import {
  marketBlocks,
  marketFacilities,
  marketUnits,
  marketZones,
  markets,
  merchants,
  occupancyRecords,
} from '../db/schema';
import { assertMerchantAccess, assertOrganizationAccess, isPlatformAdmin } from '../lib/access';
import { writeAuditLog } from '../lib/audit';
import { ApiError } from '../lib/errors';
import { getPagination, ok, paginated } from '../lib/http';
import type { AppEnv } from '../lib/app-env';
import { generateCode, uniqueSlug } from '../lib/slug';
import { validate } from '../lib/validator';
import { requireAuth, requirePermission } from '../middleware/auth';
import { getClientIp } from '../services/auth';

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD');
const numericString = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine((value) => value === '' || !Number.isNaN(Number(value)), 'Harus berupa angka');

const marketStatusSchema = z.enum([
  'planned',
  'active',
  'inactive',
  'maintenance',
  'closed',
]);

const createMarketSchema = z.object({
  code: z.string().trim().min(2).max(32).optional(),
  name: z.string().trim().min(2).max(255),
  organizationId: z.uuid().nullable().optional(),
  description: z.string().trim().max(5000).optional(),
  address: z.string().trim().max(2000).optional(),
  city: z.string().trim().max(128).optional(),
  province: z.string().trim().max(128).optional(),
  postalCode: z.string().trim().max(16).optional(),
  latitude: numericString.optional(),
  longitude: numericString.optional(),
  totalArea: numericString.optional(),
  status: marketStatusSchema.optional(),
  openedAt: dateString.optional(),
});

const updateMarketSchema = createMarketSchema
  .omit({ organizationId: true, code: true })
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Minimal satu field harus diisi',
  });

const listMarketsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  city: z.string().trim().max(128).optional(),
  status: marketStatusSchema.optional(),
});

const zoneSchema = z.object({
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(2).max(255),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(['active', 'inactive', 'maintenance']).optional(),
});

const updateZoneSchema = zoneSchema
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Minimal satu field harus diisi',
  });

const blockSchema = z.object({
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(2).max(255),
  floor: z.string().trim().max(32).optional(),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(['active', 'inactive', 'maintenance']).optional(),
});

const updateBlockSchema = blockSchema
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Minimal satu field harus diisi',
  });

const unitTypeSchema = z.enum(['kios', 'lapak', 'toko', 'gudang', 'lainnya']);
const unitStatusSchema = z.enum([
  'available',
  'occupied',
  'reserved',
  'maintenance',
  'inactive',
]);

const createUnitSchema = z.object({
  code: z.string().trim().min(1).max(32),
  unitNumber: z.string().trim().max(32).optional(),
  type: unitTypeSchema.optional(),
  status: unitStatusSchema.optional(),
  areaSize: numericString.optional(),
  monthlyFee: numericString.optional(),
  description: z.string().trim().max(2000).optional(),
  latitude: numericString.optional(),
  longitude: numericString.optional(),
});

const updateUnitSchema = createUnitSchema
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Minimal satu field harus diisi',
  });

const listUnitsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  zoneId: z.uuid().optional(),
  blockId: z.uuid().optional(),
  status: unitStatusSchema.optional(),
  type: unitTypeSchema.optional(),
  search: z.string().trim().max(100).optional(),
});

const createOccupancySchema = z.object({
  merchantId: z.uuid(),
  startDate: dateString,
  endDate: dateString.optional(),
  monthlyFee: numericString.optional(),
  agreementNumber: z.string().trim().max(128).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const endOccupancySchema = z.object({
  endDate: dateString.optional(),
  notes: z.string().trim().max(2000).optional(),
});

const facilitySchema = z.object({
  name: z.string().trim().min(2).max(255),
  type: z.string().trim().max(64).optional(),
  locationDescription: z.string().trim().max(1000).optional(),
  condition: z.string().trim().max(32).optional(),
  isAvailable: z.boolean().optional(),
});

export const marketRoutes = new Hono<AppEnv>();

marketRoutes.use('*', requireAuth);

marketRoutes.get('/', requirePermission('market:read'), validate('query', listMarketsSchema), async (c) => {
  const query = c.req.valid('query');
  const pagination = getPagination(query);

  const conditions = [isNull(markets.deletedAt)];
  if (query.status) conditions.push(eq(markets.status, query.status));
  if (query.city) conditions.push(ilike(markets.city, `%${query.city}%`));
  if (query.search) {
    const term = `%${query.search}%`;
    const searchCondition = or(
      ilike(markets.name, term),
      ilike(markets.code, term),
      ilike(markets.city, term),
    );
    if (searchCondition) conditions.push(searchCondition);
  }
  const where = and(...conditions);

  const [rows, [{ value } = { value: 0 }]] = await Promise.all([
    db
      .select()
      .from(markets)
      .where(where)
      .orderBy(markets.name)
      .limit(pagination.limit)
      .offset(pagination.offset),
    db.select({ value: count() }).from(markets).where(where),
  ]);

  return paginated(c, rows, Number(value), pagination);
});

marketRoutes.post('/', requirePermission('market:write'), validate('json', createMarketSchema), async (c) => {
  const body = c.req.valid('json');
  const user = c.get('user');

  if (body.organizationId) {
    await assertOrganizationAccess(body.organizationId, user, c.get('permissions'), {
      manage: true,
    });
  }

  const [market] = await db
    .insert(markets)
    .values({
      code: body.code ?? generateCode('MKT'),
      name: body.name,
      slug: uniqueSlug(body.name),
      organizationId: body.organizationId ?? null,
      description: body.description ?? null,
      address: body.address ?? null,
      city: body.city ?? null,
      province: body.province ?? null,
      postalCode: body.postalCode ?? null,
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      totalArea: body.totalArea ?? null,
      status: body.status ?? 'planned',
      openedAt: body.openedAt ?? null,
    })
    .returning();

  if (!market) throw ApiError.internal('Failed to create market');

  await writeAuditLog({
    actorUserId: user.id,
    action: 'market.create',
    entityType: 'market',
    entityId: market.id,
    newValues: { name: market.name, code: market.code },
    ipAddress: getClientIp(c),
    userAgent: c.req.header('user-agent') ?? null,
  });

  return c.json({ success: true as const, data: market }, 201);
});

marketRoutes.get('/:marketId', requirePermission('market:read'), async (c) => {
  const market = await db.query.markets.findFirst({
    where: and(eq(markets.id, c.req.param('marketId')), isNull(markets.deletedAt)),
  });
  if (!market) throw ApiError.notFound('Market not found');

  const [zones, facilities, unitStats] = await Promise.all([
    db.select().from(marketZones).where(eq(marketZones.marketId, market.id)),
    db.select().from(marketFacilities).where(eq(marketFacilities.marketId, market.id)),
    db
      .select({ status: marketUnits.status, total: count() })
      .from(marketUnits)
      .innerJoin(marketBlocks, eq(marketBlocks.id, marketUnits.blockId))
      .innerJoin(marketZones, eq(marketZones.id, marketBlocks.zoneId))
      .where(eq(marketZones.marketId, market.id))
      .groupBy(marketUnits.status),
  ]);

  return ok(c, {
    ...market,
    zones,
    facilities,
    unitStats: unitStats.map((row) => ({ status: row.status, total: Number(row.total) })),
  });
});

marketRoutes.patch(
  '/:marketId',
  requirePermission('market:write'),
  validate('json', updateMarketSchema),
  async (c) => {
    const marketId = c.req.param('marketId');
    const existing = await db.query.markets.findFirst({
      where: and(eq(markets.id, marketId), isNull(markets.deletedAt)),
    });
    if (!existing) throw ApiError.notFound('Market not found');

    const body = c.req.valid('json');
    const [updated] = await db
      .update(markets)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.address !== undefined ? { address: body.address } : {}),
        ...(body.city !== undefined ? { city: body.city } : {}),
        ...(body.province !== undefined ? { province: body.province } : {}),
        ...(body.postalCode !== undefined ? { postalCode: body.postalCode } : {}),
        ...(body.latitude !== undefined ? { latitude: body.latitude } : {}),
        ...(body.longitude !== undefined ? { longitude: body.longitude } : {}),
        ...(body.totalArea !== undefined ? { totalArea: body.totalArea } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.openedAt !== undefined ? { openedAt: body.openedAt } : {}),
      })
      .where(eq(markets.id, marketId))
      .returning();

    await writeAuditLog({
      actorUserId: c.get('user').id,
      action: 'market.update',
      entityType: 'market',
      entityId: marketId,
      oldValues: { status: existing.status, name: existing.name },
      newValues: body as Record<string, unknown>,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });

    return ok(c, updated);
  },
);

marketRoutes.delete('/:marketId', requirePermission('market:write'), async (c) => {
  const marketId = c.req.param('marketId');
  const [archived] = await db
    .update(markets)
    .set({ deletedAt: new Date(), status: 'closed' })
    .where(and(eq(markets.id, marketId), isNull(markets.deletedAt)))
    .returning({ id: markets.id });
  if (!archived) throw ApiError.notFound('Market not found');

  await writeAuditLog({
    actorUserId: c.get('user').id,
    action: 'market.archive',
    entityType: 'market',
    entityId: marketId,
    ipAddress: getClientIp(c),
    userAgent: c.req.header('user-agent') ?? null,
  });

  return ok(c, { message: 'Market archived' });
});

/* ------------------------------- Zones ------------------------------ */

marketRoutes.get('/:marketId/zones', requirePermission('market:read'), async (c) => {
  const zones = await db
    .select()
    .from(marketZones)
    .where(eq(marketZones.marketId, c.req.param('marketId')))
    .orderBy(marketZones.name);
  return ok(c, zones);
});

marketRoutes.post(
  '/:marketId/zones',
  requirePermission('market:write'),
  validate('json', zoneSchema),
  async (c) => {
    const marketId = c.req.param('marketId');
    const market = await db.query.markets.findFirst({
      where: and(eq(markets.id, marketId), isNull(markets.deletedAt)),
      columns: { id: true },
    });
    if (!market) throw ApiError.notFound('Market not found');

    const body = c.req.valid('json');
    const [zone] = await db
      .insert(marketZones)
      .values({
        marketId,
        code: body.code,
        name: body.name,
        description: body.description ?? null,
        status: body.status ?? 'active',
      })
      .returning();

    return c.json({ success: true as const, data: zone }, 201);
  },
);

marketRoutes.patch(
  '/zones/:zoneId',
  requirePermission('market:write'),
  validate('json', updateZoneSchema),
  async (c) => {
    const [updated] = await db
      .update(marketZones)
      .set(c.req.valid('json'))
      .where(eq(marketZones.id, c.req.param('zoneId')))
      .returning();
    if (!updated) throw ApiError.notFound('Zone not found');
    return ok(c, updated);
  },
);

/* ------------------------------- Blocks ----------------------------- */

marketRoutes.get('/zones/:zoneId/blocks', requirePermission('market:read'), async (c) => {
  const blocks = await db
    .select()
    .from(marketBlocks)
    .where(eq(marketBlocks.zoneId, c.req.param('zoneId')))
    .orderBy(marketBlocks.name);
  return ok(c, blocks);
});

marketRoutes.post(
  '/zones/:zoneId/blocks',
  requirePermission('market:write'),
  validate('json', blockSchema),
  async (c) => {
    const zoneId = c.req.param('zoneId');
    const zone = await db.query.marketZones.findFirst({
      where: eq(marketZones.id, zoneId),
      columns: { id: true },
    });
    if (!zone) throw ApiError.notFound('Zone not found');

    const body = c.req.valid('json');
    const [block] = await db
      .insert(marketBlocks)
      .values({
        zoneId,
        code: body.code,
        name: body.name,
        floor: body.floor ?? null,
        description: body.description ?? null,
        status: body.status ?? 'active',
      })
      .returning();

    return c.json({ success: true as const, data: block }, 201);
  },
);

marketRoutes.patch(
  '/blocks/:blockId',
  requirePermission('market:write'),
  validate('json', updateBlockSchema),
  async (c) => {
    const [updated] = await db
      .update(marketBlocks)
      .set(c.req.valid('json'))
      .where(eq(marketBlocks.id, c.req.param('blockId')))
      .returning();
    if (!updated) throw ApiError.notFound('Block not found');
    return ok(c, updated);
  },
);

/* ------------------------------- Units ------------------------------ */

marketRoutes.get(
  '/:marketId/units',
  requirePermission('market:read'),
  validate('query', listUnitsSchema),
  async (c) => {
    const marketId = c.req.param('marketId');
    const query = c.req.valid('query');
    const pagination = getPagination(query);

    const conditions = [eq(marketZones.marketId, marketId)];
    if (query.zoneId) conditions.push(eq(marketZones.id, query.zoneId));
    if (query.blockId) conditions.push(eq(marketBlocks.id, query.blockId));
    if (query.status) conditions.push(eq(marketUnits.status, query.status));
    if (query.type) conditions.push(eq(marketUnits.type, query.type));
    if (query.search) {
      const term = `%${query.search}%`;
      const searchCondition = or(ilike(marketUnits.code, term), ilike(marketUnits.unitNumber, term));
      if (searchCondition) conditions.push(searchCondition);
    }
    const where = and(...conditions);

    const baseQuery = db
      .select({
        id: marketUnits.id,
        code: marketUnits.code,
        unitNumber: marketUnits.unitNumber,
        type: marketUnits.type,
        status: marketUnits.status,
        areaSize: marketUnits.areaSize,
        monthlyFee: marketUnits.monthlyFee,
        blockId: marketBlocks.id,
        blockName: marketBlocks.name,
        zoneId: marketZones.id,
        zoneName: marketZones.name,
        createdAt: marketUnits.createdAt,
      })
      .from(marketUnits)
      .innerJoin(marketBlocks, eq(marketBlocks.id, marketUnits.blockId))
      .innerJoin(marketZones, eq(marketZones.id, marketBlocks.zoneId));

    const [rows, [{ value } = { value: 0 }]] = await Promise.all([
      baseQuery
        .where(where)
        .orderBy(marketZones.name, marketBlocks.name, marketUnits.code)
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ value: count() })
        .from(marketUnits)
        .innerJoin(marketBlocks, eq(marketBlocks.id, marketUnits.blockId))
        .innerJoin(marketZones, eq(marketZones.id, marketBlocks.zoneId))
        .where(where),
    ]);

    return paginated(c, rows, Number(value), pagination);
  },
);

marketRoutes.get('/units/:unitId', requirePermission('market:read'), async (c) => {
  const unitId = c.req.param('unitId');
  const unit = await db.query.marketUnits.findFirst({
    where: eq(marketUnits.id, unitId),
  });
  if (!unit) throw ApiError.notFound('Unit not found');

  const occupancy = await db.query.occupancyRecords.findFirst({
    where: and(eq(occupancyRecords.marketUnitId, unitId), eq(occupancyRecords.status, 'active')),
  });

  return ok(c, { ...unit, activeOccupancy: occupancy ?? null });
});

marketRoutes.post(
  '/blocks/:blockId/units',
  requirePermission('market:write'),
  validate('json', createUnitSchema),
  async (c) => {
    const blockId = c.req.param('blockId');
    const block = await db.query.marketBlocks.findFirst({
      where: eq(marketBlocks.id, blockId),
      columns: { id: true },
    });
    if (!block) throw ApiError.notFound('Block not found');

    const body = c.req.valid('json');
    const [unit] = await db
      .insert(marketUnits)
      .values({
        blockId,
        code: body.code,
        unitNumber: body.unitNumber ?? null,
        type: body.type ?? 'kios',
        status: body.status ?? 'available',
        areaSize: body.areaSize ?? null,
        monthlyFee: body.monthlyFee ?? null,
        description: body.description ?? null,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
      })
      .returning();

    return c.json({ success: true as const, data: unit }, 201);
  },
);

marketRoutes.patch(
  '/units/:unitId',
  requirePermission('market:write'),
  validate('json', updateUnitSchema),
  async (c) => {
    const unitId = c.req.param('unitId');
    const body = c.req.valid('json');

    if (body.status === 'available') {
      const active = await db.query.occupancyRecords.findFirst({
        where: and(
          eq(occupancyRecords.marketUnitId, unitId),
          eq(occupancyRecords.status, 'active'),
        ),
        columns: { id: true },
      });
      if (active) {
        throw ApiError.badRequest('Unit still has an active occupancy. End it first.');
      }
    }

    const [updated] = await db
      .update(marketUnits)
      .set({
        ...(body.code !== undefined ? { code: body.code } : {}),
        ...(body.unitNumber !== undefined ? { unitNumber: body.unitNumber } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.areaSize !== undefined ? { areaSize: body.areaSize } : {}),
        ...(body.monthlyFee !== undefined ? { monthlyFee: body.monthlyFee } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.latitude !== undefined ? { latitude: body.latitude } : {}),
        ...(body.longitude !== undefined ? { longitude: body.longitude } : {}),
      })
      .where(eq(marketUnits.id, unitId))
      .returning();

    if (!updated) throw ApiError.notFound('Unit not found');
    return ok(c, updated);
  },
);

/* ----------------------------- Occupancy ---------------------------- */

marketRoutes.post(
  '/units/:unitId/occupancy',
  requirePermission('occupancy:manage'),
  validate('json', createOccupancySchema),
  async (c) => {
    const unitId = c.req.param('unitId');
    const body = c.req.valid('json');
    const user = c.get('user');

    const unit = await db.query.marketUnits.findFirst({
      where: eq(marketUnits.id, unitId),
    });
    if (!unit) throw ApiError.notFound('Unit not found');
    if (unit.status === 'maintenance' || unit.status === 'inactive') {
      throw ApiError.badRequest(`Unit is ${unit.status} and cannot be occupied`);
    }

    // Non-admin hanya boleh menempatkan merchant yang ia kelola.
    if (!isPlatformAdmin(c.get('permissions'))) {
      await assertMerchantAccess(body.merchantId, user, c.get('permissions'), { manage: true });
    }

    const merchant = await db.query.merchants.findFirst({
      where: and(eq(merchants.id, body.merchantId), isNull(merchants.deletedAt)),
      columns: { id: true, businessName: true },
    });
    if (!merchant) throw ApiError.notFound('Merchant not found');

    const result = await db.transaction(async (tx) => {
      const [occupancy] = await tx
        .insert(occupancyRecords)
        .values({
          marketUnitId: unitId,
          merchantId: body.merchantId,
          startDate: body.startDate,
          endDate: body.endDate ?? null,
          monthlyFee: body.monthlyFee ?? unit.monthlyFee ?? null,
          agreementNumber: body.agreementNumber ?? null,
          notes: body.notes ?? null,
          createdBy: user.id,
        })
        .returning();

      await tx
        .update(marketUnits)
        .set({ status: 'occupied' })
        .where(eq(marketUnits.id, unitId));

      return occupancy;
    });

    await writeAuditLog({
      actorUserId: user.id,
      action: 'occupancy.create',
      entityType: 'occupancy_record',
      entityId: result?.id,
      newValues: { marketUnitId: unitId, merchantId: body.merchantId },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });

    return c.json({ success: true as const, data: result }, 201);
  },
);

marketRoutes.patch(
  '/occupancies/:occupancyId/end',
  requirePermission('occupancy:manage'),
  validate('json', endOccupancySchema),
  async (c) => {
    const occupancyId = c.req.param('occupancyId');
    const body = c.req.valid('json');

    const occupancy = await db.query.occupancyRecords.findFirst({
      where: eq(occupancyRecords.id, occupancyId),
    });
    if (!occupancy) throw ApiError.notFound('Occupancy not found');
    if (occupancy.status !== 'active') throw ApiError.badRequest('Occupancy is not active');

    const result = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(occupancyRecords)
        .set({
          status: 'ended',
          endDate: body.endDate ?? new Date().toISOString().slice(0, 10),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
        })
        .where(eq(occupancyRecords.id, occupancyId))
        .returning();

      await tx
        .update(marketUnits)
        .set({ status: 'available' })
        .where(eq(marketUnits.id, occupancy.marketUnitId));

      return updated;
    });

    await writeAuditLog({
      actorUserId: c.get('user').id,
      action: 'occupancy.end',
      entityType: 'occupancy_record',
      entityId: occupancyId,
      oldValues: { status: occupancy.status },
      newValues: { status: 'ended' },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });

    return ok(c, result);
  },
);

marketRoutes.get(
  '/:marketId/occupancy-summary',
  requirePermission('market:read'),
  async (c) => {
    const marketId = c.req.param('marketId');
    const rows = await db
      .select({ status: marketUnits.status, total: count() })
      .from(marketUnits)
      .innerJoin(marketBlocks, eq(marketBlocks.id, marketUnits.blockId))
      .innerJoin(marketZones, eq(marketZones.id, marketBlocks.zoneId))
      .where(eq(marketZones.marketId, marketId))
      .groupBy(marketUnits.status);

    const stats = rows.map((row) => ({ status: row.status, total: Number(row.total) }));
    const total = stats.reduce((sum, row) => sum + row.total, 0);
    const occupied = stats.find((row) => row.status === 'occupied')?.total ?? 0;

    return ok(c, {
      totalUnits: total,
      occupied,
      available: stats.find((row) => row.status === 'available')?.total ?? 0,
      occupancyRate: total > 0 ? Number(((occupied / total) * 100).toFixed(2)) : 0,
      byStatus: stats,
    });
  },
);

/* ----------------------------- Facilities --------------------------- */

marketRoutes.get('/:marketId/facilities', requirePermission('market:read'), async (c) => {
  const rows = await db
    .select()
    .from(marketFacilities)
    .where(eq(marketFacilities.marketId, c.req.param('marketId')));
  return ok(c, rows);
});

marketRoutes.post(
  '/:marketId/facilities',
  requirePermission('market:write'),
  validate('json', facilitySchema),
  async (c) => {
    const marketId = c.req.param('marketId');
    const market = await db.query.markets.findFirst({
      where: and(eq(markets.id, marketId), isNull(markets.deletedAt)),
      columns: { id: true },
    });
    if (!market) throw ApiError.notFound('Market not found');

    const body = c.req.valid('json');
    const [facility] = await db
      .insert(marketFacilities)
      .values({
        marketId,
        name: body.name,
        type: body.type ?? null,
        locationDescription: body.locationDescription ?? null,
        condition: body.condition ?? 'good',
        isAvailable: body.isAvailable ?? true,
      })
      .returning();
    return c.json({ success: true as const, data: facility }, 201);
  },
);

marketRoutes.patch(
  '/facilities/:facilityId',
  requirePermission('market:write'),
  validate('json', facilitySchema.partial().refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    { message: 'Minimal satu field harus diisi' },
  )),
  async (c) => {
    const [updated] = await db
      .update(marketFacilities)
      .set(c.req.valid('json'))
      .where(eq(marketFacilities.id, c.req.param('facilityId')))
      .returning();
    if (!updated) throw ApiError.notFound('Facility not found');
    return ok(c, updated);
  },
);

marketRoutes.delete(
  '/facilities/:facilityId',
  requirePermission('market:write'),
  async (c) => {
    const [deleted] = await db
      .delete(marketFacilities)
      .where(eq(marketFacilities.id, c.req.param('facilityId')))
      .returning({ id: marketFacilities.id });
    if (!deleted) throw ApiError.notFound('Facility not found');
    return ok(c, { message: 'Facility deleted' });
  },
);
