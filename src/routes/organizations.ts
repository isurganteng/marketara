import { and, count, eq, ilike, isNull, ne } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db';
import {
  organizationBranches,
  organizationMembers,
  organizationTypes,
  organizations,
  users,
} from '../db/schema';
import { writeAuditLog } from '../lib/audit';
import { assertOrganizationAccess, isPlatformAdmin } from '../lib/access';
import { ApiError } from '../lib/errors';
import { getPagination, ok, paginated, paginationMeta } from '../lib/http';
import type { AppEnv } from '../lib/app-env';
import { uniqueSlug } from '../lib/slug';
import { validate } from '../lib/validator';
import { requireAuth } from '../middleware/auth';
import { getClientIp } from '../services/auth';

const orgRoleSchema = z.enum(['owner', 'admin', 'staff', 'member']);

const createOrgSchema = z.object({
  name: z.string().trim().min(2).max(255),
  typeCode: z.string().trim().max(64).optional(),
  legalName: z.string().trim().max(255).optional(),
  registrationNumber: z.string().trim().max(64).optional(),
  taxNumber: z.string().trim().max(64).optional(),
  description: z.string().trim().max(5000).optional(),
  logoUrl: z.string().url().max(2048).optional(),
  email: z.string().trim().toLowerCase().max(255).email().optional(),
  phone: z.string().trim().max(32).optional(),
  parentId: z.uuid().optional(),
});

const updateOrgSchema = createOrgSchema
  .omit({ parentId: true })
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Minimal satu field harus diisi',
  });

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
});

const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().max(255).email(),
  role: orgRoleSchema.default('member'),
});

const updateMemberSchema = z
  .object({
    role: orgRoleSchema.optional(),
    status: z.enum(['active', 'invited', 'suspended', 'left']).optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Minimal satu field harus diisi',
  });

const branchSchema = z.object({
  name: z.string().trim().min(2).max(255),
  address: z.string().trim().max(2000).optional(),
  city: z.string().trim().max(128).optional(),
  province: z.string().trim().max(128).optional(),
  postalCode: z.string().trim().max(16).optional(),
  phone: z.string().trim().max(32).optional(),
  isMain: z.boolean().optional(),
});

const updateBranchSchema = branchSchema
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Minimal satu field harus diisi',
  });

async function resolveOrganizationTypeId(typeCode?: string) {
  if (!typeCode) return null;
  const type = await db.query.organizationTypes.findFirst({
    where: eq(organizationTypes.code, typeCode),
    columns: { id: true },
  });
  if (!type) throw ApiError.badRequest(`Unknown organization type: ${typeCode}`);
  return type.id;
}

async function countActiveOwners(organizationId: string, excludeMemberId?: string) {
  const conditions = [
    eq(organizationMembers.organizationId, organizationId),
    eq(organizationMembers.role, 'owner'),
    eq(organizationMembers.status, 'active'),
  ];
  if (excludeMemberId) conditions.push(ne(organizationMembers.id, excludeMemberId));

  const [row] = await db
    .select({ value: count() })
    .from(organizationMembers)
    .where(and(...conditions));
  return Number(row?.value ?? 0);
}

export const organizationRoutes = new Hono<AppEnv>();

organizationRoutes.use('*', requireAuth);

organizationRoutes.get('/', validate('query', listQuerySchema), async (c) => {
  const query = c.req.valid('query');
  const pagination = getPagination(query);
  const user = c.get('user');

  const conditions = [
    eq(organizationMembers.userId, user.id),
    eq(organizationMembers.status, 'active'),
    isNull(organizations.deletedAt),
  ];
  if (query.search) conditions.push(ilike(organizations.name, `%${query.search}%`));

  const where = and(...conditions);

  const [rows, [{ value } = { value: 0 }]] = await Promise.all([
    db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        legalName: organizations.legalName,
        status: organizations.status,
        role: organizationMembers.role,
        createdAt: organizations.createdAt,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
      .where(where)
      .orderBy(organizations.name)
      .limit(pagination.limit)
      .offset(pagination.offset),
    db
      .select({ value: count() })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
      .where(where),
  ]);

  return paginated(c, rows, Number(value), pagination);
});

organizationRoutes.post('/', validate('json', createOrgSchema), async (c) => {
  const body = c.req.valid('json');
  const user = c.get('user');

  if (body.parentId) {
    await assertOrganizationAccess(body.parentId, user, c.get('permissions'));
  }

  const typeId = await resolveOrganizationTypeId(body.typeCode);
  const slug = uniqueSlug(body.name);

  const result = await db.transaction(async (tx) => {
    const [org] = await tx
      .insert(organizations)
      .values({
        name: body.name,
        slug,
        typeId,
        legalName: body.legalName ?? null,
        registrationNumber: body.registrationNumber ?? null,
        taxNumber: body.taxNumber ?? null,
        description: body.description ?? null,
        logoUrl: body.logoUrl ?? null,
        email: body.email ?? null,
        phone: body.phone ?? null,
        parentId: body.parentId ?? null,
        createdBy: user.id,
      })
      .returning();

    if (!org) throw ApiError.internal('Failed to create organization');

    const [membership] = await tx
      .insert(organizationMembers)
      .values({
        organizationId: org.id,
        userId: user.id,
        role: 'owner',
        status: 'active',
      })
      .returning();

    return { org, membership };
  });

  await writeAuditLog({
    actorUserId: user.id,
    action: 'organization.create',
    entityType: 'organization',
    entityId: result.org.id,
    newValues: { name: result.org.name, slug: result.org.slug },
    ipAddress: getClientIp(c),
    userAgent: c.req.header('user-agent') ?? null,
  });

  return c.json(
    {
      success: true as const,
      data: { ...result.org, role: result.membership?.role ?? 'owner' },
    },
    201,
  );
});

organizationRoutes.get('/:id', async (c) => {
  const { org } = await assertOrganizationAccess(
    c.req.param('id'),
    c.get('user'),
    c.get('permissions'),
  );

  const members = await db
    .select({ value: count() })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, org.id),
        eq(organizationMembers.status, 'active'),
      ),
    );

  return ok(c, { ...org, memberCount: Number(members[0]?.value ?? 0) });
});

organizationRoutes.patch('/:id', validate('json', updateOrgSchema), async (c) => {
  const { org } = await assertOrganizationAccess(
    c.req.param('id'),
    c.get('user'),
    c.get('permissions'),
    { manage: true },
  );
  const body = c.req.valid('json');
  const typeId =
    body.typeCode !== undefined ? await resolveOrganizationTypeId(body.typeCode) : undefined;

  const [updated] = await db
    .update(organizations)
    .set({
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.legalName !== undefined ? { legalName: body.legalName } : {}),
      ...(body.registrationNumber !== undefined
        ? { registrationNumber: body.registrationNumber }
        : {}),
      ...(body.taxNumber !== undefined ? { taxNumber: body.taxNumber } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl } : {}),
      ...(body.email !== undefined ? { email: body.email } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(typeId !== undefined ? { typeId } : {}),
    })
    .where(eq(organizations.id, org.id))
    .returning();

  await writeAuditLog({
    actorUserId: c.get('user').id,
    action: 'organization.update',
    entityType: 'organization',
    entityId: org.id,
    oldValues: { name: org.name },
    newValues: body as Record<string, unknown>,
    ipAddress: getClientIp(c),
    userAgent: c.req.header('user-agent') ?? null,
  });

  return ok(c, updated);
});

organizationRoutes.get('/:id/members', validate('query', listQuerySchema), async (c) => {
  const { org } = await assertOrganizationAccess(
    c.req.param('id'),
    c.get('user'),
    c.get('permissions'),
  );
  const pagination = getPagination(c.req.valid('query'));

  const where = and(
    eq(organizationMembers.organizationId, org.id),
    ne(organizationMembers.status, 'left'),
  );

  const [rows, [{ value } = { value: 0 }]] = await Promise.all([
    db
      .select({
        id: organizationMembers.id,
        userId: users.id,
        fullName: users.fullName,
        email: users.email,
        role: organizationMembers.role,
        status: organizationMembers.status,
        joinedAt: organizationMembers.joinedAt,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(users.id, organizationMembers.userId))
      .where(where)
      .orderBy(users.fullName)
      .limit(pagination.limit)
      .offset(pagination.offset),
    db.select({ value: count() }).from(organizationMembers).where(where),
  ]);

  return paginated(c, rows, Number(value), pagination);
});

organizationRoutes.post('/:id/members', validate('json', addMemberSchema), async (c) => {
  const { org, membership } = await assertOrganizationAccess(
    c.req.param('id'),
    c.get('user'),
    c.get('permissions'),
    { manage: true },
  );
  const body = c.req.valid('json');

  if (body.role === 'owner' && membership?.role !== 'owner' && !isPlatformAdmin(c.get('permissions'))) {
    throw ApiError.forbidden('Only an organization owner can assign the owner role');
  }

  const targetUser = await db.query.users.findFirst({
    columns: { id: true, fullName: true, email: true },
    where: and(eq(users.email, body.email), isNull(users.deletedAt)),
  });
  if (!targetUser) throw ApiError.notFound('User with that email was not found');

  const [member] = await db
    .insert(organizationMembers)
    .values({
      organizationId: org.id,
      userId: targetUser.id,
      role: body.role,
      status: 'active',
      invitedBy: c.get('user').id,
    })
    .onConflictDoUpdate({
      target: [organizationMembers.organizationId, organizationMembers.userId],
      set: { role: body.role, status: 'active', updatedAt: new Date() },
    })
    .returning();

  await writeAuditLog({
    actorUserId: c.get('user').id,
    action: 'organization.member.add',
    entityType: 'organization_member',
    entityId: member?.id,
    newValues: { organizationId: org.id, userId: targetUser.id, role: body.role },
    ipAddress: getClientIp(c),
    userAgent: c.req.header('user-agent') ?? null,
  });

  return c.json(
    {
      success: true as const,
      data: { ...member, user: targetUser },
    },
    201,
  );
});

organizationRoutes.patch(
  '/:id/members/:memberId',
  validate('json', updateMemberSchema),
  async (c) => {
    const { org } = await assertOrganizationAccess(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
      { manage: true },
    );
    const memberId = c.req.param('memberId');
    const body = c.req.valid('json');

    const member = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.id, memberId),
        eq(organizationMembers.organizationId, org.id),
      ),
    });
    if (!member) throw ApiError.notFound('Member not found');

    const willLoseOwner =
      member.role === 'owner' &&
      member.status === 'active' &&
      ((body.role !== undefined && body.role !== 'owner') ||
        (body.status !== undefined && body.status !== 'active'));

    if (willLoseOwner && (await countActiveOwners(org.id, member.id)) === 0) {
      throw ApiError.badRequest('Organization must have at least one active owner');
    }

    if (body.role === 'owner' && member.role !== 'owner' && !isPlatformAdmin(c.get('permissions'))) {
      throw ApiError.forbidden('Only an organization owner can assign the owner role');
    }

    const [updated] = await db
      .update(organizationMembers)
      .set({
        ...(body.role !== undefined ? { role: body.role } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
      })
      .where(eq(organizationMembers.id, member.id))
      .returning();

    return ok(c, updated);
  },
);

organizationRoutes.delete('/:id/members/:memberId', async (c) => {
  const { org } = await assertOrganizationAccess(
    c.req.param('id'),
    c.get('user'),
    c.get('permissions'),
    { manage: true },
  );
  const memberId = c.req.param('memberId');

  const member = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.id, memberId),
      eq(organizationMembers.organizationId, org.id),
    ),
  });
  if (!member) throw ApiError.notFound('Member not found');

  if (
    member.role === 'owner' &&
    member.status === 'active' &&
    (await countActiveOwners(org.id, member.id)) === 0
  ) {
    throw ApiError.badRequest('Organization must have at least one active owner');
  }

  await db
    .update(organizationMembers)
    .set({ status: 'left' })
    .where(eq(organizationMembers.id, member.id));

  await writeAuditLog({
    actorUserId: c.get('user').id,
    action: 'organization.member.remove',
    entityType: 'organization_member',
    entityId: member.id,
    oldValues: { role: member.role, status: member.status },
    ipAddress: getClientIp(c),
    userAgent: c.req.header('user-agent') ?? null,
  });

  return ok(c, { message: 'Member removed' });
});

organizationRoutes.get('/:id/branches', async (c) => {
  const { org } = await assertOrganizationAccess(
    c.req.param('id'),
    c.get('user'),
    c.get('permissions'),
  );
  const rows = await db
    .select()
    .from(organizationBranches)
    .where(eq(organizationBranches.organizationId, org.id))
    .orderBy(organizationBranches.name);
  return ok(c, rows);
});

organizationRoutes.post('/:id/branches', validate('json', branchSchema), async (c) => {
  const { org } = await assertOrganizationAccess(
    c.req.param('id'),
    c.get('user'),
    c.get('permissions'),
    { manage: true },
  );
  const body = c.req.valid('json');

  if (body.isMain) {
    await db
      .update(organizationBranches)
      .set({ isMain: false })
      .where(eq(organizationBranches.organizationId, org.id));
  }

  const [branch] = await db
    .insert(organizationBranches)
    .values({
      organizationId: org.id,
      name: body.name,
      address: body.address ?? null,
      city: body.city ?? null,
      province: body.province ?? null,
      postalCode: body.postalCode ?? null,
      phone: body.phone ?? null,
      isMain: body.isMain ?? false,
    })
    .returning();

  return c.json({ success: true as const, data: branch }, 201);
});

organizationRoutes.patch(
  '/:id/branches/:branchId',
  validate('json', updateBranchSchema),
  async (c) => {
    const { org } = await assertOrganizationAccess(
      c.req.param('id'),
      c.get('user'),
      c.get('permissions'),
      { manage: true },
    );
    const branchId = c.req.param('branchId');
    const body = c.req.valid('json');

    if (body.isMain) {
      await db
        .update(organizationBranches)
        .set({ isMain: false })
        .where(
          and(
            eq(organizationBranches.organizationId, org.id),
            ne(organizationBranches.id, branchId),
          ),
        );
    }

    const [updated] = await db
      .update(organizationBranches)
      .set(body)
      .where(
        and(
          eq(organizationBranches.id, branchId),
          eq(organizationBranches.organizationId, org.id),
        ),
      )
      .returning();

    if (!updated) throw ApiError.notFound('Branch not found');
    return ok(c, updated);
  },
);

organizationRoutes.delete('/:id/branches/:branchId', async (c) => {
  const { org } = await assertOrganizationAccess(
    c.req.param('id'),
    c.get('user'),
    c.get('permissions'),
    { manage: true },
  );
  const [deleted] = await db
    .delete(organizationBranches)
    .where(
      and(
        eq(organizationBranches.id, c.req.param('branchId')),
        eq(organizationBranches.organizationId, org.id),
      ),
    )
    .returning({ id: organizationBranches.id });

  if (!deleted) throw ApiError.notFound('Branch not found');
  return ok(c, { message: 'Branch deleted' });
});
