import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  type SQL,
} from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  couponRedemptions,
  coupons,
  customers,
  discountRules,
  marketingCampaigns,
  merchants,
  orders,
  promotions,
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
import {
  assertMarketingAccess,
  getCampaign,
  getCoupon,
  getPromotion,
  marketingScopeCondition,
  money,
  numericSchema,
  toNumber,
} from './shared';

const promotionTypeSchema = z.enum([
  'percentage',
  'fixed_amount',
  'free_shipping',
  'bundle',
  'buy_x_get_y',
]);
const promotionStatusSchema = z.enum([
  'draft',
  'scheduled',
  'active',
  'paused',
  'expired',
  'cancelled',
]);
const ruleTypeSchema = z.enum([
  'percentage',
  'fixed_amount',
  'free_shipping',
  'buy_x_get_y',
]);
const ruleTargetSchema = z.enum(['order', 'product', 'category', 'shipping']);
const couponTypeSchema = z.enum(['percentage', 'fixed_amount', 'free_shipping']);
const couponStatusSchema = z.enum(['active', 'inactive', 'expired', 'exhausted']);
const redemptionStatusSchema = z.enum(['applied', 'redeemed', 'cancelled']);
const codeSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'Gunakan huruf, angka, garis bawah, atau tanda hubung')
  .transform((value) => value.toUpperCase());

const ruleInputSchema = z.object({
  name: z.string().trim().max(255).optional(),
  ruleType: ruleTypeSchema,
  targetType: ruleTargetSchema.default('order'),
  thresholdAmount: numericSchema.default('0'),
  thresholdQuantity: z.coerce.number().int().min(0).default(0),
  discountValue: numericSchema.default('0'),
  maxDiscount: numericSchema.optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

const createPromotionSchema = z.object({
  merchantId: z.uuid(),
  campaignId: z.uuid().optional(),
  code: codeSchema.optional(),
  name: z.string().trim().min(2).max(255),
  description: z.string().trim().max(4000).optional(),
  type: promotionTypeSchema,
  status: promotionStatusSchema.default('draft'),
  startsAt: z.string().datetime({ offset: true }).optional(),
  endsAt: z.string().datetime({ offset: true }).optional(),
  priority: z.coerce.number().int().min(0).default(0),
  stackable: z.boolean().default(false),
  minPurchase: numericSchema.default('0'),
  maxDiscount: numericSchema.optional(),
  usageLimit: z.coerce.number().int().min(0).optional(),
  perCustomerLimit: z.coerce.number().int().min(0).optional(),
  notes: z.string().trim().max(4000).optional(),
  rules: z.array(ruleInputSchema).max(20).optional(),
});

const updatePromotionSchema = z.object({
  campaignId: z.uuid().nullable().optional(),
  code: codeSchema.optional(),
  name: z.string().trim().min(2).max(255).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  type: promotionTypeSchema.optional(),
  status: promotionStatusSchema.optional(),
  startsAt: z.string().datetime({ offset: true }).nullable().optional(),
  endsAt: z.string().datetime({ offset: true }).nullable().optional(),
  priority: z.coerce.number().int().min(0).optional(),
  stackable: z.boolean().optional(),
  minPurchase: numericSchema.optional(),
  maxDiscount: numericSchema.nullable().optional(),
  usageLimit: z.coerce.number().int().min(0).nullable().optional(),
  perCustomerLimit: z.coerce.number().int().min(0).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
});

const listPromotionSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  campaignId: z.uuid().optional(),
  status: promotionStatusSchema.optional(),
  type: promotionTypeSchema.optional(),
});

const createCouponSchema = z.object({
  merchantId: z.uuid(),
  promotionId: z.uuid().optional(),
  code: z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9_-]+$/).transform((v) => v.toUpperCase()),
  name: z.string().trim().max(255).optional(),
  description: z.string().trim().max(4000).optional(),
  status: couponStatusSchema.default('active'),
  discountType: couponTypeSchema,
  discountValue: numericSchema.default('0'),
  minPurchase: numericSchema.default('0'),
  maxDiscount: numericSchema.optional(),
  usageLimit: z.coerce.number().int().min(0).optional(),
  perCustomerLimit: z.coerce.number().int().min(0).optional(),
  startsAt: z.string().datetime({ offset: true }).optional(),
  endsAt: z.string().datetime({ offset: true }).optional(),
  notes: z.string().trim().max(4000).optional(),
});

const updateCouponSchema = z.object({
  promotionId: z.uuid().nullable().optional(),
  code: z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9_-]+$/).transform((v) => v.toUpperCase()).optional(),
  name: z.string().trim().max(255).nullable().optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  status: couponStatusSchema.optional(),
  discountType: couponTypeSchema.optional(),
  discountValue: numericSchema.optional(),
  minPurchase: numericSchema.optional(),
  maxDiscount: numericSchema.nullable().optional(),
  usageLimit: z.coerce.number().int().min(0).nullable().optional(),
  perCustomerLimit: z.coerce.number().int().min(0).nullable().optional(),
  startsAt: z.string().datetime({ offset: true }).nullable().optional(),
  endsAt: z.string().datetime({ offset: true }).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
});

const listCouponSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  promotionId: z.uuid().optional(),
  status: couponStatusSchema.optional(),
  discountType: couponTypeSchema.optional(),
});

const validateCouponSchema = z.object({
  merchantId: z.uuid(),
  code: z.string().trim().min(1).max(64),
  orderAmount: numericSchema,
  shippingAmount: numericSchema.default('0'),
  customerId: z.uuid().optional(),
  userId: z.uuid().optional(),
});

const redeemCouponSchema = z.object({
  orderId: z.uuid(),
  customerId: z.uuid().optional(),
  notes: z.string().trim().max(2000).optional(),
});

const listRedemptionSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  merchantId: z.uuid().optional(),
  couponId: z.uuid().optional(),
  customerId: z.uuid().optional(),
  orderId: z.uuid().optional(),
  status: redemptionStatusSchema.optional(),
});

export const marketingPromotionRoutes = new Hono<AppEnv>();

function calculateCouponDiscount(
  coupon: typeof coupons.$inferSelect,
  orderAmount: number,
  shippingAmount: number,
  now = new Date(),
) {
  if (coupon.status !== 'active') {
    throw ApiError.badRequest('Kupon tidak aktif');
  }
  if (coupon.startsAt && coupon.startsAt.getTime() > now.getTime()) {
    throw ApiError.badRequest('Kupon belum berlaku');
  }
  if (coupon.endsAt && coupon.endsAt.getTime() < now.getTime()) {
    throw ApiError.badRequest('Kupon sudah kedaluwarsa');
  }
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw ApiError.badRequest('Kuota kupon sudah habis');
  }
  if (orderAmount < toNumber(coupon.minPurchase)) {
    throw ApiError.badRequest(
      `Minimal belanja ${money(toNumber(coupon.minPurchase))} untuk memakai kupon ini`,
    );
  }

  let discountAmount = 0;
  let shippingDiscount = 0;
  if (coupon.discountType === 'percentage') {
    discountAmount = (orderAmount * toNumber(coupon.discountValue)) / 100;
  } else if (coupon.discountType === 'fixed_amount') {
    discountAmount = toNumber(coupon.discountValue);
  } else {
    shippingDiscount = shippingAmount;
  }
  if (coupon.maxDiscount && discountAmount > toNumber(coupon.maxDiscount)) {
    discountAmount = toNumber(coupon.maxDiscount);
  }
  discountAmount = Math.min(Math.max(discountAmount, 0), orderAmount);
  shippingDiscount = Math.min(Math.max(shippingDiscount, 0), shippingAmount);
  return {
    discountAmount: money(discountAmount),
    shippingDiscount: money(shippingDiscount),
    totalDiscount: money(discountAmount + shippingDiscount),
  };
}

async function assertCouponCustomerLimit(
  coupon: typeof coupons.$inferSelect,
  customerId?: string,
  userId?: string,
) {
  if (!coupon.perCustomerLimit) return;
  if (!customerId && !userId) return;
  const conditions: SQL[] = [
    eq(couponRedemptions.couponId, coupon.id),
    inArray(couponRedemptions.status, ['applied', 'redeemed']),
  ];
  if (customerId) {
    conditions.push(eq(couponRedemptions.customerId, customerId));
  } else if (userId) {
    conditions.push(eq(couponRedemptions.userId, userId));
  }
  const [row] = await db
    .select({ total: count() })
    .from(couponRedemptions)
    .where(and(...conditions));
  if ((row?.total ?? 0) >= coupon.perCustomerLimit) {
    throw ApiError.badRequest('Batas pemakaian kupon untuk pelanggan ini sudah tercapai');
  }
}

/* ----------------------------- Promotions ----------------------------- */

marketingPromotionRoutes.get(
  '/promotions',
  requirePermission('marketing:read'),
  validate('query', listPromotionSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = marketingScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(promotions.merchantId, query.merchantId));
    if (query.campaignId) conditions.push(eq(promotions.campaignId, query.campaignId));
    if (query.status) conditions.push(eq(promotions.status, query.status));
    if (query.type) conditions.push(eq(promotions.type, query.type));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(promotions.code, term),
          ilike(promotions.name, term),
          ilike(merchants.businessName, term),
        ) as SQL,
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: promotions.id,
          merchantId: promotions.merchantId,
          merchantName: merchants.businessName,
          campaignId: promotions.campaignId,
          campaignName: marketingCampaigns.name,
          code: promotions.code,
          name: promotions.name,
          type: promotions.type,
          status: promotions.status,
          startsAt: promotions.startsAt,
          endsAt: promotions.endsAt,
          priority: promotions.priority,
          stackable: promotions.stackable,
          minPurchase: promotions.minPurchase,
          maxDiscount: promotions.maxDiscount,
          usageLimit: promotions.usageLimit,
          usedCount: promotions.usedCount,
          perCustomerLimit: promotions.perCustomerLimit,
          createdAt: promotions.createdAt,
        })
        .from(promotions)
        .innerJoin(merchants, eq(merchants.id, promotions.merchantId))
        .leftJoin(marketingCampaigns, eq(marketingCampaigns.id, promotions.campaignId))
        .where(where)
        .orderBy(desc(promotions.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(promotions)
        .innerJoin(merchants, eq(merchants.id, promotions.merchantId))
        .leftJoin(marketingCampaigns, eq(marketingCampaigns.id, promotions.campaignId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

marketingPromotionRoutes.post(
  '/promotions',
  requirePermission('marketing:write'),
  validate('json', createPromotionSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertMarketingAccess(body.merchantId, user, permissions, { manage: true });
    if (body.campaignId) {
      const { campaign } = await getCampaign(body.campaignId, user, permissions);
      if (campaign.merchantId !== body.merchantId) {
        throw ApiError.badRequest('Kampanye tidak dimiliki merchant ini');
      }
    }
    const code = body.code ?? generateCode('PRO');
    const [existing] = await db
      .select({ id: promotions.id })
      .from(promotions)
      .where(and(eq(promotions.merchantId, body.merchantId), eq(promotions.code, code)))
      .limit(1);
    if (existing) throw ApiError.conflict('Kode promosi sudah digunakan');

    const created = await db.transaction(async (tx) => {
      const [promotion] = await tx
        .insert(promotions)
        .values({
          merchantId: body.merchantId,
          campaignId: body.campaignId ?? null,
          code,
          name: body.name,
          description: body.description ?? null,
          type: body.type,
          status: body.status,
          startsAt: body.startsAt ? new Date(body.startsAt) : null,
          endsAt: body.endsAt ? new Date(body.endsAt) : null,
          priority: body.priority,
          stackable: body.stackable,
          minPurchase: body.minPurchase,
          maxDiscount: body.maxDiscount ?? null,
          usageLimit: body.usageLimit ?? null,
          perCustomerLimit: body.perCustomerLimit ?? null,
          notes: body.notes ?? null,
          createdBy: user.id,
        })
        .returning();
      if (body.rules?.length) {
        await tx.insert(discountRules).values(
          body.rules.map((rule) => ({
            merchantId: body.merchantId,
            promotionId: promotion!.id,
            name: rule.name ?? null,
            ruleType: rule.ruleType,
            targetType: rule.targetType,
            thresholdAmount: rule.thresholdAmount,
            thresholdQuantity: rule.thresholdQuantity,
            discountValue: rule.discountValue,
            maxDiscount: rule.maxDiscount ?? null,
            config: rule.config ?? null,
            sortOrder: rule.sortOrder,
            isActive: rule.isActive,
          })),
        );
      }
      return promotion!;
    });

    await writeAuditLog({
      actorUserId: user.id,
      action: 'marketing.promotion.create',
      entityType: 'promotion',
      entityId: created.id,
      newValues: { code: created.code, name: created.name, type: created.type },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created, 201);
  },
);

marketingPromotionRoutes.get(
  '/promotions/:id',
  requirePermission('marketing:read'),
  async (c) => {
    const { promotion } = await getPromotion(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    const rules = await db
      .select()
      .from(discountRules)
      .where(eq(discountRules.promotionId, promotion.id))
      .orderBy(asc(discountRules.sortOrder), asc(discountRules.createdAt));
    return ok(c, { ...promotion, rules });
  },
);

marketingPromotionRoutes.patch(
  '/promotions/:id',
  requirePermission('marketing:write'),
  validate('json', updatePromotionSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { promotion } = await getPromotion(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (body.code && body.code !== promotion.code) {
      const [existing] = await db
        .select({ id: promotions.id })
        .from(promotions)
        .where(
          and(
            eq(promotions.merchantId, promotion.merchantId),
            eq(promotions.code, body.code),
          ),
        )
        .limit(1);
      if (existing) throw ApiError.conflict('Kode promosi sudah digunakan');
    }
    const [updated] = await db
      .update(promotions)
      .set({
        ...body,
        startsAt:
          body.startsAt === undefined
            ? undefined
            : body.startsAt
              ? new Date(body.startsAt)
              : null,
        endsAt:
          body.endsAt === undefined ? undefined : body.endsAt ? new Date(body.endsAt) : null,
      })
      .where(eq(promotions.id, promotion.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'marketing.promotion.update',
      entityType: 'promotion',
      entityId: promotion.id,
      oldValues: { status: promotion.status, name: promotion.name },
      newValues: body,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

for (const action of ['activate', 'pause', 'cancel'] as const) {
  marketingPromotionRoutes.post(
    `/promotions/:id/${action}`,
    requirePermission('marketing:write'),
    async (c) => {
      const statusByAction = {
        activate: 'active',
        pause: 'paused',
        cancel: 'cancelled',
      } as const;
      const allowed: Record<string, string[]> = {
        activate: ['draft', 'scheduled', 'paused'],
        pause: ['active'],
        cancel: ['draft', 'scheduled', 'active', 'paused'],
      };
      const user = c.get('user');
      const permissions = c.get('permissions');
      const { promotion } = await getPromotion(c.req.param('id'), user, permissions, {
        manage: true,
      });
      if (!allowed[action]!.includes(promotion.status)) {
        throw ApiError.badRequest(
          `Promosi berstatus ${promotion.status} tidak dapat ${action}`,
        );
      }
      const [updated] = await db
        .update(promotions)
        .set({ status: statusByAction[action] })
        .where(eq(promotions.id, promotion.id))
        .returning();
      await writeAuditLog({
        actorUserId: user.id,
        action: `marketing.promotion.${action}`,
        entityType: 'promotion',
        entityId: promotion.id,
        oldValues: { status: promotion.status },
        newValues: { status: statusByAction[action] },
        ipAddress: getClientIp(c),
        userAgent: c.req.header('user-agent') ?? null,
      });
      return ok(c, updated!);
    },
  );
}

/* ---------------------------- Discount rules --------------------------- */

marketingPromotionRoutes.get(
  '/promotions/:id/rules',
  requirePermission('marketing:read'),
  async (c) => {
    const { promotion } = await getPromotion(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    const rows = await db
      .select()
      .from(discountRules)
      .where(eq(discountRules.promotionId, promotion.id))
      .orderBy(asc(discountRules.sortOrder), asc(discountRules.createdAt));
    return ok(c, rows);
  },
);

marketingPromotionRoutes.post(
  '/promotions/:id/rules',
  requirePermission('marketing:write'),
  validate('json', ruleInputSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { promotion } = await getPromotion(c.req.param('id'), user, permissions, {
      manage: true,
    });
    const [created] = await db
      .insert(discountRules)
      .values({
        merchantId: promotion.merchantId,
        promotionId: promotion.id,
        name: body.name ?? null,
        ruleType: body.ruleType,
        targetType: body.targetType,
        thresholdAmount: body.thresholdAmount,
        thresholdQuantity: body.thresholdQuantity,
        discountValue: body.discountValue,
        maxDiscount: body.maxDiscount ?? null,
        config: body.config ?? null,
        sortOrder: body.sortOrder,
        isActive: body.isActive,
      })
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'marketing.promotion.rule.create',
      entityType: 'discount_rule',
      entityId: created!.id,
      newValues: { promotionId: promotion.id, ruleType: created!.ruleType },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created!, 201);
  },
);

marketingPromotionRoutes.patch(
  '/discount-rules/:id',
  requirePermission('marketing:write'),
  validate('json', ruleInputSchema.partial()),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const [rule] = await db
      .select()
      .from(discountRules)
      .where(eq(discountRules.id, c.req.param('id')))
      .limit(1);
    if (!rule) throw ApiError.notFound('Aturan diskon tidak ditemukan');
    const { promotion } = await getPromotion(rule.promotionId, user, permissions, {
      manage: true,
    });
    const [updated] = await db
      .update(discountRules)
      .set(body)
      .where(eq(discountRules.id, rule.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'marketing.promotion.rule.update',
      entityType: 'discount_rule',
      entityId: rule.id,
      newValues: { ...body, promotionId: promotion.id },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

marketingPromotionRoutes.delete(
  '/discount-rules/:id',
  requirePermission('marketing:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const [rule] = await db
      .select()
      .from(discountRules)
      .where(eq(discountRules.id, c.req.param('id')))
      .limit(1);
    if (!rule) throw ApiError.notFound('Aturan diskon tidak ditemukan');
    await getPromotion(rule.promotionId, user, permissions, { manage: true });
    await db.delete(discountRules).where(eq(discountRules.id, rule.id));
    await writeAuditLog({
      actorUserId: user.id,
      action: 'marketing.promotion.rule.delete',
      entityType: 'discount_rule',
      entityId: rule.id,
      oldValues: { promotionId: rule.promotionId, ruleType: rule.ruleType },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, { id: rule.id, deleted: true });
  },
);

/* ------------------------------- Coupons ------------------------------- */

marketingPromotionRoutes.get(
  '/coupons',
  requirePermission('marketing:read'),
  validate('query', listCouponSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = marketingScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(coupons.merchantId, query.merchantId));
    if (query.promotionId) conditions.push(eq(coupons.promotionId, query.promotionId));
    if (query.status) conditions.push(eq(coupons.status, query.status));
    if (query.discountType) conditions.push(eq(coupons.discountType, query.discountType));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(coupons.code, term),
          ilike(coupons.name, term),
          ilike(merchants.businessName, term),
        ) as SQL,
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: coupons.id,
          merchantId: coupons.merchantId,
          merchantName: merchants.businessName,
          promotionId: coupons.promotionId,
          promotionName: promotions.name,
          code: coupons.code,
          name: coupons.name,
          status: coupons.status,
          discountType: coupons.discountType,
          discountValue: coupons.discountValue,
          minPurchase: coupons.minPurchase,
          maxDiscount: coupons.maxDiscount,
          usageLimit: coupons.usageLimit,
          usedCount: coupons.usedCount,
          perCustomerLimit: coupons.perCustomerLimit,
          startsAt: coupons.startsAt,
          endsAt: coupons.endsAt,
          createdAt: coupons.createdAt,
        })
        .from(coupons)
        .innerJoin(merchants, eq(merchants.id, coupons.merchantId))
        .leftJoin(promotions, eq(promotions.id, coupons.promotionId))
        .where(where)
        .orderBy(desc(coupons.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(coupons)
        .innerJoin(merchants, eq(merchants.id, coupons.merchantId))
        .leftJoin(promotions, eq(promotions.id, coupons.promotionId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

marketingPromotionRoutes.post(
  '/coupons',
  requirePermission('marketing:write'),
  validate('json', createCouponSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertMarketingAccess(body.merchantId, user, permissions, { manage: true });
    if (body.promotionId) {
      const { promotion } = await getPromotion(body.promotionId, user, permissions);
      if (promotion.merchantId !== body.merchantId) {
        throw ApiError.badRequest('Promosi tidak dimiliki merchant ini');
      }
    }
    const [existing] = await db
      .select({ id: coupons.id })
      .from(coupons)
      .where(and(eq(coupons.merchantId, body.merchantId), eq(coupons.code, body.code)))
      .limit(1);
    if (existing) throw ApiError.conflict('Kode kupon sudah digunakan');
    const [created] = await db
      .insert(coupons)
      .values({
        merchantId: body.merchantId,
        promotionId: body.promotionId ?? null,
        code: body.code,
        name: body.name ?? null,
        description: body.description ?? null,
        status: body.status,
        discountType: body.discountType,
        discountValue: body.discountValue,
        minPurchase: body.minPurchase,
        maxDiscount: body.maxDiscount ?? null,
        usageLimit: body.usageLimit ?? null,
        perCustomerLimit: body.perCustomerLimit ?? null,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        notes: body.notes ?? null,
        createdBy: user.id,
      })
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'marketing.coupon.create',
      entityType: 'coupon',
      entityId: created!.id,
      newValues: { code: created!.code, discountType: created!.discountType },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created!, 201);
  },
);

marketingPromotionRoutes.post(
  '/coupons/validate',
  requirePermission('marketing:read'),
  validate('json', validateCouponSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertMarketingAccess(body.merchantId, user, permissions);
    const code = body.code.trim().toUpperCase();
    const [coupon] = await db
      .select()
      .from(coupons)
      .where(and(eq(coupons.merchantId, body.merchantId), eq(coupons.code, code)))
      .limit(1);
    if (!coupon) throw ApiError.notFound('Kupon tidak ditemukan');
    const result = calculateCouponDiscount(
      coupon,
      toNumber(body.orderAmount),
      toNumber(body.shippingAmount),
    );
    await assertCouponCustomerLimit(coupon, body.customerId, body.userId);
    return ok(c, {
      coupon: {
        id: coupon.id,
        code: coupon.code,
        name: coupon.name,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minPurchase: coupon.minPurchase,
        maxDiscount: coupon.maxDiscount,
        endsAt: coupon.endsAt,
      },
      ...result,
    });
  },
);

marketingPromotionRoutes.get(
  '/coupons/:id',
  requirePermission('marketing:read'),
  async (c) => {
    const { coupon } = await getCoupon(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    const redemptions = await db
      .select()
      .from(couponRedemptions)
      .where(eq(couponRedemptions.couponId, coupon.id))
      .orderBy(desc(couponRedemptions.redeemedAt))
      .limit(50);
    return ok(c, { ...coupon, redemptions });
  },
);

marketingPromotionRoutes.patch(
  '/coupons/:id',
  requirePermission('marketing:write'),
  validate('json', updateCouponSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { coupon } = await getCoupon(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (body.code && body.code !== coupon.code) {
      const [existing] = await db
        .select({ id: coupons.id })
        .from(coupons)
        .where(and(eq(coupons.merchantId, coupon.merchantId), eq(coupons.code, body.code)))
        .limit(1);
      if (existing) throw ApiError.conflict('Kode kupon sudah digunakan');
    }
    const [updated] = await db
      .update(coupons)
      .set({
        ...body,
        startsAt:
          body.startsAt === undefined
            ? undefined
            : body.startsAt
              ? new Date(body.startsAt)
              : null,
        endsAt:
          body.endsAt === undefined ? undefined : body.endsAt ? new Date(body.endsAt) : null,
      })
      .where(eq(coupons.id, coupon.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'marketing.coupon.update',
      entityType: 'coupon',
      entityId: coupon.id,
      oldValues: { status: coupon.status, code: coupon.code },
      newValues: body,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

marketingPromotionRoutes.delete(
  '/coupons/:id',
  requirePermission('marketing:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { coupon } = await getCoupon(c.req.param('id'), user, permissions, {
      manage: true,
    });
    await db.update(coupons).set({ status: 'inactive' }).where(eq(coupons.id, coupon.id));
    await writeAuditLog({
      actorUserId: user.id,
      action: 'marketing.coupon.deactivate',
      entityType: 'coupon',
      entityId: coupon.id,
      oldValues: { status: coupon.status, code: coupon.code },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, { id: coupon.id, deactivated: true });
  },
);

marketingPromotionRoutes.post(
  '/coupons/:id/redeem',
  requirePermission('marketing:write'),
  validate('json', redeemCouponSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { coupon } = await getCoupon(c.req.param('id'), user, permissions, {
      manage: true,
    });
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, body.orderId),
    });
    if (!order) throw ApiError.notFound('Order tidak ditemukan');
    if (order.merchantId !== coupon.merchantId) {
      throw ApiError.badRequest('Kupon dan order berasal dari merchant berbeda');
    }
    if (['cancelled', 'returned'].includes(order.status)) {
      throw ApiError.badRequest('Order yang dibatalkan atau diretur tidak dapat memakai kupon');
    }
    if (body.customerId) {
      const [customer] = await db
        .select({ id: customers.id, merchantId: customers.merchantId })
        .from(customers)
        .where(and(eq(customers.id, body.customerId), isNull(customers.deletedAt)))
        .limit(1);
      if (!customer) throw ApiError.notFound('Pelanggan tidak ditemukan');
      if (customer.merchantId !== coupon.merchantId) {
        throw ApiError.badRequest('Pelanggan tidak dimiliki merchant ini');
      }
    }
    const [existing] = await db
      .select({ id: couponRedemptions.id })
      .from(couponRedemptions)
      .where(
        and(
          eq(couponRedemptions.couponId, coupon.id),
          eq(couponRedemptions.orderId, order.id),
          inArray(couponRedemptions.status, ['applied', 'redeemed']),
        ),
      )
      .limit(1);
    if (existing) throw ApiError.conflict('Kupon sudah dipakai pada order ini');

    const discount = calculateCouponDiscount(
      coupon,
      toNumber(order.subtotal),
      toNumber(order.shippingTotal),
    );
    await assertCouponCustomerLimit(coupon, body.customerId, order.userId);

    const result = await db.transaction(async (tx) => {
      const newDiscountTotal = toNumber(order.discountTotal) + toNumber(discount.totalDiscount);
      const newGrandTotal = Math.max(
        toNumber(order.subtotal) - newDiscountTotal + toNumber(order.shippingTotal),
        0,
      );
      await tx
        .update(orders)
        .set({
          discountTotal: money(newDiscountTotal),
          grandTotal: money(newGrandTotal),
        })
        .where(eq(orders.id, order.id));
      const [redemption] = await tx
        .insert(couponRedemptions)
        .values({
          merchantId: coupon.merchantId,
          couponId: coupon.id,
          orderId: order.id,
          customerId: body.customerId ?? null,
          userId: order.userId,
          code: coupon.code,
          discountAmount: discount.totalDiscount,
          status: 'redeemed',
          notes: body.notes ?? null,
        })
        .returning();
      const nextUsed = coupon.usedCount + 1;
      await tx
        .update(coupons)
        .set({
          usedCount: nextUsed,
          status:
            coupon.usageLimit !== null && nextUsed >= coupon.usageLimit
              ? 'exhausted'
              : coupon.status,
        })
        .where(eq(coupons.id, coupon.id));
      return redemption!;
    });

    await writeAuditLog({
      actorUserId: user.id,
      action: 'marketing.coupon.redeem',
      entityType: 'coupon_redemption',
      entityId: result.id,
      newValues: {
        couponId: coupon.id,
        orderId: order.id,
        discount: discount.totalDiscount,
      },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, { ...result, ...discount }, 201);
  },
);

marketingPromotionRoutes.get(
  '/coupon-redemptions',
  requirePermission('marketing:read'),
  validate('query', listRedemptionSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = marketingScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(couponRedemptions.merchantId, query.merchantId));
    if (query.couponId) conditions.push(eq(couponRedemptions.couponId, query.couponId));
    if (query.customerId) conditions.push(eq(couponRedemptions.customerId, query.customerId));
    if (query.orderId) conditions.push(eq(couponRedemptions.orderId, query.orderId));
    if (query.status) conditions.push(eq(couponRedemptions.status, query.status));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: couponRedemptions.id,
          merchantId: couponRedemptions.merchantId,
          merchantName: merchants.businessName,
          couponId: couponRedemptions.couponId,
          couponCode: coupons.code,
          orderId: couponRedemptions.orderId,
          orderNumber: orders.orderNumber,
          customerId: couponRedemptions.customerId,
          customerName: customers.name,
          userId: couponRedemptions.userId,
          userName: users.fullName,
          code: couponRedemptions.code,
          discountAmount: couponRedemptions.discountAmount,
          status: couponRedemptions.status,
          redeemedAt: couponRedemptions.redeemedAt,
          cancelledAt: couponRedemptions.cancelledAt,
        })
        .from(couponRedemptions)
        .innerJoin(merchants, eq(merchants.id, couponRedemptions.merchantId))
        .innerJoin(coupons, eq(coupons.id, couponRedemptions.couponId))
        .leftJoin(orders, eq(orders.id, couponRedemptions.orderId))
        .leftJoin(customers, eq(customers.id, couponRedemptions.customerId))
        .leftJoin(users, eq(users.id, couponRedemptions.userId))
        .where(where)
        .orderBy(desc(couponRedemptions.redeemedAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(couponRedemptions)
        .innerJoin(merchants, eq(merchants.id, couponRedemptions.merchantId))
        .innerJoin(coupons, eq(coupons.id, couponRedemptions.couponId))
        .leftJoin(orders, eq(orders.id, couponRedemptions.orderId))
        .leftJoin(customers, eq(customers.id, couponRedemptions.customerId))
        .leftJoin(users, eq(users.id, couponRedemptions.userId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

marketingPromotionRoutes.post(
  '/coupon-redemptions/:id/cancel',
  requirePermission('marketing:manage'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const [redemption] = await db
      .select()
      .from(couponRedemptions)
      .where(eq(couponRedemptions.id, c.req.param('id')))
      .limit(1);
    if (!redemption) throw ApiError.notFound('Redemption kupon tidak ditemukan');
    await assertMarketingAccess(redemption.merchantId, user, permissions, { manage: true });
    if (redemption.status === 'cancelled') {
      return ok(c, { ...redemption, alreadyCancelled: true });
    }
    const coupon = await db.query.coupons.findFirst({
      where: eq(coupons.id, redemption.couponId),
    });
    if (!coupon) throw ApiError.notFound('Kupon tidak ditemukan');
    const order = redemption.orderId
      ? await db.query.orders.findFirst({ where: eq(orders.id, redemption.orderId) })
      : null;

    await db.transaction(async (tx) => {
      await tx
        .update(couponRedemptions)
        .set({ status: 'cancelled', cancelledAt: new Date() })
        .where(eq(couponRedemptions.id, redemption.id));
      const nextUsed = Math.max(coupon.usedCount - 1, 0);
      await tx
        .update(coupons)
        .set({
          usedCount: nextUsed,
          status:
            coupon.status === 'exhausted' &&
            (coupon.endsAt === null || coupon.endsAt.getTime() > Date.now())
              ? 'active'
              : coupon.status,
        })
        .where(eq(coupons.id, coupon.id));
      if (order) {
        const newDiscount = Math.max(
          toNumber(order.discountTotal) - toNumber(redemption.discountAmount),
          0,
        );
        const newGrand = Math.max(
          toNumber(order.subtotal) - newDiscount + toNumber(order.shippingTotal),
          0,
        );
        await tx
          .update(orders)
          .set({ discountTotal: money(newDiscount), grandTotal: money(newGrand) })
          .where(eq(orders.id, order.id));
      }
    });

    await writeAuditLog({
      actorUserId: user.id,
      action: 'marketing.coupon.redemption.cancel',
      entityType: 'coupon_redemption',
      entityId: redemption.id,
      oldValues: { status: redemption.status, discountAmount: redemption.discountAmount },
      newValues: { status: 'cancelled' },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, { id: redemption.id, status: 'cancelled' });
  },
);
