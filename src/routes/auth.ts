import { and, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db';
import { authenticationLogs, roles, userRoles, users } from '../db/schema';
import { writeAuditLog } from '../lib/audit';
import { hashPassword, verifyPassword } from '../lib/crypto';
import { ApiError } from '../lib/errors';
import { ok } from '../lib/http';
import type { AppEnv } from '../lib/app-env';
import { validate } from '../lib/validator';
import { requireAuth } from '../middleware/auth';
import {
  createSession,
  getClientIp,
  getPermissionsForUser,
  getProfile,
  getUserByEmail,
  revokeAllUserSessions,
  revokeSession,
} from '../services/auth';

const passwordSchema = z.string().min(8, 'Password minimal 8 karakter').max(128);

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().max(255).email(),
  phone: z.string().trim().min(6).max(32).optional(),
  fullName: z.string().trim().min(2).max(255),
  password: passwordSchema,
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(255).email(),
  password: z.string().min(1).max(128),
});

const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(2).max(255).optional(),
    phone: z.string().trim().min(6).max(32).nullable().optional(),
    avatarUrl: z.string().url().max(2048).nullable().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Minimal satu field harus diisi',
  });

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

async function recordAuthEvent(input: {
  userId?: string | null;
  email?: string | null;
  event: 'login_success' | 'login_failed' | 'logout' | 'session_revoked';
  c: import('hono').Context;
}) {
  await db.insert(authenticationLogs).values({
    userId: input.userId ?? null,
    email: input.email ?? null,
    event: input.event,
    ipAddress: getClientIp(input.c),
    userAgent: input.c.req.header('user-agent') ?? null,
  });
}

export const authRoutes = new Hono<AppEnv>();

authRoutes.post('/register', validate('json', registerSchema), async (c) => {
  const body = c.req.valid('json');

  const existing = await getUserByEmail(body.email);
  if (existing) throw ApiError.conflict('Email is already registered');

  if (body.phone) {
    const phoneOwner = await db.query.users.findFirst({
      columns: { id: true },
      where: and(eq(users.phone, body.phone), isNull(users.deletedAt)),
    });
    if (phoneOwner) throw ApiError.conflict('Phone number is already registered');
  }

  const passwordHash = await hashPassword(body.password);

  const user = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({
        email: body.email,
        phone: body.phone ?? null,
        fullName: body.fullName,
        passwordHash,
        status: 'active',
      })
      .returning({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        status: users.status,
      });

    if (!created) throw ApiError.internal('Failed to create user');

    const memberRole = await tx.query.roles.findFirst({
      where: eq(roles.code, 'member'),
      columns: { id: true },
    });
    if (memberRole) {
      await tx.insert(userRoles).values({ userId: created.id, roleId: memberRole.id });
    }

    return created;
  });

  const session = await createSession(user.id, c);
  const profile = await getProfile(user);

  await recordAuthEvent({ userId: user.id, email: user.email, event: 'login_success', c });
  await writeAuditLog({
    actorUserId: user.id,
    action: 'auth.register',
    entityType: 'user',
    entityId: user.id,
    ipAddress: getClientIp(c),
    userAgent: c.req.header('user-agent') ?? null,
  });

  return c.json(
    {
      success: true as const,
      data: {
        token: session.token,
        tokenType: 'Bearer',
        expiresAt: session.expiresAt,
        ...profile,
      },
    },
    201,
  );
});

authRoutes.post('/login', validate('json', loginSchema), async (c) => {
  const body = c.req.valid('json');
  const user = await getUserByEmail(body.email);

  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    await recordAuthEvent({ userId: user?.id ?? null, email: body.email, event: 'login_failed', c });
    throw ApiError.unauthorized('Email or password is incorrect');
  }

  if (user.status !== 'active') {
    await recordAuthEvent({ userId: user.id, email: user.email, event: 'login_failed', c });
    throw ApiError.forbidden('User account is not active');
  }

  const session = await createSession(user.id, c);
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

  const authUser = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    status: user.status,
  };
  const profile = await getProfile(authUser);

  await recordAuthEvent({ userId: user.id, email: user.email, event: 'login_success', c });

  return c.json({
    success: true as const,
    data: {
      token: session.token,
      tokenType: 'Bearer',
      expiresAt: session.expiresAt,
      ...profile,
    },
  });
});

authRoutes.post('/logout', requireAuth, async (c) => {
  const sessionId = c.get('sessionId');
  const user = c.get('user');
  await revokeSession(sessionId);
  await recordAuthEvent({ userId: user.id, email: user.email, event: 'logout', c });
  return ok(c, { message: 'Logged out' });
});

authRoutes.get('/me', requireAuth, async (c) => {
  const profile = await getProfile(c.get('user'));
  return ok(c, profile);
});

authRoutes.patch('/me', requireAuth, validate('json', updateProfileSchema), async (c) => {
  const body = c.req.valid('json');
  const user = c.get('user');

  if (body.phone) {
    const phoneOwner = await db.query.users.findFirst({
      columns: { id: true },
      where: and(eq(users.phone, body.phone), isNull(users.deletedAt)),
    });
    if (phoneOwner && phoneOwner.id !== user.id) {
      throw ApiError.conflict('Phone number is already registered');
    }
  }

  const [updated] = await db
    .update(users)
    .set({
      ...(body.fullName !== undefined ? { fullName: body.fullName } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl } : {}),
    })
    .where(eq(users.id, user.id))
    .returning({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      phone: users.phone,
      avatarUrl: users.avatarUrl,
      status: users.status,
    });

  return ok(c, updated);
});

authRoutes.post(
  '/change-password',
  requireAuth,
  validate('json', changePasswordSchema),
  async (c) => {
    const { currentPassword, newPassword } = c.req.valid('json');
    const authUser = c.get('user');
    const user = await db.query.users.findFirst({ where: eq(users.id, authUser.id) });
    if (!user) throw ApiError.notFound('User not found');

    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw ApiError.badRequest('Current password is incorrect');
    }
    if (currentPassword === newPassword) {
      throw ApiError.badRequest('New password must be different from current password');
    }

    const passwordHash = await hashPassword(newPassword);
    await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));
    await revokeAllUserSessions(user.id, c.get('sessionId'));
    await recordAuthEvent({ userId: user.id, email: user.email, event: 'session_revoked', c });
    await writeAuditLog({
      actorUserId: user.id,
      action: 'auth.change_password',
      entityType: 'user',
      entityId: user.id,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    });

    return ok(c, { message: 'Password updated. Other sessions have been revoked.' });
  },
);

authRoutes.get('/permissions', requireAuth, async (c) => {
  const permissions = await getPermissionsForUser(c.get('user').id);
  return ok(c, permissions);
});
