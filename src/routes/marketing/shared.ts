import { and, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import {
  advertisements,
  campaignChannels,
  campaignPerformance,
  coupons,
  customerComplaints,
  customerGroups,
  customerInteractions,
  customerSegments,
  customers,
  loyaltyAccounts,
  marketingCampaigns,
  merchants,
  promotions,
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

export function marketingScopeCondition(
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

export async function assertMarketingAccess(
  merchantId: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  return assertMerchantAccess(merchantId, user, permissions, options);
}

export function money(value: number): string {
  return value.toFixed(2);
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
  const access = await assertMarketingAccess(record.merchantId, user, permissions, options);
  return { record, ...access };
}

export async function getCampaign(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.marketingCampaigns.findFirst({
    where: eq(marketingCampaigns.id, id),
  });
  const result = await accessRecord(row, 'Kampanye', user, permissions, options);
  return { campaign: result.record, ...result };
}

export async function getCampaignChannel(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.campaignChannels.findFirst({
    where: eq(campaignChannels.id, id),
  });
  const result = await accessRecord(row, 'Channel kampanye', user, permissions, options);
  return { channel: result.record, ...result };
}

export async function getPromotion(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.promotions.findFirst({
    where: eq(promotions.id, id),
  });
  const result = await accessRecord(row, 'Promosi', user, permissions, options);
  return { promotion: result.record, ...result };
}

export async function getCoupon(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.coupons.findFirst({
    where: eq(coupons.id, id),
  });
  const result = await accessRecord(row, 'Kupon', user, permissions, options);
  return { coupon: result.record, ...result };
}

export async function getCustomer(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.customers.findFirst({
    where: and(eq(customers.id, id), isNull(customers.deletedAt)),
  });
  const result = await accessRecord(row, 'Pelanggan', user, permissions, options);
  return { customer: result.record, ...result };
}

export async function getCustomerGroup(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.customerGroups.findFirst({
    where: eq(customerGroups.id, id),
  });
  const result = await accessRecord(row, 'Grup pelanggan', user, permissions, options);
  return { group: result.record, ...result };
}

export async function getCustomerSegment(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.customerSegments.findFirst({
    where: eq(customerSegments.id, id),
  });
  const result = await accessRecord(row, 'Segmen pelanggan', user, permissions, options);
  return { segment: result.record, ...result };
}

export async function getLoyaltyAccount(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.loyaltyAccounts.findFirst({
    where: eq(loyaltyAccounts.id, id),
  });
  const result = await accessRecord(row, 'Akun loyalty', user, permissions, options);
  return { account: result.record, ...result };
}

export async function getInteraction(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.customerInteractions.findFirst({
    where: eq(customerInteractions.id, id),
  });
  const result = await accessRecord(row, 'Interaksi pelanggan', user, permissions, options);
  return { interaction: result.record, ...result };
}

export async function getComplaint(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.customerComplaints.findFirst({
    where: eq(customerComplaints.id, id),
  });
  const result = await accessRecord(row, 'Keluhan pelanggan', user, permissions, options);
  return { complaint: result.record, ...result };
}

export async function getAdvertisement(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.advertisements.findFirst({
    where: eq(advertisements.id, id),
  });
  const result = await accessRecord(row, 'Iklan', user, permissions, options);
  return { advertisement: result.record, ...result };
}

export async function getPerformance(
  id: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const row = await db.query.campaignPerformance.findFirst({
    where: eq(campaignPerformance.id, id),
  });
  const result = await accessRecord(row, 'Performa kampanye', user, permissions, options);
  return { performance: result.record, ...result };
}
