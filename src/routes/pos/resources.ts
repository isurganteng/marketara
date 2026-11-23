import { and, asc, count, desc, eq, ilike, isNull, or, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  cashRegisters,
  cashierShifts,
  merchants,
  posTerminals,
  stores,
  users,
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
  assertPosStoreAccess,
  getCashRegister,
  getPosTerminal,
  posScopeCondition,
} from './shared';

const terminalStatusSchema = z.enum(['active', 'inactive', 'maintenance']);
const registerStatusSchema = z.enum(['active', 'inactive']);

const terminalCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'Gunakan huruf, angka, garis bawah, atau tanda hubung');

const listTerminalsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  storeId: z.uuid().optional(),
  status: terminalStatusSchema.optional(),
});

const createTerminalSchema = z.object({
  merchantId: z.uuid(),
  storeId: z.uuid(),
  code: terminalCodeSchema.optional(),
  name: z.string().trim().min(2).max(255),
  location: z.string().trim().max(255).optional(),
  deviceIdentifier: z.string().trim().max(128).optional(),
  status: terminalStatusSchema.default('active'),
  settings: z.record(z.string(), z.unknown()).optional(),
});

const updateTerminalSchema = createTerminalSchema
  .omit({ merchantId: true, storeId: true })
  .extend({
    storeId: z.uuid().optional(),
    lastSeenAt: z.coerce.date().optional(),
  })
  .partial();

const listRegistersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  storeId: z.uuid().optional(),
  terminalId: z.uuid().optional(),
  status: registerStatusSchema.optional(),
});

const createRegisterSchema = z.object({
  merchantId: z.uuid(),
  storeId: z.uuid(),
  terminalId: z.uuid().optional(),
  code: terminalCodeSchema.optional(),
  name: z.string().trim().min(2).max(255),
  status: registerStatusSchema.default('active'),
  notes: z.string().trim().max(2000).optional(),
});

const updateRegisterSchema = createRegisterSchema
  .omit({ merchantId: true, storeId: true })
  .extend({ storeId: z.uuid().optional(), terminalId: z.uuid().nullable().optional() })
  .partial();

export const posResourceRoutes = new Hono<AppEnv>();

posResourceRoutes.get(
  '/terminals',
  requirePermission('pos:read'),
  validate('query', listTerminalsSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [isNull(posTerminals.deletedAt)];

    const scope = posScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(posTerminals.merchantId, query.merchantId));
    if (query.storeId) conditions.push(eq(posTerminals.storeId, query.storeId));
    if (query.status) conditions.push(eq(posTerminals.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(posTerminals.code, term),
          ilike(posTerminals.name, term),
          ilike(posTerminals.location, term),
          ilike(merchants.businessName, term),
          ilike(stores.name, term),
        ) as SQL,
      );
    }
    const where = and(...conditions);

    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: posTerminals.id,
          code: posTerminals.code,
          name: posTerminals.name,
          location: posTerminals.location,
          deviceIdentifier: posTerminals.deviceIdentifier,
          status: posTerminals.status,
          settings: posTerminals.settings,
          lastSeenAt: posTerminals.lastSeenAt,
          merchantId: posTerminals.merchantId,
          merchantName: merchants.businessName,
          merchantCode: merchants.code,
          storeId: posTerminals.storeId,
          storeName: stores.name,
          createdAt: posTerminals.createdAt,
          updatedAt: posTerminals.updatedAt,
        })
        .from(posTerminals)
        .innerJoin(merchants, eq(merchants.id, posTerminals.merchantId))
        .innerJoin(stores, eq(stores.id, posTerminals.storeId))
        .where(where)
        .orderBy(desc(posTerminals.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ value: count() })
        .from(posTerminals)
        .innerJoin(merchants, eq(merchants.id, posTerminals.merchantId))
        .innerJoin(stores, eq(stores.id, posTerminals.storeId))
        .where(where),
    ]);

    return paginated(c, rows, Number(totalRow?.value ?? 0), pagination);
  },
);

posResourceRoutes.post(
  '/terminals',
  requirePermission('pos:manage'),
  validate('json', createTerminalSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertPosStoreAccess(body.merchantId, body.storeId, user, permissions, {
      manage: true,
    });

    const code = body.code ?? generateCode('TRM');
    const duplicate = await db.query.posTerminals.findFirst({
      where: and(
        eq(posTerminals.merchantId, body.merchantId),
        eq(posTerminals.code, code),
      ),
    });
    if (duplicate) throw ApiError.conflict('Kode terminal sudah digunakan');

    const [terminal] = await db
      .insert(posTerminals)
      .values({
        merchantId: body.merchantId,
        storeId: body.storeId,
        code,
        name: body.name,
        location: body.location,
        deviceIdentifier: body.deviceIdentifier,
        status: body.status,
        settings: body.settings,
      })
      .returning();
    if (!terminal) throw ApiError.internal('Gagal membuat terminal POS');

    await writeAuditLog({
      actorUserId: user.id,
      action: 'pos_terminal.create',
      entityType: 'pos_terminal',
      entityId: terminal.id,
      newValues: terminal,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    });

    return ok(c, terminal, 201);
  },
);

posResourceRoutes.patch(
  '/terminals/:terminalId',
  requirePermission('pos:manage'),
  validate('json', updateTerminalSchema),
  async (c) => {
    const terminalId = c.req.param('terminalId');
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { terminal: existing } = await getPosTerminal(
      terminalId,
      user,
      permissions,
      { manage: true },
    );

    if (body.storeId && body.storeId !== existing.storeId) {
      await assertPosStoreAccess(
        existing.merchantId,
        body.storeId,
        user,
        permissions,
        { manage: true },
      );
    }

    if (body.code && body.code !== existing.code) {
      const duplicate = await db.query.posTerminals.findFirst({
        where: and(
          eq(posTerminals.merchantId, existing.merchantId),
          eq(posTerminals.code, body.code),
        ),
      });
      if (duplicate) throw ApiError.conflict('Kode terminal sudah digunakan');
    }

    const { lastSeenAt, ...updates } = body;
    const [terminal] = await db
      .update(posTerminals)
      .set({
        ...updates,
        ...(lastSeenAt ? { lastSeenAt } : {}),
      })
      .where(eq(posTerminals.id, terminalId))
      .returning();
    if (!terminal) throw ApiError.notFound('Terminal POS tidak ditemukan');

    await writeAuditLog({
      actorUserId: user.id,
      action: 'pos_terminal.update',
      entityType: 'pos_terminal',
      entityId: terminalId,
      oldValues: existing,
      newValues: terminal,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    });

    return ok(c, terminal);
  },
);

posResourceRoutes.get(
  '/registers',
  requirePermission('pos:read'),
  validate('query', listRegistersSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [isNull(cashRegisters.deletedAt)];

    const scope = posScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(cashRegisters.merchantId, query.merchantId));
    if (query.storeId) conditions.push(eq(cashRegisters.storeId, query.storeId));
    if (query.terminalId) conditions.push(eq(cashRegisters.terminalId, query.terminalId));
    if (query.status) conditions.push(eq(cashRegisters.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(cashRegisters.code, term),
          ilike(cashRegisters.name, term),
          ilike(merchants.businessName, term),
          ilike(stores.name, term),
        ) as SQL,
      );
    }
    const where = and(...conditions);

    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: cashRegisters.id,
          code: cashRegisters.code,
          name: cashRegisters.name,
          status: cashRegisters.status,
          notes: cashRegisters.notes,
          merchantId: cashRegisters.merchantId,
          merchantName: merchants.businessName,
          merchantCode: merchants.code,
          storeId: cashRegisters.storeId,
          storeName: stores.name,
          terminalId: cashRegisters.terminalId,
          terminalCode: posTerminals.code,
          terminalName: posTerminals.name,
          activeShiftId: cashierShifts.id,
          activeShiftNumber: cashierShifts.shiftNumber,
          activeCashierId: cashierShifts.cashierId,
          activeCashierName: users.fullName,
          createdAt: cashRegisters.createdAt,
          updatedAt: cashRegisters.updatedAt,
        })
        .from(cashRegisters)
        .innerJoin(merchants, eq(merchants.id, cashRegisters.merchantId))
        .innerJoin(stores, eq(stores.id, cashRegisters.storeId))
        .leftJoin(posTerminals, eq(posTerminals.id, cashRegisters.terminalId))
        .leftJoin(
          cashierShifts,
          and(
            eq(cashierShifts.registerId, cashRegisters.id),
            eq(cashierShifts.status, 'open'),
          ),
        )
        .leftJoin(users, eq(users.id, cashierShifts.cashierId))
        .where(where)
        .orderBy(desc(cashRegisters.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ value: count() })
        .from(cashRegisters)
        .innerJoin(merchants, eq(merchants.id, cashRegisters.merchantId))
        .innerJoin(stores, eq(stores.id, cashRegisters.storeId))
        .where(where),
    ]);

    return paginated(c, rows, Number(totalRow?.value ?? 0), pagination);
  },
);

posResourceRoutes.post(
  '/registers',
  requirePermission('pos:manage'),
  validate('json', createRegisterSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertPosStoreAccess(body.merchantId, body.storeId, user, permissions, {
      manage: true,
    });

    if (body.terminalId) {
      const { terminal } = await getPosTerminal(body.terminalId, user, permissions, {
        manage: true,
      });
      if (terminal.merchantId !== body.merchantId || terminal.storeId !== body.storeId) {
        throw ApiError.badRequest('Terminal tidak sesuai dengan pedagang atau toko');
      }
    }

    const code = body.code ?? generateCode('REG');
    const duplicate = await db.query.cashRegisters.findFirst({
      where: and(
        eq(cashRegisters.merchantId, body.merchantId),
        eq(cashRegisters.code, code),
      ),
    });
    if (duplicate) throw ApiError.conflict('Kode cash register sudah digunakan');

    const [register] = await db
      .insert(cashRegisters)
      .values({
        merchantId: body.merchantId,
        storeId: body.storeId,
        terminalId: body.terminalId,
        code,
        name: body.name,
        status: body.status,
        notes: body.notes,
      })
      .returning();
    if (!register) throw ApiError.internal('Gagal membuat cash register');

    await writeAuditLog({
      actorUserId: user.id,
      action: 'pos_register.create',
      entityType: 'pos_register',
      entityId: register.id,
      newValues: register,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    });

    return ok(c, register, 201);
  },
);

posResourceRoutes.patch(
  '/registers/:registerId',
  requirePermission('pos:manage'),
  validate('json', updateRegisterSchema),
  async (c) => {
    const registerId = c.req.param('registerId');
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { register: existing } = await getCashRegister(registerId, user, permissions, {
      manage: true,
    });

    const storeId = body.storeId ?? existing.storeId;
    if (body.storeId && body.storeId !== existing.storeId) {
      await assertPosStoreAccess(
        existing.merchantId,
        body.storeId,
        user,
        permissions,
        { manage: true },
      );
    }

    const terminalId = body.terminalId === undefined ? existing.terminalId : body.terminalId;
    if (terminalId) {
      const { terminal } = await getPosTerminal(terminalId, user, permissions, {
        manage: true,
      });
      if (terminal.merchantId !== existing.merchantId || terminal.storeId !== storeId) {
        throw ApiError.badRequest('Terminal tidak sesuai dengan pedagang atau toko');
      }
    }

    if (body.code && body.code !== existing.code) {
      const duplicate = await db.query.cashRegisters.findFirst({
        where: and(
          eq(cashRegisters.merchantId, existing.merchantId),
          eq(cashRegisters.code, body.code),
        ),
      });
      if (duplicate) throw ApiError.conflict('Kode cash register sudah digunakan');
    }

    const [register] = await db
      .update(cashRegisters)
      .set(body)
      .where(eq(cashRegisters.id, registerId))
      .returning();
    if (!register) throw ApiError.notFound('Cash register tidak ditemukan');

    await writeAuditLog({
      actorUserId: user.id,
      action: 'pos_register.update',
      entityType: 'pos_register',
      entityId: registerId,
      oldValues: existing,
      newValues: register,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    });

    return ok(c, register);
  },
);
