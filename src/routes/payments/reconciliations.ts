import { and, count, desc, eq, gte, ilike, inArray, lte, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import { paymentProviders, payments, reconciliations } from '../../db/schema';
import { writeAuditLog } from '../../lib/audit';
import type { AppEnv } from '../../lib/app-env';
import { ApiError } from '../../lib/errors';
import { getPagination, ok, paginated } from '../../lib/http';
import { generateCode } from '../../lib/slug';
import { validate } from '../../lib/validator';
import { requirePermission } from '../../middleware/auth';
import { getClientIp } from '../../services/auth';
import { money, numericString } from '../commerce/shared';
import { PAYMENT_SETTLED_STATUSES } from './shared';

const reconciliationStatusSchema = z.enum(['draft', 'completed', 'discrepancy', 'failed']);

const listReconciliationsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: reconciliationStatusSchema.optional(),
  providerId: z.uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const reconciliationLineSchema = z.object({
  externalReference: z.string().trim().min(1).max(128),
  amount: numericString,
  status: z.string().trim().max(32).optional(),
});

const createReconciliationSchema = z.object({
  providerId: z.uuid(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  externalAmount: numericString.optional(),
  lines: z.array(reconciliationLineSchema).max(1000).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const paymentReconciliationRoutes = new Hono<AppEnv>();

paymentReconciliationRoutes.get(
  '/reconciliations',
  requirePermission('payment:manage'),
  validate('query', listReconciliationsSchema),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.status) conditions.push(eq(reconciliations.status, query.status));
    if (query.providerId) {
      conditions.push(eq(reconciliations.providerId, query.providerId));
    }
    if (query.from) conditions.push(gte(reconciliations.periodStart, query.from));
    if (query.to) conditions.push(lte(reconciliations.periodEnd, query.to));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        ilike(reconciliations.reconciliationNumber, term) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: reconciliations.id,
          reconciliationNumber: reconciliations.reconciliationNumber,
          providerId: reconciliations.providerId,
          providerName: paymentProviders.name,
          status: reconciliations.status,
          currency: reconciliations.currency,
          periodStart: reconciliations.periodStart,
          periodEnd: reconciliations.periodEnd,
          internalAmount: reconciliations.internalAmount,
          externalAmount: reconciliations.externalAmount,
          differenceAmount: reconciliations.differenceAmount,
          matchedCount: reconciliations.matchedCount,
          unmatchedCount: reconciliations.unmatchedCount,
          notes: reconciliations.notes,
          completedAt: reconciliations.completedAt,
          createdAt: reconciliations.createdAt,
        })
        .from(reconciliations)
        .innerJoin(
          paymentProviders,
          eq(paymentProviders.id, reconciliations.providerId),
        )
        .where(where)
        .orderBy(desc(reconciliations.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ value: count() })
        .from(reconciliations)
        .innerJoin(
          paymentProviders,
          eq(paymentProviders.id, reconciliations.providerId),
        )
        .where(where),
    ]);

    return paginated(c, rows, Number(totalRow?.value ?? 0), pagination);
  },
);

paymentReconciliationRoutes.get(
  '/reconciliations/:reconciliationId',
  requirePermission('payment:manage'),
  async (c) => {
    const row = await db.query.reconciliations.findFirst({
      where: eq(reconciliations.id, c.req.param('reconciliationId')),
    });
    if (!row) throw ApiError.notFound('Rekonsiliasi tidak ditemukan');
    return ok(c, row);
  },
);

paymentReconciliationRoutes.post(
  '/reconciliations',
  requirePermission('payment:manage'),
  validate('json', createReconciliationSchema),
  async (c) => {
    const body = c.req.valid('json');
    if (body.periodEnd <= body.periodStart) {
      throw ApiError.badRequest('Periode rekonsiliasi tidak valid');
    }
    const provider = await db.query.paymentProviders.findFirst({
      where: eq(paymentProviders.id, body.providerId),
    });
    if (!provider) throw ApiError.notFound('Provider pembayaran tidak ditemukan');

    const rows = await db
      .select({
        id: payments.id,
        paymentNumber: payments.paymentNumber,
        externalReference: payments.externalReference,
        amount: payments.amount,
        status: payments.status,
        paidAt: payments.paidAt,
        currency: payments.currency,
      })
      .from(payments)
      .where(
        and(
          eq(payments.providerId, body.providerId),
          inArray(payments.status, [...PAYMENT_SETTLED_STATUSES]),
          gte(payments.paidAt, body.periodStart),
          lte(payments.paidAt, body.periodEnd),
        ),
      )
      .orderBy(desc(payments.paidAt));

    const internalAmount = rows.reduce((sum, row) => sum + Number(row.amount), 0);
    const lineMap = new Map(
      (body.lines ?? []).map((line) => [line.externalReference, Number(line.amount)]),
    );
    const linesProvided = body.lines !== undefined;

    let matchedCount = 0;
    let unmatchedCount = 0;
    const paymentDetails = rows.map((row) => {
      const lineAmount = row.externalReference
        ? lineMap.get(row.externalReference)
        : undefined;
      const matched = linesProvided
        ? lineAmount !== undefined && Math.abs(lineAmount - Number(row.amount)) < 0.01
        : true;
      if (matched) matchedCount += 1;
      else unmatchedCount += 1;
      return {
        paymentId: row.id,
        paymentNumber: row.paymentNumber,
        externalReference: row.externalReference,
        amount: row.amount,
        status: row.status,
        paidAt: row.paidAt,
        matched,
        externalAmount: lineAmount ?? null,
      };
    });

    const externalAmount = body.externalAmount
      ? Number(body.externalAmount)
      : linesProvided
        ? (body.lines ?? []).reduce((sum, line) => sum + Number(line.amount), 0)
        : internalAmount;
    const differenceAmount = externalAmount - internalAmount;
    const status =
      Math.abs(differenceAmount) < 0.01 && unmatchedCount === 0
        ? 'completed'
        : 'discrepancy';

    const [reconciliation] = await db
      .insert(reconciliations)
      .values({
        reconciliationNumber: generateCode('REC'),
        providerId: body.providerId,
        status,
        currency: rows[0]?.currency ?? 'IDR',
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
        internalAmount: money(internalAmount),
        externalAmount: money(externalAmount),
        differenceAmount: money(differenceAmount),
        matchedCount,
        unmatchedCount,
        details: {
          payments: paymentDetails,
          lines: body.lines ?? [],
        },
        notes: body.notes ?? null,
        reconciledBy: c.get('user').id,
        completedAt: new Date(),
      })
      .returning();
    if (!reconciliation) throw ApiError.internal('Gagal membuat rekonsiliasi');

    await writeAuditLog({
      actorUserId: c.get('user').id,
      action: 'reconciliation.create',
      entityType: 'reconciliation',
      entityId: reconciliation.id,
      newValues: reconciliation,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    });

    return ok(c, reconciliation, 201);
  },
);
