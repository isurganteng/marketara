# Database Platform & Analitik (SYS-03/04/05/07/08)

Dokumen ini menjelaskan desain schema PostgreSQL untuk modul **SYS-03 API
Gateway & Integration**, **SYS-04 Notification**, **SYS-05 Configuration**,
**SYS-07 AI**, dan **SYS-08 Reporting & Data Warehouse**. Empat modul platform
memakai schema `platform`, sedangkan pelaporan dan data warehouse memakai schema
`analytics`.

- Schema: `platform` dan `analytics`
- Migration: `drizzle/0010_*.sql`
- Definisi Drizzle: `src/db/schema/integration.ts`, `notification.ts`,
  `config.ts`, `ai.ts`, `analytics.ts`
- Route: `src/routes/integrations/`, `notifications/`, `config/`, `ai/`,
  `analytics/`
- Total tabel: **37** (`integration` 9, `notification` 6, `config` 7, `ai` 8,
  `analytics` 7)
- Total enum: **42** (`integration` 11, `notification` 5, `config` 5, `ai` 10,
  `analytics` 11)

---

## 1. Prinsip Desain

1. **Pemisahan schema** - domain platform (integrasi, notifikasi, konfigurasi,
   AI) berada di schema `platform`; data analitik dan warehouse berada di schema
   `analytics`.
2. **Akses berbasis permission** - setiap route memakai `requireAuth` dan
   `requirePermission` dengan kode `integration:*`, `notification:*`,
   `config:*`, `ai:*`, atau `analytics:*`.
3. **Audit-ready** - aksi penting menulis `governance.audit_logs` dengan aksi
   berawalan modul, misalnya `integration.provider.create`,
   `notification.message.send`, atau `analytics.report.run`.
4. **Kredensial tidak disimpan mentah** - kunci API dan secret webhook disimpan
   sebagai hash (`key_hash`, `secret_hash`). Nilai pengaturan bertipe `secret`
   disamarkan pada respons API.
5. **Scope data pengguna** - sesi AI, rekomendasi, pesan notifikasi, preferensi,
   dan log pengiriman dibatasi untuk pengguna non-admin berdasarkan `user_id`
   atau penerima pesan.
6. **Status lifecycle eksplisit** - seluruh status memakai enum PostgreSQL yang
   divalidasi ulang oleh Zod pada route.
7. **Data warehouse dapat direproduksi** - eksekusi laporan dan snapshot
   historis menyimpan parameter serta hasil agar dapat ditelusuri ulang.

---

## 2. Integrasi Modul

| Modul | Integrasi |
| --- | --- |
| `core.organizations` | Pemilik koneksi integrasi, klien API, dan preferensi komunikasi |
| `core.users` | Pembuat koneksi, kunci API, pesan, sesi AI, dan snapshot |
| `core.merchants` | Konteks sesi AI, rekomendasi, dan forecast |
| `governance.audit_logs` | Jejak audit seluruh aksi platform dan analitik |
| `commerce`, `payment`, `pos` | Sumber data pipeline ETL dan laporan |
| `business`, `funding` | Konteks rekomendasi serta forecast |

---

## 3. Enum

### 3.1 Schema `platform` - Integrasi (SYS-03)

| Enum | Nilai |
| --- | --- |
| `integration_provider_type` | `marketplace`, `payment`, `logistics`, `government`, `messaging`, `analytics`, `erp`, `crm`, `other` |
| `integration_status` | `active`, `inactive`, `deprecated` |
| `integration_connection_status` | `pending`, `active`, `disabled`, `error` |
| `integration_environment` | `sandbox`, `production` |
| `api_client_status` | `active`, `suspended`, `revoked` |
| `api_key_status` | `active`, `expired`, `revoked` |
| `api_http_method` | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` |
| `webhook_subscription_status` | `active`, `paused`, `disabled` |
| `webhook_event_status` | `pending`, `processing`, `delivered`, `failed`, `dead_letter` |
| `integration_log_status` | `success`, `failed` |
| `data_mapping_direction` | `inbound`, `outbound`, `bidirectional` |

### 3.2 Schema `platform` - Notifikasi (SYS-04)

| Enum | Nilai |
| --- | --- |
| `notification_channel_type` | `email`, `sms`, `whatsapp`, `push`, `in_app`, `webhook` |
| `notification_template_status` | `draft`, `active`, `archived` |
| `notification_message_status` | `queued`, `scheduled`, `processing`, `sent`, `failed`, `cancelled` |
| `notification_recipient_status` | `pending`, `sent`, `delivered`, `failed`, `read` |
| `notification_delivery_status` | `queued`, `sent`, `delivered`, `failed`, `bounced` |

### 3.3 Schema `platform` - Konfigurasi (SYS-05)

| Enum | Nilai |
| --- | --- |
| `configuration_value_type` | `string`, `number`, `boolean`, `json`, `secret` |
| `configuration_scope` | `global`, `organization`, `merchant`, `user` |
| `configuration_status` | `active`, `archived` |
| `feature_flag_status` | `enabled`, `disabled`, `rollout` |
| `localization_status` | `active`, `inactive` |

### 3.4 Schema `platform` - AI (SYS-07)

| Enum | Nilai |
| --- | --- |
| `ai_model_type` | `chat`, `embedding`, `image`, `speech`, `recommendation`, `forecasting` |
| `ai_model_status` | `active`, `inactive`, `deprecated` |
| `ai_session_status` | `active`, `archived`, `closed` |
| `ai_message_role` | `system`, `user`, `assistant`, `tool` |
| `ai_request_status` | `queued`, `processing`, `completed`, `failed` |
| `ai_response_status` | `completed`, `failed`, `filtered` |
| `recommendation_type` | `product`, `funding`, `merchant`, `market`, `content` |
| `recommendation_status` | `generated`, `viewed`, `accepted`, `dismissed` |
| `forecast_type` | `sales`, `demand`, `revenue`, `cashflow`, `inventory` |
| `forecast_job_status` | `queued`, `running`, `completed`, `failed` |

### 3.5 Schema `analytics` (SYS-08)

| Enum | Nilai |
| --- | --- |
| `data_source_type` | `postgres`, `api`, `file`, `manual` |
| `data_source_status` | `active`, `inactive`, `error` |
| `etl_job_type` | `extract`, `transform`, `load`, `full`, `incremental` |
| `etl_job_status` | `scheduled`, `running`, `completed`, `failed`, `paused` |
| `data_load_status` | `success`, `failed`, `partial` |
| `data_mart_status` | `draft`, `active`, `archived` |
| `report_definition_status` | `draft`, `active`, `archived` |
| `report_run_status` | `queued`, `running`, `completed`, `failed` |
| `report_format` | `table`, `csv`, `json`, `pdf` |
| `refresh_mode` | `manual`, `scheduled` |
| `snapshot_status` | `active`, `archived` |

---

## 4. Tabel SYS-03 - API Gateway & Integration

### 4.1 `platform.integration_providers`

Katalog layanan eksternal (payment, logistik, pemerintah, dan lainnya).

Kolom penting: `id`, `code`, `name`, `type`, `description`, `base_url`,
`docs_url`, `status`, `config`, timestamps. Kode unik.

### 4.2 `platform.integration_connections`

Koneksi provider untuk organisasi tertentu.

Kolom penting: `id`, `provider_id`, `organization_id`, `code`, `name`,
`environment`, `status`, `credentials_encrypted`, `config`, `last_sync_at`,
`last_error`, `created_by`, timestamps. Unik pada (`provider_id`, `code`).

### 4.3 `platform.api_clients`

Klien API yang mengakses gateway platform.

Kolom penting: `id`, `organization_id`, `code`, `name`, `description`, `status`,
`rate_limit_per_minute`, `allowed_origins`, `created_by`, timestamps.

### 4.4 `platform.api_keys`

Kunci akses klien API. Nilai kunci hanya dikembalikan sekali saat dibuat.

Kolom penting: `id`, `client_id`, `name`, `key_prefix`, `key_hash`, `scopes`,
`status`, `last_used_at`, `expires_at`, `revoked_at`, `created_by`, timestamps.

### 4.5 `platform.api_endpoints`

Katalog endpoint gateway.

Kolom penting: `id`, `code`, `name`, `method`, `path`, `version`, `description`,
`is_public`, `is_active`, `rate_limit_per_minute`, timestamps.

### 4.6 `platform.webhook_subscriptions`

Langganan webhook milik klien API.

Kolom penting: `id`, `client_id`, `name`, `url`, `description`, `events`,
`secret_hash`, `status`, `failure_count`, `last_triggered_at`,
`last_success_at`, `created_by`, timestamps.

### 4.7 `platform.webhook_events`

Antrean event webhook beserta status pengiriman dan retry.

Kolom penting: `id`, `subscription_id`, `event_type`, `payload`, `status`,
`attempts`, `last_error`, `next_attempt_at`, `delivered_at`, `created_at`.

### 4.8 `platform.integration_logs`

Log pertukaran data masuk dan keluar.

Kolom penting: `id`, `provider_id`, `connection_id`, `direction`, `method`,
`path`, `status_code`, `request_body`, `response_body`, `status`, `duration_ms`,
`error_message`, `created_at`.

### 4.9 `platform.data_mapping_rules`

Aturan pemetaan data antar entitas sumber dan target.

Kolom penting: `id`, `provider_id`, `name`, `source_entity`, `target_entity`,
`direction`, `mapping`, `transform`, `is_active`, `priority`, timestamps.

---

## 5. Tabel SYS-04 - Notification

### 5.1 `platform.notification_channels`

Kanal pengiriman pesan (email, SMS, WhatsApp, push, in-app, webhook).

Kolom penting: `id`, `code`, `name`, `type`, `provider`, `description`, `config`,
`is_active`, `sort_order`, timestamps.

### 5.2 `platform.notification_templates`

Template pesan dengan versi dan locale.

Kolom penting: `id`, `code`, `name`, `channel_id`, `channel_type`, `category`,
`locale`, `subject`, `body`, `variables`, `status`, `version`, `created_by`,
timestamps.

### 5.3 `platform.notification_messages`

Pesan yang dikirim atau dijadwalkan.

Kolom penting: `id`, `message_number`, `template_id`, `channel_id`,
`channel_type`, `category`, `subject`, `body`, `payload`, `status`, `priority`,
`scheduled_at`, `sent_at`, `created_by`, timestamps.

### 5.4 `platform.notification_recipients`

Penerima pesan beserta status pengiriman per penerima.

Kolom penting: `id`, `message_id`, `user_id`, `name`, `email`, `phone`, `status`,
`error_message`, timestamps.

### 5.5 `platform.notification_delivery_logs`

Log percobaan pengiriman per penerima dan kanal.

Kolom penting: `id`, `message_id`, `recipient_id`, `channel_type`, `provider`,
`status`, `response`, `error_message`, `attempted_at`, `created_at`.

### 5.6 `platform.communication_preferences`

Preferensi komunikasi pengguna atau organisasi per kategori dan kanal.

Kolom penting: `id`, `user_id`, `organization_id`, `category`, `channel_type`,
`is_enabled`, `quiet_hours_start`, `quiet_hours_end`, `metadata`, timestamps.

---

## 6. Tabel SYS-05 - Configuration

### 6.1 `platform.configuration_groups`

Grup pengelompokan pengaturan.

Kolom penting: `id`, `code`, `name`, `description`, `sort_order`, `is_active`,
timestamps.

### 6.2 `platform.system_settings`

Pengaturan sistem dengan tipe nilai dan scope.

Kolom penting: `id`, `group_id`, `key`, `label`, `description`, `value_type`,
`value`, `default_value`, `scope`, `scope_id`, `is_secret`, `is_editable`,
`status`, `version`, `updated_by`, timestamps. Unik pada (`key`, `scope`,
`scope_id`).

### 6.3 `platform.reference_codes`

Induk data referensi.

Kolom penting: `id`, `code`, `name`, `description`, `is_system`, `is_active`,
timestamps.

### 6.4 `platform.reference_values`

Nilai untuk setiap kode referensi.

Kolom penting: `id`, `code_id`, `code`, `label`, `value`, `sort_order`,
`is_default`, `is_active`, `metadata`, timestamps. Unik pada (`code_id`, `code`).

### 6.5 `platform.feature_flags`

Kontrol aktivasi fitur dan rollout bertahap.

Kolom penting: `id`, `key`, `name`, `description`, `status`, `rollout_percentage`,
`audience`, `starts_at`, `ends_at`, `updated_by`, timestamps.

### 6.6 `platform.service_parameters`

Parameter operasional per layanan.

Kolom penting: `id`, `service`, `key`, `label`, `description`, `value_type`,
`value`, `is_secret`, `version`, `updated_by`, timestamps. Unik pada (`service`,
`key`).

### 6.7 `platform.localization_settings`

Pengaturan bahasa, mata uang, dan format.

Kolom penting: `id`, `locale`, `language`, `currency`, `timezone`, `date_format`,
`number_format`, `is_default`, `status`, `translations`, timestamps.

---

## 7. Tabel SYS-07 - AI

### 7.1 `platform.ai_models`

Katalog model AI.

Kolom penting: `id`, `code`, `name`, `provider`, `type`, `version`,
`description`, `capabilities`, `config`, `status`, `is_default`, timestamps.

### 7.2 `platform.ai_sessions`

Sesi percakapan atau interaksi AI.

Kolom penting: `id`, `session_key`, `user_id`, `merchant_id`, `model_id`,
`title`, `context_type`, `context_id`, `status`, `metadata`, `started_at`,
`ended_at`, timestamps.

### 7.3 `platform.ai_messages`

Pesan dalam sesi AI.

Kolom penting: `id`, `session_id`, `role`, `content`, `tokens`, `metadata`,
`created_at`.

### 7.4 `platform.ai_requests`

Permintaan pemrosesan AI.

Kolom penting: `id`, `request_number`, `session_id`, `model_id`, `user_id`,
`feature`, `prompt`, `parameters`, `status`, `latency_ms`, `error_message`,
`completed_at`, timestamps.

### 7.5 `platform.ai_responses`

Respons model terhadap permintaan.

Kolom penting: `id`, `request_id`, `content`, `finish_reason`,
`prompt_tokens`, `completion_tokens`, `total_tokens`, `status`, `safety`,
`created_at`.

### 7.6 `platform.recommendation_results`

Hasil rekomendasi personalisasi.

Kolom penting: `id`, `user_id`, `merchant_id`, `model_id`, `type`, `title`,
`summary`, `items`, `score`, `source`, `status`, `expires_at`, timestamps.

### 7.7 `platform.forecast_jobs`

Job proyeksi metrik bisnis.

Kolom penting: `id`, `job_number`, `type`, `merchant_id`, `data_source`,
`horizon_days`, `parameters`, `status`, `result`, `scheduled_at`, `started_at`,
`completed_at`, `requested_by`, timestamps.

### 7.8 `platform.ai_usage_logs`

Log penggunaan token dan biaya AI.

Kolom penting: `id`, `user_id`, `model_id`, `request_id`, `feature`,
`prompt_tokens`, `completion_tokens`, `total_tokens`, `cost`, `status`,
`created_at`.

---

## 8. Tabel SYS-08 - Reporting & Data Warehouse

### 8.1 `analytics.data_sources`

Sumber data pipeline analitik.

Kolom penting: `id`, `code`, `name`, `type`, `description`, `connection_config`,
`status`, `last_checked_at`, `created_by`, timestamps.

### 8.2 `analytics.etl_jobs`

Definisi job ekstraksi, transformasi, dan pemuatan data.

Kolom penting: `id`, `code`, `name`, `data_source_id`, `type`, `schedule`,
`source_query`, `target_table`, `status`, `last_run_at`, `next_run_at`,
`created_by`, timestamps.

### 8.3 `analytics.data_load_logs`

Riwayat eksekusi job ETL.

Kolom penting: `id`, `job_id`, `status`, `rows_read`, `rows_loaded`,
`rows_failed`, `started_at`, `finished_at`, `error_message`, `details`,
`created_at`.

### 8.4 `analytics.data_marts`

Tabel ringkas siap analisis.

Kolom penting: `id`, `code`, `name`, `description`, `schema_name`, `table_name`,
`status`, `refresh_mode`, `definition`, `last_refreshed_at`, timestamps.

### 8.5 `analytics.report_definitions`

Definisi laporan yang dapat dijalankan.

Kolom penting: `id`, `code`, `name`, `description`, `data_mart_id`, `category`,
`query`, `parameters`, `format`, `status`, `version`, `created_by`, timestamps.

### 8.6 `analytics.report_runs`

Riwayat eksekusi laporan beserta hasil.

Kolom penting: `id`, `report_id`, `run_number`, `requested_by`, `parameters`,
`status`, `started_at`, `completed_at`, `row_count`, `result`, `output_url`,
`error_message`, `created_at`.

### 8.7 `analytics.historical_snapshots`

Snapshot kondisi data historis.

Kolom penting: `id`, `snapshot_key`, `name`, `entity_type`, `entity_id`,
`snapshot_date`, `data`, `row_count`, `status`, `created_at`. Unik pada
(`snapshot_key`, `snapshot_date`).

---

## 9. Permission & Role

Permission baru yang di-seed:

| Permission | Cakupan |
| --- | --- |
| `integration:read` | Melihat provider, koneksi, klien, endpoint, webhook, dan log |
| `integration:write` | Membuat/mengubah integrasi, klien API, endpoint, webhook |
| `integration:manage` | Menghapus integrasi dan mengelola kredensial |
| `notification:read` | Melihat template, pesan, log, dan preferensi |
| `notification:write` | Membuat template, pesan, dan preferensi |
| `notification:manage` | Menghapus aset notifikasi dan pengaturan komunikasi |
| `config:read` | Melihat pengaturan, referensi, dan feature flag |
| `config:write` | Membuat/mengubah konfigurasi platform |
| `config:manage` | Menghapus konfigurasi dan parameter platform |
| `ai:read` | Melihat model, sesi, rekomendasi, forecast, dan penggunaan |
| `ai:write` | Menggunakan layanan AI dan membuat sesi/request/forecast |
| `ai:manage` | Mengelola model dan menghapus rekaman AI |
| `analytics:read` | Melihat sumber data, ETL, data mart, laporan, snapshot |
| `analytics:write` | Menjalankan ETL, refresh data mart, dan eksekusi laporan |
| `analytics:manage` | Mengelola aset warehouse dan menghapus rekaman analitik |

Role `admin` dan `platform_admin` memperoleh seluruh permission di atas; role
`operator` memperoleh akses baca (`*:read`) untuk modul platform dan analitik.

---

## 10. Endpoint API

| Modul | Base path | Endpoint utama |
| --- | --- | --- |
| Integrasi | `/api/v1/integrations` | `providers`, `connections`, `clients`, `clients/:id/keys`, `keys/:id/revoke`, `endpoints`, `webhooks`, `webhook-events`, `webhook-events/:id/retry`, `logs`, `mapping-rules` |
| Notifikasi | `/api/v1/notifications` | `channels`, `templates`, `templates/:id/activate`, `messages`, `messages/:id/send`, `messages/:id/cancel`, `recipients`, `delivery-logs`, `preferences` |
| Konfigurasi | `/api/v1/config` | `groups`, `settings`, `settings/bulk`, `reference-codes`, `reference-codes/:id/values`, `reference-values`, `feature-flags`, `feature-flags/:id/toggle`, `service-parameters`, `localization`, `localization/:id/default` |
| AI | `/api/v1/ai` | `models`, `sessions`, `sessions/:id/messages`, `requests`, `requests/:id/complete`, `responses`, `recommendations`, `forecast-jobs`, `forecast-jobs/:id/run`, `usage-logs` |
| Analitik | `/api/v1/analytics` | `data-sources`, `etl-jobs`, `etl-jobs/:id/run`, `load-logs`, `data-marts`, `data-marts/:id/refresh`, `reports`, `reports/:id/run`, `report-runs`, `snapshots` |
