import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  cashMovements,
  cashRegisters,
  cashierShifts,
  merchants,
  posTerminals,
  posTransactions,
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
import { money, numericString } from '../commerce/shared';
import {
  computeShiftTotals,
  getCashBalance,
  getCashierShift,
  getShiftDetail,
  posScopeCondition,
  signedCashAmount,
} from './shared';

const shiftStatusSchema = z.enum(['open', 'closed', 'cancelled']);
const cashMovementTypeSchema = z.enum(['cash_in', 'cash_out', 'adjustment']);

const listShiftsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  status: shiftStatusSchema.optional(),
  merchantId: z.uuid().optional(),
  terminalId: z.uuid().optional(),
  registerId: z.uuid().optional(),
  cashierId: z.uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const openShiftSchema = z.object({
  terminalId: z.uuid(),
  registerId: z.uuid(),
  cashierId: z.uuid().optional(),
  openingFloat: numericString.default('0'),
  notes: z.string().trim().max(2000).optional(),
});

const closeShiftSchema = z.object({
  countedCash: numericString,
  notes: z.string().trim().max(2000).optional(),
});

const createCashMovementSchema = z.object({
  type: cashMovementTypeSchema,
  amount: numericString.refine((value) => Number(value) > 0, 'Jumlah harus lebih dari 0'),
  referenceNumber: z.string().trim().max(128).optional(),
  note: z.string().trim().max(2000).optional(),
});

export const posShiftRoutes = new Hono<AppEnv>();

posShiftRoutes.get(
  '/shifts',
  requirePermission('pos:read'),
  validate('query', listShiftsSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];

    if (query.status) conditions.push(eq(cashierShifts.status, query.status));
    if (query.merchantId) conditions.push(eq(cashierShifts.merchantId, query.merchantId));
    if (query.terminalId) conditions.push(eq(cashierShifts.terminalId, query.terminalId));
    if (query.registerId) conditions.push(eq(cashierShifts.registerId, query.registerId));
    if (query.cashierId) conditions.push(eq(cashierShifts.cashierId, query.cashierId));
    if (query.from) conditions.push(gte(cashierShifts.openedAt, query.from));
    if (query.to) conditions.push(lte(cashierShifts.openedAt, query.to));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(cashierShifts.shiftNumber, term),
          ilike(merchants.businessName, term),
          ilike(stores.name, term),
          ilike(posTerminals.code, term),
          ilike(posTerminals.name, term),
          ilike(cashRegisters.code, term),
          ilike(cashRegisters.name, term),
          ilike(users.fullName, term),
        ) as SQL,
      );
    }

    const scope = posScopeCondition(user, permissions);
    if (scope) conditions.push(scope);

    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: cashierShifts.id,
          shiftNumber: cashierShifts.shiftNumber,
          status: cashierShifts.status,
          openingFloat: cashierShifts.openingFloat,
          expectedCash: cashierShifts.expectedCash,
          countedCash: cashierShifts.countedCash,
          cashDifference: cashierShifts.cashDifference,
          totalSales: cashierShifts.totalSales,
          totalCashSales: cashierShifts.totalCashSales,
          totalNonCashSales: cashierShifts.totalNonCashSales,
          transactionCount: cashierShifts.transactionCount,
          openedAt: cashierShifts.openedAt,
          closedAt: cashierShifts.closedAt,
          notes: cashierShifts.notes,
          merchantId: cashierShifts.merchantId,
          merchantName: merchants.businessName,
          merchantCode: merchants.code,
          storeId: cashierShifts.storeId,
          storeName: stores.name,
          terminalId: cashierShifts.terminalId,
          terminalCode: posTerminals.code,
          terminalName: posTerminals.name,
          registerId: cashierShifts.registerId,
          registerCode: cashRegisters.code,
          registerName: cashRegisters.name,
          cashierId: cashierShifts.cashierId,
          cashierName: users.fullName,
          cashierEmail: users.email,
          createdAt: cashierShifts.createdAt,
          updatedAt: cashierShifts.updatedAt,
        })
        .from(cashierShifts)
        .innerJoin(merchants, eq(merchants.id, cashierShifts.merchantId))
        .innerJoin(stores, eq(stores.id, cashierShifts.storeId))
        .innerJoin(posTerminals, eq(posTerminals.id, cashierShifts.terminalId))
        .innerJoin(cashRegisters, eq(cashRegisters.id, cashierShifts.registerId))
        .innerJoin(users, eq(users.id, cashierShifts.cashierId))
        .where(where)
        .orderBy(desc(cashierShifts.openedAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ value: count() })
        .from(cashierShifts)
        .innerJoin(merchants, eq(merchants.id, cashierShifts.merchantId))
        .innerJoin(stores, eq(stores.id, cashierShifts.storeId))
        .innerJoin(posTerminals, eq(posTerminals.id, cashierShifts.terminalId))
        .innerJoin(cashRegisters, eq(cashRegisters.id, cashierShifts.registerId))
        .innerJoin(users, eq(users.id, cashierShifts.cashierId))
        .where(where),
    ]);

    const shiftIds = rows.map((row) => row.id);
    const [transactionRows, cashRows] = shiftIds.length
      ? await Promise.all([
          db
            .select({
              shiftId: posTransactions.shiftId,
              totalSales: sql<string>`coalesce(sum(${posTransactions.total}), 0)`,
              totalCashSales: sql<string>`coalesce(sum(case when ${posTransactions.paymentMethod} = 'cash' then ${posTransactions.total} else 0 end), 0)`,
              totalNonCashSales: sql<string>`coalesce(sum(case when ${posTransactions.paymentMethod} <> 'cash' then ${posTransactions.total} else 0 end), 0)`,
              transactionCount: count(),
            })
            .from(posTransactions)
            .where(
              and(
                inArray(posTransactions.shiftId, shiftIds),
                eq(posTransactions.status, 'completed'),
              ),
            )
            .groupBy(posTransactions.shiftId),
          db
            .select({
              shiftId: cashMovements.shiftId,
              expectedCash: sql<string>`coalesce(sum(case when ${cashMovements.type} in ('cash_out', 'refund') then -${cashMovements.amount} else ${cashMovements.amount} end), 0)`,
            })
            .from(cashMovements)
            .where(inArray(cashMovements.shiftId, shiftIds))
            .groupBy(cashMovements.shiftId),
        ])
      : [[], []];

    const transactionMap = new Map(transactionRows.map((row) => [row.shiftId, row]));
    const cashMap = new Map(cashRows.map((row) => [row.shiftId, row]));

    const data = rows.map((row) => {
      const transaction = transactionMap.get(row.id);
      const cash = cashMap.get(row.id);
      return {
        ...row,
        totalSales: money(Number(transaction?.totalSales ?? 0)),
        totalCashSales: money(Number(transaction?.totalCashSales ?? 0)),
        totalNonCashSales: money(Number(transaction?.totalNonCashSales ?? 0)),
        transactionCount: Number(transaction?.transactionCount ?? 0),
        expectedCash: money(Number(cash?.expectedCash ?? 0)),
      };
    });

    return paginated(c, data, Number(totalRow?.value ?? 0), pagination);
  },
);

posShiftRoutes.post(
  '/shifts',
  requirePermission('pos:write'),
  validate('json', openShiftSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { terminal } = await getPosTerminalById(body.terminalId);
    const { register } = await getRegisterById(body.registerId);

    await assertMerchantAccess(terminal.merchantId, user, permissions);
    if (terminal.status !== 'active') {
      throw ApiError.badRequest('Terminal POS tidak aktif');
    }
    if (register.status !== 'active') {
      throw ApiError.badRequest('Cash register tidak aktif');
    }
    if (
      register.merchantId !== terminal.merchantId ||
      register.storeId !== terminal.storeId
    ) {
      throw ApiError.badRequest('Terminal dan cash register tidak berada pada toko yang sama');
    }
    if (register.terminalId && register.terminalId !== terminal.id) {
      throw ApiError.badRequest('Cash register terikat ke terminal lain');
    }

    const cashierId = body.cashierId ?? user.id;
    if (cashierId !== user.id) {
      await assertMerchantAccess(terminal.merchantId, user, permissions, {
        manage: true,
      });
      const cashier = await db.query.users.findFirst({
        where: and(eq(users.id, cashierId), eq(users.status, 'active')),
      });
      if (!cashier) throw ApiError.badRequest('Kasir tidak ditemukan atau tidak aktif');
    }

    const openShift = await db.query.cashierShifts.findFirst({
      where: and(
        eq(cashierShifts.registerId, body.registerId),
        eq(cashierShifts.status, 'open'),
      ),
    });
    if (openShift) {
      throw ApiError.conflict(
        `Cash register masih memiliki shift terbuka (${openShift.shiftNumber})`,
      );
    }

    const openingFloat = Number(body.openingFloat);
    const [shift] = await db
      .insert(cashierShifts)
      .values({
        shiftNumber: generateCode('SHF'),
        merchantId: terminal.merchantId,
        storeId: terminal.storeId,
        terminalId: terminal.id,
        registerId: register.id,
        cashierId,
        openingFloat: money(openingFloat),
        expectedCash: money(openingFloat),
        openedBy: user.id,
        notes: body.notes,
      })
      .returning();
    if (!shift) throw ApiError.internal('Gagal membuka shift kasir');

    await db.insert(cashMovements).values({
      merchantId: shift.merchantId,
      shiftId: shift.id,
      registerId: shift.registerId,
      type: 'opening',
      amount: money(openingFloat),
      balanceAfter: money(openingFloat),
      note: 'Saldo awal shift',
      createdBy: user.id,
    });

    await writeAuditLog({
      actorUserId: user.id,
      action: 'pos_shift.open',
      entityType: 'pos_shift',
      entityId: shift.id,
      newValues: shift,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    });

    return ok(c, await getShiftDetail(shift.id), 201);
  },
);

posShiftRoutes.get(
  '/shifts/:shiftId',
  requirePermission('pos:read'),
  async (c) => {
    const shiftId = c.req.param('shiftId');
    const { shift } = await getCashierShift(
      shiftId,
      c.get('user'),
      c.get('permissions'),
    );
    return ok(c, await getShiftDetail(shift.id));
  },
);

posShiftRoutes.post(
  '/shifts/:shiftId/close',
  requirePermission('pos:write'),
  validate('json', closeShiftSchema),
  async (c) => {
    const shiftId = c.req.param('shiftId');
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { shift } = await getCashierShift(shiftId, user, permissions);

    if (shift.status !== 'open') {
      throw ApiError.badRequest('Hanya shift terbuka yang dapat ditutup');
    }

    const totals = await computeShiftTotals(shift.id);
    const countedCash = Number(body.countedCash);
    const expectedCash = Number(totals.expectedCash);
    const difference = countedCash - expectedCash;

    const [updated] = await db
      .update(cashierShifts)
      .set({
        status: 'closed',
        expectedCash: totals.expectedCash,
        countedCash: money(countedCash),
        cashDifference: money(difference),
        totalSales: totals.totalSales,
        totalCashSales: totals.totalCashSales,
        totalNonCashSales: totals.totalNonCashSales,
        transactionCount: totals.transactionCount,
        closedAt: new Date(),
        closedBy: user.id,
        ...(body.notes ? { notes: body.notes } : {}),
      })
      .where(eq(cashierShifts.id, shift.id))
      .returning();
    if (!updated) throw ApiError.internal('Gagal menutup shift kasir');

    await writeAuditLog({
      actorUserId: user.id,
      action: 'pos_shift.close',
      entityType: 'pos_shift',
      entityId: shift.id,
      oldValues: shift,
      newValues: updated,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    });

    return ok(c, await getShiftDetail(shift.id));
  },
);

posShiftRoutes.post(
  '/shifts/:shiftId/cash-movements',
  requirePermission('pos:write'),
  validate('json', createCashMovementSchema),
  async (c) => {
    const shiftId = c.req.param('shiftId');
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { shift } = await getCashierShift(shiftId, user, permissions);

    if (shift.status !== 'open') {
      throw ApiError.badRequest('Pergerakan kas hanya dapat dicatat pada shift terbuka');
    }

    const amount = Number(body.amount);
    const currentBalance = await getCashBalance(shift.id);
    const nextBalance = currentBalance + signedCashAmount(body.type, amount);
    if (nextBalance < 0) {
      throw ApiError.badRequest('Saldo kas tidak boleh negatif');
    }

    const [movement] = await db
      .insert(cashMovements)
      .values({
        merchantId: shift.merchantId,
        shiftId: shift.id,
        registerId: shift.registerId,
        type: body.type,
        amount: money(amount),
        balanceAfter: money(nextBalance),
        referenceNumber: body.referenceNumber,
        note: body.note,
        createdBy: user.id,
      })
      .returning();
    if (!movement) throw ApiError.internal('Gagal mencatat pergerakan kas');

    await writeAuditLog({
      actorUserId: user.id,
      action: 'pos_cash_movement.create',
      entityType: 'pos_cash_movement',
      entityId: movement.id,
      newValues: movement,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    });

    return ok(c, movement, 201);
  },
);

async function getPosTerminalById(terminalId: string) {
  const terminal = await db.query.posTerminals.findFirst({
    where: and(eq(posTerminals.id, terminalId), isNull(posTerminals.deletedAt)),
  });
  if (!terminal) throw ApiError.notFound('Terminal POS tidak ditemukan');
  return { terminal };
}

async function getRegisterById(registerId: string) {
  const register = await db.query.cashRegisters.findFirst({
    where: and(eq(cashRegisters.id, registerId), isNull(cashRegisters.deletedAt)),
  });
  if (!register) throw ApiError.notFound('Cash register tidak ditemukan');
  return { register };
}


