import { and, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import { collectivePurchaseGroups, merchants, suppliers } from '../../db/schema';
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
  getCollectiveGroup,
  getSupplier,
  numericSchema,
  optionalNumericSchema,
  quantity,
  supplyChainScopeCondition,
  toNumber,
} from './shared';

const statusSchema = z.enum(['open', 'closed', 'converted', 'cancelled']);

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  supplierId: z.uuid().optional(),
  status: statusSchema.optional(),
});

const createSchema = z.object({
  merchantId: z.uuid(),
  supplierId: z.uuid().optional(),
  title: z.string().trim().min(3).max(255),
  description: z.string().trim().max(2000).optional(),
  targetQuantity: numericSchema,
  unit: z.string().trim().max(32).default('pcs'),
  targetPrice: optionalNumericSchema.default('0'),
  closesAt: z.string().datetime().optional(),
  notes: z.string().trim().max(2000).optional(),
});

const updateSchema = z.object({
  supplierId: z.uuid().nullable().optional(),
  title: z.string().trim().min(3).max(255).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  targetQuantity: numericSchema.optional(),
  currentQuantity: optionalNumericSchema.optional(),
  unit: z.string().trim().max(32).optional(),
  targetPrice: optionalNumericSchema.optional(),
  closesAt: z.string().datetime().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const supplyChainCollectiveRoutes = new Hono<AppEnv>();

supplyChainCollectiveRoutes.get(
  '/collective-purchase-groups',
  requirePermission('supply_chain:read'),
  validate('query', listSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = supplyChainScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) {
      conditions.push(eq(collectivePurchaseGroups.merchantId, query.merchantId));
    }
    if (query.supplierId) {
      conditions.push(eq(collectivePurchaseGroups.supplierId, query.supplierId));
    }
    if (query.status) conditions.push(eq(collectivePurchaseGroups.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(collectivePurchaseGroups.groupNumber, term),
          ilike(collectivePurchaseGroups.title, term),
          ilike(merchants.businessName, term),
          ilike(suppliers.name, term),
        ) as SQL,
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: collectivePurchaseGroups.id,
          groupNumber: collectivePurchaseGroups.groupNumber,
          merchantId: collectivePurchaseGroups.merchantId,
          merchantName: merchants.businessName,
          supplierId: collectivePurchaseGroups.supplierId,
          supplierName: suppliers.name,
          title: collectivePurchaseGroups.title,
          status: collectivePurchaseGroups.status,
          targetQuantity: collectivePurchaseGroups.targetQuantity,
          currentQuantity: collectivePurchaseGroups.currentQuantity,
          unit: collectivePurchaseGroups.unit,
          targetPrice: collectivePurchaseGroups.targetPrice,
          closesAt: collectivePurchaseGroups.closesAt,
          createdAt: collectivePurchaseGroups.createdAt,
        })
        .from(collectivePurchaseGroups)
        .innerJoin(merchants, eq(merchants.id, collectivePurchaseGroups.merchantId))
        .leftJoin(suppliers, eq(suppliers.id, collectivePurchaseGroups.supplierId))
        .where(where)
        .orderBy(desc(collectivePurchaseGroups.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(collectivePurchaseGroups)
        .innerJoin(merchants, eq(merchants.id, collectivePurchaseGroups.merchantId))
        .leftJoin(suppliers, eq(suppliers.id, collectivePurchaseGroups.supplierId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

supplyChainCollectiveRoutes.post(
  '/collective-purchase-groups',
  requirePermission('supply_chain:write'),
  validate('json', createSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertSupplyChainAccess(body.merchantId, user, permissions, { manage: true });
    if (body.supplierId) {
      const { supplier } = await getSupplier(body.supplierId, user, permissions);
      if (supplier.merchantId !== body.merchantId) {
        throw ApiError.badRequest('Supplier tidak sesuai dengan merchant');
      }
    }
    const [created] = await db
      .insert(collectivePurchaseGroups)
      .values({
        groupNumber: generateCode('CPG'),
        merchantId: body.merchantId,
        supplierId: body.supplierId ?? null,
        title: body.title,
        description: body.description ?? null,
        status: 'open',
        targetQuantity: quantity(toNumber(body.targetQuantity)),
        unit: body.unit,
        targetPrice: toNumber(body.targetPrice).toFixed(2),
        closesAt: body.closesAt ? new Date(body.closesAt) : null,
        notes: body.notes ?? null,
      })
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'supply_chain.collective_group.create',
      entityType: 'collective_purchase_group',
      entityId: created!.id,
      newValues: { number: created!.groupNumber, title: created!.title },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created!, 201);
  },
);

supplyChainCollectiveRoutes.get(
  '/collective-purchase-groups/:id',
  requirePermission('supply_chain:read'),
  async (c) => {
    const { group } = await getCollectiveGroup(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    return ok(c, group);
  },
);

supplyChainCollectiveRoutes.patch(
  '/collective-purchase-groups/:id',
  requirePermission('supply_chain:write'),
  validate('json', updateSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { group } = await getCollectiveGroup(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (['converted', 'cancelled'].includes(group.status)) {
      throw ApiError.badRequest('Grup pembelian tidak dapat diubah');
    }
    if (body.supplierId) {
      const { supplier } = await getSupplier(body.supplierId, user, permissions);
      if (supplier.merchantId !== group.merchantId) {
        throw ApiError.badRequest('Supplier tidak sesuai dengan merchant');
      }
    }
    const [updated] = await db
      .update(collectivePurchaseGroups)
      .set({
        supplierId: body.supplierId,
        title: body.title,
        description: body.description,
        targetQuantity:
          body.targetQuantity === undefined
            ? undefined
            : quantity(toNumber(body.targetQuantity)),
        currentQuantity:
          body.currentQuantity === undefined
            ? undefined
            : quantity(toNumber(body.currentQuantity)),
        unit: body.unit,
        targetPrice:
          body.targetPrice === undefined
            ? undefined
            : toNumber(body.targetPrice).toFixed(2),
        closesAt: body.closesAt === undefined
          ? undefined
          : body.closesAt
            ? new Date(body.closesAt)
            : null,
        notes: body.notes,
      })
      .where(eq(collectivePurchaseGroups.id, group.id))
      .returning();
    return ok(c, updated!);
  },
);

supplyChainCollectiveRoutes.post(
  '/collective-purchase-groups/:id/close',
  requirePermission('supply_chain:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { group } = await getCollectiveGroup(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (group.status !== 'open') {
      throw ApiError.badRequest('Grup pembelian tidak dapat ditutup');
    }
    const [updated] = await db
      .update(collectivePurchaseGroups)
      .set({ status: 'closed' })
      .where(eq(collectivePurchaseGroups.id, group.id))
      .returning();
    return ok(c, updated!);
  },
);

supplyChainCollectiveRoutes.post(
  '/collective-purchase-groups/:id/cancel',
  requirePermission('supply_chain:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { group } = await getCollectiveGroup(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (['converted', 'cancelled'].includes(group.status)) {
      throw ApiError.badRequest('Grup pembelian tidak dapat dibatalkan');
    }
    const [updated] = await db
      .update(collectivePurchaseGroups)
      .set({ status: 'cancelled' })
      .where(eq(collectivePurchaseGroups.id, group.id))
      .returning();
    return ok(c, updated!);
  },
);
