import { and, eq, inArray, isNull, or, type SQL } from 'drizzle-orm';
import { db } from '../db';
import {
  merchantMemberships,
  merchants,
  organizationMembers,
  organizations,
  storefronts,
  type merchants as merchantsTable,
} from '../db/schema';
import { products } from '../db/schema/catalog';
import { ApiError } from './errors';
import type { AuthUser } from '../types';
import type { InferSelectModel } from 'drizzle-orm';

type Merchant = InferSelectModel<typeof merchantsTable>;

export const ORG_MANAGER_ROLES = ['owner', 'admin'] as const;
export const MERCHANT_MANAGER_ROLES = ['owner', 'manager'] as const;

export function isPlatformAdmin(permissions: Set<string>): boolean {
  return permissions.has('*');
}

export function isOrgManager(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

export function isMerchantManager(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'manager';
}

export async function getOrganizationIdsForUser(userId: string): Promise<string[]> {
  const rows = await db
    .select({ id: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.status, 'active'),
      ),
    );
  return rows.map((row) => row.id);
}

export async function assertOrganizationAccess(
  organizationId: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
) {
  const org = await db.query.organizations.findFirst({
    where: and(eq(organizations.id, organizationId), isNull(organizations.deletedAt)),
  });
  if (!org) throw ApiError.notFound('Organization not found');

  if (isPlatformAdmin(permissions)) return { org, membership: null };

  const membership = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.userId, user.id),
      eq(organizationMembers.status, 'active'),
    ),
  });

  // Jangan bocorkan keberadaan organisasi kepada non-anggota.
  if (!membership) throw ApiError.notFound('Organization not found');
  if (options.manage && !isOrgManager(membership.role)) {
    throw ApiError.forbidden('Only organization owner or admin can perform this action');
  }

  return { org, membership };
}

export async function assertMerchantAccess(
  merchantId: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
): Promise<{ merchant: Merchant; role: string; via: 'admin' | 'owner' | 'organization' | 'membership' }> {
  const merchant = await db.query.merchants.findFirst({
    where: and(eq(merchants.id, merchantId), isNull(merchants.deletedAt)),
  });
  if (!merchant) throw ApiError.notFound('Merchant not found');

  if (isPlatformAdmin(permissions)) {
    return { merchant, role: 'admin', via: 'admin' };
  }

  if (merchant.ownerUserId === user.id) {
    return { merchant, role: 'owner', via: 'owner' };
  }

  if (merchant.organizationId) {
    const orgMembership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.organizationId, merchant.organizationId),
        eq(organizationMembers.userId, user.id),
        eq(organizationMembers.status, 'active'),
      ),
    });
    if (orgMembership) {
      if (options.manage && !isOrgManager(orgMembership.role)) {
        throw ApiError.forbidden('Only organization owner or admin can manage this merchant');
      }
      return { merchant, role: orgMembership.role, via: 'organization' };
    }
  }

  const membership = await db.query.merchantMemberships.findFirst({
    where: and(
      eq(merchantMemberships.merchantId, merchantId),
      eq(merchantMemberships.userId, user.id),
      eq(merchantMemberships.status, 'active'),
    ),
  });

  if (!membership) throw ApiError.notFound('Merchant not found');
  if (options.manage && !isMerchantManager(membership.role)) {
    throw ApiError.forbidden('Only merchant owner or manager can perform this action');
  }

  return { merchant, role: membership.role, via: 'membership' };
}

/**
 * Filter daftar merchant sesuai akses:
 * - platform admin: semua
 * - lainnya: merchant milik sendiri, milik organisasi tempat ia anggota,
 *   atau merchant tempat ia terdaftar sebagai member.
 */
export function merchantScopeCondition(user: AuthUser, permissions: Set<string>): SQL | undefined {  if (isPlatformAdmin(permissions)) return undefined;

  const orgIds = db
    .select({ id: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, user.id),
        eq(organizationMembers.status, 'active'),
      ),
    );

  const merchantIds = db
    .select({ id: merchantMemberships.merchantId })
    .from(merchantMemberships)
    .where(
      and(
        eq(merchantMemberships.userId, user.id),
        eq(merchantMemberships.status, 'active'),
      ),
    );

  return or(
    eq(merchants.ownerUserId, user.id),
    inArray(merchants.organizationId, orgIds),
    inArray(merchants.id, merchantIds),
  );
}

type Product = InferSelectModel<typeof products>;

/**
 * Akses produk diturunkan dari akses merchant pemilik produk.
 * Non-admin hanya bisa melihat produk merchant yang boleh diakses.
 */
export async function assertProductAccess(
  productId: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
): Promise<{ product: Product; merchant: Merchant; role: string }> {
  const product = await db.query.products.findFirst({
    where: and(eq(products.id, productId), isNull(products.deletedAt)),
  });
  if (!product) throw ApiError.notFound('Product not found');

  const access = await assertMerchantAccess(product.merchantId, user, permissions, options);
  return { product, merchant: access.merchant, role: access.role };
}

/** Filter daftar produk sesuai merchant yang boleh diakses user. */
export function productScopeCondition(
  user: AuthUser,
  permissions: Set<string>,
): SQL | undefined {
  const condition = merchantScopeCondition(user, permissions);
  if (!condition) return undefined;

  const ids = db
    .select({ id: merchants.id })
    .from(merchants)
    .where(and(condition, isNull(merchants.deletedAt)));

  return inArray(products.merchantId, ids);
}

type Storefront = InferSelectModel<typeof storefronts>;

/** Akses storefront mengikuti akses merchant pemiliknya. */
export async function assertStorefrontAccess(
  storefrontId: string,
  user: AuthUser,
  permissions: Set<string>,
  options: { manage?: boolean } = {},
): Promise<{ storefront: Storefront; merchant: Merchant; role: string }> {
  const storefront = await db.query.storefronts.findFirst({
    where: and(eq(storefronts.id, storefrontId), isNull(storefronts.deletedAt)),
  });
  if (!storefront) throw ApiError.notFound('Storefront not found');

  const access = await assertMerchantAccess(
    storefront.merchantId,
    user,
    permissions,
    options,
  );
  return { storefront, merchant: access.merchant, role: access.role };
}

/** Filter daftar storefront sesuai merchant yang boleh diakses user. */
export function storefrontScopeCondition(
  user: AuthUser,
  permissions: Set<string>,
): SQL | undefined {
  const condition = merchantScopeCondition(user, permissions);
  if (!condition) return undefined;

  const ids = db
    .select({ id: merchants.id })
    .from(merchants)
    .where(and(condition, isNull(merchants.deletedAt)));

  return inArray(storefronts.merchantId, ids);
}

