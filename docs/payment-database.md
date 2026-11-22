# Payment Database - MKT-06 Integrated Payment Management

Dokumen ini menjelaskan schema `payment` untuk modul **MKT-06 Integrated
Payment Management**. Modul ini mengelola provider/gateway, metode pembayaran,
akun pencairan merchant, payment intent per order, percobaan pembayaran,
refund, settlement merchant, dan rekonsiliasi provider.

Status pembayaran bersifat **finansial** dan tidak mengubah status order MKT-05
secara otomatis. Order tetap dikelola oleh modul order.

- Schema PostgreSQL: `payment`
- Tabel baru: **10**
- Migration: `drizzle/0004_breezy_cannonball.sql`
- Kode schema: `src/db/schema/payment.ts`
- Kode API: `src/routes/payments/`
- Seed provider: `Simulator Gateway` (`simulator`)
- Seed metode: QRIS, E-Wallet, Transfer Bank, Virtual Account, Tunai

---

## 1. Keputusan Desain

1. **Schema terpisah dari commerce.**
   - Tabel pembayaran tidak dicampur dengan `commerce.orders`.
   - Relasi tetap dijaga lewat foreign key ke `commerce.orders`,
     `commerce.returns`, `core.merchants`, dan `core.users`.
2. **Satu payment intent per order.**
   - Unique index `payments.order_id` mencegah dua payment intent aktif untuk
     order yang sama.
   - Order yang sudah lunas tidak dapat dibuatkan pembayaran baru.
3. **Pembuatan pembayaran idempoten saat belum lunas.**
   - Request `POST /payments/orders/:orderId` mengembalikan payment yang sama
     bila status masih `pending` atau `authorized`.
   - Retry membuat `payment_attempt` baru dan mereset status payment ke
     `pending`.
4. **Nominal harus sama dengan total order.**
   - Nominal payment mengikuti `orders.grand_total`.
   - Batas minimum/maksimum metode tetap diperiksa.
5. **Fee dihitung dari metode.**
   - `fee_amount = fee_flat + (amount * fee_percent / 100)`.
   - `net_amount = amount - fee_amount`, minimal 0.
6. **Status finansial terpisah dari status order.**
   - Payment `paid` tidak otomatis menyelesaikan order.
   - Perubahan status order tetap melalui API MKT-05.
7. **Settlement berbasis item dan tidak tumpang tindih.**
   - Pembayaran yang sudah masuk `settlement_items` tidak diambil settlement
     lain.
   - Settlement `cancelled` menghapus item sehingga pembayaran dapat
     disettlekan ulang.
8. **Rekonsiliasi hanya untuk platform admin.**
   - Endpoint rekonsiliasi memakai permission `payment:manage`.
   - Hasil disimpan sebagai snapshot JSONB `details` berisi payment dan baris
     eksternal yang dibandingkan.
9. **Nilai uang memakai `numeric(16,2)`.**
   - API mengembalikan nilai uang sebagai string desimal agar presisi tidak
     hilang saat melewati JavaScript.

---

## 2. ERD Ringkas

```text
core.merchants 1 --- N payment.merchant_payment_accounts
core.merchants 1 --- N payment.payments
core.merchants 1 --- N payment.refunds
core.merchants 1 --- N payment.settlements
core.users     1 --- N payment.payments
core.users     1 --- N payment.refunds

commerce.orders 1 --- 1 payment.payments
commerce.orders 1 --- N payment.refunds
commerce.returns 1 --- N payment.refunds

payment.payment_providers 1 --- N payment.payment_methods
payment.payment_providers 1 --- N payment.payments
payment.payment_providers 1 --- N payment.reconciliations

payment.payments 1 --- N payment.payment_attempts
payment.payments 1 --- N payment.payment_events
payment.payments 1 --- N payment.refunds
payment.payments 1 --- N payment.settlement_items

payment.settlements 1 --- N payment.settlement_items
```

---

## 3. Tabel

### 3.1 `payment_providers`

Master provider/gateway pembayaran.

Kolom utama: `id`, `code` (unik), `name`, `type`, `status`, `description`,
`logo_url`, `config`, `sort_order`, `created_at`, `updated_at`.

Enum `payment_provider_type`: `gateway`, `bank`, `ewallet`, `qris`, `manual`,
`other`.

### 3.2 `payment_methods`

Metode pembayaran yang ditawarkan provider.

Kolom utama: `id`, `provider_id`, `code`, `name`, `type`, `status`,
`description`, `fee_flat`, `fee_percent`, `minimum_amount`,
`maximum_amount`, `instructions`, `config`, `sort_order`.

Unique index `(provider_id, code)` mencegah kode metode ganda dalam satu
provider.

Enum `payment_method_type`: `qris`, `ewallet`, `bank_transfer`,
`virtual_account`, `credit_card`, `cash`, `other`.

### 3.3 `merchant_payment_accounts`

Akun pencairan/settlement milik merchant.

Kolom utama: `id`, `merchant_id`, `provider_id`, `account_name`,
`account_number`, `bank_name`, `status`, `is_default`, `metadata`.

Hanya boleh ada satu akun default aktif per merchant. Akun default dipilih
otomatis saat settlement jika `account_id` tidak dikirim.

Enum `merchant_payment_account_status`: `pending_verification`, `active`,
`inactive`.

### 3.4 `payments`

Payment intent utama per order.

Kolom utama:

- Identitas: `id`, `payment_number` (unik), `order_id` (unik), `merchant_id`,
  `user_id`, `provider_id`, `method_id`.
- Status: `status`, `currency`, `external_reference`, `checkout_url`.
- Nominal: `amount`, `fee_amount`, `net_amount`, `amount_paid`,
  `amount_refunded`.
- Waktu: `expires_at`, `paid_at`, `failed_at`, `cancelled_at`, `expired_at`.
- Tambahan: `failure_reason`, `metadata`, `created_by`.

Enum `payment_status`: `pending`, `authorized`, `paid`, `failed`, `expired`,
`cancelled`, `partially_refunded`, `refunded`.

### 3.5 `payment_attempts`

Percobaan pembayaran ke provider.

Kolom utama: `id`, `payment_id`, `attempt_number`, `status`,
`provider_reference`, `request_payload`, `response_payload`, `failure_code`,
`failure_message`, `expires_at`, `processed_at`.

Unique index `(payment_id, attempt_number)` menjaga urutan percobaan.

Enum `payment_attempt_status`: `created`, `pending`, `succeeded`, `failed`,
`expired`, `cancelled`.

### 3.6 `payment_events`

Timeline event pembayaran untuk audit dan UI detail.

Kolom utama: `id`, `payment_id`, `attempt_id`, `event_type`, `source`,
`external_reference`, `payload`, `note`, `created_by`, `created_at`.

Enum `payment_event_type`: `created`, `authorized`, `paid`, `failed`,
`expired`, `cancelled`, `refund`, `settlement`, `callback`, `other`.

### 3.7 `refunds`

Permintaan pengembalian dana untuk payment lunas.

Kolom utama:

- Relasi: `payment_id`, `order_id`, `return_id` (opsional), `merchant_id`,
  `user_id`.
- Status: `status`, `amount`, `reason`, `external_reference`,
  `failure_reason`.
- Aktor: `requested_by`, `reviewed_by`, `processed_by`.
- Waktu: `requested_at`, `approved_at`, `processed_at`, `completed_at`,
  `rejected_at`, `cancelled_at`.

Enum `refund_status`: `requested`, `approved`, `processing`, `completed`,
`rejected`, `cancelled`, `failed`.

### 3.8 `settlements`

Settlement pembayaran merchant pada periode tertentu.

Kolom utama: `id`, `settlement_number` (unik), `merchant_id`, `account_id`,
`status`, `currency`, `period_start`, `period_end`, `gross_amount`,
`fee_amount`, `refund_amount`, `net_amount`, `payment_count`, `notes`,
`generated_by`, `processed_at`, `completed_at`, `cancelled_at`.

Enum `settlement_status`: `draft`, `pending`, `processing`, `completed`,
`cancelled`.

### 3.9 `settlement_items`

Rincian pembayaran dalam settlement.

Kolom utama: `id`, `settlement_id`, `payment_id`, `amount`, `fee_amount`,
`refund_amount`, `net_amount`.

Unique index `payment_id` mencegah satu pembayaran masuk lebih dari satu
settlement.

### 3.10 `reconciliations`

Snapshot rekonsiliasi pembayaran internal dengan laporan provider.

Kolom utama: `id`, `reconciliation_number` (unik), `provider_id`, `status`,
`currency`, `period_start`, `period_end`, `internal_amount`,
`external_amount`, `difference_amount`, `matched_count`, `unmatched_count`,
`details`, `notes`, `reconciled_by`, `completed_at`.

`details` berisi `payments` (payment internal yang dibandingkan) dan `lines`
(baris eksternal yang dikirim).

Enum `reconciliation_status`: `draft`, `completed`, `discrepancy`, `failed`.

---

## 4. Enum

| Enum | Nilai |
| --- | --- |
| `payment_provider_type` | `gateway`, `bank`, `ewallet`, `qris`, `manual`, `other` |
| `payment_provider_status` | `active`, `inactive` |
| `payment_method_type` | `qris`, `ewallet`, `bank_transfer`, `virtual_account`, `credit_card`, `cash`, `other` |
| `payment_method_status` | `active`, `inactive` |
| `payment_status` | `pending`, `authorized`, `paid`, `failed`, `expired`, `cancelled`, `partially_refunded`, `refunded` |
| `payment_attempt_status` | `created`, `pending`, `succeeded`, `failed`, `expired`, `cancelled` |
| `payment_event_type` | `created`, `authorized`, `paid`, `failed`, `expired`, `cancelled`, `refund`, `settlement`, `callback`, `other` |
| `merchant_payment_account_status` | `pending_verification`, `active`, `inactive` |
| `refund_status` | `requested`, `approved`, `processing`, `completed`, `rejected`, `cancelled`, `failed` |
| `settlement_status` | `draft`, `pending`, `processing`, `completed`, `cancelled` |
| `reconciliation_status` | `draft`, `completed`, `discrepancy`, `failed` |

---

## 5. Otorisasi & Scoping

Permission MKT-06:

- `payment:read` - lihat payment, refund, settlement, provider, metode, akun.
- `payment:write` - buat payment/refund/settlement dan ubah status payment.
- `payment:manage` - kelola provider/metode dan jalankan rekonsiliasi.

Role hasil seed:

- `platform_admin` - wildcard `*`.
- `market_admin` - `payment:read`.
- `member` - `payment:read` dan `payment:write`.

Scoping data:

- Platform admin melihat seluruh data.
- Merchant member melihat payment/refund/settlement milik merchant yang boleh
  diakses (owner, organisasi, atau anggota merchant).
- Customer melihat payment miliknya sendiri.
- Customer **tidak** dapat membuat refund, settlement, provider, metode, atau
  rekonsiliasi.
- Customer hanya dapat membatalkan refund miliknya yang masih `requested`.
- Rekonsiliasi hanya dapat diakses melalui `payment:manage`.

---

## 6. API

Base: `/api/v1/payments`

| Method | Path | Permission | Keterangan |
| --- | --- | --- | --- |
| GET | `/providers` | `payment:read` | List provider |
| POST | `/providers` | `payment:manage` | Buat provider |
| PATCH | `/providers/:providerId` | `payment:manage` | Update provider |
| GET | `/methods` | `payment:read` | List metode |
| POST | `/methods` | `payment:manage` | Buat metode |
| PATCH | `/methods/:methodId` | `payment:manage` | Update metode |
| GET | `/accounts` | `payment:read` | List akun pencairan |
| POST | `/accounts` | `payment:write` | Buat akun pencairan |
| PATCH | `/accounts/:accountId` | `payment:write` | Update akun pencairan |
| GET | `/` | `payment:read` | List payment sesuai akses |
| POST | `/orders/:orderId` | `payment:write` | Buat / ulangi payment intent |
| GET | `/:paymentId` | `payment:read` | Detail payment, attempt, event, refund |
| POST | `/:paymentId/retry` | `payment:write` | Buat attempt baru |
| POST | `/:paymentId/confirm` | `payment:write` | Konfirmasi lunas/gagal/kedaluwarsa |
| POST | `/:paymentId/cancel` | `payment:write` | Batalkan payment belum lunas |
| GET | `/refunds` | `payment:read` | List refund |
| GET | `/refunds/:refundId` | `payment:read` | Detail refund |
| POST | `/:paymentId/refunds` | `payment:write` | Ajukan refund |
| PATCH | `/refunds/:refundId/status` | `payment:write` | Ubah status refund |
| GET | `/settlements` | `payment:read` | List settlement |
| GET | `/settlements/:settlementId` | `payment:read` | Detail settlement |
| POST | `/settlements` | `payment:write` | Buat settlement |
| PATCH | `/settlements/:settlementId/status` | `payment:write` | Ubah status settlement |
| GET | `/reconciliations` | `payment:manage` | List rekonsiliasi |
| GET | `/reconciliations/:reconciliationId` | `payment:manage` | Detail rekonsiliasi |
| POST | `/reconciliations` | `payment:manage` | Jalankan rekonsiliasi |

Contoh membuat payment:

```http
POST /api/v1/payments/orders/<ORDER_ID>
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "methodId": "<METHOD_ID>",
  "expiresInMinutes": 60
}
```

Contoh konfirmasi simulasi:

```http
POST /api/v1/payments/<PAYMENT_ID>/confirm
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "status": "succeeded",
  "note": "Pembayaran diterima"
}
```

---

## 7. Integritas & Transisi Status

### Payment

- Pembuatan payment hanya untuk order yang tidak `cancelled`/`returned`.
- Nominal payment harus sama dengan total order.
- Payment baru berstatus `pending`; attempt pertama berstatus `pending`.
- `confirm` dapat mengubah attempt aktif menjadi:
  - `succeeded` -> payment `paid`, `amount_paid = amount`;
  - `failed` -> payment `failed`;
  - `expired` -> payment `expired`.
- Hanya payment `pending`/`authorized` yang dapat dibatalkan.
- Retry diizinkan untuk payment yang belum lunas; status kembali `pending`.

### Refund

Transisi yang diizinkan:

```text
requested -> approved | rejected | cancelled
approved  -> processing | cancelled
processing -> completed | failed
failed    -> processing | cancelled
```

- Refund hanya untuk payment `paid`/`partially_refunded`.
- Total refund aktif + refund selesai tidak boleh melebihi nominal payment.
- Refund `completed` menambah `payments.amount_refunded` dan mengubah status
  payment menjadi `partially_refunded` atau `refunded`.
- Refund dapat dikaitkan dengan retur MKT-05 yang berstatus `completed`.

### Settlement

Transisi yang diizinkan:

```text
draft      -> pending | cancelled
pending    -> processing | cancelled
processing -> completed | cancelled
```

- Settlement mengambil payment `paid`/`partially_refunded`/`refunded` pada
  periode `paid_at` yang belum masuk settlement lain.
- `net_amount` per item = `amount - fee_amount - refund_amount` (minimal 0).
- Membatalkan settlement menghapus `settlement_items` agar payment dapat
  disettlekan kembali.

### Rekonsiliasi

- Payment internal diambil berdasarkan provider dan periode `paid_at`.
- Jika `lines` dikirim, setiap payment dicocokkan berdasarkan
  `external_reference` dan nominal.
- Tanpa `lines`, seluruh payment internal dianggap cocok.
- Status `completed` bila selisih nominal < 0,01 dan tidak ada payment
  `unmatched`; selain itu `discrepancy`.

---

## 8. UI Admin Pembayaran

Menu **Pembayaran** pada dashboard admin menampilkan:

- Tabel pembayaran dengan pencarian dan filter status.
- Aksi detail, konfirmasi lunas, batalkan, retry, dan buat refund.
- Tabel refund dengan detail dan aksi transisi status.
- Tabel settlement dengan detail item dan aksi status.
- Rekonsiliasi provider (platform admin).
- Tabel metode pembayaran, tombol tambah provider/metode, dan toggle status.

Modal detail payment memuat ringkasan, percobaan pembayaran, timeline event,
dan refund terkait.

---

## 9. Verifikasi

Pemeriksaan yang digunakan saat implementasi:

- `bun run typecheck`
- `node --check public/assets/admin.js`
- Smoke test API MKT-06 (payment, refund, settlement, rekonsiliasi)
- Smoke test akses customer (scoping, 403 untuk refund/rekonsiliasi)
- Smoke test UI headless (nav, tabel, modal, form pembayaran)

Data uji dibersihkan setelah verifikasi. Provider `simulator` dan lima metode
seed dipertahankan agar lingkungan lokal langsung dapat dipakai.
