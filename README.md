# Marketara — Digital Market Ecosystem API

Core backend untuk **Digital Market Ecosystem Platform** berdasarkan dokumen
`Digital_Market_Ecosystem_Master_Module_Reference_v1.1.docx`.

Fokus tahap ini adalah fondasi database dan API (Bagian 17 dokumen):

1. **SYS-01** Identity & Access Management
2. **SYS-02** Organization & Membership Management
3. **MKT-01** Market & Physical Asset Management
4. **MKT-02** Vendor & Merchant Management (+ Store)
5. **MKT-03** Product & Catalog Management
6. **MKT-04** Marketplace & Omnichannel Commerce
7. **MKT-05** Order & Transaction Management

Stack: **Bun + Hono + Drizzle ORM + PostgreSQL + Zod**.

---

## 1. Menjalankan Project

### Prasyarat

- Bun `>= 1.1` (project ini diuji dengan Bun 1.4)
- PostgreSQL `>= 14` — **tidak wajib install** jika memakai opsi embedded
  (`bun run db:local`)
- Docker (opsional, untuk menjalankan PostgreSQL lokal)

### Langkah

```bash
cd E:\app\marketara
cp .env.example .env          # Windows: Copy-Item .env.example .env
bun install
```

Pilih salah satu cara menjalankan PostgreSQL:

#### Opsi A — PostgreSQL embedded (tanpa install, paling cepat)

Cocok untuk development di mesin ini. PostgreSQL 18 dijalankan otomatis dan
datanya disimpan di `.local/pgdata`.

```bash
# Terminal 1 — biarkan tetap berjalan
bun run db:local

# Terminal 2
bun run db:setup
bun run dev
```

Hentikan database dengan `Ctrl+C` di Terminal 1. Untuk reset data lokal,
hentikan dulu lalu hapus folder `.local/pgdata`.

#### Opsi B — PostgreSQL via Docker

```bash
docker compose up -d
bun run db:setup
bun run dev
```

#### Opsi C — PostgreSQL yang sudah terpasang

Sesuaikan `DATABASE_URL` di `.env`, lalu:

```bash
bun run db:setup
bun run dev
```

> Opsi embedded hanya untuk development. Untuk production gunakan PostgreSQL
> server biasa (Docker/VPS/cloud) dan password yang kuat.
>
> Jika `db:migrate` gagal dengan pesan koneksi, pastikan PostgreSQL aktif dan
> `DATABASE_URL` di `.env` sudah benar.

API berjalan di `http://localhost:3000`.

Cek kesehatan:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/health/ready
```

### Web UI

Buka **`http://localhost:3000/login`** di browser untuk masuk ke Admin Console.
Login memakai akun admin hasil seed:

- Email: `admin@marketara.local`
- Password: `Admin12345!`

Setelah masuk, dashboard tersedia di **`http://localhost:3000/admin`** dan
menampilkan ringkasan pasar, pedagang, produk, audit log, verifikasi pedagang,
serta form tambah pasar. Menu **Commerce** menampilkan storefront, status
publikasi, detail produk storefront, dan pengelolaan kanal penjualan. Menu
**Pesanan** menampilkan order, status, pembatalan, retur, dan ledger transaksi
penjualan. UI disajikan langsung oleh Bun/Hono tanpa build step tambahan.

Katalog marketplace publik MKT-04 tersedia lewat API:

```text
http://localhost:3000/api/v1/commerce/marketplace/storefronts
```

Hanya storefront berstatus `published` milik merchant `verified` yang tampil.

### Script

| Script | Fungsi |
| --- | --- |
| `bun run dev` | Jalankan API dengan watch mode |
| `bun run start` | Jalankan API production |
| `bun run typecheck` | TypeScript type check |
| `bun run db:local` | PostgreSQL embedded untuk development |
| `bun run db:generate` | Generate migration dari perubahan schema |
| `bun run db:migrate` | Jalankan migration |
| `bun run db:setup` | Migration + seed |
| `bun run db:seed` | Seed role, permission, kategori, admin |
| `bun run db:studio` | Drizzle Studio |

### Environment

| Variable | Default | Keterangan |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development` / `production` |
| `PORT` | `3000` | Port API |
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/marketara` | Koneksi PostgreSQL |
| `SESSION_TTL_DAYS` | `7` | Masa aktif sesi |
| `CORS_ORIGIN` | `*` | Origin dipisah koma |
| `DB_LOG` | `false` | `true` untuk log query SQL |
| `SEED_ADMIN_EMAIL` | `admin@marketara.local` | Email admin hasil seed |
| `SEED_ADMIN_PASSWORD` | `Admin12345!` | **Ganti setelah login pertama** |
| `SEED_ADMIN_NAME` | `Platform Admin` | Nama admin |

---

## 2. Struktur Project

```text
src/
  app.ts                    # Rakit Hono app, CORS, error handling
  index.ts                  # Bun.serve + graceful shutdown
  config.ts                 # Environment config
  db/
    index.ts                # Drizzle client (postgres-js)
    schema/core.ts          # 24 tabel: identity, org, market, merchant
    schema/catalog.ts       # 12 tabel: kategori, produk, varian, SKU, katalog
    schema/commerce.ts      # 17 tabel: kanal, storefront, cart, checkout, order, retur
    migrate.ts              # Migration runner
    seed.ts                 # Seed role/permission/reference
  lib/
    access.ts               # Authorization & data scoping
    audit.ts                # Audit log helper
    crypto.ts               # Argon2id password + session token
    errors.ts               # ApiError & error envelope
    http.ts                 # Response, pagination
    slug.ts                 # Slug/code generator
    validator.ts            # zValidator dengan format error konsisten
  middleware/
    auth.ts                 # Bearer session + RBAC
    error.ts                # Global error handler
    logger.ts               # Request logger
  routes/
    auth.ts                 # Register, login, me, logout, change password
    organizations.ts        # Organization, member, branch
    markets.ts              # Market, zone, block, unit, occupancy, facility
    merchants.ts            # Merchant, profile, documents, members, stores
    catalog/                # Product & catalog (MKT-03)
      index.ts              # Mount sub-route + requireAuth
      reference.ts          # Kategori, brand, satuan, atribut
      products.ts           # Produk, varian, SKU, gambar, atribut
      collections.ts        # Katalog merchant & item katalog
    commerce/               # Marketplace, cart, checkout, order (MKT-04/MKT-05)
      index.ts              # Mount route privat + auth
      public.ts             # Storefront & katalog publik tanpa login
      channels.ts           # Master sales channel
      storefronts.ts        # Storefront, produk storefront, channel listing
      carts.ts              # Alamat, cart, checkout session
      orders.ts             # Konversi checkout, order, catatan, transaksi
      returns.ts            # Pengajuan retur dan status retur
      shared.ts             # Helper harga, gambar, numeric
    reference.ts            # Master reference data
    audit.ts                # Audit log viewer
  services/auth.ts          # Session & profile service
public/
  login.html                # Halaman login Admin Console
  admin/index.html          # Shell dashboard admin
  assets/                   # CSS, JS, favicon UI (tanpa build step)
drizzle/                    # SQL migration hasil drizzle-kit
docs/core-database.md       # Detail desain database core
docs/catalog-database.md    # Detail desain database catalog
docs/commerce-database.md   # Detail desain database commerce (MKT-04)
docs/order-database.md      # Detail desain database order & transaksi (MKT-05)
```

---

## 3. Konvensi API

Base URL: `/api/v1`

- Autentikasi: `Authorization: Bearer <token>`
- Semua endpoint selain register/login memerlukan token.
- Password di-hash dengan **Argon2id** (`Bun.password`).
- Token sesi disimpan sebagai **SHA-256 hash**, bukan plaintext.
- Response sukses:

```json
{ "success": true, "data": { } }
```

- Response list:

```json
{
  "success": true,
  "data": [],
  "meta": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 }
}
```

- Response error:

```json
{
  "success": false,
  "error": { "code": "FORBIDDEN", "message": "..." }
}
```

- Query list: `page`, `limit`, `search` (dan filter spesifik endpoint).
- Soft delete dipakai pada `users`, `organizations`, `markets`, `merchants`,
  `stores`, `storefronts`, dan `customer_addresses`.

---

## 4. Endpoint Utama

### Auth — `/api/v1/auth`

| Method | Path | Keterangan |
| --- | --- | --- |
| POST | `/register` | Daftar user + langsung login |
| POST | `/login` | Login email/password |
| POST | `/logout` | Revoke sesi aktif |
| GET | `/me` | Profil, permission, organisasi user |
| PATCH | `/me` | Update nama/telepon/avatar |
| POST | `/change-password` | Ganti password, revoke sesi lain |
| GET | `/permissions` | Daftar permission user |

### Organization — `/api/v1/organizations`

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/` | Organisasi tempat user menjadi anggota |
| POST | `/` | Buat organisasi (creator = owner) |
| GET | `/:id` | Detail organisasi |
| PATCH | `/:id` | Update (owner/admin) |
| GET | `/:id/members` | Daftar anggota |
| POST | `/:id/members` | Tambah anggota via email |
| PATCH | `/:id/members/:memberId` | Ubah role/status anggota |
| DELETE | `/:id/members/:memberId` | Keluarkan anggota |
| GET/POST | `/:id/branches` | Daftar / tambah cabang |
| PATCH/DELETE | `/:id/branches/:branchId` | Update / hapus cabang |

### Market — `/api/v1/markets`

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/` | List + filter `search`, `city`, `status` |
| POST | `/` | Buat pasar |
| GET/PATCH/DELETE | `/:marketId` | Detail / update / archive |
| GET/POST | `/:marketId/zones` | Zona |
| PATCH | `/zones/:zoneId` | Update zona |
| GET/POST | `/zones/:zoneId/blocks` | Blok |
| PATCH | `/blocks/:blockId` | Update blok |
| GET | `/:marketId/units` | List unit + filter zona/blok/status/tipe |
| POST | `/blocks/:blockId/units` | Buat unit/kios |
| GET/PATCH | `/units/:unitId` | Detail (termasuk occupancy aktif) / update |
| POST | `/units/:unitId/occupancy` | Tempatkan merchant di unit |
| PATCH | `/occupancies/:id/end` | Akhiri occupancy |
| GET | `/:marketId/occupancy-summary` | Ringkasan okupansi |
| GET/POST | `/:marketId/facilities` | Fasilitas pasar |
| PATCH/DELETE | `/facilities/:id` | Update / hapus fasilitas |

### Merchant — `/api/v1/merchants`

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/` | List merchant sesuai akses user |
| POST | `/` | Buat merchant (+ profil opsional) |
| GET | `/:merchantId` | Detail + profil + toko + dokumen + anggota |
| PATCH | `/:merchantId` | Update merchant/profil |
| POST | `/:merchantId/submit` | Ajukan verifikasi |
| POST | `/:merchantId/verify` | Verifikasi/tolak (butuh `merchant:verify`) |
| GET | `/:merchantId/status-history` | Riwayat status |
| GET/POST | `/:merchantId/documents` | Dokumen merchant |
| GET/POST | `/:merchantId/members` | Anggota merchant |
| DELETE | `/:merchantId/members/:memberId` | Keluarkan anggota |
| GET/POST | `/:merchantId/stores` | Toko/kanal merchant |
| PATCH/DELETE | `/stores/:storeId` | Update / archive toko |

### Catalog — `/api/v1/catalog`

| Method | Path | Permission | Keterangan |
| --- | --- | --- | --- |
| GET | `/categories` | `catalog:read` | List kategori + filter parent/search |
| POST | `/categories` | `catalog:manage` | Buat kategori |
| GET/PATCH/DELETE | `/categories/:id` | `catalog:read` / `catalog:manage` | Detail / update / nonaktifkan |
| GET/POST | `/brands` | `catalog:read` / `catalog:manage` | Brand |
| PATCH/DELETE | `/brands/:id` | `catalog:manage` | Update / nonaktifkan |
| GET/POST | `/units` | `catalog:read` / `catalog:manage` | Satuan (pcs, kg, box) |
| GET/POST | `/attributes` | `catalog:read` / `catalog:manage` | Atribut master |
| GET/PATCH | `/attributes/:id` | `catalog:read` / `catalog:manage` | Detail (termasuk values) / update |
| GET/POST | `/attributes/:id/values` | `catalog:read` / `catalog:manage` | Nilai atribut |
| PATCH | `/values/:valueId` | `catalog:manage` | Update nilai atribut |
| GET | `/products` | `catalog:read` | List produk sesuai akses merchant |
| POST | `/products` | `catalog:write` | Buat produk untuk merchant sendiri |
| GET/PATCH/DELETE | `/products/:id` | `catalog:read` / `catalog:write` | Detail / update / archive |
| POST | `/products/:id/variants` | `catalog:write` | Tambah varian |
| PATCH/DELETE | `/variants/:variantId` | `catalog:write` | Update / hapus varian |
| POST | `/products/:id/skus` | `catalog:write` | Tambah SKU |
| PATCH/DELETE | `/skus/:skuId` | `catalog:write` | Update / hapus SKU |
| POST | `/products/:id/images` | `catalog:write` | Tambah gambar |
| PATCH/DELETE | `/images/:imageId` | `catalog:write` | Update / hapus gambar |
| POST | `/products/:id/attributes` | `catalog:write` | Set atribut produk |
| DELETE | `/products/:id/attributes/:attributeId` | `catalog:write` | Hapus atribut produk |
| GET/POST | `/catalogs` | `catalog:read` / `catalog:write` | Katalog merchant |
| GET/PATCH/DELETE | `/catalogs/:id` | `catalog:read` / `catalog:write` | Detail / update / hapus |
| GET/POST | `/catalogs/:id/items` | `catalog:read` / `catalog:write` | Item katalog |
| PATCH/DELETE | `/catalogs/:id/items/:itemId` | `catalog:write` | Update / hapus item |

> Nilai uang (`basePrice`, `price`, `priceOverride`, `costPrice`) dikembalikan
> sebagai **string desimal** (contoh `"25000.00"`) agar tidak kehilangan
> presisi. Konversi ke number di sisi client bila diperlukan.

### Commerce — `/api/v1/commerce`

| Method | Path | Permission | Keterangan |
| --- | --- | --- | --- |
| GET/POST | `/channels` | `commerce:read` / `commerce:manage` | Kanal penjualan |
| GET/PATCH/DELETE | `/channels/:id` | `commerce:read` / `commerce:manage` | Detail / update / nonaktifkan |
| GET/POST | `/storefronts` | `commerce:read` / `commerce:write` | Storefront sesuai akses merchant |
| GET/PATCH/DELETE | `/storefronts/:id` | `commerce:read` / `commerce:write` | Detail / update / arsip |
| GET/POST | `/storefronts/:id/products` | `commerce:read` / `commerce:write` | Produk yang tampil di storefront |
| PATCH/DELETE | `/storefronts/:id/products/:itemId` | `commerce:write` | Ubah / hapus produk storefront |
| GET/POST | `/listings` | `commerce:read` / `commerce:write` | Listing kanal eksternal |
| PATCH/DELETE | `/listings/:id` | `commerce:write` | Update / akhiri listing |
| GET/DELETE | `/cart` | `commerce:read` / `commerce:write` | Lihat / kosongkan cart aktif |
| POST | `/cart/items` | `commerce:write` | Tambah item |
| PATCH/DELETE | `/cart/items/:id` | `commerce:write` | Ubah quantity / hapus item |
| GET/POST | `/addresses` | `commerce:read` / `commerce:write` | Alamat pelanggan |
| PATCH/DELETE | `/addresses/:id` | `commerce:write` | Update / hapus alamat |
| POST | `/checkout` | `commerce:write` | Buat sesi checkout dari cart |
| GET/PATCH | `/checkout/:id` | `commerce:read` / `commerce:write` | Detail / update kontak & alamat |
| POST | `/checkout/:id/cancel` | `commerce:write` | Batalkan checkout |
| POST | `/orders/from-checkout/:checkoutId` | `commerce:write` | Konversi checkout menjadi order per merchant |
| GET | `/orders` | `commerce:read` | Daftar order sesuai akses customer/merchant |
| GET | `/orders/:orderId` | `commerce:read` | Detail order, item, status, retur, transaksi |
| PATCH | `/orders/:orderId/status` | `commerce:write` | Konfirmasi/proses/selesaikan order |
| POST | `/orders/:orderId/cancel` | `commerce:write` | Batalkan order + catat alasan |
| POST | `/orders/:orderId/notes` | `commerce:write` | Tambah catatan order |
| POST | `/orders/:orderId/returns` | `commerce:write` | Ajukan retur |
| GET | `/returns` | `commerce:read` | Daftar retur sesuai akses |
| GET | `/returns/:returnId` | `commerce:read` | Detail retur + item |
| PATCH | `/returns/:returnId/status` | `commerce:write` | Setujui/tolak/terima/selesaikan retur |
| GET | `/transactions` | `commerce:read` | Ledger penjualan, pembatalan, retur |

### Marketplace publik — `/api/v1/commerce/marketplace`

Tidak memerlukan login. Hanya menampilkan storefront `published` milik merchant
`verified` dan produk `active`.

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/storefronts` | Cari storefront publik (`search`, `city`, `marketId`, dll.) |
| GET | `/storefronts/:slug` | Detail storefront |
| GET | `/storefronts/:slug/products` | Katalog produk storefront |
| GET | `/storefronts/:slug/products/:productSlug` | Detail produk + varian/SKU/gambar |
| GET | `/products` | Pencarian produk lintas storefront |

### Reference & Audit

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/api/v1/reference/organization-types` | login |
| GET | `/api/v1/reference/merchant-categories` | login |
| GET | `/api/v1/reference/roles` | `role:manage` |
| GET | `/api/v1/reference/permissions` | `role:manage` |
| GET | `/api/v1/audit-logs` | `audit:read` |

---

## 5. Role & Permission Hasil Seed

| Role | Ringkasan akses |
| --- | --- |
| `platform_admin` | Wildcard `*` (semua akses) |
| `market_admin` | Kelola pasar/okupansi, verifikasi merchant, master katalog, kanal commerce, lihat audit |
| `member` | Buat organisasi, kelola merchant/toko/produk/storefront miliknya, belanja |

Permission yang tersedia: `user:read`, `user:write`, `role:manage`,
`organization:read`, `organization:write`, `organization:member:manage`,
`market:read`, `market:write`, `occupancy:manage`, `merchant:read`,
`merchant:write`, `merchant:verify`, `store:read`, `store:write`,
`catalog:read`, `catalog:write`, `catalog:manage`, `commerce:read`,
`commerce:write`, `commerce:manage`, `audit:read`.

### Model otorisasi

1. **RBAC global** — permission diambil dari role global user.
2. **Organization membership** — `owner`/`admin` dapat mengelola organisasi.
3. **Merchant ownership** — akses merchant diberikan jika user adalah:
   owner merchant, anggota aktif organisasi pemilik merchant, atau anggota
   merchant (`owner`/`manager`/`staff`).
4. **Data scoping** — list merchant hanya menampilkan merchant yang boleh
   diakses user. Platform admin melihat semua.

---

## 6. Alur Contoh (curl)

```bash
# 1. Login admin hasil seed
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@marketara.local","password":"Admin12345!"}'

# 2. Register calon pedagang
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"toko@example.com","fullName":"Toko Contoh","password":"Rahasia123!"}'

# 3. Buat merchant (pakai token hasil register)
curl -X POST http://localhost:3000/api/v1/merchants \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"businessName":"Toko Contoh","categoryCode":"grocery"}'

# 4. Admin membuat pasar, zona, blok, unit
curl -X POST http://localhost:3000/api/v1/markets \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Pasar Contoh","city":"Bandung","status":"active"}'

# 5. Tempatkan merchant di unit
curl -X POST http://localhost:3000/api/v1/markets/units/<UNIT_ID>/occupancy \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"merchantId":"<MERCHANT_ID>","startDate":"2026-11-20"}'
```

---

## 7. Database

Satu database PostgreSQL dengan schema logis:

- `core` — identity, organization, market, merchant, store (24 tabel).
- `catalog` — kategori, brand, produk, varian, SKU, gambar, atribut, katalog
  merchant (12 tabel).
- `commerce` — sales channel, storefront, listing, alamat, cart, checkout,
  order, item, status history, catatan, pembatalan, retur, dan ledger
  transaksi (17 tabel).
- `governance` — `audit_logs` (1 tabel).

Detail tabel, relasi, enum, dan keputusan desain ada di
[`docs/core-database.md`](docs/core-database.md),
[`docs/catalog-database.md`](docs/catalog-database.md),
[`docs/commerce-database.md`](docs/commerce-database.md), dan
[`docs/order-database.md`](docs/order-database.md).

Migration SQL: `drizzle/0000_*.sql` (core), `drizzle/0001_*.sql` (catalog),
`drizzle/0002_*.sql` (commerce), dan `drizzle/0003_*.sql` (order).

---

## 8. Catatan Keamanan

- Ganti password admin seed sebelum dipakai di luar lokal.
- Set `CORS_ORIGIN` ke domain frontend saat production, jangan `*`.
- Gunakan HTTPS di production (token bearer dikirim di header).
- Session token hanya dikembalikan sekali saat login/register; server hanya
  menyimpan hash.
- Web UI menyimpan token di `localStorage` (atau `sessionStorage` bila
  "Ingat saya" tidak dicentang). Untuk production, pertimbangkan cookie
  `HttpOnly`/`Secure` dan proteksi CSRF.
- Dashboard admin hanya menerima role dengan permission `*` atau `audit:read`
  (`platform_admin` / `market_admin`). Permission tetap ditegakkan di API.
- Audit trail mencatat aksi penting (register, create/update market, merchant,
  occupancy, store, organisasi, checkout, order, pembatalan, dan retur).
- Belum termasuk: email verification, MFA, refresh token, rate limiting.
  Semua ini masuk roadmap SYS-01/SYS-06.

---

## 9. Roadmap Modul Berikutnya

**MKT-04 Marketplace & Omnichannel Commerce** dan **MKT-05 Order &
Transaction Management** sudah diimplementasikan. MKT-04 mencakup storefront,
katalog publik, cart, checkout, dan channel listing. MKT-05 mencakup konversi
checkout menjadi order per merchant, status order, pembatalan, retur, dan
ledger transaksi penjualan. Dashboard admin memiliki menu **Commerce** dan
**Pesanan**. Urutan berikutnya:

1. **MKT-06 Payment** - payment method/provider, transaksi, refund, settlement.
2. **MKT-08 Inventory** - stok per lokasi, movement, opname, batch/expiry.
3. **SCM-01/SCM-02 Supply Chain** - supplier, PR/PO, receiving, fulfillment.
4. **MKT-12/MKT-13 Marketing & CRM** - campaign, voucher, loyalty, complaint.
5. **2MD** - business performance/profile, proposal, funding, financing.
6. **SYS-03/04/05/07/08** - integration, notification, config, AI, warehouse.

Schema PostgreSQL sudah disiapkan untuk ditambah per domain (`catalog`,
`commerce`, `payment`, `inventory`, `supply_chain`, `marketing`, `business`,
`funding`, `analytics`, `platform`, `governance`, `community`, `government`).
