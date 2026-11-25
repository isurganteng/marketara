# Database Tata Kelola & Keamanan (SYS-06)

Dokumen ini menjelaskan desain schema PostgreSQL untuk modul **SYS-06 Data
Governance & Security Management**. Seluruh tabel modul ini berada di schema
`governance`, yang sebelumnya hanya berisi `audit_logs`.

- Schema: `governance`
- Migration: `drizzle/0011_*.sql`
- Definisi Drizzle: `src/db/schema/core.ts` (`audit_logs`) dan
  `src/db/schema/governance.ts`
- Route: `src/routes/governance/`
- Total tabel: **8** (`audit_logs` + 7 tabel baru)
- Total enum: **15**

---

## 1. Prinsip Desain

1. **Klasifikasi sebagai pusat** - kebijakan akses, retensi, insiden, dan log
   akses merujuk `data_classifications` agar tingkat perlindungan konsisten.
2. **Consent eksplisit** - persetujuan pengguna menyimpan tipe, tujuan, versi,
   bukti, sumber, dan waktu pemberian/pencabutan.
3. **Audit menyeluruh** - `governance.audit_logs` mencatat seluruh aksi
   governance dengan aksi berawalan `governance.*`.
4. **Least privilege** - route dilindungi `governance:read`, `governance:write`,
   dan `governance:manage`; log audit tetap memakai `audit:read`.
5. **Dapat ditelusuri** - insiden dan permintaan privasi memiliki nomor unik,
   status lifecycle, penanggung jawab, serta waktu penyelesaian.
6. **Retensi terukur** - setiap kebijakan retensi menyimpan `retention_days`,
   tindakan akhir (`archive`/`delete`/`anonymize`/`review`), dan dasar hukum.
7. **Data minimization** - log akses menyimpan metadata secukupnya tanpa
   menyalin isi data sensitif.

---

## 2. Integrasi Modul

| Modul | Integrasi |
| --- | --- |
| `core.users` | Pemilik consent, aktor log akses, pelapor insiden, penanggung jawab permintaan |
| `core.organizations` | Consent tingkat organisasi |
| `governance.audit_logs` | Jejak audit seluruh aksi tata kelola |
| `platform.integration_logs` | Sumber investigasi insiden keamanan integrasi |
| `analytics` | Sumber data untuk pemantauan retensi dan akses |

---

## 3. Enum

| Enum | Nilai |
| --- | --- |
| `data_classification_level` | `public`, `internal`, `confidential`, `restricted` |
| `consent_type` | `marketing`, `analytics`, `data_sharing`, `profiling`, `terms`, `privacy_policy` |
| `consent_status` | `pending`, `granted`, `withdrawn`, `expired` |
| `access_policy_type` | `role_based`, `attribute_based`, `purpose_based`, `data_sharing` |
| `access_policy_effect` | `allow`, `deny` |
| `access_policy_status` | `draft`, `active`, `inactive` |
| `data_access_action` | `read`, `create`, `update`, `delete`, `export`, `share` |
| `data_access_status` | `granted`, `denied`, `error` |
| `retention_action` | `archive`, `delete`, `anonymize`, `review` |
| `retention_status` | `active`, `inactive` |
| `incident_severity` | `low`, `medium`, `high`, `critical` |
| `incident_category` | `data_breach`, `unauthorized_access`, `malware`, `phishing`, `denial_of_service`, `misconfiguration`, `other` |
| `incident_status` | `open`, `investigating`, `contained`, `resolved`, `closed` |
| `privacy_request_type` | `access`, `correction`, `deletion`, `portability`, `objection`, `restriction` |
| `privacy_request_status` | `submitted`, `verified`, `processing`, `completed`, `rejected`, `cancelled` |

---

## 4. Tabel

### 4.1 `governance.data_classifications`

Katalog tingkat perlindungan data.

Kolom penting: `id`, `code`, `name`, `description`, `category`,
`sensitivity_level`, `retention_days`, `handling_rules`, `is_active`,
`created_by`, timestamps. Kode unik.

### 4.2 `governance.data_consents`

Persetujuan penggunaan data pengguna atau organisasi.

Kolom penting: `id`, `user_id`, `organization_id`, `consent_type`, `purpose`,
`status`, `version`, `granted_at`, `withdrawn_at`, `expires_at`, `source`,
`evidence`, `ip_address`, timestamps.

### 4.3 `governance.data_access_policies`

Aturan izin/tolak akses data.

Kolom penting: `id`, `code`, `name`, `description`, `data_classification_id`,
`policy_type`, `effect`, `subject_type`, `subject_id`, `resource`, `actions`,
`conditions`, `priority`, `status`, `effective_from`, `effective_to`,
`created_by`, timestamps. Kode unik; prioritas menentukan urutan evaluasi.

### 4.4 `governance.data_access_logs`

Jejak akses data sensitif.

Kolom penting: `id`, `user_id`, `data_classification_id`, `resource_type`,
`resource_id`, `action`, `status`, `purpose`, `ip_address`, `user_agent`,
`metadata`, `created_at`. Terindeks per pengguna, sumber daya, dan waktu.

### 4.5 `governance.data_retention_policies`

Kebijakan umur simpan data.

Kolom penting: `id`, `code`, `name`, `description`, `entity_type`,
`data_classification_id`, `retention_days`, `action`, `legal_basis`, `status`,
`last_reviewed_at`, `reviewed_by`, `created_by`, timestamps. Kode unik.

### 4.6 `governance.security_incidents`

Insiden keamanan dan penanganannya.

Kolom penting: `id`, `incident_number`, `title`, `description`, `category`,
`severity`, `status`, `detected_at`, `occurred_at`, `resolved_at`,
`reported_by`, `assigned_to`, `data_classification_id`, `affected_systems`,
`affected_records`, `containment_actions`, `root_cause`, `remediation`,
`metadata`, timestamps. Nomor insiden unik.

### 4.7 `governance.privacy_requests`

Permintaan hak subjek data.

Kolom penting: `id`, `request_number`, `user_id`, `requester_name`,
`requester_email`, `request_type`, `status`, `description`, `response_notes`,
`received_at`, `due_at`, `completed_at`, `assigned_to`, `attachments`,
timestamps. Nomor permintaan unik.

### 4.8 `governance.audit_logs`

Jejak audit lintas modul (sudah ada sejak fondasi).

Kolom penting: `id`, `actor_user_id`, `action`, `entity_type`, `entity_id`,
`old_values`, `new_values`, `ip_address`, `user_agent`, `created_at`.

---

## 5. Permission & Role

| Permission | Cakupan |
| --- | --- |
| `governance:read` | Melihat klasifikasi, consent, kebijakan, log akses, retensi, insiden, permintaan privasi |
| `governance:write` | Membuat/mengubah aset tata kelola dan memproses insiden/permintaan |
| `governance:manage` | Menghapus aset tata kelola dan mengelola perlindungan data |
| `audit:read` | Melihat `governance.audit_logs` |

Role `platform_admin` memperoleh seluruh permission (`*`). Role `market_admin`
memperoleh `governance:read` dan `audit:read`. Role `member` tidak memperoleh
akses tata kelola.

---

## 6. Endpoint API

Base path: `/api/v1/governance`

| Method | Path | Permission | Keterangan |
| --- | --- | --- | --- |
| GET/POST | `/classifications` | `governance:read` / `governance:write` | Daftar / buat klasifikasi data |
| PATCH/DELETE | `/classifications/:id` | `governance:write` / `governance:manage` | Ubah / hapus klasifikasi |
| GET/POST | `/consents` | `governance:read` / `governance:write` | Daftar / catat consent |
| PATCH/DELETE | `/consents/:id` | `governance:write` / `governance:manage` | Ubah / hapus consent |
| POST | `/consents/:id/withdraw` | `governance:write` | Cabut consent |
| GET/POST | `/access-policies` | `governance:read` / `governance:write` | Daftar / buat kebijakan akses |
| PATCH/DELETE | `/access-policies/:id` | `governance:write` / `governance:manage` | Ubah / hapus kebijakan |
| GET/POST | `/access-logs` | `governance:read` / `governance:write` | Daftar / catat log akses |
| GET/POST | `/retention-policies` | `governance:read` / `governance:write` | Daftar / buat kebijakan retensi |
| PATCH/DELETE | `/retention-policies/:id` | `governance:write` / `governance:manage` | Ubah / hapus retensi |
| POST | `/retention-policies/:id/review` | `governance:write` | Tandai retensi telah ditinjau |
| GET/POST | `/incidents` | `governance:read` / `governance:write` | Daftar / catat insiden |
| PATCH/DELETE | `/incidents/:id` | `governance:write` / `governance:manage` | Ubah / hapus insiden |
| POST | `/incidents/:id/resolve` | `governance:write` | Selesaikan insiden |
| GET/POST | `/privacy-requests` | `governance:read` / `governance:write` | Daftar / catat permintaan privasi |
| PATCH/DELETE | `/privacy-requests/:id` | `governance:write` / `governance:manage` | Ubah / hapus permintaan |
| POST | `/privacy-requests/:id/complete` | `governance:write` | Selesaikan permintaan privasi |
