import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  isNull,
  lte,
  or,
  type SQL,
} from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  advertisements,
  campaignChannels,
  campaignPerformance,
  marketingCampaigns,
  merchants,
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
  dateOnlySchema,
  getAdvertisement,
  getCampaign,
  getCampaignChannel,
  getPerformance,
  marketingScopeCondition,
  numericSchema,
} from './shared';

const campaignObjectiveSchema = z.enum([
  'awareness',
  'acquisition',
  'retention',
  'engagement',
]);
const campaignStatusSchema = z.enum([
  'draft',
  'scheduled',
  'active',
  'paused',
  'completed',
  'cancelled',
]);
const channelTypeSchema = z.enum([
  'storefront',
  'marketplace',
  'social',
  'email',
  'whatsapp',
  'pos',
  'offline',
  'other',
]);
const advertisementTypeSchema = z.enum([
  'banner',
  'sponsored_product',
  'social_post',
  'email',
  'other',
]);
const advertisementStatusSchema = z.enum([
  'draft',
  'scheduled',
  'active',
  'paused',
  'completed',
  'cancelled',
]);
const codeSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'Gunakan huruf, angka, garis bawah, atau tanda hubung');

const channelInputSchema = z.object({
  channelType: channelTypeSchema,
  name: z.string().trim().max(128).optional(),
  budget: numericSchema.default('0'),
  spent: numericSchema.default('0'),
  targetConversions: z.coerce.number().int().min(0).default(0),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const listCampaignSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  status: campaignStatusSchema.optional(),
  objective: campaignObjectiveSchema.optional(),
});

const createCampaignSchema = z.object({
  merchantId: z.uuid(),
  code: codeSchema.optional(),
  name: z.string().trim().min(2).max(255),
  description: z.string().trim().max(4000).optional(),
  objective: campaignObjectiveSchema.default('awareness'),
  status: campaignStatusSchema.default('draft'),
  startsAt: z.string().datetime({ offset: true }).optional(),
  endsAt: z.string().datetime({ offset: true }).optional(),
  budget: numericSchema.default('0'),
  spent: numericSchema.default('0'),
  targetRevenue: numericSchema.default('0'),
  targetAudience: z.string().trim().max(4000).optional(),
  notes: z.string().trim().max(4000).optional(),
  channels: z.array(channelInputSchema).max(20).optional(),
});

const updateCampaignSchema = z.object({
  code: codeSchema.optional(),
  name: z.string().trim().min(2).max(255).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  objective: campaignObjectiveSchema.optional(),
  status: campaignStatusSchema.optional(),
  startsAt: z.string().datetime({ offset: true }).nullable().optional(),
  endsAt: z.string().datetime({ offset: true }).nullable().optional(),
  budget: numericSchema.optional(),
  spent: numericSchema.optional(),
  targetRevenue: numericSchema.optional(),
  targetAudience: z.string().trim().max(4000).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
});

const updateChannelSchema = z.object({
  name: z.string().trim().max(128).nullable().optional(),
  budget: numericSchema.optional(),
  spent: numericSchema.optional(),
  targetConversions: z.coerce.number().int().min(0).optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

const performanceInputSchema = z.object({
  channelId: z.uuid().optional(),
  date: dateOnlySchema,
  impressions: z.coerce.number().int().min(0).default(0),
  clicks: z.coerce.number().int().min(0).default(0),
  conversions: z.coerce.number().int().min(0).default(0),
  spend: numericSchema.default('0'),
  revenue: numericSchema.default('0'),
  orders: z.coerce.number().int().min(0).default(0),
  newCustomers: z.coerce.number().int().min(0).default(0),
  metrics: z.record(z.string(), z.unknown()).optional(),
});

const listPerformanceSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  merchantId: z.uuid().optional(),
  campaignId: z.uuid().optional(),
  channelId: z.uuid().optional(),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
});

const advertisementInputSchema = z.object({
  campaignId: z.uuid().optional(),
  name: z.string().trim().min(2).max(255),
  type: advertisementTypeSchema.default('banner'),
  status: advertisementStatusSchema.default('draft'),
  placement: z.string().trim().max(128).optional(),
  creativeUrl: z.string().trim().max(2048).optional(),
  targetUrl: z.string().trim().max(2048).optional(),
  startsAt: z.string().datetime({ offset: true }).optional(),
  endsAt: z.string().datetime({ offset: true }).optional(),
  budget: numericSchema.default('0'),
  spent: numericSchema.default('0'),
  impressions: z.coerce.number().int().min(0).default(0),
  clicks: z.coerce.number().int().min(0).default(0),
  conversions: z.coerce.number().int().min(0).default(0),
  revenue: numericSchema.default('0'),
  notes: z.string().trim().max(4000).optional(),
});

const updateAdvertisementSchema = advertisementInputSchema.partial().extend({
  campaignId: z.uuid().nullable().optional(),
  placement: z.string().trim().max(128).nullable().optional(),
  creativeUrl: z.string().trim().max(2048).nullable().optional(),
  targetUrl: z.string().trim().max(2048).nullable().optional(),
  startsAt: z.string().datetime({ offset: true }).nullable().optional(),
  endsAt: z.string().datetime({ offset: true }).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
});

const listAdvertisementSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  merchantId: z.uuid().optional(),
  campaignId: z.uuid().optional(),
  status: advertisementStatusSchema.optional(),
  type: advertisementTypeSchema.optional(),
});

export const marketingCampaignRoutes = new Hono<AppEnv>();

async function setCampaignStatus(
  campaignId: string,
  oldStatus: string,
  status: (typeof campaignStatusSchema.options)[number],
  note: string,
  userId: string,
  ipAddress: string | null,
  userAgent: string | null,
) {
  const [updated] = await db
    .update(marketingCampaigns)
    .set({ status })
    .where(eq(marketingCampaigns.id, campaignId))
    .returning();
  await writeAuditLog({
    actorUserId: userId,
    action: `marketing.campaign.${status}`,
    entityType: 'marketing_campaign',
    entityId: campaignId,
    oldValues: { status: oldStatus },
    newValues: { status, note },
    ipAddress,
    userAgent,
  });
  return updated!;
}

marketingCampaignRoutes.get(
  '/campaigns',
  requirePermission('marketing:read'),
  validate('query', listCampaignSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = marketingScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(marketingCampaigns.merchantId, query.merchantId));
    if (query.status) conditions.push(eq(marketingCampaigns.status, query.status));
    if (query.objective) conditions.push(eq(marketingCampaigns.objective, query.objective));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(marketingCampaigns.code, term),
          ilike(marketingCampaigns.name, term),
          ilike(merchants.businessName, term),
        ) as SQL,
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: marketingCampaigns.id,
          merchantId: marketingCampaigns.merchantId,
          merchantName: merchants.businessName,
          code: marketingCampaigns.code,
          name: marketingCampaigns.name,
          objective: marketingCampaigns.objective,
          status: marketingCampaigns.status,
          startsAt: marketingCampaigns.startsAt,
          endsAt: marketingCampaigns.endsAt,
          budget: marketingCampaigns.budget,
          spent: marketingCampaigns.spent,
          targetRevenue: marketingCampaigns.targetRevenue,
          createdAt: marketingCampaigns.createdAt,
        })
        .from(marketingCampaigns)
        .innerJoin(merchants, eq(merchants.id, marketingCampaigns.merchantId))
        .where(where)
        .orderBy(desc(marketingCampaigns.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(marketingCampaigns)
        .innerJoin(merchants, eq(merchants.id, marketingCampaigns.merchantId))
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

marketingCampaignRoutes.post(
  '/campaigns',
  requirePermission('marketing:write'),
  validate('json', createCampaignSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    await assertMarketingAccess(body.merchantId, user, permissions, { manage: true });

    const code = body.code ?? generateCode('CMP');
    const [existing] = await db
      .select({ id: marketingCampaigns.id })
      .from(marketingCampaigns)
      .where(
        and(
          eq(marketingCampaigns.merchantId, body.merchantId),
          eq(marketingCampaigns.code, code),
        ),
      )
      .limit(1);
    if (existing) throw ApiError.conflict('Kode kampanye sudah digunakan');

    const channelTypes = new Set<string>();
    for (const channel of body.channels ?? []) {
      if (channelTypes.has(channel.channelType)) {
        throw ApiError.badRequest('Channel kampanye tidak boleh duplikat');
      }
      channelTypes.add(channel.channelType);
    }

    const created = await db.transaction(async (tx) => {
      const [campaign] = await tx
        .insert(marketingCampaigns)
        .values({
          merchantId: body.merchantId,
          code,
          name: body.name,
          description: body.description ?? null,
          objective: body.objective,
          status: body.status,
          startsAt: body.startsAt ? new Date(body.startsAt) : null,
          endsAt: body.endsAt ? new Date(body.endsAt) : null,
          budget: body.budget,
          spent: body.spent,
          targetRevenue: body.targetRevenue,
          targetAudience: body.targetAudience ?? null,
          notes: body.notes ?? null,
          createdBy: user.id,
        })
        .returning();
      if (body.channels?.length) {
        await tx.insert(campaignChannels).values(
          body.channels.map((channel) => ({
            merchantId: body.merchantId,
            campaignId: campaign!.id,
            channelType: channel.channelType,
            name: channel.name ?? null,
            budget: channel.budget,
            spent: channel.spent,
            targetConversions: channel.targetConversions,
            metadata: channel.metadata ?? null,
          })),
        );
      }
      return campaign!;
    });

    await writeAuditLog({
      actorUserId: user.id,
      action: 'marketing.campaign.create',
      entityType: 'marketing_campaign',
      entityId: created.id,
      newValues: { code: created.code, name: created.name, status: created.status },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created, 201);
  },
);

marketingCampaignRoutes.get(
  '/campaigns/:id',
  requirePermission('marketing:read'),
  async (c) => {
    const { campaign } = await getCampaign(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    const [channels, performance] = await Promise.all([
      db
        .select()
        .from(campaignChannels)
        .where(eq(campaignChannels.campaignId, campaign.id))
        .orderBy(asc(campaignChannels.createdAt)),
      db
        .select()
        .from(campaignPerformance)
        .where(eq(campaignPerformance.campaignId, campaign.id))
        .orderBy(desc(campaignPerformance.date))
        .limit(50),
    ]);
    return ok(c, { ...campaign, channels, performance });
  },
);

marketingCampaignRoutes.patch(
  '/campaigns/:id',
  requirePermission('marketing:write'),
  validate('json', updateCampaignSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { campaign } = await getCampaign(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (body.code && body.code !== campaign.code) {
      const [existing] = await db
        .select({ id: marketingCampaigns.id })
        .from(marketingCampaigns)
        .where(
          and(
            eq(marketingCampaigns.merchantId, campaign.merchantId),
            eq(marketingCampaigns.code, body.code),
          ),
        )
        .limit(1);
      if (existing) throw ApiError.conflict('Kode kampanye sudah digunakan');
    }
    const [updated] = await db
      .update(marketingCampaigns)
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
      .where(eq(marketingCampaigns.id, campaign.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'marketing.campaign.update',
      entityType: 'marketing_campaign',
      entityId: campaign.id,
      oldValues: { status: campaign.status, name: campaign.name },
      newValues: body,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

for (const action of ['activate', 'pause', 'resume', 'complete', 'cancel'] as const) {
  marketingCampaignRoutes.post(
    `/campaigns/:id/${action}`,
    requirePermission('marketing:write'),
    async (c) => {
      const statusByAction = {
        activate: 'active',
        pause: 'paused',
        resume: 'active',
        complete: 'completed',
        cancel: 'cancelled',
      } as const;
      const allowed: Record<string, string[]> = {
        activate: ['draft', 'scheduled', 'paused'],
        pause: ['active'],
        resume: ['paused'],
        complete: ['active', 'paused', 'scheduled'],
        cancel: ['draft', 'scheduled', 'active', 'paused'],
      };
      const user = c.get('user');
      const permissions = c.get('permissions');
      const { campaign } = await getCampaign(c.req.param('id'), user, permissions, {
        manage: true,
      });
      if (!allowed[action]!.includes(campaign.status)) {
        throw ApiError.badRequest(
          `Kampanye berstatus ${campaign.status} tidak dapat ${action}`,
        );
      }
      const updated = await setCampaignStatus(
        campaign.id,
        campaign.status,
        statusByAction[action],
        action,
        user.id,
        getClientIp(c),
        c.req.header('user-agent') ?? null,
      );
      return ok(c, updated);
    },
  );
}

/* ------------------------------ Channels ------------------------------ */

marketingCampaignRoutes.get(
  '/campaigns/:id/channels',
  requirePermission('marketing:read'),
  async (c) => {
    const { campaign } = await getCampaign(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    const rows = await db
      .select()
      .from(campaignChannels)
      .where(eq(campaignChannels.campaignId, campaign.id))
      .orderBy(asc(campaignChannels.createdAt));
    return ok(c, rows);
  },
);

marketingCampaignRoutes.post(
  '/campaigns/:id/channels',
  requirePermission('marketing:write'),
  validate('json', channelInputSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { campaign } = await getCampaign(c.req.param('id'), user, permissions, {
      manage: true,
    });
    const [existing] = await db
      .select({ id: campaignChannels.id })
      .from(campaignChannels)
      .where(
        and(
          eq(campaignChannels.campaignId, campaign.id),
          eq(campaignChannels.channelType, body.channelType),
        ),
      )
      .limit(1);
    if (existing) throw ApiError.conflict('Channel tersebut sudah ada pada kampanye');
    const [created] = await db
      .insert(campaignChannels)
      .values({
        merchantId: campaign.merchantId,
        campaignId: campaign.id,
        channelType: body.channelType,
        name: body.name ?? null,
        budget: body.budget,
        spent: body.spent,
        targetConversions: body.targetConversions,
        metadata: body.metadata ?? null,
      })
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'marketing.campaign.channel.create',
      entityType: 'campaign_channel',
      entityId: created!.id,
      newValues: { campaignId: campaign.id, channelType: created!.channelType },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created!, 201);
  },
);

marketingCampaignRoutes.patch(
  '/campaign-channels/:id',
  requirePermission('marketing:write'),
  validate('json', updateChannelSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { channel } = await getCampaignChannel(
      c.req.param('id'),
      user,
      permissions,
      { manage: true },
    );
    const [updated] = await db
      .update(campaignChannels)
      .set(body)
      .where(eq(campaignChannels.id, channel.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'marketing.campaign.channel.update',
      entityType: 'campaign_channel',
      entityId: channel.id,
      newValues: body,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

marketingCampaignRoutes.delete(
  '/campaign-channels/:id',
  requirePermission('marketing:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { channel } = await getCampaignChannel(
      c.req.param('id'),
      user,
      permissions,
      { manage: true },
    );
    await db.delete(campaignChannels).where(eq(campaignChannels.id, channel.id));
    await writeAuditLog({
      actorUserId: user.id,
      action: 'marketing.campaign.channel.delete',
      entityType: 'campaign_channel',
      entityId: channel.id,
      oldValues: { channelType: channel.channelType, campaignId: channel.campaignId },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, { id: channel.id, deleted: true });
  },
);

/* ---------------------------- Performance ----------------------------- */

marketingCampaignRoutes.get(
  '/campaigns/:id/performance',
  requirePermission('marketing:read'),
  validate('query', listPerformanceSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { campaign } = await getCampaign(c.req.param('id'), user, permissions);
    const pagination = getPagination(query);
    const conditions: SQL[] = [eq(campaignPerformance.campaignId, campaign.id)];
    if (query.channelId) {
      conditions.push(eq(campaignPerformance.channelId, query.channelId));
    }
    if (query.from) conditions.push(gte(campaignPerformance.date, query.from));
    if (query.to) conditions.push(lte(campaignPerformance.date, query.to));
    const where = and(...conditions);
    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(campaignPerformance)
        .where(where)
        .orderBy(desc(campaignPerformance.date))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(campaignPerformance).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

marketingCampaignRoutes.post(
  '/campaigns/:id/performance',
  requirePermission('marketing:write'),
  validate('json', performanceInputSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { campaign } = await getCampaign(c.req.param('id'), user, permissions, {
      manage: true,
    });
    if (body.channelId) {
      const channel = await getCampaignChannel(body.channelId, user, permissions);
      if (channel.channel.campaignId !== campaign.id) {
        throw ApiError.badRequest('Channel tidak termasuk kampanye ini');
      }
    }
    const conditions: SQL[] = [
      eq(campaignPerformance.campaignId, campaign.id),
      eq(campaignPerformance.date, body.date),
    ];
    conditions.push(
      body.channelId
        ? eq(campaignPerformance.channelId, body.channelId)
        : isNull(campaignPerformance.channelId),
    );
    const [existing] = await db
      .select({ id: campaignPerformance.id })
      .from(campaignPerformance)
      .where(and(...conditions))
      .limit(1);
    const values = {
      merchantId: campaign.merchantId,
      campaignId: campaign.id,
      channelId: body.channelId ?? null,
      date: body.date,
      impressions: body.impressions,
      clicks: body.clicks,
      conversions: body.conversions,
      spend: body.spend,
      revenue: body.revenue,
      orders: body.orders,
      newCustomers: body.newCustomers,
      metrics: body.metrics ?? null,
    };
    const [saved] = existing
      ? await db
          .update(campaignPerformance)
          .set(values)
          .where(eq(campaignPerformance.id, existing.id))
          .returning()
      : await db.insert(campaignPerformance).values(values).returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: existing
        ? 'marketing.campaign.performance.update'
        : 'marketing.campaign.performance.create',
      entityType: 'campaign_performance',
      entityId: saved!.id,
      newValues: { campaignId: campaign.id, date: body.date, revenue: body.revenue },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, saved!, existing ? 200 : 201);
  },
);

marketingCampaignRoutes.get(
  '/campaign-performance',
  requirePermission('marketing:read'),
  validate('query', listPerformanceSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = marketingScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) {
      conditions.push(eq(campaignPerformance.merchantId, query.merchantId));
    }
    if (query.campaignId) {
      conditions.push(eq(campaignPerformance.campaignId, query.campaignId));
    }
    if (query.channelId) conditions.push(eq(campaignPerformance.channelId, query.channelId));
    if (query.from) conditions.push(gte(campaignPerformance.date, query.from));
    if (query.to) conditions.push(lte(campaignPerformance.date, query.to));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: campaignPerformance.id,
          merchantId: campaignPerformance.merchantId,
          merchantName: merchants.businessName,
          campaignId: campaignPerformance.campaignId,
          campaignName: marketingCampaigns.name,
          channelId: campaignPerformance.channelId,
          channelType: campaignChannels.channelType,
          date: campaignPerformance.date,
          impressions: campaignPerformance.impressions,
          clicks: campaignPerformance.clicks,
          conversions: campaignPerformance.conversions,
          spend: campaignPerformance.spend,
          revenue: campaignPerformance.revenue,
          orders: campaignPerformance.orders,
          newCustomers: campaignPerformance.newCustomers,
          createdAt: campaignPerformance.createdAt,
        })
        .from(campaignPerformance)
        .innerJoin(merchants, eq(merchants.id, campaignPerformance.merchantId))
        .innerJoin(
          marketingCampaigns,
          eq(marketingCampaigns.id, campaignPerformance.campaignId),
        )
        .leftJoin(
          campaignChannels,
          eq(campaignChannels.id, campaignPerformance.channelId),
        )
        .where(where)
        .orderBy(desc(campaignPerformance.date))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(campaignPerformance)
        .innerJoin(merchants, eq(merchants.id, campaignPerformance.merchantId))
        .innerJoin(
          marketingCampaigns,
          eq(marketingCampaigns.id, campaignPerformance.campaignId),
        )
        .leftJoin(
          campaignChannels,
          eq(campaignChannels.id, campaignPerformance.channelId),
        )
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

marketingCampaignRoutes.patch(
  '/campaign-performance/:id',
  requirePermission('marketing:write'),
  validate('json', performanceInputSchema.partial()),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { performance } = await getPerformance(
      c.req.param('id'),
      user,
      permissions,
      { manage: true },
    );
    const [updated] = await db
      .update(campaignPerformance)
      .set(body)
      .where(eq(campaignPerformance.id, performance.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'marketing.campaign.performance.update',
      entityType: 'campaign_performance',
      entityId: performance.id,
      newValues: body,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

marketingCampaignRoutes.delete(
  '/campaign-performance/:id',
  requirePermission('marketing:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { performance } = await getPerformance(
      c.req.param('id'),
      user,
      permissions,
      { manage: true },
    );
    await db.delete(campaignPerformance).where(eq(campaignPerformance.id, performance.id));
    await writeAuditLog({
      actorUserId: user.id,
      action: 'marketing.campaign.performance.delete',
      entityType: 'campaign_performance',
      entityId: performance.id,
      oldValues: { campaignId: performance.campaignId, date: performance.date },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, { id: performance.id, deleted: true });
  },
);

/* --------------------------- Advertisements --------------------------- */

marketingCampaignRoutes.get(
  '/advertisements',
  requirePermission('marketing:read'),
  validate('query', listAdvertisementSchema),
  async (c) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    const scope = marketingScopeCondition(user, permissions);
    if (scope) conditions.push(scope);
    if (query.merchantId) conditions.push(eq(advertisements.merchantId, query.merchantId));
    if (query.campaignId) conditions.push(eq(advertisements.campaignId, query.campaignId));
    if (query.status) conditions.push(eq(advertisements.status, query.status));
    if (query.type) conditions.push(eq(advertisements.type, query.type));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(advertisements.name, term),
          ilike(advertisements.placement, term),
          ilike(merchants.businessName, term),
        ) as SQL,
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: advertisements.id,
          merchantId: advertisements.merchantId,
          merchantName: merchants.businessName,
          campaignId: advertisements.campaignId,
          campaignName: marketingCampaigns.name,
          name: advertisements.name,
          type: advertisements.type,
          status: advertisements.status,
          placement: advertisements.placement,
          startsAt: advertisements.startsAt,
          endsAt: advertisements.endsAt,
          budget: advertisements.budget,
          spent: advertisements.spent,
          impressions: advertisements.impressions,
          clicks: advertisements.clicks,
          conversions: advertisements.conversions,
          revenue: advertisements.revenue,
          createdAt: advertisements.createdAt,
        })
        .from(advertisements)
        .innerJoin(merchants, eq(merchants.id, advertisements.merchantId))
        .leftJoin(
          marketingCampaigns,
          eq(marketingCampaigns.id, advertisements.campaignId),
        )
        .where(where)
        .orderBy(desc(advertisements.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(advertisements)
        .innerJoin(merchants, eq(merchants.id, advertisements.merchantId))
        .leftJoin(
          marketingCampaigns,
          eq(marketingCampaigns.id, advertisements.campaignId),
        )
        .where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

marketingCampaignRoutes.post(
  '/advertisements',
  requirePermission('marketing:write'),
  validate('json', advertisementInputSchema.extend({ merchantId: z.uuid() })),
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
    const [created] = await db
      .insert(advertisements)
      .values({
        merchantId: body.merchantId,
        campaignId: body.campaignId ?? null,
        name: body.name,
        type: body.type,
        status: body.status,
        placement: body.placement ?? null,
        creativeUrl: body.creativeUrl ?? null,
        targetUrl: body.targetUrl ?? null,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        budget: body.budget,
        spent: body.spent,
        impressions: body.impressions,
        clicks: body.clicks,
        conversions: body.conversions,
        revenue: body.revenue,
        notes: body.notes ?? null,
        createdBy: user.id,
      })
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'marketing.advertisement.create',
      entityType: 'advertisement',
      entityId: created!.id,
      newValues: { name: created!.name, type: created!.type },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, created!, 201);
  },
);

marketingCampaignRoutes.get(
  '/advertisements/:id',
  requirePermission('marketing:read'),
  async (c) => {
    const { advertisement } = await getAdvertisement(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
    );
    return ok(c, advertisement);
  },
);

marketingCampaignRoutes.patch(
  '/advertisements/:id',
  requirePermission('marketing:write'),
  validate('json', updateAdvertisementSchema),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { advertisement } = await getAdvertisement(
      c.req.param('id'),
      user,
      permissions,
      { manage: true },
    );
    if (body.campaignId) {
      const { campaign } = await getCampaign(body.campaignId, user, permissions);
      if (campaign.merchantId !== advertisement.merchantId) {
        throw ApiError.badRequest('Kampanye tidak dimiliki merchant ini');
      }
    }
    const [updated] = await db
      .update(advertisements)
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
      .where(eq(advertisements.id, advertisement.id))
      .returning();
    await writeAuditLog({
      actorUserId: user.id,
      action: 'marketing.advertisement.update',
      entityType: 'advertisement',
      entityId: advertisement.id,
      oldValues: { status: advertisement.status, name: advertisement.name },
      newValues: body,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, updated!);
  },
);

marketingCampaignRoutes.delete(
  '/advertisements/:id',
  requirePermission('marketing:write'),
  async (c) => {
    const user = c.get('user');
    const permissions = c.get('permissions');
    const { advertisement } = await getAdvertisement(
      c.req.param('id'),
      user,
      permissions,
      { manage: true },
    );
    await db
      .update(advertisements)
      .set({ status: 'cancelled' })
      .where(eq(advertisements.id, advertisement.id));
    await writeAuditLog({
      actorUserId: user.id,
      action: 'marketing.advertisement.cancel',
      entityType: 'advertisement',
      entityId: advertisement.id,
      oldValues: { status: advertisement.status, name: advertisement.name },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });
    return ok(c, { id: advertisement.id, cancelled: true });
  },
);
