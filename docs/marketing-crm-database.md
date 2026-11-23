# Database Pemasaran & CRM (MKT-12 / MKT-13)

Dokumen ini menjelaskan desain schema PostgreSQL `marketing` untuk modul
**MKT-12 Digital Marketing & Promotion** dan **MKT-13 Customer Relationship
Management**. Seluruh tabel operasional dimiliki oleh satu merchant agar
scoping akses konsisten dengan modul commerce, pembayaran, POS, inventori, dan
rantai pasok.

- Schema: `marketing`
- Migration: `drizzle/0008_*.sql`
- Definisi Drizzle: `src/db/schema/marketing.ts`
- Total tabel: **18**
- Total enum: **25**

---

## 1. Prinsip Desain

1. **Merchant-scoped** — setiap entitas utama menyimpan `merchant_id` dan
   diakses melalui `assertMerchantAccess` / `marketingScopeCondition`.
2. **Integrasi commerce** — kupon dapat dipakai pada `commerce.orders`,
   sedangkan riwayat order pelanggan diturunkan dari `commerce.orders` melalui
   `user_id`, `contact_email`, atau `contact_phone`.
3. **Audit-ready** — aksi penting menulis `governance.audit_logs` dengan aksi
   berawalan `marketing.*` atau `crm.*`.
4. **Soft delete pelanggan** — pelanggan memakai `deleted_at`; data historis
   loyalty, interaksi, dan keluhan tetap dipertahankan.
5. **Uang memakai `numeric(16,2)`** — tidak memakai floating point.
6. **Metrik kampanye terpisah dari master kampanye** — `campaign_performance`
   menyimpan data harian per channel sehingga bisa di-upsert.

---

## 2. Enum

### MKT-12

| Enum | Nilai |
| --- | --- |
| `campaign_objective` | `awareness`, `acquisition`, `retention`, `engagement` |
| `campaign_status` | `draft`, `scheduled`, `active`, `paused`, `completed`, `cancelled` |
| `campaign_channel_type` | `storefront`, `marketplace`, `social`, `email`, `whatsapp`, `pos`, `offline`, `other` |
| `promotion_type` | `percentage`, `fixed_amount`, `free_shipping`, `bundle`, `buy_x_get_y` |
| `promotion_status` | `draft`, `scheduled`, `active`, `paused`, `expired`, `cancelled` |
| `discount_rule_type` | `percentage`, `fixed_amount`, `free_shipping`, `buy_x_get_y` |
| `discount_rule_target` | `order`, `product`, `category`, `shipping` |
| `coupon_discount_type` | `percentage`, `fixed_amount`, `free_shipping` |
| `coupon_status` | `active`, `inactive`, `expired`, `exhausted` |
| `coupon_redemption_status` | `applied`, `redeemed`, `cancelled` |
| `advertisement_type` | `banner`, `sponsored_product`, `social_post`, `email`, `other` |
| `advertisement_status` | `draft`, `scheduled`, `active`, `paused`, `completed`, `cancelled` |

### MKT-13

| Enum | Nilai |
| --- | --- |
| `customer_status` | `active`, `inactive`, `blocked` |
| `customer_source` | `storefront`, `pos`, `manual`, `import`, `marketplace`, `other` |
| `customer_group_status` | `active`, `inactive` |
| `customer_segment_type` | `manual`, `dynamic` |
| `customer_segment_status` | `active`, `inactive` |
| `loyalty_tier` | `bronze`, `silver`, `gold`, `platinum` |
| `loyalty_account_status` | `active`, `suspended`, `closed` |
| `loyalty_transaction_type` | `earn`, `redeem`, `adjustment`, `expire`, `bonus` |
| `customer_interaction_type` | `note`, `call`, `email`, `whatsapp`, `meeting`, `complaint`, `follow_up` |
| `customer_interaction_direction` | `inbound`, `outbound`, `internal` |
| `customer_interaction_status` | `open`, `completed`, `cancelled` |
| `complaint_priority` | `low`, `normal`, `high`, `urgent` |
| `complaint_status` | `open`, `in_progress`, `resolved`, `rejected`, `closed` |

---

## 3. Tabel MKT-12

### 3.1 `marketing_campaigns`

Master kampanye pemasaran.

Kolom penting: `id`, `merchant_id`, `code`, `name`, `description`,
`objective`, `status`, `starts_at`, `ends_at`, `budget`, `spent`,
`target_revenue`, `target_audience`, `notes`, `created_by`, timestamps.

Index/constraint:

- `marketing_campaigns_code_uq` unik pada (`merchant_id`, `code`)
- index pada merchant, status, dan rentang tanggal
- FK merchant `cascade`, FK user `set null`

Lifecycle: `draft → scheduled → active → paused → active → completed`, dengan
`cancelled` sebagai status terminal. Transisi dipusatkan di
`setCampaignStatus()` pada `src/routes/marketing/campaigns.ts`.

### 3.2 `campaign_channels`

Channel pelaksanaan kampanye (storefront, marketplace, social, email, dst.).

Kolom: `merchant_id`, `campaign_id`, `channel_type`, `name`, `budget`, `spent`,
`target_conversions`, `metadata`.

Constraint unik (`campaign_id`, `channel_type`) mencegah duplikasi channel
dalam satu kampanye.

### 3.3 `campaign_performance`

Metrik harian per kampanye dan opsional per channel.

Kolom: `date`, `impressions`, `clicks`, `conversions`, `spend`, `revenue`,
`orders`, `new_customers`, `metrics` (JSONB).

Endpoint `POST /campaigns/:id/performance` melakukan upsert berdasarkan
kampanye, channel, dan tanggal.

### 3.4 `promotions`

Master promosi merchant, opsional terhubung ke kampanye.

Kolom penting: `type`, `status`, `starts_at`, `ends_at`, `priority`,
`stackable`, `min_purchase`, `max_discount`, `usage_limit`, `used_count`,
`per_customer_limit`.

### 3.5 `discount_rules`

Aturan diskon milik promosi.

Kolom: `rule_type`, `target_type`, `threshold_amount`,
`threshold_quantity`, `discount_value`, `max_discount`, `config` (JSONB),
`sort_order`, `is_active`.

### 3.6 `coupons`

Kupon dengan kode unik per merchant.

Kolom: `promotion_id`, `code`, `status`, `discount_type`, `discount_value`,
`min_purchase`, `max_discount`, `usage_limit`, `used_count`,
`per_customer_limit`, rentang berlaku.

Validasi dan redeem berada di `src/routes/marketing/promotions.ts`.
Redeem menghitung ulang `commerce.orders.discount_total` dan
`grand_total`.

### 3.7 `coupon_redemptions`

Riwayat pemakaian kupon.

Kolom: `coupon_id`, `order_id`, `customer_id`, `user_id`, `code`,
`discount_amount`, `status`, `redeemed_at`, `cancelled_at`, `notes`.

Constraint unik (`coupon_id`, `order_id`) mencegah satu kupon dipakai dua kali
pada order yang sama. Pembatalan redemption mengembalikan kuota kupon dan total
order.

### 3.8 `advertisements`

Iklan berbayar, opsional terhubung ke kampanye.

Kolom: `campaign_id`, `name`, `type`, `status`, `placement`, `creative_url`,
`target_url`, rentang tanggal, `budget`, `spent`, `impressions`, `clicks`,
`conversions`, `revenue`, `notes`.

---

## 4. Tabel MKT-13

### 4.1 `customers`

Profil pelanggan merchant.

Kolom penting: `user_id` (opsional, tautan ke `core.users`), `code`, `name`,
`email`, `phone`, `status`, `source`, `birth_date`, `gender`, `tags` (JSONB),
`notes`, `total_orders`, `total_spent`, `last_order_at`, `joined_at`,
`deleted_at`.

Constraint:

- `customers_code_uq` unik (`merchant_id`, `code`)
- `customers_merchant_user_uq` unik (`merchant_id`, `user_id`)

Metrik `total_orders`, `total_spent`, dan `last_order_at` dihitung ulang oleh
`POST /customers/:id/refresh-metrics` dari order commerce yang tidak
berstatus `cancelled`/`returned`.

### 4.2 `customer_profiles`

Profil tambahan 1:1 dengan pelanggan.

Kolom: `company_name`, `tax_number`, `address`, `city`, `province`,
`postal_code`, `country`, `avatar_url`, `preferences` (JSONB), `notes`.

### 4.3 `customer_groups`

Grup pelanggan dengan benefit diskon.

Kolom: `code`, `name`, `description`, `discount_percent`, `status`.

### 4.4 `customer_group_members`

Join table pelanggan–grup.

Constraint unik (`group_id`, `customer_id`). Anggota otomatis terhapus bila
grup atau pelanggan dihapus (`cascade`).

### 4.5 `customer_segments`

Segmen pelanggan manual atau dinamis.

Kolom: `code`, `name`, `description`, `type`, `criteria` (JSONB), `status`,
`member_count`.

Kriteria dinamis yang didukung saat ini:

```json
{
  "minTotalSpent": "1000000",
  "minTotalOrders": 2,
  "status": "active",
  "source": "storefront",
  "tags": ["vip"],
  "joinedAfter": "2026-01-01T00:00:00+07:00",
  "joinedBefore": "2026-12-31T23:59:59+07:00"
}
```

`POST /customer-segments/:id/refresh` menghapus anggota lama lalu mengisi ulang
anggota yang cocok dalam satu transaksi.

### 4.6 `customer_segment_members`

Join table pelanggan–segmen.

Constraint unik (`segment_id`, `customer_id`). Untuk segmen dinamis, perubahan
anggota hanya melalui refresh.

### 4.7 `loyalty_accounts`

Akun loyalty satu per pelanggan.

Kolom: `member_code`, `tier`, `points_balance`, `lifetime_points`,
`lifetime_spend`, `status`, `joined_at`, `last_activity_at`.

Constraint: satu akun per pelanggan (`loyalty_accounts_customer_uq`) dan
`member_code` unik per merchant.

### 4.8 `loyalty_transactions`

Ledger mutasi poin.

Kolom: `type`, `points`, `balance_before`, `balance_after`, `order_id`,
`reference`, `description`, `expires_at`, `created_by`.

Aturan:

- `earn`/`bonus` menyimpan poin positif.
- `redeem`/`expire` menyimpan poin negatif.
- `adjustment` menerima nilai bertanda.
- Saldo tidak boleh negatif.
- Saldo, lifetime points, tier, dan `last_activity_at` diperbarui secara
  transaksional dengan row lock (`SELECT ... FOR UPDATE`).

Tier dihitung dari lifetime points dan lifetime spend:

| Tier | Ambang |
| --- | --- |
| `silver` | 1.000 poin atau belanja Rp1.000.000 |
| `gold` | 2.500 poin atau belanja Rp5.000.000 |
| `platinum` | 5.000 poin atau belanja Rp10.000.000 |
| `bronze` | Di bawah ambang silver |

### 4.9 `customer_interactions`

Riwayat interaksi pelanggan.

Kolom: `type`, `direction`, `subject`, `content`, `status`, `scheduled_at`,
`completed_at`, `created_by`.

Status: `open → completed` atau `open → cancelled`.

### 4.10 `customer_complaints`

Keluhan pelanggan, opsional terhubung ke order.

Kolom: `complaint_number` (unik global), `category`, `subject`, `description`,
`priority`, `status`, `assigned_to`, `resolution`, `resolved_at`,
`closed_at`, `created_by`.

Lifecycle:

```
open → in_progress → resolved → closed
open/in_progress → rejected → closed
```

---

## 5. Relasi Utama

```text
core.merchants
  ├── marketing.marketing_campaigns
  │     ├── campaign_channels
  │     ├── campaign_performance
  │     ├── advertisements
  │     └── promotions
  │           ├── discount_rules
  │           └── coupons
  │                 └── coupon_redemptions ── commerce.orders
  ├── marketing.customers
  │     ├── customer_profiles (1:1)
  │     ├── customer_group_members ── customer_groups
  │     ├── customer_segment_members ── customer_segments
  │     ├── loyalty_accounts (1:1)
  │     │     └── loyalty_transactions
  │     ├── customer_interactions
  │     └── customer_complaints ── commerce.orders
```

`coupon_redemptions.customer_id`, `customers.user_id`, dan
`customer_complaints.order_id` sengaja tidak memakai FK ketat pada sebagian
relasi agar data historis tetap stabil ketika pelanggan di-soft-delete atau
order dihapus.

---

## 6. Integrasi dengan Modul Lain

| Modul | Integrasi |
| --- | --- |
| `core.users` | Tautan pelanggan ke akun pengguna commerce |
| `core.merchants` | Pemilik seluruh data pemasaran/CRM |
| `commerce.orders` | Riwayat order pelanggan, redeem kupon, kupon pada keluhan, order pada transaksi loyalty |
| `commerce.checkout_sessions` | Sumber konversi order yang dihitung pada metrik pelanggan |
| `governance.audit_logs` | Audit seluruh aksi `marketing.*` dan `crm.*` |

---

## 7. Index & Performa

- Semua tabel utama memiliki index `merchant_id`.
- Kolom status, tanggal, dan tipe yang sering difilter memiliki index.
- Pencarian pelanggan memakai index pada `email`, `phone`, dan `code`.
- Ledger loyalty memiliki index pada akun, pelanggan, tipe, dan merchant.
- Metrik kampanye memiliki index pada tanggal dan kampanye.

Rekomendasi lanjutan: tambahkan index trigram untuk pencarian nama pelanggan
bila volume data sudah besar.

---

## 8. Catatan Operasional

1. Jalankan `bun run db:generate` setelah mengubah schema.
2. Jalankan `bun run db:migrate` untuk menerapkan migration `0008`.
3. Jalankan `bun run db:seed` untuk menambahkan permission `marketing:*` dan
   `crm:*` ke role.
4. Gunakan endpoint `refresh-metrics` setelah impor/backfill order agar metrik
   pelanggan akurat.
5. Refresh segmen dinamis secara berkala atau setelah perubahan data pelanggan.
6. Jangan menghapus baris loyalty secara manual; gunakan status `closed` agar
   ledger tetap konsisten.
