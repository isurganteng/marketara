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
  posSyncLogs,
  posTerminals,
  posTransactionItems,
  posTransactions,
  productSkus,
  products,
  stores,
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
import { money, numericString } from '../commerce/shared';
import {
  getCashierShift,
  getCashRegister,
  getCashBalance,
  getPosTerminal,
  getPosTransaction,
  getPosTransactionDetail,
  posScopeCondition,
} from './shared';

const posTransactionStatusSchema = z.enum(['completed', 'voided']);
const posSyncStatusSchema = z.enum(['pending', 'synced', 'failed', 'conflict']);
const posPaymentMethodSchema = z.enum([
  'cash',
  'qris',
  'debit_card',
  'credit_card',
  'ewallet',
  'bank_transfer',
  'other',
]);
const posSyncDirectionSchema = z.enum(['upload', 'download']);
const posSyncLogStatusSchema = z.enum(['success', 'failed', 'conflict']);

const transactionItemSchema = z.object({
  productId: z.uuid(),
  skuId: z.uuid().optional().nullable(),
  quantity: z.coerce.number().int().min(1).max(100000),
  discountAmount: numericString.default('0'),
  notes: z.string().trim().max(1000).optional(),
});

const createTransactionSchema = z.object({
  terminalId: z.uuid(),
  registerId: z.uuid().optional(),
  shiftId: z.uuid().optional(),
  paymentMethod: posPaymentMethodSchema,
  clientTransactionId: z.string().trim().min(1).max(128).optional(),
  paidAmount: numericString.optional(),
  discountTotal: numericString.default('0'),
  taxTotal: numericString.default('0'),
  customerName: z.string().trim().max(255).optional(),
  customerPhone: z.string().trim().max(32).optional(),
  notes: z.string().trim().max(2000).optional(),
  offlineCreatedAt: z.coerce.date().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  items: z.array(transactionItemSchema).min(1).max(200),
});

const syncTransactionSchema = createTransactionSchema
  .omit({ terminalId: true, registerId: true, shiftId: true })
  .extend({ clientTransactionId: z.string().trim().min(1).max(128) });

const syncBatchSchema = z.object({
  terminalId: z.uuid(),
  registerId: z.uuid().optional(),
  transactions: z.array(syncTransactionSchema).min(1).max(100),
});

const listTransactionsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  status: posTransactionStatusSchema.optional(),
  syncStatus: posSyncStatusSchema.optional(),
  paymentMethod: posPaymentMethodSchema.optional(),
  merchantId: z.uuid().optional(),
  terminalId: z.uuid().optional(),
  registerId: z.uuid().optional(),
  shiftId: z.uuid().optional(),
  cashierId: z.uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const voidTransactionSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
});

const listSyncLogsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  status: posSyncLogStatusSchema.optional(),
  direction: posSyncDirectionSchema.optional(),
  merchantId: z.uuid().optional(),
  terminalId: z.uuid().optional(),
  transactionId: z.uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

interface TransactionInput {
  paymentMethod: z.infer<typeof posPaymentMethodSchema>;
  clientTransactionId?: string;
  paidAmount?: string;
  discountTotal: string;
  taxTotal: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  offlineCreatedAt?: Date;
  metadata?: Record<string, unknown>;
  items: Array<{
    productId: string;
    skuId?: string | null;
    quantity: number;
    discountAmount: string;
    notes?: string;
  }>;
}

interface PosContext {
  terminal: typeof posTerminals.$inferSelect;
  register: typeof cashRegisters.$inferSelect;
  shift: typeof cashierShifts.$inferSelect;
}

export const posTransactionRoutes = new Hono<AppEnv>();

posTransactionRoutes.get(
  '/transactions',
  requirePermission('pos:read'),
  validate('query', listTransactionsSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];

    const scope = posScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.status) conditions.push(eq(posTransactions.status, query.status));
    if (query.syncStatus) conditions.push(eq(posTransactions.syncStatus, query.syncStatus));
    if (query.paymentMethod) {
      conditions.push(eq(posTransactions.paymentMethod, query.paymentMethod));
    }
    if (query.merchantId) conditions.push(eq(posTransactions.merchantId, query.merchantId));
    if (query.terminalId) conditions.push(eq(posTransactions.terminalId, query.terminalId));
    if (query.registerId) conditions.push(eq(posTransactions.registerId, query.registerId));
    if (query.shiftId) conditions.push(eq(posTransactions.shiftId, query.shiftId));
    if (query.cashierId) conditions.push(eq(posTransactions.cashierId, query.cashierId));
    if (query.from) conditions.push(gte(posTransactions.completedAt, query.from));
    if (query.to) conditions.push(lte(posTransactions.completedAt, query.to));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(posTransactions.transactionNumber, term),
          ilike(posTransactions.clientTransactionId, term),
          ilike(posTransactions.customerName, term),
          ilike(posTransactions.customerPhone, term),
          ilike(merchants.businessName, term),
          ilike(stores.name, term),
          ilike(posTerminals.code, term),
          ilike(posTerminals.name, term),
          ilike(cashRegisters.code, term),
          ilike(cashierShifts.shiftNumber, term),
          ilike(users.fullName, term),
        ) as SQL,
      );
    }

    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: posTransactions.id,
          transactionNumber: posTransactions.transactionNumber,
          clientTransactionId: posTransactions.clientTransactionId,
          status: posTransactions.status,
          syncStatus: posTransactions.syncStatus,
          paymentMethod: posTransactions.paymentMethod,
          currency: posTransactions.currency,
          itemCount: posTransactions.itemCount,
          subtotal: posTransactions.subtotal,
          discountTotal: posTransactions.discountTotal,
          taxTotal: posTransactions.taxTotal,
          total: posTransactions.total,
          paidAmount: posTransactions.paidAmount,
          changeAmount: posTransactions.changeAmount,
          customerName: posTransactions.customerName,
          customerPhone: posTransactions.customerPhone,
          completedAt: posTransactions.completedAt,
          syncedAt: posTransactions.syncedAt,
          voidedAt: posTransactions.voidedAt,
          merchantId: posTransactions.merchantId,
          merchantName: merchants.businessName,
          merchantCode: merchants.code,
          storeId: posTransactions.storeId,
          storeName: stores.name,
          terminalId: posTransactions.terminalId,
          terminalCode: posTerminals.code,
          terminalName: posTerminals.name,
          registerId: posTransactions.registerId,
          registerCode: cashRegisters.code,
          registerName: cashRegisters.name,
          shiftId: posTransactions.shiftId,
          shiftNumber: cashierShifts.shiftNumber,
          cashierId: posTransactions.cashierId,
          cashierName: users.fullName,
          createdAt: posTransactions.createdAt,
          updatedAt: posTransactions.updatedAt,
        })
        .from(posTransactions)
        .innerJoin(merchants, eq(merchants.id, posTransactions.merchantId))
        .innerJoin(stores, eq(stores.id, posTransactions.storeId))
        .innerJoin(posTerminals, eq(posTerminals.id, posTransactions.terminalId))
        .innerJoin(cashRegisters, eq(cashRegisters.id, posTransactions.registerId))
        .innerJoin(cashierShifts, eq(cashierShifts.id, posTransactions.shiftId))
        .innerJoin(users, eq(users.id, posTransactions.cashierId))
        .where(where)
        .orderBy(desc(posTransactions.completedAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ value: count() })
        .from(posTransactions)
        .innerJoin(merchants, eq(merchants.id, posTransactions.merchantId))
        .innerJoin(stores, eq(stores.id, posTransactions.storeId))
        .innerJoin(posTerminals, eq(posTerminals.id, posTransactions.terminalId))
        .innerJoin(cashRegisters, eq(cashRegisters.id, posTransactions.registerId))
        .innerJoin(cashierShifts, eq(cashierShifts.id, posTransactions.shiftId))
        .innerJoin(users, eq(users.id, posTransactions.cashierId))
        .where(where),
    ]);

    return paginated(c, rows, Number(totalRow?.value ?? 0), pagination);
  },
);

posTransactionRoutes.post(
  '/transactions',
  requirePermission('pos:write'),
  validate('json', createTransactionSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const context = await resolvePosContext(
      body.terminalId,
      body.registerId,
      body.shiftId,
      user,
      permissions,
    );
    const result = await createTransactionForContext(
      context,
      body,
      user,
      permissions,
      'synced',
    );

    if (result.created) {
      await writeAuditLog({
        actorUserId: user.id,
        action: 'pos_transaction.create',
        entityType: 'pos_transaction',
        entityId: result.transaction.id,
        newValues: result.transaction,
        ipAddress: getClientIp(c),
        userAgent: c.req.header('user-agent'),
      });
      await writeSyncLog({
        merchantId: context.terminal.merchantId,
        terminalId: context.terminal.id,
        transactionId: result.transaction.id,
        status: 'success',
        recordsCount: 1,
        message: 'Transaksi POS tersimpan dan tersinkronisasi',
        createdBy: user.id,
      });
    }

    return ok(c, await getPosTransactionDetail(result.transaction.id), result.created ? 201 : 200);
  },
);

posTransactionRoutes.get(
  '/transactions/:transactionId',
  requirePermission('pos:read'),
  async (c) => {
    const transactionId = c.req.param('transactionId');
    const { transaction } = await getPosTransaction(
      transactionId,
      c.get('user'),
      c.get('permissions'),
    );
    return ok(c, await getPosTransactionDetail(transaction.id));
  },
);

posTransactionRoutes.post(
  '/transactions/:transactionId/void',
  requirePermission('pos:write'),
  validate('json', voidTransactionSchema),
  async (c) => {
    const transactionId = c.req.param('transactionId');
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { transaction } = await getPosTransaction(transactionId, user, permissions);

    if (transaction.status !== 'completed') {
      throw ApiError.badRequest('Hanya transaksi selesai yang dapat dibatalkan');
    }
    const { shift } = await getCashierShift(transaction.shiftId, user, permissions);
    if (shift.status !== 'open') {
      throw ApiError.badRequest('Transaksi hanya dapat dibatalkan saat shift masih terbuka');
    }

    if (transaction.paymentMethod === 'cash') {
      const balance = await getCashBalance(shift.id);
      const total = Number(transaction.total);
      if (balance < total) {
        throw ApiError.badRequest(
          'Saldo kas tidak cukup untuk membatalkan transaksi tunai ini',
        );
      }
      await db.insert(cashMovements).values({
        merchantId: transaction.merchantId,
        shiftId: shift.id,
        registerId: shift.registerId,
        transactionId: transaction.id,
        type: 'refund',
        amount: money(total),
        balanceAfter: money(balance - total),
        referenceNumber: transaction.transactionNumber,
        note: `Pembatalan transaksi ${transaction.transactionNumber}`,
        createdBy: user.id,
      });
    }

    const [updated] = await db
      .update(posTransactions)
      .set({
        status: 'voided',
        voidedAt: new Date(),
        voidReason: body.reason,
      })
      .where(eq(posTransactions.id, transaction.id))
      .returning();
    if (!updated) throw ApiError.internal('Gagal membatalkan transaksi POS');

    await writeAuditLog({
      actorUserId: user.id,
      action: 'pos_transaction.void',
      entityType: 'pos_transaction',
      entityId: transaction.id,
      oldValues: transaction,
      newValues: updated,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    });

    return ok(c, await getPosTransactionDetail(transaction.id));
  },
);

posTransactionRoutes.post(
  '/transactions/:transactionId/sync',
  requirePermission('pos:manage'),
  async (c) => {
    const transactionId = c.req.param('transactionId');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { transaction } = await getPosTransaction(transactionId, user, permissions);

    if (transaction.syncStatus !== 'synced') {
      await db
        .update(posTransactions)
        .set({ syncStatus: 'synced', syncedAt: new Date() })
        .where(eq(posTransactions.id, transaction.id));
    }

    await writeSyncLog({
      merchantId: transaction.merchantId,
      terminalId: transaction.terminalId,
      transactionId: transaction.id,
      status: 'success',
      recordsCount: 1,
      message: 'Sinkronisasi transaksi berhasil',
      createdBy: user.id,
    });

    await writeAuditLog({
      actorUserId: user.id,
      action: 'pos_transaction.sync',
      entityType: 'pos_transaction',
      entityId: transaction.id,
      oldValues: transaction,
      newValues: { syncStatus: 'synced' },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    });

    return ok(c, await getPosTransactionDetail(transaction.id));
  },
);

posTransactionRoutes.post(
  '/sync',
  requirePermission('pos:manage'),
  validate('json', syncBatchSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { terminal } = await getPosTerminal(body.terminalId, user, permissions, {
      manage: true,
    });

    let context: PosContext;
    try {
      context = await resolvePosContext(
        terminal.id,
        body.registerId,
        undefined,
        user,
        permissions,
      );
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Gagal menyiapkan sinkronisasi';
      await writeSyncLog({
        merchantId: terminal.merchantId,
        terminalId: terminal.id,
        status: 'failed',
        recordsCount: body.transactions.length,
        message,
        payload: {
          clientTransactionIds: body.transactions.map(
            (item) => item.clientTransactionId,
          ),
        },
        createdBy: user.id,
      });
      throw error;
    }

    let created = 0;
    let skipped = 0;
    let failed = 0;
    const results: Array<Record<string, unknown>> = [];

    for (const item of body.transactions) {
      try {
        const result = await createTransactionForContext(
          context,
          item,
          user,
          permissions,
          'synced',
        );
        if (result.created) created += 1;
        else skipped += 1;
        results.push({
          clientTransactionId: item.clientTransactionId,
          transactionId: result.transaction.id,
          transactionNumber: result.transaction.transactionNumber,
          status: result.created ? 'created' : 'skipped',
        });
      } catch (error) {
        failed += 1;
        results.push({
          clientTransactionId: item.clientTransactionId,
          status: 'failed',
          message: error instanceof ApiError ? error.message : 'Gagal menyimpan transaksi',
        });
      }
    }

    await writeSyncLog({
      merchantId: terminal.merchantId,
      terminalId: terminal.id,
      status: failed > 0 ? 'failed' : 'success',
      recordsCount: body.transactions.length,
      message:
        failed > 0
          ? `${created} transaksi dibuat, ${skipped} dilewati, ${failed} gagal`
          : `${created} transaksi dibuat, ${skipped} transaksi sudah tersinkronisasi`,
      payload: {
        clientTransactionIds: body.transactions.map(
          (item) => item.clientTransactionId,
        ),
      },
      errorDetails: failed > 0 ? { results } : undefined,
      createdBy: user.id,
    });

    await writeAuditLog({
      actorUserId: user.id,
      action: 'pos_sync.upload',
      entityType: 'pos_terminal',
      entityId: terminal.id,
      newValues: { created, skipped, failed },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    });

    return ok(
      c,
      {
        terminalId: terminal.id,
        registerId: context.register.id,
        shiftId: context.shift.id,
        received: body.transactions.length,
        created,
        skipped,
        failed,
        results,
      },
      201,
    );
  },
);

posTransactionRoutes.get(
  '/sync-logs',
  requirePermission('pos:read'),
  validate('query', listSyncLogsSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];

    const scope = posScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.status) conditions.push(eq(posSyncLogs.status, query.status));
    if (query.direction) conditions.push(eq(posSyncLogs.direction, query.direction));
    if (query.merchantId) conditions.push(eq(posSyncLogs.merchantId, query.merchantId));
    if (query.terminalId) conditions.push(eq(posSyncLogs.terminalId, query.terminalId));
    if (query.transactionId) {
      conditions.push(eq(posSyncLogs.transactionId, query.transactionId));
    }
    if (query.from) conditions.push(gte(posSyncLogs.createdAt, query.from));
    if (query.to) conditions.push(lte(posSyncLogs.createdAt, query.to));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(posSyncLogs.message, term),
          ilike(merchants.businessName, term),
          ilike(posTerminals.code, term),
          ilike(posTerminals.name, term),
          ilike(posTransactions.transactionNumber, term),
        ) as SQL,
      );
    }

    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: posSyncLogs.id,
          direction: posSyncLogs.direction,
          status: posSyncLogs.status,
          recordsCount: posSyncLogs.recordsCount,
          payload: posSyncLogs.payload,
          message: posSyncLogs.message,
          errorDetails: posSyncLogs.errorDetails,
          startedAt: posSyncLogs.startedAt,
          completedAt: posSyncLogs.completedAt,
          merchantId: posSyncLogs.merchantId,
          merchantName: merchants.businessName,
          terminalId: posSyncLogs.terminalId,
          terminalCode: posTerminals.code,
          terminalName: posTerminals.name,
          transactionId: posSyncLogs.transactionId,
          transactionNumber: posTransactions.transactionNumber,
          createdAt: posSyncLogs.createdAt,
        })
        .from(posSyncLogs)
        .innerJoin(merchants, eq(merchants.id, posSyncLogs.merchantId))
        .innerJoin(posTerminals, eq(posTerminals.id, posSyncLogs.terminalId))
        .leftJoin(posTransactions, eq(posTransactions.id, posSyncLogs.transactionId))
        .where(where)
        .orderBy(desc(posSyncLogs.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ value: count() })
        .from(posSyncLogs)
        .innerJoin(merchants, eq(merchants.id, posSyncLogs.merchantId))
        .innerJoin(posTerminals, eq(posTerminals.id, posSyncLogs.terminalId))
        .leftJoin(posTransactions, eq(posTransactions.id, posSyncLogs.transactionId))
        .where(where),
    ]);

    return paginated(c, rows, Number(totalRow?.value ?? 0), pagination);
  },
);

async function resolvePosContext(
  terminalId: string,
  registerId: string | undefined,
  shiftId: string | undefined,
  user: AppEnv['Variables']['user'],
  permissions: Set<string>,
): Promise<PosContext> {
  const { terminal } = await getPosTerminal(terminalId, user, permissions);

  let register: typeof cashRegisters.$inferSelect | undefined;
  let shift: typeof cashierShifts.$inferSelect | undefined;

  if (shiftId) {
    const result = await getCashierShift(shiftId, user, permissions);
    shift = result.shift;
    const registerResult = await getCashRegister(shift.registerId, user, permissions);
    register = registerResult.register;
    if (shift.terminalId !== terminal.id) {
      throw ApiError.badRequest('Shift tidak terikat ke terminal ini');
    }
    if (registerId && shift.registerId !== registerId) {
      throw ApiError.badRequest('Shift tidak terikat ke cash register ini');
    }
  } else if (registerId) {
    const result = await getCashRegister(registerId, user, permissions);
    register = result.register;
    if (register.merchantId !== terminal.merchantId || register.storeId !== terminal.storeId) {
      throw ApiError.badRequest('Cash register tidak sesuai dengan terminal');
    }
    if (register.terminalId && register.terminalId !== terminal.id) {
      throw ApiError.badRequest('Cash register terikat ke terminal lain');
    }
    shift = await db.query.cashierShifts.findFirst({
      where: and(
        eq(cashierShifts.registerId, register.id),
        eq(cashierShifts.status, 'open'),
      ),
    });
  } else {
    shift = await db.query.cashierShifts.findFirst({
      where: and(
        eq(cashierShifts.terminalId, terminal.id),
        eq(cashierShifts.status, 'open'),
      ),
      orderBy: desc(cashierShifts.openedAt),
    });
    if (!shift) {
      throw ApiError.badRequest('Tidak ada shift terbuka untuk terminal ini');
    }
    const result = await getCashRegister(shift.registerId, user, permissions);
    register = result.register;
  }

  if (!register) {
    throw ApiError.badRequest('Cash register tidak ditemukan');
  }
  if (!shift) {
    throw ApiError.badRequest('Tidak ada shift kasir terbuka pada cash register ini');
  }
  if (shift.status !== 'open') {
    throw ApiError.badRequest('Shift kasir sudah ditutup');
  }
  if (shift.merchantId !== terminal.merchantId || shift.storeId !== terminal.storeId) {
    throw ApiError.badRequest('Shift tidak sesuai dengan terminal');
  }

  return { terminal, register, shift };
}

async function createTransactionForContext(
  context: PosContext,
  input: TransactionInput,
  user: AppEnv['Variables']['user'],
  permissions: Set<string>,
  syncStatus: 'pending' | 'synced',
) {
  const { terminal, register, shift } = context;

  if (input.clientTransactionId) {
    const existing = await db.query.posTransactions.findFirst({
      where: and(
        eq(posTransactions.terminalId, terminal.id),
        eq(posTransactions.clientTransactionId, input.clientTransactionId),
      ),
    });
    if (existing) return { transaction: existing, created: false };
  }

  const productIds = [...new Set(input.items.map((item) => item.productId))];
  const skuIds = [
    ...new Set(
      input.items
        .map((item) => item.skuId)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const productRows = await db
    .select()
    .from(products)
    .where(and(inArray(products.id, productIds), isNull(products.deletedAt)));
  const skuRows =
    skuIds.length > 0
      ? await db.select().from(productSkus).where(inArray(productSkus.id, skuIds))
      : [];

  const productMap = new Map(productRows.map((row) => [row.id, row]));
  const skuMap = new Map(skuRows.map((row) => [row.id, row]));

  const preparedItems = input.items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) throw ApiError.badRequest('Produk tidak ditemukan');
    if (product.merchantId !== terminal.merchantId) {
      throw ApiError.badRequest(`Produk ${product.name} bukan milik pedagang terminal ini`);
    }
    if (product.status !== 'active') {
      throw ApiError.badRequest(`Produk ${product.name} tidak aktif`);
    }

    let sku: typeof productSkus.$inferSelect | undefined;
    if (item.skuId) {
      sku = skuMap.get(item.skuId);
      if (!sku) throw ApiError.badRequest('SKU produk tidak ditemukan');
      if (sku.productId !== product.id) {
        throw ApiError.badRequest('SKU tidak sesuai dengan produk');
      }
      if (sku.status !== 'active') {
        throw ApiError.badRequest(`SKU ${sku.skuCode} tidak aktif`);
      }
    }

    const unitPrice = Number(sku?.price ?? product.basePrice);
    const discount = Number(item.discountAmount);
    const gross = unitPrice * item.quantity;
    if (discount > gross) {
      throw ApiError.badRequest(`Diskon item ${product.name} melebihi subtotal`);
    }
    const lineTotal = gross - discount;

    return {
      productId: product.id,
      skuId: sku?.id ?? null,
      productName: product.name,
      skuCode: sku?.skuCode ?? null,
      quantity: item.quantity,
      unitPrice: money(unitPrice),
      discountAmount: money(discount),
      lineTotal: money(lineTotal),
      notes: item.notes,
      itemSnapshot: {
        productName: product.name,
        productSlug: product.slug,
        skuCode: sku?.skuCode ?? null,
        unitPrice: money(unitPrice),
      },
      gross,
    };
  });

  const subtotal = preparedItems.reduce((total, item) => total + item.gross, 0);
  const discountTotal = Number(input.discountTotal);
  const taxTotal = Number(input.taxTotal);
  if (discountTotal > subtotal) {
    throw ApiError.badRequest('Diskon transaksi melebihi subtotal');
  }
  const total = subtotal - discountTotal + taxTotal;
  if (total < 0) throw ApiError.badRequest('Total transaksi tidak valid');

  const paidAmount = input.paidAmount === undefined ? total : Number(input.paidAmount);
  if (paidAmount < total) {
    throw ApiError.badRequest('Jumlah pembayaran kurang dari total transaksi');
  }
  const changeAmount =
    input.paymentMethod === 'cash' ? paidAmount - total : 0;
  const itemCount = preparedItems.reduce((sum, item) => sum + item.quantity, 0);
  const now = new Date();

  const insertedTransaction = await db.transaction(async (tx) => {
    const [transaction] = await tx
      .insert(posTransactions)
      .values({
        transactionNumber: generateCode('POS'),
        clientTransactionId: input.clientTransactionId,
        merchantId: terminal.merchantId,
        storeId: terminal.storeId,
        terminalId: terminal.id,
        registerId: register.id,
        shiftId: shift.id,
        cashierId: shift.cashierId,
        status: 'completed',
        syncStatus,
        paymentMethod: input.paymentMethod,
        currency: 'IDR',
        itemCount,
        subtotal: money(subtotal),
        discountTotal: money(discountTotal),
        taxTotal: money(taxTotal),
        total: money(total),
        paidAmount: money(paidAmount),
        changeAmount: money(changeAmount),
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        notes: input.notes,
        offlineCreatedAt: input.offlineCreatedAt,
        completedAt: now,
        syncedAt: syncStatus === 'synced' ? now : null,
        metadata: input.metadata,
      })
      .returning();
    if (!transaction) throw ApiError.internal('Gagal membuat transaksi POS');

    await tx.insert(posTransactionItems).values(
      preparedItems.map((item) => ({
        transactionId: transaction.id,
        productId: item.productId,
        skuId: item.skuId,
        productName: item.productName,
        skuCode: item.skuCode,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountAmount: item.discountAmount,
        lineTotal: item.lineTotal,
        notes: item.notes,
        itemSnapshot: item.itemSnapshot,
      })),
    );

    return transaction;
  });

  const transaction = await db.query.posTransactions.findFirst({
    where: eq(posTransactions.id, insertedTransaction.id),
  });
  if (!transaction) throw ApiError.internal('Transaksi POS tidak ditemukan setelah dibuat');

  if (input.paymentMethod === 'cash' && total > 0) {
    const balance = await getCashBalance(shift.id);
    await db.insert(cashMovements).values({
      merchantId: terminal.merchantId,
      shiftId: shift.id,
      registerId: register.id,
      transactionId: transaction.id,
      type: 'sale',
      amount: money(total),
      balanceAfter: money(balance + total),
      referenceNumber: transaction.transactionNumber,
      note: `Penjualan POS ${transaction.transactionNumber}`,
      createdBy: user.id,
    });
  }

  return { transaction, created: true };
}

async function writeSyncLog(input: {
  merchantId: string;
  terminalId: string;
  transactionId?: string;
  status: 'success' | 'failed' | 'conflict';
  recordsCount: number;
  message: string;
  payload?: Record<string, unknown>;
  errorDetails?: Record<string, unknown>;
  createdBy: string;
}) {
  await db.insert(posSyncLogs).values({
    merchantId: input.merchantId,
    terminalId: input.terminalId,
    transactionId: input.transactionId,
    direction: 'upload',
    status: input.status,
    recordsCount: input.recordsCount,
    message: input.message,
    payload: input.payload,
    errorDetails: input.errorDetails,
    completedAt: new Date(),
    createdBy: input.createdBy,
  });
}
