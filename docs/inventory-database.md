# Inventory Database - MKT-08 Inventory & Warehouse Management

Dokumen ini menjelaskan schema `inventory` untuk modul **MKT-08 Inventory &
Warehouse Management**. Modul ini mengelola gudang, lokasi penyimpanan, item
persediaan, saldo stok, pergerakan stok, penyesuaian stok, opname fisik, serta
batch dan kedaluwarsa.

- Schema PostgreSQL: `inventory`
- Tabel baru: **10**
- Enum baru: **9**
- Migration: `drizzle/0006_chemical_blazing_skull.sql`
- Kode schema: `src/db/schema/inventory.ts`
- Kode API: `src/routes/inventory/`
- Prefix API: `/api/v1/inventory`

---

## 1. Keputusan Desain

1. **Schema terpisah `inventory`.**
   - Persediaan tidak dicampur ke `catalog` atau `commerce`.
   - Relasi tetap dijaga lewat foreign key ke `core.merchants`,
     `core.stores`, `core.users`, `catalog.products`, dan
     `catalog.product_skus`.
2. **Stok disimpan per SKU dan lokasi.**
   - Satu baris `stock_balances` mewakili satu pasangan
     `(warehouse_location_id, inventory_item_id)`.
   - Guru besar stok tetap di `stock_balances`; riwayat perubahan ada di
     `stock_movements` dan `stock_movement_items`.
3. **Pergerakan langsung mengubah saldo.**
   - Movement tipe `inbound`, `outbound`, `transfer`, dan `return` dibuat
     dengan status `completed`.
   - Movement tidak memiliki alur draft/approval terpisah pada MKT-08.
   - `adjustment` dan `stock_count` membuat movement turunan secara otomatis.
4. **Satu item per penyesuaian.**
   - `stock_adjustments` mencatat satu item, satu lokasi, jumlah sebelum,
     jumlah sesudah, dan alasan.
   - Tipe `correction` memakai jumlah target (stok hasil hitung), bukan delta.
   - Tipe lain memakai jumlah absolut sebagai delta.
5. **Opname otomatis mengambil saldo lokasi.**
   - Saat opname dibuat, sistem menyalin seluruh saldo pada lokasi terpilih
     menjadi `stock_count_items` dengan `system_quantity`.
   - Item opname harus dihitung semua sebelum opname dapat diselesaikan.
   - Selisih saat penyelesaian dibuat sebagai penyesuaian tipe `correction`
     dan movement `stock_count`.
6. **Batch dan kedaluwarsa bersifat opsional per item.**
   - `inventory_items.track_batches` dan `track_expiry` menentukan apakah item
     dilacak per batch.
   - Batch dibuat saat inbound/return menyertakan `batchNumber` atau `batchId`.
   - Stok agregat tetap menjadi sumber utama; batch adalah rincian opsional.
7. **Batch keluar membutuhkan referensi batch yang jelas.**
   - Outbound/transfer yang menyertakan `batchId` atau `batchNumber` akan
     mengurangi batch pada lokasi sumber.
   - Outbound/transfer tanpa referensi batch hanya mengurangi stok agregat.
   - Transfer dengan nomor batch yang sama akan membuat/menambah batch pada
     lokasi tujuan.
8. **Nilai kuantitas dan uang memakai numeric.**
   - Kuantitas: `numeric(16,3)`.
   - Biaya dan total: `numeric(16,2)`.
   - API mengembalikan nilai sebagai string desimal agar presisi tidak hilang
     saat melewati JavaScript.
9. **Soft delete untuk master data.**
   - Gudang, lokasi, dan item memakai `deleted_at`.
   - Movement, penyesuaian, opname, dan batch tidak dihapus; riwayat harus
     tetap utuh.
10. **Audit trail dicatat.**
    - Pembuatan/perubahan gudang, lokasi, item, movement, penyesuaian, opname,
      dan batch ditulis ke `governance.audit_logs`.

---

## 2. ERD Ringkas

```text
core.merchants 1 --- N inventory.warehouses
core.stores    1 --- N inventory.warehouses
inventory.warehouses 1 --- N inventory.warehouse_locations
inventory.warehouse_locations 1 --- N inventory.warehouse_locations (parent)

core.merchants 1 --- N inventory.inventory_items
catalog.products 1 --- N inventory.inventory_items
catalog.product_skus 1 --- N inventory.inventory_items

inventory.warehouses 1 --- N inventory.stock_balances
inventory.warehouse_locations 1 --- N inventory.stock_balances
inventory.inventory_items 1 --- N inventory.stock_balances

inventory.inventory_items 1 --- N inventory.inventory_batches
inventory.warehouses 1 --- N inventory.inventory_batches
inventory.warehouse_locations 1 --- N inventory.inventory_batches

core.merchants 1 --- N inventory.stock_movements
inventory.stock_movements 1 --- N inventory.stock_movement_items
inventory.inventory_items 1 --- N inventory.stock_movement_items
inventory.inventory_batches 1 --- N inventory.stock_movement_items

core.merchants 1 --- N inventory.stock_adjustments
inventory.stock_movements 1 --- N inventory.stock_adjustments
inventory.inventory_items 1 --- N inventory.stock_adjustments

core.merchants 1 --- N inventory.stock_counts
inventory.stock_counts 1 --- N inventory.stock_count_items
inventory.inventory_items 1 --- N inventory.stock_count_items
```

---

## 3. Tabel

### 3.1 `warehouses`

Gudang milik satu pedagang. Gudang dapat terikat ke toko tertentu atau
berdiri sendiri.

Kolom utama: `id`, `merchant_id`, `store_id`, `code`, `name`, `address`,
`city`, `province`, `postal_code`, `phone`, `is_default`, `status`, `notes`,
`created_at`, `updated_at`, `deleted_at`.

Unique index `(merchant_id, code)` mencegah kode gudang ganda dalam satu
pedagang. `store_id` memakai `on delete set null`; gudang tidak hilang saat
toko dihapus.

Enum `warehouse_status`: `active`, `inactive`.

### 3.2 `warehouse_locations`

Posisi fisik di dalam gudang, misalnya rak, area penerimaan, area picking,
staging, retur, atau karantina.

Kolom utama: `id`, `warehouse_id`, `parent_id`, `code`, `name`, `type`,
`status`, `notes`, `created_at`, `updated_at`, `deleted_at`.

Unique index `(warehouse_id, code)` mencegah kode lokasi ganda dalam satu
gudang. `parent_id` bersifat opsional untuk struktur lokasi bertingkat.

Enum `warehouse_location_type`: `storage`, `receiving`, `picking`, `staging`,
`returns`, `quarantine`, `other`.

Enum `warehouse_location_status`: `active`, `inactive`, `blocked`.

### 3.3 `inventory_items`

Item persediaan yang menghubungkan stok dengan satu SKU produk.

Kolom utama: `id`, `merchant_id`, `product_id`, `sku_id`, `status`,
`min_stock`, `max_stock`, `reorder_point`, `unit_cost`, `track_batches`,
`track_expiry`, `notes`, `created_by`, `created_at`, `updated_at`,
`deleted_at`.

Unique index `(merchant_id, sku_id)` memastikan satu SKU hanya memiliki satu
item persediaan per pedagang. `product_id` dan `sku_id` memakai
`on delete cascade`; item mengikuti produk/SKU.

Enum `inventory_item_status`: `active`, `inactive`, `discontinued`.

Status saldo (`ok`, `low`, `out`) tidak disimpan di tabel; nilainya dihitung
dari `quantity` terhadap `min_stock` saat dibaca API.

### 3.4 `stock_balances`

Saldo stok per item dan lokasi.

Kolom utama: `id`, `merchant_id`, `warehouse_id`, `warehouse_location_id`,
`inventory_item_id`, `quantity`, `reserved_quantity`, `last_movement_at`,
`created_at`, `updated_at`.

Unique index `(warehouse_location_id, inventory_item_id)` menjaga satu saldo
per pasangan lokasi-item. `quantity` tidak boleh negatif; validasi dilakukan
sebelum update.

### 3.5 `stock_movements`

Header pergerakan stok.

Kolom utama:

- Identitas: `id`, `movement_number` (unik).
- Relasi: `merchant_id`, `source_warehouse_id`, `source_location_id`,
  `destination_warehouse_id`, `destination_location_id`.
- Tipe/status: `type`, `status`.
- Referensi: `reference_type`, `reference_id`, `reference_number`.
- Nilai: `total_quantity`, `total_cost`.
- Waktu/aktor: `created_by`, `completed_by`, `completed_at`, `cancelled_at`,
  `created_at`, `updated_at`, `notes`.

Movement `inbound` dan `return` memakai lokasi tujuan. `outbound` memakai
lokasi sumber. `transfer` memakai sumber dan tujuan. `adjustment` dan
`stock_count` dibuat sistem dari penyesuaian/opname.

Enum `stock_movement_type`: `inbound`, `outbound`, `transfer`, `adjustment`,
`stock_count`, `return`.

Enum `stock_movement_status`: `completed`, `cancelled`.

### 3.6 `stock_movement_items`

Rincian item pada satu movement.

Kolom utama: `id`, `movement_id`, `inventory_item_id`, `batch_id`,
`quantity`, `unit_cost`, `total_cost`, `notes`, `created_at`.

`batch_id` memakai `on delete set null`; riwayat item tetap ada bila batch
dihapus. Satu movement dapat berisi banyak item.

### 3.7 `stock_adjustments`

Penyesuaian stok satu item.

Kolom utama: `id`, `adjustment_number` (unik), `merchant_id`, `warehouse_id`,
`warehouse_location_id`, `inventory_item_id`, `type`, `quantity`,
`before_quantity`, `after_quantity`, `reason`, `movement_id`, `created_by`,
`approved_by`, `approved_at`, `created_at`, `updated_at`.

Efek tipe:

| Tipe | Efek |
| --- | --- |
| `increase` | Menambah stok sebesar `quantity` |
| `decrease` | Mengurangi stok sebesar `quantity` |
| `correction` | Menetapkan stok menjadi `quantity` |
| `damage` | Mengurangi stok karena rusak |
| `loss` | Mengurangi stok karena hilang |
| `other` | Mengurangi stok untuk alasan lain |

`before_quantity` dan `after_quantity` adalah snapshot hasil akhir.
Penyesuaian selalu membuat movement tipe `adjustment` atau `stock_count`.

Enum `stock_adjustment_type`: `increase`, `decrease`, `correction`, `damage`,
`loss`, `other`.

### 3.8 `stock_counts`

Header opname fisik pada satu lokasi.

Kolom utama: `id`, `count_number` (unik), `merchant_id`, `warehouse_id`,
`warehouse_location_id`, `status`, `notes`, `started_at`, `completed_at`,
`created_by`, `completed_by`, `created_at`, `updated_at`.

Opname baru berstatus `counting` karena item langsung diisi dari saldo saat
dibuat. Status `draft` disediakan untuk kebutuhan masa depan.

Enum `stock_count_status`: `draft`, `counting`, `completed`, `cancelled`.

### 3.9 `stock_count_items`

Rincian item opname.

Kolom utama: `id`, `count_id`, `inventory_item_id`, `system_quantity`,
`counted_quantity`, `difference_quantity`, `unit_cost`, `notes`, `created_at`,
`updated_at`.

Unique index `(count_id, inventory_item_id)` mencegah item ganda dalam satu
opname. `counted_quantity` dan `difference_quantity` bernilai null sampai
petugas mengisi hitungan fisik.

### 3.10 `inventory_batches`

Batch/lot barang untuk item yang dilacak.

Kolom utama: `id`, `merchant_id`, `inventory_item_id`, `warehouse_id`,
`warehouse_location_id`, `batch_number`, `manufacture_date`, `expiry_date`,
`quantity`, `reserved_quantity`, `unit_cost`, `status`,
`supplier_reference`, `notes`, `created_by`, `created_at`, `updated_at`.

Unique index `(inventory_item_id, warehouse_location_id, batch_number)`
mencegah nomor batch ganda pada lokasi yang sama. `warehouse_id` dan
`warehouse_location_id` memakai `on delete restrict` agar batch tidak
kehilangan lokasi.

Enum `inventory_batch_status`: `active`, `depleted`, `expired`, `quarantined`.

Status kedaluwarsa (`safe`, `expiring`, `expired`, `none`) dihitung dari
`expiry_date` saat dibaca API, bukan disimpan.

---

## 4. Enum

| Enum | Nilai |
| --- | --- |
| `warehouse_status` | `active`, `inactive` |
| `warehouse_location_type` | `storage`, `receiving`, `picking`, `staging`, `returns`, `quarantine`, `other` |
| `warehouse_location_status` | `active`, `inactive`, `blocked` |
| `inventory_item_status` | `active`, `inactive`, `discontinued` |
| `stock_movement_type` | `inbound`, `outbound`, `transfer`, `adjustment`, `stock_count`, `return` |
| `stock_movement_status` | `completed`, `cancelled` |
| `stock_adjustment_type` | `increase`, `decrease`, `correction`, `damage`, `loss`, `other` |
| `stock_count_status` | `draft`, `counting`, `completed`, `cancelled` |
| `inventory_batch_status` | `active`, `depleted`, `expired`, `quarantined` |

---

## 5. Otorisasi & Scoping

Permission MKT-08:

- `inventory:read` - lihat gudang, lokasi, item, saldo, movement,
  penyesuaian, opname, dan batch.
- `inventory:write` - catat movement, penyesuaian, opname, dan penyelesaian
  opname.
- `inventory:manage` - kelola gudang, lokasi, item, dan batch.

Role hasil seed:

- `platform_admin` - wildcard `*`.
- `market_admin` - `inventory:read`.
- `member` - `inventory:read`, `inventory:write`, dan `inventory:manage`.

Scoping data:

- Platform admin melihat seluruh data.
- Pengguna merchant hanya melihat gudang, lokasi, item, saldo, movement,
  penyesuaian, opname, dan batch milik merchant yang boleh diakses.
- Pembuatan gudang/item memerlukan akses merchant yang sesuai.
- Lokasi harus berada pada gudang yang sama dengan movement/penyesuaian.
- Item harus milik pedagang yang sama dengan gudang/lokasi.

---

## 6. API

Base: `/api/v1/inventory`

### Ringkasan & master data

| Method | Path | Permission | Keterangan |
| --- | --- | --- | --- |
| GET | `/summary` | `inventory:read` | Ringkasan gudang, item, stok, low stock, batch, opname |
| GET | `/warehouses` | `inventory:read` | List gudang sesuai akses |
| POST | `/warehouses` | `inventory:manage` | Buat gudang |
| GET | `/warehouses/:warehouseId` | `inventory:read` | Detail gudang |
| PATCH | `/warehouses/:warehouseId` | `inventory:manage` | Update gudang |
| DELETE | `/warehouses/:warehouseId` | `inventory:manage` | Soft delete gudang |
| GET | `/locations` | `inventory:read` | List lokasi sesuai akses |
| GET | `/warehouses/:warehouseId/locations` | `inventory:read` | List lokasi pada gudang |
| POST | `/warehouses/:warehouseId/locations` | `inventory:manage` | Buat lokasi |
| PATCH | `/locations/:locationId` | `inventory:manage` | Update lokasi |
| DELETE | `/locations/:locationId` | `inventory:manage` | Soft delete lokasi |
| GET | `/items` | `inventory:read` | List item persediaan |
| POST | `/items` | `inventory:manage` | Daftarkan item dari SKU |
| GET | `/items/:itemId` | `inventory:read` | Detail item |
| PATCH | `/items/:itemId` | `inventory:manage` | Update batas stok/biaya/status |
| DELETE | `/items/:itemId` | `inventory:manage` | Soft delete item |

### Saldo, batch, movement, penyesuaian, opname

| Method | Path | Permission | Keterangan |
| --- | --- | --- | --- |
| GET | `/balances` | `inventory:read` | List saldo stok + status stok |
| GET | `/batches` | `inventory:read` | List batch + status kedaluwarsa |
| PATCH | `/batches/:batchId` | `inventory:manage` | Update status/expiry/catatan batch |
| GET | `/movements` | `inventory:read` | List movement |
| GET | `/movements/:movementId` | `inventory:read` | Detail movement + item |
| POST | `/movements` | `inventory:write` | Catat inbound/outbound/transfer/return |
| GET | `/adjustments` | `inventory:read` | List penyesuaian |
| GET | `/adjustments/:adjustmentId` | `inventory:read` | Detail penyesuaian |
| POST | `/adjustments` | `inventory:write` | Catat penyesuaian stok |
| GET | `/stock-counts` | `inventory:read` | List opname |
| POST | `/stock-counts` | `inventory:write` | Mulai opname |
| GET | `/stock-counts/:countId` | `inventory:read` | Detail opname + item |
| PATCH | `/stock-counts/:countId/items/:itemId` | `inventory:write` | Isi hitungan fisik |
| POST | `/stock-counts/:countId/complete` | `inventory:write` | Selesaikan opname + buat penyesuaian |
| POST | `/stock-counts/:countId/cancel` | `inventory:write` | Batalkan opname |

Contoh barang masuk:

```http
POST /api/v1/inventory/movements
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "type": "inbound",
  "destinationWarehouseId": "<WAREHOUSE_ID>",
  "destinationLocationId": "<LOCATION_ID>",
  "notes": "Penerimaan stok awal",
  "items": [
    {
      "inventoryItemId": "<ITEM_ID>",
      "quantity": "24",
      "unitCost": "20000",
      "batchNumber": "BATCH-2026-06",
      "expiryDate": "2027-06-30"
    }
  ]
}
```

Contoh transfer:

```http
POST /api/v1/inventory/movements
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "type": "transfer",
  "sourceWarehouseId": "<WAREHOUSE_ID>",
  "sourceLocationId": "<LOCATION_A_ID>",
  "destinationWarehouseId": "<WAREHOUSE_ID>",
  "destinationLocationId": "<LOCATION_B_ID>",
  "items": [
    {
      "inventoryItemId": "<ITEM_ID>",
      "quantity": "8",
      "batchNumber": "BATCH-2026-06"
    }
  ]
}
```

Contoh penyesuaian koreksi:

```http
POST /api/v1/inventory/adjustments
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "warehouseId": "<WAREHOUSE_ID>",
  "warehouseLocationId": "<LOCATION_ID>",
  "inventoryItemId": "<ITEM_ID>",
  "type": "correction",
  "quantity": "28",
  "reason": "Hasil hitung fisik rak A1"
}
```

Contoh menyelesaikan opname:

```http
POST /api/v1/inventory/stock-counts/<COUNT_ID>/complete
Authorization: Bearer <TOKEN>
```

---

## 7. Integritas & Alur Status

### Movement

- `inbound`/`return`: wajib tujuan, menambah saldo tujuan.
- `outbound`: wajib sumber, mengurangi saldo sumber.
- `transfer`: wajib sumber dan tujuan, mengurangi sumber lalu menambah tujuan.
- Sumber dan tujuan transfer tidak boleh sama.
- Jumlah setiap item harus lebih dari 0.
- Stok sumber tidak boleh menjadi negatif.
- Batch yang dirujuk harus milik item dan lokasi sumber yang sesuai.
- Movement dibuat langsung `completed`; `cancelled` disediakan untuk
  pembatalan di masa depan.

### Penyesuaian

- `increase`/`decrease`/`damage`/`loss`/`other` memakai `quantity` sebagai
  delta absolut.
- `correction` memakai `quantity` sebagai stok akhir.
- Alasan wajib diisi.
- Penyesuaian membuat movement tipe `adjustment` (atau `stock_count` bila
  berasal dari opname) dan menyimpan `movement_id`.
- Hasil akhir tidak boleh negatif.

### Opname

- Opname baru berstatus `counting` dan menyalin seluruh saldo lokasi.
- Lokasi harus memiliki minimal satu saldo stok.
- `countedQuantity` tidak boleh negatif.
- `differenceQuantity = countedQuantity - systemQuantity`.
- Semua item wajib memiliki `countedQuantity` sebelum penyelesaian.
- Penyelesaian membuat penyesuaian `correction` untuk item yang selisih,
  movement `stock_count`, lalu menandai opname `completed`.
- Opname `completed`/`cancelled` tidak dapat diubah lagi.
- Pembatalan hanya mengubah status; stok tidak berubah.

### Batch

- Batch aktif dapat memiliki expiry.
- Outbound/transfer dengan `batchId`/`batchNumber` mengurangi batch sumber.
- Batch menjadi `depleted` saat jumlah mencapai 0.
- Batch `expired`/`quarantined` tidak otomatis diblokir dari movement;
  validasi status batch dilakukan saat update batch.
- `expiryDate` dan `manufactureDate` menggunakan tipe `date`.

---

## 8. Indeks Penting

- `warehouses_merchant_code_uq` - kode gudang unik per pedagang.
- `warehouse_locations_warehouse_code_uq` - kode lokasi unik per gudang.
- `inventory_items_merchant_sku_uq` - satu item per SKU per pedagang.
- `stock_balances_location_item_uq` - satu saldo per lokasi-item.
- `inventory_batches_item_location_number_uq` - batch unik per item-lokasi.
- `stock_movements_number_uq`, `stock_adjustments_number_uq`,
  `stock_counts_number_uq` - nomor dokumen unik.
- `stock_count_items_count_item_uq` - satu item per opname.
- Index tambahan tersedia untuk merchant, gudang, item, status, tipe,
  kedaluwarsa, dan waktu movement.

---

## 9. Catatan Implementasi

- Nomor dokumen dibuat server:
  - `MOV-YYYYMMDD-XXXXXX`
  - `ADJ-YYYYMMDD-XXXXXX`
  - `CNT-YYYYMMDD-XXXXXX`
- Semua operasi stok dijalankan dalam transaksi database.
- API mengembalikan nilai kuantitas dan uang sebagai string desimal.
- Dashboard admin memiliki menu **Inventori** setelah **POS**.
- Belum termasuk pada MKT-08: reservasi stok terintegrasi order, picking/
  packing, replenishment otomatis, dan integrasi supplier/PO (SCM-01/SCM-02).
