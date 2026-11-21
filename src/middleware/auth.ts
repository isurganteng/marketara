import { and, eq, gt, isNull } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import { db } from '../db';
import {
  permissions as permissionsTable,
  rolePermissions,
  userRoles,
  userSessions,
  users,
} from '../db/schema';
import { hashToken } from '../lib/crypto';
import { ApiError } from '../lib/errors';
import type { AppEnv } from '../lib/app-env';

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header('authorization');
  const token = header?.toLowerCase().startsWith('bearer ')
    ? header.slice(7).trim()
    : c.req.header('x-session-token');

  if (!token) throw ApiError.unauthorized();

  const rows = await db
    .select({
      sessionId: userSessions.id,
      userId: users.id,
      email: users.email,
      fullName: users.fullName,
      status: users.status,
      permissionCode: permissionsTable.code,
    })
    .from(userSessions)
    .innerJoin(users, eq(users.id, userSessions.userId))
    .leftJoin(
      userRoles,
      and(eq(userRoles.userId, users.id), isNull(userRoles.organizationId)),
    )
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .leftJoin(permissionsTable, eq(permissionsTable.id, rolePermissions.permissionId))
    .where(
      and(
        eq(userSessions.tokenHash, hashToken(token)),
        isNull(userSessions.revokedAt),
        gt(userSessions.expiresAt, new Date()),
        isNull(users.deletedAt),
      ),
    );

  const first = rows[0];
  if (!first) throw ApiError.unauthorized('Session is invalid or has expired');
  if (first.status !== 'active') {
    throw ApiError.forbidden('User account is not active');
  }

  const permissionSet = new Set<string>();
  for (const row of rows) {
    if (row.permissionCode) permissionSet.add(row.permissionCode);
  }

  c.set('user', {
    id: first.userId,
    email: first.email,
    fullName: first.fullName,
    status: first.status,
  });
  c.set('sessionId', first.sessionId);
  c.set('permissions', permissionSet);

  // Update aktivitas sesi tanpa memblokir request bila gagal.
  void db
    .update(userSessions)
    .set({ lastUsedAt: new Date() })
    .where(eq(userSessions.id, first.sessionId))
    .catch(() => {});

  await next();
};

export function requirePermission(...codes: string[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const granted = c.get('permissions');
    const allowed = granted.has('*') || codes.every((code) => granted.has(code));
    if (!allowed) {
      throw ApiError.forbidden(
        `Missing permission: ${codes.filter((code) => !granted.has(code)).join(', ')}`,
      );
    }
    await next();
  };
}
