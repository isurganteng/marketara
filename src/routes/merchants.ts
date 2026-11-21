import { and, count, eq, ilike, isNull, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db';
import {
  marketUnits,
  merchantCategories,
  merchantDocuments,
  merchantMemberships,
  merchantProfiles,
  merchantStatusHistories,
  merchants,
  occupancyRecords,
  stores,
  users,
} from '../db/schema';
import {
  assertMerchantAccess,
  assertOrganizationAccess,
  merchantScopeCondition,
} from '../lib/access';
import { writeAuditLog } from '../lib/audit';
import { ApiError } from '../lib/errors';
import { getPagination, ok, paginated } from '../lib/http';
import type { AppEnv } from '../lib/app-env';
import { generateCode, uniqueSlug } from '../lib/slug';
import { validate } from '../lib/validator';
import { requireAuth, requirePermission } from '../middleware/auth';
import { getClientIp } from '../services/auth';

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD');
const numericString = z
  .union([z.string(), z.number()])
  .transform((value) => String(value));
const merchantStatusSchema = z.enum([
  'draft',
  'pending_verification',
  'verified',
  'rejected',
  'suspended',
  'inactive',
]);
const storeTypeSchema = z.enum(['physical', 'online', 'hybrid']);
const storeStatusSchema = z.enum(['active', 'inactive', 'closed']);
const merchantMemberRoleSchema = z.enum(['owner', 'manager', 'staff']);

const profileSchema = z.object({
  npwp: z.string().trim().max(32).optional(),
  nib: z.string().trim().max(32).optional(),
  foundedAt: dateString.optional(),
  employeeCount: z.coerce.number().int().min(0).optional(),
  annualRevenue: numericString.optional(),
  website: z.string().trim().max(255).optional(),
  instagram: z.string().trim().max(255).optional(),
  facebook: z.string().trim().max(255).optional(),
  marketplaceUrl: z.string().trim().max(2048).optional(),
  longDescription: z.string().trim().max(10000).optional(),
});

const createMerchantSchema = z.object({
  businessName: z.string().trim().min(2).max(255),
  organizationId: z.uuid().optional(),
  categoryCode: z.string().trim().max(64).optional(),
  description: z.string().trim().max(5000).optional(),
  logoUrl: z.string().url().max(2048).optional(),
  phone: z.string().trim().max(32).optional(),
  email: z.string().trim().toLowerCase().max(255).email().optional(),
  profile: profileSchema.optional(),
});

const updateMerchantSchema = z
  .object({
    businessName: z.string().trim().min(2).max(255).optional(),
    categoryCode: z.string().trim().max(64).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    logoUrl: z.string().url().max(2048).nullable().optional(),
    phone: z.string().trim().max(32).nullable().optional(),
    email: z.string().trim().toLowerCase().max(255).email().nullable().optional(),
    profile: profileSchema.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Minimal satu field harus diisi',
  });

const listMerchantsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: merchantStatusSchema.optional(),
  categoryId: z.uuid().optional(),
  organizationId: z.uuid().optional(),
});

const verifyMerchantSchema = z.object({
  status: z.enum(['verified', 'rejected']),
  note: z.string().trim().max(2000).optional(),
});

const documentSchema = z.object({
  documentType: z.string().trim().min(2).max(64),
  documentNumber: z.string().trim().max(128).optional(),
  fileName: z.string().trim().max(255).optional(),
  fileUrl: z.string().url().max(2048),
  issuedAt: dateString.optional(),
  expiresAt: dateString.optional(),
});

const merchantMemberSchema = z.object({
  email: z.string().trim().toLowerCase().max(255).email(),
  role: merchantMemberRoleSchema.default('staff'),
});

const storeSchema = z.object({
  name: z.string().trim().min(2).max(255),
  marketUnitId: z.uuid().optional(),
  type: storeTypeSchema.optional(),
  status: storeStatusSchema.optional(),
  description: z.string().trim().max(5000).optional(),
  phone: z.string().trim().max(32).optional(),
  email: z.string().trim().toLowerCase().max(255).email().optional(),
  address: z.string().trim().max(2000).optional(),
  city: z.string().trim().max(128).optional(),
  province: z.string().trim().max(128).optional(),
  latitude: numericString.optional(),
  longitude: numericString.optional(),
  operatingHours: z.record(z.string(), z.unknown()).optional(),
  isPrimary: z.boolean().optional(),
});

const updateStoreSchema = storeSchema
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Minimal satu field harus diisi',
  });

async function resolveCategoryId(categoryCode?: string) {
  if (!categoryCode) return null;
  const category = await db.query.merchantCategories.findFirst({
    where: eq(merchantCategories.code, categoryCode),
    columns: { id: true },
  });
  if (!category) throw ApiError.badRequest(`Unknown merchant category: ${categoryCode}`);
  return category.id;
}

async function recordStatusChange(input: {
  merchantId: string;
  fromStatus: string;
  toStatus: string;
  reason?: string | null;
  changedBy: string;
}) {
  await db.insert(merchantStatusHistories).values({
    merchantId: input.merchantId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    reason: input.reason ?? null,
    changedBy: input.changedBy,
  });
}

export const merchantRoutes = new Hono<AppEnv>();

merchantRoutes.use('*', requireAuth);

merchantRoutes.get('/', requirePermission('merchant:read'), validate('query', listMerchantsSchema), async (c) => {
  const query = c.req.valid('query');
  const pagination = getPagination(query);

  const conditions = [isNull(merchants.deletedAt)];
  const scope = merchantScopeCondition(c.get('user'), c.get('permissions'));
  if (scope) conditions.push(scope);
  if (query.status) conditions.push(eq(merchants.status, query.status));
  if (query.categoryId) conditions.push(eq(merchants.categoryId, query.categoryId));
  if (query.organizationId) conditions.push(eq(merchants.organizationId, query.organizationId));
  if (query.search) {
    const term = `%${query.search}%`;
    const searchCondition = or(
      ilike(merchants.businessName, term),
      ilike(merchants.code, term),
      ilike(merchants.email, term),
    );
    if (searchCondition) conditions.push(searchCondition);
  }
  const where = and(...conditions);

  const [rows, [{ value } = { value: 0 }]] = await Promise.all([
    db
      .select({
        id: merchants.id,
        code: merchants.code,
        businessName: merchants.businessName,
        slug: merchants.slug,
        status: merchants.status,
        phone: merchants.phone,
        email: merchants.email,
        logoUrl: merchants.logoUrl,
        organizationId: merchants.organizationId,
        categoryId: merchants.categoryId,
        categoryName: merchantCategories.name,
        createdAt: merchants.createdAt,
      })
      .from(merchants)
      .leftJoin(merchantCategories, eq(merchantCategories.id, merchants.categoryId))
      .where(where)
      .orderBy(merchants.businessName)
      .limit(pagination.limit)
      .offset(pagination.offset),
    db.select({ value: count() }).from(merchants).where(where),
  ]);

  return paginated(c, rows, Number(value), pagination);
});

merchantRoutes.post(
  '/',
  requirePermission('merchant:write'),
  validate('json', createMerchantSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');

    if (body.organizationId) {
      await assertOrganizationAccess(body.organizationId, user, c.get('permissions'), {
        manage: true,
      });
    }
    const categoryId = await resolveCategoryId(body.categoryCode);

    const result = await db.transaction(async (tx) => {
      const [merchant] = await tx
        .insert(merchants)
        .values({
          code: generateCode('MRC'),
          ownerUserId: user.id,
          organizationId: body.organizationId ?? null,
          categoryId,
          businessName: body.businessName,
          slug: uniqueSlug(body.businessName),
          description: body.description ?? null,
          logoUrl: body.logoUrl ?? null,
          phone: body.phone ?? null,
          email: body.email ?? null,
          status: 'draft',
        })
        .returning();

      if (!merchant) throw ApiError.internal('Failed to create merchant');

      await tx.insert(merchantMemberships).values({
        merchantId: merchant.id,
        userId: user.id,
        role: 'owner',
        status: 'active',
      });

      if (body.profile) {
        await tx.insert(merchantProfiles).values({
          merchantId: merchant.id,
          npwp: body.profile.npwp ?? null,
          nib: body.profile.nib ?? null,
          foundedAt: body.profile.foundedAt ?? null,
          employeeCount: body.profile.employeeCount ?? null,
          annualRevenue: body.profile.annualRevenue ?? null,
          website: body.profile.website ?? null,
          instagram: body.profile.instagram ?? null,
          facebook: body.profile.facebook ?? null,
          marketplaceUrl: body.profile.marketplaceUrl ?? null,
          longDescription: body.profile.longDescription ?? null,
        });
      }

      await tx.insert(merchantStatusHistories).values({
        merchantId: merchant.id,
        fromStatus: null,
        toStatus: 'draft',
        changedBy: user.id,
      });

      return merchant;
    });

    await writeAuditLog({
      actorUserId: user.id,
      action: 'merchant.create',
      entityType: 'merchant',
      entityId: result.id,
      newValues: { businessName: result.businessName, code: result.code },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });

    return c.json({ success: true as const, data: result }, 201);
  },
);

merchantRoutes.get('/:merchantId', requirePermission('merchant:read'), async (c) => {
  const { merchant, role } = await assertMerchantAccess(
    c.req.param('merchantId'),
    c.get('user'),
    c.get('permissions'),
  );

  const [profile, storeRows, documents, members] = await Promise.all([
    db.query.merchantProfiles.findFirst({
      where: eq(merchantProfiles.merchantId, merchant.id),
    }),
    db
      .select()
      .from(stores)
      .where(and(eq(stores.merchantId, merchant.id), isNull(stores.deletedAt))),
    db
      .select()
      .from(merchantDocuments)
      .where(eq(merchantDocuments.merchantId, merchant.id)),
    db
      .select({
        id: merchantMemberships.id,
        userId: users.id,
        fullName: users.fullName,
        email: users.email,
        role: merchantMemberships.role,
        status: merchantMemberships.status,
      })
      .from(merchantMemberships)
      .innerJoin(users, eq(users.id, merchantMemberships.userId))
      .where(eq(merchantMemberships.merchantId, merchant.id)),
  ]);

  return ok(c, {
    ...merchant,
    accessRole: role,
    profile: profile ?? null,
    stores: storeRows,
    documents,
    members,
  });
});

merchantRoutes.patch(
  '/:merchantId',
  requirePermission('merchant:write'),
  validate('json', updateMerchantSchema),
  async (c) => {
    const { merchant } = await assertMerchantAccess(
      c.req.param('merchantId'),
      c.get('user'),
      c.get('permissions'),
      { manage: true },
    );
    const body = c.req.valid('json');
    const categoryId =
      body.categoryCode !== undefined ? await resolveCategoryId(body.categoryCode) : undefined;

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(merchants)
        .set({
          ...(body.businessName !== undefined ? { businessName: body.businessName } : {}),
          ...(categoryId !== undefined ? { categoryId } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl } : {}),
          ...(body.phone !== undefined ? { phone: body.phone } : {}),
          ...(body.email !== undefined ? { email: body.email } : {}),
        })
        .where(eq(merchants.id, merchant.id))
        .returning();

      if (body.profile && Object.keys(body.profile).length > 0) {
        const profile = body.profile;
        await tx
          .insert(merchantProfiles)
          .values({
            merchantId: merchant.id,
            npwp: profile.npwp ?? null,
            nib: profile.nib ?? null,
            foundedAt: profile.foundedAt ?? null,
            employeeCount: profile.employeeCount ?? null,
            annualRevenue: profile.annualRevenue ?? null,
            website: profile.website ?? null,
            instagram: profile.instagram ?? null,
            facebook: profile.facebook ?? null,
            marketplaceUrl: profile.marketplaceUrl ?? null,
            longDescription: profile.longDescription ?? null,
          })
          .onConflictDoUpdate({
            target: merchantProfiles.merchantId,
            set: {
              ...(profile.npwp !== undefined ? { npwp: profile.npwp } : {}),
              ...(profile.nib !== undefined ? { nib: profile.nib } : {}),
              ...(profile.foundedAt !== undefined ? { foundedAt: profile.foundedAt } : {}),
              ...(profile.employeeCount !== undefined
                ? { employeeCount: profile.employeeCount }
                : {}),
              ...(profile.annualRevenue !== undefined
                ? { annualRevenue: profile.annualRevenue }
                : {}),
              ...(profile.website !== undefined ? { website: profile.website } : {}),
              ...(profile.instagram !== undefined ? { instagram: profile.instagram } : {}),
              ...(profile.facebook !== undefined ? { facebook: profile.facebook } : {}),
              ...(profile.marketplaceUrl !== undefined
                ? { marketplaceUrl: profile.marketplaceUrl }
                : {}),
              ...(profile.longDescription !== undefined
                ? { longDescription: profile.longDescription }
                : {}),
            },
          });
      }

      return row;
    });

    await writeAuditLog({
      actorUserId: c.get('user').id,
      action: 'merchant.update',
      entityType: 'merchant',
      entityId: merchant.id,
      oldValues: { businessName: merchant.businessName },
      newValues: body as Record<string, unknown>,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });

    return ok(c, updated);
  },
);

merchantRoutes.post('/:merchantId/submit', requirePermission('merchant:write'), async (c) => {
  const { merchant } = await assertMerchantAccess(
    c.req.param('merchantId'),
    c.get('user'),
    c.get('permissions'),
    { manage: true },
  );

  if (merchant.status === 'verified') throw ApiError.badRequest('Merchant is already verified');
  if (merchant.status === 'pending_verification') {
    throw ApiError.badRequest('Merchant is already waiting for verification');
  }

  const [updated] = await db
    .update(merchants)
    .set({ status: 'pending_verification', verificationNote: null })
    .where(eq(merchants.id, merchant.id))
    .returning();

  await recordStatusChange({
    merchantId: merchant.id,
    fromStatus: merchant.status,
    toStatus: 'pending_verification',
    changedBy: c.get('user').id,
  });

  return ok(c, updated);
});

merchantRoutes.post(
  '/:merchantId/verify',
  requirePermission('merchant:verify'),
  validate('json', verifyMerchantSchema),
  async (c) => {
    const merchantId = c.req.param('merchantId');
    const merchant = await db.query.merchants.findFirst({
      where: and(eq(merchants.id, merchantId), isNull(merchants.deletedAt)),
    });
    if (!merchant) throw ApiError.notFound('Merchant not found');

    const body = c.req.valid('json');
    if (merchant.status === body.status) {
      throw ApiError.badRequest(`Merchant is already ${body.status}`);
    }

    const [updated] = await db
      .update(merchants)
      .set({
        status: body.status,
        verificationNote: body.note ?? null,
        verifiedAt: body.status === 'verified' ? new Date() : null,
        verifiedBy: c.get('user').id,
      })
      .where(eq(merchants.id, merchantId))
      .returning();

    await recordStatusChange({
      merchantId,
      fromStatus: merchant.status,
      toStatus: body.status,
      reason: body.note,
      changedBy: c.get('user').id,
    });

    await writeAuditLog({
      actorUserId: c.get('user').id,
      action: 'merchant.verify',
      entityType: 'merchant',
      entityId: merchantId,
      oldValues: { status: merchant.status },
      newValues: { status: body.status, note: body.note },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });

    return ok(c, updated);
  },
);

merchantRoutes.get('/:merchantId/status-history', requirePermission('merchant:read'), async (c) => {
  const { merchant } = await assertMerchantAccess(
    c.req.param('merchantId'),
    c.get('user'),
    c.get('permissions'),
  );
  const rows = await db
    .select()
    .from(merchantStatusHistories)
    .where(eq(merchantStatusHistories.merchantId, merchant.id))
    .orderBy(merchantStatusHistories.createdAt);
  return ok(c, rows);
});

/* ----------------------------- Documents ---------------------------- */

merchantRoutes.get('/:merchantId/documents', requirePermission('merchant:read'), async (c) => {
  const { merchant } = await assertMerchantAccess(
    c.req.param('merchantId'),
    c.get('user'),
    c.get('permissions'),
  );
  const rows = await db
    .select()
    .from(merchantDocuments)
    .where(eq(merchantDocuments.merchantId, merchant.id))
    .orderBy(merchantDocuments.createdAt);
  return ok(c, rows);
});

merchantRoutes.post(
  '/:merchantId/documents',
  requirePermission('merchant:write'),
  validate('json', documentSchema),
  async (c) => {
    const { merchant } = await assertMerchantAccess(
      c.req.param('merchantId'),
      c.get('user'),
      c.get('permissions'),
      { manage: true },
    );
    const body = c.req.valid('json');

    const [document] = await db
      .insert(merchantDocuments)
      .values({
        merchantId: merchant.id,
        documentType: body.documentType,
        documentNumber: body.documentNumber ?? null,
        fileName: body.fileName ?? null,
        fileUrl: body.fileUrl,
        issuedAt: body.issuedAt ?? null,
        expiresAt: body.expiresAt ?? null,
        uploadedBy: c.get('user').id,
      })
      .returning();

    return c.json({ success: true as const, data: document }, 201);
  },
);

/* ------------------------------ Members ----------------------------- */

merchantRoutes.get('/:merchantId/members', requirePermission('merchant:read'), async (c) => {
  const { merchant } = await assertMerchantAccess(
    c.req.param('merchantId'),
    c.get('user'),
    c.get('permissions'),
  );
  const rows = await db
    .select({
      id: merchantMemberships.id,
      userId: users.id,
      fullName: users.fullName,
      email: users.email,
      role: merchantMemberships.role,
      status: merchantMemberships.status,
    })
    .from(merchantMemberships)
    .innerJoin(users, eq(users.id, merchantMemberships.userId))
    .where(eq(merchantMemberships.merchantId, merchant.id));
  return ok(c, rows);
});

merchantRoutes.post(
  '/:merchantId/members',
  requirePermission('merchant:write'),
  validate('json', merchantMemberSchema),
  async (c) => {
    const { merchant } = await assertMerchantAccess(
      c.req.param('merchantId'),
      c.get('user'),
      c.get('permissions'),
      { manage: true },
    );
    const body = c.req.valid('json');

    const targetUser = await db.query.users.findFirst({
      columns: { id: true, fullName: true, email: true },
      where: and(eq(users.email, body.email), isNull(users.deletedAt)),
    });
    if (!targetUser) throw ApiError.notFound('User with that email was not found');
    if (targetUser.id === merchant.ownerUserId && body.role !== 'owner') {
      throw ApiError.badRequest('Merchant owner must keep the owner role');
    }

    const [member] = await db
      .insert(merchantMemberships)
      .values({
        merchantId: merchant.id,
        userId: targetUser.id,
        role: body.role,
        status: 'active',
      })
      .onConflictDoUpdate({
        target: [merchantMemberships.merchantId, merchantMemberships.userId],
        set: { role: body.role, status: 'active', updatedAt: new Date() },
      })
      .returning();

    return c.json(
      { success: true as const, data: { ...member, user: targetUser } },
      201,
    );
  },
);

merchantRoutes.delete(
  '/:merchantId/members/:memberId',
  requirePermission('merchant:write'),
  async (c) => {
    const { merchant } = await assertMerchantAccess(
      c.req.param('merchantId'),
      c.get('user'),
      c.get('permissions'),
      { manage: true },
    );
    const memberId = c.req.param('memberId');

    const member = await db.query.merchantMemberships.findFirst({
      where: and(
        eq(merchantMemberships.id, memberId),
        eq(merchantMemberships.merchantId, merchant.id),
      ),
    });
    if (!member) throw ApiError.notFound('Member not found');
    if (member.userId === merchant.ownerUserId) {
      throw ApiError.badRequest('Cannot remove the merchant owner');
    }

    await db
      .update(merchantMemberships)
      .set({ status: 'left' })
      .where(eq(merchantMemberships.id, member.id));
    return ok(c, { message: 'Member removed' });
  },
);

/* ------------------------------- Stores ----------------------------- */

merchantRoutes.get('/:merchantId/stores', requirePermission('store:read'), async (c) => {
  const { merchant } = await assertMerchantAccess(
    c.req.param('merchantId'),
    c.get('user'),
    c.get('permissions'),
  );
  const rows = await db
    .select()
    .from(stores)
    .where(and(eq(stores.merchantId, merchant.id), isNull(stores.deletedAt)))
    .orderBy(stores.name);
  return ok(c, rows);
});

merchantRoutes.post(
  '/:merchantId/stores',
  requirePermission('store:write'),
  validate('json', storeSchema),
  async (c) => {
    const { merchant } = await assertMerchantAccess(
      c.req.param('merchantId'),
      c.get('user'),
      c.get('permissions'),
      { manage: true },
    );
    const body = c.req.valid('json');

    if (body.marketUnitId) {
      const occupancy = await db.query.occupancyRecords.findFirst({
        where: and(
          eq(occupancyRecords.marketUnitId, body.marketUnitId),
          eq(occupancyRecords.merchantId, merchant.id),
          eq(occupancyRecords.status, 'active'),
        ),
        columns: { id: true },
      });
      if (!occupancy) {
        throw ApiError.badRequest('Unit is not occupied by this merchant');
      }
    }

    const store = await db.transaction(async (tx) => {
      if (body.isPrimary) {
        await tx
          .update(stores)
          .set({ isPrimary: false })
          .where(eq(stores.merchantId, merchant.id));
      }

      const [created] = await tx
        .insert(stores)
        .values({
          merchantId: merchant.id,
          marketUnitId: body.marketUnitId ?? null,
          name: body.name,
          slug: uniqueSlug(body.name, merchant.code.toLowerCase()),
          type: body.type ?? 'physical',
          status: body.status ?? 'active',
          description: body.description ?? null,
          phone: body.phone ?? null,
          email: body.email ?? null,
          address: body.address ?? null,
          city: body.city ?? null,
          province: body.province ?? null,
          latitude: body.latitude ?? null,
          longitude: body.longitude ?? null,
          operatingHours: body.operatingHours ?? null,
          isPrimary: body.isPrimary ?? false,
        })
        .returning();

      return created;
    });

    await writeAuditLog({
      actorUserId: c.get('user').id,
      action: 'store.create',
      entityType: 'store',
      entityId: store?.id,
      newValues: { merchantId: merchant.id, name: body.name },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });

    return c.json({ success: true as const, data: store }, 201);
  },
);

merchantRoutes.patch(
  '/stores/:storeId',
  requirePermission('store:write'),
  validate('json', updateStoreSchema),
  async (c) => {
    const storeId = c.req.param('storeId');
    const store = await db.query.stores.findFirst({
      where: and(eq(stores.id, storeId), isNull(stores.deletedAt)),
    });
    if (!store) throw ApiError.notFound('Store not found');

    await assertMerchantAccess(store.merchantId, c.get('user'), c.get('permissions'), {
      manage: true,
    });

    const body = c.req.valid('json');

    if (body.marketUnitId) {
      const occupancy = await db.query.occupancyRecords.findFirst({
        where: and(
          eq(occupancyRecords.marketUnitId, body.marketUnitId),
          eq(occupancyRecords.merchantId, store.merchantId),
          eq(occupancyRecords.status, 'active'),
        ),
        columns: { id: true },
      });
      if (!occupancy) throw ApiError.badRequest('Unit is not occupied by this merchant');
    }

    const updated = await db.transaction(async (tx) => {
      if (body.isPrimary) {
        await tx
          .update(stores)
          .set({ isPrimary: false })
          .where(eq(stores.merchantId, store.merchantId));
      }

      const [row] = await tx
        .update(stores)
        .set({
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.marketUnitId !== undefined ? { marketUnitId: body.marketUnitId } : {}),
          ...(body.type !== undefined ? { type: body.type } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.phone !== undefined ? { phone: body.phone } : {}),
          ...(body.email !== undefined ? { email: body.email } : {}),
          ...(body.address !== undefined ? { address: body.address } : {}),
          ...(body.city !== undefined ? { city: body.city } : {}),
          ...(body.province !== undefined ? { province: body.province } : {}),
          ...(body.latitude !== undefined ? { latitude: body.latitude } : {}),
          ...(body.longitude !== undefined ? { longitude: body.longitude } : {}),
          ...(body.operatingHours !== undefined
            ? { operatingHours: body.operatingHours }
            : {}),
          ...(body.isPrimary !== undefined ? { isPrimary: body.isPrimary } : {}),
        })
        .where(eq(stores.id, store.id))
        .returning();
      return row;
    });

    return ok(c, updated);
  },
);

merchantRoutes.delete(
  '/stores/:storeId',
  requirePermission('store:write'),
  async (c) => {
    const storeId = c.req.param('storeId');
    const store = await db.query.stores.findFirst({
      where: and(eq(stores.id, storeId), isNull(stores.deletedAt)),
    });
    if (!store) throw ApiError.notFound('Store not found');

    await assertMerchantAccess(store.merchantId, c.get('user'), c.get('permissions'), {
      manage: true,
    });

    await db
      .update(stores)
      .set({ deletedAt: new Date(), status: 'closed' })
      .where(eq(stores.id, store.id));

    return ok(c, { message: 'Store archived' });
  },
);

