import { and, eq, isNull, ne } from 'drizzle-orm';
import type { Context } from 'hono';
import { db } from '../db';
import {
  organizationMembers,
  organizations,
  permissions as permissionsTable,
  rolePermissions,
  userRoles,
  userSessions,
  users,
} from '../db/schema';
import { env } from '../config';
import { generateSessionToken, hashToken } from '../lib/crypto';
import type { AuthUser } from '../types';

export function getClientIp(c: Context): string | null {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? null;
  return c.req.header('x-real-ip') ?? null;
}

export async function getPermissionsForUser(userId: string): Promise<string[]> {
  const rows = await db
    .select({ code: permissionsTable.code })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .innerJoin(permissionsTable, eq(permissionsTable.id, rolePermissions.permissionId))
    .where(and(eq(userRoles.userId, userId), isNull(userRoles.organizationId)));

  return [...new Set(rows.map((row) => row.code))].sort();
}

export async function createSession(userId: string, c: Context) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + env.sessionTtlDays * 24 * 60 * 60 * 1000);

  const [session] = await db
    .insert(userSessions)
    .values({
      userId,
      tokenHash: hashToken(token),
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
      expiresAt,
    })
    .returning({ id: userSessions.id, expiresAt: userSessions.expiresAt });

  return { token, sessionId: session!.id, expiresAt };
}

export async function revokeSession(sessionId: string) {
  await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(userSessions.id, sessionId), isNull(userSessions.revokedAt)));
}

export async function revokeAllUserSessions(userId: string, exceptSessionId?: string) {
  const conditions = [eq(userSessions.userId, userId), isNull(userSessions.revokedAt)];
  if (exceptSessionId) {
    conditions.push(ne(userSessions.id, exceptSessionId));
  }
  await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(and(...conditions));
}

export async function getProfile(user: AuthUser) {
  const [permissions, memberships] = await Promise.all([
    getPermissionsForUser(user.id),
    db
      .select({
        organizationId: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        role: organizationMembers.role,
        status: organizationMembers.status,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
      .where(
        and(
          eq(organizationMembers.userId, user.id),
          eq(organizationMembers.status, 'active'),
          isNull(organizations.deletedAt),
        ),
      ),
  ]);

  return {
    user,
    permissions,
    organizations: memberships,
  };
}

export async function getUserByEmail(email: string) {
  return db.query.users.findFirst({
    where: and(eq(users.email, email), isNull(users.deletedAt)),
  });
}
