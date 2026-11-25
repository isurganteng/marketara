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
8. **MKT-06** Integrated Payment Management
9. **MKT-07** POS & Offline Transaction Management
10. **MKT-08** Inventory & Warehouse Management
11. **SCM-01** Supplier & Procurement Management
12. **SCM-02** Warehouse Fulfillment Management
13. **MKT-12** Digital Marketing & Promotion Management
14. **MKT-13** Customer Relationship Management (CRM)
15. **2MD-01** Business Performance & Growth Management
16. **2MD-02** Merchant Business Profile Management
17. **2MD-03** Funding Proposal & Document Management
18. **2MD-04** Funding Marketplace Management
19. **2MD-05** Financing & Risk Management
20. **SYS-03** API Gateway & Integration Management
21. **SYS-04** Notification & Communication Management
22. **SYS-05** Configuration & Feature Management
23. **SYS-07** Artificial Intelligence Management
24. **SYS-08** Reporting & Data Warehouse Management

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
penjualan. Menu **Pembayaran** menampilkan pembayaran, refund, settlement,
rekonsiliasi, serta pengelolaan provider dan metode pembayaran. Menu **POS**
menampilkan terminal, cash register, shift kasir, transaksi toko fisik,
pembatalan transaksi, pergerakan kas, dan sinkronisasi transaksi offline. Menu
**Inventori** menampilkan gudang, lokasi, item persediaan, saldo stok,
pergerakan stok, penyesuaian, opname, serta batch dan kedaluwarsa. Menu
**Rantai Pasok** menampilkan supplier, permintaan pembelian, penawaran vendor,
purchase order, penerimaan barang, warehouse receipt, put-away, alokasi,
picking, packing, pengiriman, retur gudang, dan grup pembelian kolektif. Menu
**Bisnis** menampilkan periode kinerja, KPI, nilai KPI, target, laporan
performa, dan profil bisnis merchant. Menu **Pendanaan** menampilkan proposal,
peluang pendanaan, pengajuan, fasilitas pembiayaan, dan penilaian risiko. UI
disajikan langsung oleh Bun/Hono tanpa build step tambahan.

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
    schema/payment.ts       # 10 tabel: provider, metode, payment, refund, settlement
    schema/pos.ts           # 7 tabel: terminal, register, shift, transaksi, kas, sync
    schema/inventory.ts     # 10 tabel: gudang, lokasi, item, saldo, movement, opname, batch
    schema/marketing.ts     # 18 tabel: kampanye, promosi, kupon, pelanggan, loyalty, CRM
    schema/business.ts      # 13 tabel: profil bisnis, periode, KPI, target, laporan
    schema/funding.ts       # 25 tabel: proposal, peluang, investor, pengajuan, pembiayaan, risiko
    schema/integration.ts   # 9 tabel platform: provider, koneksi, klien API, endpoint, webhook
    schema/notification.ts  # 6 tabel platform: kanal, template, pesan, penerima, log
    schema/config.ts        # 7 tabel platform: grup, setelan, referensi, feature flag
    schema/ai.ts            # 8 tabel platform: model, sesi, pesan, request, rekomendasi, forecast
    schema/analytics.ts     # 7 tabel analytics: sumber data, ETL, data mart, laporan, snapshot
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
    payments/               # Integrated payment (MKT-06)
      index.ts              # Mount route pembayaran + auth
      providers.ts          # Provider dan metode pembayaran
      accounts.ts           # Akun pencairan merchant
      payments.ts           # Payment intent, attempt, konfirmasi, retry
      refunds.ts            # Pengajuan dan status refund
      settlements.ts        # Settlement pedagang
      reconciliations.ts    # Rekonsiliasi provider
      shared.ts             # Scoping, fee, dan detail payment
    pos/                    # POS & offline transaction (MKT-07)
      index.ts              # Mount route POS + auth
      resources.ts          # Terminal POS dan cash register
      shifts.ts             # Shift kasir, tutup shift, pergerakan kas
      transactions.ts       # Transaksi POS, void, batch sync, log sync
      shared.ts             # Scoping, saldo kas, total shift, detail
    inventory/              # Inventory & warehouse (MKT-08)
      index.ts              # Mount route inventori + auth
      resources.ts          # Gudang, lokasi, item, saldo, batch, ringkasan
      movements.ts          # Pergerakan stok dan penyesuaian
      counts.ts             # Opname stok, hitung fisik, selesai/batal
      shared.ts             # Scoping, saldo, movement, batch, detail
    supply-chain/           # Supply chain & fulfillment (SCM-01/SCM-02)
      index.ts              # Mount route rantai pasok + auth
      suppliers.ts          # Supplier dan opsi supplier
      procurement.ts        # Permintaan pembelian, item, penawaran supplier
      purchase-orders.ts    # Purchase order, approval, konversi PR/penawaran
      receiving.ts          # Penerimaan barang dan pembuatan warehouse receipt
      warehouse.ts          # Warehouse receipt, put-away, alokasi gudang
      outbound.ts           # Picking, packing, pengiriman, retur, history
      collective.ts         # Grup pembelian kolektif
      shared.ts             # Scoping, akses, stok, movement, history
    marketing/              # Digital marketing & CRM (MKT-12/MKT-13)
      index.ts              # Mount route pemasaran + CRM + auth
      campaigns.ts          # Kampanye, channel, iklan, performa
      promotions.ts         # Promosi, aturan diskon, kupon, redemption
      customers.ts          # Pelanggan, profil, grup, segmen, metrik order
      loyalty.ts            # Akun loyalty dan transaksi poin
      engagement.ts         # Interaksi pelanggan dan keluhan
      shared.ts             # Scoping, akses, numeric/date schema, getter
    business/               # Business performance & profile (2MD-01/2MD-02)
      index.ts              # Mount route bisnis + auth
      performance.ts        # Periode, KPI, nilai, target, growth, laporan
      profiles.ts           # Profil bisnis, child records, verifikasi, share
      shared.ts             # Scoping, akses, numeric/date schema, getter
    funding/                # Proposal, marketplace, pembiayaan (2MD-03/04/05)
      index.ts              # Mount route pendanaan + auth
      proposals.ts          # Proposal, versi, plan, proyeksi, dokumen, data room
      marketplace.ts        # Peluang, investor, pengajuan, match, minat, referral
      financing.ts          # Fasilitas, agreement, pencairan, angsuran, risiko
      shared.ts             # Akses funding, ownership, getter, numeric
    integrations/           # API gateway & integrasi (SYS-03)
      index.ts              # Provider, koneksi, klien, kunci, endpoint, webhook, log, mapping
    notifications/          # Notifikasi & komunikasi (SYS-04)
      index.ts              # Kanal, template, pesan, penerima, log, preferensi
    config/                 # Konfigurasi platform (SYS-05)
      index.ts              # Grup, setelan, referensi, feature flag, parameter, lokalisasi
    ai/                     # Kecerdasan artifisial (SYS-07)
      index.ts              # Model, sesi, pesan, request, rekomendasi, forecast, usage
    analytics/              # Pelaporan & data warehouse (SYS-08)
      index.ts              # Sumber data, ETL, data mart, laporan, eksekusi, snapshot
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
docs/payment-database.md    # Detail desain database pembayaran (MKT-06)
docs/pos-database.md        # Detail desain database POS (MKT-07)
docs/inventory-database.md  # Detail desain database inventori (MKT-08)
docs/supply-chain-database.md # Detail desain database rantai pasok (SCM-01/02)
docs/marketing-crm-database.md # Detail desain database pemasaran & CRM (MKT-12/13)
docs/business-funding-database.md # Detail desain database bisnis & pendanaan (2MD)
docs/platform-analytics-database.md # Detail desain database platform & analitik (SYS-03/04/05/07/08)
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

### Payment — `/api/v1/payments`

| Method | Path | Permission | Keterangan |
| --- | --- | --- | --- |
| GET/POST | `/providers` | `payment:read` / `payment:manage` | Provider / gateway pembayaran |
| PATCH | `/providers/:providerId` | `payment:manage` | Update provider |
| GET/POST | `/methods` | `payment:read` / `payment:manage` | Metode pembayaran |
| PATCH | `/methods/:methodId` | `payment:manage` | Update metode / status |
| GET | `/accounts` | `payment:read` | Akun pencairan merchant sesuai akses |
| POST | `/accounts` | `payment:write` | Tambah akun pencairan merchant |
| PATCH | `/accounts/:accountId` | `payment:write` | Update akun pencairan |
| GET | `/` | `payment:read` | Daftar pembayaran sesuai akses |
| POST | `/orders/:orderId` | `payment:write` | Buat / ulangi payment intent untuk order |
| GET | `/:paymentId` | `payment:read` | Detail payment, attempt, event, refund |
| POST | `/:paymentId/retry` | `payment:write` | Buat percobaan pembayaran baru |
| POST | `/:paymentId/confirm` | `payment:write` | Konfirmasi lunas / gagal / kedaluwarsa |
| POST | `/:paymentId/cancel` | `payment:write` | Batalkan pembayaran yang belum lunas |
| GET | `/refunds` | `payment:read` | Daftar refund sesuai akses |
| GET | `/refunds/:refundId` | `payment:read` | Detail refund |
| POST | `/:paymentId/refunds` | `payment:write` | Ajukan refund |
| PATCH | `/refunds/:refundId/status` | `payment:write` | Setujui / proses / selesaikan refund |
| GET | `/settlements` | `payment:read` | Daftar settlement sesuai akses |
| GET | `/settlements/:settlementId` | `payment:read` | Detail settlement + item |
| POST | `/settlements` | `payment:write` | Buat settlement dari pembayaran lunas |
| PATCH | `/settlements/:settlementId/status` | `payment:write` | Ajukan / proses / selesaikan / batalkan |
| GET | `/reconciliations` | `payment:manage` | Daftar rekonsiliasi provider |
| GET | `/reconciliations/:reconciliationId` | `payment:manage` | Detail rekonsiliasi |
| POST | `/reconciliations` | `payment:manage` | Jalankan rekonsiliasi provider |

> Nilai uang pembayaran (`amount`, `feeAmount`, `netAmount`, `amountPaid`,
> `amountRefunded`) juga dikembalikan sebagai string desimal. Customer hanya
> dapat melihat pembayaran miliknya dan membatalkan refund yang masih
> `requested`; pembuatan refund, settlement, provider, metode, dan rekonsiliasi
> membutuhkan akses merchant/admin yang sesuai.

### POS — `/api/v1/pos`

| Method | Path | Permission | Keterangan |
| --- | --- | --- | --- |
| GET | `/terminals` | `pos:read` | Daftar terminal POS sesuai akses |
| POST | `/terminals` | `pos:manage` | Buat terminal POS |
| PATCH | `/terminals/:terminalId` | `pos:manage` | Update terminal / status |
| GET | `/registers` | `pos:read` | Daftar cash register |
| POST | `/registers` | `pos:manage` | Buat cash register |
| PATCH | `/registers/:registerId` | `pos:manage` | Update cash register |
| GET | `/shifts` | `pos:read` | Daftar shift kasir |
| POST | `/shifts` | `pos:write` | Buka shift kasir |
| GET | `/shifts/:shiftId` | `pos:read` | Detail shift + pergerakan kas |
| POST | `/shifts/:shiftId/close` | `pos:write` | Tutup shift + rekonsiliasi kas |
| POST | `/shifts/:shiftId/cash-movements` | `pos:write` | Catat kas masuk/keluar/penyesuaian |
| GET | `/transactions` | `pos:read` | Daftar transaksi POS |
| POST | `/transactions` | `pos:write` | Buat transaksi POS langsung |
| GET | `/transactions/:transactionId` | `pos:read` | Detail transaksi + item |
| POST | `/transactions/:transactionId/void` | `pos:write` | Batalkan transaksi |
| POST | `/transactions/:transactionId/sync` | `pos:manage` | Tandai transaksi tersinkronisasi |
| POST | `/sync` | `pos:manage` | Batch upload transaksi offline |
| GET | `/sync-logs` | `pos:read` | Daftar log sinkronisasi |

> Transaksi POS terpisah dari order marketplace dan tidak mengubah stok.
> Transaksi offline bersifat idempoten berdasarkan pasangan
> `(terminalId, clientTransactionId)`. Nilai uang transaksi dan kas
> dikembalikan sebagai string desimal.

### Inventori — `/api/v1/inventory`

| Method | Path | Permission | Keterangan |
| --- | --- | --- | --- |
| GET | `/summary` | `inventory:read` | Ringkasan gudang, item, stok, low stock, batch, opname |
| GET/POST | `/warehouses` | `inventory:read` / `inventory:manage` | Daftar / buat gudang |
| GET/PATCH/DELETE | `/warehouses/:warehouseId` | `inventory:read` / `inventory:manage` | Detail / update / hapus gudang |
| GET | `/locations` | `inventory:read` | Daftar lokasi sesuai akses |
| GET/POST | `/warehouses/:warehouseId/locations` | `inventory:read` / `inventory:manage` | Daftar / buat lokasi gudang |
| PATCH/DELETE | `/locations/:locationId` | `inventory:manage` | Update / hapus lokasi |
| GET/POST | `/items` | `inventory:read` / `inventory:manage` | Daftar / daftarkan item persediaan |
| GET/PATCH/DELETE | `/items/:itemId` | `inventory:read` / `inventory:manage` | Detail / update / hapus item |
| GET | `/balances` | `inventory:read` | Saldo stok per lokasi |
| GET | `/batches` | `inventory:read` | Daftar batch + status kedaluwarsa |
| PATCH | `/batches/:batchId` | `inventory:manage` | Update status/expiry/catatan batch |
| GET/POST | `/movements` | `inventory:read` / `inventory:write` | Daftar / catat pergerakan stok |
| GET | `/movements/:movementId` | `inventory:read` | Detail movement + item |
| GET/POST | `/adjustments` | `inventory:read` / `inventory:write` | Daftar / catat penyesuaian stok |
| GET | `/adjustments/:adjustmentId` | `inventory:read` | Detail penyesuaian |
| GET/POST | `/stock-counts` | `inventory:read` / `inventory:write` | Daftar / mulai opname |
| GET | `/stock-counts/:countId` | `inventory:read` | Detail opname + item |
| PATCH | `/stock-counts/:countId/items/:itemId` | `inventory:write` | Isi hitungan fisik |
| POST | `/stock-counts/:countId/complete` | `inventory:write` | Selesaikan opname + penyesuaian |
| POST | `/stock-counts/:countId/cancel` | `inventory:write` | Batalkan opname |

> Stok disimpan per SKU dan lokasi. Pergerakan `inbound`, `outbound`,
> `transfer`, dan `return` langsung mengubah saldo; penyesuaian dan opname
> membuat movement turunan. Batch/expiry bersifat opsional per item. Nilai
> kuantitas dan uang dikembalikan sebagai string desimal.

### Rantai pasok — `/api/v1/supply-chain`

| Method | Path | Permission | Keterangan |
| --- | --- | --- | --- |
| GET/POST | `/suppliers` | `supply_chain:read` / `supply_chain:manage` | Daftar / buat supplier merchant |
| GET/PATCH/DELETE | `/suppliers/:id` | `supply_chain:read` / `supply_chain:manage` | Detail / ubah / nonaktifkan supplier |
| GET | `/supplier-options` | `supply_chain:read` | Opsi supplier aktif |
| GET/POST | `/purchase-requisitions` | `supply_chain:read` / `supply_chain:manage` | Daftar / buat permintaan pembelian |
| GET/PATCH | `/purchase-requisitions/:id` | `supply_chain:read` / `supply_chain:manage` | Detail / ubah permintaan |
| POST | `/purchase-requisitions/:id/submit` | `supply_chain:write` | Ajukan permintaan |
| POST | `/purchase-requisitions/:id/approve` | `supply_chain:manage` | Setujui permintaan |
| POST | `/purchase-requisitions/:id/reject` | `supply_chain:manage` | Tolak permintaan |
| POST | `/purchase-requisitions/:id/cancel` | `supply_chain:write` | Batalkan permintaan |
| POST | `/purchase-requisitions/:id/convert` | `supply_chain:manage` | Konversi menjadi purchase order |
| GET/POST | `/supplier-quotations` | `supply_chain:read` / `supply_chain:manage` | Daftar / buat penawaran supplier |
| GET | `/supplier-quotations/:id` | `supply_chain:read` | Detail penawaran |
| POST | `/supplier-quotations/:id/submit` | `supply_chain:write` | Ajukan penawaran |
| POST | `/supplier-quotations/:id/accept` | `supply_chain:manage` | Terima penawaran |
| POST | `/supplier-quotations/:id/reject` | `supply_chain:manage` | Tolak penawaran |
| POST | `/supplier-quotations/:id/cancel` | `supply_chain:write` | Batalkan penawaran |
| POST | `/supplier-quotations/:id/convert` | `supply_chain:manage` | Konversi penawaran menjadi PO |
| GET/POST | `/purchase-orders` | `supply_chain:read` / `supply_chain:manage` | Daftar / buat purchase order |
| GET/PATCH | `/purchase-orders/:id` | `supply_chain:read` / `supply_chain:manage` | Detail / ubah PO |
| POST | `/purchase-orders/:id/submit` | `supply_chain:write` | Ajukan PO |
| POST | `/purchase-orders/:id/approve` | `supply_chain:manage` | Setujui PO |
| POST | `/purchase-orders/:id/send` | `supply_chain:write` | Kirim PO ke supplier |
| POST | `/purchase-orders/:id/cancel` | `supply_chain:write` | Batalkan PO |
| POST | `/purchase-orders/:id/close` | `supply_chain:manage` | Tutup PO |
| GET | `/procurement-approvals` | `supply_chain:read` | Riwayat approval pengadaan |
| GET/POST | `/goods-receipts` | `supply_chain:read` / `supply_chain:manage` | Daftar / buat penerimaan barang |
| GET | `/goods-receipts/:id` | `supply_chain:read` | Detail penerimaan |
| POST | `/goods-receipts/:id/inspect` | `supply_chain:write` | Tandai inspeksi selesai |
| POST | `/goods-receipts/:id/complete` | `supply_chain:write` | Selesaikan penerimaan + stok masuk |
| POST | `/goods-receipts/:id/cancel` | `supply_chain:write` | Batalkan penerimaan |
| GET/POST | `/warehouse-receipts` | `supply_chain:read` / `supply_chain:manage` | Daftar / buat warehouse receipt |
| GET | `/warehouse-receipts/:id` | `supply_chain:read` | Detail warehouse receipt |
| POST | `/warehouse-receipts/:id/start` | `supply_chain:write` | Mulai penerimaan gudang |
| POST | `/warehouse-receipts/:id/complete` | `supply_chain:write` | Selesaikan penerimaan gudang |
| POST | `/warehouse-receipts/:id/cancel` | `supply_chain:write` | Batalkan penerimaan gudang |
| GET/POST | `/putaway-tasks` | `supply_chain:read` / `supply_chain:manage` | Daftar / buat tugas put-away |
| GET/PATCH | `/putaway-tasks/:id` | `supply_chain:read` / `supply_chain:manage` | Detail / ubah tujuan put-away |
| POST | `/putaway-tasks/:id/start` | `supply_chain:write` | Mulai put-away |
| POST | `/putaway-tasks/:id/complete` | `supply_chain:write` | Selesaikan put-away + transfer stok |
| POST | `/putaway-tasks/:id/cancel` | `supply_chain:write` | Batalkan put-away |
| GET/POST | `/warehouse-allocations` | `supply_chain:read` / `supply_chain:manage` | Daftar / buat alokasi stok |
| GET | `/warehouse-allocations/:id` | `supply_chain:read` | Detail alokasi |
| POST | `/warehouse-allocations/:id/release` | `supply_chain:write` | Lepas reservasi stok |
| POST | `/warehouse-allocations/:id/cancel` | `supply_chain:write` | Batalkan alokasi |
| GET/POST | `/picking-tasks` | `supply_chain:read` / `supply_chain:manage` | Daftar / buat picking |
| GET | `/picking-tasks/:id` | `supply_chain:read` | Detail picking |
| POST | `/picking-tasks/:id/start` | `supply_chain:write` | Mulai picking |
| POST | `/picking-tasks/:id/complete` | `supply_chain:write` | Selesaikan picking + stok keluar |
| POST | `/picking-tasks/:id/cancel` | `supply_chain:write` | Batalkan picking |
| GET/POST | `/packing-tasks` | `supply_chain:read` / `supply_chain:manage` | Daftar / buat packing |
| GET | `/packing-tasks/:id` | `supply_chain:read` | Detail packing |
| POST | `/packing-tasks/:id/start` | `supply_chain:write` | Mulai packing |
| POST | `/packing-tasks/:id/complete` | `supply_chain:write` | Selesaikan packing |
| POST | `/packing-tasks/:id/cancel` | `supply_chain:write` | Batalkan packing |
| GET/POST | `/dispatch-records` | `supply_chain:read` / `supply_chain:manage` | Daftar / buat pengiriman |
| GET | `/dispatch-records/:id` | `supply_chain:read` | Detail pengiriman |
| POST | `/dispatch-records/:id/dispatch` | `supply_chain:write` | Berangkatkan paket |
| POST | `/dispatch-records/:id/deliver` | `supply_chain:write` | Tandai paket terkirim |
| POST | `/dispatch-records/:id/cancel` | `supply_chain:write` | Batalkan pengiriman |
| GET/POST | `/warehouse-returns` | `supply_chain:read` / `supply_chain:manage` | Daftar / buat retur gudang |
| GET | `/warehouse-returns/:id` | `supply_chain:read` | Detail retur |
| POST | `/warehouse-returns/:id/approve` | `supply_chain:manage` | Setujui retur |
| POST | `/warehouse-returns/:id/receive` | `supply_chain:write` | Terima barang retur |
| POST | `/warehouse-returns/:id/restock` | `supply_chain:write` | Kembalikan retur ke stok |
| POST | `/warehouse-returns/:id/reject` | `supply_chain:manage` | Tolak retur |
| POST | `/warehouse-returns/:id/cancel` | `supply_chain:write` | Batalkan retur |
| GET | `/fulfillment-status-histories` | `supply_chain:read` | Riwayat status fulfillment |
| GET/POST | `/collective-purchase-groups` | `supply_chain:read` / `supply_chain:manage` | Daftar / buat grup pembelian |
| GET/PATCH | `/collective-purchase-groups/:id` | `supply_chain:read` / `supply_chain:manage` | Detail / ubah grup |
| POST | `/collective-purchase-groups/:id/close` | `supply_chain:manage` | Tutup grup |
| POST | `/collective-purchase-groups/:id/cancel` | `supply_chain:manage` | Batalkan grup |

> Penerimaan barang yang selesai otomatis membuat stok masuk, warehouse
> receipt, dan tugas put-away. Put-away selesai memindahkan stok ke lokasi
> tujuan. Picking selesai mengeluarkan stok dan melepas reservasi alokasi.
> Seluruh kuantitas dan nilai uang dikembalikan sebagai string desimal.

### Pemasaran — `/api/v1/marketing` (MKT-12)

| Method | Path | Permission | Keterangan |
| --- | --- | --- | --- |
| GET/POST | `/campaigns` | `marketing:read` / `marketing:write` | Daftar / buat kampanye |
| GET/PATCH | `/campaigns/:id` | `marketing:read` / `marketing:write` | Detail (channel & performa) / ubah kampanye |
| POST | `/campaigns/:id/activate` | `marketing:write` | Aktifkan kampanye |
| POST | `/campaigns/:id/pause` | `marketing:write` | Jeda kampanye |
| POST | `/campaigns/:id/resume` | `marketing:write` | Lanjutkan kampanye |
| POST | `/campaigns/:id/complete` | `marketing:write` | Selesaikan kampanye |
| POST | `/campaigns/:id/cancel` | `marketing:write` | Batalkan kampanye |
| GET/POST | `/campaigns/:id/channels` | `marketing:read` / `marketing:write` | Channel kampanye |
| PATCH/DELETE | `/campaign-channels/:id` | `marketing:write` | Ubah / hapus channel |
| GET/POST | `/campaigns/:id/performance` | `marketing:read` / `marketing:write` | Performa harian per channel (upsert) |
| GET | `/campaign-performance` | `marketing:read` | Performa lintas kampanye |
| PATCH/DELETE | `/campaign-performance/:id` | `marketing:write` | Ubah / hapus catatan performa |
| GET/POST | `/advertisements` | `marketing:read` / `marketing:write` | Daftar / buat iklan |
| GET/PATCH/DELETE | `/advertisements/:id` | `marketing:read` / `marketing:write` | Detail / ubah / batalkan iklan |
| GET/POST | `/promotions` | `marketing:read` / `marketing:write` | Daftar / buat promosi |
| GET/PATCH | `/promotions/:id` | `marketing:read` / `marketing:write` | Detail (aturan) / ubah promosi |
| POST | `/promotions/:id/activate` | `marketing:write` | Aktifkan promosi |
| POST | `/promotions/:id/pause` | `marketing:write` | Jeda promosi |
| POST | `/promotions/:id/cancel` | `marketing:write` | Batalkan promosi |
| GET/POST | `/promotions/:id/rules` | `marketing:read` / `marketing:write` | Aturan diskon promosi |
| PATCH/DELETE | `/discount-rules/:id` | `marketing:write` | Ubah / hapus aturan diskon |
| GET/POST | `/coupons` | `marketing:read` / `marketing:write` | Daftar / buat kupon |
| GET/PATCH/DELETE | `/coupons/:id` | `marketing:read` / `marketing:write` | Detail (redemption) / ubah / nonaktifkan |
| POST | `/coupons/validate` | `marketing:read` | Validasi kupon terhadap nominal order |
| POST | `/coupons/:id/redeem` | `marketing:write` | Pakai kupon pada order + hitung ulang total |
| GET | `/coupon-redemptions` | `marketing:read` | Riwayat pemakaian kupon |
| POST | `/coupon-redemptions/:id/cancel` | `marketing:manage` | Batalkan redemption + pulihkan total order |

### CRM — `/api/v1/marketing` (MKT-13)

| Method | Path | Permission | Keterangan |
| --- | --- | --- | --- |
| GET/POST | `/customers` | `crm:read` / `crm:write` | Daftar / buat pelanggan |
| GET/PATCH/DELETE | `/customers/:id` | `crm:read` / `crm:write` / `crm:manage` | Detail / ubah / soft-delete pelanggan |
| PUT | `/customers/:id/profile` | `crm:write` | Upsert profil pelanggan |
| GET | `/customers/:id/orders` | `crm:read` | Riwayat order pelanggan dari commerce |
| POST | `/customers/:id/refresh-metrics` | `crm:write` | Hitung ulang total order, belanja, dan lifetime spend |
| GET/POST | `/customer-groups` | `crm:read` / `crm:write` | Daftar / buat grup |
| GET/PATCH/DELETE | `/customer-groups/:id` | `crm:read` / `crm:write` / `crm:manage` | Detail / ubah / hapus grup |
| POST | `/customer-groups/:id/members` | `crm:write` | Tambah anggota grup |
| DELETE | `/customer-groups/:id/members/:customerId` | `crm:write` | Keluarkan anggota grup |
| GET/POST | `/customer-segments` | `crm:read` / `crm:write` | Daftar / buat segmen |
| GET/PATCH/DELETE | `/customer-segments/:id` | `crm:read` / `crm:write` / `crm:manage` | Detail / ubah / hapus segmen |
| POST | `/customer-segments/:id/members` | `crm:write` | Tambah anggota segmen manual |
| DELETE | `/customer-segments/:id/members/:customerId` | `crm:write` | Keluarkan anggota segmen manual |
| POST | `/customer-segments/:id/refresh` | `crm:write` | Hitung ulang anggota segmen dinamis |
| GET/POST | `/loyalty-accounts` | `crm:read` / `crm:write` | Daftar / buat akun loyalty |
| GET/PATCH | `/loyalty-accounts/:id` | `crm:read` / `crm:write` | Detail (mutasi) / ubah akun |
| POST | `/loyalty-accounts/:id/activate` | `crm:manage` | Aktifkan akun |
| POST | `/loyalty-accounts/:id/suspend` | `crm:manage` | Tangguhkan akun |
| POST | `/loyalty-accounts/:id/close` | `crm:manage` | Tutup akun |
| GET/POST | `/loyalty-accounts/:id/transactions` | `crm:read` / `crm:write` | Mutasi poin akun |
| GET | `/loyalty-transactions` | `crm:read` | Mutasi poin lintas akun |
| GET/POST | `/interactions` | `crm:read` / `crm:write` | Daftar / catat interaksi |
| GET/PATCH/DELETE | `/interactions/:id` | `crm:read` / `crm:write` / `crm:manage` | Detail / ubah / batalkan interaksi |
| POST | `/interactions/:id/complete` | `crm:write` | Tandai interaksi selesai |
| POST | `/interactions/:id/cancel` | `crm:write` | Batalkan interaksi |
| GET/POST | `/complaints` | `crm:read` / `crm:write` | Daftar / buat keluhan |
| GET/PATCH | `/complaints/:id` | `crm:read` / `crm:write` | Detail / ubah keluhan |
| POST | `/complaints/:id/start` | `crm:write` | Mulai penanganan keluhan |
| POST | `/complaints/:id/resolve` | `crm:write` | Selesaikan keluhan + resolusi |
| POST | `/complaints/:id/reject` | `crm:write` | Tolak keluhan + alasan |
| POST | `/complaints/:id/close` | `crm:manage` | Tutup keluhan |

> Redemption kupon memerlukan order commerce merchant yang sama, menghitung
> ulang `discountTotal`/`grandTotal`, dan mencatat mutasi redemption. Pembatalan
> redemption mengembalikan total order serta kuota kupon. Mutasi loyalty selalu
> memperbarui saldo dan tier akun secara transaksional.

### Bisnis — `/api/v1/business` (2MD-01 / 2MD-02)

| Method | Path | Permission | Keterangan |
| --- | --- | --- | --- |
| GET/POST | `/performance-periods` | `business:read` / `business:write` | Daftar / buat periode kinerja |
| PATCH/DELETE | `/performance-periods/:id` | `business:write` / `business:manage` | Ubah / hapus periode |
| GET/POST | `/kpis` | `business:read` / `business:write` | Daftar / buat KPI |
| PATCH/DELETE | `/kpis/:id` | `business:write` / `business:manage` | Ubah / hapus KPI |
| GET/POST | `/kpi-values` | `business:read` / `business:write` | Daftar / isi nilai KPI |
| PATCH/DELETE | `/kpi-values/:id` | `business:write` / `business:manage` | Ubah / hapus nilai KPI |
| GET/POST | `/targets` | `business:read` / `business:write` | Daftar / buat target |
| PATCH/DELETE | `/targets/:id` | `business:write` / `business:manage` | Ubah / hapus target |
| GET/POST | `/growth-snapshots` | `business:read` / `business:write` | Daftar / buat snapshot pertumbuhan |
| PATCH/DELETE | `/growth-snapshots/:id` | `business:write` / `business:manage` | Ubah / hapus snapshot |
| GET/POST | `/reports` | `business:read` / `business:write` | Daftar / buat laporan performa |
| POST | `/reports/generate` | `business:write` | Hitung laporan dari data order merchant |
| GET/PATCH/DELETE | `/reports/:id` | `business:read` / `business:write` / `business:manage` | Detail / ubah / hapus laporan |
| POST | `/reports/:id/publish` | `business:write` | Terbitkan laporan |
| GET/POST | `/profiles` | `business:read` / `business:write` | Daftar / buat profil bisnis |
| GET/PATCH/DELETE | `/profiles/:id` | `business:read` / `business:write` / `business:manage` | Detail / ubah / hapus profil |
| GET | `/profiles/:id/metrics` | `business:read` | Metrik profil dan kelengkapan |
| POST | `/profiles/:id/verify` | `business:manage` | Verifikasi / tolak profil |
| GET/POST | `/profiles/:id/history` | `business:read` / `business:write` | Riwayat usaha |
| PATCH/DELETE | `/profiles/:pid/history/:id` | `business:write` / `business:manage` | Ubah / hapus riwayat |
| GET/POST | `/profiles/:id/locations` | `business:read` / `business:write` | Lokasi usaha |
| PATCH/DELETE | `/profiles/:pid/locations/:id` | `business:write` / `business:manage` | Ubah / hapus lokasi |
| GET/POST | `/profiles/:id/documents` | `business:read` / `business:write` | Dokumen legalitas |
| PATCH/DELETE | `/profiles/:pid/documents/:id` | `business:write` / `business:manage` | Ubah / hapus dokumen |
| GET/POST | `/profiles/:id/activities` | `business:read` / `business:write` | Aktivitas usaha |
| PATCH/DELETE | `/profiles/:pid/activities/:id` | `business:write` / `business:manage` | Ubah / hapus aktivitas |
| GET | `/profiles/:id/verifications` | `business:read` | Riwayat verifikasi |
| GET/POST | `/profiles/:id/shares` | `business:read` / `business:write` | Daftar / buat share profil |
| POST | `/profiles/:pid/shares/:id/revoke` | `business:write` | Cabut share profil |

### Pendanaan — `/api/v1/funding` (2MD-03 / 2MD-04 / 2MD-05)

| Method | Path | Permission | Keterangan |
| --- | --- | --- | --- |
| GET/POST | `/proposals` | `funding:read` / `funding:write` | Daftar / buat proposal |
| GET/PATCH/DELETE | `/proposals/:id` | `funding:read` / `funding:write` / `funding:manage` | Detail / ubah / arsip proposal |
| POST | `/proposals/:id/submit` | `funding:write` | Ajukan proposal |
| POST | `/proposals/:id/publish` | `funding:write` | Terbitkan proposal + aktifkan data room |
| POST | `/proposals/:id/archive` | `funding:write` | Arsipkan proposal |
| GET/POST | `/proposals/:id/versions` | `funding:read` / `funding:write` | Versi naskah proposal |
| PATCH | `/proposal-versions/:id` | `funding:write` | Ubah versi proposal |
| GET/POST | `/proposals/:id/plans` | `funding:read` / `funding:write` | Rencana bisnis |
| PATCH/DELETE | `/business-plans/:id` | `funding:write` / `funding:manage` | Ubah / hapus rencana bisnis |
| GET/POST | `/proposals/:id/projections` | `funding:read` / `funding:write` | Proyeksi keuangan |
| PATCH/DELETE | `/financial-projections/:id` | `funding:write` / `funding:manage` | Ubah / hapus proyeksi |
| GET/POST | `/proposals/:id/requirements` | `funding:read` / `funding:write` | Kebutuhan pendanaan |
| PATCH/DELETE | `/funding-requirements/:id` | `funding:write` / `funding:manage` | Ubah / hapus kebutuhan |
| GET/POST | `/proposals/:id/utilization-plans` | `funding:read` / `funding:write` | Rencana penggunaan dana |
| PATCH/DELETE | `/fund-utilization-plans/:id` | `funding:write` / `funding:manage` | Ubah / hapus rencana |
| GET | `/documents` | `funding:read` | Dokumen lintas proposal |
| GET/POST | `/proposals/:id/documents` | `funding:read` / `funding:write` | Dokumen proposal |
| PATCH/DELETE | `/business-documents/:id` | `funding:write` / `funding:manage` | Ubah / hapus dokumen |
| GET/PATCH | `/proposals/:id/data-room` | `funding:read` / `funding:write` | Data room proposal |
| GET | `/data-rooms/:id/access-logs` | `funding:read` | Log akses data room |
| POST | `/data-rooms/:id/access` | `funding:write` | Beri akses data room |
| POST | `/data-room-access/:id/revoke` | `funding:write` | Cabut akses data room |
| GET/POST | `/opportunities` | `funding:read` / `funding:write` | Daftar / buat peluang pendanaan |
| GET/PATCH/DELETE | `/opportunities/:id` | `funding:read` / `funding:write` / `funding:manage` | Detail / ubah / hapus peluang |
| GET/POST | `/investors` | `funding:read` / `funding:write` | Daftar / buat profil investor |
| GET/PATCH | `/investors/:id` | `funding:read` / `funding:write` | Detail / ubah investor |
| POST | `/investors/:id/verify` | `funding:manage` | Verifikasi investor |
| GET/POST | `/applications` | `funding:read` / `funding:write` | Daftar / buat pengajuan |
| GET/PATCH | `/applications/:id` | `funding:read` / `funding:write` | Detail / ubah pengajuan |
| POST | `/applications/:id/submit` | `funding:write` | Ajukan pengajuan |
| POST | `/applications/:id/transition` | `funding:write` | Transisi status pengajuan |
| GET | `/applications/:id/statuses` | `funding:read` | Riwayat status pengajuan |
| GET/POST | `/matches` | `funding:read` / `funding:write` | Daftar / buat match |
| PATCH | `/matches/:id` | `funding:write` | Ubah match |
| POST | `/matches/suggest` | `funding:write` | Saran match otomatis |
| GET/POST | `/interests` | `funding:read` / `funding:write` | Daftar / catat minat investor |
| PATCH | `/interests/:id` | `funding:write` | Ubah minat |
| POST | `/interests/:id/withdraw` | `funding:write` | Tarik minat |
| GET/POST | `/referrals` | `funding:read` / `funding:write` | Daftar / buat referral mitra |
| PATCH/DELETE | `/referrals/:id` | `funding:write` / `funding:manage` | Ubah / hapus referral |
| GET/POST | `/financings` | `funding:read` / `funding:write` | Daftar / buat fasilitas pembiayaan |
| GET/PATCH | `/financings/:id` | `funding:read` / `funding:write` | Detail / ubah fasilitas |
| POST | `/financings/:id/activate` | `funding:write` | Aktifkan fasilitas |
| POST | `/financings/:id/close` | `funding:manage` | Tutup fasilitas |
| POST | `/financings/:id/default` | `funding:manage` | Tandai gagal bayar |
| GET/POST | `/financings/:id/agreements` | `funding:read` / `funding:write` | Perjanjian pembiayaan |
| PATCH/DELETE | `/financing-agreements/:id` | `funding:write` / `funding:manage` | Ubah / hapus perjanjian |
| GET/POST | `/financings/:id/disbursements` | `funding:read` / `funding:write` | Pencairan dana |
| PATCH | `/disbursements/:id` | `funding:write` | Ubah pencairan |
| POST | `/disbursements/:id/confirm` | `funding:write` | Konfirmasi pencairan |
| GET/POST | `/financings/:id/repayment-schedules` | `funding:read` / `funding:write` | Jadwal angsuran |
| POST | `/financings/:id/generate-schedule` | `funding:write` | Generate jadwal angsuran |
| PATCH | `/repayment-schedules/:id` | `funding:write` | Ubah jadwal angsuran |
| POST | `/repayment-schedules/:id/pay` | `funding:write` | Catat pembayaran angsuran |
| GET | `/repayment-transactions` | `funding:read` | Riwayat transaksi angsuran |
| GET/POST | `/financings/:id/utilization-reports` | `funding:read` / `funding:write` | Laporan penggunaan dana |
| PATCH | `/utilization-reports/:id` | `funding:write` | Ubah laporan penggunaan |
| GET/POST | `/financings/:id/monitoring-reports` | `funding:read` / `funding:write` | Laporan monitoring |
| PATCH | `/monitoring-reports/:id` | `funding:write` | Ubah laporan monitoring |
| GET/POST | `/risk-indicators` | `funding:read` / `funding:write` | Daftar / buat indikator risiko |
| PATCH/DELETE | `/risk-indicators/:id` | `funding:write` / `funding:manage` | Ubah / hapus indikator |
| GET/POST | `/risk-assessments` | `funding:read` / `funding:write` | Daftar / buat penilaian risiko |
| PATCH/DELETE | `/risk-assessments/:id` | `funding:write` / `funding:manage` | Ubah / hapus penilaian |
| POST | `/risk-assessments/calculate` | `funding:write` | Hitung penilaian risiko otomatis |

> Proposal hanya dapat diajukan dari profil merchant yang sama. Pengajuan hanya
> dapat memakai proposal berstatus `submitted` atau `published`. Generate jadwal
> angsuran membagi pokok dan bunga sesuai tenor, lalu pembayaran angsuran
> memperbarui status jadwal dan transaksi.

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

### Integrasi — `/api/v1/integrations` (SYS-03)

| Method | Path | Permission | Keterangan |
| --- | --- | --- | --- |
| GET/POST | `/providers` | `integration:read` / `integration:write` | Daftar / buat provider |
| GET/PATCH/DELETE | `/providers/:id` | `integration:read` / `integration:write` / `integration:manage` | Detail / ubah / hapus provider |
| GET/POST | `/connections` | `integration:read` / `integration:write` | Daftar / buat koneksi |
| GET/PATCH/DELETE | `/connections/:id` | `integration:read` / `integration:write` / `integration:manage` | Detail / ubah / hapus koneksi |
| POST | `/connections/:id/test` | `integration:write` | Uji koneksi provider |
| GET/POST | `/clients` | `integration:read` / `integration:write` | Daftar / buat klien API |
| GET/PATCH/DELETE | `/clients/:id` | `integration:read` / `integration:write` / `integration:manage` | Detail / ubah / hapus klien API |
| GET/POST | `/clients/:id/keys` | `integration:read` / `integration:manage` | Daftar / buat kunci API |
| POST | `/keys/:id/revoke` | `integration:manage` | Cabut kunci API |
| GET/POST | `/endpoints` | `integration:read` / `integration:write` | Daftar / buat endpoint gateway |
| PATCH/DELETE | `/endpoints/:id` | `integration:write` / `integration:manage` | Ubah / hapus endpoint |
| GET/POST | `/webhooks` | `integration:read` / `integration:write` | Daftar / buat langganan webhook |
| PATCH/DELETE | `/webhooks/:id` | `integration:write` / `integration:manage` | Ubah / hapus webhook |
| GET | `/webhook-events` | `integration:read` | Daftar event webhook |
| POST | `/webhook-events/:id/retry` | `integration:write` | Kirim ulang event webhook |
| GET | `/logs` | `integration:read` | Log integrasi masuk/keluar |
| GET/POST | `/mapping-rules` | `integration:read` / `integration:write` | Daftar / buat aturan pemetaan |
| PATCH/DELETE | `/mapping-rules/:id` | `integration:write` / `integration:manage` | Ubah / hapus aturan pemetaan |

### Notifikasi — `/api/v1/notifications` (SYS-04)

| Method | Path | Permission | Keterangan |
| --- | --- | --- | --- |
| GET/POST | `/channels` | `notification:read` / `notification:write` | Daftar / buat kanal |
| PATCH/DELETE | `/channels/:id` | `notification:write` / `notification:manage` | Ubah / hapus kanal |
| GET/POST | `/templates` | `notification:read` / `notification:write` | Daftar / buat template |
| PATCH/DELETE | `/templates/:id` | `notification:write` / `notification:manage` | Ubah / hapus template |
| POST | `/templates/:id/activate` | `notification:write` | Aktifkan template |
| GET/POST | `/messages` | `notification:read` / `notification:write` | Daftar / buat pesan |
| POST | `/messages/:id/send` | `notification:write` | Kirim pesan |
| POST | `/messages/:id/cancel` | `notification:write` | Batalkan pesan |
| GET | `/recipients` | `notification:read` | Daftar penerima pesan |
| GET | `/delivery-logs` | `notification:read` | Log pengiriman |
| GET/POST | `/preferences` | `notification:read` / `notification:write` | Daftar / buat preferensi komunikasi |
| PATCH/DELETE | `/preferences/:id` | `notification:write` / `notification:manage` | Ubah / hapus preferensi |

### Konfigurasi — `/api/v1/config` (SYS-05)

| Method | Path | Permission | Keterangan |
| --- | --- | --- | --- |
| GET/POST | `/groups` | `config:read` / `config:write` | Daftar / buat grup konfigurasi |
| PATCH/DELETE | `/groups/:id` | `config:write` / `config:manage` | Ubah / hapus grup |
| GET/POST | `/settings` | `config:read` / `config:write` | Daftar / buat pengaturan sistem |
| PATCH/DELETE | `/settings/:id` | `config:write` / `config:manage` | Ubah / hapus pengaturan |
| PATCH | `/settings/bulk` | `config:write` | Ubah beberapa pengaturan sekaligus |
| GET/POST | `/reference-codes` | `config:read` / `config:write` | Daftar / buat kode referensi |
| GET/POST | `/reference-codes/:id/values` | `config:read` / `config:write` | Daftar / tambah nilai referensi |
| PATCH/DELETE | `/reference-values/:id` | `config:write` / `config:manage` | Ubah / hapus nilai referensi |
| GET/POST | `/feature-flags` | `config:read` / `config:write` | Daftar / buat feature flag |
| PATCH/DELETE | `/feature-flags/:id` | `config:write` / `config:manage` | Ubah / hapus feature flag |
| POST | `/feature-flags/:id/toggle` | `config:write` | Ubah status flag |
| GET/POST | `/service-parameters` | `config:read` / `config:write` | Daftar / buat parameter layanan |
| PATCH/DELETE | `/service-parameters/:id` | `config:write` / `config:manage` | Ubah / hapus parameter |
| GET/POST | `/localization` | `config:read` / `config:write` | Daftar / buat lokalisasi |
| PATCH/DELETE | `/localization/:id` | `config:write` / `config:manage` | Ubah / hapus lokalisasi |
| POST | `/localization/:id/default` | `config:write` | Jadikan locale default |

### AI — `/api/v1/ai` (SYS-07)

| Method | Path | Permission | Keterangan |
| --- | --- | --- | --- |
| GET/POST | `/models` | `ai:read` / `ai:manage` | Daftar / buat model AI |
| PATCH/DELETE | `/models/:id` | `ai:manage` | Ubah / hapus model |
| GET/POST | `/sessions` | `ai:read` / `ai:write` | Daftar / buat sesi AI |
| GET/POST | `/sessions/:id/messages` | `ai:read` / `ai:write` | Daftar / kirim pesan sesi |
| GET/POST | `/requests` | `ai:read` / `ai:write` | Daftar / buat request AI |
| POST | `/requests/:id/complete` | `ai:write` | Selesaikan request AI |
| GET/POST | `/responses` | `ai:read` / `ai:write` | Daftar / simpan respons model |
| GET/POST | `/recommendations` | `ai:read` / `ai:write` | Daftar / buat rekomendasi |
| GET/POST | `/forecast-jobs` | `ai:read` / `ai:write` | Daftar / buat job forecast |
| POST | `/forecast-jobs/:id/run` | `ai:write` | Jalankan job forecast |
| GET | `/usage-logs` | `ai:read` | Log penggunaan token dan biaya |

### Analitik — `/api/v1/analytics` (SYS-08)

| Method | Path | Permission | Keterangan |
| --- | --- | --- | --- |
| GET/POST | `/data-sources` | `analytics:read` / `analytics:write` | Daftar / buat sumber data |
| PATCH/DELETE | `/data-sources/:id` | `analytics:write` / `analytics:manage` | Ubah / hapus sumber data |
| GET/POST | `/etl-jobs` | `analytics:read` / `analytics:manage` | Daftar / buat job ETL |
| PATCH/DELETE | `/etl-jobs/:id` | `analytics:manage` | Ubah / hapus job ETL |
| POST | `/etl-jobs/:id/run` | `analytics:write` | Jalankan job ETL |
| GET | `/load-logs` | `analytics:read` | Log pemuatan data |
| GET/POST | `/data-marts` | `analytics:read` / `analytics:manage` | Daftar / buat data mart |
| PATCH/DELETE | `/data-marts/:id` | `analytics:manage` | Ubah / hapus data mart |
| POST | `/data-marts/:id/refresh` | `analytics:write` | Segarkan data mart |
| GET/POST | `/reports` | `analytics:read` / `analytics:write` | Daftar / buat definisi laporan |
| PATCH/DELETE | `/reports/:id` | `analytics:write` / `analytics:manage` | Ubah / hapus laporan |
| POST | `/reports/:id/run` | `analytics:write` | Jalankan laporan |
| GET | `/report-runs` | `analytics:read` | Riwayat eksekusi laporan |
| GET/POST | `/snapshots` | `analytics:read` / `analytics:write` | Daftar / buat snapshot historis |

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
| `market_admin` | Kelola pasar/okupansi, verifikasi merchant, master katalog, kanal commerce, lihat pembayaran, lihat POS, lihat inventori, lihat rantai pasok, lihat pemasaran & CRM, lihat bisnis & pendanaan, lihat integrasi/notifikasi/konfigurasi/AI/analitik, lihat audit |
| `member` | Buat organisasi, kelola merchant/toko/produk/storefront miliknya, belanja, kelola pembayaran/refund merchant, kelola POS, inventori, rantai pasok, pemasaran & CRM, bisnis, serta pendanaan merchant |

Permission yang tersedia: `user:read`, `user:write`, `role:manage`,
`organization:read`, `organization:write`, `organization:member:manage`,
`market:read`, `market:write`, `occupancy:manage`, `merchant:read`,
`merchant:write`, `merchant:verify`, `store:read`, `store:write`,
`catalog:read`, `catalog:write`, `catalog:manage`, `commerce:read`,
`commerce:write`, `commerce:manage`, `payment:read`, `payment:write`,
`payment:manage`, `pos:read`, `pos:write`, `pos:manage`, `inventory:read`,
`inventory:write`, `inventory:manage`, `supply_chain:read`,
`supply_chain:write`, `supply_chain:manage`, `marketing:read`,
`marketing:write`, `marketing:manage`, `crm:read`, `crm:write`,
`crm:manage`, `business:read`, `business:write`, `business:manage`,
`funding:read`, `funding:write`, `funding:manage`, `integration:read`,
`integration:write`, `integration:manage`, `notification:read`,
`notification:write`, `notification:manage`, `config:read`, `config:write`,
`config:manage`, `ai:read`, `ai:write`, `ai:manage`, `analytics:read`,
`analytics:write`, `analytics:manage`, `audit:read`.

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
  order, item, status history, catatan, pembatalan, retur, ledger transaksi,
  terminal POS, cash register, shift kasir, transaksi POS, item POS,
  pergerakan kas, dan log sinkronisasi (24 tabel).
- `payment` — provider, metode, akun pencairan merchant, payment intent,
  attempt, event, refund, settlement, item settlement, dan rekonsiliasi
  (10 tabel).
- `inventory` — gudang, lokasi, item persediaan, saldo stok, movement, item
  movement, penyesuaian, opname, item opname, dan batch (10 tabel).
- `supply_chain` — supplier, permintaan pembelian, item permintaan, penawaran
  supplier, item penawaran, purchase order, item PO, penerimaan barang, item
  penerimaan, approval pengadaan, grup pembelian kolektif, warehouse receipt,
  put-away, alokasi gudang, picking, item picking, packing, pengiriman, retur
  gudang, dan riwayat status fulfillment (20 tabel).
- `marketing` — kampanye, channel kampanye, performa kampanye, iklan,
  promosi, aturan diskon, kupon, redemption kupon, pelanggan, profil, grup,
  anggota grup, segmen, anggota segmen, akun loyalty, transaksi loyalty,
  interaksi, dan keluhan (18 tabel).
- `business` — profil bisnis, periode kinerja, KPI, nilai KPI, target, growth
  snapshot, laporan performa, lokasi, dokumen legalitas, aktivitas, verifikasi,
  dan share profil (13 tabel).
- `funding` — proposal, versi, rencana bisnis, proyeksi keuangan, kebutuhan
  dana, penggunaan dana, dokumen, data room, peluang, investor, pengajuan,
  match, minat, referral, fasilitas pembiayaan, perjanjian, pencairan,
  angsuran, laporan, indikator risiko, dan penilaian risiko (25 tabel).
- `platform` — integrasi (provider, koneksi, klien API, kunci, endpoint,
  webhook, event, log, mapping), notifikasi (kanal, template, pesan, penerima,
  log, preferensi), konfigurasi (grup, setelan, referensi, feature flag,
  parameter, lokalisasi), dan AI (model, sesi, pesan, request, respons,
  rekomendasi, forecast, usage) (30 tabel).
- `analytics` — sumber data, job ETL, log pemuatan, data mart, definisi
  laporan, eksekusi laporan, dan snapshot historis (7 tabel).
- `governance` — `audit_logs` (1 tabel).

Detail tabel, relasi, enum, dan keputusan desain ada di
[`docs/core-database.md`](docs/core-database.md),
[`docs/catalog-database.md`](docs/catalog-database.md),
[`docs/commerce-database.md`](docs/commerce-database.md),
[`docs/order-database.md`](docs/order-database.md),
[`docs/payment-database.md`](docs/payment-database.md),
[`docs/pos-database.md`](docs/pos-database.md),
[`docs/inventory-database.md`](docs/inventory-database.md),
[`docs/supply-chain-database.md`](docs/supply-chain-database.md),
[`docs/marketing-crm-database.md`](docs/marketing-crm-database.md),
[`docs/business-funding-database.md`](docs/business-funding-database.md), dan
[`docs/platform-analytics-database.md`](docs/platform-analytics-database.md).

Migration SQL: `drizzle/0000_*.sql` (core), `drizzle/0001_*.sql` (catalog),
`drizzle/0002_*.sql` (commerce), `drizzle/0003_*.sql` (order),
`drizzle/0004_*.sql` (payment), `drizzle/0005_*.sql` (POS),
`drizzle/0006_*.sql` (inventori), `drizzle/0007_*.sql` (rantai pasok),
`drizzle/0008_*.sql` (pemasaran & CRM), `drizzle/0009_*.sql` (bisnis &
pendanaan), dan `drizzle/0010_*.sql` (platform & analitik).

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
  occupancy, store, organisasi, checkout, order, pembatalan, retur, payment,
  refund, settlement, rekonsiliasi, terminal POS, register, shift kasir,
  transaksi POS, pembatalan POS, sinkronisasi offline, gudang, lokasi, item
  persediaan, pergerakan stok, penyesuaian, opname, batch, supplier,
  permintaan pembelian, penawaran supplier, purchase order, penerimaan barang,
  put-away, alokasi, picking, packing, pengiriman, retur gudang, grup
  pembelian kolektif, kampanye, channel, performa kampanye, iklan, promosi,
  aturan diskon, kupon, redemption kupon, pelanggan, profil pelanggan, grup
  pelanggan, segmen pelanggan, akun loyalty, transaksi loyalty, interaksi
  pelanggan, keluhan, provider/koneksi/klien API/endpoint/webhook integrasi,
  template/pesan/kanal notifikasi, grup/setelan/referensi/feature flag/parameter
  konfigurasi, model/sesi/rekomendasi/forecast AI, serta sumber data/ETL/data
  mart/laporan/snapshot analitik).
- Belum termasuk: email verification, MFA, refresh token, rate limiting.
  Semua ini masuk roadmap SYS-01/SYS-06.

---

## 9. Roadmap Modul Berikutnya

**MKT-04 Marketplace & Omnichannel Commerce**, **MKT-05 Order & Transaction
Management**, **MKT-06 Integrated Payment Management**, **MKT-07 POS &
Offline Transaction Management**, **MKT-08 Inventory & Warehouse
Management**, **SCM-01/SCM-02 Supply Chain & Fulfillment**,
**MKT-12/MKT-13 Digital Marketing & CRM**, dan **2MD-01 sampai 2MD-05
Business, Funding & Financing** sudah diimplementasikan. MKT-04 mencakup
storefront, katalog publik, cart, checkout, dan channel listing. MKT-05
mencakup konversi checkout menjadi order per merchant, status order,
pembatalan, retur, dan ledger transaksi penjualan.
MKT-06 mencakup provider/metode pembayaran, payment intent, attempt, refund,
settlement merchant, dan rekonsiliasi provider. MKT-07 mencakup terminal POS,
cash register, shift kasir, transaksi toko fisik, pergerakan kas, pembatalan
transaksi, dan sinkronisasi offline. MKT-08 mencakup gudang, lokasi, item
persediaan, saldo stok, pergerakan stok, penyesuaian, opname, serta
batch/expiry. SCM-01 mencakup supplier, permintaan pembelian, penawaran vendor,
purchase order, approval, penerimaan barang, dan grup pembelian kolektif.
SCM-02 mencakup warehouse receipt, put-away, alokasi, picking, packing,
pengiriman, retur gudang, dan riwayat status fulfillment. MKT-12 mencakup
kampanye multichannel, channel, performa kampanye, promosi, aturan diskon,
kupon, redemption kupon yang terhubung ke order commerce, serta iklan. MKT-13
mencakup pelanggan, profil, grup, segmen manual/dinamis, akun loyalty, mutasi
poin dengan pembaruan saldo/tier, interaksi, dan keluhan dengan alur
penyelesaian. 2MD-01/2MD-02 mencakup periode kinerja, KPI, nilai KPI, target,
growth snapshot, laporan performa, profil bisnis, lokasi, dokumen legalitas,
aktivitas, verifikasi, dan share profil. 2MD-03 mencakup proposal, versi,
rencana bisnis, proyeksi keuangan, kebutuhan dana, rencana penggunaan dana,
dokumen, dan data room. 2MD-04 mencakup peluang pendanaan, profil investor,
pengajuan, match, minat investor, referral, dan riwayat status pengajuan.
2MD-05 mencakup fasilitas pembiayaan, perjanjian, pencairan, jadwal angsuran,
pembayaran angsuran, laporan penggunaan dana, laporan monitoring, indikator
risiko, dan penilaian risiko. SYS-03 mencakup provider, koneksi, klien API,
kunci, endpoint gateway, webhook, event webhook, log integrasi, dan aturan
pemetaan data. SYS-04 mencakup kanal, template, pesan, penerima, log
pengiriman, dan preferensi komunikasi. SYS-05 mencakup grup konfigurasi,
pengaturan sistem, kode referensi, feature flag, parameter layanan, dan
lokalisasi. SYS-07 mencakup model, sesi, pesan, request, respons, rekomendasi,
forecast, dan log penggunaan AI. SYS-08 mencakup sumber data, job ETL, log
pemuatan, data mart, definisi laporan, eksekusi laporan, dan snapshot historis.
Dashboard admin memiliki menu **Commerce**, **Pesanan**, **Pembayaran**,
**POS**, **Inventori**, **Rantai Pasok**, **Pemasaran**, **CRM**, **Bisnis**,
**Pendanaan**, **Integrasi**, **Notifikasi**, **Konfigurasi**, **AI**,
**Analitik**, dan **Audit Log**. Urutan berikutnya:

1. **SYS-06** Security, Compliance & Risk Management.
2. **SYS-09/10/11** community, government, dan modul lanjutan.

Schema PostgreSQL sudah disiapkan untuk ditambah per domain (`catalog`,
`commerce`, `payment`, `inventory`, `supply_chain`, `marketing`, `business`,
`funding`, `analytics`, `platform`, `governance`, `community`, `government`).
