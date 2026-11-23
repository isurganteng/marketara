import { and, eq, isNull, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import {
  businessProposals,
  dataRooms,
  financingRecords,
  fundingApplications,
  fundingOpportunities,
  investorProfiles,
  merchants,
  organizationMembers,
} from '../../db/schema';
import {
  assertMerchantAccess,
  isOrgManager,
  isPlatformAdmin,
  merchantScopeCondition,
} from '../../lib/access';
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

export const optionalText = (max = 6000) => z.string().trim().max(max).optional().nullable();

export const codeSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'Gunakan huruf, angka, garis bawah, atau tanda hubung');

/**
 * Scope funding harus dipakai bersama join ke tabel merchants. Nilai balik
 * berupa kondisi pada merchants agar konsisten dengan modul lain.
 */
export function fundingMerchantScope(
  user: AuthUser,
  permissions: Set<string>,
): SQL | undefined {
  if (isPlatformAdmin(permissions)) return undefined;
  return merchantScopeCondition(user, permissions);
}

export async function assertFundingAccess(
  merchantId: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  return assertMerchantAccess(merchantId, user, permissions, options);
}

async function accessRecord<T extends { merchantId: string }>(
  record: T | undefined,
  label: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  if (!record) throw ApiError.notFound(`${label} tidak ditemukan`);
  const access = await assertFundingAccess(record.merchantId, user, permissions, options);
  return { record, ...access };
}

export async function getProposal(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.businessProposals.findFirst({
    where: and(eq(businessProposals.id, id), isNull(businessProposals.deletedAt)),
  });
  const result = await accessRecord(row, 'Proposal bisnis', user, permissions, options);
  return { proposal: result.record, ...result };
}

export async function getDataRoom(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.dataRooms.findFirst({
    where: eq(dataRooms.id, id),
  });
  const result = await accessRecord(row, 'Data room', user, permissions, options);
  return { dataRoom: result.record, ...result };
}

export async function getApplication(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.fundingApplications.findFirst({
    where: eq(fundingApplications.id, id),
  });
  const result = await accessRecord(row, 'Pengajuan pendanaan', user, permissions, options);
  return { application: result.record, ...result };
}

export async function getFinancing(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.financingRecords.findFirst({
    where: eq(financingRecords.id, id),
  });
  const result = await accessRecord(row, 'Fasilitas pendanaan', user, permissions, options);
  return { financing: result.record, ...result };
}

export async function assertOpportunityManage(
  opportunity: { ownerUserId: string | null; organizationId: string | null },
  user: AuthUser,
  permissions: Set<string>,
) {
  if (isPlatformAdmin(permissions)) return;
  if (opportunity.ownerUserId === user.id) return;
  if (opportunity.organizationId) {
    const membership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.organizationId, opportunity.organizationId),
        eq(organizationMembers.userId, user.id),
        eq(organizationMembers.status, 'active'),
      ),
    });
    if (membership && isOrgManager(membership.role)) return;
  }
  throw ApiError.forbidden('Hanya pemilik atau admin organisasi yang dapat mengelola peluang');
}

export async function getOpportunity(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.fundingOpportunities.findFirst({
    where: eq(fundingOpportunities.id, id),
  });
  if (!row) throw ApiError.notFound('Peluang pendanaan tidak ditemukan');
  if (options.manage) {
    await assertOpportunityManage(row, user, permissions);
  } else if (!isPlatformAdmin(permissions) && row.status !== 'open') {
    await assertOpportunityManage(row, user, permissions);
  }
  return row;
}

export async function assertInvestorManage(
  investor: { userId: string | null; organizationId: string | null },
  user: AuthUser,
  permissions: Set<string>,
) {
  if (isPlatformAdmin(permissions)) return;
  if (investor.userId === user.id) return;
  if (investor.organizationId) {
    const membership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.organizationId, investor.organizationId),
        eq(organizationMembers.userId, user.id),
        eq(organizationMembers.status, 'active'),
      ),
    });
    if (membership && isOrgManager(membership.role)) return;
  }
  throw ApiError.forbidden('Hanya pemilik atau admin organisasi yang dapat mengelola profil investor');
}

export async function getInvestor(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.investorProfiles.findFirst({
    where: eq(investorProfiles.id, id),
  });
  if (!row) throw ApiError.notFound('Profil investor tidak ditemukan');
  if (options.manage) {
    await assertInvestorManage(row, user, permissions);
  } else if (!isPlatformAdmin(permissions) && row.status !== 'active') {
    await assertInvestorManage(row, user, permissions);
  }
  return row;
}

export function toNumber(value: string | number | null | undefined): number {
  return Number(value ?? 0);
}

export function money(value: number): string {
  return value.toFixed(2);
}

export function computeRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}
