import { eq, sql } from 'drizzle-orm';
import { client, db } from './index';
import {
  merchantCategories,
  organizationTypes,
  permissions as permissionsTable,
  rolePermissions,
  roles,
  salesChannels,
  userRoles,
  users,
} from './schema';
import { hashPassword } from '../lib/crypto';

interface PermissionSeed {
  code: string;
  name: string;
  module: string;
}

const PERMISSIONS: PermissionSeed[] = [
  { code: '*', name: 'All permissions', module: 'system' },
  { code: 'user:read', name: 'View users', module: 'identity' },
  { code: 'user:write', name: 'Manage users', module: 'identity' },
  { code: 'role:manage', name: 'Manage roles & permissions', module: 'identity' },
  { code: 'organization:read', name: 'View organizations', module: 'organization' },
  { code: 'organization:write', name: 'Manage organizations', module: 'organization' },
  {
    code: 'organization:member:manage',
    name: 'Manage organization members',
    module: 'organization',
  },
  { code: 'market:read', name: 'View markets', module: 'market' },
  { code: 'market:write', name: 'Manage markets, zones, blocks, units', module: 'market' },
  { code: 'occupancy:manage', name: 'Manage unit occupancy', module: 'market' },
  { code: 'merchant:read', name: 'View merchants', module: 'merchant' },
  { code: 'merchant:write', name: 'Manage merchants & stores', module: 'merchant' },
  { code: 'merchant:verify', name: 'Verify merchants', module: 'merchant' },
  { code: 'store:read', name: 'View stores', module: 'merchant' },
  { code: 'store:write', name: 'Manage stores', module: 'merchant' },
  { code: 'catalog:read', name: 'View products & catalog', module: 'catalog' },
  { code: 'catalog:write', name: 'Manage own merchant products & catalogs', module: 'catalog' },
  { code: 'catalog:manage', name: 'Manage global categories, brands, units, attributes', module: 'catalog' },
  { code: 'commerce:read', name: 'View storefronts, carts, and checkout', module: 'commerce' },
  { code: 'commerce:write', name: 'Manage own storefronts, carts, and checkout', module: 'commerce' },
  { code: 'commerce:manage', name: 'Manage sales channels and commerce settings', module: 'commerce' },
  { code: 'audit:read', name: 'View audit logs', module: 'governance' },
];

const MEMBER_PERMISSIONS = [
  'market:read',
  'merchant:read',
  'merchant:write',
  'store:read',
  'store:write',
  'catalog:read',
  'catalog:write',
  'commerce:read',
  'commerce:write',
  'organization:read',
  'organization:write',
  'organization:member:manage',
];

const ROLE_SEEDS: Array<{ code: string; name: string; description: string; permissions: string[] }> = [
  {
    code: 'platform_admin',
    name: 'Platform Administrator',
    description: 'Akses penuh ke seluruh platform',
    permissions: ['*'],
  },
  {
    code: 'market_admin',
    name: 'Market Administrator',
    description: 'Mengelola pasar, okupansi, dan verifikasi pedagang',
    permissions: [
      'market:read',
      'market:write',
      'occupancy:manage',
      'merchant:read',
      'merchant:verify',
      'store:read',
      'catalog:read',
      'catalog:manage',
      'commerce:read',
      'commerce:manage',
      'organization:read',
      'audit:read',
    ],
  },
  {
    code: 'member',
    name: 'Member',
    description: 'Pengguna terdaftar; dapat membuat organisasi dan merchant',
    permissions: MEMBER_PERMISSIONS,
  },
];

const ORG_TYPES = [
  { code: 'market_operator', name: 'Market Operator', description: 'Pengelola pasar' },
  { code: 'merchant', name: 'Merchant', description: 'Pelaku usaha / pedagang' },
  { code: 'cooperative', name: 'Cooperative', description: 'Koperasi / paguyuban' },
  { code: 'government', name: 'Government', description: 'Instansi pemerintah' },
  { code: 'service_provider', name: 'Service Provider', description: 'Penyedia jasa pendukung' },
];

const MERCHANT_CATEGORIES = [
  { code: 'food_beverage', name: 'Makanan & Minuman' },
  { code: 'fashion', name: 'Fashion & Pakaian' },
  { code: 'electronics', name: 'Elektronik' },
  { code: 'grocery', name: 'Sembako & Kelontong' },
  { code: 'services', name: 'Jasa' },
  { code: 'handicraft', name: 'Kerajinan' },
  { code: 'health_beauty', name: 'Kesehatan & Kecantikan' },
  { code: 'other', name: 'Lainnya' },
];

const SALES_CHANNELS = [
  {
    code: 'web',
    name: 'Website Marketara',
    type: 'web' as const,
    description: 'Storefront publik yang disajikan langsung oleh Marketara',
    sortOrder: 0,
  },
  {
    code: 'marketplace',
    name: 'Marketplace',
    type: 'marketplace' as const,
    description: 'Kanal marketplace eksternal',
    sortOrder: 10,
  },
  {
    code: 'social',
    name: 'Social Commerce',
    type: 'social' as const,
    description: 'Kanal sosial media dan chat commerce',
    sortOrder: 20,
  },
  {
    code: 'pos',
    name: 'Point of Sale',
    type: 'pos' as const,
    description: 'Kanal penjualan offline/POS',
    sortOrder: 30,
  },
];

async function main() {
  console.log('Seeding reference data...');

  await db
    .insert(organizationTypes)
    .values(ORG_TYPES)
    .onConflictDoNothing({ target: organizationTypes.code });

  await db
    .insert(merchantCategories)
    .values(MERCHANT_CATEGORIES)
    .onConflictDoNothing({ target: merchantCategories.code });

  await db
    .insert(salesChannels)
    .values(SALES_CHANNELS)
    .onConflictDoUpdate({
      target: salesChannels.code,
      set: {
        name: sql`excluded.name`,
        type: sql`excluded.type`,
        description: sql`excluded.description`,
        sortOrder: sql`excluded.sort_order`,
      },
    });

  await db
    .insert(permissionsTable)
    .values(PERMISSIONS)
    .onConflictDoNothing({ target: permissionsTable.code });

  const permissionRows = await db.select().from(permissionsTable);
  const permissionIdByCode = new Map(permissionRows.map((row) => [row.code, row.id]));

  for (const seed of ROLE_SEEDS) {
    const [role] = await db
      .insert(roles)
      .values({
        code: seed.code,
        name: seed.name,
        description: seed.description,
        isSystem: true,
      })
      .onConflictDoUpdate({
        target: roles.code,
        set: { name: seed.name, description: seed.description, isSystem: true },
      })
      .returning();
    if (!role) continue;

    for (const code of seed.permissions) {
      const permissionId = permissionIdByCode.get(code);
      if (!permissionId) {
        console.warn(`Permission not found: ${code}`);
        continue;
      }
      await db
        .insert(rolePermissions)
        .values({ roleId: role.id, permissionId })
        .onConflictDoNothing();
    }
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const adminName = process.env.SEED_ADMIN_NAME ?? 'Platform Admin';
    let admin = await db.query.users.findFirst({ where: eq(users.email, adminEmail) });

    if (!admin) {
      const [created] = await db
        .insert(users)
        .values({
          email: adminEmail,
          fullName: adminName,
          passwordHash: await hashPassword(adminPassword),
          status: 'active',
        })
        .returning();
      admin = created;
      console.log(`Seed admin created: ${adminEmail}`);
    } else {
      console.log(`Seed admin already exists: ${adminEmail}`);
    }

    if (admin) {
      const adminRole = await db.query.roles.findFirst({
        where: eq(roles.code, 'platform_admin'),
        columns: { id: true },
      });
      if (adminRole) {
        await db
          .insert(userRoles)
          .values({ userId: admin.id, roleId: adminRole.id })
          .onConflictDoNothing();
      }
    }
  } else {
    console.log('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set, skipping admin creation.');
  }

  console.log('Seed completed.');
}

try {
  await main();
} finally {
  await client.end();
}
