# Database Bisnis & Pendanaan (2MD)

Dokumen ini menjelaskan desain schema PostgreSQL untuk modul **2MD Business
Performance & Profile**, **2MD Proposal & Document**, **2MD Funding
Marketplace**, dan **2MD Financing & Risk**. Modul 2MD memakai dua schema:
`business` untuk kinerja/profil usaha dan `funding` untuk proposal,
marketplace, serta pembiayaan.

- Schema: `business` dan `funding`
- Migration: `drizzle/0009_*.sql`
- Definisi Drizzle: `src/db/schema/business.ts`, `src/db/schema/funding.ts`
- Route: `src/routes/business/`, `src/routes/funding/`
- Total tabel: **38** (`business` 13, `funding` 25)
- Total enum: **41** (`business` 13, `funding` 28)

---

## 1. Prinsip Desain

1. **Merchant-scoped** - data kinerja, profil, proposal, pengajuan, dan
   pembiayaan menyimpan `merchant_id` serta memakai `assertBusinessAccess`,
   `assertFundingAccess`, atau scope condition merchant.
2. **Ownership investor dan peluang** - peluang pendanaan memakai
   `owner_user_id` dan opsional `organization_id`. Profil investor memakai
   `user_id` dan opsional `organization_id`. Akses pengelolaan mengikuti
   platform admin atau membership organisasi.
3. **Uang memakai `numeric(18,2)` / `numeric(16,2)`** - tidak memakai floating
   point. Nilai uang dikembalikan API sebagai string desimal.
4. **Audit-ready** - aksi penting menulis `governance.audit_logs` dengan aksi
   berawalan `business.*` atau `funding.*`.
5. **Soft delete terbatas** - profil bisnis dan proposal memakai `deleted_at`
   agar data historis tetap dapat ditelusuri.
6. **Snapshot dan laporan terpisah dari master** - nilai KPI, growth snapshot,
   laporan performa, proyeksi keuangan, dan laporan monitoring menyimpan data
   periode agar dapat direproduksi.
7. **Status lifecycle eksplisit** - proposal, pengajuan, fasilitas, jadwal
   angsuran, dan penilaian risiko memakai enum status yang divalidasi Zod.

---

## 2. Integrasi Modul

| Modul | Integrasi |
| --- | --- |
| `core.merchants` | Pemilik seluruh data `business` dan mayoritas data `funding` |
| `core.users` | Pembuat, verifikator, pemilik peluang, dan profil investor |
| `core.organizations` | Pemilik peluang atau profil investor berbentuk organisasi |
| `commerce.orders` | Sumber agregasi laporan performa dan growth snapshot |
| `catalog.products` | Sumber jumlah produk pada laporan performa |
| `marketing` | Profil bisnis dan proposal dapat menjadi konteks promosi investor |
| `governance.audit_logs` | Jejak audit seluruh aksi 2MD |

---

## 3. Enum

### 3.1 Schema `business`

| Enum | Nilai |
| --- | --- |
| `business_profile_status` | `draft`, `active`, `verified`, `suspended`, `archived` |
| `business_legal_status` | `informal`, `micro`, `small`, `medium`, `cooperative`, `limited_company`, `other` |
| `business_location_type` | `headquarters`, `branch`, `store`, `warehouse`, `production`, `other` |
| `business_document_status` | `pending`, `verified`, `rejected`, `expired` |
| `business_verification_status` | `pending`, `in_review`, `verified`, `rejected` |
| `business_profile_share_status` | `active`, `revoked`, `expired` |
| `performance_period_type` | `daily`, `weekly`, `monthly`, `quarterly`, `yearly` |
| `performance_period_status` | `open`, `closed` |
| `kpi_category` | `revenue`, `transaction`, `customer`, `product`, `margin`, `growth`, `operational`, `other` |
| `kpi_value_type` | `currency`, `number`, `percentage`, `ratio` |
| `kpi_direction` | `higher_better`, `lower_better` |
| `performance_report_status` | `draft`, `published` |
| `business_target_status` | `active`, `achieved`, `missed`, `cancelled` |

### 3.2 Schema `funding`

| Enum | Nilai |
| --- | --- |
| `proposal_status` | `draft`, `in_review`, `submitted`, `published`, `funded`, `rejected`, `archived` |
| `proposal_version_status` | `draft`, `final`, `archived` |
| `business_plan_status` | `draft`, `approved`, `archived` |
| `financial_projection_type` | `revenue`, `expense`, `profit`, `cash_flow`, `other` |
| `funding_requirement_type` | `equity`, `debt`, `grant`, `working_capital`, `asset`, `other` |
| `fund_utilization_plan_status` | `planned`, `approved`, `in_progress`, `completed` |
| `funding_document_status` | `pending`, `verified`, `rejected`, `expired` |
| `data_room_status` | `draft`, `active`, `archived` |
| `data_room_access_status` | `granted`, `revoked`, `expired` |
| `funding_opportunity_status` | `draft`, `open`, `closed`, `archived` |
| `funding_instrument_type` | `equity`, `debt`, `grant`, `convertible_note`, `revenue_sharing`, `other` |
| `investor_type` | `individual`, `angel`, `venture_capital`, `private_equity`, `bank`, `cooperative`, `government`, `other` |
| `investor_status` | `active`, `inactive`, `suspended` |
| `funding_application_status` | `draft`, `submitted`, `under_review`, `shortlisted`, `approved`, `rejected`, `withdrawn`, `funded` |
| `funding_match_status` | `suggested`, `interested`, `accepted`, `declined`, `closed` |
| `investor_interest_status` | `new`, `reviewing`, `interested`, `declined`, `converted`, `withdrawn` |
| `referral_status` | `pending`, `contacted`, `converted`, `rejected` |
| `financing_type` | `loan`, `equity`, `grant`, `revenue_sharing`, `lease`, `other` |
| `financing_status` | `draft`, `active`, `disbursing`, `closed`, `defaulted`, `cancelled` |
| `financing_agreement_status` | `draft`, `signed`, `active`, `terminated` |
| `disbursement_status` | `pending`, `confirmed`, `failed`, `cancelled` |
| `repayment_status` | `scheduled`, `due`, `paid`, `overdue`, `waived`, `cancelled` |
| `repayment_transaction_status` | `pending`, `completed`, `failed`, `reversed` |
| `utilization_report_status` | `draft`, `submitted`, `approved`, `rejected` |
| `monitoring_status` | `draft`, `submitted`, `reviewed`, `flagged` |
| `risk_level` | `low`, `medium`, `high`, `critical` |
| `risk_indicator_type` | `financial`, `operational`, `market`, `compliance`, `repayment`, `other` |
| `risk_assessment_status` | `draft`, `final` |

---

## 4. Tabel 2MD-01 - Business Performance & Growth

### 4.1 `business.performance_periods`

Periode pengukuran kinerja merchant.

Kolom penting: `id`, `merchant_id`, `code`, `name`, `type`, `start_date`,
`end_date`, `status`, `notes`, `created_by`, timestamps.

Constraint unik (`merchant_id`, `code`). Index pada merchant, status, tipe, dan
rentang tanggal. Nilai KPI, growth snapshot, target, dan laporan performa
merujuk ke periode ini.

### 4.2 `business.business_kpis`

Master indikator kinerja merchant.

Kolom: `merchant_id`, `code`, `name`, `description`, `category`, `value_type`,
`unit`, `direction`, `formula`, `is_active`, `sort_order`, timestamps.

Constraint unik (`merchant_id`, `code`). KPI nonaktif tetap menyimpan riwayat
nilai.

### 4.3 `business.business_kpi_values`

Nilai KPI per periode.

Kolom: `merchant_id`, `kpi_id`, `period_id`, `value`, `target_value`,
`previous_value`, `achievement_percent`, `notes`, `metadata`, `calculated_at`.

Constraint unik (`merchant_id`, `kpi_id`, `period_id`). Endpoint POST melakukan
upsert agar satu KPI hanya punya satu nilai per periode.

### 4.4 `business.business_targets`

Target bisnis opsional terhubung ke periode dan KPI.

Kolom: `name`, `target_value`, `actual_value`, `unit`, `start_date`,
`end_date`, `status`, `notes`. Status awal `active`; status akhir `achieved`,
`missed`, atau `cancelled`.

### 4.5 `business.growth_snapshots`

Snapshot pertumbuhan metrik pada tanggal tertentu.

Kolom: `period_id`, `snapshot_date`, `metric_type`, `current_value`,
`previous_value`, `growth_percent`, `metadata`.

Endpoint generate laporan mengisi snapshot untuk metrik utama merchant.

### 4.6 `business.merchant_performance_reports`

Laporan performa merchant per periode.

Kolom: `report_number`, `title`, `revenue`, `order_count`, `customer_count`,
`product_count`, `gross_margin`, `growth_percent`, `score`, `status`,
`summary`, `data`, `generated_at`, `published_at`.

Endpoint `POST /reports/generate` menghitung metrik dari order, pelanggan, dan
produk merchant pada rentang periode, lalu menyimpan laporan `draft`.

---

## 5. Tabel 2MD-02 - Merchant Business Profile

### 5.1 `business.business_profiles`

Profil usaha merchant.

Kolom penting: `merchant_id`, `code`, `display_name`, `tagline`, `description`,
`legal_name`, `legal_status`, `business_type`, `founded_at`, `employee_count`,
`annual_revenue`, `website`, `email`, `phone`, `logo_url`, `cover_url`,
`address`, `city`, `province`, `postal_code`, `country`, `latitude`,
`longitude`, `status`, `verification_status`, `completeness`, `metadata`,
`published_at`, `deleted_at`.

Constraint unik (`merchant_id`, `code`). Kolom `completeness` dihitung dari
kelengkapan field profil. Soft delete memakai `deleted_at`.

### 5.2 `business.business_history`

Riwayat peristiwa usaha.

Kolom: `title`, `description`, `event_date`, `category`, `source`.

### 5.3 `business.business_locations`

Lokasi usaha: kantor pusat, cabang, toko, gudang, atau produksi.

Kolom: `name`, `type`, `address`, `city`, `province`, `postal_code`, `country`,
`latitude`, `longitude`, `phone`, `is_primary`, `is_active`, `opening_hours`.

### 5.4 `business.business_legal_documents`

Dokumen legalitas usaha.

Kolom: `document_type`, `document_number`, `title`, `issued_at`, `expires_at`,
`issuer`, `file_name`, `file_url`, `status`, `notes`.

### 5.5 `business.business_activity_records`

Catatan aktivitas operasional usaha.

Kolom: `activity_date`, `activity_type`, `title`, `description`, `amount`,
`metadata`.

### 5.6 `business.business_verifications`

Riwayat verifikasi profil.

Kolom: `status`, `checklist`, `notes`, `verified_by`, `verified_at`.

### 5.7 `business.business_profile_shares`

Berbagi profil dengan user atau email eksternal.

Kolom: `shared_with_user_id`, `shared_with_email`, `token_hash`, `permissions`,
`status`, `expires_at`, `last_accessed_at`, `revoked_at`.

Token share disimpan sebagai hash SHA-256. Revoke mengubah status menjadi
`revoked`.

---

## 6. Tabel 2MD-03 - Proposal & Document

### 6.1 `funding.business_proposals`

Master proposal pendanaan.

Kolom penting: `merchant_id`, `profile_id`, `code`, `title`, `summary`,
`status`, `current_version`, `target_amount`, `currency`, `valuation`,
`equity_offered`, `funding_type`, `submitted_at`, `published_at`, `expires_at`,
`deleted_at`.

Constraint unik (`merchant_id`, `code`). Lifecycle: `draft` -> `in_review` ->
`submitted` -> `published` -> `funded`, dengan `rejected` dan `archived`
sebagai status terminal.

### 6.2 `funding.proposal_versions`

Versi naskah proposal.

Kolom: `version`, `title`, `summary`, `content`, `change_notes`, `file_url`,
`status`, `created_by`.

### 6.3 `funding.business_plans`

Rencana bisnis proposal.

Kolom: `title`, `executive_summary`, `market_analysis`, `business_model`,
`strategy`, `team`, `milestones`, `status`.

### 6.4 `funding.financial_projections`

Proyeksi keuangan per periode.

Kolom: `projection_type`, `period_label`, `period_start`, `period_end`,
`amount`, `assumptions`, `sort_order`.

### 6.5 `funding.funding_requirements`

Kebutuhan pendanaan proposal.

Kolom: `requirement_type`, `purpose`, `amount`, `currency`, `min_amount`,
`max_amount`, `equity_percent`, `tenor_months`, `expected_return_percent`,
`notes`.

### 6.6 `funding.fund_utilization_plans`

Rencana penggunaan dana.

Kolom: `category`, `description`, `amount`, `percentage`, `timeline`, `status`,
`sort_order`.

### 6.7 `funding.business_documents`

Dokumen pendukung proposal.

Kolom: `profile_id`, `document_type`, `title`, `file_name`, `file_url`,
`version`, `status`, `is_confidential`, `expires_at`, `notes`.

### 6.8 `funding.data_rooms`

Ruang data virtual untuk investor.

Kolom: `proposal_id`, `name`, `description`, `status`, `access_level`.

Saat proposal diterbitkan, data room aktif otomatis.

### 6.9 `funding.data_room_access_logs`

Log akses data room.

Kolom: `data_room_id`, `user_id`, `email`, `action`, `status`, `expires_at`,
`revoked_at`, `accessed_at`.

---

## 7. Tabel 2MD-04 - Funding Marketplace

### 7.1 `funding.funding_opportunities`

Peluang pendanaan dari investor atau lembaga.

Kolom: `code`, `title`, `description`, `instrument_type`, `provider_name`,
`provider_type`, `min_amount`, `max_amount`, `currency`, `interest_rate`,
`equity_percent`, `tenor_months`, `eligibility`, `requirements`, `status`,
`opens_at`, `closes_at`, `owner_user_id`, `organization_id`.

Akses list: peluang `open` terlihat semua user; peluang lain hanya pemilik,
organisasi terkait, atau platform admin.

### 7.2 `funding.investor_profiles`

Profil investor.

Kolom: `user_id`, `organization_id`, `display_name`, `investor_type`, `status`,
`email`, `phone`, `website`, `description`, `investment_focus`, `min_ticket`,
`max_ticket`, `currency`, `preferred_stages`, `preferred_sectors`,
`verification_status`, `verified_at`, `verified_by`.

### 7.3 `funding.funding_applications`

Pengajuan pendanaan merchant ke peluang investor.

Kolom: `merchant_id`, `proposal_id`, `opportunity_id`, `investor_profile_id`,
`application_number`, `requested_amount`, `approved_amount`, `currency`,
`status`, `submitted_at`, `reviewed_at`, `reviewed_by`, `decision_notes`,
`metadata`.

### 7.4 `funding.funding_application_statuses`

Riwayat transisi status pengajuan.

Kolom: `application_id`, `merchant_id`, `from_status`, `to_status`, `note`,
`changed_by`.

### 7.5 `funding.funding_matches`

Kecocokan proposal/pengajuan dengan peluang atau investor.

Kolom: `merchant_id`, `application_id`, `opportunity_id`,
`investor_profile_id`, `score`, `status`, `notes`.

### 7.6 `funding.investor_interests`

Minat investor terhadap proposal atau pengajuan.

Kolom: `merchant_id`, `investor_profile_id`, `proposal_id`, `opportunity_id`,
`application_id`, `status`, `message`, `amount`.

### 7.7 `funding.funding_partner_referrals`

Referral mitra pendanaan.

Kolom: `merchant_id`, `application_id`, `opportunity_id`, `partner_name`,
`partner_type`, `contact_name`, `contact_email`, `contact_phone`, `status`,
`referral_code`, `notes`.

---

## 8. Tabel 2MD-05 - Financing & Risk

### 8.1 `funding.financing_records`

Fasilitas pembiayaan yang disetujui.

Kolom: `merchant_id`, `application_id`, `proposal_id`, `investor_profile_id`,
`facility_number`, `title`, `financing_type`, `principal_amount`, `currency`,
`interest_rate`, `equity_percent`, `tenor_months`, `status`, `start_date`,
`end_date`, `closed_at`, `notes`, `metadata`.

### 8.2 `funding.financing_agreements`

Perjanjian pembiayaan.

Kolom: `financing_id`, `agreement_number`, `title`, `signed_at`,
`effective_at`, `expires_at`, `file_url`, `status`, `terms`.

### 8.3 `funding.disbursement_records`

Pencairan dana.

Kolom: `financing_id`, `disbursement_number`, `amount`, `currency`, `status`,
`scheduled_at`, `disbursed_at`, `reference`, `notes`, `confirmed_by`.

### 8.4 `funding.repayment_schedules`

Jadwal angsuran.

Kolom: `financing_id`, `installment_number`, `due_date`, `principal_amount`,
`interest_amount`, `fee_amount`, `total_amount`, `paid_amount`, `status`,
`paid_at`.

Endpoint generate schedule membagi pokok dan bunga sesuai tenor.

### 8.5 `funding.repayment_transactions`

Transaksi pembayaran angsuran.

Kolom: `schedule_id`, `financing_id`, `merchant_id`, `amount`, `currency`,
`method`, `reference`, `status`, `paid_at`, `notes`, `recorded_by`.

Pembayaran memperbarui `paid_amount` dan status jadwal.

### 8.6 `funding.fund_utilization_reports`

Laporan penggunaan dana.

Kolom: `financing_id`, `report_number`, `period_start`, `period_end`,
`total_used`, `description`, `breakdown`, `status`, `notes`, `submitted_at`,
`reviewed_by`.

### 8.7 `funding.financing_monitoring_reports`

Laporan monitoring pembiayaan.

Kolom: `financing_id`, `report_number`, `period_start`, `period_end`,
`revenue`, `profit`, `cash_flow`, `repayment_capacity`, `risk_level`, `status`,
`findings`, `recommendation`.

### 8.8 `funding.risk_indicators`

Master indikator risiko merchant.

Kolom: `merchant_id`, `code`, `name`, `category`, `description`,
`threshold_low`, `threshold_medium`, `threshold_high`, `unit`, `direction`,
`is_active`.

### 8.9 `funding.risk_assessments`

Penilaian risiko merchant atau fasilitas.

Kolom: `merchant_id`, `financing_id`, `indicator_id`, `assessment_date`,
`score`, `risk_level`, `status`, `findings`, `mitigation`, `assessed_by`.

Endpoint `POST /risk-assessments/calculate` menghitung skor dari indikator
aktif dan menyimpan penilaian baru.

---

## 9. Matriks Akses

| Permission | Cakupan |
| --- | --- |
| `business:read` | Lihat periode, KPI, nilai, target, snapshot, laporan, profil, dan child profile |
| `business:write` | Buat/ubah data kinerja dan profil, verifikasi dokumen, buat share |
| `business:manage` | Hapus data, verifikasi profil, cabut share |
| `funding:read` | Lihat proposal, peluang, investor, pengajuan, match, minat, referral, pembiayaan, risiko |
| `funding:write` | Buat/ubah proposal, peluang, pengajuan, pembiayaan, laporan, penilaian |
| `funding:manage` | Hapus/arsip, verifikasi investor, tutup fasilitas, tandai gagal bayar |

Data merchant difilter dengan `merchant_id`. Peluang dan investor difilter
dengan ownership user/organisasi, kecuali platform admin.

---

## 10. Audit dan Lifecycle

Aksi yang menulis audit log antara lain:

- `business.profile.create`, `business.profile.verify`,
  `business.performance_report.generate`
- `funding.proposal.submit`, `funding.proposal.publish`,
  `funding.proposal.archive`
- `funding.application.submit`, `funding.application.<status>`
- `funding.financing.activate`, `funding.financing.close`,
  `funding.financing.default`
- `funding.disbursement.confirm`, `funding.repayment.pay`
- `funding.risk_assessment.create`, `funding.risk_assessment.calculate`

Lifecycle utama:

```text
Proposal: draft -> in_review -> submitted -> published -> funded
Pengajuan: draft -> submitted -> under_review -> shortlisted -> approved -> funded
Fasilitas: draft -> active -> disbursing -> closed
Risiko: draft -> final
```

---

## 11. Catatan Implementasi

1. Semua nominal dikembalikan sebagai string desimal agar presisi tetap terjaga.
2. Endpoint list memakai pagination `page`, `limit`, `search`, dan filter
   spesifik modul.
3. Nilai KPI dan growth snapshot memakai periode yang sama dengan merchant.
4. Proposal hanya dapat diajukan jika profil dan kebutuhan dana sudah diisi.
5. Pengajuan hanya dapat dibuat dari proposal berstatus `submitted` atau
   `published`.
6. Generate jadwal angsuran membutuhkan tanggal jatuh tempo pertama dan jumlah
   angsuran.
7. Migration `0009` membuat schema, tabel, enum, index, dan foreign key 2MD.
