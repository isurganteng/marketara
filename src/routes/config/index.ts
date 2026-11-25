import { and, asc, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { db } from '../../db';
import {
  configurationGroups,
  featureFlags,
  localizationSettings,
  referenceCodes,
  referenceValues,
  serviceParameters,
  systemSettings,
} from '../../db/schema';
import { writeAuditLog } from '../../lib/audit';
import type { AppEnv } from '../../lib/app-env';
import { ApiError } from '../../lib/errors';
import { getPagination, ok, paginated } from '../../lib/http';
import { validate } from '../../lib/validator';
import { requireAuth, requirePermission } from '../../middleware/auth';
import { getClientIp } from '../../services/auth';

const codeSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[A-Za-z0-9_.-]+$/, 'Gunakan huruf, angka, titik, garis bawah, atau tanda hubung');
const optionalText = (max = 8000) => z.string().trim().max(max).optional().nullable();
const valueTypeSchema = z.enum(['string', 'number', 'boolean', 'json', 'secret']);
const scopeSchema = z.enum(['global', 'organization', 'merchant', 'user']);
const statusSchema = z.enum(['active', 'archived']);
const flagStatusSchema = z.enum(['enabled', 'disabled', 'rollout']);
const localizationStatusSchema = z.enum(['active', 'inactive']);

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
});

const createGroupSchema = z.object({
  code: codeSchema.optional(),
  name: z.string().trim().min(2).max(128),
  description: optionalText(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});
const updateGroupSchema = createGroupSchema.partial();

const createSettingSchema = z.object({
  groupId: z.uuid().optional().nullable(),
  key: z.string().trim().min(2).max(128),
  label: z.string().trim().min(2).max(255),
  description: optionalText(),
  valueType: valueTypeSchema.default('string'),
  value: optionalText(20000),
  defaultValue: optionalText(20000),
  scope: scopeSchema.default('global'),
  scopeId: z.uuid().optional().nullable(),
  isSecret: z.boolean().default(false),
  isEditable: z.boolean().default(true),
  status: statusSchema.default('active'),
});
const updateSettingSchema = createSettingSchema.partial();
const bulkSettingsSchema = z.object({
  items: z
    .array(
      z.object({
        key: z.string().trim().min(2).max(128),
        value: z.string().trim().max(20000).nullable(),
        scope: scopeSchema.default('global'),
        scopeId: z.uuid().optional().nullable(),
      }),
    )
    .min(1),
});

const createReferenceCodeSchema = z.object({
  code: codeSchema.optional(),
  name: z.string().trim().min(2).max(128),
  description: optionalText(),
  isSystem: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
const updateReferenceCodeSchema = createReferenceCodeSchema.partial();

const createReferenceValueSchema = z.object({
  code: codeSchema,
  label: z.string().trim().min(1).max(128),
  value: optionalText(2000),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});
const updateReferenceValueSchema = createReferenceValueSchema.partial();

const createFlagSchema = z.object({
  key: codeSchema,
  name: z.string().trim().min(2).max(255),
  description: optionalText(),
  status: flagStatusSchema.default('disabled'),
  rolloutPercentage: z.coerce.number().int().min(0).max(100).default(0),
  audience: z.record(z.string(), z.unknown()).optional().nullable(),
  startsAt: z.coerce.date().optional().nullable(),
  endsAt: z.coerce.date().optional().nullable(),
});
const updateFlagSchema = createFlagSchema.partial();

const createServiceParameterSchema = z.object({
  service: z.string().trim().min(2).max(64),
  key: z.string().trim().min(2).max(128),
  label: z.string().trim().min(2).max(255),
  description: optionalText(),
  valueType: valueTypeSchema.default('string'),
  value: optionalText(20000),
  isSecret: z.boolean().default(false),
});
const updateServiceParameterSchema = createServiceParameterSchema.partial();

const createLocalizationSchema = z.object({
  locale: z.string().trim().min(2).max(16),
  language: z.string().trim().min(2).max(64),
  currency: z.string().trim().length(3).default('IDR'),
  timezone: z.string().trim().max(64).default('Asia/Jakarta'),
  dateFormat: z.string().trim().max(32).default('DD/MM/YYYY'),
  numberFormat: z.string().trim().max(32).default('id-ID'),
  isDefault: z.boolean().default(false),
  status: localizationStatusSchema.default('active'),
  translations: z.record(z.string(), z.unknown()).optional().nullable(),
});
const updateLocalizationSchema = createLocalizationSchema.partial();

export const configRoutes = new Hono<AppEnv>();
configRoutes.use('*', requireAuth);

function audit(
  c: Context<AppEnv>,
  action: string,
  entityType: string,
  entityId: string,
  values?: { oldValues?: Record<string, unknown>; newValues?: Record<string, unknown> },
) {
  return writeAuditLog({
    actorUserId: c.get('user').id,
    action,
    entityType,
    entityId,
    oldValues: values?.oldValues ?? null,
    newValues: values?.newValues ?? null,
    ipAddress: getClientIp(c),
    userAgent: c.req.header('user-agent') ?? null,
  });
}

function maskSetting<T extends { isSecret: boolean; value: string | null }>(row: T): T {
  return row.isSecret ? { ...row, value: row.value ? '********' : null } : row;
}

function maskParameter<T extends { isSecret: boolean; value: string | null }>(row: T): T {
  return row.isSecret ? { ...row, value: row.value ? '********' : null } : row;
}

/* ---------------------------- Config groups --------------------------- */

configRoutes.get(
  '/groups',
  requirePermission('config:read'),
  validate('query', listSchema),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(configurationGroups.code, term),
          ilike(configurationGroups.name, term),
        ) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(configurationGroups)
        .where(where)
        .orderBy(asc(configurationGroups.sortOrder), asc(configurationGroups.name))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(configurationGroups).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

configRoutes.post(
  '/groups',
  requirePermission('config:write'),
  validate('json', createGroupSchema),
  async (c) => {
    const body = c.req.valid('json');
    const code = body.code ?? `group_${Date.now()}`;
    const [created] = await db
      .insert(configurationGroups)
      .values({ ...body, code })
      .returning();
    await audit(c, 'config.group.create', 'configuration_group', created!.id);
    return ok(c, created!, 201);
  },
);

configRoutes.patch(
  '/groups/:id',
  requirePermission('config:write'),
  validate('json', updateGroupSchema),
  async (c) => {
    const body = c.req.valid('json');
    const row = await db.query.configurationGroups.findFirst({
      where: eq(configurationGroups.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Grup konfigurasi tidak ditemukan');
    const [updated] = await db
      .update(configurationGroups)
      .set({ ...body })
      .where(eq(configurationGroups.id, row.id))
      .returning();
    await audit(c, 'config.group.update', 'configuration_group', row.id);
    return ok(c, updated!);
  },
);

configRoutes.delete(
  '/groups/:id',
  requirePermission('config:manage'),
  async (c) => {
    const row = await db.query.configurationGroups.findFirst({
      where: eq(configurationGroups.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Grup konfigurasi tidak ditemukan');
    await db.delete(configurationGroups).where(eq(configurationGroups.id, row.id));
    await audit(c, 'config.group.delete', 'configuration_group', row.id);
    return ok(c, { id: row.id, deleted: true });
  },
);

/* ---------------------------- System settings ------------------------- */

configRoutes.get(
  '/settings',
  requirePermission('config:read'),
  validate('query', listSchema.extend({ groupId: z.uuid().optional(), scope: scopeSchema.optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.groupId) conditions.push(eq(systemSettings.groupId, query.groupId));
    if (query.scope) conditions.push(eq(systemSettings.scope, query.scope));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(ilike(systemSettings.key, term), ilike(systemSettings.label, term)) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select({
          id: systemSettings.id,
          groupId: systemSettings.groupId,
          groupName: configurationGroups.name,
          key: systemSettings.key,
          label: systemSettings.label,
          description: systemSettings.description,
          valueType: systemSettings.valueType,
          value: systemSettings.value,
          defaultValue: systemSettings.defaultValue,
          scope: systemSettings.scope,
          scopeId: systemSettings.scopeId,
          isSecret: systemSettings.isSecret,
          isEditable: systemSettings.isEditable,
          status: systemSettings.status,
          version: systemSettings.version,
          createdAt: systemSettings.createdAt,
          updatedAt: systemSettings.updatedAt,
        })
        .from(systemSettings)
        .leftJoin(configurationGroups, eq(configurationGroups.id, systemSettings.groupId))
        .where(where)
        .orderBy(asc(systemSettings.key))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(systemSettings).where(where),
    ]);
    return paginated(c, rows.map(maskSetting), totalRow?.total ?? 0, pagination);
  },
);

configRoutes.post(
  '/settings',
  requirePermission('config:write'),
  validate('json', createSettingSchema),
  async (c) => {
    const body = c.req.valid('json');
    if (body.groupId) {
      const group = await db.query.configurationGroups.findFirst({
        where: eq(configurationGroups.id, body.groupId),
      });
      if (!group) throw ApiError.notFound('Grup konfigurasi tidak ditemukan');
    }
    const [created] = await db
      .insert(systemSettings)
      .values({
        ...body,
        groupId: body.groupId ?? null,
        value: body.value ?? null,
        defaultValue: body.defaultValue ?? null,
        scopeId: body.scopeId ?? null,
        updatedBy: c.get('user').id,
      })
      .returning();
    await audit(c, 'config.setting.create', 'system_setting', created!.id, {
      newValues: { key: created!.key, scope: created!.scope },
    });
    return ok(c, maskSetting(created!), 201);
  },
);

configRoutes.patch(
  '/settings/:id',
  requirePermission('config:write'),
  validate('json', updateSettingSchema),
  async (c) => {
    const body = c.req.valid('json');
    const row = await db.query.systemSettings.findFirst({
      where: eq(systemSettings.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Pengaturan tidak ditemukan');
    if (!row.isEditable) throw ApiError.badRequest('Pengaturan tidak dapat diubah');
    const [updated] = await db
      .update(systemSettings)
      .set({ ...body, version: row.version + 1, updatedBy: c.get('user').id })
      .where(eq(systemSettings.id, row.id))
      .returning();
    await audit(c, 'config.setting.update', 'system_setting', row.id, {
      oldValues: { key: row.key, version: row.version },
      newValues: { key: updated!.key, version: updated!.version },
    });
    return ok(c, maskSetting(updated!));
  },
);

configRoutes.post(
  '/settings/bulk',
  requirePermission('config:write'),
  validate('json', bulkSettingsSchema),
  async (c) => {
    const body = c.req.valid('json');
    const updatedRows = [];
    for (const item of body.items) {
      const [row] = await db
        .update(systemSettings)
        .set({ value: item.value, updatedBy: c.get('user').id })
        .where(
          and(
            eq(systemSettings.key, item.key),
            eq(systemSettings.scope, item.scope),
            item.scopeId
              ? eq(systemSettings.scopeId, item.scopeId)
              : eq(systemSettings.scope, 'global'),
          ),
        )
        .returning();
      if (row) updatedRows.push(maskSetting(row));
    }
    await audit(c, 'config.setting.bulk_update', 'system_setting', 'bulk', {
      newValues: { keys: body.items.map((item) => item.key) },
    });
    return ok(c, updatedRows);
  },
);

configRoutes.delete(
  '/settings/:id',
  requirePermission('config:manage'),
  async (c) => {
    const row = await db.query.systemSettings.findFirst({
      where: eq(systemSettings.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Pengaturan tidak ditemukan');
    await db.delete(systemSettings).where(eq(systemSettings.id, row.id));
    await audit(c, 'config.setting.delete', 'system_setting', row.id);
    return ok(c, { id: row.id, deleted: true });
  },
);

/* ---------------------------- Reference data -------------------------- */

configRoutes.get(
  '/reference-codes',
  requirePermission('config:read'),
  validate('query', listSchema),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(ilike(referenceCodes.code, term), ilike(referenceCodes.name, term)) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(referenceCodes)
        .where(where)
        .orderBy(asc(referenceCodes.name))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(referenceCodes).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

configRoutes.post(
  '/reference-codes',
  requirePermission('config:write'),
  validate('json', createReferenceCodeSchema),
  async (c) => {
    const body = c.req.valid('json');
    const code = body.code ?? `ref_${Date.now()}`;
    const [created] = await db
      .insert(referenceCodes)
      .values({ ...body, code })
      .returning();
    await audit(c, 'config.reference_code.create', 'reference_code', created!.id);
    return ok(c, created!, 201);
  },
);

configRoutes.patch(
  '/reference-codes/:id',
  requirePermission('config:write'),
  validate('json', updateReferenceCodeSchema),
  async (c) => {
    const body = c.req.valid('json');
    const row = await db.query.referenceCodes.findFirst({
      where: eq(referenceCodes.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Kode referensi tidak ditemukan');
    const [updated] = await db
      .update(referenceCodes)
      .set({ ...body })
      .where(eq(referenceCodes.id, row.id))
      .returning();
    await audit(c, 'config.reference_code.update', 'reference_code', row.id);
    return ok(c, updated!);
  },
);

configRoutes.delete(
  '/reference-codes/:id',
  requirePermission('config:manage'),
  async (c) => {
    const row = await db.query.referenceCodes.findFirst({
      where: eq(referenceCodes.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Kode referensi tidak ditemukan');
    if (row.isSystem) throw ApiError.badRequest('Kode referensi sistem tidak dapat dihapus');
    await db.delete(referenceCodes).where(eq(referenceCodes.id, row.id));
    await audit(c, 'config.reference_code.delete', 'reference_code', row.id);
    return ok(c, { id: row.id, deleted: true });
  },
);

configRoutes.get(
  '/reference-codes/:id/values',
  requirePermission('config:read'),
  async (c) => {
    const code = await db.query.referenceCodes.findFirst({
      where: eq(referenceCodes.id, c.req.param('id')),
    });
    if (!code) throw ApiError.notFound('Kode referensi tidak ditemukan');
    const rows = await db
      .select()
      .from(referenceValues)
      .where(eq(referenceValues.codeId, code.id))
      .orderBy(asc(referenceValues.sortOrder), asc(referenceValues.label));
    return ok(c, rows);
  },
);

configRoutes.post(
  '/reference-codes/:id/values',
  requirePermission('config:write'),
  validate('json', createReferenceValueSchema),
  async (c) => {
    const body = c.req.valid('json');
    const code = await db.query.referenceCodes.findFirst({
      where: eq(referenceCodes.id, c.req.param('id')),
    });
    if (!code) throw ApiError.notFound('Kode referensi tidak ditemukan');
    const [created] = await db
      .insert(referenceValues)
      .values({ ...body, codeId: code.id })
      .returning();
    await audit(c, 'config.reference_value.create', 'reference_value', created!.id);
    return ok(c, created!, 201);
  },
);

configRoutes.patch(
  '/reference-values/:id',
  requirePermission('config:write'),
  validate('json', updateReferenceValueSchema),
  async (c) => {
    const body = c.req.valid('json');
    const row = await db.query.referenceValues.findFirst({
      where: eq(referenceValues.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Nilai referensi tidak ditemukan');
    const [updated] = await db
      .update(referenceValues)
      .set({ ...body })
      .where(eq(referenceValues.id, row.id))
      .returning();
    await audit(c, 'config.reference_value.update', 'reference_value', row.id);
    return ok(c, updated!);
  },
);

configRoutes.delete(
  '/reference-values/:id',
  requirePermission('config:manage'),
  async (c) => {
    const row = await db.query.referenceValues.findFirst({
      where: eq(referenceValues.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Nilai referensi tidak ditemukan');
    await db.delete(referenceValues).where(eq(referenceValues.id, row.id));
    await audit(c, 'config.reference_value.delete', 'reference_value', row.id);
    return ok(c, { id: row.id, deleted: true });
  },
);

/* ----------------------------- Feature flags -------------------------- */

configRoutes.get(
  '/feature-flags',
  requirePermission('config:read'),
  validate('query', listSchema.extend({ status: flagStatusSchema.optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.status) conditions.push(eq(featureFlags.status, query.status));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(or(ilike(featureFlags.key, term), ilike(featureFlags.name, term)) as SQL);
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(featureFlags)
        .where(where)
        .orderBy(asc(featureFlags.key))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(featureFlags).where(where),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

configRoutes.post(
  '/feature-flags',
  requirePermission('config:write'),
  validate('json', createFlagSchema),
  async (c) => {
    const body = c.req.valid('json');
    const [created] = await db
      .insert(featureFlags)
      .values({ ...body, updatedBy: c.get('user').id })
      .returning();
    await audit(c, 'config.feature_flag.create', 'feature_flag', created!.id, {
      newValues: { key: created!.key, status: created!.status },
    });
    return ok(c, created!, 201);
  },
);

configRoutes.patch(
  '/feature-flags/:id',
  requirePermission('config:write'),
  validate('json', updateFlagSchema),
  async (c) => {
    const body = c.req.valid('json');
    const row = await db.query.featureFlags.findFirst({
      where: eq(featureFlags.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Feature flag tidak ditemukan');
    const [updated] = await db
      .update(featureFlags)
      .set({ ...body, updatedBy: c.get('user').id })
      .where(eq(featureFlags.id, row.id))
      .returning();
    await audit(c, 'config.feature_flag.update', 'feature_flag', row.id, {
      oldValues: { status: row.status },
      newValues: { status: updated!.status },
    });
    return ok(c, updated!);
  },
);

configRoutes.post(
  '/feature-flags/:id/toggle',
  requirePermission('config:write'),
  async (c) => {
    const row = await db.query.featureFlags.findFirst({
      where: eq(featureFlags.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Feature flag tidak ditemukan');
    const [updated] = await db
      .update(featureFlags)
      .set({
        status: row.status === 'enabled' ? 'disabled' : 'enabled',
        updatedBy: c.get('user').id,
      })
      .where(eq(featureFlags.id, row.id))
      .returning();
    await audit(c, 'config.feature_flag.toggle', 'feature_flag', row.id, {
      oldValues: { status: row.status },
      newValues: { status: updated!.status },
    });
    return ok(c, updated!);
  },
);

configRoutes.delete(
  '/feature-flags/:id',
  requirePermission('config:manage'),
  async (c) => {
    const row = await db.query.featureFlags.findFirst({
      where: eq(featureFlags.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Feature flag tidak ditemukan');
    await db.delete(featureFlags).where(eq(featureFlags.id, row.id));
    await audit(c, 'config.feature_flag.delete', 'feature_flag', row.id);
    return ok(c, { id: row.id, deleted: true });
  },
);

/* --------------------------- Service parameters ----------------------- */

configRoutes.get(
  '/service-parameters',
  requirePermission('config:read'),
  validate('query', listSchema.extend({ service: z.string().max(64).optional() })),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const conditions: SQL[] = [];
    if (query.service) conditions.push(eq(serviceParameters.service, query.service));
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(serviceParameters.key, term),
          ilike(serviceParameters.label, term),
          ilike(serviceParameters.service, term),
        ) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(serviceParameters)
        .where(where)
        .orderBy(asc(serviceParameters.service), asc(serviceParameters.key))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(serviceParameters).where(where),
    ]);
    return paginated(c, rows.map(maskParameter), totalRow?.total ?? 0, pagination);
  },
);

configRoutes.post(
  '/service-parameters',
  requirePermission('config:write'),
  validate('json', createServiceParameterSchema),
  async (c) => {
    const body = c.req.valid('json');
    const [created] = await db
      .insert(serviceParameters)
      .values({ ...body, updatedBy: c.get('user').id })
      .returning();
    await audit(c, 'config.service_parameter.create', 'service_parameter', created!.id);
    return ok(c, maskParameter(created!), 201);
  },
);

configRoutes.patch(
  '/service-parameters/:id',
  requirePermission('config:write'),
  validate('json', updateServiceParameterSchema),
  async (c) => {
    const body = c.req.valid('json');
    const row = await db.query.serviceParameters.findFirst({
      where: eq(serviceParameters.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Parameter layanan tidak ditemukan');
    const [updated] = await db
      .update(serviceParameters)
      .set({ ...body, version: row.version + 1, updatedBy: c.get('user').id })
      .where(eq(serviceParameters.id, row.id))
      .returning();
    await audit(c, 'config.service_parameter.update', 'service_parameter', row.id);
    return ok(c, maskParameter(updated!));
  },
);

configRoutes.delete(
  '/service-parameters/:id',
  requirePermission('config:manage'),
  async (c) => {
    const row = await db.query.serviceParameters.findFirst({
      where: eq(serviceParameters.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Parameter layanan tidak ditemukan');
    await db.delete(serviceParameters).where(eq(serviceParameters.id, row.id));
    await audit(c, 'config.service_parameter.delete', 'service_parameter', row.id);
    return ok(c, { id: row.id, deleted: true });
  },
);

/* ----------------------------- Localization --------------------------- */

configRoutes.get(
  '/localization',
  requirePermission('config:read'),
  validate('query', listSchema),
  async (c) => {
    const query = c.req.valid('query');
    const pagination = getPagination(query);
    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(localizationSettings)
        .orderBy(desc(localizationSettings.isDefault), asc(localizationSettings.locale))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(localizationSettings),
    ]);
    return paginated(c, rows, totalRow?.total ?? 0, pagination);
  },
);

configRoutes.post(
  '/localization',
  requirePermission('config:write'),
  validate('json', createLocalizationSchema),
  async (c) => {
    const body = c.req.valid('json');
    if (body.isDefault) {
      await db.update(localizationSettings).set({ isDefault: false });
    }
    const [created] = await db
      .insert(localizationSettings)
      .values({ ...body })
      .returning();
    await audit(c, 'config.localization.create', 'localization_setting', created!.id);
    return ok(c, created!, 201);
  },
);

configRoutes.patch(
  '/localization/:id',
  requirePermission('config:write'),
  validate('json', updateLocalizationSchema),
  async (c) => {
    const body = c.req.valid('json');
    const row = await db.query.localizationSettings.findFirst({
      where: eq(localizationSettings.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Pengaturan lokalisasi tidak ditemukan');
    if (body.isDefault) {
      await db.update(localizationSettings).set({ isDefault: false });
    }
    const [updated] = await db
      .update(localizationSettings)
      .set({ ...body })
      .where(eq(localizationSettings.id, row.id))
      .returning();
    await audit(c, 'config.localization.update', 'localization_setting', row.id);
    return ok(c, updated!);
  },
);

configRoutes.post(
  '/localization/:id/default',
  requirePermission('config:write'),
  async (c) => {
    const row = await db.query.localizationSettings.findFirst({
      where: eq(localizationSettings.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Pengaturan lokalisasi tidak ditemukan');
    await db.update(localizationSettings).set({ isDefault: false });
    const [updated] = await db
      .update(localizationSettings)
      .set({ isDefault: true, status: 'active' })
      .where(eq(localizationSettings.id, row.id))
      .returning();
    await audit(c, 'config.localization.set_default', 'localization_setting', row.id);
    return ok(c, updated!);
  },
);

configRoutes.delete(
  '/localization/:id',
  requirePermission('config:manage'),
  async (c) => {
    const row = await db.query.localizationSettings.findFirst({
      where: eq(localizationSettings.id, c.req.param('id')),
    });
    if (!row) throw ApiError.notFound('Pengaturan lokalisasi tidak ditemukan');
    if (row.isDefault) throw ApiError.badRequest('Lokalisasi default tidak dapat dihapus');
    await db.delete(localizationSettings).where(eq(localizationSettings.id, row.id));
    await audit(c, 'config.localization.delete', 'localization_setting', row.id);
    return ok(c, { id: row.id, deleted: true });
  },
);
