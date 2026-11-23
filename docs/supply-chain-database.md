# Database Rantai Pasok — SCM-01 & SCM-02

Dokumen ini menjelaskan desain schema PostgreSQL `supply_chain` untuk modul
**SCM-01 Supplier & Procurement Management** dan **SCM-02 Warehouse &
Fulfillment Management**. Semua tabel, enum, dan relasi didefinisikan di
`src/db/schema/supply-chain.ts` dan dibuat melalui migration
`drizzle/0007_*.sql`.

## Prinsip desain

- Semua data operasional terikat ke satu `merchant_id`; akses mengikuti
  kepemilikan merchant dan permission `supply_chain:*`.
- Dokumen pengadaan menyimpan nomor unik yang dihasilkan otomatis
  (`SUP-*`, `PR-*`, `RFQ-*`, `PO-*`, `GR-*`, `WRCP-*`, `PUT-*`, `ALL-*`,
  `PICK-*`, `PACK-*`, `DSP-*`, `WRET-*`, `CPG-*`).
- Nilai kuantitas, harga, dan total disimpan sebagai `numeric` dan
  dikembalikan API sebagai string desimal.
- Batch number disimpan pada item penerimaan dan tugas put-away agar
  perpindahan stok mempertahankan integritas batch.
- Stok tidak disimpan langsung di schema ini. Perubahan stok dilakukan melalui
  helper inventory `applyMovement` sehingga saldo, movement, dan batch tetap
  konsisten.

## Enum

| Enum | Nilai |
| --- | --- |
| `supplier_status` | `active`, `inactive`, `suspended` |
| `procurement_priority` | `low`, `normal`, `high`, `urgent` |
| `purchase_requisition_status` | `draft`, `submitted`, `approved`, `rejected`, `converted`, `cancelled` |
| `supplier_quotation_status` | `requested`, `submitted`, `accepted`, `rejected`, `expired`, `cancelled` |
| `purchase_order_status` | `draft`, `pending_approval`, `approved`, `ordered`, `partially_received`, `received`, `cancelled`, `closed` |
| `goods_receipt_status` | `draft`, `received`, `inspected`, `completed`, `cancelled` |
| `procurement_approval_status` | `pending`, `approved`, `rejected` |
| `collective_purchase_status` | `open`, `closed`, `converted`, `cancelled` |
| `warehouse_receipt_status` | `pending`, `receiving`, `received`, `put_away`, `cancelled` |
| `warehouse_receipt_source` | `goods_receipt`, `transfer`, `return`, `manual` |
| `putaway_task_status` | `pending`, `in_progress`, `completed`, `cancelled` |
| `warehouse_allocation_status` | `pending`, `allocated`, `released`, `cancelled` |
| `picking_task_status` | `pending`, `in_progress`, `picked`, `cancelled` |
| `packing_task_status` | `pending`, `packing`, `packed`, `cancelled` |
| `dispatch_status` | `pending`, `dispatched`, `in_transit`, `delivered`, `failed`, `returned`, `cancelled` |
| `warehouse_return_status` | `requested`, `approved`, `received`, `restocked`, `rejected`, `cancelled` |

## SCM-01 — Pengadaan

### `suppliers`

Master pemasok minimum milik merchant. MKT-10 nantinya dapat memperluas tabel
ini dengan profil, dokumen, dan katalog supplier.

Kolom utama: `id`, `merchant_id`, `code`, `name`, `legal_name`, `contact_name`,
`contact_email`, `contact_phone`, `address`, `city`, `province`, `postal_code`,
`country`, `tax_number`, `payment_term_days`, `status`, `notes`, audit kolom,
dan `deleted_at`.

Batasan:

- `code` unik per `merchant_id`.
- Penghapusan bersifat soft delete (`deleted_at`, status `inactive`).

### `purchase_requisitions` & `purchase_requisition_items`

Permintaan pembelian internal merchant. Header menyimpan `requisition_number`,
merchant, gudang tujuan, pemohon, judul, status, prioritas, `needed_by`,
catatan, serta timestamp submit/approve/reject. Item menyimpan item persediaan
opsional, produk/SKU opsional, deskripsi, kuantitas, estimasi harga satuan, dan
catatan.

Alur status: `draft → submitted → approved → converted`, dengan cabang
`rejected` dan `cancelled`.

### `supplier_quotations` & `supplier_quotation_items`

Penawaran harga dari supplier, opsional terkait permintaan pembelian. Header
menyimpan supplier, merchant, nomor penawaran, status, masa berlaku, termin,
hari pengiriman, diskon, pajak, ongkir, total, dan catatan. Item menyimpan
inventory item/produk/SKU opsional, deskripsi, kuantitas, harga satuan, dan
catatan.

Alur status: `requested → submitted → accepted`, dengan cabang `rejected`,
`expired`, dan `cancelled`.

### `purchase_orders` & `purchase_order_items`

Purchase order ke supplier. Header menyimpan supplier, merchant, gudang,
nomor PO, status, mata uang, subtotal, diskon, pajak, ongkir, grand total,
tanggal pesanan, perkiraan pengiriman, termin, dan catatan. Item menyimpan item
persediaan/produk/SKU opsional, deskripsi, kuantitas, harga satuan, dan
kuantitas yang sudah diterima.

Alur status: `draft → pending_approval → approved → ordered →
partially_received → received → closed`, dengan cabang `cancelled`.

### `goods_receipts` & `goods_receipt_items`

Penerimaan fisik barang dari supplier. Header mencatat merchant, gudang,
lokasi penerimaan, PO opsional, supplier, nomor penerimaan, status, movement
stok hasil penyelesaian, penerima, waktu terima/inspeksi, dan catatan. Item
mencatat item PO, item persediaan, deskripsi, kuantitas diterima/ditolak,
harga satuan, batch, tanggal produksi/kedaluwarsa, dan catatan.

Saat `complete`, sistem:

1. Membuat movement `inbound` ke lokasi penerimaan.
2. Menambah `received_quantity` pada item PO.
3. Memperbarui status PO menjadi `partially_received` atau `received`.
4. Membuat `warehouse_receipts` dan `putaway_tasks`.

### `procurement_approvals`

Jejak keputusan approval pengadaan. Menyimpan entitas yang disetujui
(`purchase_order`/`purchase_requisition`), decision, approver, catatan, dan
waktu keputusan.

### `collective_purchase_groups`

Grup pembelian bersama untuk menyatukan kebutuhan merchant. Menyimpan nomor
grup, merchant, supplier opsional, judul, deskripsi, target/kuantitas saat ini,
satuan, harga target, waktu tutup, status, dan catatan.

## SCM-02 — Gudang & fulfillment

### `warehouse_receipts`

Penerimaan barang di gudang. Header menyimpan nomor, merchant, gudang, lokasi,
referensi goods receipt/PO, movement, sumber, status, kuantitas yang
diharapkan/diterima, penerima, waktu mulai/selesai, dan catatan.

### `putaway_tasks`

Tugas memindahkan barang dari lokasi penerimaan ke lokasi penyimpanan. Menyimpan
nomor tugas, merchant, gudang, warehouse receipt, item persediaan, lokasi asal
dan tujuan, kuantitas, batch, penerima tugas, status, dan catatan.

Penyelesaian put-away membuat movement `transfer` dari lokasi asal ke lokasi
tujuan. Jika semua tugas pada warehouse receipt selesai, status receipt menjadi
`put_away`.

### `warehouse_allocations`

Reservasi stok untuk order. Menyimpan nomor alokasi, merchant, gudang, lokasi,
item persediaan, order/order item opsional, kuantitas, status, dan catatan.

Alokasi aktif menambah `reserved_quantity` pada saldo stok. Pelepasan atau
pemakaian oleh picking mengurangi reservasi tersebut.

### `picking_tasks` & `picking_items`

Tugas pengambilan barang. Header menyimpan nomor tugas, merchant, gudang,
alokasi/order opsional, status, prioritas, penerima tugas, dan catatan. Item
menyimpan alokasi, item persediaan, lokasi, kuantitas, kuantitas diambil,
batch, dan catatan.

Penyelesaian picking membuat movement `outbound` per lokasi, mengeluarkan stok,
dan melepas alokasi terkait.

### `packing_tasks`

Tugas pengemasan setelah picking. Menyimpan nomor, merchant, gudang, picking
task/order opsional, status, jumlah paket, berat (gram), dimensi, penerima
tugas, dan catatan.

### `dispatch_records`

Catatan pengiriman paket. Menyimpan nomor pengiriman, merchant, gudang, packing
task/order opsional, status, kurir, nomor resi, nomor kendaraan, penerima,
waktu berangkat/terkirim, dan catatan.

### `warehouse_returns`

Retur barang ke gudang. Menyimpan nomor retur, merchant, gudang, lokasi, order
dan order return opsional, item persediaan, kuantitas, alasan, status, pemohon,
pemutus, waktu keputusan/terima/restock, movement, dan catatan.

Alur status: `requested → approved → received → restocked`, dengan cabang
`rejected` dan `cancelled`. Restock membuat movement `return` ke lokasi retur.

### `fulfillment_status_histories`

Riwayat perubahan status lintas entitas fulfillment. Menyimpan merchant, tipe
entitas (`putaway_task`, `picking_task`, `packing_task`, `dispatch_record`,
`warehouse_return`, dan lainnya), ID entitas, status asal/tujuan, catatan,
aktor, dan waktu perubahan. Tabel ini menjadi sumber tampilan timeline
fulfillment.

## Relasi utama

```text
merchants 1─* suppliers
merchants 1─* purchase_requisitions 1─* purchase_requisition_items
suppliers 1─* supplier_quotations 1─* supplier_quotation_items
suppliers 1─* purchase_orders 1─* purchase_order_items
purchase_orders 1─* goods_receipts 1─* goods_receipt_items
goods_receipts 1─* warehouse_receipts 1─* putaway_tasks
warehouse_allocations 1─* picking_tasks 1─* picking_items
picking_tasks 1─* packing_tasks 1─* dispatch_records
warehouse_returns ── order/order_return (opsional)
fulfillment_status_histories ── entitas fulfillment (polymorphic by type/id)
```

## Catatan integrasi

- Inventory: seluruh perubahan stok memakai `applyMovement`, sehingga saldo
  `inventory.stock_balances`, movement, dan batch tetap sinkron.
- Commerce: alokasi/picking/packing/pengiriman/retur dapat merujuk order atau
  order item dari schema `commerce`.
- Governance: aksi pembuatan, perubahan status, approval, dan penyelesaian
  dokumen dicatat melalui `writeAuditLog`.
- Permission: `supply_chain:read` untuk baca, `supply_chain:write` untuk aksi
  operasional, dan `supply_chain:manage` untuk pembuatan master/dokumen serta
  approval.
