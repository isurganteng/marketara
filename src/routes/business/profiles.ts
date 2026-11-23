import { and, asc, count, desc, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  businessActivityRecords,
  businessHistory,
  businessLegalDocuments,
  businessLocations,
  businessProfiles,
  businessProfileShares,
  businessVerifications,
  customers,
  merchants,
  orders,
  products,
} from '../../db/schema';
import { writeAuditLog } from '../../lib/audit';
import type { AppEnv } from '../../lib/app-env';
import { ApiError } from '../../lib/errors';
import { getPagination, ok, paginated } from '../../lib/http';
import { generateCode } from '../../lib/slug';
import { hashToken, generateSessionToken } from '../../lib/crypto';
import { validate } from '../../lib/validator';
import { requirePermission } from '../../middleware/auth';
import { getClientIp } from '../../services/auth';
import {
  assertBusinessAccess,
  businessScopeCondition,
  dateOnlySchema,
  getBusinessProfile,
  numericSchema,
  optionalText,
  toNumber,
} from './shared';

const profileStatusSchema = z.enum(['draft', 'active', 'verified', 'suspended', 'archived']);
const legalStatusSchema = z.enum([
  'informal',
  'micro',
  'small',
  'medium',
  'cooperative',
  'limited_company',
  'other',
]);
const verificationStatusSchema = z.enum(['pending', 'in_review', 'verified', 'rejected']);
const locationTypeSchema = z.enum([
  'headquarters',
  'branch',
  'store',
  'warehouse',
  'production',
  'other',
]);
const documentStatusSchema = z.enum(['pending', 'verified', 'rejected', 'expired']);
const shareStatusSchema = z.enum(['active', 'revoked', 'expired']);
const codeSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'Gunakan huruf, angka, garis bawah, atau tanda hubung');

const listProfileSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  status: profileStatusSchema.optional(),
  verificationStatus: verificationStatusSchema.optional(),
});

const createProfileSchema = z.object({
  merchantId: z.uuid(),
  code: codeSchema.optional(),
  displayName: z.string().trim().min(2).max(255).optional(),
  tagline: optionalText(255),
  description: optionalText(),
  legalName: optionalText(255),
  legalStatus: legalStatusSchema.default('informal'),
  businessType: optionalText(128),
  foundedAt: dateOnlySchema.optional(),
  employeeCount: z.coerce.number().int().min(0).optional(),
  annualRevenue: numericSchema.optional(),
  website: optionalText(255),
  email: z.string().trim().email().max(255).optional(),
  phone: optionalText(32),
  logoUrl: optionalText(2048),
  coverUrl: optionalText(2048),
  address: optionalText(),
  city: optionalText(128),
  province: optionalText(128),
  postalCode: optionalText(16),
  country: z.string().trim().length(2).default('ID'),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  status: profileStatusSchema.default('draft'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const updateProfileSchema = createProfileSchema.omit({ merchantId: true }).partial();

const historyInputSchema = z.object({
  title: z.string().trim().min(2).max(255),
  description: optionalText(),
  eventDate: dateOnlySchema,
  category: optionalText(64),
  source: optionalText(128),
});

const locationInputSchema = z.object({
  name: z.string().trim().min(2).max(255),
  type: locationTypeSchema.default('branch'),
  address: optionalText(),
  city: optionalText(128),
  province: optionalText(128),
  postalCode: optionalText(16),
  country: z.string().trim().length(2).default('ID'),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  phone: optionalText(32),
  isPrimary: z.boolean().default(false),
  isActive: z.boolean().default(true),
  openingHours: z.record(z.string(), z.unknown()).optional(),
});

const documentInputSchema = z.object({
  documentType: z.string().trim().min(2).max(64),
  documentNumber: optionalText(128),
  title: z.string().trim().min(2).max(255),
  issuedAt: dateOnlySchema.optional(),
  expiresAt: dateOnlySchema.optional(),
  issuer: optionalText(255),
  fileName: optionalText(255),
  fileUrl: optionalText(2048),
  status: documentStatusSchema.default('pending'),
  notes: optionalText(),
});

const activityInputSchema = z.object({
  activityDate: dateOnlySchema,
  activityType: z.string().trim().min(2).max(64),
  title: z.string().trim().min(2).max(255),
  description: optionalText(),
  amount: numericSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const verificationInputSchema = z.object({
  status: verificationStatusSchema.default('in_review'),
  checklist: z.record(z.string(), z.unknown()).optional(),
  notes: optionalText(),
});

const shareInputSchema = z.object({
  sharedWithUserId: z.uuid().optional(),
  sharedWithEmail: z.string().trim().email().max(255).optional(),
  permissions: z.record(z.string(), z.unknown()).optional(),
  expiresAt: z.string().datetime({ offset: true }).optional(),
});

export const businessProfileRoutes = new Hono<AppEnv>();

function computeCompleteness(profile: {
  displayName?: string | null;
  description?: string | null;
  legalName?: string | null;
  businessType?: string | null;
  foundedAt?: string | null;
  employeeCount?: number | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
}) {
  const values = [
    profile.displayName,
    profile.description,
    profile.legalName,
    profile.businessType,
    profile.foundedAt,
    profile.employeeCount,
    profile.website,
    profile.email,
    profile.phone,
    profile.address,
    profile.city,
    profile.province,
    profile.postalCode,
  ];
  const filled = values.filter((value) => value !== null && value !== undefined && value !== '')
    .length;
  return Math.round((filled / values.length) * 100);
}

/* ----------------------------- Profiles ----------------------------- */

businessProfileRoutes.get(
  '/profiles',
  requirePermission('business:read'),
  validate('query', listProfileSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [isNull(businessProfiles.deletedAt)];
    const scope = businessScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(businessProfiles.merchantId, query.merchantId));
    if (query.status) conditions.push(eq(businessProfiles.status, query.status));
    if (query.verificationStatus) {
      conditions.push(eq(businessProfiles.verificationStatus, query.verificationStatus));
    }
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(businessProfiles.code, term),
          ilike(businessProfiles.displayName, term),
          ilike(businessProfiles.legalName, term),
          ilike(merchants.businessName, term),
        ) as SQL,
      );
    }
    const where = and(...conditions);
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: businessProfiles.id,
          merchantId: businessProfiles.merchantId,
          merchantName: merchants.businessName,
          code: businessProfiles.code,
          displayName: businessProfiles.displayName,
          legalName: businessProfiles.legalName,
          legalStatus: businessProfiles.legalStatus,
          businessType: businessProfiles.businessType,
          city: businessProfiles.city,
          province: businessProfiles.province,
          status: businessProfiles.status,
          verificationStatus: businessProfiles.verificationStatus,
          completeness: businessProfiles.completeness,
          publishedAt: businessProfiles.publishedAt,
          createdAt: businessProfiles.createdAt,
        })
        .from(businessProfiles)
        .innerJoin(merchants, eq(merchants.id, businessProfiles.merchantId))
        .where(where)
        .orderBy(desc(businessProfiles.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(businessProfiles)
        .innerJoin(merchants, eq(merchants.id, businessProfiles.merchantId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

businessProfileRoutes.post(
  '/profiles',
  requirePermission('business:write'),
  validate('json', createProfileSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const access = await assertBusinessAccess(body.merchantId, user, permissions, {
      manage: true,
    });
    const [existing] = await db
      .select({ id: businessProfiles.id })
      .from(businessProfiles)
      .where(eq(businessProfiles.merchantId, body.merchantId))
      .limit(1);
    if (existing) throw ApiError.conflict('Merchant sudah memiliki profil bisnis');
    const code = body.code ?? generateCode('BIZ');
    const displayName = body.displayName ?? access.merchant.businessName;
    const draft = {
      displayName,
      description: body.description ?? null,
      legalName: body.legalName ?? null,
      businessType: body.businessType ?? null,
      foundedAt: body.foundedAt ?? null,
      employeeCount: body.employeeCount ?? null,
      website: body.website ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      address: body.address ?? null,
      city: body.city ?? null,
      province: body.province ?? null,
      postalCode: body.postalCode ?? null,
    };
    const [created] = await db
      .insert(businessProfiles)
      .values({
        merchantId: body.merchantId,
        code,
        displayName,
        tagline: body.tagline ?? null,
        description: body.description ?? null,
        legalName: body.legalName ?? null,
        legalStatus: body.legalStatus,
        businessType: body.businessType ?? null,
        foundedAt: body.foundedAt ?? null,
        employeeCount: body.employeeCount ?? null,
        annualRevenue: body.annualRevenue ?? null,
        website: body.website ?? null,
        email: body.email ?? null,
        phone: body.phone ?? null,
        logoUrl: body.logoUrl ?? null,
        coverUrl: body.coverUrl ?? null,
        address: body.address ?? null,
        city: body.city ?? null,
        province: body.province ?? null,
        postalCode: body.postalCode ?? null,
        country: body.country,
        latitude: body.latitude !== undefined ? String(body.latitude) : null,
        longitude: body.longitude !== undefined ? String(body.longitude) : null,
        status: body.status,
        completeness: computeCompleteness(draft),
        publishedAt: body.status === 'active' || body.status === 'verified' ? new Date() : null,
        metadata: body.metadata ?? null,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'business.profile.create',
      entityType: 'business_profile',
      entityId: created!.id,
      newValues: { code: created!.code, displayName: created!.displayName },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created!, 201);
  },
);

businessProfileRoutes.get(
  '/profiles/:id',
  requirePermission('business:read'),
  async (c) => {
    const { profile } = await getBusinessProfile(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    const [merchant] = await db
      .select({
        id: merchants.id,
        businessName: merchants.businessName,
        status: merchants.status,
      })
      .from(merchants)
      .where(eq(merchants.id, profile.merchantId))
      .limit(1);
    const [history, locations, documents, activities, verifications, shares] = await Promise.all([
      db
        .select()
        .from(businessHistory)
        .where(eq(businessHistory.profileId, profile.id))
        .orderBy(desc(businessHistory.eventDate)),
      db
        .select()
        .from(businessLocations)
        .where(eq(businessLocations.profileId, profile.id))
        .orderBy(desc(businessLocations.isPrimary), asc(businessLocations.name)),
      db
        .select()
        .from(businessLegalDocuments)
        .where(eq(businessLegalDocuments.profileId, profile.id))
        .orderBy(desc(businessLegalDocuments.createdAt)),
      db
        .select()
        .from(businessActivityRecords)
        .where(eq(businessActivityRecords.profileId, profile.id))
        .orderBy(desc(businessActivityRecords.activityDate)),
      db
        .select()
        .from(businessVerifications)
        .where(eq(businessVerifications.profileId, profile.id))
        .orderBy(desc(businessVerifications.createdAt)),
      db
        .select({
          id: businessProfileShares.id,
          sharedWithUserId: businessProfileShares.sharedWithUserId,
          sharedWithEmail: businessProfileShares.sharedWithEmail,
          status: businessProfileShares.status,
          expiresAt: businessProfileShares.expiresAt,
          lastAccessedAt: businessProfileShares.lastAccessedAt,
          createdAt: businessProfileShares.createdAt,
        })
        .from(businessProfileShares)
        .where(eq(businessProfileShares.profileId, profile.id))
        .orderBy(desc(businessProfileShares.createdAt)),
    ]);
    return ok(c, {
      ...profile,
      merchant,
      history,
      locations,
      documents,
      activities,
      verifications,
      shares,
    });
  },
);

businessProfileRoutes.get(
  '/profiles/:id/metrics',
  requirePermission('business:read'),
  async (c) => {
    const { profile } = await getBusinessProfile(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    const [orderMetrics] = await db
      .select({
        revenue: sql<string>`coalesce(sum(${orders.grandTotal}), 0)`,
        orderCount: sql<number>`count(*)::int`,
        customerCount: sql<number>`count(distinct ${orders.userId})::int`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.merchantId, profile.merchantId),
          sql`${orders.status} not in ('cancelled', 'returned')`,
        ),
      );
    const [productRow] = await db
      .select({ total: count() })
      .from(products)
      .where(and(eq(products.merchantId, profile.merchantId), isNull(products.deletedAt)));
    const [customerRow] = await db
      .select({ total: count() })
      .from(customers)
      .where(and(eq(customers.merchantId, profile.merchantId), isNull(customers.deletedAt)));
    return ok(c, {
      profileId: profile.id,
      merchantId: profile.merchantId,
      revenue: toNumber(orderMetrics?.revenue).toFixed(2),
      orderCount: orderMetrics?.orderCount ?? 0,
      orderCustomerCount: orderMetrics?.customerCount ?? 0,
      productCount: productRow?.total ?? 0,
      crmCustomerCount: customerRow?.total ?? 0,
      completeness: profile.completeness,
    });
  },
);

businessProfileRoutes.patch(
  '/profiles/:id',
  requirePermission('business:write'),
  validate('json', updateProfileSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { profile } = await getBusinessProfile(c.req.param('id'), user, permissions, {
      manage: true,
    });
    const merged = {
      displayName: body.displayName ?? profile.displayName,
      description: body.description === undefined ? profile.description : body.description,
      legalName: body.legalName === undefined ? profile.legalName : body.legalName,
      businessType: body.businessType === undefined ? profile.businessType : body.businessType,
      foundedAt: body.foundedAt ?? profile.foundedAt,
      employeeCount: body.employeeCount ?? profile.employeeCount,
      website: body.website === undefined ? profile.website : body.website,
      email: body.email === undefined ? profile.email : body.email,
      phone: body.phone === undefined ? profile.phone : body.phone,
      address: body.address === undefined ? profile.address : body.address,
      city: body.city === undefined ? profile.city : body.city,
      province: body.province === undefined ? profile.province : body.province,
      postalCode: body.postalCode === undefined ? profile.postalCode : body.postalCode,
    };
    const [updated] = await db
      .update(businessProfiles)
      .set({
        ...body,
        displayName: body.displayName ?? undefined,
        tagline: body.tagline ?? undefined,
        description: body.description ?? undefined,
        legalName: body.legalName ?? undefined,
        businessType: body.businessType ?? undefined,
        foundedAt: body.foundedAt ?? undefined,
        employeeCount: body.employeeCount ?? undefined,
        annualRevenue: body.annualRevenue ?? undefined,
        website: body.website ?? undefined,
        email: body.email ?? undefined,
        phone: body.phone ?? undefined,
        logoUrl: body.logoUrl ?? undefined,
        coverUrl: body.coverUrl ?? undefined,
        address: body.address ?? undefined,
        city: body.city ?? undefined,
        province: body.province ?? undefined,
        postalCode: body.postalCode ?? undefined,
        latitude: body.latitude !== undefined ? String(body.latitude) : undefined,
        longitude: body.longitude !== undefined ? String(body.longitude) : undefined,
        metadata: body.metadata ?? undefined,
        completeness: computeCompleteness(merged),
        publishedAt:
          body.status === 'active' || body.status === 'verified'
            ? profile.publishedAt ?? new Date()
            : profile.publishedAt,
        updatedBy: user.id,
      })
      .where(eq(businessProfiles.id, profile.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'business.profile.update',
      entityType: 'business_profile',
      entityId: profile.id,
      oldValues: { status: profile.status, completeness: profile.completeness },
      newValues: { status: updated!.status, completeness: updated!.completeness },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

businessProfileRoutes.delete(
  '/profiles/:id',
  requirePermission('business:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { profile } = await getBusinessProfile(c.req.param('id'), user, permissions, {
      manage: true,
    });
    const [updated] = await db
      .update(businessProfiles)
      .set({ status: 'archived', deletedAt: new Date(), updatedBy: user.id })
      .where(eq(businessProfiles.id, profile.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'business.profile.archive',
      entityType: 'business_profile',
      entityId: profile.id,
      oldValues: { status: profile.status },
      newValues: { status: 'archived' },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, { id: profile.id, status: updated!.status, deleted: true });
  },
);

businessProfileRoutes.post(
  '/profiles/:id/verify',
  requirePermission('business:manage'),
  validate('json', verificationInputSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { profile } = await getBusinessProfile(c.req.param('id'), user, permissions, {
      manage: true,
    });
    const [verification] = await db
      .insert(businessVerifications)
      .values({
        profileId: profile.id,
        merchantId: profile.merchantId,
        status: body.status,
        reviewedAt: body.status === 'verified' || body.status === 'rejected' ? new Date() : null,
        reviewedBy: user.id,
        checklist: body.checklist ?? null,
        notes: body.notes ?? null,
      })
      .returning();
    const [updated] = await db
      .update(businessProfiles)
      .set({
        verificationStatus: body.status,
        status: body.status === 'verified' ? 'verified' : profile.status,
        updatedBy: user.id,
      })
      .where(eq(businessProfiles.id, profile.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'business.profile.verify',
      entityType: 'business_profile',
      entityId: profile.id,
      oldValues: { verificationStatus: profile.verificationStatus },
      newValues: { verificationStatus: updated!.verificationStatus, note: body.notes ?? null },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, { profile: updated!, verification }, 201);
  },
);

/* ------------------------------ History ----------------------------- */

businessProfileRoutes.get(
  '/profiles/:id/history',
  requirePermission('business:read'),
  async (c) => {
    const { profile } = await getBusinessProfile(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    const rows = await db
      .select()
      .from(businessHistory)
      .where(eq(businessHistory.profileId, profile.id))
      .orderBy(desc(businessHistory.eventDate));
    return ok(c, rows);
  },
);

businessProfileRoutes.post(
  '/profiles/:id/history',
  requirePermission('business:write'),
  validate('json', historyInputSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { profile } = await getBusinessProfile(c.req.param('id'), user, permissions, {
      manage: true,
    });
    const [created] = await db
      .insert(businessHistory)
      .values({
        profileId: profile.id,
        merchantId: profile.merchantId,
        title: body.title,
        description: body.description ?? null,
        eventDate: body.eventDate,
        category: body.category ?? null,
        source: body.source ?? null,
      })
      .returning();
    return ok(c, created!, 201);
  },
);

businessProfileRoutes.patch(
  '/profiles/:pid/history/:id',
  requirePermission('business:write'),
  validate('json', historyInputSchema.partial()),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { profile } = await getBusinessProfile(c.req.param('pid'), user, permissions, {
      manage: true,
    });
    const row = await db.query.businessHistory.findFirst({
      where: and(
        eq(businessHistory.id, c.req.param('id')),
        eq(businessHistory.profileId, profile.id),
      ),
    });
    if (!row) throw ApiError.notFound('Riwayat bisnis tidak ditemukan');
    const [updated] = await db
      .update(businessHistory)
      .set({
        ...body,
        description: body.description ?? undefined,
        category: body.category ?? undefined,
        source: body.source ?? undefined,
      })
      .where(eq(businessHistory.id, row.id))
      .returning();
    return ok(c, updated!);
  },
);

businessProfileRoutes.delete(
  '/profiles/:pid/history/:id',
  requirePermission('business:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { profile } = await getBusinessProfile(c.req.param('pid'), user, permissions, {
      manage: true,
    });
    const row = await db.query.businessHistory.findFirst({
      where: and(
        eq(businessHistory.id, c.req.param('id')),
        eq(businessHistory.profileId, profile.id),
      ),
    });
    if (!row) throw ApiError.notFound('Riwayat bisnis tidak ditemukan');
    await db.delete(businessHistory).where(eq(businessHistory.id, row.id));
    return ok(c, { id: row.id, deleted: true });
  },
);

/* ----------------------------- Locations ---------------------------- */

businessProfileRoutes.get(
  '/profiles/:id/locations',
  requirePermission('business:read'),
  async (c) => {
    const { profile } = await getBusinessProfile(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    const rows = await db
      .select()
      .from(businessLocations)
      .where(eq(businessLocations.profileId, profile.id))
      .orderBy(desc(businessLocations.isPrimary), asc(businessLocations.name));
    return ok(c, rows);
  },
);

businessProfileRoutes.post(
  '/profiles/:id/locations',
  requirePermission('business:write'),
  validate('json', locationInputSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { profile } = await getBusinessProfile(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (body.isPrimary) {
      await db
        .update(businessLocations)
        .set({ isPrimary: false })
        .where(eq(businessLocations.profileId, profile.id));
    }
    const [created] = await db
      .insert(businessLocations)
      .values({
        profileId: profile.id,
        merchantId: profile.merchantId,
        name: body.name,
        type: body.type,
        address: body.address ?? null,
        city: body.city ?? null,
        province: body.province ?? null,
        postalCode: body.postalCode ?? null,
        country: body.country,
        latitude: body.latitude !== undefined ? String(body.latitude) : null,
        longitude: body.longitude !== undefined ? String(body.longitude) : null,
        phone: body.phone ?? null,
        isPrimary: body.isPrimary,
        isActive: body.isActive,
        openingHours: body.openingHours ?? null,
      })
      .returning();
    return ok(c, created!, 201);
  },
);

businessProfileRoutes.patch(
  '/profiles/:pid/locations/:id',
  requirePermission('business:write'),
  validate('json', locationInputSchema.partial()),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { profile } = await getBusinessProfile(c.req.param('pid'), user, permissions, {
      manage: true,
    });
    const row = await db.query.businessLocations.findFirst({
      where: and(
        eq(businessLocations.id, c.req.param('id')),
        eq(businessLocations.profileId, profile.id),
      ),
    });
    if (!row) throw ApiError.notFound('Lokasi bisnis tidak ditemukan');
    if (body.isPrimary) {
      await db
        .update(businessLocations)
        .set({ isPrimary: false })
        .where(eq(businessLocations.profileId, profile.id));
    }
    const [updated] = await db
      .update(businessLocations)
      .set({
        ...body,
        address: body.address ?? undefined,
        city: body.city ?? undefined,
        province: body.province ?? undefined,
        postalCode: body.postalCode ?? undefined,
        phone: body.phone ?? undefined,
        latitude: body.latitude !== undefined ? String(body.latitude) : undefined,
        longitude: body.longitude !== undefined ? String(body.longitude) : undefined,
        openingHours: body.openingHours ?? undefined,
      })
      .where(eq(businessLocations.id, row.id))
      .returning();
    return ok(c, updated!);
  },
);

businessProfileRoutes.delete(
  '/profiles/:pid/locations/:id',
  requirePermission('business:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { profile } = await getBusinessProfile(c.req.param('pid'), user, permissions, {
      manage: true,
    });
    const row = await db.query.businessLocations.findFirst({
      where: and(
        eq(businessLocations.id, c.req.param('id')),
        eq(businessLocations.profileId, profile.id),
      ),
    });
    if (!row) throw ApiError.notFound('Lokasi bisnis tidak ditemukan');
    await db.delete(businessLocations).where(eq(businessLocations.id, row.id));
    return ok(c, { id: row.id, deleted: true });
  },
);

/* ----------------------------- Documents ---------------------------- */

businessProfileRoutes.get(
  '/profiles/:id/documents',
  requirePermission('business:read'),
  async (c) => {
    const { profile } = await getBusinessProfile(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    const rows = await db
      .select()
      .from(businessLegalDocuments)
      .where(eq(businessLegalDocuments.profileId, profile.id))
      .orderBy(desc(businessLegalDocuments.createdAt));
    return ok(c, rows);
  },
);

businessProfileRoutes.post(
  '/profiles/:id/documents',
  requirePermission('business:write'),
  validate('json', documentInputSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { profile } = await getBusinessProfile(c.req.param('id'), user, permissions, {
      manage: true,
    });
    const [created] = await db
      .insert(businessLegalDocuments)
      .values({
        profileId: profile.id,
        merchantId: profile.merchantId,
        documentType: body.documentType,
        documentNumber: body.documentNumber ?? null,
        title: body.title,
        issuedAt: body.issuedAt ?? null,
        expiresAt: body.expiresAt ?? null,
        issuer: body.issuer ?? null,
        fileName: body.fileName ?? null,
        fileUrl: body.fileUrl ?? null,
        status: body.status,
        notes: body.notes ?? null,
      })
      .returning();
    return ok(c, created!, 201);
  },
);

businessProfileRoutes.patch(
  '/profiles/:pid/documents/:id',
  requirePermission('business:write'),
  validate('json', documentInputSchema.partial()),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { profile } = await getBusinessProfile(c.req.param('pid'), user, permissions, {
      manage: true,
    });
    const row = await db.query.businessLegalDocuments.findFirst({
      where: and(
        eq(businessLegalDocuments.id, c.req.param('id')),
        eq(businessLegalDocuments.profileId, profile.id),
      ),
    });
    if (!row) throw ApiError.notFound('Dokumen legal tidak ditemukan');
    const [updated] = await db
      .update(businessLegalDocuments)
      .set({
        ...body,
        documentNumber: body.documentNumber ?? undefined,
        issuedAt: body.issuedAt ?? undefined,
        expiresAt: body.expiresAt ?? undefined,
        issuer: body.issuer ?? undefined,
        fileName: body.fileName ?? undefined,
        fileUrl: body.fileUrl ?? undefined,
        notes: body.notes ?? undefined,
        verifiedBy: body.status === 'verified' ? user.id : undefined,
        verifiedAt: body.status === 'verified' ? new Date() : undefined,
      })
      .where(eq(businessLegalDocuments.id, row.id))
      .returning();
    return ok(c, updated!);
  },
);

businessProfileRoutes.delete(
  '/profiles/:pid/documents/:id',
  requirePermission('business:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { profile } = await getBusinessProfile(c.req.param('pid'), user, permissions, {
      manage: true,
    });
    const row = await db.query.businessLegalDocuments.findFirst({
      where: and(
        eq(businessLegalDocuments.id, c.req.param('id')),
        eq(businessLegalDocuments.profileId, profile.id),
      ),
    });
    if (!row) throw ApiError.notFound('Dokumen legal tidak ditemukan');
    await db.delete(businessLegalDocuments).where(eq(businessLegalDocuments.id, row.id));
    return ok(c, { id: row.id, deleted: true });
  },
);

/* ----------------------------- Activities --------------------------- */

businessProfileRoutes.get(
  '/profiles/:id/activities',
  requirePermission('business:read'),
  async (c) => {
    const { profile } = await getBusinessProfile(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    const rows = await db
      .select()
      .from(businessActivityRecords)
      .where(eq(businessActivityRecords.profileId, profile.id))
      .orderBy(desc(businessActivityRecords.activityDate));
    return ok(c, rows);
  },
);

businessProfileRoutes.post(
  '/profiles/:id/activities',
  requirePermission('business:write'),
  validate('json', activityInputSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { profile } = await getBusinessProfile(c.req.param('id'), user, permissions, {
      manage: true,
    });
    const [created] = await db
      .insert(businessActivityRecords)
      .values({
        profileId: profile.id,
        merchantId: profile.merchantId,
        activityDate: body.activityDate,
        activityType: body.activityType,
        title: body.title,
        description: body.description ?? null,
        amount: body.amount ?? null,
        metadata: body.metadata ?? null,
      })
      .returning();
    return ok(c, created!, 201);
  },
);

businessProfileRoutes.patch(
  '/profiles/:pid/activities/:id',
  requirePermission('business:write'),
  validate('json', activityInputSchema.partial()),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { profile } = await getBusinessProfile(c.req.param('pid'), user, permissions, {
      manage: true,
    });
    const row = await db.query.businessActivityRecords.findFirst({
      where: and(
        eq(businessActivityRecords.id, c.req.param('id')),
        eq(businessActivityRecords.profileId, profile.id),
      ),
    });
    if (!row) throw ApiError.notFound('Aktivitas bisnis tidak ditemukan');
    const [updated] = await db
      .update(businessActivityRecords)
      .set({
        ...body,
        description: body.description ?? undefined,
        amount: body.amount ?? undefined,
        metadata: body.metadata ?? undefined,
      })
      .where(eq(businessActivityRecords.id, row.id))
      .returning();
    return ok(c, updated!);
  },
);

businessProfileRoutes.delete(
  '/profiles/:pid/activities/:id',
  requirePermission('business:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { profile } = await getBusinessProfile(c.req.param('pid'), user, permissions, {
      manage: true,
    });
    const row = await db.query.businessActivityRecords.findFirst({
      where: and(
        eq(businessActivityRecords.id, c.req.param('id')),
        eq(businessActivityRecords.profileId, profile.id),
      ),
    });
    if (!row) throw ApiError.notFound('Aktivitas bisnis tidak ditemukan');
    await db.delete(businessActivityRecords).where(eq(businessActivityRecords.id, row.id));
    return ok(c, { id: row.id, deleted: true });
  },
);

/* ---------------------------- Verifications ------------------------- */

businessProfileRoutes.get(
  '/profiles/:id/verifications',
  requirePermission('business:read'),
  async (c) => {
    const { profile } = await getBusinessProfile(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    const rows = await db
      .select()
      .from(businessVerifications)
      .where(eq(businessVerifications.profileId, profile.id))
      .orderBy(desc(businessVerifications.createdAt));
    return ok(c, rows);
  },
);

/* ------------------------------- Shares ----------------------------- */

businessProfileRoutes.get(
  '/profiles/:id/shares',
  requirePermission('business:read'),
  async (c) => {
    const { profile } = await getBusinessProfile(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    const rows = await db
      .select({
        id: businessProfileShares.id,
        sharedWithUserId: businessProfileShares.sharedWithUserId,
        sharedWithEmail: businessProfileShares.sharedWithEmail,
        permissions: businessProfileShares.permissions,
        status: businessProfileShares.status,
        expiresAt: businessProfileShares.expiresAt,
        lastAccessedAt: businessProfileShares.lastAccessedAt,
        createdAt: businessProfileShares.createdAt,
      })
      .from(businessProfileShares)
      .where(eq(businessProfileShares.profileId, profile.id))
      .orderBy(desc(businessProfileShares.createdAt));
    return ok(c, rows);
  },
);

businessProfileRoutes.post(
  '/profiles/:id/shares',
  requirePermission('business:write'),
  validate('json', shareInputSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { profile } = await getBusinessProfile(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (!body.sharedWithUserId && !body.sharedWithEmail) {
      throw ApiError.badRequest('Penerima share wajib diisi');
    }
    const token = generateSessionToken();
    const [created] = await db
      .insert(businessProfileShares)
      .values({
        profileId: profile.id,
        merchantId: profile.merchantId,
        sharedWithUserId: body.sharedWithUserId ?? null,
        sharedWithEmail: body.sharedWithEmail ?? null,
        tokenHash: hashToken(token),
        permissions: body.permissions ?? null,
        status: 'active',
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        createdBy: user.id,
      })
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'business.profile.share.create',
      entityType: 'business_profile_share',
      entityId: created!.id,
      newValues: { profileId: profile.id, email: created!.sharedWithEmail },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(
      c,
      {
        id: created!.id,
        shareToken: token,
        sharedWithEmail: created!.sharedWithEmail,
        expiresAt: created!.expiresAt,
        status: created!.status,
      },
      201,
    );
  },
);

businessProfileRoutes.post(
  '/profiles/:pid/shares/:id/revoke',
  requirePermission('business:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { profile } = await getBusinessProfile(c.req.param('pid'), user, permissions, {
      manage: true,
    });
    const row = await db.query.businessProfileShares.findFirst({
      where: and(
        eq(businessProfileShares.id, c.req.param('id')),
        eq(businessProfileShares.profileId, profile.id),
      ),
    });
    if (!row) throw ApiError.notFound('Share profil tidak ditemukan');
    const [updated] = await db
      .update(businessProfileShares)
      .set({ status: 'revoked' })
      .where(eq(businessProfileShares.id, row.id))
      .returning();
    return ok(c, { id: updated!.id, status: updated!.status });
  },
);
