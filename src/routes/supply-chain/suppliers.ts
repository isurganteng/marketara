import { and, asc, count, desc, eq, ilike, isNull, or, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import { merchants, suppliers, users } from '../../db/schema';
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
  getSupplier,
  supplyChainScopeCondition,
} from './shared';

const statusSchema = z.enum(['active', 'inactive', 'suspended']);
const codeSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'Gunakan huruf, angka, garis bawah, atau tanda hubung');

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  status: statusSchema.optional(),
});

const createSchema = z.object({
  merchantId: z.uuid(),
  code: codeSchema.optional(),
  name: z.string().trim().min(2).max(255),
  legalName: z.string().trim().max(255).optional(),
  contactName: z.string().trim().max(255).optional(),
  contactEmail: z.email().max(255).optional(),
  contactPhone: z.string().trim().max(32).optional(),
  address: z.string().trim().max(2000).optional(),
  city: z.string().trim().max(120).optional(),
  province: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().max(20).optional(),
  country: z.string().trim().length(2).default('ID'),
  taxNumber: z.string().trim().max(64).optional(),
  paymentTermDays: z.coerce.number().int().min(0).max(3650).default(0),
  status: statusSchema.default('active'),
  notes: z.string().trim().max(2000).optional(),
});

const updateSchema = z.object({
  code: codeSchema.optional(),
  name: z.string().trim().min(2).max(255).optional(),
  legalName: z.string().trim().max(255).nullable().optional(),
  contactName: z.string().trim().max(255).nullable().optional(),
  contactEmail: z.email().max(255).nullable().optional(),
  contactPhone: z.string().trim().max(32).nullable().optional(),
  address: z.string().trim().max(2000).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  province: z.string().trim().max(120).nullable().optional(),
  postalCode: z.string().trim().max(20).nullable().optional(),
  country: z.string().trim().length(2).optional(),
  taxNumber: z.string().trim().max(64).nullable().optional(),
  paymentTermDays: z.coerce.number().int().min(0).max(3650).optional(),
  status: statusSchema.optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const supplyChainSupplierRoutes = new Hono<AppEnv>();

supplyChainSupplierRoutes.get(
  '/suppliers',
  requirePermission('supply_chain:read'),
  validate('query', listSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [isNull(suppliers.deletedAt)];

    const scope = supplyChainScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(suppliers.merchantId, query.merchantId));
    if (query.status) conditions.push(eq(suppliers.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(suppliers.code, term),
          ilike(suppliers.name, term),
          ilike(suppliers.legalName, term),
          ilike(suppliers.contactName, term),
          ilike(suppliers.contactEmail, term),
          ilike(merchants.businessName, term),
        ) as SQL,
      );
    }
    const where = and(...conditions);

    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: suppliers.id,
          merchantId: suppliers.merchantId,
          merchantName: merchants.businessName,
          code: suppliers.code,
          name: suppliers.name,
          legalName: suppliers.legalName,
          contactName: suppliers.contactName,
          contactEmail: suppliers.contactEmail,
          contactPhone: suppliers.contactPhone,
          city: suppliers.city,
          province: suppliers.province,
          paymentTermDays: suppliers.paymentTermDays,
          status: suppliers.status,
          createdAt: suppliers.createdAt,
        })
        .from(suppliers)
        .innerJoin(merchants, eq(merchants.id, suppliers.merchantId))
        .where(where)
        .orderBy(desc(suppliers.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(suppliers)
        .innerJoin(merchants, eq(merchants.id, suppliers.merchantId))
        .where(where),
    ]);

    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

supplyChainSupplierRoutes.post(
  '/suppliers',
  requirePermission('supply_chain:write'),
  validate('json', createSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertSupplyChainAccess(body.merchantId, user, permissions, { manage: true });

    const code = body.code ?? generateCode('SUP');
    const [existing] = await db
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(and(eq(suppliers.merchantId, body.merchantId), eq(suppliers.code, code)))
      .limit(1);
    if (existing) throw ApiError.conflict('Kode supplier sudah digunakan');

    const [created] = await db
      .insert(suppliers)
      .values({
        merchantId: body.merchantId,
        code,
        name: body.name,
        legalName: body.legalName ?? null,
        contactName: body.contactName ?? null,
        contactEmail: body.contactEmail ?? null,
        contactPhone: body.contactPhone ?? null,
        address: body.address ?? null,
        city: body.city ?? null,
        province: body.province ?? null,
        postalCode: body.postalCode ?? null,
        country: body.country,
        taxNumber: body.taxNumber ?? null,
        paymentTermDays: body.paymentTermDays,
        status: body.status,
        notes: body.notes ?? null,
        createdBy: user.id,
      })
      .returning();

    await writeAuditLog({
      actorUserId: user.id,
      action: 'supply_chain.supplier.create',
      entityType: 'supplier',
      entityId: created!.id,
      newValues: { code: created!.code, name: created!.name },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created!, 201);
  },
);

supplyChainSupplierRoutes.get(
  '/suppliers/:id',
  requirePermission('supply_chain:read'),
  async (c) => {
    const { supplier } = await getSupplier(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    return ok(c, supplier);
  },
);

supplyChainSupplierRoutes.patch(
  '/suppliers/:id',
  requirePermission('supply_chain:write'),
  validate('json', updateSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { supplier } = await getSupplier(c.req.param('id'), user, permissions, {
      manage: true,
    });

    if (body.code && body.code !== supplier.code) {
      const [existing] = await db
        .select({ id: suppliers.id })
        .from(suppliers)
        .where(
          and(
            eq(suppliers.merchantId, supplier.merchantId),
            eq(suppliers.code, body.code),
            isNull(suppliers.deletedAt),
          ),
        )
        .limit(1);
      if (existing) throw ApiError.conflict('Kode supplier sudah digunakan');
    }

    const [updated] = await db
      .update(suppliers)
      .set({
        ...body,
        legalName: body.legalName === undefined ? undefined : body.legalName,
      })
      .where(eq(suppliers.id, supplier.id))
      .returning();

    await writeAuditLog({
      actorUserId: user.id,
      action: 'supply_chain.supplier.update',
      entityType: 'supplier',
      entityId: supplier.id,
      oldValues: { code: supplier.code, name: supplier.name, status: supplier.status },
      newValues: body,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

supplyChainSupplierRoutes.delete(
  '/suppliers/:id',
  requirePermission('supply_chain:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { supplier } = await getSupplier(c.req.param('id'), user, permissions, {
      manage: true,
    });
    await db
      .update(suppliers)
      .set({ deletedAt: new Date(), status: 'inactive' })
      .where(eq(suppliers.id, supplier.id));
    await writeAuditLog({
      actorUserId: user.id,
      action: 'supply_chain.supplier.delete',
      entityType: 'supplier',
      entityId: supplier.id,
      oldValues: { code: supplier.code, name: supplier.name },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, { id: supplier.id, deleted: true });
  },
);

/** Ringkasan supplier untuk dropdown form procurement. */
supplyChainSupplierRoutes.get(
  '/supplier-options',
  requirePermission('supply_chain:read'),
  validate(
    'query',
    z.object({
      merchantId: z.uuid().optional(),
      search: z.string().trim().max(100).optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const conditions: SQL[] = [
      isNull(suppliers.deletedAt),
      eq(suppliers.status, 'active'),
    ];
    const scope = supplyChainScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(suppliers.merchantId, query.merchantId));
    if (query.search) conditions.push(ilike(suppliers.name, `%${query.search}%`));

    const rows = await db
      .select({
        id: suppliers.id,
        merchantId: suppliers.merchantId,
        code: suppliers.code,
        name: suppliers.name,
        paymentTermDays: suppliers.paymentTermDays,
      })
      .from(suppliers)
      .where(and(...conditions))
      .orderBy(asc(suppliers.name))
      .limit(100);
    return ok(c, rows);
  },
);
