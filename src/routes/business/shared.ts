import { and, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import {
  businessKpis,
  businessProfiles,
  businessTargets,
  merchantPerformanceReports,
  merchants,
  performancePeriods,
} from '../../db/schema';
import { assertMerchantAccess, isPlatformAdmin, merchantScopeCondition } from '../../lib/access';
import { ApiError } from '../../lib/errors';
import type { AuthUser } from '../../types';

export const numericSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine(
    (value) => value.trim() !== '' && !Number.isNaN(Number(value)) && Number(value) >= 0,
    'Harus berupa angka >= 0',
  );

export const positiveNumericSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine(
    (value) => value.trim() !== '' && !Number.isNaN(Number(value)) && Number(value) > 0,
    'Harus berupa angka lebih dari 0',
  );

export const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Gunakan format YYYY-MM-DD');

export const optionalText = (max = 4000) =>
  z.string().trim().max(max).optional().nullable();

export function businessScopeCondition(
  user: AuthUser,
  permissions: Set<string>,
): SQL | undefined {
  if (isPlatformAdmin(permissions)) return undefined;

  const merchantCondition = merchantScopeCondition(user, permissions);
  return inArray(
    merchants.id,
    db
      .select({ id: merchants.id })
      .from(merchants)
      .where(and(merchantCondition, isNull(merchants.deletedAt))),
  );
}

export async function assertBusinessAccess(
  merchantId: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  return assertMerchantAccess(merchantId, user, permissions, options);
}

export function toNumber(value: string | number | null | undefined): number {
  return Number(value ?? 0);
}

async function accessRecord<T extends { merchantId: string }>(
  record: T | undefined,
  label: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  if (!record) throw ApiError.notFound(`${label} tidak ditemukan`);
  const access = await assertBusinessAccess(record.merchantId, user, permissions, options);
  return { record, ...access };
}

export async function getBusinessProfile(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.businessProfiles.findFirst({
    where: and(eq(businessProfiles.id, id), isNull(businessProfiles.deletedAt)),
  });
  const result = await accessRecord(row, 'Profil bisnis', user, permissions, options);
  return { profile: result.record, ...result };
}

export async function getPerformancePeriod(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.performancePeriods.findFirst({
    where: eq(performancePeriods.id, id),
  });
  const result = await accessRecord(row, 'Periode kinerja', user, permissions, options);
  return { period: result.record, ...result };
}

export async function getBusinessKpi(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.businessKpis.findFirst({
    where: eq(businessKpis.id, id),
  });
  const result = await accessRecord(row, 'KPI', user, permissions, options);
  return { kpi: result.record, ...result };
}

export async function getPerformanceReport(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.merchantPerformanceReports.findFirst({
    where: eq(merchantPerformanceReports.id, id),
  });
  const result = await accessRecord(row, 'Laporan kinerja', user, permissions, options);
  return { report: result.record, ...result };
}

export async function getBusinessTarget(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.businessTargets.findFirst({
    where: eq(businessTargets.id, id),
  });
  const result = await accessRecord(row, 'Target bisnis', user, permissions, options);
  return { target: result.record, ...result };
}

export function computeAchievement(
  value: string | number | null | undefined,
  target: string | number | null | undefined,
  direction: 'higher_better' | 'lower_better',
): string | null {
  const actual = toNumber(value);
  const goal = toNumber(target);
  if (!goal) return null;
  const percent = direction === 'lower_better' ? (goal / Math.max(actual, 1)) * 100 : (actual / goal) * 100;
  return percent.toFixed(2);
}
