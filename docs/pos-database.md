# POS Database - MKT-07 POS & Offline Transaction Management

Dokumen ini menjelaskan schema `commerce` untuk modul **MKT-07 POS & Offline
Transaction Management**. Modul ini mengelola terminal POS, cash register,
shift kasir, transaksi toko fisik, item transaksi, pergerakan kas, dan log
sinkronisasi transaksi offline.

Transaksi POS bersifat **independen dari order MKT-05**. Membuat transaksi POS
tidak membuat order marketplace, tidak mengubah stok produk, dan tidak membuat
payment MKT-06 secara otomatis.

- Schema PostgreSQL: `commerce`
- Tabel baru: **7**
- Enum baru: **9**
- Migration: `drizzle/0005_fresh_namor.sql`
- Kode schema: `src/db/schema/pos.ts`
- Kode API: `src/routes/pos/`
- Prefix API: `/api/v1/pos`

---

## 1. Keputusan Desain

1. **Schema mengikuti commerce.**
   - Tabel POS ditempatkan di schema `commerce` agar dekat dengan kanal
     penjualan, order, dan ledger transaksi.
   - Relasi tetap dijaga lewat foreign key ke `core.merchants`, `core.stores`,
     `core.users`, `catalog.products`, dan `catalog.product_skus`.
2. **Transaksi POS tidak membuat order.**
   - POS mencatat penjualan langsung di lokasi fisik.
   - Order marketplace tetap dibuat melalui alur checkout MKT-04/MKT-05.
   - Stok tidak dimutasi; modul inventory akan menangani stok pada MKT-08.
3. **Satu shift terbuka per cash register.**
   - Partial unique index `cashier_shifts_open_register_uq` hanya berlaku untuk
     baris berstatus `open`.
   - Shift lama yang sudah `closed`/`cancelled` tidak menghalangi shift baru.
4. **Transaksi selalu terikat shift terbuka.**
   - Transaksi membutuhkan terminal, cash register, dan shift kasir `open`.
   - Kasir transaksi mengikuti kasir pada shift.
5. **Idempotensi offline berbasis client transaction ID.**
   - Unique index `(terminal_id, client_transaction_id)` mencegah transaksi
     offline yang sama tersimpan dua kali.
   - Batch sync mengembalikan status `created`, `skipped`, atau `failed` per
     item.
6. **Kas dicatat sebagai ledger bertanda.**
   - `cash_movements` menjadi sumber saldo kas shift.
   - `sale`, `opening`, `cash_in`, dan `adjustment` menambah saldo.
   - `refund` dan `cash_out` mengurangi saldo.
   - `expected_cash` shift dihitung dari total ledger, bukan dari input manual.
7. **Penutupan shift menyimpan snapshot.**
   - Saat shift ditutup, sistem menyimpan total penjualan, penjualan tunai,
     penjualan non-tunai, jumlah transaksi, kas sistem, kas dihitung, dan
     selisih kas.
8. **Pembatalan transaksi dibatasi.**
   - Hanya transaksi `completed` pada shift `open` yang dapat dibatalkan.
   - Pembatalan transaksi tunai membuat movement `refund` dan memerlukan saldo
     kas yang cukup.
   - Transaksi `voided` tidak dihitung dalam total penjualan shift.
9. **Nilai uang memakai `numeric(16,2)`.**
   - API mengembalikan nilai uang sebagai string desimal agar presisi tidak
     hilang saat melewati JavaScript.
10. **Audit dan log sinkronisasi terpisah.**
    - Aksi terminal, register, shift, transaksi, dan sync dicatat ke audit log.
    - Keberhasilan/kegagalan upload offline dicatat di `pos_sync_logs`.

---

## 2. ERD Ringkas

```text
core.merchants 1 --- N commerce.pos_terminals
core.stores    1 --- N commerce.pos_terminals
core.merchants 1 --- N commerce.cash_registers
core.stores    1 --- N commerce.cash_registers
commerce.pos_terminals 1 --- N commerce.cash_registers

core.merchants 1 --- N commerce.cashier_shifts
commerce.pos_terminals 1 --- N commerce.cashier_shifts
commerce.cash_registers 1 --- N commerce.cashier_shifts
core.users     1 --- N commerce.cashier_shifts

commerce.cashier_shifts 1 --- N commerce.pos_transactions
commerce.pos_terminals 1 --- N commerce.pos_transactions
commerce.cash_registers 1 --- N commerce.pos_transactions
core.users     1 --- N commerce.pos_transactions

commerce.pos_transactions 1 --- N commerce.pos_transaction_items
catalog.products 1 --- N commerce.pos_transaction_items
catalog.product_skus 1 --- N commerce.pos_transaction_items

commerce.cashier_shifts 1 --- N commerce.cash_movements
commerce.pos_transactions 1 --- N commerce.cash_movements
commerce.cash_registers 1 --- N commerce.cash_movements

commerce.pos_terminals 1 --- N commerce.pos_sync_logs
commerce.pos_transactions 1 --- N commerce.pos_sync_logs
```

---

## 3. Tabel

### 3.1 `pos_terminals`

Master perangkat POS pada satu toko.

Kolom utama: `id`, `merchant_id`, `store_id`, `code`, `name`, `location`,
`device_identifier`, `status`, `settings`, `last_seen_at`, `created_at`,
`updated_at`, `deleted_at`.

Unique index `(merchant_id, code)` mencegah kode terminal ganda dalam satu
pedagang. Terminal yang dihapus menggunakan soft delete (`deleted_at`).

Enum `pos_terminal_status`: `active`, `inactive`, `maintenance`.

### 3.2 `cash_registers`

Laci kas pada toko. Satu register dapat terikat ke satu terminal atau berdiri
sendiri.

Kolom utama: `id`, `merchant_id`, `store_id`, `terminal_id`, `code`, `name`,
`status`, `notes`, `created_at`, `updated_at`, `deleted_at`.

Unique index `(merchant_id, code)` mencegah kode register ganda. Relasi
`terminal_id` memakai `on delete set null` agar register tidak hilang saat
terminal dihapus.

Enum `cash_register_status`: `active`, `inactive`.

### 3.3 `cashier_shifts`

Sesi kerja kasir pada satu terminal/register.

Kolom utama:

- Identitas: `id`, `shift_number` (unik), `merchant_id`, `store_id`,
  `terminal_id`, `register_id`, `cashier_id`.
- Status: `status`.
- Kas: `opening_float`, `expected_cash`, `counted_cash`, `cash_difference`.
- Penjualan: `total_sales`, `total_cash_sales`, `total_non_cash_sales`,
  `transaction_count`.
- Waktu dan aktor: `opened_at`, `closed_at`, `opened_by`, `closed_by`, `notes`.

`expected_cash` dihitung ulang dari `cash_movements` saat shift ditutup.
`counted_cash` dan `cash_difference` baru terisi setelah penutupan.

Enum `cashier_shift_status`: `open`, `closed`, `cancelled`.

### 3.4 `pos_transactions`

Transaksi penjualan POS.

Kolom utama:

- Identitas: `id`, `transaction_number` (unik), `client_transaction_id`.
- Relasi: `merchant_id`, `store_id`, `terminal_id`, `register_id`, `shift_id`,
  `cashier_id`.
- Status: `status`, `sync_status`, `payment_method`, `currency`.
- Nominal: `item_count`, `subtotal`, `discount_total`, `tax_total`, `total`,
  `paid_amount`, `change_amount`.
- Pelanggan: `customer_name`, `customer_phone`.
- Waktu: `offline_created_at`, `completed_at`, `synced_at`, `voided_at`.
- Tambahan: `void_reason`, `notes`, `metadata`, `created_at`, `updated_at`.

Unique index `(terminal_id, client_transaction_id)` hanya berlaku bila
`client_transaction_id` tidak null. Transaksi yang dibuat langsung dari admin
API disimpan dengan `sync_status = 'synced'`; transaksi hasil upload offline
juga disimpan `synced` setelah berhasil diproses.

Enum `pos_transaction_status`: `completed`, `voided`.

Enum `pos_sync_status`: `pending`, `synced`, `failed`, `conflict`.

Enum `pos_payment_method`: `cash`, `qris`, `debit_card`, `credit_card`,
`ewallet`, `bank_transfer`, `other`.

### 3.5 `pos_transaction_items`

Rincian item transaksi POS. Nama produk dan kode SKU disimpan sebagai snapshot
agar riwayat tetap terbaca meskipun produk berubah.

Kolom utama: `id`, `transaction_id`, `product_id`, `sku_id`, `product_name`,
`sku_code`, `quantity`, `unit_price`, `discount_amount`, `line_total`, `notes`,
`item_snapshot`, `created_at`.

`product_id` dan `sku_id` memakai `on delete set null`; item tetap tersimpan
setelah produk/SKU dihapus.

### 3.6 `cash_movements`

Ledger pergerakan kas shift.

Kolom utama: `id`, `merchant_id`, `shift_id`, `register_id`, `transaction_id`,
`type`, `amount`, `balance_after`, `reference_number`, `note`, `created_by`,
`occurred_at`, `created_at`.

Jenis movement dan efeknya:

| Tipe | Efek saldo |
| --- | --- |
| `opening` | Menambah saldo awal |
| `sale` | Menambah saldo (penjualan tunai) |
| `refund` | Mengurangi saldo (pembatalan tunai) |
| `cash_in` | Menambah saldo |
| `cash_out` | Mengurangi saldo |
| `adjustment` | Menambah saldo |

`balance_after` adalah saldo setelah movement dicatat. Validasi saldo tidak
boleh negatif dilakukan sebelum insert `cash_out`/`refund`.

Enum `cash_movement_type`: `opening`, `sale`, `refund`, `cash_in`, `cash_out`,
`adjustment`.

### 3.7 `pos_sync_logs`

Riwayat upload/sinkronisasi transaksi offline.

Kolom utama: `id`, `merchant_id`, `terminal_id`, `transaction_id`, `direction`,
`status`, `records_count`, `payload`, `message`, `error_details`, `started_at`,
`completed_at`, `created_by`.

`payload` menyimpan daftar `clientTransactionId` yang dikirim. `error_details`
menyimpan hasil per item jika ada kegagalan.

Enum `pos_sync_direction`: `upload`, `download`.

Enum `pos_sync_log_status`: `success`, `failed`, `conflict`.

---

## 4. Enum

| Enum | Nilai |
| --- | --- |
| `pos_terminal_status` | `active`, `inactive`, `maintenance` |
| `cash_register_status` | `active`, `inactive` |
| `cashier_shift_status` | `open`, `closed`, `cancelled` |
| `pos_transaction_status` | `completed`, `voided` |
| `pos_sync_status` | `pending`, `synced`, `failed`, `conflict` |
| `pos_payment_method` | `cash`, `qris`, `debit_card`, `credit_card`, `ewallet`, `bank_transfer`, `other` |
| `cash_movement_type` | `opening`, `sale`, `refund`, `cash_in`, `cash_out`, `adjustment` |
| `pos_sync_direction` | `upload`, `download` |
| `pos_sync_log_status` | `success`, `failed`, `conflict` |

---

## 5. Otorisasi & Scoping

Permission MKT-07:

- `pos:read` - lihat terminal, register, shift, transaksi, dan log sync.
- `pos:write` - buka/tutup shift, catat kas, buat transaksi, batalkan
  transaksi.
- `pos:manage` - kelola terminal/register, jalankan batch sync offline, dan
  sinkronkan transaksi.

Role hasil seed:

- `platform_admin` - wildcard `*`.
- `market_admin` - `pos:read`.
- `member` - `pos:read`, `pos:write`, dan `pos:manage`.

Scoping data:

- Platform admin melihat seluruh data.
- Pengguna merchant hanya melihat terminal, register, shift, transaksi, dan log
  sync milik merchant yang boleh diakses.
- Pembuatan terminal/register dan pembukaan shift memerlukan akses merchant
  yang sesuai. Terminal, register, dan shift harus berada pada merchant/toko
  yang sama.
- Batch sync memerlukan `pos:manage` dan terminal yang boleh dikelola.

---

## 6. API

Base: `/api/v1/pos`

| Method | Path | Permission | Keterangan |
| --- | --- | --- | --- |
| GET | `/terminals` | `pos:read` | List terminal sesuai akses |
| POST | `/terminals` | `pos:manage` | Buat terminal |
| PATCH | `/terminals/:terminalId` | `pos:manage` | Update terminal |
| GET | `/registers` | `pos:read` | List cash register |
| POST | `/registers` | `pos:manage` | Buat cash register |
| PATCH | `/registers/:registerId` | `pos:manage` | Update cash register |
| GET | `/shifts` | `pos:read` | List shift kasir |
| POST | `/shifts` | `pos:write` | Buka shift |
| GET | `/shifts/:shiftId` | `pos:read` | Detail shift + pergerakan kas |
| POST | `/shifts/:shiftId/close` | `pos:write` | Tutup shift + rekonsiliasi kas |
| POST | `/shifts/:shiftId/cash-movements` | `pos:write` | Catat kas masuk/keluar/penyesuaian |
| GET | `/transactions` | `pos:read` | List transaksi POS |
| POST | `/transactions` | `pos:write` | Buat transaksi POS langsung |
| GET | `/transactions/:transactionId` | `pos:read` | Detail transaksi + item |
| POST | `/transactions/:transactionId/void` | `pos:write` | Batalkan transaksi |
| POST | `/transactions/:transactionId/sync` | `pos:manage` | Tandai transaksi tersinkronisasi |
| POST | `/sync` | `pos:manage` | Batch upload transaksi offline |
| GET | `/sync-logs` | `pos:read` | List log sinkronisasi |

Contoh membuat transaksi POS:

```http
POST /api/v1/pos/transactions
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "terminalId": "<TERMINAL_ID>",
  "registerId": "<REGISTER_ID>",
  "paymentMethod": "cash",
  "paidAmount": "100000",
  "discountTotal": "0",
  "taxTotal": "0",
  "customerName": "Pelanggan Umum",
  "items": [
    {
      "productId": "<PRODUCT_ID>",
      "quantity": 2,
      "discountAmount": "0"
    }
  ]
}
```

Contoh upload transaksi offline:

```http
POST /api/v1/pos/sync
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "terminalId": "<TERMINAL_ID>",
  "registerId": "<REGISTER_ID>",
  "transactions": [
    {
      "clientTransactionId": "offline-20261123-001",
      "paymentMethod": "cash",
      "paidAmount": "50000",
      "offlineCreatedAt": "2026-11-23T10:15:00+07:00",
      "items": [
        {
          "productId": "<PRODUCT_ID>",
          "quantity": 1
        }
      ]
    }
  ]
}
```

Respons batch sync:

```json
{
  "data": {
    "terminalId": "...",
    "registerId": "...",
    "shiftId": "...",
    "received": 1,
    "created": 1,
    "skipped": 0,
    "failed": 0,
    "results": [
      {
        "clientTransactionId": "offline-20261123-001",
        "transactionId": "...",
        "transactionNumber": "POS-...",
        "status": "created"
      }
    ]
  }
}
```

---

## 7. Integritas & Alur Status

### Shift

- Shift baru selalu berstatus `open`.
- Hanya terminal dan register `active` yang dapat dipakai membuka shift.
- Terminal dan register harus berada pada merchant/toko yang sama.
- Register yang masih memiliki shift `open` tidak dapat dibuka shift baru.
- Saldo awal (`opening_float`) dicatat sebagai movement `opening`.
- Shift `open` dapat ditutup dengan mengirim `countedCash`.
- Penutupan menghitung:
  - total penjualan dari transaksi `completed`;
  - penjualan tunai vs non-tunai;
  - jumlah transaksi;
  - kas sistem dari seluruh `cash_movements`;
  - selisih `countedCash - expectedCash`.
- Movement kas hanya dapat dicatat pada shift `open`.

### Transaksi

- Pembuatan transaksi membutuhkan shift `open` pada register yang dipilih.
- Produk harus aktif dan milik merchant terminal.
- Jika `skuId` dikirim, SKU harus aktif dan sesuai produk.
- `discountAmount` per item tidak boleh melebihi subtotal item.
- `discountTotal` tidak boleh melebihi subtotal transaksi.
- `paidAmount` minimal sebesar total transaksi.
- Untuk pembayaran tunai, `changeAmount = paidAmount - total`; metode non-tunai
  memakai `changeAmount = 0`.
- Penjualan tunai menambah `cash_movements` tipe `sale`.
- Transaksi `voided` tidak dihitung dalam total penjualan shift.

### Pembatalan (void)

- Hanya transaksi `completed` yang dapat dibatalkan.
- Shift harus masih `open`.
- Transaksi tunai membuat movement `refund` sebesar total transaksi.
- Saldo kas harus cukup sebelum refund dicatat.
- `void_reason` wajib diisi.

### Sinkronisasi offline

- `POST /pos/sync` menerima maksimal 100 transaksi per batch.
- Setiap transaksi wajib memiliki `clientTransactionId` unik per terminal.
- Transaksi yang sudah pernah diterima dengan `clientTransactionId` yang sama
  dilewati (`skipped`) tanpa membuat duplikat.
- Transaksi valid disimpan dengan `sync_status = 'synced'`.
- Kegagalan per item tidak membatalkan item lain; hasilnya dilaporkan di
  `results`.
- Setiap batch menulis satu baris `pos_sync_logs`, dengan status `success` bila
  tidak ada item gagal atau `failed` bila ada item gagal.
- Endpoint `POST /transactions/:transactionId/sync` menandai transaksi yang
  masih `pending`/`failed`/`conflict` menjadi `synced` dan menulis log.

---

## 8. Verifikasi Manual

Alur yang sudah diuji pada environment lokal:

1. Login admin.
2. Membuat terminal POS.
3. Membuat cash register.
4. Membuka shift dengan saldo awal.
5. Membuat transaksi tunai dan non-tunai.
6. Mengirim transaksi offline melalui batch sync.
7. Mengirim ulang `clientTransactionId` yang sama dan memastikan respons
   `skipped`.
8. Melihat log sinkronisasi.
9. Menutup shift dan memeriksa total penjualan, kas sistem, kas dihitung, dan
   selisih kas.

Contoh hasil penutupan shift pada data uji:

```text
expectedCash : 270000
countedCash  : 270000
difference   : 0
totalSales   : 105000
cashSales    : 70000
nonCashSales : 35000
transactions : 2
```
