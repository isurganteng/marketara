import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db';
import {
  merchantCategories,
  organizationTypes,
  permissions as permissionsTable,
  roles,
} from '../db/schema';
import { ok } from '../lib/http';
import type { AppEnv } from '../lib/app-env';
import { requireAuth, requirePermission } from '../middleware/auth';

export const referenceRoutes = new Hono<AppEnv>();

referenceRoutes.use('*', requireAuth);

referenceRoutes.get('/organization-types', async (c) => {
  const rows = await db.select().from(organizationTypes).orderBy(organizationTypes.name);
  return ok(c, rows);
});

referenceRoutes.get('/merchant-categories', async (c) => {
  const rows = await db
    .select()
    .from(merchantCategories)
    .where(eq(merchantCategories.isActive, true))
    .orderBy(merchantCategories.name);
  return ok(c, rows);
});

referenceRoutes.get('/roles', requirePermission('role:manage'), async (c) => {
  const rows = await db.select().from(roles).orderBy(roles.name);
  return ok(c, rows);
});

referenceRoutes.get('/permissions', requirePermission('role:manage'), async (c) => {
  const rows = await db.select().from(permissionsTable).orderBy(permissionsTable.module, permissionsTable.code);
  return ok(c, rows);
});
