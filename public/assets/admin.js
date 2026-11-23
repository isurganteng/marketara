const API_BASE = '/api/v1';
const TOKEN_KEY = 'marketara.token';
const PROFILE_KEY = 'marketara.profile';

const VIEW_TITLES = {
  overview: 'Ringkasan',
  markets: 'Pasar',
  merchants: 'Pedagang',
  products: 'Produk',
  commerce: 'Commerce',
  orders: 'Pesanan',
  payments: 'Pembayaran',
  pos: 'POS',
  inventory: 'Inventori',
  'supply-chain': 'Rantai Pasok',
  marketing: 'Pemasaran',
  crm: 'CRM',
  audit: 'Audit log',
};

const STATUS_LABELS = {
  active: 'Aktif',
  planned: 'Direncanakan',
  maintenance: 'Pemeliharaan',
  inactive: 'Nonaktif',
  closed: 'Ditutup',
  draft: 'Draft',
  pending_verification: 'Menunggu verifikasi',
  verified: 'Terverifikasi',
  rejected: 'Ditolak',
  suspended: 'Ditangguhkan',
  archived: 'Diarsipkan',
  published: 'Publik',
  paused: 'Dijeda',
  ended: 'Berakhir',
  pending: 'Menunggu',
  confirmed: 'Dikonfirmasi',
  processing: 'Diproses',
  requested: 'Diajukan',
  approved: 'Disetujui',
  received: 'Diterima',
  unopened: 'Belum dibuka',
  opened: 'Sudah dibuka',
  damaged: 'Rusak',
  defective: 'Cacat',
  other: 'Lainnya',
  cancelled: 'Dibatalkan',
  completed: 'Selesai',
  returned: 'Dikembalikan',
  expired: 'Kedaluwarsa',
  authorized: 'Diotorisasi',
  paid: 'Lunas',
  failed: 'Gagal',
  partially_refunded: 'Refund sebagian',
  refunded: 'Direfund',
  discrepancy: 'Selisih',
  open: 'Terbuka',
  voided: 'Dibatalkan',
  synced: 'Tersinkronisasi',
  conflict: 'Konflik',
  success: 'Berhasil',
  counting: 'Sedang dihitung',
  depleted: 'Habis',
  quarantined: 'Karantina',
  inbound: 'Barang masuk',
  outbound: 'Barang keluar',
  transfer: 'Transfer',
  adjustment: 'Penyesuaian',
  stock_count: 'Opname',
  return: 'Retur',
  increase: 'Penambahan',
  decrease: 'Pengurangan',
  correction: 'Koreksi',
  damage: 'Rusak',
  loss: 'Kehilangan',
  out: 'Habis',
  low: 'Menipis',
  ok: 'Aman',
  safe: 'Aman',
  none: 'Tanpa kedaluwarsa',
  storage: 'Penyimpanan',
  receiving: 'Penerimaan',
  picking: 'Pengambilan',
  staging: 'Staging',
  returns: 'Retur',
  quarantine: 'Karantina',
  discontinued: 'Dihentikan',
  blocked: 'Diblokir',
  submitted: 'Diajukan',
  accepted: 'Diterima vendor',
  converted: 'Dikonversi',
  ordered: 'Dipesan',
  pending_approval: 'Menunggu persetujuan',
  partially_received: 'Diterima sebagian',
  in_progress: 'Sedang diproses',
  picked: 'Sudah dipicking',
  packing: 'Sedang packing',
  packed: 'Siap kirim',
  allocated: 'Dialokasikan',
  released: 'Dilepas',
  restocked: 'Kembali ke stok',
  dispatched: 'Diberangkatkan',
  in_transit: 'Dalam perjalanan',
  delivered: 'Terkirim',
  put_away: 'Sudah put-away',
  urgent: 'Mendesak',
  scheduled: 'Dijadwalkan',
  resolved: 'Diselesaikan',
  exhausted: 'Kuota habis',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  percentage: 'Persentase',
  fixed_amount: 'Nominal tetap',
  free_shipping: 'Gratis ongkir',
  earn: 'Perolehan',
  redeem: 'Penukaran',
  expire: 'Kedaluwarsa',
  bonus: 'Bonus',
  manual: 'Manual',
  dynamic: 'Dinamis',
  internal: 'Internal',
  referral: 'Referensi',
  storefront: 'Storefront',
  pos: 'POS',
  import: 'Impor',
  marketplace: 'Marketplace',
  note: 'Catatan',
  call: 'Telepon',
  email: 'Email',
  whatsapp: 'WhatsApp',
  meeting: 'Pertemuan',
  complaint: 'Keluhan',
  follow_up: 'Tindak lanjut',
  awareness: 'Awareness',
  acquisition: 'Akuisisi',
  retention: 'Retensi',
  engagement: 'Engagement',
};

const STATUS_COLORS = {
  active: '#218867',
  planned: '#d5a03f',
  maintenance: '#8b9a90',
  inactive: '#b6beb4',
  closed: '#bd6260',
};

const ACTION_LABELS = {
  'auth.register': 'Pengguna baru mendaftar',
  'auth.change_password': 'Password pengguna diubah',
  'market.create': 'Pasar baru dibuat',
  'market.update': 'Data pasar diperbarui',
  'market.archive': 'Pasar diarsipkan',
  'merchant.create': 'Pedagang baru ditambahkan',
  'merchant.update': 'Data pedagang diperbarui',
  'merchant.verify': 'Pedagang diverifikasi',
  'merchant.submit': 'Pengajuan verifikasi pedagang',
  'store.create': 'Toko baru dibuat',
  'store.update': 'Data toko diperbarui',
  'store.archive': 'Toko diarsipkan',
  'product.create': 'Produk baru ditambahkan',
  'product.update': 'Produk diperbarui',
  'product.archive': 'Produk diarsipkan',
  'product_catalog.create': 'Katalog baru dibuat',
  'storefront.create': 'Storefront baru dibuat',
  'storefront.update': 'Storefront diperbarui',
  'storefront.archive': 'Storefront diarsipkan',
  'storefront.product.add': 'Produk ditambahkan ke storefront',
  'sales_channel.create': 'Kanal penjualan dibuat',
  'sales_channel.update': 'Kanal penjualan diperbarui',
  'sales_channel.deactivate': 'Kanal penjualan dinonaktifkan',
  'channel_listing.create': 'Listing kanal dibuat',
  'checkout.create': 'Checkout dibuat',
  'order.create': 'Pesanan dibuat dari checkout',
  'order.status.update': 'Status pesanan diperbarui',
  'order.cancel': 'Pesanan dibatalkan',
  'order.note.create': 'Catatan pesanan ditambahkan',
  'return.create': 'Pengajuan retur dibuat',
  'return.status.update': 'Status retur diperbarui',
  'payment.create': 'Pembayaran dibuat',
  'payment.retry': 'Percobaan pembayaran diulang',
  'payment.confirm': 'Pembayaran dikonfirmasi',
  'payment.cancel': 'Pembayaran dibatalkan',
  'payment_provider.create': 'Provider pembayaran dibuat',
  'payment_provider.update': 'Provider pembayaran diperbarui',
  'payment_method.create': 'Metode pembayaran dibuat',
  'payment_method.update': 'Metode pembayaran diperbarui',
  'payment_account.create': 'Akun pembayaran merchant dibuat',
  'payment_account.update': 'Akun pembayaran merchant diperbarui',
  'refund.create': 'Refund diajukan',
  'refund.status.update': 'Status refund diperbarui',
  'settlement.create': 'Settlement dibuat',
  'settlement.status.update': 'Status settlement diperbarui',
  'reconciliation.create': 'Rekonsiliasi dibuat',
  'pos_terminal.create': 'Terminal POS dibuat',
  'pos_terminal.update': 'Terminal POS diperbarui',
  'pos_register.create': 'Cash register dibuat',
  'pos_register.update': 'Cash register diperbarui',
  'pos_shift.open': 'Shift kasir dibuka',
  'pos_shift.close': 'Shift kasir ditutup',
  'pos_cash_movement.create': 'Pergerakan kas dicatat',
  'pos_transaction.create': 'Transaksi POS dibuat',
  'pos_transaction.void': 'Transaksi POS dibatalkan',
  'pos_transaction.sync': 'Transaksi POS disinkronkan',
  'pos_sync.upload': 'Sinkronisasi offline diunggah',
  'inventory.warehouse.create': 'Gudang dibuat',
  'inventory.warehouse.update': 'Gudang diperbarui',
  'inventory.warehouse.delete': 'Gudang dihapus',
  'inventory.location.create': 'Lokasi gudang dibuat',
  'inventory.location.update': 'Lokasi gudang diperbarui',
  'inventory.location.delete': 'Lokasi gudang dihapus',
  'inventory.item.create': 'Item persediaan dibuat',
  'inventory.item.update': 'Item persediaan diperbarui',
  'inventory.item.delete': 'Item persediaan dihapus',
  'inventory.movement.create': 'Pergerakan stok dicatat',
  'inventory.adjustment.create': 'Penyesuaian stok dibuat',
  'inventory.stock_count.create': 'Opname stok dimulai',
  'inventory.stock_count.complete': 'Opname stok diselesaikan',
  'inventory.stock_count.cancel': 'Opname stok dibatalkan',
  'inventory.batch.update': 'Batch persediaan diperbarui',
  'organization.create': 'Organisasi baru dibuat',
  'occupancy.create': 'Okupansi unit dibuat',
  'occupancy.end': 'Okupansi unit diakhiri',
};

const ENTITY_LABELS = {
  market: 'Market',
  merchant: 'Merchant',
  product: 'Product',
  product_catalog: 'Catalog',
  organization: 'Organization',
  user: 'User',
  store: 'Store',
  unit: 'Unit',
  storefront: 'Storefront',
  storefront_product: 'Storefront product',
  sales_channel: 'Sales channel',
  channel_listing: 'Channel listing',
  checkout_session: 'Checkout',
  order: 'Pesanan',
  return: 'Retur',
  sales_transaction: 'Transaksi penjualan',
  payment: 'Pembayaran',
  payment_provider: 'Provider pembayaran',
  payment_method: 'Metode pembayaran',
  payment_account: 'Akun pembayaran',
  refund: 'Refund',
  settlement: 'Settlement',
  reconciliation: 'Rekonsiliasi',
  pos_terminal: 'Terminal POS',
  pos_register: 'Cash register',
  pos_shift: 'Shift kasir',
  pos_cash_movement: 'Pergerakan kas',
  pos_transaction: 'Transaksi POS',
  warehouse: 'Gudang',
  warehouse_location: 'Lokasi gudang',
  inventory_item: 'Item persediaan',
  stock_movement: 'Pergerakan stok',
  stock_adjustment: 'Penyesuaian stok',
  stock_count: 'Opname stok',
  inventory_batch: 'Batch persediaan',
  supplier: 'Supplier',
  purchase_requisition: 'Permintaan pembelian',
  supplier_quotation: 'Penawaran supplier',
  purchase_order: 'Purchase order',
  goods_receipt: 'Penerimaan barang',
  warehouse_receipt: 'Penerimaan gudang',
  putaway_task: 'Tugas put-away',
  warehouse_allocation: 'Alokasi gudang',
  picking_task: 'Tugas picking',
  packing_task: 'Tugas packing',
  dispatch_record: 'Pengiriman',
  warehouse_return: 'Retur gudang',
  collective_purchase_group: 'Grup pembelian',
};

const state = {
  profile: null,
  activeView: 'overview',
  modalClose: null,
  overview: null,
  markets: null,
  merchants: null,
  products: null,
  commerce: null,
  orders: null,
  payments: null,
  pos: null,
  inventory: null,
  supplyChain: null,
  marketing: null,
  crm: null,
  audit: null,
  pendingCount: 0,
  canWriteCommerce: false,
  canManageCommerce: false,
  canWritePayments: false,
  canManagePayments: false,
  canWritePos: false,
  canManagePos: false,
  canWriteInventory: false,
  canManageInventory: false,
  canWriteSupplyChain: false,
  canManageSupplyChain: false,
  canWriteMarketing: false,
  canManageMarketing: false,
  canWriteCrm: false,
  canManageCrm: false,
  sequences: {
    overview: 0,
    markets: 0,
    merchants: 0,
    products: 0,
    commerce: 0,
    orders: 0,
    payments: 0,
    pos: 0,
    inventory: 0,
    supplyChain: 0,
    marketing: 0,
    crm: 0,
    audit: 0,
  },
  filters: {
    markets: { search: '', status: '' },
    merchants: { search: '', status: '' },
    products: { search: '', status: '' },
    commerce: { search: '', status: '' },
    orders: { search: '', status: '' },
    payments: { search: '', status: '' },
    pos: {
      terminalSearch: '',
      terminalStatus: '',
      registerSearch: '',
      shiftSearch: '',
      shiftStatus: '',
      transactionSearch: '',
      transactionStatus: '',
      transactionSync: '',
      syncSearch: '',
      syncStatus: '',
    },
    inventory: {
      itemSearch: '',
      itemStatus: '',
      balanceSearch: '',
      balanceLow: '',
      movementSearch: '',
      movementType: '',
      adjustmentSearch: '',
      adjustmentType: '',
      countSearch: '',
      countStatus: '',
      batchSearch: '',
      batchExpiry: '',
    },
    marketing: { search: '' },
    crm: { search: '' },
    audit: { search: '', entityType: '' },
  },
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

/* ------------------------------ Utilities ----------------------------- */

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[char];
  });
}

function icon(name) {
  return `<svg class="icon" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PROFILE_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(PROFILE_KEY);
}

function getCachedProfile() {
  for (const storage of [localStorage, sessionStorage]) {
    const raw = storage.getItem(PROFILE_KEY);
    if (!raw) continue;
    try {
      return JSON.parse(raw);
    } catch {
      storage.removeItem(PROFILE_KEY);
    }
  }
  return null;
}

function initials(name) {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return new Intl.NumberFormat('id-ID').format(number);
}

function formatMoney(value, currency = 'IDR') {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: currency || 'IDR',
    maximumFractionDigits: 0,
  }).format(number);
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(date)
    .replace('.', ':');
}

function relativeTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const diff = Date.now() - date.getTime();
  if (diff < 45_000) return 'baru saja';
  const minutes = Math.round(diff / 60_000);
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} hari lalu`;
  return formatDate(value);
}

function shortId(value) {
  if (!value) return '—';
  return `${String(value).slice(0, 8)}…`;
}

function statusLabel(status) {
  return STATUS_LABELS[status] ?? status ?? '—';
}

function statusBadge(status) {
  return `<span class="status status-${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</span>`;
}

function entityLabel(type) {
  return ENTITY_LABELS[type] ?? type ?? '—';
}

function actionLabel(action) {
  return ACTION_LABELS[action] ?? action ?? 'Aktivitas';
}

function emptyState(title, text, action = '') {
  return `
    <div class="empty-state">
      <div>
        <span class="empty-icon">${icon('empty')}</span>
        <p class="empty-title">${escapeHtml(title)}</p>
        <p class="empty-text">${escapeHtml(text)}</p>
        ${action}
      </div>
    </div>
  `;
}

function errorState(message, retryAttribute = '') {
  return `
    <div class="error-state">
      <div>
        <span class="empty-icon">${icon('alert')}</span>
        <p class="empty-title">Gagal memuat data</p>
        <p class="empty-text">${escapeHtml(message)}</p>
        ${retryAttribute ? `<button class="button button-ghost empty-action" type="button" ${retryAttribute}>${icon('refresh')} Coba lagi</button>` : ''}
      </div>
    </div>
  `;
}

function tableLoading(rows = 4) {
  return `<div class="table-loading">${Array.from({ length: rows }, () => '<span class="skeleton skeleton-row"></span>').join('')}</div>`;
}

function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function animateNumber(element, target) {
  if (!element) return '';
  const value = Number(target);
  if (!Number.isFinite(value)) {
    element.textContent = '—';
    element.dataset.value = '0';
    return '';
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const start = Number(element.dataset.value ?? 0);
  element.dataset.value = String(value);

  if (reduced || start === value) {
    element.textContent = formatNumber(value);
    return '';
  }

  const duration = 450;
  const startedAt = performance.now();

  function frame(now) {
    const progress = Math.min((now - startedAt) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = formatNumber(Math.round(start + (value - start) * eased));
    if (progress < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
  return '';
}

/* -------------------------------- API --------------------------------- */

async function api(path, options = {}) {
  const token = options.token ?? getToken();
  const headers = { ...(options.headers ?? {}) };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error('Tidak dapat terhubung ke server. Periksa koneksi Anda.');
  }

  const body = await response.json().catch(() => null);

  if (response.status === 401) {
    clearSession();
    window.location.replace('/login?expired=1');
    throw new Error('Sesi berakhir');
  }

  if (!response.ok) {
    const error = new Error(body?.error?.message ?? `Permintaan gagal (${response.status})`);
    error.status = response.status;
    error.code = body?.error?.code;
    throw error;
  }

  return body;
}

function buildQuery(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, value);
    }
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

/* ------------------------------ Profile ------------------------------- */

function isAdminProfile(profile) {
  const permissions = Array.isArray(profile?.permissions) ? profile.permissions : [];
  return permissions.includes('*') || permissions.includes('audit:read');
}

function applyProfile(profile) {
  state.profile = profile;
  const user = profile.user ?? {};
  const name = user.fullName || user.email || 'Administrator';
  const role = profile.permissions?.includes('*')
    ? 'Platform Administrator'
    : 'Market Administrator';

  $('#sidebar-name').textContent = name;
  $('#sidebar-role').textContent = role;
  $('#topbar-name').textContent = name;
  $('#topbar-role').textContent = role;
  const avatar = initials(name);
  $('#sidebar-avatar').textContent = avatar;
  $('#topbar-avatar').textContent = avatar;

  const permissions = Array.isArray(profile.permissions) ? profile.permissions : [];
  const canCommerce = permissions.includes('*') || permissions.includes('commerce:read');
  const canPayments = permissions.includes('*') || permissions.includes('payment:read');
  const canPos = permissions.includes('*') || permissions.includes('pos:read');
  const canInventory = permissions.includes('*') || permissions.includes('inventory:read');
  const canSupplyChain =
    permissions.includes('*') || permissions.includes('supply_chain:read');
  const canMarketing = permissions.includes('*') || permissions.includes('marketing:read');
  const canCrm = permissions.includes('*') || permissions.includes('crm:read');
  state.canWriteCommerce = permissions.includes('*') || permissions.includes('commerce:write');
  state.canManageCommerce = permissions.includes('*') || permissions.includes('commerce:manage');
  state.canWritePayments = permissions.includes('*') || permissions.includes('payment:write');
  state.canManagePayments = permissions.includes('*') || permissions.includes('payment:manage');
  state.canWritePos = permissions.includes('*') || permissions.includes('pos:write');
  state.canManagePos = permissions.includes('*') || permissions.includes('pos:manage');
  state.canWriteInventory = permissions.includes('*') || permissions.includes('inventory:write');
  state.canManageInventory = permissions.includes('*') || permissions.includes('inventory:manage');
  state.canWriteSupplyChain =
    permissions.includes('*') || permissions.includes('supply_chain:write');
  state.canManageSupplyChain =
    permissions.includes('*') || permissions.includes('supply_chain:manage');
  state.canWriteMarketing = permissions.includes('*') || permissions.includes('marketing:write');
  state.canManageMarketing = permissions.includes('*') || permissions.includes('marketing:manage');
  state.canWriteCrm = permissions.includes('*') || permissions.includes('crm:write');
  state.canManageCrm = permissions.includes('*') || permissions.includes('crm:manage');
  const commerceNav = $('[data-view="commerce"]');
  if (commerceNav) commerceNav.hidden = !canCommerce;
  const ordersNav = $('[data-view="orders"]');
  if (ordersNav) ordersNav.hidden = !canCommerce;
  const paymentsNav = $('[data-view="payments"]');
  if (paymentsNav) paymentsNav.hidden = !canPayments;
  const posNav = $('[data-view="pos"]');
  if (posNav) posNav.hidden = !canPos;
  const inventoryNav = $('[data-view="inventory"]');
  if (inventoryNav) inventoryNav.hidden = !canInventory;
  const supplyChainNav = $('[data-view="supply-chain"]');
  if (supplyChainNav) supplyChainNav.hidden = !canSupplyChain;
  const marketingNav = $('[data-view="marketing"]');
  if (marketingNav) marketingNav.hidden = !canMarketing;
  const crmNav = $('[data-view="crm"]');
  if (crmNav) crmNav.hidden = !canCrm;
  for (const selector of [
    '#create-mkt-campaign-button',
    '#create-mkt-promotion-button',
    '#create-mkt-coupon-button',
    '#create-mkt-ad-button',
  ]) {
    const button = $(selector);
    if (button) button.hidden = !state.canWriteMarketing;
  }
  for (const selector of [
    '#create-crm-customer-button',
    '#create-crm-group-button',
    '#create-crm-segment-button',
    '#create-crm-loyalty-button',
    '#create-crm-interaction-button',
    '#create-crm-complaint-button',
  ]) {
    const button = $(selector);
    if (button) button.hidden = !state.canWriteCrm;
  }
  for (const selector of [
    '#create-sc-supplier-button',
    '#create-sc-requisition-button',
    '#create-sc-allocation-button',
    '#create-sc-picking-button',
    '#create-sc-packing-button',
    '#create-sc-dispatch-button',
    '#create-sc-return-button',
    '#create-sc-group-button',
  ]) {
    const button = $(selector);
    if (button) button.hidden = !state.canManageSupplyChain;
  }
  const createChannelButton = $('#create-channel-button');
  if (createChannelButton) createChannelButton.hidden = !state.canManageCommerce;

  const createSettlementButton = $('#create-settlement-button');
  if (createSettlementButton) createSettlementButton.hidden = !state.canWritePayments;
  const createMethodButton = $('#create-payment-method-button');
  if (createMethodButton) createMethodButton.hidden = !state.canManagePayments;
  const createProviderButton = $('#create-payment-provider-button');
  if (createProviderButton) createProviderButton.hidden = !state.canManagePayments;
  const createReconciliationButton = $('#create-reconciliation-button');
  if (createReconciliationButton) {
    createReconciliationButton.hidden = !state.canManagePayments;
  }
  const reconciliationPanel = $('#reconciliation-panel');
  if (reconciliationPanel) reconciliationPanel.hidden = !state.canManagePayments;

  const canCreatePos = state.canManagePos || state.canWritePos;
  for (const selector of [
    '#create-pos-terminal-button',
    '#create-pos-register-button',
    '#open-pos-shift-button',
    '#create-pos-transaction-button',
  ]) {
    const button = $(selector);
    if (!button) continue;
    button.hidden =
      selector === '#create-pos-terminal-button' || selector === '#create-pos-register-button'
        ? !state.canManagePos
        : !canCreatePos;
  }
  const syncOfflineButton = $('#sync-pos-offline-button');
  if (syncOfflineButton) syncOfflineButton.hidden = !state.canManagePos;

  for (const selector of [
    '#create-inventory-warehouse-button',
    '#create-inventory-location-button',
    '#create-inventory-item-button',
  ]) {
    const button = $(selector);
    if (button) button.hidden = !state.canManageInventory;
  }
  for (const selector of [
    '#create-inventory-movement-button',
    '#create-inventory-adjustment-button',
    '#create-inventory-count-button',
  ]) {
    const button = $(selector);
    if (button) button.hidden = !state.canWriteInventory;
  }

  const hour = new Date().getHours();
  const greeting =
    hour < 4
      ? 'Selamat malam'
      : hour < 11
        ? 'Selamat pagi'
        : hour < 15
          ? 'Selamat siang'
          : hour < 18
            ? 'Selamat sore'
            : 'Selamat malam';
  const greetingName = name.length <= 28 ? name : name.split(/\s+/)[0];
  $('#overview-greeting').textContent = `${greeting}, ${greetingName}`;
  $('#overview-date').textContent = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

/* ------------------------------- Modals ------------------------------- */

function closeModal() {
  const root = $('#modal-root');
  root.hidden = true;
  root.innerHTML = '';
  document.body.style.overflow = '';
  state.modalClose = null;
}

function openModal({ title, kicker = '', subtitle = '', body = '', footer = '', wide = false }) {
  const root = $('#modal-root');
  root.innerHTML = `
    <div class="modal${wide ? ' modal-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-header">
        <div>
          ${kicker ? `<p class="panel-kicker">${escapeHtml(kicker)}</p>` : ''}
          <h3 id="modal-title">${escapeHtml(title)}</h3>
          ${subtitle ? `<p class="modal-sub">${escapeHtml(subtitle)}</p>` : ''}
        </div>
        <button class="modal-close" type="button" data-modal-close aria-label="Tutup dialog">
          ${icon('close')}
        </button>
      </div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
    </div>
  `;
  root.hidden = false;
  document.body.style.overflow = 'hidden';
  state.modalClose = closeModal;

  const focusTarget = root.querySelector('input, select, textarea, button:not([data-modal-close])');
  focusTarget?.focus();
  return root.querySelector('.modal');
}

function showToast(title, message = '', type = 'success') {
  const root = $('#toast-root');
  const toast = document.createElement('div');
  toast.className = `toast${type === 'error' ? ' error' : ''}`;
  toast.innerHTML = `
    <span class="toast-icon">${icon(type === 'error' ? 'alert' : 'check')}</span>
    <div>
      <strong>${escapeHtml(title)}</strong>
      ${message ? `<p>${escapeHtml(message)}</p>` : ''}
    </div>
  `;
  root.append(toast);
  setTimeout(() => {
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 230);
  }, 3_800);
}

/* ----------------------------- Navigation ----------------------------- */

function getViewFromHash() {
  const value = window.location.hash.replace('#', '');
  return VIEW_TITLES[value] ? value : 'overview';
}

function setView(view, updateHash = true) {
  if (!VIEW_TITLES[view]) view = 'overview';
  state.activeView = view;

  $$('.view').forEach((section) => {
    section.hidden = section.id !== `view-${view}`;
  });

  $$('.nav-item').forEach((item) => {
    item.classList.toggle('is-active', item.dataset.view === view);
  });

  $('#page-title').textContent = VIEW_TITLES[view];
  document.title = `${VIEW_TITLES[view]} — Marketara Admin`;
  if (updateHash && window.location.hash !== `#${view}`) {
    // Biarkan event hashchange yang memuat data agar tidak terjadi request ganda.
    location.hash = view;
    closeSidebar();
    return;
  }

  closeSidebar();
  loadView(view);
}

function loadView(view) {
  if (view === 'overview') return loadOverview();
  if (view === 'markets') return loadMarkets();
  if (view === 'merchants') return loadMerchants();
  if (view === 'products') return loadProducts();
  if (view === 'commerce') return loadCommerce();
  if (view === 'orders') return loadOrders();
  if (view === 'payments') return loadPayments();
  if (view === 'pos') return loadPos();
  if (view === 'inventory') return loadInventory();
  if (view === 'supply-chain') return loadSupplyChain(true);
  if (view === 'marketing') return loadMarketing(true);
  if (view === 'crm') return loadCrm(true);
  if (view === 'audit') return loadAudit();
  return undefined;
}

/* ------------------------------- Overview ----------------------------- */

async function loadOverview(force = false) {
  const sequence = ++state.sequences.overview;
  if (force) {
    $('#overview-subtitle').textContent = 'Menyegarkan ringkasan ekosistem…';
  }

  try {
    const [markets, merchants, products, audits, pending, activeProducts] = await Promise.all([
      api('/markets?limit=100'),
      api('/merchants?limit=100'),
      api('/catalog/products?limit=100'),
      api('/audit-logs?limit=8'),
      api('/merchants?status=pending_verification&limit=1'),
      api('/catalog/products?status=active&limit=1'),
    ]);

    if (sequence !== state.sequences.overview) return;

    state.overview = {
      markets,
      merchants,
      products,
      audits,
      pendingTotal: Number(pending.meta?.total ?? 0),
      activeProductTotal: Number(activeProducts.meta?.total ?? 0),
    };
    state.pendingCount = state.overview.pendingTotal;
    state.markets = markets;
    state.merchants = merchants;
    state.products = products;
    state.audit = audits;
    renderOverview();
  } catch (error) {
    if (sequence !== state.sequences.overview) return;
    renderOverviewError(error.message);
  }
}

function renderOverview() {
  const data = state.overview;
  if (!data) return;

  const markets = data.markets.data ?? [];
  const merchants = data.merchants.data ?? [];
  const products = data.products.data ?? [];
  const auditRows = data.audits.data ?? [];
  const totalMarkets = Number(data.markets.meta?.total ?? markets.length);
  const totalMerchants = Number(data.merchants.meta?.total ?? merchants.length);
  const totalProducts = Number(data.products.meta?.total ?? products.length);
  const pendingTotal = data.pendingTotal;
  const activeProducts = data.activeProductTotal;
  const activeMarkets = markets.filter((m) => m.status === 'active').length;
  const verifiedMerchants = merchants.filter((m) => m.status === 'verified').length;

  animateNumber($('#stat-markets'), totalMarkets);
  animateNumber($('#stat-merchants'), totalMerchants);
  animateNumber($('#stat-products'), totalProducts);
  animateNumber($('#stat-pending'), pendingTotal);

  $('#stat-markets-trend').textContent = `${formatNumber(activeMarkets)} aktif`;
  $('#stat-merchants-trend').textContent = `${formatNumber(verifiedMerchants)} verified`;
  $('#stat-products-trend').textContent = `${formatNumber(activeProducts)} aktif`;
  $('#stat-pending-trend').textContent = pendingTotal > 0 ? 'perlu tindakan' : 'bersih';

  $('#stat-markets-sub').textContent = totalMarkets > 0 ? `${formatNumber(activeMarkets)} dari ${formatNumber(totalMarkets)} pasar aktif` : 'Belum ada pasar terdaftar';
  $('#stat-merchants-sub').textContent = totalMerchants > 0 ? `${formatNumber(verifiedMerchants)} pedagang terverifikasi` : 'Belum ada pedagang terdaftar';
  $('#stat-products-sub').textContent = totalProducts > 0 ? `${formatNumber(activeProducts)} produk siap tampil` : 'Belum ada produk terdaftar';
  $('#stat-pending-sub').textContent = pendingTotal > 0 ? 'Buka menu pedagang untuk meninjau' : 'Semua pengajuan sudah ditinjau';

  $('#overview-subtitle').textContent =
    pendingTotal > 0
      ? `Ada ${formatNumber(pendingTotal)} pedagang menunggu verifikasi dan ${formatNumber(totalMarkets)} pasar dalam pantauan.`
      : `Semua pengajuan sudah ditinjau. ${formatNumber(totalMarkets)} pasar dan ${formatNumber(totalMerchants)} pedagang dalam pantauan.`;

  renderStatusChart(markets, totalMarkets);
  renderActivity(auditRows);
  renderRecentMerchants(merchants);
  updatePendingBadges(pendingTotal);
}

function renderOverviewError(message) {
  $('#overview-subtitle').textContent = 'Ringkasan belum dapat dimuat.';
  ['#stat-markets', '#stat-merchants', '#stat-products', '#stat-pending'].forEach((id) => {
    const el = $(id);
    el.textContent = '—';
    el.dataset.value = '0';
  });
  ['#stat-markets-sub', '#stat-merchants-sub', '#stat-products-sub', '#stat-pending-sub'].forEach((id) => {
    $(id).textContent = 'Data tidak tersedia';
  });
  $('#market-status-chart').innerHTML = errorState(message, 'data-retry-overview');
  $('#activity-list').innerHTML = errorState(message, 'data-retry-overview');
  $('#recent-merchants').innerHTML = errorState(message, 'data-retry-overview');
}

function renderStatusChart(markets, total) {
  const container = $('#market-status-chart');
  if (!markets.length) {
    container.innerHTML = emptyState(
      'Belum ada pasar',
      'Tambahkan pasar pertama untuk mulai memantau sebaran status.',
      '<button class="button button-ghost empty-action" type="button" data-create-market>Tambah pasar</button>',
    );
    return;
  }

  const order = ['active', 'planned', 'maintenance', 'inactive', 'closed'];
  const counts = new Map(order.map((status) => [status, 0]));
  for (const market of markets) {
    counts.set(market.status, (counts.get(market.status) ?? 0) + 1);
  }

  const denominator = markets.length || 1;
  let current = 0;
  const segments = [];
  for (const status of order) {
    const value = counts.get(status) ?? 0;
    if (value === 0) continue;
    const start = (current / denominator) * 360;
    current += value;
    const end = (current / denominator) * 360;
    segments.push(`${STATUS_COLORS[status] ?? '#dbe4db'} ${start}deg ${end}deg`);
  }

  const gradient = segments.length
    ? `conic-gradient(${segments.join(', ')})`
    : 'conic-gradient(#e6ece4 0deg 360deg)';

  const legend = order
    .map((status) => {
      const value = counts.get(status) ?? 0;
      const percent = Math.round((value / denominator) * 100);
      return `
        <div class="legend-row">
          <span class="legend-swatch" style="--color:${STATUS_COLORS[status]}"></span>
          <span class="legend-name">${escapeHtml(statusLabel(status))}</span>
          <span class="legend-value">${formatNumber(value)} <small>${percent}%</small></span>
        </div>
      `;
    })
    .join('');

  container.innerHTML = `
    <div class="donut" style="background:${gradient}">
      <span class="donut-center">
        <span class="donut-value">${formatNumber(total)}</span>
        <span class="donut-label">total pasar</span>
      </span>
    </div>
    <div class="status-legend">${legend}</div>
  `;
}

function auditVisual(row) {
  const action = row.action ?? '';
  if (action.startsWith('market')) return { icon: 'market', tone: 'green' };
  if (action.startsWith('merchant')) return { icon: 'merchants', tone: 'blue' };
  if (action.startsWith('product')) return { icon: 'product', tone: 'gold' };
  if (action.startsWith('auth') || action.startsWith('user')) return { icon: 'user', tone: 'rose' };
  return { icon: 'audit', tone: 'blue' };
}

function renderActivity(rows) {
  const container = $('#activity-list');
  if (!rows.length) {
    container.innerHTML = emptyState('Belum ada aktivitas', 'Aktivitas penting akan muncul di sini.');
    return;
  }

  container.innerHTML = rows
    .slice(0, 6)
    .map((row) => {
      const visual = auditVisual(row);
      return `
        <div class="activity-item">
          <span class="activity-icon" data-tone="${visual.tone}">${icon(visual.icon)}</span>
          <div class="activity-copy">
            <p class="activity-title">${escapeHtml(actionLabel(row.action))}</p>
            <div class="activity-meta">
              <span class="activity-code">${escapeHtml(entityLabel(row.entityType))}</span>
              <span class="meta-dot"></span>
              <span>${escapeHtml(shortId(row.entityId))}</span>
              <span class="meta-dot"></span>
              <time title="${escapeHtml(formatDateTime(row.createdAt))}">${escapeHtml(relativeTime(row.createdAt))}</time>
            </div>
          </div>
        </div>
      `;
    })
    .join('');
}

function merchantAction(merchant) {
  if (merchant.status === 'pending_verification') {
    return `<button class="action-link gold" type="button" data-verify-merchant="${escapeHtml(merchant.id)}" data-merchant-name="${escapeHtml(merchant.businessName)}">Verifikasi</button>`;
  }
  return '<span class="cell-muted">—</span>';
}

function renderRecentMerchants(merchants) {
  const container = $('#recent-merchants');
  if (!merchants.length) {
    container.innerHTML = emptyState(
      'Belum ada pedagang',
      'Pedagang yang mendaftar akan tampil di sini beserta status verifikasinya.',
    );
    return;
  }

  const rows = [...merchants]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  container.innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Pedagang</th>
            <th>Kategori</th>
            <th>Status</th>
            <th>Terdaftar</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (merchant) => `
                <tr>
                  <td>
                    <div class="name-cell">
                      <span class="name-avatar">${escapeHtml(initials(merchant.businessName))}</span>
                      <span>
                        <span class="cell-main">${escapeHtml(merchant.businessName)}</span>
                        <span class="cell-sub">${escapeHtml(merchant.code)}</span>
                      </span>
                    </div>
                  </td>
                  <td>${escapeHtml(merchant.categoryName ?? '—')}</td>
                  <td>${statusBadge(merchant.status)}</td>
                  <td class="cell-muted cell-nowrap">${escapeHtml(formatDate(merchant.createdAt))}</td>
                  <td>${merchantAction(merchant)}</td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function updatePendingBadges(count) {
  const badge = $('#nav-pending-count');
  badge.textContent = formatNumber(count);
  badge.hidden = !count;

  const sectionBadge = $('#merchant-pending-badge');
  sectionBadge.textContent = `${formatNumber(count)} menunggu verifikasi`;
  sectionBadge.hidden = !count;
}

async function refreshPendingCount() {
  try {
    const result = await api('/merchants?status=pending_verification&limit=1');
    state.pendingCount = Number(result.meta?.total ?? 0);
    updatePendingBadges(state.pendingCount);
  } catch {
    // Badge bersifat opsional; kegagalan di sini tidak menghambat dashboard.
  }
}

/* -------------------------------- Markets ----------------------------- */

async function loadMarkets(force = false) {
  const sequence = ++state.sequences.markets;
  const filters = state.filters.markets;

  if (!state.markets || force) {
    $('#markets-table').innerHTML = tableLoading(5);
  }
  $('#market-count').textContent = 'Memuat…';
  setSpinner('#refresh-markets', true);

  try {
    const result = await api(
      `/markets${buildQuery({ page: 1, limit: 100, search: filters.search, status: filters.status })}`,
    );
    if (sequence !== state.sequences.markets) return;
    state.markets = result;
    renderMarkets();
  } catch (error) {
    if (sequence !== state.sequences.markets) return;
    $('#market-count').textContent = 'Gagal memuat';
    $('#markets-table').innerHTML = errorState(error.message, 'data-retry-markets');
  } finally {
    if (sequence === state.sequences.markets) setSpinner('#refresh-markets', false);
  }
}

function renderMarkets() {
  const result = state.markets;
  if (!result) return;
  const rows = result.data ?? [];
  const total = Number(result.meta?.total ?? rows.length);
  $('#market-count').textContent = `${formatNumber(total)} pasar`;

  if (!rows.length) {
    $('#markets-table').innerHTML = emptyState(
      'Tidak ada pasar ditemukan',
      state.filters.markets.search || state.filters.markets.status
        ? 'Coba ubah kata kunci atau filter status.'
        : 'Tambahkan pasar pertama untuk mulai mengelola ekosistem.',
      '<button class="button button-ghost empty-action" type="button" data-create-market>Tambah pasar</button>',
    );
    return;
  }

  $('#markets-table').innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Pasar</th>
            <th>Kota / Wilayah</th>
            <th>Status</th>
            <th>Dibuka</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (market) => `
                <tr>
                  <td>
                    <div class="name-cell">
                      <span class="name-avatar">${escapeHtml(initials(market.name))}</span>
                      <span>
                        <span class="cell-main">${escapeHtml(market.name)}</span>
                        <span class="cell-sub"><span class="cell-code">${escapeHtml(market.code)}</span></span>
                      </span>
                    </div>
                  </td>
                  <td>
                    <span class="cell-main">${escapeHtml(market.city ?? '—')}</span>
                    <span class="cell-sub">${escapeHtml(market.province ?? 'Belum diisi')}</span>
                  </td>
                  <td>${statusBadge(market.status)}</td>
                  <td class="cell-muted cell-nowrap">${escapeHtml(formatDate(market.openedAt))}</td>
                  <td>
                    <button class="action-link" type="button" data-market-detail="${escapeHtml(market.id)}">
                      ${icon('arrow-right')} Detail
                    </button>
                  </td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function openMarketDetail(marketId) {
  openModal({
    title: 'Detail pasar',
    kicker: 'Market profile',
    subtitle: 'Memuat informasi pasar…',
    body: `<div class="table-loading">${'<span class="skeleton skeleton-row"></span>'.repeat(4)}</div>`,
    wide: true,
  });

  try {
    const result = await api(`/markets/${marketId}`);
    const market = result.data;
    const unitStats = market.unitStats ?? [];
    const totalUnits = unitStats.reduce((sum, item) => sum + Number(item.total), 0);
    const available = unitStats.find((item) => item.status === 'available')?.total ?? 0;
    const occupied = unitStats.find((item) => item.status === 'occupied')?.total ?? 0;

    openModal({
      title: market.name,
      kicker: 'Market profile',
      subtitle: `${market.code} · ${market.city ?? 'Kota belum diisi'}`,
      wide: true,
      body: `
        <dl class="detail-list">
          <div class="detail-row"><dt>Status</dt><dd>${statusBadge(market.status)}</dd></div>
          <div class="detail-row"><dt>Alamat</dt><dd>${escapeHtml(market.address ?? '—')}</dd></div>
          <div class="detail-row"><dt>Kota / Provinsi</dt><dd>${escapeHtml([market.city, market.province].filter(Boolean).join(', ') || '—')}</dd></div>
          <div class="detail-row"><dt>Luas area</dt><dd>${market.totalArea ? `${escapeHtml(market.totalArea)} m²` : '—'}</dd></div>
          <div class="detail-row"><dt>Tanggal dibuka</dt><dd>${escapeHtml(formatDate(market.openedAt))}</dd></div>
          <div class="detail-row"><dt>Zona</dt><dd>${formatNumber(market.zones?.length ?? 0)} zona</dd></div>
          <div class="detail-row"><dt>Fasilitas</dt><dd>${formatNumber(market.facilities?.length ?? 0)} fasilitas</dd></div>
        </dl>
        <div class="detail-stats">
          <div class="detail-stat"><strong>${formatNumber(totalUnits)}</strong><span>Total unit</span></div>
          <div class="detail-stat"><strong>${formatNumber(available)}</strong><span>Tersedia</span></div>
          <div class="detail-stat"><strong>${formatNumber(occupied)}</strong><span>Terisi</span></div>
        </div>
      `,
      footer: '<button class="button button-ghost" type="button" data-modal-close>Tutup</button>',
    });
  } catch (error) {
    showToast('Gagal memuat detail pasar', error.message, 'error');
    closeModal();
  }
}

function openCreateMarketModal() {
  const modal = openModal({
    title: 'Tambah pasar',
    kicker: 'Market management',
    subtitle: 'Lengkapi informasi dasar pasar. Kode dan slug dibuat otomatis.',
    body: `
      <form id="create-market-form" novalidate>
        <div class="form-grid">
          <div class="form-field full">
            <label for="market-name">Nama pasar <span>*</span></label>
            <input id="market-name" name="name" type="text" placeholder="Contoh: Pasar Rakyat Sukamaju" required />
          </div>
          <div class="form-field">
            <label for="market-city">Kota</label>
            <input id="market-city" name="city" type="text" placeholder="Bandung" />
          </div>
          <div class="form-field">
            <label for="market-province">Provinsi</label>
            <input id="market-province" name="province" type="text" placeholder="Jawa Barat" />
          </div>
          <div class="form-field full">
            <label for="market-address">Alamat</label>
            <input id="market-address" name="address" type="text" placeholder="Jl. Merdeka No. 10" />
          </div>
          <div class="form-field">
            <label for="market-status">Status awal</label>
            <select id="market-status" name="status">
              <option value="planned">Direncanakan</option>
              <option value="active">Aktif</option>
              <option value="maintenance">Pemeliharaan</option>
            </select>
          </div>
          <div class="form-field">
            <label for="market-area">Luas area (m²)</label>
            <input id="market-area" name="totalArea" type="number" min="0" step="0.01" placeholder="1500" />
          </div>
          <div class="form-field full">
            <label for="market-description">Deskripsi</label>
            <textarea id="market-description" name="description" placeholder="Catatan singkat tentang pasar…"></textarea>
          </div>
        </div>
      </form>
    `,
    footer: `
      <button class="button button-ghost" type="button" data-modal-close>Batal</button>
      <button class="button button-primary" id="create-market-submit" type="submit" form="create-market-form">
        ${icon('plus')} Simpan pasar
      </button>
    `,
  });

  const form = modal.querySelector('#create-market-form');
  const submit = modal.querySelector('#create-market-submit');
  const errorBox = document.createElement('p');
  errorBox.className = 'form-error';
  errorBox.hidden = true;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim();
    if (name.length < 2) {
      form.querySelector('#market-name').focus();
      return;
    }

    const payload = { name, status: String(data.get('status') ?? 'planned') };
    for (const key of ['city', 'province', 'address', 'description', 'totalArea']) {
      const value = String(data.get(key) ?? '').trim();
      if (value) payload[key] = value;
    }

    submit.disabled = true;
    submit.innerHTML = `<span class="spinner"></span> Menyimpan…`;

    try {
      await api('/markets', { method: 'POST', body: payload });
      closeModal();
      showToast('Pasar berhasil dibuat', `${name} sudah masuk ke daftar pasar.`);
      if (state.activeView !== 'markets') {
        setView('markets');
      } else {
        await loadMarkets(true);
      }
      void loadOverview(false);
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      if (!errorBox.isConnected) form.append(errorBox);
      submit.disabled = false;
      submit.innerHTML = `${icon('plus')} Simpan pasar`;
    }
  });
}

/* ------------------------------- Merchants ---------------------------- */

async function loadMerchants(force = false) {
  const sequence = ++state.sequences.merchants;
  const filters = state.filters.merchants;

  if (!state.merchants || force) {
    $('#merchants-table').innerHTML = tableLoading(5);
  }
  $('#merchant-count').textContent = 'Memuat…';
  setSpinner('#refresh-merchants', true);

  try {
    const result = await api(
      `/merchants${buildQuery({ page: 1, limit: 100, search: filters.search, status: filters.status })}`,
    );
    if (sequence !== state.sequences.merchants) return;
    state.merchants = result;
    renderMerchants();
  } catch (error) {
    if (sequence !== state.sequences.merchants) return;
    $('#merchant-count').textContent = 'Gagal memuat';
    $('#merchants-table').innerHTML = errorState(error.message, 'data-retry-merchants');
  } finally {
    if (sequence === state.sequences.merchants) setSpinner('#refresh-merchants', false);
  }
}

function renderMerchants() {
  const result = state.merchants;
  if (!result) return;
  const rows = result.data ?? [];
  const total = Number(result.meta?.total ?? rows.length);
  $('#merchant-count').textContent = `${formatNumber(total)} pedagang`;

  if (!rows.length) {
    $('#merchants-table').innerHTML = emptyState(
      'Tidak ada pedagang ditemukan',
      state.filters.merchants.search || state.filters.merchants.status
        ? 'Coba ubah kata kunci atau filter status.'
        : 'Pedagang yang mendaftar melalui aplikasi akan tampil di sini.',
    );
    return;
  }

  $('#merchants-table').innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Pedagang</th>
            <th>Kontak</th>
            <th>Kategori</th>
            <th>Status</th>
            <th>Terdaftar</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (merchant) => `
                <tr>
                  <td>
                    <div class="name-cell">
                      <span class="name-avatar" data-tone="blue">${escapeHtml(initials(merchant.businessName))}</span>
                      <span>
                        <span class="cell-main">${escapeHtml(merchant.businessName)}</span>
                        <span class="cell-sub"><span class="cell-code">${escapeHtml(merchant.code)}</span></span>
                      </span>
                    </div>
                  </td>
                  <td>
                    <span class="cell-main">${escapeHtml(merchant.email ?? '—')}</span>
                    <span class="cell-sub">${escapeHtml(merchant.phone ?? 'Telepon belum diisi')}</span>
                  </td>
                  <td>${escapeHtml(merchant.categoryName ?? '—')}</td>
                  <td>${statusBadge(merchant.status)}</td>
                  <td class="cell-muted cell-nowrap">${escapeHtml(formatDate(merchant.createdAt))}</td>
                  <td>${merchantAction(merchant)}</td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function openVerifyModal(merchantId, merchantName) {
  const modal = openModal({
    title: 'Verifikasi pedagang',
    kicker: 'Merchant review',
    subtitle: `Tinjau pengajuan ${merchantName}.`,
    body: `
      <form id="verify-merchant-form">
        <div class="verify-choice">
          <label class="verify-option">
            <input type="radio" name="status" value="verified" checked />
            <span class="verify-radio"></span>
            <span>
              <strong>Setujui</strong>
              <small>Pedagang dapat mulai berjualan di ekosistem.</small>
            </span>
          </label>
          <label class="verify-option">
            <input type="radio" name="status" value="rejected" />
            <span class="verify-radio"></span>
            <span>
              <strong>Tolak</strong>
              <small>Berikan catatan agar pedagang dapat memperbaiki data.</small>
            </span>
          </label>
        </div>
        <div class="form-field">
          <label for="verify-note">Catatan</label>
          <textarea id="verify-note" name="note" placeholder="Catatan verifikasi (opsional)…"></textarea>
          <p class="form-hint">Catatan akan tersimpan pada riwayat status pedagang.</p>
        </div>
      </form>
    `,
    footer: `
      <button class="button button-ghost" type="button" data-modal-close>Batal</button>
      <button class="button button-primary" id="verify-merchant-submit" type="submit" form="verify-merchant-form">
        ${icon('check')} Simpan keputusan
      </button>
    `,
  });

  const form = modal.querySelector('#verify-merchant-form');
  const submit = modal.querySelector('#verify-merchant-submit');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const status = String(data.get('status') ?? 'verified');
    const note = String(data.get('note') ?? '').trim();

    submit.disabled = true;
    submit.innerHTML = `<span class="spinner"></span> Memproses…`;

    try {
      await api(`/merchants/${merchantId}/verify`, {
        method: 'POST',
        body: { status, ...(note ? { note } : {}) },
      });
      closeModal();
      showToast(
        status === 'verified' ? 'Pedagang terverifikasi' : 'Pengajuan ditolak',
        status === 'verified'
          ? `${merchantName} sekarang berstatus terverifikasi.`
          : `${merchantName} menerima catatan penolakan.`,
      );
      await loadMerchants(true);
      void loadOverview(false);
    } catch (error) {
      showToast('Verifikasi gagal', error.message, 'error');
      submit.disabled = false;
      submit.innerHTML = `${icon('check')} Simpan keputusan`;
    }
  });
}

/* -------------------------------- Products ---------------------------- */

async function loadProducts(force = false) {
  const sequence = ++state.sequences.products;
  const filters = state.filters.products;

  if (!state.products || force) {
    $('#products-table').innerHTML = tableLoading(5);
  }
  $('#product-count').textContent = 'Memuat…';
  setSpinner('#refresh-products', true);

  try {
    const result = await api(
      `/catalog/products${buildQuery({ page: 1, limit: 100, search: filters.search, status: filters.status })}`,
    );
    if (sequence !== state.sequences.products) return;
    state.products = result;
    renderProducts();
  } catch (error) {
    if (sequence !== state.sequences.products) return;
    $('#product-count').textContent = 'Gagal memuat';
    $('#products-table').innerHTML = errorState(error.message, 'data-retry-products');
  } finally {
    if (sequence === state.sequences.products) setSpinner('#refresh-products', false);
  }
}

function renderProducts() {
  const result = state.products;
  if (!result) return;
  const rows = result.data ?? [];
  const total = Number(result.meta?.total ?? rows.length);
  const active = rows.filter((row) => row.status === 'active').length;
  $('#product-count').textContent = `${formatNumber(total)} produk`;
  const badge = $('#product-active-badge');
  badge.textContent = `${formatNumber(active)} produk aktif di halaman ini`;
  badge.hidden = !rows.length;

  if (!rows.length) {
    $('#products-table').innerHTML = emptyState(
      'Tidak ada produk ditemukan',
      state.filters.products.search || state.filters.products.status
        ? 'Coba ubah kata kunci atau filter status.'
        : 'Produk yang ditambahkan pedagang akan tampil di sini.',
    );
    return;
  }

  $('#products-table').innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Produk</th>
            <th>Pedagang</th>
            <th>Kategori</th>
            <th>Harga</th>
            <th>Status</th>
            <th>Dibuat</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (product) => `
                <tr>
                  <td>
                    <div class="name-cell">
                      <span class="name-avatar" data-tone="gold">${escapeHtml(initials(product.name))}</span>
                      <span>
                        <span class="cell-main">${escapeHtml(product.name)}</span>
                        <span class="cell-sub">${escapeHtml(product.slug)}</span>
                      </span>
                    </div>
                  </td>
                  <td>${escapeHtml(product.merchantName ?? '—')}</td>
                  <td>${escapeHtml(product.categoryName ?? '—')}</td>
                  <td class="money">${escapeHtml(formatMoney(product.basePrice, product.currency))}</td>
                  <td>${statusBadge(product.status)}</td>
                  <td class="cell-muted cell-nowrap">${escapeHtml(formatDate(product.createdAt))}</td>
                  <td>
                    <button class="action-link" type="button" data-product-detail="${escapeHtml(product.id)}">
                      ${icon('arrow-right')} Detail
                    </button>
                  </td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function openProductDetail(productId) {
  openModal({
    title: 'Detail produk',
    kicker: 'Catalog item',
    subtitle: 'Memuat informasi produk…',
    body: `<div class="table-loading">${'<span class="skeleton skeleton-row"></span>'.repeat(4)}</div>`,
    wide: true,
  });

  try {
    const result = await api(`/catalog/products/${productId}`);
    const product = result.data;
    const variants = product.variants ?? [];
    const skus = product.skus ?? [];
    const images = product.images ?? [];

    const variantHtml = variants.length
      ? variants
          .map(
            (variant) => `
              <div class="detail-row">
                <dt>${escapeHtml(variant.name)}</dt>
                <dd>${variant.price ? escapeHtml(formatMoney(variant.price, product.currency)) : 'Mengikuti harga dasar'} · ${escapeHtml(variant.code ?? 'tanpa kode')}</dd>
              </div>
            `,
          )
          .join('')
      : '<div class="detail-row"><dt>Varian</dt><dd>Belum ada varian</dd></div>';

    const skuHtml = skus.length
      ? skus
          .map(
            (sku) => `
              <div class="detail-row">
                <dt><span class="cell-code">${escapeHtml(sku.skuCode)}</span></dt>
                <dd>${escapeHtml(formatMoney(sku.price, product.currency))} · ${escapeHtml(statusLabel(sku.status))}</dd>
              </div>
            `,
          )
          .join('')
      : '<div class="detail-row"><dt>SKU</dt><dd>Belum ada SKU</dd></div>';

    openModal({
      title: product.name,
      kicker: 'Catalog item',
      subtitle: `${product.merchantName ?? 'Merchant'} · ${product.categoryName ?? 'Tanpa kategori'}`,
      wide: true,
      body: `
        <dl class="detail-list">
          <div class="detail-row"><dt>Status</dt><dd>${statusBadge(product.status)}</dd></div>
          <div class="detail-row"><dt>Harga dasar</dt><dd class="money">${escapeHtml(formatMoney(product.basePrice, product.currency))}</dd></div>
          <div class="detail-row"><dt>Brand</dt><dd>${escapeHtml(product.brandName ?? '—')}</dd></div>
          <div class="detail-row"><dt>Berat</dt><dd>${product.weightGram ? `${formatNumber(product.weightGram)} gram` : '—'}</dd></div>
          <div class="detail-row"><dt>Deskripsi</dt><dd>${escapeHtml(product.shortDescription ?? '—')}</dd></div>
          <div class="detail-row"><dt>Dibuat</dt><dd>${escapeHtml(formatDateTime(product.createdAt))}</dd></div>
        </dl>
        <div class="detail-stats">
          <div class="detail-stat"><strong>${formatNumber(variants.length)}</strong><span>Varian</span></div>
          <div class="detail-stat"><strong>${formatNumber(skus.length)}</strong><span>SKU</span></div>
          <div class="detail-stat"><strong>${formatNumber(images.length)}</strong><span>Gambar</span></div>
        </div>
        <div class="detail-list" style="margin-top:14px">
          ${variantHtml}
          ${skuHtml}
        </div>
      `,
      footer: '<button class="button button-ghost" type="button" data-modal-close>Tutup</button>',
    });
  } catch (error) {
    showToast('Gagal memuat detail produk', error.message, 'error');
    closeModal();
  }
}

/* ------------------------------- Commerce ----------------------------- */

async function loadCommerce(force = false) {
  const sequence = ++state.sequences.commerce;
  const filters = state.filters.commerce;

  if (!state.commerce || force) {
    $('#storefronts-table').innerHTML = tableLoading(4);
  }
  $('#storefront-count').textContent = 'Memuat...';
  setSpinner('#refresh-commerce', true);

  try {
    const [storefronts, channels] = await Promise.all([
      api(
        `/commerce/storefronts${buildQuery({
          page: 1,
          limit: 100,
          search: filters.search,
          status: filters.status,
        })}`,
      ),
      api('/commerce/channels?limit=100'),
    ]);
    if (sequence !== state.sequences.commerce) return;
    state.commerce = { storefronts, channels };
    renderCommerce();
  } catch (error) {
    if (sequence !== state.sequences.commerce) return;
    $('#storefront-count').textContent = 'Gagal memuat';
    $('#storefronts-table').innerHTML = errorState(error.message, 'data-retry-commerce');
    $('#channels-table').innerHTML = errorState(error.message, 'data-retry-commerce');
  } finally {
    if (sequence === state.sequences.commerce) setSpinner('#refresh-commerce', false);
  }
}

function renderCommerce() {
  const data = state.commerce;
  if (!data) return;

  const storefronts = data.storefronts.data ?? [];
  const channels = data.channels.data ?? [];
  const totalStorefronts = Number(data.storefronts.meta?.total ?? storefronts.length);
  const totalChannels = Number(data.channels.meta?.total ?? channels.length);
  const publishedCount = storefronts.filter((row) => row.status === 'published').length;

  $('#storefront-count').textContent = `${formatNumber(totalStorefronts)} storefront - ${formatNumber(publishedCount)} publik`;
  const channelBadge = $('#channel-count-badge');
  channelBadge.textContent = `${formatNumber(totalChannels)} kanal`;
  channelBadge.hidden = false;

  if (!storefronts.length) {
    $('#storefronts-table').innerHTML = emptyState(
      'Belum ada storefront',
      state.filters.commerce.search || state.filters.commerce.status
        ? 'Coba ubah kata kunci atau filter status.'
        : 'Storefront dibuat oleh pedagang melalui API commerce. Data akan muncul di sini setelah tersedia.',
    );
  } else {
    $('#storefronts-table').innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Storefront</th>
              <th>Pedagang</th>
              <th>Kanal</th>
              <th>Produk</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${storefronts
              .map(
                (row) => `
                  <tr>
                    <td>
                      <div class="name-cell">
                        <span class="name-avatar">${escapeHtml(initials(row.name))}</span>
                        <span>
                          <span class="cell-main">${escapeHtml(row.name)}</span>
                          <span class="cell-sub"><span class="cell-code">/${escapeHtml(row.slug)}</span></span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span class="cell-main">${escapeHtml(row.merchantName ?? '-')}</span>
                      <span class="cell-sub">${escapeHtml(row.storeName ?? 'Tanpa toko fisik')}</span>
                    </td>
                    <td class="cell-muted">${escapeHtml(row.salesChannelName ?? 'Website')}</td>
                    <td class="cell-nowrap">${formatNumber(row.productCount ?? 0)}</td>
                    <td>${statusBadge(row.status)}</td>
                    <td>
                      <div class="row-actions">
                        <button class="action-link" type="button" data-storefront-detail="${escapeHtml(row.id)}">
                          ${icon('arrow-right')} Detail
                        </button>
                        ${
                          state.canWriteCommerce
                            ? `<button
                                class="action-link"
                                type="button"
                                data-storefront-status="${escapeHtml(row.id)}"
                                data-next-status="${row.status === 'published' ? 'inactive' : 'published'}"
                                data-storefront-name="${escapeHtml(row.name)}"
                              >
                                ${row.status === 'published' ? 'Nonaktifkan' : 'Publikasikan'}
                              </button>`
                            : ''
                        }
                      </div>
                    </td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  if (!channels.length) {
    $('#channels-table').innerHTML = emptyState(
      'Belum ada kanal',
      'Tambahkan kanal penjualan untuk menghubungkan storefront ke marketplace.',
      '<button class="button button-ghost empty-action" type="button" data-create-channel>Tambah kanal</button>',
    );
  } else {
    $('#channels-table').innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Kanal</th>
              <th>Tipe</th>
              <th>Status</th>
              <th>Urutan</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${channels
              .map(
                (channel) => `
                  <tr>
                    <td>
                      <span class="cell-main">${escapeHtml(channel.name)}</span>
                      <span class="cell-sub"><span class="cell-code">${escapeHtml(channel.code)}</span></span>
                    </td>
                    <td class="cell-muted">${escapeHtml(channel.type)}</td>
                    <td>${statusBadge(channel.status)}</td>
                    <td class="cell-muted">${formatNumber(channel.sortOrder ?? 0)}</td>
                    <td>
                      ${
                        state.canManageCommerce
                          ? `<button
                              class="action-link"
                              type="button"
                              data-channel-toggle="${escapeHtml(channel.id)}"
                              data-next-status="${channel.status === 'active' ? 'inactive' : 'active'}"
                              data-channel-name="${escapeHtml(channel.name)}"
                            >
                              ${channel.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>`
                          : '<span class="cell-muted">-</span>'
                      }
                    </td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }
}

async function openStorefrontDetail(storefrontId) {
  openModal({
    title: 'Detail storefront',
    kicker: 'Commerce',
    subtitle: 'Memuat informasi storefront...',
    body: `<div class="table-loading">${'<span class="skeleton skeleton-row"></span>'.repeat(4)}</div>`,
    wide: true,
  });

  try {
    const result = await api(`/commerce/storefronts/${storefrontId}`);
    const storefront = result.data;
    const products = storefront.products ?? [];

    openModal({
      title: storefront.name,
      kicker: 'Storefront',
      subtitle: `/${storefront.slug} - ${storefront.merchant?.businessName ?? 'Pedagang'}`,
      wide: true,
      body: `
        <dl class="detail-list">
          <div class="detail-row"><dt>Status</dt><dd>${statusBadge(storefront.status)}</dd></div>
          <div class="detail-row"><dt>Pedagang</dt><dd>${escapeHtml(storefront.merchant?.businessName ?? '-')}</dd></div>
          <div class="detail-row"><dt>Kanal</dt><dd>${escapeHtml(storefront.salesChannel?.name ?? 'Website')}</dd></div>
          <div class="detail-row"><dt>Toko fisik</dt><dd>${escapeHtml(storefront.store?.name ?? 'Tidak ditautkan')}</dd></div>
          <div class="detail-row"><dt>Mata uang</dt><dd>${escapeHtml(storefront.currency ?? 'IDR')}</dd></div>
          <div class="detail-row"><dt>Publikasi</dt><dd>${escapeHtml(formatDateTime(storefront.publishedAt))}</dd></div>
          <div class="detail-row"><dt>Deskripsi</dt><dd>${escapeHtml(storefront.description ?? '-')}</dd></div>
        </dl>
        <div class="detail-stats">
          <div class="detail-stat"><strong>${formatNumber(products.length)}</strong><span>Produk terdaftar</span></div>
          <div class="detail-stat"><strong>${formatNumber(products.filter((item) => item.isVisible).length)}</strong><span>Produk tampil</span></div>
          <div class="detail-stat"><strong>${formatNumber(products.filter((item) => item.isFeatured).length)}</strong><span>Unggulan</span></div>
        </div>
        <div class="table-host" style="margin-top:18px">
          ${
            products.length
              ? `<div class="table-wrap">
                  <table class="table">
                    <thead><tr><th>Produk</th><th>Harga dasar</th><th>Harga tampil</th><th>Status</th></tr></thead>
                    <tbody>
                      ${products
                        .map(
                          (item) => `
                            <tr>
                              <td>
                                <span class="cell-main">${escapeHtml(item.productName)}</span>
                                <span class="cell-sub">${escapeHtml(item.categoryName ?? 'Tanpa kategori')}</span>
                              </td>
                              <td class="cell-muted">${escapeHtml(formatMoney(item.basePrice, item.currency))}</td>
                              <td class="cell-main">${escapeHtml(formatMoney(item.effectivePrice, item.currency))}</td>
                              <td>${item.isVisible ? '<span class="status status-active">Tampil</span>' : '<span class="status status-inactive">Disembunyikan</span>'}</td>
                            </tr>
                          `,
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>`
              : '<p class="cell-muted">Belum ada produk di storefront ini.</p>'
          }
        </div>
      `,
      footer: '<button class="button button-ghost" type="button" data-modal-close>Tutup</button>',
    });
  } catch (error) {
    showToast('Gagal memuat storefront', error.message, 'error');
    closeModal();
  }
}

async function updateStorefrontStatus(storefrontId, status, name) {
  try {
    await api(`/commerce/storefronts/${storefrontId}`, {
      method: 'PATCH',
      body: { status },
    });
    showToast(
      status === 'published' ? 'Storefront dipublikasikan' : 'Storefront dinonaktifkan',
      `${name} sekarang berstatus ${statusLabel(status).toLowerCase()}.`,
    );
    await loadCommerce(true);
  } catch (error) {
    showToast('Gagal mengubah storefront', error.message, 'error');
  }
}

async function updateChannelStatus(channelId, status, name) {
  try {
    await api(`/commerce/channels/${channelId}`, {
      method: 'PATCH',
      body: { status },
    });
    showToast(
      status === 'active' ? 'Kanal diaktifkan' : 'Kanal dinonaktifkan',
      `${name} sekarang berstatus ${statusLabel(status).toLowerCase()}.`,
    );
    await loadCommerce(true);
  } catch (error) {
    showToast('Gagal mengubah kanal', error.message, 'error');
  }
}

function openCreateChannelModal() {
  const modal = openModal({
    title: 'Tambah kanal penjualan',
    kicker: 'Omnichannel',
    subtitle: 'Kanal digunakan storefront untuk menandai asal penjualan.',
    body: `
      <form id="create-channel-form" novalidate>
        <div class="form-grid">
          <div class="form-field full">
            <label for="channel-name">Nama kanal <span>*</span></label>
            <input id="channel-name" name="name" type="text" placeholder="Contoh: Tokopedia" required />
          </div>
          <div class="form-field">
            <label for="channel-code">Kode</label>
            <input id="channel-code" name="code" type="text" placeholder="tokopedia" />
          </div>
          <div class="form-field">
            <label for="channel-type">Tipe</label>
            <select id="channel-type" name="type">
              <option value="marketplace">Marketplace</option>
              <option value="web">Website</option>
              <option value="social">Social commerce</option>
              <option value="pos">Point of sale</option>
              <option value="other">Lainnya</option>
            </select>
          </div>
          <div class="form-field full">
            <label for="channel-description">Deskripsi</label>
            <textarea id="channel-description" name="description" placeholder="Catatan singkat tentang kanal..."></textarea>
          </div>
          <div class="form-field">
            <label for="channel-sort">Urutan</label>
            <input id="channel-sort" name="sortOrder" type="number" min="0" step="1" value="50" />
          </div>
        </div>
      </form>
    `,
    footer: `
      <button class="button button-ghost" type="button" data-modal-close>Batal</button>
      <button class="button button-primary" id="create-channel-submit" type="submit" form="create-channel-form">
        ${icon('plus')} Simpan kanal
      </button>
    `,
  });

  const form = modal.querySelector('#create-channel-form');
  const submit = modal.querySelector('#create-channel-submit');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim();
    if (name.length < 2) {
      form.querySelector('#channel-name').focus();
      return;
    }

    const payload = {
      name,
      type: String(data.get('type') ?? 'marketplace'),
      sortOrder: Number(data.get('sortOrder') ?? 50),
    };
    const code = String(data.get('code') ?? '').trim();
    const description = String(data.get('description') ?? '').trim();
    if (code) payload.code = code;
    if (description) payload.description = description;

    submit.disabled = true;
    submit.innerHTML = `<span class="spinner"></span> Menyimpan...`;

    try {
      await api('/commerce/channels', { method: 'POST', body: payload });
      closeModal();
      showToast('Kanal berhasil dibuat', `${name} siap dipakai storefront.`);
      await loadCommerce(true);
    } catch (error) {
      showToast('Gagal membuat kanal', error.message, 'error');
    } finally {
      submit.disabled = false;
      submit.innerHTML = `${icon('plus')} Simpan kanal`;
    }
  });
}

/* ------------------------------- Pesanan ------------------------------ */

const ORDER_ACTIONS = {
  pending: { status: 'confirmed', label: 'Konfirmasi' },
  confirmed: { status: 'processing', label: 'Proses' },
  processing: { status: 'completed', label: 'Selesaikan' },
};

const CANCELLABLE_ORDER_STATUSES = ['pending', 'confirmed', 'processing'];

const RETURN_ACTIONS = {
  requested: [
    { status: 'approved', label: 'Setujui' },
    { status: 'rejected', label: 'Tolak' },
    { status: 'cancelled', label: 'Batalkan' },
  ],
  approved: [
    { status: 'received', label: 'Barang diterima' },
    { status: 'cancelled', label: 'Batalkan' },
  ],
  received: [{ status: 'completed', label: 'Selesaikan retur' }],
};

const TRANSACTION_TYPE_LABELS = {
  sale: 'Penjualan',
  cancellation: 'Pembatalan',
  return: 'Retur',
};

function detailRow(label, value) {
  return `<div class="detail-row"><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`;
}

async function loadOrders(force = false) {
  const sequence = ++state.sequences.orders;
  const filters = state.filters.orders;

  if (!state.orders || force) {
    $('#orders-table').innerHTML = tableLoading(5);
    $('#returns-table').innerHTML = tableLoading(3);
    $('#transactions-table').innerHTML = tableLoading(4);
  }
  $('#order-count').textContent = 'Memuat...';
  setSpinner('#refresh-orders', true);

  try {
    const [orders, returns, transactions] = await Promise.all([
      api(
        `/commerce/orders${buildQuery({
          page: 1,
          limit: 100,
          search: filters.search,
          status: filters.status,
        })}`,
      ),
      api('/commerce/returns?page=1&limit=100'),
      api('/commerce/transactions?page=1&limit=100'),
    ]);
    if (sequence !== state.sequences.orders) return;
    state.orders = { orders, returns, transactions };
    renderOrders();
  } catch (error) {
    if (sequence !== state.sequences.orders) return;
    $('#order-count').textContent = 'Gagal memuat';
    $('#orders-table').innerHTML = errorState(error.message, 'data-retry-orders');
    $('#returns-table').innerHTML = errorState(error.message, 'data-retry-orders');
    $('#transactions-table').innerHTML = errorState(error.message, 'data-retry-orders');
  } finally {
    if (sequence === state.sequences.orders) setSpinner('#refresh-orders', false);
  }
}

function renderOrders() {
  const data = state.orders;
  if (!data) return;

  const orders = data.orders.data ?? [];
  const returns = data.returns.data ?? [];
  const transactions = data.transactions.data ?? [];
  const totalOrders = Number(data.orders.meta?.total ?? orders.length);
  const completed = orders.filter((row) => row.status === 'completed').length;
  const totalReturns = Number(data.returns.meta?.total ?? returns.length);
  const totalTransactions = Number(data.transactions.meta?.total ?? transactions.length);

  $('#order-count').textContent = `${formatNumber(totalOrders)} pesanan`;
  const completedBadge = $('#order-completed-badge');
  if (completedBadge) {
    completedBadge.hidden = orders.length === 0;
    completedBadge.textContent = `${formatNumber(completed)} selesai`;
  }
  const returnBadge = $('#return-count-badge');
  if (returnBadge) {
    returnBadge.hidden = returns.length === 0;
    returnBadge.textContent = `${formatNumber(totalReturns)} retur`;
  }
  const transactionBadge = $('#transaction-count-badge');
  if (transactionBadge) {
    transactionBadge.hidden = transactions.length === 0;
    transactionBadge.textContent = `${formatNumber(totalTransactions)} transaksi`;
  }

  if (!orders.length) {
    $('#orders-table').innerHTML = emptyState(
      'Belum ada pesanan',
      state.filters.orders.search || state.filters.orders.status
        ? 'Coba ubah kata kunci atau filter status.'
        : 'Pesanan muncul setelah checkout pelanggan dikonversi menjadi order.',
    );
  } else {
    $('#orders-table').innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Pesanan</th>
              <th>Pelanggan</th>
              <th>Pedagang</th>
              <th>Status</th>
              <th>Total</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${orders
              .map((row) => {
                const next = ORDER_ACTIONS[row.status];
                const canCancel = CANCELLABLE_ORDER_STATUSES.includes(row.status);
                return `
                  <tr>
                    <td>
                      <div class="cell-title">${escapeHtml(row.orderNumber)}</div>
                      <div class="cell-muted">${escapeHtml(formatDateTime(row.placedAt))}</div>
                    </td>
                    <td>
                      <div class="cell-title">${escapeHtml(row.customerName ?? row.contactName ?? '-')}</div>
                      <div class="cell-muted">${escapeHtml(row.contactPhone ?? '')}</div>
                    </td>
                    <td>
                      <div class="cell-title">${escapeHtml(row.merchantName ?? '-')}</div>
                      <div class="cell-muted">${escapeHtml(row.storefrontName ?? '-')}</div>
                    </td>
                    <td>${statusBadge(row.status)}</td>
                    <td>
                      <div class="cell-title">${escapeHtml(formatMoney(row.grandTotal, row.currency))}</div>
                      <div class="cell-muted">${formatNumber(row.itemCount)} item</div>
                    </td>
                    <td>
                      <div class="row-actions">
                        <button class="action-link" type="button" data-order-detail="${escapeHtml(row.id)}">
                          ${icon('arrow-right')} Detail
                        </button>
                        ${
                          state.canWriteCommerce && next
                            ? `<button
                                class="action-link"
                                type="button"
                                data-order-status="${escapeHtml(row.id)}"
                                data-next-status="${next.status}"
                                data-order-number="${escapeHtml(row.orderNumber)}"
                              >${escapeHtml(next.label)}</button>`
                            : ''
                        }
                        ${
                          state.canWriteCommerce && canCancel
                            ? `<button
                                class="action-link"
                                type="button"
                                data-order-cancel="${escapeHtml(row.id)}"
                                data-order-number="${escapeHtml(row.orderNumber)}"
                              >Batalkan</button>`
                            : ''
                        }
                      </div>
                    </td>
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  if (!returns.length) {
    $('#returns-table').innerHTML = emptyState(
      'Belum ada retur',
      'Pengajuan retur dari pesanan yang sudah selesai akan tampil di sini.',
    );
  } else {
    $('#returns-table').innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Retur</th>
              <th>Pesanan</th>
              <th>Pelanggan</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${returns
              .map(
                (row) => `
                  <tr>
                    <td>
                      <div class="cell-title">${escapeHtml(row.returnNumber)}</div>
                      <div class="cell-muted">${escapeHtml(formatDateTime(row.requestedAt))}</div>
                    </td>
                    <td>${escapeHtml(row.orderNumber)}</td>
                    <td>${escapeHtml(row.customerName ?? '-')}</td>
                    <td>${statusBadge(row.status)}</td>
                    <td>
                      <button class="action-link" type="button" data-return-detail="${escapeHtml(row.id)}">
                        ${icon('arrow-right')} Detail
                      </button>
                    </td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  if (!transactions.length) {
    $('#transactions-table').innerHTML = emptyState(
      'Belum ada transaksi',
      'Ledger penjualan mencatat nilai order, pembatalan, dan retur.',
    );
  } else {
    $('#transactions-table').innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Transaksi</th>
              <th>Pesanan</th>
              <th>Pedagang</th>
              <th>Tipe</th>
              <th>Nominal</th>
            </tr>
          </thead>
          <tbody>
            ${transactions
              .map(
                (row) => `
                  <tr>
                    <td>
                      <div class="cell-title">${escapeHtml(row.transactionNumber)}</div>
                      <div class="cell-muted">${escapeHtml(formatDateTime(row.occurredAt))}</div>
                    </td>
                    <td>${escapeHtml(row.orderNumber)}</td>
                    <td>${escapeHtml(row.merchantName ?? '-')}</td>
                    <td>${escapeHtml(TRANSACTION_TYPE_LABELS[row.type] ?? row.type)}</td>
                    <td>${escapeHtml(formatMoney(row.amount, row.currency))}</td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }
}

/* ------------------------------- Payments ----------------------------- */

const PAYMENT_METHOD_TYPE_LABELS = {
  qris: 'QRIS',
  ewallet: 'E-wallet',
  bank_transfer: 'Transfer bank',
  virtual_account: 'Virtual account',
  credit_card: 'Kartu kredit',
  cash: 'Tunai',
  other: 'Lainnya',
};

const PAYMENT_EVENT_LABELS = {
  created: 'Dibuat',
  authorized: 'Diotorisasi',
  paid: 'Lunas',
  failed: 'Gagal',
  expired: 'Kedaluwarsa',
  cancelled: 'Dibatalkan',
  refund: 'Refund',
  settlement: 'Settlement',
  callback: 'Callback',
  other: 'Lainnya',
};

const REFUND_NEXT_ACTIONS = {
  requested: [
    ['approved', 'Setujui'],
    ['rejected', 'Tolak'],
    ['cancelled', 'Batalkan'],
  ],
  approved: [
    ['processing', 'Proses'],
    ['cancelled', 'Batalkan'],
  ],
  processing: [
    ['completed', 'Selesaikan'],
    ['failed', 'Tandai gagal'],
  ],
  failed: [
    ['processing', 'Proses ulang'],
    ['cancelled', 'Batalkan'],
  ],
};

const SETTLEMENT_NEXT_ACTIONS = {
  draft: [
    ['pending', 'Ajukan'],
    ['cancelled', 'Batalkan'],
  ],
  pending: [
    ['processing', 'Proses'],
    ['cancelled', 'Batalkan'],
  ],
  processing: [
    ['completed', 'Selesaikan'],
    ['cancelled', 'Batalkan'],
  ],
};

function dateTimeLocalValue(value) {
  const date = value ? new Date(value) : new Date();
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function loadPayments(force = false) {
  const sequence = ++state.sequences.payments;
  const filters = state.filters.payments;

  if (!state.payments || force) {
    $('#payments-table').innerHTML = tableLoading(5);
    $('#refunds-table').innerHTML = tableLoading(3);
    $('#settlements-table').innerHTML = tableLoading(3);
    $('#reconciliations-table').innerHTML = tableLoading(3);
    $('#payment-methods-table').innerHTML = tableLoading(3);
  }
  $('#payment-count').textContent = 'Memuat...';
  setSpinner('#refresh-payments', true);

  try {
    const [payments, refunds, settlements, reconciliations, methods, providers] =
      await Promise.all([
        api(
          `/payments${buildQuery({
            page: 1,
            limit: 100,
            search: filters.search,
            status: filters.status,
          })}`,
        ),
        api('/payments/refunds?page=1&limit=100'),
        api('/payments/settlements?page=1&limit=100'),
        state.canManagePayments
          ? api('/payments/reconciliations?page=1&limit=100')
          : Promise.resolve({ data: [], meta: { total: 0 } }),
        api('/payments/methods?page=1&limit=100'),
        api('/payments/providers?page=1&limit=100'),
      ]);
    if (sequence !== state.sequences.payments) return;
    state.payments = {
      payments,
      refunds,
      settlements,
      reconciliations,
      methods,
      providers,
    };
    renderPayments();
  } catch (error) {
    if (sequence !== state.sequences.payments) return;
    $('#payment-count').textContent = 'Gagal memuat';
    for (const selector of [
      '#payments-table',
      '#refunds-table',
      '#settlements-table',
      '#reconciliations-table',
      '#payment-methods-table',
    ]) {
      $(selector).innerHTML = errorState(error.message, 'data-retry-payments');
    }
  } finally {
    if (sequence === state.sequences.payments) setSpinner('#refresh-payments', false);
  }
}

function renderPayments() {
  const data = state.payments;
  if (!data) return;

  const payments = data.payments.data ?? [];
  const refunds = data.refunds.data ?? [];
  const settlements = data.settlements.data ?? [];
  const reconciliations = data.reconciliations.data ?? [];
  const methods = data.methods.data ?? [];
  const totalPayments = Number(data.payments.meta?.total ?? payments.length);
  const paidCount = payments.filter((row) => row.status === 'paid').length;

  $('#payment-count').textContent = `${formatNumber(totalPayments)} pembayaran`;
  const paidBadge = $('#payment-paid-badge');
  if (paidBadge) {
    paidBadge.hidden = payments.length === 0;
    paidBadge.textContent = `${formatNumber(paidCount)} lunas`;
  }
  const setBadge = (selector, count, label) => {
    const badge = $(selector);
    if (badge) {
      badge.hidden = count === 0;
      badge.textContent = `${formatNumber(count)} ${label}`;
    }
  };
  setBadge('#refund-count-badge', Number(data.refunds.meta?.total ?? refunds.length), 'refund');
  setBadge(
    '#settlement-count-badge',
    Number(data.settlements.meta?.total ?? settlements.length),
    'settlement',
  );
  setBadge(
    '#reconciliation-count-badge',
    Number(data.reconciliations.meta?.total ?? reconciliations.length),
    'rekonsiliasi',
  );
  setBadge(
    '#payment-method-count-badge',
    Number(data.methods.meta?.total ?? methods.length),
    'metode',
  );

  if (!payments.length) {
    $('#payments-table').innerHTML = emptyState(
      'Belum ada pembayaran',
      state.filters.payments.search || state.filters.payments.status
        ? 'Coba ubah kata kunci atau filter status.'
        : 'Pembayaran muncul setelah dibuat dari pesanan.',
    );
  } else {
    $('#payments-table').innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Pembayaran</th>
              <th>Pesanan / pelanggan</th>
              <th>Metode</th>
              <th>Nominal</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${payments
              .map(
                (row) => `
                  <tr>
                    <td>
                      <div class="cell-title">${escapeHtml(row.paymentNumber)}</div>
                      <div class="cell-muted">${escapeHtml(formatDateTime(row.createdAt))}</div>
                    </td>
                    <td>
                      <div class="cell-title">${escapeHtml(row.orderNumber)}</div>
                      <div class="cell-muted">${escapeHtml(row.customerName ?? row.merchantName ?? '-')}</div>
                    </td>
                    <td>
                      <div class="cell-title">${escapeHtml(row.methodName ?? '-')}</div>
                      <div class="cell-muted">${escapeHtml(row.providerName ?? '-')}</div>
                    </td>
                    <td>
                      <div class="cell-title">${escapeHtml(formatMoney(row.amount, row.currency))}</div>
                      <div class="cell-muted">Biaya ${escapeHtml(formatMoney(row.feeAmount, row.currency))}</div>
                    </td>
                    <td>${statusBadge(row.status)}</td>
                    <td>
                      <div class="row-actions">
                        <button class="action-link" type="button" data-payment-detail="${escapeHtml(row.id)}">
                          ${icon('arrow-right')} Detail
                        </button>
                        ${
                          state.canWritePayments && ['pending', 'authorized'].includes(row.status)
                            ? `<button class="action-link" type="button" data-payment-confirm="${escapeHtml(row.id)}" data-payment-number="${escapeHtml(row.paymentNumber)}">Lunas</button>`
                            : ''
                        }
                      </div>
                    </td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  if (!refunds.length) {
    $('#refunds-table').innerHTML = emptyState(
      'Belum ada refund',
      'Refund untuk pembayaran lunas akan tampil di sini.',
    );
  } else {
    $('#refunds-table').innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Refund</th><th>Pembayaran</th><th>Pedagang</th><th>Nominal</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            ${refunds
              .map(
                (row) => `
                  <tr>
                    <td>
                      <div class="cell-title">${escapeHtml(row.refundNumber)}</div>
                      <div class="cell-muted">${escapeHtml(formatDateTime(row.requestedAt))}</div>
                    </td>
                    <td>${escapeHtml(row.paymentNumber)}</td>
                    <td>${escapeHtml(row.merchantName ?? '-')}</td>
                    <td>${escapeHtml(formatMoney(row.amount, row.currency))}</td>
                    <td>${statusBadge(row.status)}</td>
                    <td>
                      <button class="action-link" type="button" data-refund-detail="${escapeHtml(row.id)}">
                        ${icon('arrow-right')} Detail
                      </button>
                    </td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  if (!settlements.length) {
    $('#settlements-table').innerHTML = emptyState(
      'Belum ada settlement',
      'Settlement dibuat dari pembayaran lunas pada periode tertentu.',
    );
  } else {
    $('#settlements-table').innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Settlement</th><th>Pedagang</th><th>Periode</th><th>Net</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            ${settlements
              .map(
                (row) => `
                  <tr>
                    <td>
                      <div class="cell-title">${escapeHtml(row.settlementNumber)}</div>
                      <div class="cell-muted">${formatNumber(row.paymentCount)} pembayaran</div>
                    </td>
                    <td>${escapeHtml(row.merchantName ?? '-')}</td>
                    <td>${escapeHtml(formatDate(row.periodStart))} - ${escapeHtml(formatDate(row.periodEnd))}</td>
                    <td>${escapeHtml(formatMoney(row.netAmount, row.currency))}</td>
                    <td>${statusBadge(row.status)}</td>
                    <td>
                      <button class="action-link" type="button" data-settlement-detail="${escapeHtml(row.id)}">
                        ${icon('arrow-right')} Detail
                      </button>
                    </td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  if (state.canManagePayments) {
    if (!reconciliations.length) {
      $('#reconciliations-table').innerHTML = emptyState(
        'Belum ada rekonsiliasi',
        'Buat rekonsiliasi untuk membandingkan pembayaran internal dengan data provider.',
      );
    } else {
      $('#reconciliations-table').innerHTML = `
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Rekonsiliasi</th><th>Provider</th><th>Periode</th><th>Selisih</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              ${reconciliations
                .map(
                  (row) => `
                    <tr>
                      <td>
                        <div class="cell-title">${escapeHtml(row.reconciliationNumber)}</div>
                        <div class="cell-muted">${escapeHtml(formatDateTime(row.createdAt))}</div>
                      </td>
                      <td>${escapeHtml(row.providerName ?? '-')}</td>
                      <td>${escapeHtml(formatDate(row.periodStart))} - ${escapeHtml(formatDate(row.periodEnd))}</td>
                      <td>${escapeHtml(formatMoney(row.differenceAmount, row.currency))}</td>
                      <td>${statusBadge(row.status)}</td>
                      <td>
                        <button class="action-link" type="button" data-reconciliation-detail="${escapeHtml(row.id)}">
                          ${icon('arrow-right')} Detail
                        </button>
                      </td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `;
    }
  }

  if (!methods.length) {
    $('#payment-methods-table').innerHTML = emptyState(
      'Belum ada metode pembayaran',
      'Tambahkan provider dan metode pembayaran untuk mulai menerima pembayaran.',
    );
  } else {
    $('#payment-methods-table').innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Metode</th><th>Provider</th><th>Tipe</th><th>Biaya</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            ${methods
              .map(
                (row) => `
                  <tr>
                    <td>
                      <div class="cell-title">${escapeHtml(row.name)}</div>
                      <div class="cell-muted">${escapeHtml(row.code)}</div>
                    </td>
                    <td>${escapeHtml(row.providerName ?? '-')}</td>
                    <td>${escapeHtml(PAYMENT_METHOD_TYPE_LABELS[row.type] ?? row.type)}</td>
                    <td>
                      <div class="cell-title">${escapeHtml(formatMoney(row.feeFlat, 'IDR'))}</div>
                      <div class="cell-muted">${escapeHtml(String(row.feePercent ?? '0'))}%</div>
                    </td>
                    <td>${statusBadge(row.status)}</td>
                    <td>
                      ${
                        state.canManagePayments
                          ? `<button class="action-link" type="button" data-payment-method-toggle="${escapeHtml(row.id)}" data-next-status="${row.status === 'active' ? 'inactive' : 'active'}" data-method-name="${escapeHtml(row.name)}">${row.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}</button>`
                          : '<span class="cell-muted">-</span>'
                      }
                    </td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }
}

function paymentActionButtons(payment) {
  if (!state.canWritePayments) return '';
  const actions = [];
  if (['pending', 'authorized'].includes(payment.status)) {
    actions.push(
      `<button class="button button-primary" type="button" data-payment-confirm="${escapeHtml(payment.id)}" data-payment-number="${escapeHtml(payment.paymentNumber)}">Tandai lunas</button>`,
    );
    actions.push(
      `<button class="button button-ghost" type="button" data-payment-cancel="${escapeHtml(payment.id)}" data-payment-number="${escapeHtml(payment.paymentNumber)}">Batalkan</button>`,
    );
  }
  if (['failed', 'expired', 'cancelled'].includes(payment.status)) {
    actions.push(
      `<button class="button button-primary" type="button" data-payment-retry="${escapeHtml(payment.id)}" data-payment-number="${escapeHtml(payment.paymentNumber)}">Coba lagi</button>`,
    );
  }
  if (['paid', 'partially_refunded'].includes(payment.status)) {
    actions.push(
      `<button class="button button-primary" type="button" data-payment-refund="${escapeHtml(payment.id)}" data-payment-amount="${escapeHtml(payment.amount)}" data-payment-refunded="${escapeHtml(payment.amountRefunded)}" data-payment-currency="${escapeHtml(payment.currency)}">Buat refund</button>`,
    );
  }
  return actions.join('');
}

async function openPaymentDetail(paymentId) {
  openModal({
    title: 'Detail pembayaran',
    kicker: 'Payment',
    subtitle: 'Memuat informasi pembayaran...',
    body: tableLoading(5),
  });

  try {
    const result = await api(`/payments/${paymentId}`);
    const payment = result.data;
    const attempts = payment.attempts ?? [];
    const events = payment.events ?? [];
    const refunds = payment.refunds ?? [];

    const attemptsTable = attempts.length
      ? `
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Percobaan</th><th>Status</th><th>Reference</th><th>Waktu</th></tr></thead>
            <tbody>
              ${attempts
                .map(
                  (row) => `
                    <tr>
                      <td>#${formatNumber(row.attemptNumber)}</td>
                      <td>${statusBadge(row.status)}</td>
                      <td><span class="cell-code">${escapeHtml(row.providerReference ?? '-')}</span></td>
                      <td>${escapeHtml(formatDateTime(row.createdAt))}</td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>`
      : '<p class="cell-muted">Belum ada percobaan pembayaran.</p>';

    const eventsBlock = events.length
      ? `<div class="detail-list">${events
          .map(
            (row) =>
              detailRow(
                formatDateTime(row.createdAt),
                `${escapeHtml(PAYMENT_EVENT_LABELS[row.eventType] ?? row.eventType)}${row.note ? ` - ${escapeHtml(row.note)}` : ''}`,
              ),
          )
          .join('')}</div>`
      : '<p class="cell-muted">Belum ada event pembayaran.</p>';

    const refundsBlock = refunds.length
      ? `<div class="detail-list">${refunds
          .map(
            (row) =>
              detailRow(
                row.refundNumber,
                `${statusBadge(row.status)} - ${escapeHtml(formatMoney(row.amount, payment.currency))} - ${escapeHtml(formatDateTime(row.requestedAt))}`,
              ),
          )
          .join('')}</div>`
      : '<p class="cell-muted">Belum ada refund.</p>';

    openModal({
      title: payment.paymentNumber,
      kicker: 'Detail pembayaran',
      subtitle: `${payment.merchantName ?? 'Pedagang'} - ${formatDateTime(payment.createdAt)}`,
      wide: true,
      body: `
        <dl class="detail-list">
          ${detailRow('Status', statusBadge(payment.status))}
          ${detailRow('Pesanan', `${escapeHtml(payment.orderNumber ?? '-')} (${escapeHtml(statusLabel(payment.orderStatus))})`)}
          ${detailRow('Pelanggan', escapeHtml(payment.customerName ?? '-'))}
          ${detailRow('Kontak', `${escapeHtml(payment.customerPhone ?? '-')} ${payment.customerEmail ? `- ${escapeHtml(payment.customerEmail)}` : ''}`)}
          ${detailRow('Metode', `${escapeHtml(payment.methodName ?? '-')} - ${escapeHtml(payment.providerName ?? '-')}`)}
          ${detailRow('Nominal', escapeHtml(formatMoney(payment.amount, payment.currency)))}
          ${detailRow('Biaya / net', `${escapeHtml(formatMoney(payment.feeAmount, payment.currency))} / ${escapeHtml(formatMoney(payment.netAmount, payment.currency))}`)}
          ${detailRow('Dibayar / refund', `${escapeHtml(formatMoney(payment.amountPaid, payment.currency))} / ${escapeHtml(formatMoney(payment.amountRefunded, payment.currency))}`)}
          ${detailRow('Kedaluwarsa', escapeHtml(formatDateTime(payment.expiresAt)))}
          ${detailRow('Reference', escapeHtml(payment.externalReference ?? '-'))}
          ${payment.failureReason ? detailRow('Catatan gagal', escapeHtml(payment.failureReason)) : ''}
        </dl>
        <div class="panel-header" style="margin-top:24px"><div><p class="panel-kicker">Gateway</p><h3>Percobaan pembayaran</h3></div></div>
        ${attemptsTable}
        <div class="panel-header" style="margin-top:24px"><div><p class="panel-kicker">Timeline</p><h3>Event pembayaran</h3></div></div>
        ${eventsBlock}
        <div class="panel-header" style="margin-top:24px"><div><p class="panel-kicker">Refund</p><h3>Refund terkait</h3></div></div>
        ${refundsBlock}
      `,
      footer: `<button class="button button-ghost" type="button" data-modal-close>Tutup</button>${paymentActionButtons(payment)}`,
    });
  } catch (error) {
    showToast('Gagal memuat pembayaran', error.message, 'error');
    closeModal();
  }
}

async function confirmPayment(paymentId, paymentNumber) {
  try {
    await api(`/payments/${paymentId}/confirm`, {
      method: 'POST',
      body: { status: 'succeeded' },
    });
    closeModal();
    showToast('Pembayaran lunas', `${paymentNumber} berhasil dikonfirmasi.`);
    await loadPayments(true);
  } catch (error) {
    showToast('Gagal mengonfirmasi pembayaran', error.message, 'error');
  }
}

async function cancelPayment(paymentId, paymentNumber) {
  try {
    await api(`/payments/${paymentId}/cancel`, {
      method: 'POST',
      body: { note: 'Dibatalkan dari dashboard admin' },
    });
    closeModal();
    showToast('Pembayaran dibatalkan', `${paymentNumber} telah dibatalkan.`);
    await loadPayments(true);
  } catch (error) {
    showToast('Gagal membatalkan pembayaran', error.message, 'error');
  }
}

async function retryPayment(paymentId, paymentNumber) {
  try {
    await api(`/payments/${paymentId}/retry`, { method: 'POST', body: {} });
    closeModal();
    showToast('Percobaan baru dibuat', `${paymentNumber} siap dibayar kembali.`);
    await loadPayments(true);
  } catch (error) {
    showToast('Gagal mengulang pembayaran', error.message, 'error');
  }
}

function openRefundModal(paymentId, amount, refunded, currency) {
  const remaining = Math.max(0, Number(amount) - Number(refunded));
  const modal = openModal({
    title: 'Buat refund',
    kicker: 'Refund',
    subtitle: `Sisa yang dapat direfund ${formatMoney(remaining, currency)}.`,
    body: `
      <form id="payment-refund-form" class="form-grid">
        <label class="field field-span">
          <span>Nominal refund</span>
          <input name="amount" type="number" min="0.01" step="0.01" max="${remaining}" value="${remaining.toFixed(2)}" required />
        </label>
        <label class="field field-span">
          <span>Alasan</span>
          <textarea name="reason" rows="3" maxlength="2000" required placeholder="Jelaskan alasan refund..."></textarea>
        </label>
      </form>
    `,
    footer: `
      <button class="button button-ghost" type="button" data-modal-close>Batal</button>
      <button class="button button-primary" type="submit" form="payment-refund-form">Ajukan refund</button>
    `,
  });
  const form = modal?.querySelector('#payment-refund-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = modal.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    submit.disabled = true;
    try {
      await api(`/payments/${paymentId}/refunds`, {
        method: 'POST',
        body: {
          amount: String(formData.get('amount')),
          reason: String(formData.get('reason')),
        },
      });
      closeModal();
      showToast('Refund diajukan', 'Refund berhasil dibuat dan menunggu persetujuan.');
      await loadPayments(true);
    } catch (error) {
      showToast('Gagal membuat refund', error.message, 'error');
    } finally {
      submit.disabled = false;
    }
  });
}

async function openRefundDetail(refundId) {
  openModal({
    title: 'Detail refund',
    kicker: 'Refund',
    subtitle: 'Memuat informasi refund...',
    body: tableLoading(4),
  });
  try {
    const result = await api(`/payments/refunds/${refundId}`);
    const refund = result.data;
    const nextActions = state.canWritePayments ? (REFUND_NEXT_ACTIONS[refund.status] ?? []) : [];
    openModal({
      title: refund.refundNumber,
      kicker: 'Detail refund',
      subtitle: `${refund.merchantName ?? 'Pedagang'} - ${formatDateTime(refund.requestedAt)}`,
      wide: true,
      body: `
        <dl class="detail-list">
          ${detailRow('Status', statusBadge(refund.status))}
          ${detailRow('Pembayaran', escapeHtml(refund.paymentNumber ?? '-'))}
          ${detailRow('Pesanan', escapeHtml(refund.orderNumber ?? '-'))}
          ${detailRow('Pelanggan', escapeHtml(refund.customerName ?? '-'))}
          ${detailRow('Nominal', escapeHtml(formatMoney(refund.amount, refund.currency)))}
          ${detailRow('Alasan', escapeHtml(refund.reason))}
          ${detailRow('Retur', escapeHtml(refund.returnNumber ?? '-'))}
          ${detailRow('Reference', escapeHtml(refund.externalReference ?? '-'))}
          ${refund.failureReason ? detailRow('Catatan gagal', escapeHtml(refund.failureReason)) : ''}
        </dl>
      `,
      footer: `
        <button class="button button-ghost" type="button" data-modal-close>Tutup</button>
        ${nextActions
          .map(
            ([status, label]) =>
              `<button class="button ${status === 'cancelled' || status === 'rejected' || status === 'failed' ? 'button-ghost' : 'button-primary'}" type="button" data-refund-status="${escapeHtml(refund.id)}" data-next-status="${status}" data-refund-number="${escapeHtml(refund.refundNumber)}">${escapeHtml(label)}</button>`,
          )
          .join('')}
      `,
    });
  } catch (error) {
    showToast('Gagal memuat refund', error.message, 'error');
    closeModal();
  }
}

async function updateRefundStatus(refundId, status, refundNumber) {
  try {
    await api(`/payments/refunds/${refundId}/status`, {
      method: 'PATCH',
      body: { status },
    });
    closeModal();
    showToast('Status refund diperbarui', `${refundNumber} sekarang ${statusLabel(status).toLowerCase()}.`);
    await loadPayments(true);
  } catch (error) {
    showToast('Gagal memperbarui refund', error.message, 'error');
  }
}

async function openSettlementDetail(settlementId) {
  openModal({
    title: 'Detail settlement',
    kicker: 'Settlement',
    subtitle: 'Memuat informasi settlement...',
    body: tableLoading(5),
  });
  try {
    const result = await api(`/payments/settlements/${settlementId}`);
    const settlement = result.data;
    const items = settlement.items ?? [];
    const nextActions = state.canWritePayments
      ? (SETTLEMENT_NEXT_ACTIONS[settlement.status] ?? [])
      : [];
    const itemsTable = items.length
      ? `
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Pembayaran</th><th>Pesanan</th><th>Nominal</th><th>Biaya</th><th>Refund</th><th>Net</th></tr></thead>
            <tbody>
              ${items
                .map(
                  (row) => `
                    <tr>
                      <td>${escapeHtml(row.paymentNumber)}</td>
                      <td>${escapeHtml(row.orderNumber)}</td>
                      <td>${escapeHtml(formatMoney(row.amount, settlement.currency))}</td>
                      <td>${escapeHtml(formatMoney(row.feeAmount, settlement.currency))}</td>
                      <td>${escapeHtml(formatMoney(row.refundAmount, settlement.currency))}</td>
                      <td>${escapeHtml(formatMoney(row.netAmount, settlement.currency))}</td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>`
      : '<p class="cell-muted">Tidak ada item settlement.</p>';

    openModal({
      title: settlement.settlementNumber,
      kicker: 'Detail settlement',
      subtitle: `${settlement.merchantName ?? 'Pedagang'} - ${formatDate(settlement.periodStart)} s.d. ${formatDate(settlement.periodEnd)}`,
      wide: true,
      body: `
        <dl class="detail-list">
          ${detailRow('Status', statusBadge(settlement.status))}
          ${detailRow('Pedagang', escapeHtml(settlement.merchantName ?? '-'))}
          ${detailRow('Akun', escapeHtml(settlement.accountName ? `${settlement.accountName} - ${settlement.accountNumber}` : '-'))}
          ${detailRow('Gross / biaya', `${escapeHtml(formatMoney(settlement.grossAmount, settlement.currency))} / ${escapeHtml(formatMoney(settlement.feeAmount, settlement.currency))}`)}
          ${detailRow('Refund', escapeHtml(formatMoney(settlement.refundAmount, settlement.currency)))}
          ${detailRow('Net', escapeHtml(formatMoney(settlement.netAmount, settlement.currency)))}
          ${detailRow('Jumlah pembayaran', formatNumber(settlement.paymentCount))}
          ${settlement.notes ? detailRow('Catatan', escapeHtml(settlement.notes)) : ''}
        </dl>
        <div class="panel-header" style="margin-top:24px"><div><p class="panel-kicker">Rincian</p><h3>Pembayaran dalam settlement</h3></div></div>
        ${itemsTable}
      `,
      footer: `
        <button class="button button-ghost" type="button" data-modal-close>Tutup</button>
        ${nextActions
          .map(
            ([status, label]) =>
              `<button class="button ${status === 'cancelled' ? 'button-ghost' : 'button-primary'}" type="button" data-settlement-status="${escapeHtml(settlement.id)}" data-next-status="${status}" data-settlement-number="${escapeHtml(settlement.settlementNumber)}">${escapeHtml(label)}</button>`,
          )
          .join('')}
      `,
    });
  } catch (error) {
    showToast('Gagal memuat settlement', error.message, 'error');
    closeModal();
  }
}

async function updateSettlementStatus(settlementId, status, settlementNumber) {
  try {
    await api(`/payments/settlements/${settlementId}/status`, {
      method: 'PATCH',
      body: { status },
    });
    closeModal();
    showToast('Status settlement diperbarui', `${settlementNumber} sekarang ${statusLabel(status).toLowerCase()}.`);
    await loadPayments(true);
  } catch (error) {
    showToast('Gagal memperbarui settlement', error.message, 'error');
  }
}

async function openSettlementCreateModal() {
  let merchants = [];
  try {
    const result = await api('/merchants?page=1&limit=100&status=verified');
    merchants = result.data ?? [];
  } catch (error) {
    showToast('Gagal memuat pedagang', error.message, 'error');
    return;
  }
  if (!merchants.length) {
    showToast('Belum ada pedagang terverifikasi', 'Verifikasi pedagang terlebih dahulu.', 'error');
    return;
  }
  const now = new Date();
  const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const modal = openModal({
    title: 'Buat settlement',
    kicker: 'Settlement',
    subtitle: 'Pilih pedagang dan periode pembayaran yang akan disettlekan.',
    body: `
      <form id="settlement-form" class="form-grid">
        <label class="field field-span">
          <span>Pedagang</span>
          <select name="merchantId" required>
            ${merchants.map((row) => `<option value="${escapeHtml(row.id)}">${escapeHtml(row.businessName)}</option>`).join('')}
          </select>
        </label>
        <label class="field">
          <span>Periode mulai</span>
          <input name="periodStart" type="datetime-local" value="${dateTimeLocalValue(start)}" required />
        </label>
        <label class="field">
          <span>Periode akhir</span>
          <input name="periodEnd" type="datetime-local" value="${dateTimeLocalValue(now)}" required />
        </label>
        <label class="field field-span">
          <span>Catatan</span>
          <textarea name="notes" rows="2" maxlength="2000" placeholder="Opsional"></textarea>
        </label>
      </form>
    `,
    footer: `
      <button class="button button-ghost" type="button" data-modal-close>Batal</button>
      <button class="button button-primary" type="submit" form="settlement-form">Buat settlement</button>
    `,
  });
  const form = modal?.querySelector('#settlement-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = modal.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    submit.disabled = true;
    try {
      await api('/payments/settlements', {
        method: 'POST',
        body: {
          merchantId: String(formData.get('merchantId')),
          periodStart: new Date(String(formData.get('periodStart'))).toISOString(),
          periodEnd: new Date(String(formData.get('periodEnd'))).toISOString(),
          notes: String(formData.get('notes') || '') || undefined,
        },
      });
      closeModal();
      showToast('Settlement dibuat', 'Settlement berhasil dibuat sebagai draft.');
      await loadPayments(true);
    } catch (error) {
      showToast('Gagal membuat settlement', error.message, 'error');
    } finally {
      submit.disabled = false;
    }
  });
}

async function openReconciliationCreateModal() {
  const providers = state.payments?.providers?.data ?? [];
  if (!providers.length) {
    showToast('Provider belum tersedia', 'Tambahkan provider pembayaran terlebih dahulu.', 'error');
    return;
  }
  const now = new Date();
  const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const modal = openModal({
    title: 'Buat rekonsiliasi',
    kicker: 'Reconciliation',
    subtitle: 'Bandingkan total pembayaran internal dengan laporan provider.',
    body: `
      <form id="reconciliation-form" class="form-grid">
        <label class="field field-span">
          <span>Provider</span>
          <select name="providerId" required>
            ${providers.map((row) => `<option value="${escapeHtml(row.id)}">${escapeHtml(row.name)}</option>`).join('')}
          </select>
        </label>
        <label class="field">
          <span>Periode mulai</span>
          <input name="periodStart" type="datetime-local" value="${dateTimeLocalValue(start)}" required />
        </label>
        <label class="field">
          <span>Periode akhir</span>
          <input name="periodEnd" type="datetime-local" value="${dateTimeLocalValue(now)}" required />
        </label>
        <label class="field field-span">
          <span>Total eksternal (opsional)</span>
          <input name="externalAmount" type="number" min="0" step="0.01" placeholder="Kosongkan untuk memakai total internal" />
        </label>
        <label class="field field-span">
          <span>Catatan</span>
          <textarea name="notes" rows="2" maxlength="2000" placeholder="Opsional"></textarea>
        </label>
      </form>
    `,
    footer: `
      <button class="button button-ghost" type="button" data-modal-close>Batal</button>
      <button class="button button-primary" type="submit" form="reconciliation-form">Buat rekonsiliasi</button>
    `,
  });
  const form = modal?.querySelector('#reconciliation-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = modal.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    const externalAmount = String(formData.get('externalAmount') || '').trim();
    submit.disabled = true;
    try {
      await api('/payments/reconciliations', {
        method: 'POST',
        body: {
          providerId: String(formData.get('providerId')),
          periodStart: new Date(String(formData.get('periodStart'))).toISOString(),
          periodEnd: new Date(String(formData.get('periodEnd'))).toISOString(),
          externalAmount: externalAmount || undefined,
          notes: String(formData.get('notes') || '') || undefined,
        },
      });
      closeModal();
      showToast('Rekonsiliasi dibuat', 'Rekonsiliasi berhasil dijalankan.');
      await loadPayments(true);
    } catch (error) {
      showToast('Gagal membuat rekonsiliasi', error.message, 'error');
    } finally {
      submit.disabled = false;
    }
  });
}

async function openReconciliationDetail(reconciliationId) {
  openModal({
    title: 'Detail rekonsiliasi',
    kicker: 'Reconciliation',
    subtitle: 'Memuat informasi rekonsiliasi...',
    body: tableLoading(4),
  });
  try {
    const result = await api(`/payments/reconciliations/${reconciliationId}`);
    const row = result.data;
    const details = row.details ?? {};
    const paymentRows = Array.isArray(details.payments) ? details.payments : [];
    openModal({
      title: row.reconciliationNumber,
      kicker: 'Detail rekonsiliasi',
      subtitle: `${formatDate(row.periodStart)} s.d. ${formatDate(row.periodEnd)}`,
      wide: true,
      body: `
        <dl class="detail-list">
          ${detailRow('Status', statusBadge(row.status))}
          ${detailRow('Internal', escapeHtml(formatMoney(row.internalAmount, row.currency)))}
          ${detailRow('Eksternal', escapeHtml(formatMoney(row.externalAmount, row.currency)))}
          ${detailRow('Selisih', escapeHtml(formatMoney(row.differenceAmount, row.currency)))}
          ${detailRow('Cocok / tidak cocok', `${formatNumber(row.matchedCount)} / ${formatNumber(row.unmatchedCount)}`)}
          ${row.notes ? detailRow('Catatan', escapeHtml(row.notes)) : ''}
        </dl>
        <div class="panel-header" style="margin-top:24px"><div><p class="panel-kicker">Rincian</p><h3>Pembayaran dibandingkan</h3></div></div>
        ${
          paymentRows.length
            ? `<div class="table-wrap"><table class="table"><thead><tr><th>Pembayaran</th><th>Reference</th><th>Nominal</th><th>Status</th></tr></thead><tbody>${paymentRows
                .map(
                  (item) => `<tr><td>${escapeHtml(item.paymentNumber)}</td><td>${escapeHtml(item.externalReference ?? '-')}</td><td>${escapeHtml(formatMoney(item.amount, row.currency))}</td><td>${item.matched ? statusBadge('completed') : statusBadge('discrepancy')}</td></tr>`,
                )
                .join('')}</tbody></table></div>`
            : '<p class="cell-muted">Tidak ada pembayaran pada periode ini.</p>'
        }
      `,
      footer: '<button class="button button-ghost" type="button" data-modal-close>Tutup</button>',
    });
  } catch (error) {
    showToast('Gagal memuat rekonsiliasi', error.message, 'error');
    closeModal();
  }
}

async function openCreatePaymentProviderModal() {
  const modal = openModal({
    title: 'Tambah provider',
    kicker: 'Payment gateway',
    subtitle: 'Provider menjadi induk dari metode pembayaran.',
    body: `
      <form id="payment-provider-form" class="form-grid">
        <label class="field"><span>Kode</span><input name="code" required maxlength="64" placeholder="contoh: gateway_baru" /></label>
        <label class="field"><span>Nama</span><input name="name" required maxlength="128" placeholder="Nama provider" /></label>
        <label class="field"><span>Tipe</span><select name="type"><option value="gateway">Gateway</option><option value="bank">Bank</option><option value="ewallet">E-wallet</option><option value="qris">QRIS</option><option value="manual">Manual</option><option value="other">Lainnya</option></select></label>
        <label class="field"><span>Status</span><select name="status"><option value="active">Aktif</option><option value="inactive">Nonaktif</option></select></label>
        <label class="field field-span"><span>Deskripsi</span><textarea name="description" rows="2" maxlength="2000" placeholder="Opsional"></textarea></label>
      </form>
    `,
    footer: `
      <button class="button button-ghost" type="button" data-modal-close>Batal</button>
      <button class="button button-primary" type="submit" form="payment-provider-form">Simpan provider</button>
    `,
  });
  const form = modal?.querySelector('#payment-provider-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = modal.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    submit.disabled = true;
    try {
      await api('/payments/providers', {
        method: 'POST',
        body: {
          code: String(formData.get('code')),
          name: String(formData.get('name')),
          type: String(formData.get('type')),
          status: String(formData.get('status')),
          description: String(formData.get('description') || '') || undefined,
        },
      });
      closeModal();
      showToast('Provider dibuat', 'Provider pembayaran berhasil ditambahkan.');
      await loadPayments(true);
    } catch (error) {
      showToast('Gagal membuat provider', error.message, 'error');
    } finally {
      submit.disabled = false;
    }
  });
}

async function openCreatePaymentMethodModal() {
  const providers = state.payments?.providers?.data ?? [];
  if (!providers.length) {
    showToast('Provider belum tersedia', 'Tambahkan provider pembayaran terlebih dahulu.', 'error');
    return;
  }
  const modal = openModal({
    title: 'Tambah metode',
    kicker: 'Payment method',
    subtitle: 'Atur biaya dan batas nominal metode pembayaran.',
    body: `
      <form id="payment-method-form" class="form-grid">
        <label class="field field-span"><span>Provider</span><select name="providerId" required>${providers.map((row) => `<option value="${escapeHtml(row.id)}">${escapeHtml(row.name)}</option>`).join('')}</select></label>
        <label class="field"><span>Kode</span><input name="code" required maxlength="64" placeholder="contoh: qris_baru" /></label>
        <label class="field"><span>Nama</span><input name="name" required maxlength="128" placeholder="Nama metode" /></label>
        <label class="field"><span>Tipe</span><select name="type"><option value="qris">QRIS</option><option value="ewallet">E-wallet</option><option value="bank_transfer">Transfer bank</option><option value="virtual_account">Virtual account</option><option value="credit_card">Kartu kredit</option><option value="cash">Tunai</option><option value="other">Lainnya</option></select></label>
        <label class="field"><span>Status</span><select name="status"><option value="active">Aktif</option><option value="inactive">Nonaktif</option></select></label>
        <label class="field"><span>Biaya tetap</span><input name="feeFlat" type="number" min="0" step="0.01" value="0" /></label>
        <label class="field"><span>Biaya persen</span><input name="feePercent" type="number" min="0" step="0.01" value="0" /></label>
        <label class="field"><span>Minimum</span><input name="minimumAmount" type="number" min="0" step="0.01" value="0" /></label>
        <label class="field"><span>Maksimum</span><input name="maximumAmount" type="number" min="0" step="0.01" placeholder="Opsional" /></label>
        <label class="field field-span"><span>Instruksi</span><textarea name="instructions" rows="2" maxlength="4000" placeholder="Opsional"></textarea></label>
      </form>
    `,
    footer: `
      <button class="button button-ghost" type="button" data-modal-close>Batal</button>
      <button class="button button-primary" type="submit" form="payment-method-form">Simpan metode</button>
    `,
  });
  const form = modal?.querySelector('#payment-method-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = modal.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    const maximumAmount = String(formData.get('maximumAmount') || '').trim();
    submit.disabled = true;
    try {
      await api('/payments/methods', {
        method: 'POST',
        body: {
          providerId: String(formData.get('providerId')),
          code: String(formData.get('code')),
          name: String(formData.get('name')),
          type: String(formData.get('type')),
          status: String(formData.get('status')),
          feeFlat: String(formData.get('feeFlat') || '0'),
          feePercent: String(formData.get('feePercent') || '0'),
          minimumAmount: String(formData.get('minimumAmount') || '0'),
          maximumAmount: maximumAmount || undefined,
          instructions: String(formData.get('instructions') || '') || undefined,
        },
      });
      closeModal();
      showToast('Metode dibuat', 'Metode pembayaran berhasil ditambahkan.');
      await loadPayments(true);
    } catch (error) {
      showToast('Gagal membuat metode', error.message, 'error');
    } finally {
      submit.disabled = false;
    }
  });
}

async function togglePaymentMethod(methodId, nextStatus, methodName) {
  try {
    await api(`/payments/methods/${methodId}`, {
      method: 'PATCH',
      body: { status: nextStatus },
    });
    showToast(
      nextStatus === 'active' ? 'Metode diaktifkan' : 'Metode dinonaktifkan',
      `${methodName} sekarang ${statusLabel(nextStatus).toLowerCase()}.`,
    );
    await loadPayments(true);
  } catch (error) {
    showToast('Gagal memperbarui metode', error.message, 'error');
  }
}

async function openOrderDetail(orderId) {
  openModal({
    title: 'Detail pesanan',
    kicker: 'Order',
    subtitle: 'Memuat informasi pesanan...',
    body: tableLoading(5),
  });

  try {
    const result = await api(`/commerce/orders/${orderId}`);
    const order = result.data;
    const address = order.addresses?.[0];
    const next = ORDER_ACTIONS[order.status];
    const canCancel = CANCELLABLE_ORDER_STATUSES.includes(order.status);
    const items = order.items ?? [];
    const returns = order.returns ?? [];
    const transactions = order.transactions ?? [];
    const statusHistory = order.statusHistory ?? [];
    const notes = order.notes ?? [];

    const itemsTable = items.length
      ? `
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Produk</th><th>SKU</th><th>Qty</th><th>Harga</th><th>Total</th></tr></thead>
            <tbody>
              ${items
                .map(
                  (item) => `
                    <tr>
                      <td>${escapeHtml(item.productName)}</td>
                      <td>${escapeHtml(item.skuCode ?? '-')}</td>
                      <td>${formatNumber(item.quantity)}</td>
                      <td>${escapeHtml(formatMoney(item.unitPrice, item.currency))}</td>
                      <td>${escapeHtml(formatMoney(item.lineTotal, item.currency))}</td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>`
      : '<p class="cell-muted">Tidak ada item.</p>';

    const returnsBlock = returns.length
      ? `<div class="detail-list">${returns
          .map(
            (row) =>
              detailRow(
                row.returnNumber,
                `${statusBadge(row.status)} - ${escapeHtml(formatDateTime(row.requestedAt))} - ${escapeHtml(row.reason)}`,
              ),
          )
          .join('')}</div>`
      : '<p class="cell-muted">Belum ada retur.</p>';

    const transactionsBlock = transactions.length
      ? `<div class="detail-list">${transactions
          .map(
            (row) =>
              detailRow(
                row.transactionNumber,
                `${escapeHtml(TRANSACTION_TYPE_LABELS[row.type] ?? row.type)} - ${escapeHtml(formatMoney(row.amount, row.currency))} - ${escapeHtml(formatDateTime(row.occurredAt))}`,
              ),
          )
          .join('')}</div>`
      : '<p class="cell-muted">Belum ada transaksi.</p>';

    const notesBlock = notes.length
      ? `<div class="detail-list">${notes
          .map(
            (note) =>
              detailRow(
                note.visibility === 'internal' ? 'Internal' : 'Pelanggan',
                `${escapeHtml(note.body)} <span class="cell-muted">(${escapeHtml(note.authorName ?? '-')} - ${escapeHtml(formatDateTime(note.createdAt))})</span>`,
              ),
          )
          .join('')}</div>`
      : '<p class="cell-muted">Belum ada catatan.</p>';

    const historyBlock = statusHistory.length
      ? `<div class="detail-list">${statusHistory
          .map(
            (row) =>
              detailRow(
                formatDateTime(row.createdAt),
                `${row.fromStatus ? `${escapeHtml(statusLabel(row.fromStatus))} &rarr; ` : ''}${statusBadge(row.toStatus)}${row.note ? ` - ${escapeHtml(row.note)}` : ''}`,
              ),
          )
          .join('')}</div>`
      : '<p class="cell-muted">Belum ada riwayat status.</p>';

    openModal({
      title: order.orderNumber,
      kicker: 'Detail pesanan',
      subtitle: `${order.merchantName ?? 'Pedagang'} - ${formatDateTime(order.placedAt)}`,
      wide: true,
      body: `
        <dl class="detail-list">
          ${detailRow('Status', statusBadge(order.status))}
          ${detailRow('Pelanggan', escapeHtml(order.customerName ?? order.contactName ?? '-'))}
          ${detailRow('Kontak', `${escapeHtml(order.contactPhone ?? '-')} ${order.contactEmail ? `- ${escapeHtml(order.contactEmail)}` : ''}`)}
          ${detailRow('Pedagang', escapeHtml(order.merchantName ?? '-'))}
          ${detailRow('Storefront', escapeHtml(order.storefrontName ?? '-'))}
          ${detailRow('Total', `${escapeHtml(formatMoney(order.grandTotal, order.currency))} (${formatNumber(order.itemCount)} item)`)}
          ${detailRow(
            'Alamat kirim',
            address
              ? escapeHtml(
                  `${address.recipientName}, ${address.phone}, ${address.addressLine1}${address.addressLine2 ? `, ${address.addressLine2}` : ''}, ${address.city}, ${address.province} ${address.postalCode ?? ''}`,
                )
              : '-',
          )}
        </dl>
        <div class="panel-header" style="margin-top:24px">
          <div><p class="panel-kicker">Line item</p><h3>Item pesanan</h3></div>
        </div>
        ${itemsTable}
        <div class="panel-header" style="margin-top:24px">
          <div><p class="panel-kicker">Riwayat</p><h3>Status pesanan</h3></div>
        </div>
        ${historyBlock}
        <div class="panel-header" style="margin-top:24px">
          <div><p class="panel-kicker">Retur</p><h3>Pengajuan retur</h3></div>
        </div>
        ${returnsBlock}
        <div class="panel-header" style="margin-top:24px">
          <div><p class="panel-kicker">Ledger</p><h3>Transaksi</h3></div>
        </div>
        ${transactionsBlock}
        <div class="panel-header" style="margin-top:24px">
          <div><p class="panel-kicker">Catatan</p><h3>Catatan pesanan</h3></div>
        </div>
        ${notesBlock}
      `,
      footer: `
        <button class="button button-ghost" type="button" data-modal-close>Tutup</button>
        ${
          state.canWriteCommerce && next
            ? `<button class="button button-primary" type="button" data-order-status="${escapeHtml(order.id)}" data-next-status="${next.status}" data-order-number="${escapeHtml(order.orderNumber)}">${escapeHtml(next.label)}</button>`
            : ''
        }
        ${
          state.canWriteCommerce && canCancel
            ? `<button class="button button-ghost" type="button" data-order-cancel="${escapeHtml(order.id)}" data-order-number="${escapeHtml(order.orderNumber)}">Batalkan pesanan</button>`
            : ''
        }
      `,
    });
  } catch (error) {
    showToast('Gagal memuat pesanan', error.message, 'error');
    closeModal();
  }
}

async function updateOrderStatus(orderId, status, orderNumber) {
  try {
    await api(`/commerce/orders/${orderId}/status`, {
      method: 'PATCH',
      body: { status },
    });
    closeModal();
    showToast('Status pesanan diperbarui', `${orderNumber} sekarang ${statusLabel(status).toLowerCase()}.`);
    await loadOrders(true);
  } catch (error) {
    showToast('Gagal memperbarui pesanan', error.message, 'error');
  }
}

function openCancelOrderModal(orderId, orderNumber) {
  const modal = openModal({
    title: 'Batalkan pesanan',
    kicker: 'Order',
    subtitle: `${orderNumber} akan dibatalkan dan dicatat di ledger penjualan.`,
    body: `
      <form id="cancel-order-form" class="form-grid">
        <label class="field field-span">
          <span>Alasan pembatalan</span>
          <textarea name="reason" rows="3" maxlength="1000" required placeholder="Tuliskan alasan pembatalan..."></textarea>
        </label>
        <label class="field field-span">
          <span>Catatan internal (opsional)</span>
          <textarea name="notes" rows="2" maxlength="2000" placeholder="Catatan tambahan untuk tim..."></textarea>
        </label>
      </form>
    `,
    footer: `
      <button class="button button-ghost" type="button" data-modal-close>Batal</button>
      <button class="button button-primary" id="cancel-order-submit" type="submit" form="cancel-order-form">Batalkan pesanan</button>
    `,
  });

  const form = modal.querySelector('#cancel-order-form');
  const submit = modal.querySelector('#cancel-order-submit');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const reason = String(data.get('reason') ?? '').trim();
    const notes = String(data.get('notes') ?? '').trim();
    if (reason.length < 3) {
      form.querySelector('[name="reason"]').focus();
      return;
    }

    submit.disabled = true;
    submit.innerHTML = `<span class="spinner"></span> Memproses...`;
    try {
      await api(`/commerce/orders/${orderId}/cancel`, {
        method: 'POST',
        body: { reason, ...(notes ? { notes } : {}) },
      });
      closeModal();
      showToast('Pesanan dibatalkan', `${orderNumber} sudah dibatalkan.`);
      await loadOrders(true);
    } catch (error) {
      showToast('Gagal membatalkan pesanan', error.message, 'error');
    } finally {
      submit.disabled = false;
      submit.innerHTML = 'Batalkan pesanan';
    }
  });
}

async function openReturnDetail(returnId) {
  openModal({
    title: 'Detail retur',
    kicker: 'Return',
    subtitle: 'Memuat informasi retur...',
    body: tableLoading(4),
  });

  try {
    const result = await api(`/commerce/returns/${returnId}`);
    const ret = result.data;
    const items = ret.items ?? [];
    const actions = state.canWriteCommerce ? RETURN_ACTIONS[ret.status] ?? [] : [];

    const itemsTable = items.length
      ? `
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Produk</th><th>Qty</th><th>Kondisi</th><th>Total</th></tr></thead>
            <tbody>
              ${items
                .map(
                  (item) => `
                    <tr>
                      <td>
                        <div class="cell-title">${escapeHtml(item.productName)}</div>
                        <div class="cell-muted">${escapeHtml(item.skuCode ?? '-')}${item.reason ? ` - ${escapeHtml(item.reason)}` : ''}</div>
                      </td>
                      <td>${formatNumber(item.quantity)}</td>
                      <td>${escapeHtml(statusLabel(item.condition))}</td>
                      <td>${escapeHtml(formatMoney(item.lineTotal, ret.currency ?? 'IDR'))}</td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>`
      : '<p class="cell-muted">Tidak ada item retur.</p>';

    openModal({
      title: ret.returnNumber,
      kicker: 'Detail retur',
      subtitle: `${ret.orderNumber} - ${ret.customerName ?? '-'}`,
      wide: true,
      body: `
        <dl class="detail-list">
          ${detailRow('Status', statusBadge(ret.status))}
          ${detailRow('Pesanan', escapeHtml(ret.orderNumber))}
          ${detailRow('Pedagang', escapeHtml(ret.merchantName ?? '-'))}
          ${detailRow('Pelanggan', escapeHtml(ret.customerName ?? '-'))}
          ${detailRow('Diajukan', escapeHtml(formatDateTime(ret.requestedAt)))}
          ${detailRow('Alasan', escapeHtml(ret.reason))}
          ${detailRow('Catatan resolusi', escapeHtml(ret.resolutionNote ?? '-'))}
          ${detailRow('Disetujui', escapeHtml(formatDateTime(ret.approvedAt)))}
          ${detailRow('Diterima', escapeHtml(formatDateTime(ret.receivedAt)))}
          ${detailRow('Selesai', escapeHtml(formatDateTime(ret.completedAt)))}
        </dl>
        <div class="panel-header" style="margin-top:24px">
          <div><p class="panel-kicker">Return item</p><h3>Item retur</h3></div>
        </div>
        ${itemsTable}
      `,
      footer: `
        <button class="button button-ghost" type="button" data-modal-close>Tutup</button>
        ${actions
          .map(
            (action) =>
              `<button class="button ${action.status === 'rejected' || action.status === 'cancelled' ? 'button-ghost' : 'button-primary'}" type="button" data-return-status="${escapeHtml(ret.id)}" data-next-status="${action.status}" data-return-number="${escapeHtml(ret.returnNumber)}">${escapeHtml(action.label)}</button>`,
          )
          .join('')}
      `,
    });
  } catch (error) {
    showToast('Gagal memuat retur', error.message, 'error');
    closeModal();
  }
}

async function updateReturnStatus(returnId, status, returnNumber) {
  try {
    await api(`/commerce/returns/${returnId}/status`, {
      method: 'PATCH',
      body: { status },
    });
    closeModal();
    showToast('Status retur diperbarui', `${returnNumber} sekarang ${statusLabel(status).toLowerCase()}.`);
    await loadOrders(true);
  } catch (error) {
    showToast('Gagal memperbarui retur', error.message, 'error');
  }
}

/* ---------------------------------- POS ------------------------------- */

const POS_PAYMENT_METHOD_LABELS = {
  cash: 'Tunai',
  qris: 'QRIS',
  debit_card: 'Kartu debit',
  credit_card: 'Kartu kredit',
  ewallet: 'E-wallet',
  bank_transfer: 'Transfer bank',
  other: 'Lainnya',
};

const POS_CASH_MOVEMENT_LABELS = {
  opening: 'Saldo awal',
  sale: 'Penjualan tunai',
  refund: 'Refund / pembatalan',
  cash_in: 'Kas masuk',
  cash_out: 'Kas keluar',
  adjustment: 'Penyesuaian',
};

function posPaymentMethodLabel(value) {
  return POS_PAYMENT_METHOD_LABELS[value] ?? value ?? '-';
}

function posCashMovementLabel(value) {
  return POS_CASH_MOVEMENT_LABELS[value] ?? value ?? '-';
}

function posProductOptions(productList, selectedId = '') {
  return (
    '<option value="">Pilih produk</option>' +
    productList
      .map(
        (product) =>
          `<option value="${escapeHtml(product.id)}" ${product.id === selectedId ? 'selected' : ''}>${escapeHtml(product.name)} - ${escapeHtml(product.merchantName ?? '')}</option>`,
      )
      .join('')
  );
}

function posTerminalOptions(terminalList, selectedId = '') {
  return (
    '<option value="">Pilih terminal</option>' +
    terminalList
      .map(
        (terminal) =>
          `<option value="${escapeHtml(terminal.id)}" ${terminal.id === selectedId ? 'selected' : ''}>${escapeHtml(terminal.code)} - ${escapeHtml(terminal.name)}</option>`,
      )
      .join('')
  );
}

function posRegisterOptions(registerList, selectedId = '', terminalId = '') {
  const filtered = terminalId
    ? registerList.filter(
        (register) => !register.terminalId || register.terminalId === terminalId,
      )
    : registerList;
  return (
    '<option value="">Pilih cash register</option>' +
    filtered
      .map(
        (register) =>
          `<option value="${escapeHtml(register.id)}" ${register.id === selectedId ? 'selected' : ''}>${escapeHtml(register.code)} - ${escapeHtml(register.name)}</option>`,
      )
      .join('')
  );
}

async function loadPos(force = false) {
  const sequence = ++state.sequences.pos;
  const filters = state.filters.pos;

  if (!state.pos || force) {
    $('#pos-terminals-table').innerHTML = tableLoading(3);
    $('#pos-registers-table').innerHTML = tableLoading(3);
    $('#pos-shifts-table').innerHTML = tableLoading(3);
    $('#pos-transactions-table').innerHTML = tableLoading(4);
    $('#pos-sync-table').innerHTML = tableLoading(3);
  }
  $('#pos-terminal-count').textContent = 'Memuat...';
  $('#pos-register-count').textContent = 'Memuat...';
  $('#pos-shift-count').textContent = 'Memuat...';
  $('#pos-transaction-count').textContent = 'Memuat...';
  $('#pos-sync-count').textContent = 'Memuat...';
  setSpinner('#refresh-pos-transactions', true);

  try {
    const [terminals, registers, shifts, transactions, syncLogs] = await Promise.all([
      api(
        `/pos/terminals${buildQuery({
          limit: 100,
          search: filters.terminalSearch,
          status: filters.terminalStatus,
        })}`,
      ),
      api(
        `/pos/registers${buildQuery({
          limit: 100,
          search: filters.registerSearch,
        })}`,
      ),
      api(
        `/pos/shifts${buildQuery({
          limit: 100,
          search: filters.shiftSearch,
          status: filters.shiftStatus,
        })}`,
      ),
      api(
        `/pos/transactions${buildQuery({
          limit: 100,
          search: filters.transactionSearch,
          status: filters.transactionStatus,
          syncStatus: filters.transactionSync,
        })}`,
      ),
      api(
        `/pos/sync-logs${buildQuery({
          limit: 100,
          search: filters.syncSearch,
          status: filters.syncStatus,
        })}`,
      ),
    ]);
    if (sequence !== state.sequences.pos) return;
    state.pos = { terminals, registers, shifts, transactions, syncLogs };
    renderPos();
  } catch (error) {
    if (sequence !== state.sequences.pos) return;
    for (const selector of [
      '#pos-terminal-count',
      '#pos-register-count',
      '#pos-shift-count',
      '#pos-transaction-count',
      '#pos-sync-count',
    ]) {
      $(selector).textContent = 'Gagal memuat';
    }
    for (const selector of [
      '#pos-terminals-table',
      '#pos-registers-table',
      '#pos-shifts-table',
      '#pos-transactions-table',
      '#pos-sync-table',
    ]) {
      $(selector).innerHTML = errorState(error.message, 'data-retry-pos');
    }
  } finally {
    if (sequence === state.sequences.pos) setSpinner('#refresh-pos-transactions', false);
  }
}

function renderPos() {
  const data = state.pos;
  if (!data) return;

  const terminals = data.terminals.data ?? [];
  const registers = data.registers.data ?? [];
  const shifts = data.shifts.data ?? [];
  const transactions = data.transactions.data ?? [];
  const syncLogs = data.syncLogs.data ?? [];
  const terminalTotal = Number(data.terminals.meta?.total ?? terminals.length);
  const registerTotal = Number(data.registers.meta?.total ?? registers.length);
  const shiftTotal = Number(data.shifts.meta?.total ?? shifts.length);
  const transactionTotal = Number(data.transactions.meta?.total ?? transactions.length);
  const syncTotal = Number(data.syncLogs.meta?.total ?? syncLogs.length);
  const openShifts = shifts.filter((row) => row.status === 'open').length;

  $('#pos-terminal-count').textContent = `${formatNumber(terminalTotal)} terminal`;
  $('#pos-register-count').textContent = `${formatNumber(registerTotal)} register`;
  $('#pos-shift-count').textContent = `${formatNumber(shiftTotal)} shift`;
  $('#pos-transaction-count').textContent = `${formatNumber(transactionTotal)} transaksi`;
  $('#pos-sync-count').textContent = `${formatNumber(syncTotal)} log`;

  const setBadge = (selector, count, label) => {
    const badge = $(selector);
    if (!badge) return;
    badge.hidden = count === 0;
    badge.textContent = `${formatNumber(count)} ${label}`;
  };
  setBadge('#pos-terminal-count-badge', terminalTotal, 'terminal');
  setBadge('#pos-register-count-badge', registerTotal, 'register');
  setBadge('#pos-shift-count-badge', shiftTotal, 'shift');
  setBadge('#pos-transaction-count-badge', transactionTotal, 'transaksi');
  setBadge('#pos-sync-count-badge', syncTotal, 'log');
  setBadge('#pos-open-shift-badge', openShifts, 'shift terbuka');

  if (!terminals.length) {
    $('#pos-terminals-table').innerHTML = emptyState(
      'Belum ada terminal POS',
      state.filters.pos.terminalSearch || state.filters.pos.terminalStatus
        ? 'Coba ubah kata kunci atau filter status.'
        : 'Tambahkan terminal untuk mulai mencatat penjualan toko fisik.',
    );
  } else {
    $('#pos-terminals-table').innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Terminal</th><th>Pedagang / toko</th><th>Lokasi</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            ${terminals
              .map(
                (row) => `
                  <tr>
                    <td>
                      <div class="cell-title">${escapeHtml(row.name)}</div>
                      <div class="cell-muted">${escapeHtml(row.code)}</div>
                    </td>
                    <td>
                      <div class="cell-title">${escapeHtml(row.merchantName)}</div>
                      <div class="cell-muted">${escapeHtml(row.storeName)}</div>
                    </td>
                    <td>
                      <div class="cell-title">${escapeHtml(row.location ?? '-')}</div>
                      <div class="cell-muted">${escapeHtml(row.deviceIdentifier ?? 'Tanpa device ID')}</div>
                    </td>
                    <td>${statusBadge(row.status)}</td>
                    <td>
                      <button class="action-link" type="button" data-pos-terminal-edit="${escapeHtml(row.id)}">
                        ${icon('arrow-right')} Ubah
                      </button>
                    </td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  if (!registers.length) {
    $('#pos-registers-table').innerHTML = emptyState(
      'Belum ada cash register',
      state.filters.pos.registerSearch
        ? 'Coba ubah kata kunci pencarian.'
        : 'Cash register mewakili laci kas pada terminal POS.',
    );
  } else {
    $('#pos-registers-table').innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Register</th><th>Terminal</th><th>Pedagang / toko</th><th>Shift aktif</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            ${registers
              .map(
                (row) => `
                  <tr>
                    <td>
                      <div class="cell-title">${escapeHtml(row.name)}</div>
                      <div class="cell-muted">${escapeHtml(row.code)}</div>
                    </td>
                    <td>
                      <div class="cell-title">${escapeHtml(row.terminalCode ?? '-')}</div>
                      <div class="cell-muted">${escapeHtml(row.terminalName ?? 'Tanpa terminal')}</div>
                    </td>
                    <td>
                      <div class="cell-title">${escapeHtml(row.merchantName)}</div>
                      <div class="cell-muted">${escapeHtml(row.storeName)}</div>
                    </td>
                    <td>
                      ${row.activeShiftNumber ? `<div class="cell-title">${escapeHtml(row.activeShiftNumber)}</div><div class="cell-muted">${escapeHtml(row.activeCashierName ?? '-')}</div>` : '<span class="cell-muted">Tidak ada</span>'}
                    </td>
                    <td>${statusBadge(row.status)}</td>
                    <td>
                      <button class="action-link" type="button" data-pos-register-edit="${escapeHtml(row.id)}">
                        ${icon('arrow-right')} Ubah
                      </button>
                    </td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  if (!shifts.length) {
    $('#pos-shifts-table').innerHTML = emptyState(
      'Belum ada shift kasir',
      state.filters.pos.shiftSearch || state.filters.pos.shiftStatus
        ? 'Coba ubah kata kunci atau filter status.'
        : 'Buka shift sebelum kasir membuat transaksi POS.',
    );
  } else {
    $('#pos-shifts-table').innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Shift</th><th>Kasir</th><th>Terminal / register</th><th>Penjualan</th><th>Kas</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            ${shifts
              .map(
                (row) => `
                  <tr>
                    <td>
                      <div class="cell-title">${escapeHtml(row.shiftNumber)}</div>
                      <div class="cell-muted">${escapeHtml(formatDateTime(row.openedAt))}</div>
                    </td>
                    <td>
                      <div class="cell-title">${escapeHtml(row.cashierName)}</div>
                      <div class="cell-muted">${escapeHtml(row.cashierEmail ?? '-')}</div>
                    </td>
                    <td>
                      <div class="cell-title">${escapeHtml(row.terminalCode)}</div>
                      <div class="cell-muted">${escapeHtml(row.registerCode)}</div>
                    </td>
                    <td>
                      <div class="cell-title">${escapeHtml(formatMoney(row.totalSales))}</div>
                      <div class="cell-muted">${formatNumber(row.transactionCount)} transaksi</div>
                    </td>
                    <td>
                      <div class="cell-title">${escapeHtml(formatMoney(row.expectedCash))}</div>
                      <div class="cell-muted">Awal ${escapeHtml(formatMoney(row.openingFloat))}</div>
                    </td>
                    <td>${statusBadge(row.status)}</td>
                    <td>
                      <div class="row-actions">
                        <button class="action-link" type="button" data-pos-shift-detail="${escapeHtml(row.id)}">${icon('arrow-right')} Detail</button>
                        ${row.status === 'open' && state.canWritePos ? `<button class="action-link" type="button" data-pos-shift-close="${escapeHtml(row.id)}" data-pos-shift-number="${escapeHtml(row.shiftNumber)}">Tutup</button>` : ''}
                      </div>
                    </td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  if (!transactions.length) {
    $('#pos-transactions-table').innerHTML = emptyState(
      'Belum ada transaksi POS',
      state.filters.pos.transactionSearch ||
        state.filters.pos.transactionStatus ||
        state.filters.pos.transactionSync
        ? 'Coba ubah kata kunci atau filter.'
        : 'Transaksi muncul setelah dibuat dari terminal POS atau sinkronisasi offline.',
    );
  } else {
    $('#pos-transactions-table').innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Transaksi</th><th>Pelanggan</th><th>Terminal / kasir</th><th>Total</th><th>Metode</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            ${transactions
              .map(
                (row) => `
                  <tr>
                    <td>
                      <div class="cell-title">${escapeHtml(row.transactionNumber)}</div>
                      <div class="cell-muted">${escapeHtml(formatDateTime(row.completedAt))}</div>
                      ${row.clientTransactionId ? `<div class="cell-muted">Offline: ${escapeHtml(row.clientTransactionId)}</div>` : ''}
                    </td>
                    <td>
                      <div class="cell-title">${escapeHtml(row.customerName ?? 'Pelanggan umum')}</div>
                      <div class="cell-muted">${formatNumber(row.itemCount)} item${row.customerPhone ? ` - ${escapeHtml(row.customerPhone)}` : ''}</div>
                    </td>
                    <td>
                      <div class="cell-title">${escapeHtml(row.terminalCode)}</div>
                      <div class="cell-muted">${escapeHtml(row.registerCode)} - ${escapeHtml(row.cashierName)}</div>
                    </td>
                    <td>
                      <div class="cell-title">${escapeHtml(formatMoney(row.total, row.currency))}</div>
                      <div class="cell-muted">Bayar ${escapeHtml(formatMoney(row.paidAmount, row.currency))}</div>
                    </td>
                    <td>
                      <div class="cell-title">${escapeHtml(posPaymentMethodLabel(row.paymentMethod))}</div>
                      <div class="cell-muted">${statusBadge(row.syncStatus)}</div>
                    </td>
                    <td>${statusBadge(row.status)}</td>
                    <td>
                      <div class="row-actions">
                        <button class="action-link" type="button" data-pos-transaction-detail="${escapeHtml(row.id)}">${icon('arrow-right')} Detail</button>
                        ${row.status === 'completed' && state.canWritePos ? `<button class="action-link" type="button" data-pos-transaction-void="${escapeHtml(row.id)}" data-pos-transaction-number="${escapeHtml(row.transactionNumber)}">Batalkan</button>` : ''}
                        ${row.syncStatus !== 'synced' && state.canManagePos ? `<button class="action-link" type="button" data-pos-transaction-sync="${escapeHtml(row.id)}" data-pos-transaction-number="${escapeHtml(row.transactionNumber)}">Sinkron</button>` : ''}
                      </div>
                    </td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  if (!syncLogs.length) {
    $('#pos-sync-table').innerHTML = emptyState(
      'Belum ada log sinkronisasi',
      state.filters.pos.syncSearch || state.filters.pos.syncStatus
        ? 'Coba ubah kata kunci atau filter status.'
        : 'Log muncul saat transaksi POS dibuat atau diunggah dari mode offline.',
    );
  } else {
    $('#pos-sync-table').innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Waktu</th><th>Terminal</th><th>Status</th><th>Record</th><th>Pesan</th></tr></thead>
          <tbody>
            ${syncLogs
              .map(
                (row) => `
                  <tr>
                    <td>
                      <div class="cell-title">${escapeHtml(formatDateTime(row.createdAt))}</div>
                      <div class="cell-muted">${escapeHtml(row.direction === 'upload' ? 'Upload' : 'Download')}</div>
                    </td>
                    <td>
                      <div class="cell-title">${escapeHtml(row.terminalCode)}</div>
                      <div class="cell-muted">${escapeHtml(row.merchantName)}</div>
                    </td>
                    <td>${statusBadge(row.status)}</td>
                    <td>${formatNumber(row.recordsCount)}</td>
                    <td>
                      <div class="cell-title">${escapeHtml(row.message ?? '-')}</div>
                      <div class="cell-muted">${escapeHtml(row.transactionNumber ?? 'Batch')}</div>
                    </td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }
}

async function fillPosStoreOptions(merchantId, select, selectedId = '') {
  select.innerHTML = '<option value="">Pilih toko</option>';
  if (!merchantId) return;
  const result = await api(`/merchants/${merchantId}/stores?limit=100`);
  select.innerHTML =
    '<option value="">Pilih toko</option>' +
    (result.data ?? [])
      .map(
        (store) =>
          `<option value="${escapeHtml(store.id)}" ${store.id === selectedId ? 'selected' : ''}>${escapeHtml(store.name)}</option>`,
      )
      .join('');
}

async function openPosTerminalModal(terminalId) {
  openModal({
    title: terminalId ? 'Ubah terminal POS' : 'Tambah terminal POS',
    kicker: 'Perangkat',
    subtitle: 'Memuat daftar pedagang...',
    body: tableLoading(3),
  });
  try {
    const merchants = await api('/merchants?limit=100');
    const merchantList = merchants.data ?? [];
    if (!merchantList.length) {
      closeModal();
      showToast('Pedagang belum tersedia', 'Tambahkan pedagang sebelum membuat terminal POS.', 'error');
      return;
    }
    const record = terminalId
      ? (state.pos?.terminals?.data ?? []).find((row) => row.id === terminalId)
      : null;
    const selectedMerchantId = record?.merchantId ?? merchantList[0].id;
    const modal = openModal({
      title: terminalId ? 'Ubah terminal POS' : 'Tambah terminal POS',
      kicker: 'Perangkat',
      subtitle: terminalId
        ? 'Perbarui identitas dan status perangkat kasir.'
        : 'Terminal POS mewakili perangkat kasir pada satu toko.',
      body: `
        <form id="pos-terminal-form" class="form-grid">
          <label class="field field-span">
            <span>Pedagang *</span>
            <select name="merchantId" id="pos-terminal-merchant" required ${terminalId ? 'disabled' : ''}>
              ${merchantList
                .map(
                  (merchant) =>
                    `<option value="${escapeHtml(merchant.id)}" ${merchant.id === selectedMerchantId ? 'selected' : ''}>${escapeHtml(merchant.businessName)}</option>`,
                )
                .join('')}
            </select>
          </label>
          <label class="field field-span">
            <span>Toko *</span>
            <select name="storeId" id="pos-terminal-store" required></select>
          </label>
          <label class="field">
            <span>Kode terminal</span>
            <input name="code" type="text" maxlength="64" value="${escapeHtml(record?.code ?? '')}" placeholder="Otomatis jika kosong" />
          </label>
          <label class="field">
            <span>Status</span>
            <select name="status">
              <option value="active" ${record?.status === 'active' || !record ? 'selected' : ''}>Aktif</option>
              <option value="maintenance" ${record?.status === 'maintenance' ? 'selected' : ''}>Pemeliharaan</option>
              <option value="inactive" ${record?.status === 'inactive' ? 'selected' : ''}>Nonaktif</option>
            </select>
          </label>
          <label class="field field-span">
            <span>Nama terminal *</span>
            <input name="name" type="text" maxlength="255" required value="${escapeHtml(record?.name ?? '')}" placeholder="Contoh: Kasir utama" />
          </label>
          <label class="field field-span">
            <span>Lokasi</span>
            <input name="location" type="text" maxlength="255" value="${escapeHtml(record?.location ?? '')}" placeholder="Contoh: Depan gerai" />
          </label>
          <label class="field field-span">
            <span>Device identifier</span>
            <input name="deviceIdentifier" type="text" maxlength="128" value="${escapeHtml(record?.deviceIdentifier ?? '')}" placeholder="Android POS-01 / tablet kasir" />
          </label>
        </form>
      `,
      footer: `
        <button class="button button-ghost" type="button" data-modal-close>Batal</button>
        <button class="button button-primary" id="pos-terminal-submit" type="submit" form="pos-terminal-form">
          ${icon('plus')} ${terminalId ? 'Simpan perubahan' : 'Simpan terminal'}
        </button>
      `,
    });
    const form = modal.querySelector('#pos-terminal-form');
    const merchantSelect = modal.querySelector('#pos-terminal-merchant');
    const storeSelect = modal.querySelector('#pos-terminal-store');
    const submit = modal.querySelector('#pos-terminal-submit');

    await fillPosStoreOptions(selectedMerchantId, storeSelect, record?.storeId ?? '');
    merchantSelect.addEventListener('change', async () => {
      await fillPosStoreOptions(merchantSelect.value, storeSelect);
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const payload = {
        storeId: String(data.get('storeId') ?? ''),
        name: String(data.get('name') ?? '').trim(),
        location: String(data.get('location') ?? '').trim() || undefined,
        deviceIdentifier: String(data.get('deviceIdentifier') ?? '').trim() || undefined,
        status: String(data.get('status') ?? 'active'),
      };
      const code = String(data.get('code') ?? '').trim();
      if (!payload.storeId || payload.name.length < 2) {
        showToast('Data belum lengkap', 'Pilih toko dan isi nama terminal.', 'error');
        return;
      }
      if (!terminalId) {
        payload.merchantId = String(data.get('merchantId') ?? '');
        if (code) payload.code = code;
      }
      submit.disabled = true;
      try {
        await api(terminalId ? `/pos/terminals/${terminalId}` : '/pos/terminals', {
          method: terminalId ? 'PATCH' : 'POST',
          body: payload,
        });
        closeModal();
        showToast('Terminal tersimpan', `${payload.name} berhasil disimpan.`);
        await loadPos(true);
      } catch (error) {
        showToast('Gagal menyimpan terminal', error.message, 'error');
      } finally {
        submit.disabled = false;
      }
    });
  } catch (error) {
    closeModal();
    showToast('Gagal memuat terminal', error.message, 'error');
  }
}

async function openPosRegisterModal(registerId) {
  openModal({
    title: registerId ? 'Ubah cash register' : 'Tambah cash register',
    kicker: 'Laci kas',
    subtitle: 'Memuat data terminal...',
    body: tableLoading(3),
  });
  try {
    const merchants = await api('/merchants?limit=100');
    const merchantList = merchants.data ?? [];
    if (!merchantList.length) {
      closeModal();
      showToast('Pedagang belum tersedia', 'Tambahkan pedagang sebelum membuat cash register.', 'error');
      return;
    }
    const record = registerId
      ? (state.pos?.registers?.data ?? []).find((row) => row.id === registerId)
      : null;
    const selectedMerchantId = record?.merchantId ?? merchantList[0].id;
    const terminalsResult = await api(
      `/pos/terminals?limit=100&merchantId=${encodeURIComponent(selectedMerchantId)}`,
    );
    let terminalList = terminalsResult.data ?? [];
    const modal = openModal({
      title: registerId ? 'Ubah cash register' : 'Tambah cash register',
      kicker: 'Laci kas',
      subtitle: 'Cash register menampung shift kasir dan pergerakan uang tunai.',
      body: `
        <form id="pos-register-form" class="form-grid">
          <label class="field field-span">
            <span>Pedagang *</span>
            <select name="merchantId" id="pos-register-merchant" required ${registerId ? 'disabled' : ''}>
              ${merchantList
                .map(
                  (merchant) =>
                    `<option value="${escapeHtml(merchant.id)}" ${merchant.id === selectedMerchantId ? 'selected' : ''}>${escapeHtml(merchant.businessName)}</option>`,
                )
                .join('')}
            </select>
          </label>
          <label class="field field-span">
            <span>Toko *</span>
            <select name="storeId" id="pos-register-store" required></select>
          </label>
          <label class="field field-span">
            <span>Terminal POS</span>
            <select name="terminalId" id="pos-register-terminal"></select>
          </label>
          <label class="field">
            <span>Kode register</span>
            <input name="code" type="text" maxlength="64" value="${escapeHtml(record?.code ?? '')}" placeholder="Otomatis jika kosong" />
          </label>
          <label class="field">
            <span>Status</span>
            <select name="status">
              <option value="active" ${record?.status === 'active' || !record ? 'selected' : ''}>Aktif</option>
              <option value="inactive" ${record?.status === 'inactive' ? 'selected' : ''}>Nonaktif</option>
            </select>
          </label>
          <label class="field field-span">
            <span>Nama register *</span>
            <input name="name" type="text" maxlength="255" required value="${escapeHtml(record?.name ?? '')}" placeholder="Contoh: Laci kasir utama" />
          </label>
          <label class="field field-span">
            <span>Catatan</span>
            <textarea name="notes" rows="3" maxlength="2000">${escapeHtml(record?.notes ?? '')}</textarea>
          </label>
        </form>
      `,
      footer: `
        <button class="button button-ghost" type="button" data-modal-close>Batal</button>
        <button class="button button-primary" id="pos-register-submit" type="submit" form="pos-register-form">
          ${icon('plus')} ${registerId ? 'Simpan perubahan' : 'Simpan register'}
        </button>
      `,
    });
    const form = modal.querySelector('#pos-register-form');
    const merchantSelect = modal.querySelector('#pos-register-merchant');
    const storeSelect = modal.querySelector('#pos-register-store');
    const terminalSelect = modal.querySelector('#pos-register-terminal');
    const submit = modal.querySelector('#pos-register-submit');

    const renderTerminals = (selectedId = record?.terminalId ?? '') => {
      terminalSelect.innerHTML = posTerminalOptions(
        terminalList.filter(
          (terminal) => !storeSelect.value || terminal.storeId === storeSelect.value,
        ),
        selectedId,
      );
    };

    await fillPosStoreOptions(selectedMerchantId, storeSelect, record?.storeId ?? '');
    renderTerminals();
    storeSelect.addEventListener('change', () => renderTerminals());
    merchantSelect.addEventListener('change', async () => {
      await fillPosStoreOptions(merchantSelect.value, storeSelect);
      const result = await api(
        `/pos/terminals?limit=100&merchantId=${encodeURIComponent(merchantSelect.value)}`,
      );
      terminalList = result.data ?? [];
      renderTerminals('');
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const payload = {
        storeId: String(data.get('storeId') ?? ''),
        terminalId: String(data.get('terminalId') ?? '') || null,
        name: String(data.get('name') ?? '').trim(),
        status: String(data.get('status') ?? 'active'),
        notes: String(data.get('notes') ?? '').trim() || undefined,
      };
      const code = String(data.get('code') ?? '').trim();
      if (!payload.storeId || payload.name.length < 2) {
        showToast('Data belum lengkap', 'Pilih toko dan isi nama register.', 'error');
        return;
      }
      if (!registerId) {
        payload.merchantId = String(data.get('merchantId') ?? '');
        if (code) payload.code = code;
      }
      submit.disabled = true;
      try {
        await api(registerId ? `/pos/registers/${registerId}` : '/pos/registers', {
          method: registerId ? 'PATCH' : 'POST',
          body: payload,
        });
        closeModal();
        showToast('Cash register tersimpan', `${payload.name} berhasil disimpan.`);
        await loadPos(true);
      } catch (error) {
        showToast('Gagal menyimpan cash register', error.message, 'error');
      } finally {
        submit.disabled = false;
      }
    });
  } catch (error) {
    closeModal();
    showToast('Gagal memuat cash register', error.message, 'error');
  }
}

async function openPosShiftModal() {
  try {
    const [terminalsResult, registersResult] = await Promise.all([
      api('/pos/terminals?limit=100&status=active'),
      api('/pos/registers?limit=100&status=active'),
    ]);
    const terminals = terminalsResult.data ?? [];
    const registers = (registersResult.data ?? []).filter((row) => !row.activeShiftId);
    if (!terminals.length || !registers.length) {
      showToast(
        'Belum dapat membuka shift',
        'Pastikan terminal aktif dan cash register belum memiliki shift terbuka.',
        'error',
      );
      return;
    }
    const modal = openModal({
      title: 'Buka shift kasir',
      kicker: 'Shift',
      subtitle: 'Saldo awal dan pergerakan kas dicatat per shift.',
      body: `
        <form id="pos-shift-form" class="form-grid">
          <label class="field field-span">
            <span>Terminal POS *</span>
            <select name="terminalId" id="pos-shift-terminal" required>
              ${posTerminalOptions(terminals, terminals[0].id)}
            </select>
          </label>
          <label class="field field-span">
            <span>Cash register *</span>
            <select name="registerId" id="pos-shift-register" required></select>
          </label>
          <label class="field field-span">
            <span>Saldo awal kas</span>
            <input name="openingFloat" type="number" min="0" step="0.01" value="0" />
          </label>
          <label class="field field-span">
            <span>Catatan</span>
            <textarea name="notes" rows="3" maxlength="2000" placeholder="Contoh: Shift pagi"></textarea>
          </label>
        </form>
      `,
      footer: `
        <button class="button button-ghost" type="button" data-modal-close>Batal</button>
        <button class="button button-primary" id="pos-shift-submit" type="submit" form="pos-shift-form">${icon('check')} Buka shift</button>
      `,
    });
    const form = modal.querySelector('#pos-shift-form');
    const terminalSelect = modal.querySelector('#pos-shift-terminal');
    const registerSelect = modal.querySelector('#pos-shift-register');
    const submit = modal.querySelector('#pos-shift-submit');

    const renderRegisters = (selectedId = '') => {
      registerSelect.innerHTML = posRegisterOptions(
        registers,
        selectedId,
        terminalSelect.value,
      );
    };
    renderRegisters();
    terminalSelect.addEventListener('change', () => renderRegisters());

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const payload = {
        terminalId: String(data.get('terminalId') ?? ''),
        registerId: String(data.get('registerId') ?? ''),
        openingFloat: String(data.get('openingFloat') ?? '0'),
        notes: String(data.get('notes') ?? '').trim() || undefined,
      };
      if (!payload.terminalId || !payload.registerId) {
        showToast('Data belum lengkap', 'Pilih terminal dan cash register.', 'error');
        return;
      }
      submit.disabled = true;
      try {
        const result = await api('/pos/shifts', { method: 'POST', body: payload });
        closeModal();
        showToast('Shift dibuka', `${result.data.shiftNumber} siap menerima transaksi.`);
        await loadPos(true);
      } catch (error) {
        showToast('Gagal membuka shift', error.message, 'error');
      } finally {
        submit.disabled = false;
      }
    });
  } catch (error) {
    showToast('Gagal memuat data shift', error.message, 'error');
  }
}

async function openPosShiftDetail(shiftId) {
  openModal({
    title: 'Detail shift',
    kicker: 'Shift kasir',
    subtitle: 'Memuat shift...',
    body: tableLoading(5),
  });
  try {
    const result = await api(`/pos/shifts/${shiftId}`);
    const shift = result.data;
    const movements = shift.movements ?? [];
    const movementRows = movements.length
      ? `
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Waktu</th><th>Tipe</th><th>Nominal</th><th>Saldo</th><th>Catatan</th></tr></thead>
            <tbody>
              ${movements
                .map(
                  (movement) => `
                    <tr>
                      <td>${escapeHtml(formatDateTime(movement.occurredAt))}</td>
                      <td>${escapeHtml(posCashMovementLabel(movement.type))}</td>
                      <td>${escapeHtml(formatMoney(movement.amount))}</td>
                      <td>${escapeHtml(formatMoney(movement.balanceAfter))}</td>
                      <td>${escapeHtml(movement.note ?? movement.referenceNumber ?? '-')}</td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>`
      : '<p class="cell-muted">Belum ada pergerakan kas.</p>';

    const actions = [];
    if (shift.status === 'open' && state.canWritePos) {
      actions.push(
        `<button class="button button-ghost" type="button" data-pos-cash-movement="${escapeHtml(shift.id)}" data-pos-shift-number="${escapeHtml(shift.shiftNumber)}" data-pos-cash-type="cash_in">Kas masuk</button>`,
        `<button class="button button-ghost" type="button" data-pos-cash-movement="${escapeHtml(shift.id)}" data-pos-shift-number="${escapeHtml(shift.shiftNumber)}" data-pos-cash-type="cash_out">Kas keluar</button>`,
        `<button class="button button-primary" type="button" data-pos-shift-close="${escapeHtml(shift.id)}" data-pos-shift-number="${escapeHtml(shift.shiftNumber)}">Tutup shift</button>`,
      );
    }

    openModal({
      title: shift.shiftNumber,
      kicker: 'Detail shift kasir',
      subtitle: `${shift.terminalCode} - ${shift.registerCode} - ${formatDateTime(shift.openedAt)}`,
      wide: true,
      body: `
        <dl class="detail-list">
          ${detailRow('Status', statusBadge(shift.status))}
          ${detailRow('Kasir', escapeHtml(shift.cashierName))}
          ${detailRow('Pedagang / toko', `${escapeHtml(shift.merchantName)} / ${escapeHtml(shift.storeName)}`)}
          ${detailRow('Saldo awal', escapeHtml(formatMoney(shift.openingFloat)))}
          ${detailRow('Penjualan', `${escapeHtml(formatMoney(shift.totalSales))} (${formatNumber(shift.transactionCount)} transaksi)`)}
          ${detailRow('Tunai / non-tunai', `${escapeHtml(formatMoney(shift.totalCashSales))} / ${escapeHtml(formatMoney(shift.totalNonCashSales))}`)}
          ${detailRow('Kas sistem', escapeHtml(formatMoney(shift.expectedCash)))}
          ${detailRow('Kas dihitung', shift.countedCash === null ? '-' : escapeHtml(formatMoney(shift.countedCash)))}
          ${detailRow('Selisih', shift.cashDifference === null ? '-' : escapeHtml(formatMoney(shift.cashDifference)))}
          ${detailRow('Ditutup', shift.closedAt ? escapeHtml(formatDateTime(shift.closedAt)) : '-')}
          ${shift.notes ? detailRow('Catatan', escapeHtml(shift.notes)) : ''}
        </dl>
        <div class="panel-header" style="margin-top:24px"><div><p class="panel-kicker">Kas</p><h3>Pergerakan kas</h3></div></div>
        ${movementRows}
      `,
      footer: `<button class="button button-ghost" type="button" data-modal-close>Tutup</button>${actions.join('')}`,
    });
  } catch (error) {
    closeModal();
    showToast('Gagal memuat shift', error.message, 'error');
  }
}

function openPosCloseShiftModal(shiftId, shiftNumber) {
  const modal = openModal({
    title: 'Tutup shift',
    kicker: 'Rekonsiliasi kas',
    subtitle: `${shiftNumber} - masukkan jumlah kas fisik yang dihitung.`,
    body: `
      <form id="pos-close-shift-form" class="form-grid">
        <label class="field field-span">
          <span>Kas dihitung *</span>
          <input name="countedCash" type="number" min="0" step="0.01" required placeholder="0" />
        </label>
        <label class="field field-span">
          <span>Catatan</span>
          <textarea name="notes" rows="3" maxlength="2000" placeholder="Catatan penutupan shift..."></textarea>
        </label>
      </form>
    `,
    footer: `
      <button class="button button-ghost" type="button" data-modal-close>Batal</button>
      <button class="button button-primary" id="pos-close-shift-submit" type="submit" form="pos-close-shift-form">Tutup shift</button>
    `,
  });
  const form = modal.querySelector('#pos-close-shift-form');
  const submit = modal.querySelector('#pos-close-shift-submit');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    submit.disabled = true;
    try {
      const result = await api(`/pos/shifts/${shiftId}/close`, {
        method: 'POST',
        body: {
          countedCash: String(data.get('countedCash') ?? '0'),
          notes: String(data.get('notes') ?? '').trim() || undefined,
        },
      });
      closeModal();
      showToast('Shift ditutup', `Selisih kas ${formatMoney(result.data.cashDifference)}.`);
      await loadPos(true);
    } catch (error) {
      showToast('Gagal menutup shift', error.message, 'error');
    } finally {
      submit.disabled = false;
    }
  });
}

function openPosCashMovementModal(shiftId, shiftNumber, defaultType = 'cash_in') {
  const modal = openModal({
    title: 'Catat pergerakan kas',
    kicker: 'Kas shift',
    subtitle: `${shiftNumber} - catat uang masuk atau keluar.`,
    body: `
      <form id="pos-cash-movement-form" class="form-grid">
        <label class="field field-span">
          <span>Tipe *</span>
          <select name="type">
            <option value="cash_in" ${defaultType === 'cash_in' ? 'selected' : ''}>Kas masuk</option>
            <option value="cash_out" ${defaultType === 'cash_out' ? 'selected' : ''}>Kas keluar</option>
            <option value="adjustment" ${defaultType === 'adjustment' ? 'selected' : ''}>Penyesuaian</option>
          </select>
        </label>
        <label class="field field-span">
          <span>Nominal *</span>
          <input name="amount" type="number" min="0.01" step="0.01" required />
        </label>
        <label class="field field-span">
          <span>Referensi</span>
          <input name="referenceNumber" type="text" maxlength="128" placeholder="Nomor bukti / catatan" />
        </label>
        <label class="field field-span">
          <span>Catatan</span>
          <textarea name="note" rows="3" maxlength="2000"></textarea>
        </label>
      </form>
    `,
    footer: `
      <button class="button button-ghost" type="button" data-modal-close>Batal</button>
      <button class="button button-primary" id="pos-cash-movement-submit" type="submit" form="pos-cash-movement-form">Simpan</button>
    `,
  });
  const form = modal.querySelector('#pos-cash-movement-form');
  const submit = modal.querySelector('#pos-cash-movement-submit');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    submit.disabled = true;
    try {
      await api(`/pos/shifts/${shiftId}/cash-movements`, {
        method: 'POST',
        body: {
          type: String(data.get('type') ?? 'cash_in'),
          amount: String(data.get('amount') ?? ''),
          referenceNumber: String(data.get('referenceNumber') ?? '').trim() || undefined,
          note: String(data.get('note') ?? '').trim() || undefined,
        },
      });
      closeModal();
      showToast('Pergerakan kas dicatat', 'Saldo kas shift berhasil diperbarui.');
      await loadPos(true);
    } catch (error) {
      showToast('Gagal mencatat pergerakan kas', error.message, 'error');
    } finally {
      submit.disabled = false;
    }
  });
}

async function openPosTransactionModal() {
  try {
    const [productsResult, terminalsResult, registersResult] = await Promise.all([
      api('/catalog/products?limit=100&status=active'),
      api('/pos/terminals?limit=100&status=active'),
      api('/pos/registers?limit=100&status=active'),
    ]);
    const products = productsResult.data ?? [];
    const terminals = terminalsResult.data ?? [];
    const registers = (registersResult.data ?? []).filter((row) => row.activeShiftId);
    if (!products.length) {
      showToast('Produk belum tersedia', 'Tambahkan produk aktif sebelum transaksi POS.', 'error');
      return;
    }
    if (!registers.length) {
      showToast('Belum ada shift terbuka', 'Buka shift kasir sebelum membuat transaksi.', 'error');
      return;
    }
    const terminalIds = new Set(registers.map((row) => row.terminalId).filter(Boolean));
    const matchedTerminals = terminals.filter((row) => terminalIds.has(row.id));
    const availableTerminals = matchedTerminals.length ? matchedTerminals : terminals;
    const defaultTerminal = availableTerminals[0]?.id ?? '';
    const defaultRegister = registers.find((row) => row.terminalId === defaultTerminal)?.id ?? '';

    const modal = openModal({
      title: 'Transaksi POS baru',
      kicker: 'Penjualan toko fisik',
      subtitle: 'Transaksi akan tercatat pada shift kasir yang sedang terbuka.',
      wide: true,
      body: `
        <form id="pos-transaction-form" class="form-grid">
          <label class="field">
            <span>Terminal *</span>
            <select name="terminalId" id="pos-transaction-terminal" required>
              ${posTerminalOptions(availableTerminals, defaultTerminal)}
            </select>
          </label>
          <label class="field">
            <span>Cash register *</span>
            <select name="registerId" id="pos-transaction-register" required>
              ${posRegisterOptions(registers, defaultRegister, defaultTerminal)}
            </select>
          </label>
          <label class="field">
            <span>Metode pembayaran *</span>
            <select name="paymentMethod">
              ${Object.entries(POS_PAYMENT_METHOD_LABELS)
                .map(([value, label]) => `<option value="${value}">${label}</option>`)
                .join('')}
            </select>
          </label>
          <label class="field">
            <span>Jumlah dibayar</span>
            <input name="paidAmount" type="number" min="0" step="0.01" placeholder="Kosongkan untuk total" />
          </label>
          <label class="field">
            <span>Nama pelanggan</span>
            <input name="customerName" type="text" maxlength="255" />
          </label>
          <label class="field">
            <span>Telepon pelanggan</span>
            <input name="customerPhone" type="text" maxlength="32" />
          </label>
          <label class="field">
            <span>Diskon transaksi</span>
            <input name="discountTotal" type="number" min="0" step="0.01" value="0" />
          </label>
          <label class="field">
            <span>Pajak</span>
            <input name="taxTotal" type="number" min="0" step="0.01" value="0" />
          </label>
        </form>
        <div class="panel-header" style="margin-top:20px">
          <div><p class="panel-kicker">Item</p><h3>Daftar item</h3></div>
          <button class="button button-ghost button-sm" type="button" id="pos-add-item">${icon('plus')} Tambah item</button>
        </div>
        <div id="pos-transaction-items" style="display:grid;gap:12px"></div>
        <label class="field field-span" style="margin-top:16px">
          <span>Catatan</span>
          <textarea name="notes" id="pos-transaction-notes" rows="3" maxlength="2000" placeholder="Catatan transaksi..."></textarea>
        </label>
      `,
      footer: `
        <button class="button button-ghost" type="button" data-modal-close>Batal</button>
        <button class="button button-primary" id="pos-transaction-submit" type="submit" form="pos-transaction-form">${icon('check')} Simpan transaksi</button>
      `,
    });
    const form = modal.querySelector('#pos-transaction-form');
    const terminalSelect = modal.querySelector('#pos-transaction-terminal');
    const registerSelect = modal.querySelector('#pos-transaction-register');
    const itemsContainer = modal.querySelector('#pos-transaction-items');
    const submit = modal.querySelector('#pos-transaction-submit');

    const addItemRow = () => {
      const row = document.createElement('div');
      row.className = 'pos-item-row';
      row.style.cssText =
        'display:grid;grid-template-columns:minmax(0,1fr) 92px 110px auto;gap:8px;align-items:end';
      row.innerHTML = `
        <label class="field"><span>Produk *</span><select name="productId" required>${posProductOptions(products)}</select></label>
        <label class="field"><span>Qty *</span><input name="quantity" type="number" min="1" step="1" value="1" required /></label>
        <label class="field"><span>Diskon</span><input name="discountAmount" type="number" min="0" step="0.01" value="0" /></label>
        <button class="icon-button" type="button" data-pos-remove-item aria-label="Hapus item">${icon('close')}</button>
      `;
      itemsContainer.append(row);
    };
    const renderRegisters = (selectedId = '') => {
      registerSelect.innerHTML = posRegisterOptions(
        registers,
        selectedId,
        terminalSelect.value,
      );
    };

    addItemRow();
    renderRegisters(defaultRegister);
    terminalSelect.addEventListener('change', () => renderRegisters());
    modal.querySelector('#pos-add-item').addEventListener('click', addItemRow);
    itemsContainer.addEventListener('click', (event) => {
      const remove = event.target.closest('[data-pos-remove-item]');
      if (!remove) return;
      if (itemsContainer.querySelectorAll('.pos-item-row').length > 1) {
        remove.closest('.pos-item-row')?.remove();
      }
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const items = [...itemsContainer.querySelectorAll('.pos-item-row')]
        .map((row) => {
          const productId = row.querySelector('[name="productId"]')?.value;
          if (!productId) return null;
          return {
            productId,
            quantity: Number(row.querySelector('[name="quantity"]')?.value ?? 1),
            discountAmount: String(row.querySelector('[name="discountAmount"]')?.value ?? '0'),
          };
        })
        .filter(Boolean);
      if (!items.length) {
        showToast('Item belum dipilih', 'Tambahkan minimal satu produk.', 'error');
        return;
      }
      const payload = {
        terminalId: String(data.get('terminalId') ?? ''),
        registerId: String(data.get('registerId') ?? ''),
        paymentMethod: String(data.get('paymentMethod') ?? 'cash'),
        discountTotal: String(data.get('discountTotal') ?? '0'),
        taxTotal: String(data.get('taxTotal') ?? '0'),
        customerName: String(data.get('customerName') ?? '').trim() || undefined,
        customerPhone: String(data.get('customerPhone') ?? '').trim() || undefined,
        notes: String(modal.querySelector('#pos-transaction-notes')?.value ?? '').trim() || undefined,
        items,
      };
      const paidAmount = String(data.get('paidAmount') ?? '').trim();
      if (paidAmount) payload.paidAmount = paidAmount;
      if (!payload.terminalId || !payload.registerId) {
        showToast('Data belum lengkap', 'Pilih terminal dan cash register.', 'error');
        return;
      }
      submit.disabled = true;
      try {
        const result = await api('/pos/transactions', { method: 'POST', body: payload });
        closeModal();
        showToast(
          'Transaksi POS dibuat',
          `${result.data.transactionNumber} - ${formatMoney(result.data.total)}`,
        );
        await loadPos(true);
      } catch (error) {
        showToast('Gagal membuat transaksi POS', error.message, 'error');
      } finally {
        submit.disabled = false;
      }
    });
  } catch (error) {
    showToast('Gagal memuat transaksi POS', error.message, 'error');
  }
}

async function openPosSyncModal() {
  try {
    const [productsResult, terminalsResult, registersResult] = await Promise.all([
      api('/catalog/products?limit=100&status=active'),
      api('/pos/terminals?limit=100&status=active'),
      api('/pos/registers?limit=100&status=active'),
    ]);
    const products = productsResult.data ?? [];
    const terminals = terminalsResult.data ?? [];
    const registers = (registersResult.data ?? []).filter((row) => row.activeShiftId);
    if (!products.length || !registers.length) {
      showToast(
        'Belum dapat sinkronisasi',
        'Butuh produk aktif dan shift kasir yang masih terbuka.',
        'error',
      );
      return;
    }
    const terminalIds = new Set(registers.map((row) => row.terminalId).filter(Boolean));
    const matchedTerminals = terminals.filter((row) => terminalIds.has(row.id));
    const availableTerminals = matchedTerminals.length ? matchedTerminals : terminals;
    const defaultTerminal = availableTerminals[0]?.id ?? '';
    const defaultRegister = registers.find((row) => row.terminalId === defaultTerminal)?.id ?? '';
    const modal = openModal({
      title: 'Sinkronisasi transaksi offline',
      kicker: 'Offline sync',
      subtitle: 'Unggah transaksi yang dibuat saat perangkat POS offline.',
      body: `
        <form id="pos-sync-form" class="form-grid">
          <label class="field">
            <span>Terminal *</span>
            <select name="terminalId" id="pos-sync-terminal" required>${posTerminalOptions(availableTerminals, defaultTerminal)}</select>
          </label>
          <label class="field">
            <span>Cash register *</span>
            <select name="registerId" id="pos-sync-register" required>${posRegisterOptions(registers, defaultRegister, defaultTerminal)}</select>
          </label>
          <label class="field field-span">
            <span>Client transaction ID *</span>
            <input name="clientTransactionId" type="text" maxlength="128" required value="offline-${Date.now()}" />
          </label>
          <label class="field field-span">
            <span>Produk *</span>
            <select name="productId" required>${posProductOptions(products)}</select>
          </label>
          <label class="field">
            <span>Qty *</span>
            <input name="quantity" type="number" min="1" step="1" value="1" required />
          </label>
          <label class="field">
            <span>Metode *</span>
            <select name="paymentMethod">
              ${Object.entries(POS_PAYMENT_METHOD_LABELS)
                .map(([value, label]) => `<option value="${value}">${label}</option>`)
                .join('')}
            </select>
          </label>
          <label class="field">
            <span>Jumlah dibayar</span>
            <input name="paidAmount" type="number" min="0" step="0.01" />
          </label>
          <label class="field">
            <span>Nama pelanggan</span>
            <input name="customerName" type="text" maxlength="255" />
          </label>
        </form>
      `,
      footer: `
        <button class="button button-ghost" type="button" data-modal-close>Batal</button>
        <button class="button button-primary" id="pos-sync-submit" type="submit" form="pos-sync-form">${icon('refresh')} Sinkronkan</button>
      `,
    });
    const form = modal.querySelector('#pos-sync-form');
    const terminalSelect = modal.querySelector('#pos-sync-terminal');
    const registerSelect = modal.querySelector('#pos-sync-register');
    const submit = modal.querySelector('#pos-sync-submit');
    terminalSelect.addEventListener('change', () => {
      registerSelect.innerHTML = posRegisterOptions(registers, '', terminalSelect.value);
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const transaction = {
        clientTransactionId: String(data.get('clientTransactionId') ?? '').trim(),
        paymentMethod: String(data.get('paymentMethod') ?? 'cash'),
        customerName: String(data.get('customerName') ?? '').trim() || undefined,
        items: [
          {
            productId: String(data.get('productId') ?? ''),
            quantity: Number(data.get('quantity') ?? 1),
          },
        ],
      };
      const paidAmount = String(data.get('paidAmount') ?? '').trim();
      if (paidAmount) transaction.paidAmount = paidAmount;
      submit.disabled = true;
      try {
        const result = await api('/pos/sync', {
          method: 'POST',
          body: {
            terminalId: String(data.get('terminalId') ?? ''),
            registerId: String(data.get('registerId') ?? ''),
            transactions: [transaction],
          },
        });
        closeModal();
        showToast(
          'Sinkronisasi selesai',
          `${result.data.created} dibuat, ${result.data.skipped} dilewati, ${result.data.failed} gagal.`,
        );
        await loadPos(true);
      } catch (error) {
        showToast('Gagal sinkronisasi', error.message, 'error');
      } finally {
        submit.disabled = false;
      }
    });
  } catch (error) {
    showToast('Gagal memuat sinkronisasi', error.message, 'error');
  }
}

async function openPosTransactionDetail(transactionId) {
  openModal({
    title: 'Detail transaksi POS',
    kicker: 'Transaksi',
    subtitle: 'Memuat transaksi...',
    body: tableLoading(5),
  });
  try {
    const result = await api(`/pos/transactions/${transactionId}`);
    const transaction = result.data;
    const items = transaction.items ?? [];
    const itemTable = items.length
      ? `
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Produk</th><th>SKU</th><th>Qty</th><th>Harga</th><th>Diskon</th><th>Total</th></tr></thead>
            <tbody>
              ${items
                .map(
                  (item) => `
                    <tr>
                      <td>${escapeHtml(item.productName)}</td>
                      <td>${escapeHtml(item.skuCode ?? '-')}</td>
                      <td>${formatNumber(item.quantity)}</td>
                      <td>${escapeHtml(formatMoney(item.unitPrice))}</td>
                      <td>${escapeHtml(formatMoney(item.discountAmount))}</td>
                      <td>${escapeHtml(formatMoney(item.lineTotal))}</td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>`
      : '<p class="cell-muted">Tidak ada item.</p>';

    const actions = [];
    if (transaction.status === 'completed' && state.canWritePos) {
      actions.push(
        `<button class="button button-ghost" type="button" data-pos-transaction-void="${escapeHtml(transaction.id)}" data-pos-transaction-number="${escapeHtml(transaction.transactionNumber)}">Batalkan transaksi</button>`,
      );
    }
    if (transaction.syncStatus !== 'synced' && state.canManagePos) {
      actions.push(
        `<button class="button button-primary" type="button" data-pos-transaction-sync="${escapeHtml(transaction.id)}" data-pos-transaction-number="${escapeHtml(transaction.transactionNumber)}">Sinkronkan</button>`,
      );
    }

    openModal({
      title: transaction.transactionNumber,
      kicker: 'Detail transaksi POS',
      subtitle: `${transaction.terminalCode} - ${transaction.registerCode} - ${formatDateTime(transaction.completedAt)}`,
      wide: true,
      body: `
        <dl class="detail-list">
          ${detailRow('Status', statusBadge(transaction.status))}
          ${detailRow('Sinkronisasi', statusBadge(transaction.syncStatus))}
          ${detailRow('Kasir', escapeHtml(transaction.cashierName))}
          ${detailRow('Pelanggan', `${escapeHtml(transaction.customerName ?? 'Pelanggan umum')}${transaction.customerPhone ? ` - ${escapeHtml(transaction.customerPhone)}` : ''}`)}
          ${detailRow('Shift', escapeHtml(transaction.shiftNumber))}
          ${detailRow('Metode', escapeHtml(posPaymentMethodLabel(transaction.paymentMethod)))}
          ${detailRow('Subtotal', escapeHtml(formatMoney(transaction.subtotal, transaction.currency)))}
          ${detailRow('Diskon / pajak', `${escapeHtml(formatMoney(transaction.discountTotal, transaction.currency))} / ${escapeHtml(formatMoney(transaction.taxTotal, transaction.currency))}`)}
          ${detailRow('Total', escapeHtml(formatMoney(transaction.total, transaction.currency)))}
          ${detailRow('Dibayar / kembalian', `${escapeHtml(formatMoney(transaction.paidAmount, transaction.currency))} / ${escapeHtml(formatMoney(transaction.changeAmount, transaction.currency))}`)}
          ${transaction.clientTransactionId ? detailRow('Client ID', escapeHtml(transaction.clientTransactionId)) : ''}
          ${transaction.offlineCreatedAt ? detailRow('Dibuat offline', escapeHtml(formatDateTime(transaction.offlineCreatedAt))) : ''}
          ${transaction.voidedAt ? detailRow('Dibatalkan', `${escapeHtml(formatDateTime(transaction.voidedAt))} - ${escapeHtml(transaction.voidReason ?? '-')}`) : ''}
          ${transaction.notes ? detailRow('Catatan', escapeHtml(transaction.notes)) : ''}
        </dl>
        <div class="panel-header" style="margin-top:24px"><div><p class="panel-kicker">Item</p><h3>Rincian item</h3></div></div>
        ${itemTable}
      `,
      footer: `<button class="button button-ghost" type="button" data-modal-close>Tutup</button>${actions.join('')}`,
    });
  } catch (error) {
    closeModal();
    showToast('Gagal memuat transaksi POS', error.message, 'error');
  }
}

function openPosVoidModal(transactionId, transactionNumber) {
  const modal = openModal({
    title: 'Batalkan transaksi',
    kicker: 'Pembatalan',
    subtitle: `${transactionNumber} akan ditandai batal dan kas dikembalikan jika tunai.`,
    body: `
      <form id="pos-void-form" class="form-grid">
        <label class="field field-span">
          <span>Alasan pembatalan *</span>
          <textarea name="reason" rows="3" maxlength="1000" required placeholder="Jelaskan alasan pembatalan..."></textarea>
        </label>
      </form>
    `,
    footer: `
      <button class="button button-ghost" type="button" data-modal-close>Batal</button>
      <button class="button button-primary" id="pos-void-submit" type="submit" form="pos-void-form">Batalkan transaksi</button>
    `,
  });
  const form = modal.querySelector('#pos-void-form');
  const submit = modal.querySelector('#pos-void-submit');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    submit.disabled = true;
    try {
      await api(`/pos/transactions/${transactionId}/void`, {
        method: 'POST',
        body: { reason: String(data.get('reason') ?? '').trim() },
      });
      closeModal();
      showToast('Transaksi dibatalkan', `${transactionNumber} berhasil dibatalkan.`);
      await loadPos(true);
    } catch (error) {
      showToast('Gagal membatalkan transaksi', error.message, 'error');
    } finally {
      submit.disabled = false;
    }
  });
}

async function syncPosTransaction(transactionId, transactionNumber) {
  try {
    await api(`/pos/transactions/${transactionId}/sync`, { method: 'POST', body: {} });
    closeModal();
    showToast('Transaksi tersinkronisasi', `${transactionNumber} berhasil disinkronkan.`);
    await loadPos(true);
  } catch (error) {
    showToast('Gagal sinkronisasi', error.message, 'error');
  }
}


/* ------------------------------ Inventory ----------------------------- */

function inventoryMerchantOptions(merchants, selectedId = '') {
  return (
    '<option value="">Pilih pedagang</option>' +
    merchants
      .map(
        (merchant) =>
          `<option value="${escapeHtml(merchant.id)}" ${merchant.id === selectedId ? 'selected' : ''}>${escapeHtml(merchant.businessName)}</option>`,
      )
      .join('')
  );
}

function inventoryWarehouseOptions(warehouseList, selectedId = '', merchantId = '') {
  const filtered = merchantId
    ? warehouseList.filter((row) => row.merchantId === merchantId)
    : warehouseList;
  return (
    '<option value="">Pilih gudang</option>' +
    filtered
      .map(
        (row) =>
          `<option value="${escapeHtml(row.id)}" ${row.id === selectedId ? 'selected' : ''}>${escapeHtml(row.code)} - ${escapeHtml(row.name)}</option>`,
      )
      .join('')
  );
}

async function inventoryLocationOptions(warehouseId, selectedId = '') {
  if (!warehouseId) return '<option value="">Pilih lokasi</option>';
  const result = await api(`/inventory/warehouses/${warehouseId}/locations`);
  const rows = result.data ?? [];
  return (
    '<option value="">Pilih lokasi</option>' +
    rows
      .map(
        (row) =>
          `<option value="${escapeHtml(row.id)}" ${row.id === selectedId ? 'selected' : ''}>${escapeHtml(row.code)} - ${escapeHtml(row.name)}</option>`,
      )
      .join('')
  );
}

function inventoryItemOptions(itemList, merchantId = '', selectedId = '') {
  const filtered = merchantId
    ? itemList.filter((row) => row.merchantId === merchantId)
    : itemList;
  return (
    '<option value="">Pilih item</option>' +
    filtered
      .map(
        (row) =>
          `<option value="${escapeHtml(row.id)}" ${row.id === selectedId ? 'selected' : ''}>${escapeHtml(row.productName)} - ${escapeHtml(row.skuCode)}</option>`,
      )
      .join('')
  );
}

function inventoryProductOptions(productList, merchantId = '', selectedId = '') {
  const filtered = merchantId
    ? productList.filter((row) => row.merchantId === merchantId)
    : productList;
  return (
    '<option value="">Pilih produk</option>' +
    filtered
      .map(
        (row) =>
          `<option value="${escapeHtml(row.id)}" ${row.id === selectedId ? 'selected' : ''}>${escapeHtml(row.name)}</option>`,
      )
      .join('')
  );
}

async function loadInventory(force = false) {
  const sequence = ++state.sequences.inventory;
  const filters = state.filters.inventory;

  if (!state.inventory || force) {
    for (const selector of [
      '#inventory-warehouses-table',
      '#inventory-locations-table',
      '#inventory-items-table',
      '#inventory-balances-table',
      '#inventory-movements-table',
      '#inventory-adjustments-table',
      '#inventory-counts-table',
      '#inventory-batches-table',
    ]) {
      const host = $(selector);
      if (host) host.innerHTML = tableLoading(3);
    }
  }
  for (const selector of [
    '#inventory-warehouse-count',
    '#inventory-location-count',
    '#inventory-item-count',
    '#inventory-balance-count',
    '#inventory-movement-count',
    '#inventory-adjustment-count',
    '#inventory-count-count',
    '#inventory-batch-count',
  ]) {
    const node = $(selector);
    if (node) node.textContent = 'Memuat...';
  }
  setSpinner('#refresh-inventory-movements', true);

  try {
    const [
      summary,
      warehouses,
      locations,
      items,
      balances,
      movements,
      adjustments,
      counts,
      batches,
    ] = await Promise.all([
      api('/inventory/summary'),
      api('/inventory/warehouses?limit=100'),
      api('/inventory/locations?limit=100'),
      api(
        `/inventory/items${buildQuery({
          limit: 100,
          search: filters.itemSearch,
          status: filters.itemStatus,
        })}`,
      ),
      api(
        `/inventory/balances${buildQuery({
          limit: 100,
          search: filters.balanceSearch,
          lowStock: filters.balanceLow,
        })}`,
      ),
      api(
        `/inventory/movements${buildQuery({
          limit: 100,
          search: filters.movementSearch,
          type: filters.movementType,
        })}`,
      ),
      api(
        `/inventory/adjustments${buildQuery({
          limit: 100,
          search: filters.adjustmentSearch,
          type: filters.adjustmentType,
        })}`,
      ),
      api(
        `/inventory/stock-counts${buildQuery({
          limit: 100,
          search: filters.countSearch,
          status: filters.countStatus,
        })}`,
      ),
      api(
        `/inventory/batches${buildQuery({
          limit: 100,
          search: filters.batchSearch,
          expiry: filters.batchExpiry,
        })}`,
      ),
    ]);
    if (sequence !== state.sequences.inventory) return;
    state.inventory = {
      summary,
      warehouses,
      locations,
      items,
      balances,
      movements,
      adjustments,
      counts,
      batches,
    };
    renderInventory();
  } catch (error) {
    if (sequence !== state.sequences.inventory) return;
    for (const selector of [
      '#inventory-warehouse-count',
      '#inventory-location-count',
      '#inventory-item-count',
      '#inventory-balance-count',
      '#inventory-movement-count',
      '#inventory-adjustment-count',
      '#inventory-count-count',
      '#inventory-batch-count',
    ]) {
      const node = $(selector);
      if (node) node.textContent = 'Gagal memuat';
    }
    for (const selector of [
      '#inventory-warehouses-table',
      '#inventory-locations-table',
      '#inventory-items-table',
      '#inventory-balances-table',
      '#inventory-movements-table',
      '#inventory-adjustments-table',
      '#inventory-counts-table',
      '#inventory-batches-table',
    ]) {
      const host = $(selector);
      if (host) host.innerHTML = errorState(error.message, 'data-retry-inventory');
    }
  } finally {
    if (sequence === state.sequences.inventory) {
      setSpinner('#refresh-inventory-movements', false);
    }
  }
}

function renderInventory() {
  const data = state.inventory;
  if (!data) return;

  const warehouses = data.warehouses.data ?? [];
  const locations = data.locations.data ?? [];
  const items = data.items.data ?? [];
  const balances = data.balances.data ?? [];
  const movements = data.movements.data ?? [];
  const adjustments = data.adjustments.data ?? [];
  const counts = data.counts.data ?? [];
  const batches = data.batches.data ?? [];
  const summary = data.summary.data ?? {};

  const setText = (selector, value) => {
    const node = $(selector);
    if (node) node.textContent = value;
  };
  const setBadge = (selector, count, label) => {
    const badge = $(selector);
    if (!badge) return;
    badge.hidden = Number(count) === 0;
    badge.textContent = `${formatNumber(count)} ${label}`;
  };

  setText('#inventory-stat-warehouses', formatNumber(summary.warehouses ?? warehouses.length));
  setText('#inventory-stat-items', formatNumber(summary.inventoryItems ?? items.length));
  setText('#inventory-stat-lowstock', formatNumber(summary.lowStock ?? 0));
  setText('#inventory-stat-expiring', formatNumber(summary.expiringBatches ?? 0));
  setText('#inventory-stat-stock', `${formatNumber(Number(summary.totalStock ?? 0))} unit`);
  setBadge('#inventory-summary-badge', summary.openCounts ?? 0, 'opname berjalan');

  const totals = {
    warehouses: Number(data.warehouses.meta?.total ?? warehouses.length),
    locations: Number(data.locations.meta?.total ?? locations.length),
    items: Number(data.items.meta?.total ?? items.length),
    balances: Number(data.balances.meta?.total ?? balances.length),
    movements: Number(data.movements.meta?.total ?? movements.length),
    adjustments: Number(data.adjustments.meta?.total ?? adjustments.length),
    counts: Number(data.counts.meta?.total ?? counts.length),
    batches: Number(data.batches.meta?.total ?? batches.length),
  };
  const setCount = (id, text) => {
    const badge = $(id);
    if (badge) {
      badge.hidden = false;
      badge.textContent = text;
    }
    const label = $(`${id}-label`);
    if (label) label.textContent = text;
  };
  setCount('#inventory-warehouse-count', `${formatNumber(totals.warehouses)} gudang`);
  setCount('#inventory-location-count', `${formatNumber(totals.locations)} lokasi`);
  setCount('#inventory-item-count', `${formatNumber(totals.items)} item`);
  setCount('#inventory-balance-count', `${formatNumber(totals.balances)} saldo`);
  setCount('#inventory-movement-count', `${formatNumber(totals.movements)} pergerakan`);
  setCount('#inventory-adjustment-count', `${formatNumber(totals.adjustments)} penyesuaian`);
  setCount('#inventory-count-count', `${formatNumber(totals.counts)} opname`);
  setCount('#inventory-batch-count', `${formatNumber(totals.batches)} batch`);

  if (!warehouses.length) {
    $('#inventory-warehouses-table').innerHTML = emptyState(
      'Belum ada gudang',
      'Tambahkan gudang untuk mulai menata lokasi dan saldo persediaan.',
    );
  } else {
    $('#inventory-warehouses-table').innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Gudang</th><th>Pedagang</th><th>Alamat</th><th>Lokasi</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            ${warehouses
              .map(
                (row) => `
                  <tr>
                    <td>
                      <div class="cell-title">${escapeHtml(row.name)}</div>
                      <div class="cell-muted">${escapeHtml(row.code)}${row.isDefault ? ' · Utama' : ''}</div>
                    </td>
                    <td>
                      <div class="cell-title">${escapeHtml(row.merchantName)}</div>
                      <div class="cell-muted">${escapeHtml(row.storeName ?? 'Tanpa toko')}</div>
                    </td>
                    <td>
                      <div class="cell-title">${escapeHtml(row.city ?? '-')}</div>
                      <div class="cell-muted">${escapeHtml(row.province ?? '-')}</div>
                    </td>
                    <td>${formatNumber(locations.filter((loc) => loc.warehouseId === row.id).length)}</td>
                    <td>${statusBadge(row.status)}</td>
                    <td>${state.canManageInventory ? `<button class="action-link" type="button" data-inventory-warehouse-edit="${escapeHtml(row.id)}">${icon('arrow-right')} Ubah</button>` : '—'}</td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  if (!locations.length) {
    $('#inventory-locations-table').innerHTML = emptyState(
      'Belum ada lokasi',
      'Lokasi menentukan posisi stok di dalam gudang, misalnya rak atau area penerimaan.',
    );
  } else {
    $('#inventory-locations-table').innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Lokasi</th><th>Gudang</th><th>Tipe</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            ${locations
              .map(
                (row) => `
                  <tr>
                    <td>
                      <div class="cell-title">${escapeHtml(row.name)}</div>
                      <div class="cell-muted">${escapeHtml(row.code)}</div>
                    </td>
                    <td>
                      <div class="cell-title">${escapeHtml(row.warehouseName)}</div>
                      <div class="cell-muted">${escapeHtml(row.merchantName)}</div>
                    </td>
                    <td>${statusLabel(row.type)}</td>
                    <td>${statusBadge(row.status)}</td>
                    <td>${state.canManageInventory ? `<button class="action-link" type="button" data-inventory-location-edit="${escapeHtml(row.id)}">${icon('arrow-right')} Ubah</button>` : '—'}</td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  if (!items.length) {
    $('#inventory-items-table').innerHTML = emptyState(
      'Belum ada item persediaan',
      state.filters.inventory.itemSearch || state.filters.inventory.itemStatus
        ? 'Coba ubah kata kunci atau filter status.'
        : 'Daftarkan SKU produk sebagai item agar stok dapat dicatat.',
    );
  } else {
    $('#inventory-items-table').innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Produk / SKU</th><th>Pedagang</th><th>Batas stok</th><th>Total stok</th><th>Batch / expiry</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            ${items
              .map(
                (row) => `
                  <tr>
                    <td>
                      <div class="cell-title">${escapeHtml(row.productName)}</div>
                      <div class="cell-muted">${escapeHtml(row.skuCode)}${row.barcode ? ` · ${escapeHtml(row.barcode)}` : ''}</div>
                    </td>
                    <td>${escapeHtml(row.merchantName)}</td>
                    <td>
                      <div class="cell-title">Min ${formatNumber(Number(row.minStock))}</div>
                      <div class="cell-muted">Reorder ${row.reorderPoint === null ? '-' : formatNumber(Number(row.reorderPoint))}</div>
                    </td>
                    <td>
                      <div class="cell-title">${formatNumber(Number(row.totalStock))}</div>
                      <div class="cell-muted">Biaya ${formatMoney(row.unitCost)}</div>
                    </td>
                    <td>
                      <div class="cell-title">${row.trackBatches ? 'Batch' : 'Tanpa batch'}${row.trackExpiry ? ' · expiry' : ''}</div>
                      <div class="cell-muted">${row.trackBatches || row.trackExpiry ? 'Dilacak' : 'Tidak dilacak'}</div>
                    </td>
                    <td>${statusBadge(row.status)}</td>
                    <td>${state.canManageInventory ? `<button class="action-link" type="button" data-inventory-item-edit="${escapeHtml(row.id)}">${icon('arrow-right')} Ubah</button>` : '—'}</td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  if (!balances.length) {
    $('#inventory-balances-table').innerHTML = emptyState(
      'Belum ada saldo stok',
      state.filters.inventory.balanceSearch || state.filters.inventory.balanceLow
        ? 'Coba ubah kata kunci atau filter stok menipis.'
        : 'Saldo muncul setelah barang masuk atau penyesuaian stok dicatat.',
    );
  } else {
    $('#inventory-balances-table').innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Produk</th><th>Lokasi</th><th>Jumlah</th><th>Min / max</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            ${balances
              .map(
                (row) => `
                  <tr>
                    <td>
                      <div class="cell-title">${escapeHtml(row.productName)}</div>
                      <div class="cell-muted">${escapeHtml(row.skuCode)}</div>
                    </td>
                    <td>
                      <div class="cell-title">${escapeHtml(row.warehouseName)}</div>
                      <div class="cell-muted">${escapeHtml(row.locationName)}</div>
                    </td>
                    <td>
                      <div class="cell-title">${formatNumber(Number(row.quantity))}</div>
                      <div class="cell-muted">Dipesan ${formatNumber(Number(row.reservedQuantity))}</div>
                    </td>
                    <td>
                      <div class="cell-title">${formatNumber(Number(row.minStock))}</div>
                      <div class="cell-muted">${row.maxStock === null ? '-' : formatNumber(Number(row.maxStock))}</div>
                    </td>
                    <td>${statusBadge(row.stockStatus)}</td>
                    <td>
                      <div class="row-actions">
                        ${state.canWriteInventory ? `<button class="action-link" type="button" data-inventory-adjust-item="${escapeHtml(row.inventoryItemId)}" data-inventory-adjust-warehouse="${escapeHtml(row.warehouseId)}" data-inventory-adjust-location="${escapeHtml(row.warehouseLocationId)}">Sesuaikan</button>` : ''}
                        <span class="cell-muted">${formatDateTime(row.lastMovementAt)}</span>
                      </div>
                    </td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  if (!movements.length) {
    $('#inventory-movements-table').innerHTML = emptyState(
      'Belum ada pergerakan stok',
      state.filters.inventory.movementSearch || state.filters.inventory.movementType
        ? 'Coba ubah kata kunci atau filter tipe.'
        : 'Catat barang masuk, keluar, atau transfer untuk membentuk saldo.',
    );
  } else {
    $('#inventory-movements-table').innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Pergerakan</th><th>Tipe</th><th>Asal → tujuan</th><th>Jumlah</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            ${movements
              .map(
                (row) => `
                  <tr>
                    <td>
                      <div class="cell-title">${escapeHtml(row.movementNumber)}</div>
                      <div class="cell-muted">${escapeHtml(formatDateTime(row.completedAt))}</div>
                    </td>
                    <td>${statusBadge(row.type)}</td>
                    <td>
                      <div class="cell-title">${escapeHtml(row.sourceWarehouseName ?? '—')}</div>
                      <div class="cell-muted">→ ${escapeHtml(row.destinationWarehouseName ?? '—')}</div>
                    </td>
                    <td>
                      <div class="cell-title">${formatNumber(Number(row.totalQuantity))} unit</div>
                      <div class="cell-muted">${formatMoney(row.totalCost)}</div>
                    </td>
                    <td>${statusBadge(row.status)}</td>
                    <td><button class="action-link" type="button" data-inventory-movement-detail="${escapeHtml(row.id)}">${icon('arrow-right')} Detail</button></td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  if (!adjustments.length) {
    $('#inventory-adjustments-table').innerHTML = emptyState(
      'Belum ada penyesuaian',
      state.filters.inventory.adjustmentSearch || state.filters.inventory.adjustmentType
        ? 'Coba ubah kata kunci atau filter tipe.'
        : 'Penyesuaian mencatat koreksi stok, kerusakan, atau kehilangan.',
    );
  } else {
    $('#inventory-adjustments-table').innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Penyesuaian</th><th>Produk</th><th>Lokasi</th><th>Tipe</th><th>Stok</th><th>Aksi</th></tr></thead>
          <tbody>
            ${adjustments
              .map(
                (row) => `
                  <tr>
                    <td>
                      <div class="cell-title">${escapeHtml(row.adjustmentNumber)}</div>
                      <div class="cell-muted">${escapeHtml(formatDateTime(row.createdAt))}</div>
                    </td>
                    <td>
                      <div class="cell-title">${escapeHtml(row.productName)}</div>
                      <div class="cell-muted">${escapeHtml(row.skuCode)}</div>
                    </td>
                    <td>
                      <div class="cell-title">${escapeHtml(row.warehouseName)}</div>
                      <div class="cell-muted">${escapeHtml(row.locationName)}</div>
                    </td>
                    <td>${statusBadge(row.type)}</td>
                    <td>
                      <div class="cell-title">${formatNumber(Number(row.beforeQuantity))} → ${formatNumber(Number(row.afterQuantity))}</div>
                      <div class="cell-muted">${escapeHtml(row.reason)}</div>
                    </td>
                    <td>${row.movementId ? `<button class="action-link" type="button" data-inventory-movement-detail="${escapeHtml(row.movementId)}">${icon('arrow-right')} Pergerakan</button>` : '—'}</td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  if (!counts.length) {
    $('#inventory-counts-table').innerHTML = emptyState(
      'Belum ada opname',
      state.filters.inventory.countSearch || state.filters.inventory.countStatus
        ? 'Coba ubah kata kunci atau filter status.'
        : 'Mulai opname untuk mencocokkan stok sistem dengan hitungan fisik.',
    );
  } else {
    $('#inventory-counts-table').innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Opname</th><th>Lokasi</th><th>Progress</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            ${counts
              .map((row) => {
                const total = Number(row.itemCount ?? 0);
                const counted = Number(row.countedCount ?? 0);
                const percent = total > 0 ? Math.round((counted / total) * 100) : 0;
                return `
                  <tr>
                    <td>
                      <div class="cell-title">${escapeHtml(row.countNumber)}</div>
                      <div class="cell-muted">${escapeHtml(formatDateTime(row.startedAt))}</div>
                    </td>
                    <td>
                      <div class="cell-title">${escapeHtml(row.warehouseName)}</div>
                      <div class="cell-muted">${escapeHtml(row.locationName)}</div>
                    </td>
                    <td>
                      <div class="cell-title">${formatNumber(counted)} / ${formatNumber(total)} item</div>
                      <div class="cell-muted">${percent}% dihitung</div>
                    </td>
                    <td>${statusBadge(row.status)}</td>
                    <td><button class="action-link" type="button" data-inventory-count-detail="${escapeHtml(row.id)}">${icon('arrow-right')} Detail</button></td>
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  if (!batches.length) {
    $('#inventory-batches-table').innerHTML = emptyState(
      'Belum ada batch',
      state.filters.inventory.batchSearch || state.filters.inventory.batchExpiry
        ? 'Coba ubah kata kunci atau filter kedaluwarsa.'
        : 'Batch tercatat saat barang masuk menyertakan nomor batch.',
    );
  } else {
    $('#inventory-batches-table').innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Batch</th><th>Produk</th><th>Lokasi</th><th>Jumlah</th><th>Kedaluwarsa</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            ${batches
              .map(
                (row) => `
                  <tr>
                    <td>
                      <div class="cell-title">${escapeHtml(row.batchNumber)}</div>
                      <div class="cell-muted">${escapeHtml(row.supplierReference ?? 'Tanpa referensi')}</div>
                    </td>
                    <td>
                      <div class="cell-title">${escapeHtml(row.productName)}</div>
                      <div class="cell-muted">${escapeHtml(row.skuCode)}</div>
                    </td>
                    <td>
                      <div class="cell-title">${escapeHtml(row.warehouseName)}</div>
                      <div class="cell-muted">${escapeHtml(row.locationName)}</div>
                    </td>
                    <td>${formatNumber(Number(row.quantity))}</td>
                    <td>
                      <div class="cell-title">${row.expiryDate ? escapeHtml(formatDate(row.expiryDate)) : '—'}</div>
                      <div class="cell-muted">${row.daysToExpiry === null ? 'Tanpa expiry' : row.daysToExpiry < 0 ? `Lewat ${Math.abs(row.daysToExpiry)} hari` : `${row.daysToExpiry} hari lagi`}</div>
                    </td>
                    <td>${statusBadge(row.status)}</td>
                    <td>${state.canManageInventory ? `<button class="action-link" type="button" data-inventory-batch-edit="${escapeHtml(row.id)}">${icon('arrow-right')} Ubah</button>` : '—'}</td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }
}

async function openInventoryWarehouseModal(warehouseId) {
  openModal({
    title: warehouseId ? 'Ubah gudang' : 'Tambah gudang',
    kicker: 'Persediaan',
    subtitle: 'Memuat daftar pedagang...',
    body: tableLoading(3),
  });
  try {
    const merchants = await api('/merchants?limit=100');
    const merchantList = merchants.data ?? [];
    if (!merchantList.length) {
      closeModal();
      showToast('Pedagang belum tersedia', 'Tambahkan pedagang sebelum membuat gudang.', 'error');
      return;
    }
    const record = warehouseId
      ? (state.inventory?.warehouses?.data ?? []).find((row) => row.id === warehouseId)
      : null;
    const selectedMerchantId = record?.merchantId ?? merchantList[0].id;
    const modal = openModal({
      title: warehouseId ? 'Ubah gudang' : 'Tambah gudang',
      kicker: 'Persediaan',
      subtitle: warehouseId
        ? 'Perbarui identitas dan status gudang.'
        : 'Gudang menampung lokasi penyimpanan dan saldo stok.',
      body: `
        <form id="inventory-warehouse-form" class="form-grid">
          <label class="field field-span">
            <span>Pedagang *</span>
            <select name="merchantId" required ${warehouseId ? 'disabled' : ''}>
              ${inventoryMerchantOptions(merchantList, selectedMerchantId)}
            </select>
          </label>
          <label class="field">
            <span>Kode gudang</span>
            <input name="code" maxlength="64" value="${escapeHtml(record?.code ?? '')}" placeholder="Otomatis jika kosong" />
          </label>
          <label class="field">
            <span>Status</span>
            <select name="status">
              <option value="active" ${record?.status !== 'inactive' ? 'selected' : ''}>Aktif</option>
              <option value="inactive" ${record?.status === 'inactive' ? 'selected' : ''}>Nonaktif</option>
            </select>
          </label>
          <label class="field field-span">
            <span>Nama gudang *</span>
            <input name="name" required maxlength="255" value="${escapeHtml(record?.name ?? '')}" placeholder="Contoh: Gudang utama" />
          </label>
          <label class="field">
            <span>Kota</span>
            <input name="city" maxlength="120" value="${escapeHtml(record?.city ?? '')}" />
          </label>
          <label class="field">
            <span>Provinsi</span>
            <input name="province" maxlength="120" value="${escapeHtml(record?.province ?? '')}" />
          </label>
          <label class="field field-span">
            <span>Alamat</span>
            <textarea name="address" rows="2" maxlength="2000">${escapeHtml(record?.address ?? '')}</textarea>
          </label>
          <label class="field field-span checkbox-field">
            <input name="isDefault" type="checkbox" ${record?.isDefault ? 'checked' : ''} />
            <span>Jadikan gudang utama pedagang</span>
          </label>
        </form>
      `,
      footer: `
        <button class="button button-ghost" type="button" data-modal-close>Batal</button>
        <button class="button button-primary" id="inventory-warehouse-submit" type="submit" form="inventory-warehouse-form">
          ${icon('plus')} ${warehouseId ? 'Simpan perubahan' : 'Simpan gudang'}
        </button>
      `,
    });
    const form = modal.querySelector('#inventory-warehouse-form');
    const submit = modal.querySelector('#inventory-warehouse-submit');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const payload = {
        code: String(data.get('code') ?? '').trim() || undefined,
        name: String(data.get('name') ?? '').trim(),
        city: String(data.get('city') ?? '').trim() || undefined,
        province: String(data.get('province') ?? '').trim() || undefined,
        address: String(data.get('address') ?? '').trim() || undefined,
        status: String(data.get('status') ?? 'active'),
        isDefault: data.get('isDefault') === 'on',
      };
      if (!payload.name || payload.name.length < 2) {
        showToast('Data belum lengkap', 'Isi nama gudang minimal 2 karakter.', 'error');
        return;
      }
      if (!warehouseId) {
        payload.merchantId = String(data.get('merchantId') ?? '');
        if (!payload.merchantId) {
          showToast('Data belum lengkap', 'Pilih pedagang pemilik gudang.', 'error');
          return;
        }
      }
      submit.disabled = true;
      try {
        await api(warehouseId ? `/inventory/warehouses/${warehouseId}` : '/inventory/warehouses', {
          method: warehouseId ? 'PATCH' : 'POST',
          body: payload,
        });
        closeModal();
        showToast('Gudang tersimpan', `${payload.name} berhasil disimpan.`);
        await loadInventory(true);
      } catch (error) {
        showToast('Gagal menyimpan gudang', error.message, 'error');
      } finally {
        submit.disabled = false;
      }
    });
  } catch (error) {
    closeModal();
    showToast('Gagal memuat gudang', error.message, 'error');
  }
}

async function openInventoryLocationModal(locationId) {
  openModal({
    title: locationId ? 'Ubah lokasi' : 'Tambah lokasi',
    kicker: 'Persediaan',
    subtitle: 'Memuat daftar gudang...',
    body: tableLoading(3),
  });
  try {
    const warehouses = await api('/inventory/warehouses?limit=100');
    const warehouseList = warehouses.data ?? [];
    if (!warehouseList.length) {
      closeModal();
      showToast('Gudang belum tersedia', 'Tambahkan gudang sebelum membuat lokasi.', 'error');
      return;
    }
    const record = locationId
      ? (state.inventory?.locations?.data ?? []).find((row) => row.id === locationId)
      : null;
    const selectedWarehouseId = record?.warehouseId ?? warehouseList[0].id;
    const modal = openModal({
      title: locationId ? 'Ubah lokasi gudang' : 'Tambah lokasi gudang',
      kicker: 'Persediaan',
      subtitle: 'Lokasi adalah posisi fisik stok, seperti rak, area terima, atau karantina.',
      body: `
        <form id="inventory-location-form" class="form-grid">
          <label class="field field-span">
            <span>Gudang *</span>
            <select name="warehouseId" required ${locationId ? 'disabled' : ''}>
              ${inventoryWarehouseOptions(warehouseList, selectedWarehouseId)}
            </select>
          </label>
          <label class="field">
            <span>Kode lokasi</span>
            <input name="code" maxlength="64" value="${escapeHtml(record?.code ?? '')}" placeholder="Otomatis jika kosong" />
          </label>
          <label class="field">
            <span>Tipe</span>
            <select name="type">
              ${['storage', 'receiving', 'picking', 'staging', 'returns', 'quarantine', 'other']
                .map(
                  (type) =>
                    `<option value="${type}" ${record?.type === type ? 'selected' : ''}>${escapeHtml(statusLabel(type))}</option>`,
                )
                .join('')}
            </select>
          </label>
          <label class="field field-span">
            <span>Nama lokasi *</span>
            <input name="name" required maxlength="255" value="${escapeHtml(record?.name ?? '')}" placeholder="Contoh: Rak A1" />
          </label>
          <label class="field">
            <span>Status</span>
            <select name="status">
              ${['active', 'inactive', 'blocked']
                .map(
                  (status) =>
                    `<option value="${status}" ${(record?.status ?? 'active') === status ? 'selected' : ''}>${escapeHtml(statusLabel(status))}</option>`,
                )
                .join('')}
            </select>
          </label>
          <label class="field field-span">
            <span>Catatan</span>
            <textarea name="notes" rows="2" maxlength="2000">${escapeHtml(record?.notes ?? '')}</textarea>
          </label>
        </form>
      `,
      footer: `
        <button class="button button-ghost" type="button" data-modal-close>Batal</button>
        <button class="button button-primary" id="inventory-location-submit" type="submit" form="inventory-location-form">
          ${icon('plus')} ${locationId ? 'Simpan perubahan' : 'Simpan lokasi'}
        </button>
      `,
    });
    const form = modal.querySelector('#inventory-location-form');
    const submit = modal.querySelector('#inventory-location-submit');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const payload = {
        code: String(data.get('code') ?? '').trim() || undefined,
        name: String(data.get('name') ?? '').trim(),
        type: String(data.get('type') ?? 'storage'),
        status: String(data.get('status') ?? 'active'),
        notes: String(data.get('notes') ?? '').trim() || undefined,
      };
      if (!payload.name) {
        showToast('Data belum lengkap', 'Isi nama lokasi.', 'error');
        return;
      }
      submit.disabled = true;
      try {
        if (locationId) {
          await api(`/inventory/locations/${locationId}`, { method: 'PATCH', body: payload });
        } else {
          const warehouseId = String(data.get('warehouseId') ?? '');
          if (!warehouseId) throw new Error('Pilih gudang.');
          await api(`/inventory/warehouses/${warehouseId}/locations`, {
            method: 'POST',
            body: payload,
          });
        }
        closeModal();
        showToast('Lokasi tersimpan', `${payload.name} berhasil disimpan.`);
        await loadInventory(true);
      } catch (error) {
        showToast('Gagal menyimpan lokasi', error.message, 'error');
      } finally {
        submit.disabled = false;
      }
    });
  } catch (error) {
    closeModal();
    showToast('Gagal memuat lokasi', error.message, 'error');
  }
}

async function fillInventorySkuOptions(productId, select, selectedId = '') {
  select.innerHTML = '<option value="">Pilih SKU</option>';
  if (!productId) return;
  const result = await api(`/catalog/products/${productId}`);
  const skus = result.data?.skus ?? [];
  select.innerHTML =
    '<option value="">Pilih SKU</option>' +
    skus
      .map(
        (sku) =>
          `<option value="${escapeHtml(sku.id)}" ${sku.id === selectedId ? 'selected' : ''}>${escapeHtml(sku.skuCode)}</option>`,
      )
      .join('');
}

async function openInventoryItemModal(itemId) {
  openModal({
    title: itemId ? 'Ubah item persediaan' : 'Tambah item persediaan',
    kicker: 'Persediaan',
    subtitle: 'Memuat produk dan pedagang...',
    body: tableLoading(3),
  });
  try {
    const [merchants, products] = await Promise.all([
      api('/merchants?limit=100'),
      api('/catalog/products?limit=100'),
    ]);
    const merchantList = merchants.data ?? [];
    const productList = products.data ?? [];
    if (!merchantList.length) {
      closeModal();
      showToast('Pedagang belum tersedia', 'Tambahkan pedagang sebelum membuat item.', 'error');
      return;
    }
    const record = itemId
      ? (state.inventory?.items?.data ?? []).find((row) => row.id === itemId)
      : null;
    const selectedMerchantId = record?.merchantId ?? merchantList[0].id;
    const modal = openModal({
      title: itemId ? 'Ubah item persediaan' : 'Tambah item persediaan',
      kicker: 'Persediaan',
      subtitle: 'Item persediaan menghubungkan stok dengan SKU produk.',
      body: `
        <form id="inventory-item-form" class="form-grid">
          <label class="field field-span">
            <span>Pedagang *</span>
            <select name="merchantId" id="inventory-item-merchant" required ${itemId ? 'disabled' : ''}>
              ${inventoryMerchantOptions(merchantList, selectedMerchantId)}
            </select>
          </label>
          <label class="field field-span">
            <span>Produk *</span>
            <select name="productId" id="inventory-item-product" required ${itemId ? 'disabled' : ''}>
              ${inventoryProductOptions(productList, selectedMerchantId, record?.productId ?? '')}
            </select>
          </label>
          <label class="field field-span">
            <span>SKU *</span>
            <select name="skuId" id="inventory-item-sku" required ${itemId ? 'disabled' : ''}></select>
          </label>
          <label class="field">
            <span>Stok minimum</span>
            <input name="minStock" type="number" min="0" step="0.001" value="${escapeHtml(record?.minStock ?? '0')}" />
          </label>
          <label class="field">
            <span>Stok maksimum</span>
            <input name="maxStock" type="number" min="0" step="0.001" value="${escapeHtml(record?.maxStock ?? '')}" />
          </label>
          <label class="field">
            <span>Titik pesan ulang</span>
            <input name="reorderPoint" type="number" min="0" step="0.001" value="${escapeHtml(record?.reorderPoint ?? '')}" />
          </label>
          <label class="field">
            <span>Biaya satuan</span>
            <input name="unitCost" type="number" min="0" step="0.01" value="${escapeHtml(record?.unitCost ?? '0')}" />
          </label>
          <label class="field">
            <span>Status</span>
            <select name="status">
              ${['active', 'inactive', 'discontinued']
                .map(
                  (status) =>
                    `<option value="${status}" ${(record?.status ?? 'active') === status ? 'selected' : ''}>${escapeHtml(statusLabel(status))}</option>`,
                )
                .join('')}
            </select>
          </label>
          <div class="field checkbox-field">
            <label><input name="trackBatches" type="checkbox" ${record?.trackBatches ? 'checked' : ''} /> Lacak batch</label>
            <label><input name="trackExpiry" type="checkbox" ${record?.trackExpiry ? 'checked' : ''} /> Lacak kedaluwarsa</label>
          </div>
          <label class="field field-span">
            <span>Catatan</span>
            <textarea name="notes" rows="2" maxlength="2000">${escapeHtml(record?.notes ?? '')}</textarea>
          </label>
        </form>
      `,
      footer: `
        <button class="button button-ghost" type="button" data-modal-close>Batal</button>
        <button class="button button-primary" id="inventory-item-submit" type="submit" form="inventory-item-form">
          ${icon('plus')} ${itemId ? 'Simpan perubahan' : 'Simpan item'}
        </button>
      `,
    });

    const form = modal.querySelector('#inventory-item-form');
    const merchantSelect = modal.querySelector('#inventory-item-merchant');
    const productSelect = modal.querySelector('#inventory-item-product');
    const skuSelect = modal.querySelector('#inventory-item-sku');
    const submit = modal.querySelector('#inventory-item-submit');

    await fillInventorySkuOptions(record?.productId ?? productSelect.value, skuSelect, record?.skuId ?? '');
    merchantSelect.addEventListener('change', () => {
      productSelect.innerHTML = inventoryProductOptions(productList, merchantSelect.value);
      skuSelect.innerHTML = '<option value="">Pilih SKU</option>';
    });
    productSelect.addEventListener('change', async () => {
      await fillInventorySkuOptions(productSelect.value, skuSelect);
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const payload = {
        status: String(data.get('status') ?? 'active'),
        minStock: String(data.get('minStock') ?? '0'),
        maxStock: String(data.get('maxStock') ?? '').trim() || undefined,
        reorderPoint: String(data.get('reorderPoint') ?? '').trim() || undefined,
        unitCost: String(data.get('unitCost') ?? '0'),
        trackBatches: data.get('trackBatches') === 'on',
        trackExpiry: data.get('trackExpiry') === 'on',
        notes: String(data.get('notes') ?? '').trim() || undefined,
      };
      if (!itemId) {
        payload.merchantId = String(data.get('merchantId') ?? '');
        payload.productId = String(data.get('productId') ?? '');
        payload.skuId = String(data.get('skuId') ?? '');
        if (!payload.merchantId || !payload.productId || !payload.skuId) {
          showToast('Data belum lengkap', 'Pilih pedagang, produk, dan SKU.', 'error');
          return;
        }
      }
      submit.disabled = true;
      try {
        await api(itemId ? `/inventory/items/${itemId}` : '/inventory/items', {
          method: itemId ? 'PATCH' : 'POST',
          body: payload,
        });
        closeModal();
        showToast('Item tersimpan', 'Item persediaan berhasil disimpan.');
        await loadInventory(true);
      } catch (error) {
        showToast('Gagal menyimpan item', error.message, 'error');
      } finally {
        submit.disabled = false;
      }
    });
  } catch (error) {
    closeModal();
    showToast('Gagal memuat item', error.message, 'error');
  }
}

async function openInventoryMovementModal() {
  openModal({
    title: 'Catat pergerakan stok',
    kicker: 'Persediaan',
    subtitle: 'Memuat gudang dan item...',
    body: tableLoading(4),
  });
  try {
    const [warehouses, items] = await Promise.all([
      api('/inventory/warehouses?limit=100'),
      api('/inventory/items?limit=100'),
    ]);
    const warehouseList = warehouses.data ?? [];
    const itemList = items.data ?? [];
    if (!warehouseList.length || !itemList.length) {
      closeModal();
      showToast(
        'Data belum tersedia',
        'Tambahkan gudang, lokasi, dan item persediaan terlebih dahulu.',
        'error',
      );
      return;
    }
    const merchantIds = [...new Set(warehouseList.map((row) => row.merchantId))];
    const merchantNames = new Map();
    for (const row of warehouseList) merchantNames.set(row.merchantId, row.merchantName);
    const firstMerchant = merchantIds[0];
    const modal = openModal({
      title: 'Catat pergerakan stok',
      kicker: 'Persediaan',
      subtitle: 'Pergerakan langsung mengubah saldo stok pada lokasi terkait.',
      wide: true,
      body: `
        <form id="inventory-movement-form" class="form-grid">
          <label class="field">
            <span>Pedagang *</span>
            <select name="merchantId" id="inventory-movement-merchant" required>
              ${merchantIds
                .map(
                  (id) =>
                    `<option value="${escapeHtml(id)}" ${id === firstMerchant ? 'selected' : ''}>${escapeHtml(merchantNames.get(id))}</option>`,
                )
                .join('')}
            </select>
          </label>
          <label class="field">
            <span>Tipe *</span>
            <select name="type" id="inventory-movement-type">
              <option value="inbound">Barang masuk</option>
              <option value="outbound">Barang keluar</option>
              <option value="transfer">Transfer antar lokasi</option>
              <option value="return">Retur masuk</option>
            </select>
          </label>
          <div class="field field-span" id="inventory-source-block" hidden>
            <div class="form-grid">
              <label class="field">
                <span>Gudang sumber</span>
                <select name="sourceWarehouseId" id="inventory-source-warehouse"></select>
              </label>
              <label class="field">
                <span>Lokasi sumber</span>
                <select name="sourceLocationId" id="inventory-source-location"></select>
              </label>
            </div>
          </div>
          <div class="field field-span" id="inventory-destination-block">
            <div class="form-grid">
              <label class="field">
                <span>Gudang tujuan</span>
                <select name="destinationWarehouseId" id="inventory-destination-warehouse"></select>
              </label>
              <label class="field">
                <span>Lokasi tujuan</span>
                <select name="destinationLocationId" id="inventory-destination-location"></select>
              </label>
            </div>
          </div>
          <label class="field field-span">
            <span>Item *</span>
            <select name="inventoryItemId" id="inventory-movement-item" required></select>
          </label>
          <label class="field">
            <span>Jumlah *</span>
            <input name="quantity" type="number" min="0.001" step="0.001" required placeholder="0" />
          </label>
          <label class="field">
            <span>Biaya satuan</span>
            <input name="unitCost" type="number" min="0" step="0.01" placeholder="Mengikuti biaya item" />
          </label>
          <label class="field">
            <span>Nomor batch</span>
            <input name="batchNumber" maxlength="100" placeholder="Opsional" />
          </label>
          <label class="field">
            <span>Kedaluwarsa batch</span>
            <input name="expiryDate" type="date" />
          </label>
          <label class="field field-span">
            <span>Catatan</span>
            <input name="notes" maxlength="2000" placeholder="Referensi atau keterangan" />
          </label>
        </form>
      `,
      footer: `
        <button class="button button-ghost" type="button" data-modal-close>Batal</button>
        <button class="button button-primary" id="inventory-movement-submit" type="submit" form="inventory-movement-form">
          ${icon('plus')} Simpan pergerakan
        </button>
      `,
    });

    const form = modal.querySelector('#inventory-movement-form');
    const merchantSelect = modal.querySelector('#inventory-movement-merchant');
    const typeSelect = modal.querySelector('#inventory-movement-type');
    const sourceBlock = modal.querySelector('#inventory-source-block');
    const destinationBlock = modal.querySelector('#inventory-destination-block');
    const sourceWarehouse = modal.querySelector('#inventory-source-warehouse');
    const sourceLocation = modal.querySelector('#inventory-source-location');
    const destinationWarehouse = modal.querySelector('#inventory-destination-warehouse');
    const destinationLocation = modal.querySelector('#inventory-destination-location');
    const itemSelect = modal.querySelector('#inventory-movement-item');
    const submit = modal.querySelector('#inventory-movement-submit');

    const refreshLocations = async (warehouseSelect, locationSelect, selectedId = '') => {
      locationSelect.innerHTML = await inventoryLocationOptions(warehouseSelect.value, selectedId);
    };
    const refreshForm = async () => {
      const merchantId = merchantSelect.value;
      sourceWarehouse.innerHTML = inventoryWarehouseOptions(warehouseList, '', merchantId);
      destinationWarehouse.innerHTML = inventoryWarehouseOptions(warehouseList, '', merchantId);
      itemSelect.innerHTML = inventoryItemOptions(itemList, merchantId);
      await refreshLocations(sourceWarehouse, sourceLocation);
      await refreshLocations(destinationWarehouse, destinationLocation);
      updateVisibility();
    };
    const updateVisibility = () => {
      const type = typeSelect.value;
      sourceBlock.hidden = type !== 'outbound' && type !== 'transfer';
      destinationBlock.hidden = type === 'outbound';
    };

    merchantSelect.addEventListener('change', refreshForm);
    typeSelect.addEventListener('change', updateVisibility);
    sourceWarehouse.addEventListener('change', () => refreshLocations(sourceWarehouse, sourceLocation));
    destinationWarehouse.addEventListener('change', () =>
      refreshLocations(destinationWarehouse, destinationLocation),
    );

    await refreshForm();

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const type = String(data.get('type') ?? 'inbound');
      const itemId = String(data.get('inventoryItemId') ?? '');
      const quantity = String(data.get('quantity') ?? '');
      if (!itemId || !quantity || Number(quantity) <= 0) {
        showToast('Data belum lengkap', 'Pilih item dan isi jumlah lebih dari 0.', 'error');
        return;
      }
      const payload = {
        type,
        inventoryItemId: itemId,
        quantity,
        unitCost: String(data.get('unitCost') ?? '').trim() || undefined,
        batchNumber: String(data.get('batchNumber') ?? '').trim() || undefined,
        expiryDate: String(data.get('expiryDate') ?? '').trim() || undefined,
        notes: String(data.get('notes') ?? '').trim() || undefined,
      };
      if (type === 'outbound' || type === 'transfer') {
        payload.sourceWarehouseId = String(data.get('sourceWarehouseId') ?? '');
        payload.sourceLocationId = String(data.get('sourceLocationId') ?? '');
      }
      if (type !== 'outbound') {
        payload.destinationWarehouseId = String(data.get('destinationWarehouseId') ?? '');
        payload.destinationLocationId = String(data.get('destinationLocationId') ?? '');
      }
      if (
        (payload.sourceWarehouseId && !payload.sourceLocationId) ||
        (payload.destinationWarehouseId && !payload.destinationLocationId)
      ) {
        showToast('Lokasi belum lengkap', 'Pilih lokasi sumber dan tujuan dengan lengkap.', 'error');
        return;
      }
      if (type === 'transfer' && payload.sourceLocationId === payload.destinationLocationId) {
        showToast('Lokasi tidak valid', 'Lokasi sumber dan tujuan tidak boleh sama.', 'error');
        return;
      }
      submit.disabled = true;
      try {
        await api('/inventory/movements', {
          method: 'POST',
          body: {
            ...payload,
            items: [
              {
                inventoryItemId: payload.inventoryItemId,
                quantity: payload.quantity,
                unitCost: payload.unitCost,
                batchNumber: payload.batchNumber,
                expiryDate: payload.expiryDate,
                notes: payload.notes,
              },
            ],
          },
        });
        closeModal();
        showToast('Pergerakan tersimpan', 'Saldo stok berhasil diperbarui.');
        await loadInventory(true);
      } catch (error) {
        showToast('Gagal menyimpan pergerakan', error.message, 'error');
      } finally {
        submit.disabled = false;
      }
    });
  } catch (error) {
    closeModal();
    showToast('Gagal memuat pergerakan', error.message, 'error');
  }
}

async function openInventoryAdjustmentModal(prefill = {}) {
  openModal({
    title: 'Penyesuaian stok',
    kicker: 'Persediaan',
    subtitle: 'Memuat gudang dan item...',
    body: tableLoading(3),
  });
  try {
    const [warehouses, items] = await Promise.all([
      api('/inventory/warehouses?limit=100'),
      api('/inventory/items?limit=100'),
    ]);
    const warehouseList = warehouses.data ?? [];
    const itemList = items.data ?? [];
    if (!warehouseList.length || !itemList.length) {
      closeModal();
      showToast('Data belum tersedia', 'Tambahkan gudang dan item terlebih dahulu.', 'error');
      return;
    }
    const prefillWarehouse = prefill.warehouseId
      ? warehouseList.find((row) => row.id === prefill.warehouseId)
      : null;
    const merchantId = prefillWarehouse?.merchantId ?? warehouseList[0].merchantId;
    const merchantIds = [...new Set(warehouseList.map((row) => row.merchantId))];
    const merchantNames = new Map();
    for (const row of warehouseList) merchantNames.set(row.merchantId, row.merchantName);

    const modal = openModal({
      title: 'Penyesuaian stok',
      kicker: 'Persediaan',
      subtitle: 'Catat koreksi stok, kerusakan, kehilangan, atau hasil hitung fisik.',
      body: `
        <form id="inventory-adjustment-form" class="form-grid">
          <label class="field field-span">
            <span>Pedagang *</span>
            <select name="merchantId" id="inventory-adjustment-merchant">
              ${merchantIds
                .map(
                  (id) =>
                    `<option value="${escapeHtml(id)}" ${id === merchantId ? 'selected' : ''}>${escapeHtml(merchantNames.get(id))}</option>`,
                )
                .join('')}
            </select>
          </label>
          <label class="field">
            <span>Gudang *</span>
            <select name="warehouseId" id="inventory-adjustment-warehouse" required>
              ${inventoryWarehouseOptions(warehouseList, prefill.warehouseId ?? '', merchantId)}
            </select>
          </label>
          <label class="field">
            <span>Lokasi *</span>
            <select name="warehouseLocationId" id="inventory-adjustment-location" required></select>
          </label>
          <label class="field field-span">
            <span>Item *</span>
            <select name="inventoryItemId" id="inventory-adjustment-item" required>
              ${inventoryItemOptions(itemList, merchantId, prefill.itemId ?? '')}
            </select>
          </label>
          <label class="field">
            <span>Tipe *</span>
            <select name="type" id="inventory-adjustment-type">
              <option value="correction">Koreksi ke stok hasil hitung</option>
              <option value="increase">Penambahan stok</option>
              <option value="decrease">Pengurangan stok</option>
              <option value="damage">Barang rusak</option>
              <option value="loss">Kehilangan</option>
              <option value="other">Lainnya</option>
            </select>
          </label>
          <label class="field">
            <span id="inventory-adjustment-quantity-label">Stok hasil hitung *</span>
            <input name="quantity" id="inventory-adjustment-quantity" type="number" min="0" step="0.001" required value="0" />
          </label>
          <label class="field field-span">
            <span>Alasan *</span>
            <input name="reason" required minlength="3" maxlength="2000" placeholder="Contoh: hasil opname rak A1" />
          </label>
          <label class="field field-span">
            <span>Catatan</span>
            <textarea name="notes" rows="2" maxlength="2000"></textarea>
          </label>
        </form>
      `,
      footer: `
        <button class="button button-ghost" type="button" data-modal-close>Batal</button>
        <button class="button button-primary" id="inventory-adjustment-submit" type="submit" form="inventory-adjustment-form">
          ${icon('check')} Simpan penyesuaian
        </button>
      `,
    });

    const form = modal.querySelector('#inventory-adjustment-form');
    const merchantSelect = modal.querySelector('#inventory-adjustment-merchant');
    const warehouseSelect = modal.querySelector('#inventory-adjustment-warehouse');
    const locationSelect = modal.querySelector('#inventory-adjustment-location');
    const itemSelect = modal.querySelector('#inventory-adjustment-item');
    const typeSelect = modal.querySelector('#inventory-adjustment-type');
    const quantityInput = modal.querySelector('#inventory-adjustment-quantity');
    const quantityLabel = modal.querySelector('#inventory-adjustment-quantity-label');
    const submit = modal.querySelector('#inventory-adjustment-submit');

    const refreshLocations = async (selectedId = '') => {
      locationSelect.innerHTML = await inventoryLocationOptions(warehouseSelect.value, selectedId);
    };
    const refreshWarehouses = async () => {
      warehouseSelect.innerHTML = inventoryWarehouseOptions(
        warehouseList,
        '',
        merchantSelect.value,
      );
      itemSelect.innerHTML = inventoryItemOptions(itemList, merchantSelect.value);
      await refreshLocations();
    };

    merchantSelect.addEventListener('change', refreshWarehouses);
    warehouseSelect.addEventListener('change', () => refreshLocations());
    typeSelect.addEventListener('change', () => {
      quantityLabel.textContent =
        typeSelect.value === 'correction' ? 'Stok hasil hitung *' : 'Jumlah penyesuaian *';
      quantityInput.min = typeSelect.value === 'correction' ? '0' : '0.001';
    });

    await refreshLocations(prefill.locationId ?? '');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const payload = {
        warehouseId: String(data.get('warehouseId') ?? ''),
        warehouseLocationId: String(data.get('warehouseLocationId') ?? ''),
        inventoryItemId: String(data.get('inventoryItemId') ?? ''),
        type: String(data.get('type') ?? 'correction'),
        quantity: String(data.get('quantity') ?? '0'),
        reason: String(data.get('reason') ?? '').trim(),
        notes: String(data.get('notes') ?? '').trim() || undefined,
      };
      if (!payload.warehouseId || !payload.warehouseLocationId || !payload.inventoryItemId) {
        showToast('Data belum lengkap', 'Pilih gudang, lokasi, dan item.', 'error');
        return;
      }
      if (payload.type !== 'correction' && Number(payload.quantity) <= 0) {
        showToast('Jumlah tidak valid', 'Jumlah penyesuaian harus lebih dari 0.', 'error');
        return;
      }
      if (payload.reason.length < 3) {
        showToast('Alasan belum lengkap', 'Isi alasan minimal 3 karakter.', 'error');
        return;
      }
      submit.disabled = true;
      try {
        await api('/inventory/adjustments', { method: 'POST', body: payload });
        closeModal();
        showToast('Penyesuaian tersimpan', 'Stok berhasil disesuaikan.');
        await loadInventory(true);
      } catch (error) {
        showToast('Gagal menyimpan penyesuaian', error.message, 'error');
      } finally {
        submit.disabled = false;
      }
    });
  } catch (error) {
    closeModal();
    showToast('Gagal memuat penyesuaian', error.message, 'error');
  }
}

async function openInventoryCountModal() {
  openModal({
    title: 'Mulai opname stok',
    kicker: 'Persediaan',
    subtitle: 'Memuat gudang...',
    body: tableLoading(3),
  });
  try {
    const warehouses = await api('/inventory/warehouses?limit=100');
    const warehouseList = warehouses.data ?? [];
    if (!warehouseList.length) {
      closeModal();
      showToast('Gudang belum tersedia', 'Tambahkan gudang dan stok sebelum opname.', 'error');
      return;
    }
    const merchantIds = [...new Set(warehouseList.map((row) => row.merchantId))];
    const merchantNames = new Map();
    for (const row of warehouseList) merchantNames.set(row.merchantId, row.merchantName);
    const firstMerchant = merchantIds[0];
    const modal = openModal({
      title: 'Mulai opname stok',
      kicker: 'Persediaan',
      subtitle: 'Item opname otomatis diambil dari saldo stok pada lokasi yang dipilih.',
      body: `
        <form id="inventory-count-form" class="form-grid">
          <label class="field field-span">
            <span>Pedagang *</span>
            <select name="merchantId" id="inventory-count-merchant">
              ${merchantIds
                .map(
                  (id) =>
                    `<option value="${escapeHtml(id)}" ${id === firstMerchant ? 'selected' : ''}>${escapeHtml(merchantNames.get(id))}</option>`,
                )
                .join('')}
            </select>
          </label>
          <label class="field">
            <span>Gudang *</span>
            <select name="warehouseId" id="inventory-count-warehouse" required>
              ${inventoryWarehouseOptions(warehouseList, '', firstMerchant)}
            </select>
          </label>
          <label class="field">
            <span>Lokasi *</span>
            <select name="warehouseLocationId" id="inventory-count-location" required></select>
          </label>
          <label class="field field-span">
            <span>Catatan</span>
            <textarea name="notes" rows="2" maxlength="2000" placeholder="Contoh: opname akhir bulan"></textarea>
          </label>
        </form>
      `,
      footer: `
        <button class="button button-ghost" type="button" data-modal-close>Batal</button>
        <button class="button button-primary" id="inventory-count-submit" type="submit" form="inventory-count-form">
          ${icon('plus')} Mulai opname
        </button>
      `,
    });

    const form = modal.querySelector('#inventory-count-form');
    const merchantSelect = modal.querySelector('#inventory-count-merchant');
    const warehouseSelect = modal.querySelector('#inventory-count-warehouse');
    const locationSelect = modal.querySelector('#inventory-count-location');
    const submit = modal.querySelector('#inventory-count-submit');

    const refreshLocations = async () => {
      locationSelect.innerHTML = await inventoryLocationOptions(warehouseSelect.value);
    };
    merchantSelect.addEventListener('change', async () => {
      warehouseSelect.innerHTML = inventoryWarehouseOptions(warehouseList, '', merchantSelect.value);
      await refreshLocations();
    });
    warehouseSelect.addEventListener('change', refreshLocations);
    await refreshLocations();

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const payload = {
        warehouseId: String(data.get('warehouseId') ?? ''),
        warehouseLocationId: String(data.get('warehouseLocationId') ?? ''),
        notes: String(data.get('notes') ?? '').trim() || undefined,
      };
      if (!payload.warehouseId || !payload.warehouseLocationId) {
        showToast('Data belum lengkap', 'Pilih gudang dan lokasi opname.', 'error');
        return;
      }
      submit.disabled = true;
      try {
        const result = await api('/inventory/stock-counts', { method: 'POST', body: payload });
        closeModal();
        showToast('Opname dimulai', result.data.countNumber);
        await loadInventory(true);
        await openInventoryCountDetail(result.data.id);
      } catch (error) {
        showToast('Gagal memulai opname', error.message, 'error');
      } finally {
        submit.disabled = false;
      }
    });
  } catch (error) {
    closeModal();
    showToast('Gagal memuat opname', error.message, 'error');
  }
}

async function openInventoryMovementDetail(movementId) {
  openModal({
    title: 'Detail pergerakan stok',
    kicker: 'Persediaan',
    subtitle: 'Memuat detail...',
    wide: true,
    body: tableLoading(3),
  });
  try {
    const result = await api(`/inventory/movements/${movementId}`);
    const row = result.data;
    const items = row.items ?? [];
    const modal = openModal({
      title: row.movementNumber,
      kicker: 'Detail pergerakan stok',
      subtitle: `${statusLabel(row.type)} · ${formatDateTime(row.completedAt)}`,
      wide: true,
      body: `
        <dl class="detail-list">
          <div class="detail-row"><dt>Pedagang</dt><dd>${escapeHtml(row.merchantName)}</dd></div>
          <div class="detail-row"><dt>Asal</dt><dd>${escapeHtml(row.sourceWarehouseName ?? '—')}${row.sourceLocationName ? ` · ${escapeHtml(row.sourceLocationName)}` : ''}</dd></div>
          <div class="detail-row"><dt>Tujuan</dt><dd>${escapeHtml(row.destinationWarehouseName ?? '—')}${row.destinationLocationName ? ` · ${escapeHtml(row.destinationLocationName)}` : ''}</dd></div>
          <div class="detail-row"><dt>Referensi</dt><dd>${escapeHtml(row.referenceNumber ?? row.referenceType ?? '—')}</dd></div>
          <div class="detail-row"><dt>Catatan</dt><dd>${escapeHtml(row.notes ?? '—')}</dd></div>
          <div class="detail-row"><dt>Total</dt><dd>${formatNumber(Number(row.totalQuantity))} unit · ${formatMoney(row.totalCost)}</dd></div>
          <div class="detail-row"><dt>Oleh</dt><dd>${escapeHtml(row.createdByName ?? 'Sistem')}</dd></div>
        </dl>
        <div class="table-wrap" style="margin-top:16px">
          <table class="table">
            <thead><tr><th>Produk</th><th>SKU</th><th>Jumlah</th><th>Biaya satuan</th><th>Total</th></tr></thead>
            <tbody>
              ${items
                .map(
                  (item) => `
                    <tr>
                      <td>${escapeHtml(item.productName)}</td>
                      <td>${escapeHtml(item.skuCode)}</td>
                      <td>${formatNumber(Number(item.quantity))}</td>
                      <td>${formatMoney(item.unitCost)}</td>
                      <td>${formatMoney(item.totalCost)}</td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `,
      footer: '<button class="button button-ghost" type="button" data-modal-close>Tutup</button>',
    });
    return modal;
  } catch (error) {
    closeModal();
    showToast('Gagal memuat detail', error.message, 'error');
  }
}

async function openInventoryCountDetail(countId) {
  openModal({
    title: 'Detail opname stok',
    kicker: 'Persediaan',
    subtitle: 'Memuat item opname...',
    wide: true,
    body: tableLoading(4),
  });
  try {
    const result = await api(`/inventory/stock-counts/${countId}`);
    const row = result.data;
    const items = row.items ?? [];
    const editable = (row.status === 'counting' || row.status === 'draft') && state.canWriteInventory;
    const modal = openModal({
      title: row.countNumber,
      kicker: 'Opname stok',
      subtitle: `${row.warehouseName} · ${row.locationName} · ${statusLabel(row.status)}`,
      wide: true,
      body: `
        <div class="toolbar" style="margin-bottom:14px">
          <span class="toolbar-count">${formatNumber(items.filter((item) => item.countedQuantity !== null).length)} dari ${formatNumber(items.length)} item dihitung</span>
          ${editable ? '<span class="cell-muted">Isi jumlah fisik pada kolom hitung, lalu simpan.</span>' : ''}
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Produk</th><th>SKU</th><th>Stok sistem</th><th>Jumlah fisik</th><th>Selisih</th><th>Catatan</th></tr></thead>
            <tbody>
              ${items
                .map(
                  (item) => `
                    <tr data-count-row="${escapeHtml(item.id)}">
                      <td>${escapeHtml(item.productName)}</td>
                      <td>${escapeHtml(item.skuCode)}</td>
                      <td>${formatNumber(Number(item.systemQuantity))}</td>
                      <td>
                        ${
                          editable
                            ? `<input class="table-input" type="number" min="0" step="0.001" data-count-input value="${item.countedQuantity === null ? '' : escapeHtml(item.countedQuantity)}" placeholder="0" />`
                            : item.countedQuantity === null
                              ? '—'
                              : formatNumber(Number(item.countedQuantity))
                        }
                      </td>
                      <td>${item.differenceQuantity === null ? '—' : `<span class="${Number(item.differenceQuantity) < 0 ? 'cell-danger' : ''}">${Number(item.differenceQuantity) > 0 ? '+' : ''}${formatNumber(Number(item.differenceQuantity))}</span>`}</td>
                      <td><input class="table-input" type="text" maxlength="1000" data-count-note value="${escapeHtml(item.notes ?? '')}" ${editable ? '' : 'disabled'} placeholder="Opsional" /></td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `,
      footer: `
        <button class="button button-ghost" type="button" data-modal-close>Tutup</button>
        ${editable ? `<button class="button button-primary" id="inventory-count-save" type="button">${icon('check')} Simpan hitungan</button>` : ''}
        ${editable ? `<button class="button button-primary" id="inventory-count-complete" type="button">${icon('check')} Selesaikan opname</button>` : ''}
        ${row.status !== 'completed' && row.status !== 'cancelled' && state.canWriteInventory ? '<button class="button button-ghost" id="inventory-count-cancel" type="button">Batalkan opname</button>' : ''}
      `,
    });

    const readRows = () =>
      [...modal.querySelectorAll('[data-count-row]')].map((tr) => {
        const input = tr.querySelector('[data-count-input]');
        const note = tr.querySelector('[data-count-note]');
        return {
          itemId: tr.dataset.countRow,
          countedQuantity: input?.value.trim() ?? '',
          notes: note?.value.trim() ?? '',
        };
      });

    modal.querySelector('#inventory-count-save')?.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      const rows = readRows().filter((item) => item.countedQuantity !== '');
      if (!rows.length) {
        showToast('Belum ada hitungan', 'Isi minimal satu jumlah fisik.', 'error');
        return;
      }
      button.disabled = true;
      try {
        for (const item of rows) {
          await api(`/inventory/stock-counts/${countId}/items/${item.itemId}`, {
            method: 'PATCH',
            body: {
              countedQuantity: item.countedQuantity,
              notes: item.notes || undefined,
            },
          });
        }
        showToast('Hitungan tersimpan', `${rows.length} item diperbarui.`);
        await loadInventory(true);
        await openInventoryCountDetail(countId);
      } catch (error) {
        showToast('Gagal menyimpan hitungan', error.message, 'error');
      } finally {
        button.disabled = false;
      }
    });

    modal.querySelector('#inventory-count-complete')?.addEventListener('click', async (event) => {
      if (!window.confirm('Selesaikan opname? Selisih stok akan dibuat sebagai penyesuaian.')) {
        return;
      }
      const button = event.currentTarget;
      button.disabled = true;
      try {
        await api(`/inventory/stock-counts/${countId}/complete`, { method: 'POST' });
        closeModal();
        showToast('Opname selesai', 'Penyesuaian stok telah dibuat.');
        await loadInventory(true);
      } catch (error) {
        showToast('Gagal menyelesaikan opname', error.message, 'error');
        button.disabled = false;
      }
    });

    modal.querySelector('#inventory-count-cancel')?.addEventListener('click', async (event) => {
      if (!window.confirm('Batalkan opname ini?')) return;
      const button = event.currentTarget;
      button.disabled = true;
      try {
        await api(`/inventory/stock-counts/${countId}/cancel`, { method: 'POST' });
        closeModal();
        showToast('Opname dibatalkan');
        await loadInventory(true);
      } catch (error) {
        showToast('Gagal membatalkan opname', error.message, 'error');
        button.disabled = false;
      }
    });
  } catch (error) {
    closeModal();
    showToast('Gagal memuat opname', error.message, 'error');
  }
}

function openInventoryBatchModal(batchId) {
  const record = (state.inventory?.batches?.data ?? []).find((row) => row.id === batchId);
  if (!record) return;
  const modal = openModal({
    title: 'Ubah batch',
    kicker: 'Persediaan',
    subtitle: `${record.productName} · ${record.batchNumber}`,
    body: `
      <form id="inventory-batch-form" class="form-grid">
        <label class="field">
          <span>Status</span>
          <select name="status">
            ${['active', 'depleted', 'expired', 'quarantined']
              .map(
                (status) =>
                  `<option value="${status}" ${record.status === status ? 'selected' : ''}>${escapeHtml(statusLabel(status))}</option>`,
              )
              .join('')}
          </select>
        </label>
        <label class="field">
          <span>Kedaluwarsa</span>
          <input name="expiryDate" type="date" value="${escapeHtml(record.expiryDate ?? '')}" />
        </label>
        <label class="field field-span">
          <span>Referensi pemasok</span>
          <input name="supplierReference" maxlength="255" value="${escapeHtml(record.supplierReference ?? '')}" />
        </label>
        <label class="field field-span">
          <span>Catatan</span>
          <textarea name="notes" rows="2" maxlength="2000">${escapeHtml(record.notes ?? '')}</textarea>
        </label>
      </form>
    `,
    footer: `
      <button class="button button-ghost" type="button" data-modal-close>Batal</button>
      <button class="button button-primary" id="inventory-batch-submit" type="submit" form="inventory-batch-form">
        ${icon('check')} Simpan perubahan
      </button>
    `,
  });
  const form = modal.querySelector('#inventory-batch-form');
  const submit = modal.querySelector('#inventory-batch-submit');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    submit.disabled = true;
    try {
      await api(`/inventory/batches/${batchId}`, {
        method: 'PATCH',
        body: {
          status: String(data.get('status') ?? 'active'),
          expiryDate: String(data.get('expiryDate') ?? '').trim() || null,
          supplierReference: String(data.get('supplierReference') ?? '').trim() || null,
          notes: String(data.get('notes') ?? '').trim() || null,
        },
      });
      closeModal();
      showToast('Batch tersimpan', 'Perubahan batch berhasil disimpan.');
      await loadInventory(true);
    } catch (error) {
      showToast('Gagal menyimpan batch', error.message, 'error');
    } finally {
      submit.disabled = false;
    }
  });
}


/* ---------------------------- Supply chain ---------------------------- */

const SC_PRIORITY_LABELS = {
  low: 'Rendah',
  normal: 'Normal',
  high: 'Tinggi',
  urgent: 'Mendesak',
};

const SC_TABLE_HOSTS = [
  '#sc-suppliers-table',
  '#sc-requisitions-table',
  '#sc-quotations-table',
  '#sc-orders-table',
  '#sc-receipts-table',
  '#sc-warehouse-receipts-table',
  '#sc-putaway-table',
  '#sc-allocations-table',
  '#sc-picking-table',
  '#sc-packing-table',
  '#sc-dispatch-table',
  '#sc-returns-table',
  '#sc-groups-table',
  '#sc-history-table',
];

function scPriority(value) {
  return `<span class="status status-${escapeHtml(value)}">${escapeHtml(SC_PRIORITY_LABELS[value] ?? value ?? '—')}</span>`;
}

function scActions(items) {
  const html = items.filter(Boolean).join(' ');
  return html || '—';
}

function scButton(label, attributes) {
  return `<button class="action-link" type="button" ${attributes}>${icon('arrow-right')} ${escapeHtml(label)}</button>`;
}

function scSetText(selector, value) {
  const element = $(selector);
  if (element) element.textContent = value;
}

function scSetBadge(selector, count, noun) {
  const element = $(selector);
  if (!element) return;
  element.hidden = count <= 0;
  element.textContent = `${formatNumber(count)} ${noun}`;
}

function scRenderTable(hostSelector, columns, rows, renderRow, emptyTitle, emptyText) {
  const host = $(hostSelector);
  if (!host) return;
  if (!rows.length) {
    host.innerHTML = emptyState(emptyTitle, emptyText);
    return;
  }
  host.innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(renderRow).join('')}</tbody>
      </table>
    </div>
  `;
}

function scSupplierOptions(suppliers, selectedId = '') {
  return (
    '<option value="">Pilih supplier</option>' +
    suppliers
      .map(
        (row) =>
          `<option value="${escapeHtml(row.id)}" ${row.id === selectedId ? 'selected' : ''}>${escapeHtml(row.name)} (${escapeHtml(row.code)})</option>`,
      )
      .join('')
  );
}

async function scCommonData() {
  const [merchants, warehouses, items] = await Promise.all([
    api('/merchants?limit=100'),
    api('/inventory/warehouses?limit=100'),
    api('/inventory/items?limit=100'),
  ]);
  return {
    merchants: merchants.data ?? [],
    warehouses: warehouses.data ?? [],
    items: items.data ?? [],
  };
}

async function loadSupplyChain(force = false) {
  const sequence = ++state.sequences.supplyChain;
  if (!force && state.supplyChain) {
    renderSupplyChain();
    return;
  }

  for (const selector of SC_TABLE_HOSTS) {
    const host = $(selector);
    if (host) host.innerHTML = tableLoading(2);
  }
  for (const selector of [
    '#sc-stat-suppliers',
    '#sc-stat-requisitions',
    '#sc-stat-orders',
    '#sc-stat-fulfillment',
  ]) {
    scSetText(selector, '-');
  }

  try {
    const paths = [
      '/supply-chain/suppliers?limit=50',
      '/supply-chain/purchase-requisitions?limit=50',
      '/supply-chain/supplier-quotations?limit=50',
      '/supply-chain/purchase-orders?limit=50',
      '/supply-chain/goods-receipts?limit=50',
      '/supply-chain/warehouse-receipts?limit=50',
      '/supply-chain/putaway-tasks?limit=50',
      '/supply-chain/warehouse-allocations?limit=50',
      '/supply-chain/picking-tasks?limit=50',
      '/supply-chain/packing-tasks?limit=50',
      '/supply-chain/dispatch-records?limit=50',
      '/supply-chain/warehouse-returns?limit=50',
      '/supply-chain/collective-purchase-groups?limit=50',
      '/supply-chain/fulfillment-status-histories?limit=50',
    ];
    const results = await Promise.all(paths.map((path) => api(path)));
    if (sequence !== state.sequences.supplyChain) return;
    state.supplyChain = {
      suppliers: results[0].data ?? [],
      requisitions: results[1].data ?? [],
      quotations: results[2].data ?? [],
      orders: results[3].data ?? [],
      receipts: results[4].data ?? [],
      warehouseReceipts: results[5].data ?? [],
      putaway: results[6].data ?? [],
      allocations: results[7].data ?? [],
      picking: results[8].data ?? [],
      packing: results[9].data ?? [],
      dispatch: results[10].data ?? [],
      returns: results[11].data ?? [],
      groups: results[12].data ?? [],
      histories: results[13].data ?? [],
    };
    renderSupplyChain();
  } catch (error) {
    if (sequence !== state.sequences.supplyChain) return;
    for (const selector of SC_TABLE_HOSTS) {
      const host = $(selector);
      if (host) host.innerHTML = errorState(error.message, 'data-sc-retry');
    }
    showToast('Gagal memuat rantai pasok', error.message, 'error');
  }
}

function renderSupplyChain() {
  const data = state.supplyChain;
  if (!data) return;

  const activeSuppliers = data.suppliers.filter((row) => row.status === 'active').length;
  const activeRequisitions = data.requisitions.filter(
    (row) => !['converted', 'cancelled', 'rejected'].includes(row.status),
  ).length;
  const activeOrders = data.orders.filter((row) =>
    ['ordered', 'partially_received'].includes(row.status),
  ).length;
  const activeTasks =
    data.putaway.filter((row) => ['pending', 'in_progress'].includes(row.status)).length +
    data.picking.filter((row) => ['pending', 'in_progress'].includes(row.status)).length +
    data.packing.filter((row) => ['pending', 'packing'].includes(row.status)).length;

  scSetText('#sc-stat-suppliers', formatNumber(activeSuppliers));
  scSetText('#sc-stat-requisitions', formatNumber(activeRequisitions));
  scSetText('#sc-stat-orders', formatNumber(activeOrders));
  scSetText('#sc-stat-fulfillment', formatNumber(activeTasks));
  const summaryBadge = $('#sc-summary-badge');
  if (summaryBadge) {
    summaryBadge.hidden = activeTasks <= 0;
    summaryBadge.textContent = `${formatNumber(activeTasks)} tugas aktif`;
  }
  scSetBadge('#sc-supplier-count', data.suppliers.length, 'supplier');
  scSetBadge('#sc-requisition-count', data.requisitions.length, 'permintaan');
  scSetBadge('#sc-quotation-count', data.quotations.length, 'penawaran');
  scSetBadge('#sc-order-count', data.orders.length, 'order');
  scSetBadge('#sc-receipt-count', data.receipts.length, 'penerimaan');
  scSetBadge('#sc-warehouse-receipt-count', data.warehouseReceipts.length, 'penerimaan');
  scSetBadge('#sc-putaway-count', data.putaway.length, 'tugas');
  scSetBadge('#sc-allocation-count', data.allocations.length, 'alokasi');
  scSetBadge('#sc-picking-count', data.picking.length, 'tugas');
  scSetBadge('#sc-packing-count', data.packing.length, 'tugas');
  scSetBadge('#sc-dispatch-count', data.dispatch.length, 'pengiriman');
  scSetBadge('#sc-return-count', data.returns.length, 'retur');
  scSetBadge('#sc-group-count', data.groups.length, 'grup');
  scSetBadge('#sc-history-count', data.histories.length, 'riwayat');

  scRenderTable(
    '#sc-suppliers-table',
    ['Supplier', 'Kontak', 'Termin', 'Status', 'Aksi'],
    data.suppliers,
    (row) => `
      <tr>
        <td>
          <div class="cell-title">${escapeHtml(row.name)}</div>
          <div class="cell-muted">${escapeHtml(row.code)} • ${escapeHtml(row.merchantName)}</div>
        </td>
        <td>
          <div class="cell-title">${escapeHtml(row.contactName || '—')}</div>
          <div class="cell-muted">${escapeHtml(row.contactEmail || row.contactPhone || row.city || '—')}</div>
        </td>
        <td>${formatNumber(row.paymentTermDays)} hari</td>
        <td>${statusBadge(row.status)}</td>
        <td>—</td>
      </tr>
    `,
    'Belum ada supplier',
    'Tambahkan supplier agar pengadaan dan purchase order dapat dibuat.',
  );

  scRenderTable(
    '#sc-requisitions-table',
    ['Permintaan', 'Pedagang', 'Prioritas', 'Status', 'Aksi'],
    data.requisitions,
    (row) => {
      const actions = [];
      if (row.status === 'draft' && state.canWriteSupplyChain) {
        actions.push(
          scButton('Ajukan', `data-sc-pr-submit="${escapeHtml(row.id)}"`),
        );
      }
      if (row.status === 'submitted' && state.canManageSupplyChain) {
        actions.push(
          scButton('Setujui', `data-sc-pr-approve="${escapeHtml(row.id)}"`),
        );
      }
      if (row.status === 'approved' && state.canManageSupplyChain) {
        actions.push(
          scButton('Penawaran', `data-sc-pr-quote="${escapeHtml(row.id)}"`),
          scButton('Buat PO', `data-sc-pr-convert="${escapeHtml(row.id)}"`),
        );
      }
      return `
        <tr>
          <td>
            <div class="cell-title">${escapeHtml(row.requisitionNumber)}</div>
            <div class="cell-muted">${escapeHtml(row.title)} • ${escapeHtml(formatDate(row.createdAt))}</div>
          </td>
          <td>
            <div class="cell-title">${escapeHtml(row.merchantName)}</div>
            <div class="cell-muted">${escapeHtml(row.requesterName || '—')}</div>
          </td>
          <td>${scPriority(row.priority)}</td>
          <td>${statusBadge(row.status)}</td>
          <td>${scActions(actions)}</td>
        </tr>
      `;
    },
    'Belum ada permintaan pembelian',
    'Buat permintaan untuk memulai alur pengadaan.',
  );

  scRenderTable(
    '#sc-quotations-table',
    ['Penawaran', 'Supplier', 'Nilai', 'Status', 'Aksi'],
    data.quotations,
    (row) => {
      const actions = [];
      if (['requested'].includes(row.status) && state.canWriteSupplyChain) {
        actions.push(scButton('Ajukan', `data-sc-quote-submit="${escapeHtml(row.id)}"`));
      }
      if (row.status === 'submitted' && state.canManageSupplyChain) {
        actions.push(scButton('Terima', `data-sc-quote-accept="${escapeHtml(row.id)}"`));
      }
      if (row.status === 'accepted' && state.canManageSupplyChain) {
        actions.push(scButton('Buat PO', `data-sc-quote-convert="${escapeHtml(row.id)}"`));
      }
      return `
        <tr>
          <td>
            <div class="cell-title">${escapeHtml(row.quotationNumber)}</div>
            <div class="cell-muted">${escapeHtml(row.merchantName)} • ${escapeHtml(formatDate(row.createdAt))}</div>
          </td>
          <td>${escapeHtml(row.supplierName)}</td>
          <td>
            <div class="cell-title">${formatMoney(row.grandTotal, row.currency)}</div>
            <div class="cell-muted">Berlaku s.d. ${escapeHtml(formatDate(row.validUntil))}</div>
          </td>
          <td>${statusBadge(row.status)}</td>
          <td>${scActions(actions)}</td>
        </tr>
      `;
    },
    'Belum ada penawaran supplier',
    'Buat penawaran dari permintaan pembelian yang sudah disetujui.',
  );

  scRenderTable(
    '#sc-orders-table',
    ['Purchase order', 'Supplier', 'Nilai', 'Status', 'Aksi'],
    data.orders,
    (row) => {
      const actions = [];
      if (row.status === 'draft' && state.canWriteSupplyChain) {
        actions.push(scButton('Ajukan', `data-sc-po-submit="${escapeHtml(row.id)}"`));
      }
      if (row.status === 'pending_approval' && state.canManageSupplyChain) {
        actions.push(scButton('Setujui', `data-sc-po-approve="${escapeHtml(row.id)}"`));
      }
      if (row.status === 'approved' && state.canWriteSupplyChain) {
        actions.push(scButton('Kirim', `data-sc-po-send="${escapeHtml(row.id)}"`));
      }
      if (['ordered', 'partially_received'].includes(row.status) && state.canManageSupplyChain) {
        actions.push(scButton('Terima', `data-sc-po-receive="${escapeHtml(row.id)}"`));
      }
      if (row.status === 'received' && state.canManageSupplyChain) {
        actions.push(scButton('Tutup', `data-sc-po-close="${escapeHtml(row.id)}"`));
      }
      if (['draft', 'pending_approval', 'approved'].includes(row.status) && state.canManageSupplyChain) {
        actions.push(scButton('Batal', `data-sc-po-cancel="${escapeHtml(row.id)}"`));
      }
      return `
        <tr>
          <td>
            <div class="cell-title">${escapeHtml(row.orderNumber)}</div>
            <div class="cell-muted">${escapeHtml(row.merchantName)} • ${escapeHtml(formatDate(row.createdAt))}</div>
          </td>
          <td>
            <div class="cell-title">${escapeHtml(row.supplierName)}</div>
            <div class="cell-muted">ETA ${escapeHtml(formatDate(row.expectedDeliveryDate))}</div>
          </td>
          <td class="cell-nowrap">${formatMoney(row.grandTotal, row.currency)}</td>
          <td>${statusBadge(row.status)}</td>
          <td>${scActions(actions)}</td>
        </tr>
      `;
    },
    'Belum ada purchase order',
    'Konversi permintaan atau penawaran supplier menjadi purchase order.',
  );

  scRenderTable(
    '#sc-receipts-table',
    ['Penerimaan', 'PO / Supplier', 'Status', 'Aksi'],
    data.receipts,
    (row) => `
      <tr>
        <td>
          <div class="cell-title">${escapeHtml(row.receiptNumber)}</div>
          <div class="cell-muted">${escapeHtml(row.merchantName)} • ${escapeHtml(formatDateTime(row.createdAt))}</div>
        </td>
        <td>
          <div class="cell-title">${escapeHtml(row.purchaseOrderNumber || 'Tanpa PO')}</div>
          <div class="cell-muted">${escapeHtml(row.supplierName || '—')}</div>
        </td>
        <td>${statusBadge(row.status)}</td>
        <td>${scActions([
          row.status === 'draft' && state.canWriteSupplyChain
            ? scButton('Selesaikan', `data-sc-gr-complete="${escapeHtml(row.id)}"`)
            : '',
        ])}</td>
      </tr>
    `,
    'Belum ada penerimaan barang',
    'Penerimaan dibuat dari purchase order yang sudah dikirim.',
  );

  scRenderTable(
    '#sc-warehouse-receipts-table',
    ['Penerimaan', 'Gudang', 'Kuantitas', 'Status', 'Aksi'],
    data.warehouseReceipts,
    (row) => `
      <tr>
        <td>
          <div class="cell-title">${escapeHtml(row.receiptNumber)}</div>
          <div class="cell-muted">${escapeHtml(row.merchantName)} • ${escapeHtml(formatDateTime(row.createdAt))}</div>
        </td>
        <td>
          <div class="cell-title">${escapeHtml(row.warehouseName)}</div>
          <div class="cell-muted">Sumber ${escapeHtml(row.source || '—')}</div>
        </td>
        <td>
          <div class="cell-title">${formatNumber(row.receivedQuantity)} / ${formatNumber(row.expectedQuantity)}</div>
        </td>
        <td>${statusBadge(row.status)}</td>
        <td>—</td>
      </tr>
    `,
    'Belum ada penerimaan gudang',
    'Penerimaan gudang dibuat otomatis saat barang diterima dari supplier.',
  );

  scRenderTable(
    '#sc-putaway-table',
    ['Tugas', 'Barang', 'Tujuan', 'Status', 'Aksi'],
    data.putaway,
    (row) => `
      <tr>
        <td>
          <div class="cell-title">${escapeHtml(row.taskNumber)}</div>
          <div class="cell-muted">${escapeHtml(row.warehouseName)} • ${escapeHtml(formatDateTime(row.createdAt))}</div>
        </td>
        <td>
          <div class="cell-title">${escapeHtml(row.inventoryItemName)}</div>
          <div class="cell-muted">${formatNumber(row.quantity)} unit • batch ${escapeHtml(row.batchNumber || '—')}</div>
        </td>
        <td>${escapeHtml(shortId(row.destinationLocationId))}</td>
        <td>${statusBadge(row.status)}</td>
        <td>${scActions([
          ['pending', 'in_progress'].includes(row.status) && state.canWriteSupplyChain
            ? scButton('Proses', `data-sc-putaway-process="${escapeHtml(row.id)}"`)
            : '',
        ])}</td>
      </tr>
    `,
    'Belum ada tugas put-away',
    'Tugas put-away dibuat otomatis setelah penerimaan barang selesai.',
  );

  scRenderTable(
    '#sc-allocations-table',
    ['Alokasi', 'Barang', 'Jumlah', 'Status', 'Aksi'],
    data.allocations,
    (row) => `
      <tr>
        <td>
          <div class="cell-title">${escapeHtml(row.allocationNumber)}</div>
          <div class="cell-muted">${escapeHtml(row.warehouseName)} • ${escapeHtml(row.orderNumber || 'Tanpa order')}</div>
        </td>
        <td>
          <div class="cell-title">${escapeHtml(row.inventoryItemName)}</div>
          <div class="cell-muted">${escapeHtml(row.merchantName)}</div>
        </td>
        <td>${formatNumber(row.quantity)}</td>
        <td>${statusBadge(row.status)}</td>
        <td>${scActions([
          row.status === 'allocated' && state.canWriteSupplyChain
            ? scButton('Lepas', `data-sc-alloc-release="${escapeHtml(row.id)}"`)
            : '',
        ])}</td>
      </tr>
    `,
    'Belum ada alokasi gudang',
    'Alokasikan stok untuk mereservasi barang sebelum picking.',
  );

  scRenderTable(
    '#sc-picking-table',
    ['Picking', 'Gudang', 'Prioritas', 'Status', 'Aksi'],
    data.picking,
    (row) => `
      <tr>
        <td>
          <div class="cell-title">${escapeHtml(row.taskNumber)}</div>
          <div class="cell-muted">${escapeHtml(row.orderNumber || row.merchantName)}</div>
        </td>
        <td>${escapeHtml(row.warehouseName)}</td>
        <td>${scPriority(row.priority)}</td>
        <td>${statusBadge(row.status)}</td>
        <td>${scActions([
          row.status === 'pending' && state.canWriteSupplyChain
            ? scButton('Mulai', `data-sc-pick-start="${escapeHtml(row.id)}"`)
            : '',
          row.status === 'in_progress' && state.canWriteSupplyChain
            ? scButton('Selesai', `data-sc-pick-complete="${escapeHtml(row.id)}"`)
            : '',
          row.status === 'picked' && state.canManageSupplyChain
            ? scButton('Packing', `data-sc-pick-pack="${escapeHtml(row.id)}"`)
            : '',
        ])}</td>
      </tr>
    `,
    'Belum ada tugas picking',
    'Buat picking dari alokasi gudang yang masih aktif.',
  );

  scRenderTable(
    '#sc-packing-table',
    ['Packing', 'Gudang', 'Paket', 'Status', 'Aksi'],
    data.packing,
    (row) => `
      <tr>
        <td>
          <div class="cell-title">${escapeHtml(row.taskNumber)}</div>
          <div class="cell-muted">${escapeHtml(row.orderNumber || row.merchantName)}</div>
        </td>
        <td>${escapeHtml(row.warehouseName)}</td>
        <td>
          <div class="cell-title">${formatNumber(row.packageCount)} paket</div>
          <div class="cell-muted">${row.weightGram ? `${formatNumber(row.weightGram)} gram` : 'Berat belum diisi'}</div>
        </td>
        <td>${statusBadge(row.status)}</td>
        <td>${scActions([
          row.status === 'pending' && state.canWriteSupplyChain
            ? scButton('Mulai', `data-sc-pack-start="${escapeHtml(row.id)}"`)
            : '',
          row.status === 'packing' && state.canWriteSupplyChain
            ? scButton('Selesai', `data-sc-pack-complete="${escapeHtml(row.id)}"`)
            : '',
          row.status === 'packed' && state.canManageSupplyChain
            ? scButton('Kirim', `data-sc-pack-dispatch="${escapeHtml(row.id)}"`)
            : '',
        ])}</td>
      </tr>
    `,
    'Belum ada tugas packing',
    'Buat packing dari tugas picking yang sudah selesai.',
  );

  scRenderTable(
    '#sc-dispatch-table',
    ['Pengiriman', 'Kurir', 'Status', 'Aksi'],
    data.dispatch,
    (row) => `
      <tr>
        <td>
          <div class="cell-title">${escapeHtml(row.dispatchNumber)}</div>
          <div class="cell-muted">${escapeHtml(row.warehouseName)} • ${escapeHtml(row.orderNumber || row.merchantName)}</div>
        </td>
        <td>
          <div class="cell-title">${escapeHtml(row.courierName || '—')}</div>
          <div class="cell-muted">${escapeHtml(row.trackingNumber || 'Tanpa resi')}</div>
        </td>
        <td>${statusBadge(row.status)}</td>
        <td>${scActions([
          row.status === 'pending' && state.canWriteSupplyChain
            ? scButton('Berangkat', `data-sc-dispatch-send="${escapeHtml(row.id)}"`)
            : '',
          ['dispatched', 'in_transit'].includes(row.status) && state.canWriteSupplyChain
            ? scButton('Terkirim', `data-sc-dispatch-deliver="${escapeHtml(row.id)}"`)
            : '',
        ])}</td>
      </tr>
    `,
    'Belum ada pengiriman',
    'Buat pengiriman dari paket yang sudah selesai dipacking.',
  );

  scRenderTable(
    '#sc-returns-table',
    ['Retur', 'Alasan', 'Jumlah', 'Status', 'Aksi'],
    data.returns,
    (row) => `
      <tr>
        <td>
          <div class="cell-title">${escapeHtml(row.returnNumber)}</div>
          <div class="cell-muted">${escapeHtml(row.warehouseName)} • ${escapeHtml(row.orderNumber || row.merchantName)}</div>
        </td>
        <td>${escapeHtml(row.reason)}</td>
        <td>${formatNumber(row.quantity)}</td>
        <td>${statusBadge(row.status)}</td>
        <td>${scActions([
          row.status === 'requested' && state.canManageSupplyChain
            ? scButton('Setujui', `data-sc-return-approve="${escapeHtml(row.id)}"`)
            : '',
          row.status === 'approved' && state.canWriteSupplyChain
            ? scButton('Terima', `data-sc-return-receive="${escapeHtml(row.id)}"`)
            : '',
          row.status === 'received' && state.canWriteSupplyChain
            ? scButton('Restock', `data-sc-return-restock="${escapeHtml(row.id)}"`)
            : '',
          ['requested', 'approved'].includes(row.status) && state.canManageSupplyChain
            ? scButton('Tolak', `data-sc-return-reject="${escapeHtml(row.id)}"`)
            : '',
        ])}</td>
      </tr>
    `,
    'Belum ada retur gudang',
    'Catat retur pelanggan atau barang yang kembali ke gudang.',
  );

  scRenderTable(
    '#sc-groups-table',
    ['Grup', 'Target', 'Harga target', 'Status', 'Aksi'],
    data.groups,
    (row) => `
      <tr>
        <td>
          <div class="cell-title">${escapeHtml(row.groupNumber)}</div>
          <div class="cell-muted">${escapeHtml(row.title)} • ${escapeHtml(row.merchantName)}</div>
        </td>
        <td>
          <div class="cell-title">${formatNumber(row.currentQuantity)} / ${formatNumber(row.targetQuantity)} ${escapeHtml(row.unit)}</div>
          <div class="cell-muted">Tutup ${escapeHtml(formatDateTime(row.closesAt))}</div>
        </td>
        <td>${formatMoney(row.targetPrice)} / ${escapeHtml(row.unit)}</td>
        <td>${statusBadge(row.status)}</td>
        <td>${scActions([
          row.status === 'open' && state.canManageSupplyChain
            ? scButton('Tutup', `data-sc-group-close="${escapeHtml(row.id)}"`)
            : '',
        ])}</td>
      </tr>
    `,
    'Belum ada grup pembelian',
    'Buat grup pembelian kolektif untuk menyatukan kebutuhan merchant.',
  );

  scRenderTable(
    '#sc-history-table',
    ['Waktu', 'Entitas', 'Perubahan status', 'Catatan'],
    data.histories,
    (row) => `
      <tr>
        <td>
          <div class="cell-title">${escapeHtml(formatDateTime(row.createdAt))}</div>
          <div class="cell-muted">${escapeHtml(row.changedByName || 'Sistem')}</div>
        </td>
        <td>
          <div class="cell-title">${escapeHtml(entityLabel(row.entityType))}</div>
          <div class="cell-muted">${escapeHtml(shortId(row.entityId))}</div>
        </td>
        <td>
          <div class="cell-title">${escapeHtml(row.fromStatus ? statusLabel(row.fromStatus) : 'Awal')} → ${escapeHtml(statusLabel(row.toStatus))}</div>
        </td>
        <td>${escapeHtml(row.note || '—')}</td>
      </tr>
    `,
    'Belum ada riwayat fulfillment',
    'Riwayat muncul saat put-away, picking, packing, pengiriman, atau retur berubah status.',
  );
}

async function scRunAction(path, successTitle, options = {}) {
  try {
    await api(path, {
      method: options.method ?? 'POST',
      body: options.body ?? {},
    });
    showToast(successTitle);
    await loadSupplyChain(true);
  } catch (error) {
    showToast('Aksi gagal', error.message, 'error');
  }
}

/* ---------------------- Supply chain modal helpers --------------------- */

async function openScSupplierModal() {
  openModal({
    title: 'Supplier baru',
    kicker: 'Rantai pasok',
    subtitle: 'Memuat pedagang...',
    body: tableLoading(4),
  });
  try {
    const merchants = (await api('/merchants?limit=100')).data ?? [];
    if (!merchants.length) {
      closeModal();
      showToast('Data belum tersedia', 'Tambahkan pedagang terlebih dahulu.', 'error');
      return;
    }
    const modal = openModal({
      title: 'Supplier baru',
      kicker: 'Rantai pasok',
      subtitle: 'Supplier terikat pada satu pedagang dan digunakan oleh pengadaan.',
      body: `
        <form id="sc-supplier-form" class="form-grid">
          <label class="field field-span">
            <span>Pedagang *</span>
            <select name="merchantId" required>${inventoryMerchantOptions(merchants)}</select>
          </label>
          <label class="field field-span">
            <span>Nama supplier *</span>
            <input name="name" required minlength="2" maxlength="255" placeholder="Contoh: PT Sumber Pangan" />
          </label>
          <label class="field">
            <span>Nama kontak</span>
            <input name="contactName" maxlength="255" />
          </label>
          <label class="field">
            <span>Email</span>
            <input name="contactEmail" type="email" maxlength="255" />
          </label>
          <label class="field">
            <span>Telepon</span>
            <input name="contactPhone" maxlength="32" />
          </label>
          <label class="field">
            <span>Kota</span>
            <input name="city" maxlength="120" />
          </label>
          <label class="field">
            <span>Termin (hari)</span>
            <input name="paymentTermDays" type="number" min="0" max="3650" value="0" />
          </label>
          <label class="field">
            <span>Status</span>
            <select name="status">
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
              <option value="suspended">Ditangguhkan</option>
            </select>
          </label>
          <label class="field field-span">
            <span>Alamat</span>
            <textarea name="address" rows="2" maxlength="2000"></textarea>
          </label>
        </form>
      `,
      footer: `
        <button class="button button-ghost" type="button" data-modal-close>Batal</button>
        <button class="button button-primary" type="submit" form="sc-supplier-form" id="sc-supplier-submit">${icon('check')} Simpan supplier</button>
      `,
    });
    const form = modal.querySelector('#sc-supplier-form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const submit = modal.querySelector('#sc-supplier-submit');
      submit.disabled = true;
      try {
        await api('/supply-chain/suppliers', {
          method: 'POST',
          body: {
            merchantId: String(data.get('merchantId') ?? ''),
            name: String(data.get('name') ?? '').trim(),
            contactName: String(data.get('contactName') ?? '').trim() || undefined,
            contactEmail: String(data.get('contactEmail') ?? '').trim() || undefined,
            contactPhone: String(data.get('contactPhone') ?? '').trim() || undefined,
            city: String(data.get('city') ?? '').trim() || undefined,
            paymentTermDays: Number(data.get('paymentTermDays') ?? 0),
            status: String(data.get('status') ?? 'active'),
            address: String(data.get('address') ?? '').trim() || undefined,
          },
        });
        closeModal();
        showToast('Supplier dibuat');
        await loadSupplyChain(true);
      } catch (error) {
        submit.disabled = false;
        showToast('Gagal menyimpan', error.message, 'error');
      }
    });
  } catch (error) {
    closeModal();
    showToast('Gagal memuat data', error.message, 'error');
  }
}

async function openScRequisitionModal() {
  openModal({
    title: 'Permintaan pembelian',
    kicker: 'Pengadaan',
    subtitle: 'Memuat pedagang, gudang, dan item...',
    body: tableLoading(4),
  });
  try {
    const { merchants, warehouses, items } = await scCommonData();
    if (!merchants.length) {
      closeModal();
      showToast('Data belum tersedia', 'Tambahkan pedagang terlebih dahulu.', 'error');
      return;
    }
    const firstMerchant = merchants[0].id;
    const modal = openModal({
      title: 'Permintaan pembelian',
      kicker: 'Pengadaan',
      subtitle: 'Permintaan berisi satu baris item; dapat diajukan dan disetujui sebelum menjadi PO.',
      wide: true,
      body: `
        <form id="sc-requisition-form" class="form-grid">
          <label class="field">
            <span>Pedagang *</span>
            <select name="merchantId" id="sc-pr-merchant" required>${inventoryMerchantOptions(merchants, firstMerchant)}</select>
          </label>
          <label class="field">
            <span>Gudang tujuan</span>
            <select name="warehouseId" id="sc-pr-warehouse">${inventoryWarehouseOptions(warehouses, '', firstMerchant)}</select>
          </label>
          <label class="field field-span">
            <span>Judul permintaan *</span>
            <input name="title" required minlength="3" maxlength="255" placeholder="Contoh: Bahan baku minggu ini" />
          </label>
          <label class="field">
            <span>Prioritas</span>
            <select name="priority">
              <option value="normal">Normal</option>
              <option value="low">Rendah</option>
              <option value="high">Tinggi</option>
              <option value="urgent">Mendesak</option>
            </select>
          </label>
          <label class="field">
            <span>Dibutuhkan sebelum</span>
            <input name="neededBy" type="date" />
          </label>
          <label class="field">
            <span>Item persediaan</span>
            <select name="inventoryItemId" id="sc-pr-item">${inventoryItemOptions(items, firstMerchant)}</select>
          </label>
          <label class="field">
            <span>Jumlah *</span>
            <input name="quantity" type="number" min="0.001" step="0.001" required value="1" />
          </label>
          <label class="field">
            <span>Estimasi harga satuan</span>
            <input name="estimatedUnitPrice" type="number" min="0" step="0.01" value="0" />
          </label>
          <label class="field field-span">
            <span>Deskripsi item *</span>
            <input name="description" id="sc-pr-description" required minlength="2" maxlength="500" placeholder="Nama bahan atau barang" />
          </label>
          <label class="field field-span">
            <span>Catatan</span>
            <textarea name="notes" rows="2" maxlength="2000"></textarea>
          </label>
        </form>
      `,
      footer: `
        <button class="button button-ghost" type="button" data-modal-close>Batal</button>
        <button class="button button-primary" type="submit" form="sc-requisition-form" id="sc-pr-submit">${icon('check')} Simpan permintaan</button>
      `,
    });
    const form = modal.querySelector('#sc-requisition-form');
    const merchantSelect = modal.querySelector('#sc-pr-merchant');
    const warehouseSelect = modal.querySelector('#sc-pr-warehouse');
    const itemSelect = modal.querySelector('#sc-pr-item');
    const descriptionInput = modal.querySelector('#sc-pr-description');
    const refreshMerchant = () => {
      warehouseSelect.innerHTML = inventoryWarehouseOptions(warehouses, '', merchantSelect.value);
      itemSelect.innerHTML = inventoryItemOptions(items, merchantSelect.value);
    };
    merchantSelect.addEventListener('change', refreshMerchant);
    itemSelect.addEventListener('change', () => {
      const item = items.find((row) => row.id === itemSelect.value);
      if (item && !descriptionInput.value.trim()) descriptionInput.value = item.productName ?? '';
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const submit = modal.querySelector('#sc-pr-submit');
      const itemId = String(data.get('inventoryItemId') ?? '');
      const selectedItem = items.find((row) => row.id === itemId);
      const description =
        String(data.get('description') ?? '').trim() || selectedItem?.productName || '';
      if (!description) {
        showToast('Data belum lengkap', 'Pilih item atau isi deskripsi item.', 'error');
        return;
      }
      submit.disabled = true;
      try {
        await api('/supply-chain/purchase-requisitions', {
          method: 'POST',
          body: {
            merchantId: merchantSelect.value,
            warehouseId: warehouseSelect.value || undefined,
            title: String(data.get('title') ?? '').trim(),
            priority: String(data.get('priority') ?? 'normal'),
            neededBy: String(data.get('neededBy') ?? '').trim() || undefined,
            notes: String(data.get('notes') ?? '').trim() || undefined,
            items: [
              {
                inventoryItemId: itemId || undefined,
                description,
                quantity: String(data.get('quantity') ?? '0'),
                estimatedUnitPrice: String(data.get('estimatedUnitPrice') ?? '0'),
              },
            ],
          },
        });
        closeModal();
        showToast('Permintaan pembelian dibuat');
        await loadSupplyChain(true);
      } catch (error) {
        submit.disabled = false;
        showToast('Gagal menyimpan', error.message, 'error');
      }
    });
  } catch (error) {
    closeModal();
    showToast('Gagal memuat data', error.message, 'error');
  }
}

async function openScQuotationModal(requisitionId) {
  openModal({
    title: 'Penawaran supplier',
    kicker: 'Pengadaan',
    subtitle: 'Memuat detail permintaan...',
    body: tableLoading(4),
  });
  try {
    const requisitionResult = await api(`/supply-chain/purchase-requisitions/${requisitionId}`);
    const requisition = requisitionResult.data;
    const supplierResult = await api(
      `/supply-chain/supplier-options?merchantId=${encodeURIComponent(requisition.merchantId)}`,
    );
    const suppliers = supplierResult.data ?? [];
    if (!suppliers.length) {
      closeModal();
      showToast('Supplier belum ada', 'Tambahkan supplier untuk pedagang ini terlebih dahulu.', 'error');
      return;
    }
    const lines = requisition.items ?? [];
    if (!lines.length) {
      closeModal();
      showToast('Permintaan kosong', 'Permintaan tidak memiliki item.', 'error');
      return;
    }
    const modal = openModal({
      title: 'Penawaran supplier',
      kicker: 'Pengadaan',
      subtitle: `${requisition.requisitionNumber} • ${requisition.merchantName}`,
      wide: true,
      body: `
        <form id="sc-quotation-form" class="form-grid">
          <label class="field field-span">
            <span>Supplier *</span>
            <select name="supplierId" required>${scSupplierOptions(suppliers)}</select>
          </label>
          <label class="field">
            <span>Berlaku sampai</span>
            <input name="validUntil" type="date" />
          </label>
          <label class="field">
            <span>Termin pembayaran (hari)</span>
            <input name="paymentTermDays" type="number" min="0" max="3650" value="0" />
          </label>
          <label class="field">
            <span>Estimasi pengiriman (hari)</span>
            <input name="deliveryDays" type="number" min="0" max="3650" />
          </label>
          <label class="field field-span">
            <span>Catatan</span>
            <textarea name="notes" rows="2" maxlength="2000"></textarea>
          </label>
          <div class="field field-span">
            <span>Item penawaran</span>
            <div class="cell-muted">${lines.map((line) => `${escapeHtml(line.description)} • ${formatNumber(line.quantity)} × ${formatMoney(line.estimatedUnitPrice)}`).join('<br />')}</div>
          </div>
        </form>
      `,
      footer: `
        <button class="button button-ghost" type="button" data-modal-close>Batal</button>
        <button class="button button-primary" type="submit" form="sc-quotation-form" id="sc-quotation-submit">${icon('check')} Simpan penawaran</button>
      `,
    });
    const form = modal.querySelector('#sc-quotation-form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const submit = modal.querySelector('#sc-quotation-submit');
      submit.disabled = true;
      try {
        await api('/supply-chain/supplier-quotations', {
          method: 'POST',
          body: {
            merchantId: requisition.merchantId,
            supplierId: String(data.get('supplierId') ?? ''),
            requisitionId,
            validUntil: String(data.get('validUntil') ?? '').trim() || undefined,
            paymentTermDays: Number(data.get('paymentTermDays') ?? 0),
            deliveryDays: String(data.get('deliveryDays') ?? '').trim()
              ? Number(data.get('deliveryDays'))
              : undefined,
            notes: String(data.get('notes') ?? '').trim() || undefined,
            items: lines.map((line) => ({
              inventoryItemId: line.inventoryItemId ?? undefined,
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.estimatedUnitPrice ?? '0',
            })),
          },
        });
        closeModal();
        showToast('Penawaran supplier dibuat');
        await loadSupplyChain(true);
      } catch (error) {
        submit.disabled = false;
        showToast('Gagal menyimpan', error.message, 'error');
      }
    });
  } catch (error) {
    closeModal();
    showToast('Gagal memuat data', error.message, 'error');
  }
}

async function openScConvertRequisitionModal(requisitionId) {
  const requisition = state.supplyChain?.requisitions.find((row) => row.id === requisitionId);
  if (!requisition) return;
  openModal({
    title: 'Buat purchase order',
    kicker: 'Pengadaan',
    subtitle: 'Memuat supplier dan gudang...',
    body: tableLoading(4),
  });
  try {
    const [{ warehouses }, suppliersResult] = await Promise.all([
      scCommonData(),
      api(`/supply-chain/supplier-options?merchantId=${encodeURIComponent(requisition.merchantId)}`),
    ]);
    const suppliers = suppliersResult.data ?? [];
    if (!suppliers.length) {
      closeModal();
      showToast('Supplier belum ada', 'Tambahkan supplier untuk pedagang ini terlebih dahulu.', 'error');
      return;
    }
    const modal = openModal({
      title: 'Buat purchase order',
      kicker: 'Pengadaan',
      subtitle: `${requisition.requisitionNumber} • ${requisition.title}`,
      body: `
        <form id="sc-convert-pr-form" class="form-grid">
          <label class="field field-span">
            <span>Supplier *</span>
            <select name="supplierId" required>${scSupplierOptions(suppliers)}</select>
          </label>
          <label class="field field-span">
            <span>Gudang tujuan</span>
            <select name="warehouseId">${inventoryWarehouseOptions(warehouses, '', requisition.merchantId)}</select>
          </label>
          <label class="field">
            <span>Perkiraan pengiriman</span>
            <input name="expectedDeliveryDate" type="date" />
          </label>
          <label class="field">
            <span>Termin pembayaran (hari)</span>
            <input name="paymentTermDays" type="number" min="0" max="3650" value="0" />
          </label>
        </form>
      `,
      footer: `
        <button class="button button-ghost" type="button" data-modal-close>Batal</button>
        <button class="button button-primary" type="submit" form="sc-convert-pr-form" id="sc-convert-pr-submit">${icon('check')} Buat PO</button>
      `,
    });
    const form = modal.querySelector('#sc-convert-pr-form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const submit = modal.querySelector('#sc-convert-pr-submit');
      submit.disabled = true;
      try {
        await api(`/supply-chain/purchase-requisitions/${requisitionId}/convert`, {
          method: 'POST',
          body: {
            supplierId: String(data.get('supplierId') ?? ''),
            warehouseId: String(data.get('warehouseId') ?? '').trim() || undefined,
            expectedDeliveryDate: String(data.get('expectedDeliveryDate') ?? '').trim() || undefined,
            paymentTermDays: Number(data.get('paymentTermDays') ?? 0),
          },
        });
        closeModal();
        showToast('Purchase order dibuat');
        await loadSupplyChain(true);
      } catch (error) {
        submit.disabled = false;
        showToast('Gagal membuat PO', error.message, 'error');
      }
    });
  } catch (error) {
    closeModal();
    showToast('Gagal memuat data', error.message, 'error');
  }
}

async function openScConvertQuotationModal(quotationId) {
  const quotation = state.supplyChain?.quotations.find((row) => row.id === quotationId);
  if (!quotation) return;
  openModal({
    title: 'Buat PO dari penawaran',
    kicker: 'Pengadaan',
    subtitle: 'Memuat gudang...',
    body: tableLoading(3),
  });
  try {
    const warehouses = (await api('/inventory/warehouses?limit=100')).data ?? [];
    const modal = openModal({
      title: 'Buat PO dari penawaran',
      kicker: 'Pengadaan',
      subtitle: `${quotation.quotationNumber} • ${quotation.supplierName}`,
      body: `
        <form id="sc-convert-quotation-form" class="form-grid">
          <label class="field field-span">
            <span>Gudang tujuan</span>
            <select name="warehouseId">${inventoryWarehouseOptions(warehouses, '', quotation.merchantId)}</select>
          </label>
          <label class="field field-span">
            <span>Perkiraan pengiriman</span>
            <input name="expectedDeliveryDate" type="date" />
          </label>
        </form>
      `,
      footer: `
        <button class="button button-ghost" type="button" data-modal-close>Batal</button>
        <button class="button button-primary" type="submit" form="sc-convert-quotation-form" id="sc-convert-quotation-submit">${icon('check')} Buat PO</button>
      `,
    });
    const form = modal.querySelector('#sc-convert-quotation-form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const submit = modal.querySelector('#sc-convert-quotation-submit');
      submit.disabled = true;
      try {
        await api(`/supply-chain/supplier-quotations/${quotationId}/convert`, {
          method: 'POST',
          body: {
            warehouseId: String(data.get('warehouseId') ?? '').trim() || undefined,
            expectedDeliveryDate: String(data.get('expectedDeliveryDate') ?? '').trim() || undefined,
          },
        });
        closeModal();
        showToast('Purchase order dibuat');
        await loadSupplyChain(true);
      } catch (error) {
        submit.disabled = false;
        showToast('Gagal membuat PO', error.message, 'error');
      }
    });
  } catch (error) {
    closeModal();
    showToast('Gagal memuat data', error.message, 'error');
  }
}

async function openScGoodsReceiptModal(orderId) {
  openModal({
    title: 'Penerimaan barang',
    kicker: 'Gudang',
    subtitle: 'Memuat purchase order...',
    body: tableLoading(4),
  });
  try {
    const orderResult = await api(`/supply-chain/purchase-orders/${orderId}`);
    const order = orderResult.data;
    const warehouses = (await api('/inventory/warehouses?limit=100')).data ?? [];
    const merchantWarehouses = warehouses.filter((row) => row.merchantId === order.merchantId);
    if (!merchantWarehouses.length) {
      closeModal();
      showToast('Gudang belum ada', 'Tambahkan gudang untuk pedagang ini terlebih dahulu.', 'error');
      return;
    }
    const lines = (order.items ?? []).filter(
      (line) => Number(line.quantity) - Number(line.receivedQuantity ?? 0) > 0,
    );
    if (!lines.length) {
      closeModal();
      showToast('Tidak ada sisa', 'Semua item purchase order sudah diterima.', 'error');
      return;
    }
    const defaultWarehouse = merchantWarehouses.find((row) => row.id === order.warehouseId) ?? merchantWarehouses[0];
    const modal = openModal({
      title: 'Penerimaan barang',
      kicker: 'Gudang',
      subtitle: `${order.orderNumber} • ${order.supplierName}`,
      wide: true,
      body: `
        <form id="sc-gr-form" class="form-grid">
          <label class="field">
            <span>Gudang *</span>
            <select name="warehouseId" id="sc-gr-warehouse" required>${inventoryWarehouseOptions(merchantWarehouses, defaultWarehouse.id)}</select>
          </label>
          <label class="field">
            <span>Lokasi penerimaan *</span>
            <select name="warehouseLocationId" id="sc-gr-location" required></select>
          </label>
          <label class="field">
            <span>Batch number</span>
            <input name="batchNumber" maxlength="100" placeholder="Opsional" />
          </label>
          <label class="field">
            <span>Catatan</span>
            <input name="notes" maxlength="2000" placeholder="Kondisi barang" />
          </label>
          <div class="field field-span">
            <span>Item diterima</span>
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>Item</th><th>Sisa</th><th>Diterima</th><th>Ditolak</th></tr></thead>
                <tbody>
                  ${lines
                    .map((line) => {
                      const remaining = Number(line.quantity) - Number(line.receivedQuantity ?? 0);
                      return `
                        <tr data-sc-gr-line data-po-item="${escapeHtml(line.id)}" data-inventory-item="${escapeHtml(line.inventoryItemId || '')}" data-description="${escapeHtml(line.description)}" data-unit-cost="${escapeHtml(line.unitPrice ?? '0')}">
                          <td>${escapeHtml(line.description)}</td>
                          <td>${formatNumber(remaining)}</td>
                          <td><input class="sc-gr-received" type="number" min="0" step="0.001" max="${remaining}" value="${remaining}" style="max-width: 110px;" /></td>
                          <td><input class="sc-gr-rejected" type="number" min="0" step="0.001" value="0" style="max-width: 110px;" /></td>
                        </tr>
                      `;
                    })
                    .join('')}
                </tbody>
              </table>
            </div>
          </div>
        </form>
      `,
      footer: `
        <button class="button button-ghost" type="button" data-modal-close>Batal</button>
        <button class="button button-primary" type="submit" form="sc-gr-form" id="sc-gr-submit">${icon('check')} Simpan penerimaan</button>
      `,
    });
    const form = modal.querySelector('#sc-gr-form');
    const locationSelect = modal.querySelector('#sc-gr-location');
    const warehouseSelect = modal.querySelector('#sc-gr-warehouse');
    const refreshLocations = async () => {
      locationSelect.innerHTML = await inventoryLocationOptions(warehouseSelect.value);
    };
    warehouseSelect.addEventListener('change', () => {
      void refreshLocations();
    });
    await refreshLocations();
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const submit = modal.querySelector('#sc-gr-submit');
      const batchNumber = String(data.get('batchNumber') ?? '').trim() || undefined;
      const items = [...form.querySelectorAll('[data-sc-gr-line]')]
        .map((line) => {
          const received = Number(line.querySelector('.sc-gr-received')?.value ?? 0);
          const rejected = Number(line.querySelector('.sc-gr-rejected')?.value ?? 0);
          if (received <= 0) return null;
          return {
            purchaseOrderItemId: line.dataset.poItem,
            inventoryItemId: line.dataset.inventoryItem || undefined,
            description: line.dataset.description,
            quantityReceived: String(received),
            quantityRejected: String(rejected || 0),
            unitCost: line.dataset.unitCost || '0',
            batchNumber,
          };
        })
        .filter(Boolean);
      if (!items.length) {
        showToast('Belum ada item', 'Isi jumlah diterima lebih dari 0.', 'error');
        return;
      }
      if (!locationSelect.value) {
        showToast('Lokasi belum dipilih', 'Pilih lokasi penerimaan barang.', 'error');
        return;
      }
      submit.disabled = true;
      try {
        await api('/supply-chain/goods-receipts', {
          method: 'POST',
          body: {
            merchantId: order.merchantId,
            warehouseId: warehouseSelect.value,
            warehouseLocationId: locationSelect.value,
            purchaseOrderId: order.id,
            notes: String(data.get('notes') ?? '').trim() || undefined,
            items,
          },
        });
        closeModal();
        showToast('Penerimaan barang dibuat');
        await loadSupplyChain(true);
      } catch (error) {
        submit.disabled = false;
        showToast('Gagal menyimpan', error.message, 'error');
      }
    });
  } catch (error) {
    closeModal();
    showToast('Gagal memuat data', error.message, 'error');
  }
}

async function openScPutawayModal(taskId) {
  const task = state.supplyChain?.putaway.find((row) => row.id === taskId);
  if (!task) return;
  openModal({
    title: 'Proses put-away',
    kicker: 'Gudang',
    subtitle: 'Memuat lokasi penyimpanan...',
    body: tableLoading(3),
  });
  try {
    const locations = await inventoryLocationOptions(task.warehouseId, task.destinationLocationId ?? '');
    const modal = openModal({
      title: 'Proses put-away',
      kicker: 'Gudang',
      subtitle: `${task.taskNumber} • ${task.inventoryItemName}`,
      body: `
        <form id="sc-putaway-form" class="form-grid">
          <label class="field field-span">
            <span>Lokasi tujuan *</span>
            <select name="destinationLocationId" required>${locations}</select>
          </label>
          <div class="field field-span">
            <div class="cell-muted">${formatNumber(task.quantity)} unit • batch ${escapeHtml(task.batchNumber || '—')}</div>
          </div>
        </form>
      `,
      footer: `
        <button class="button button-ghost" type="button" data-modal-close>Batal</button>
        <button class="button button-primary" type="submit" form="sc-putaway-form" id="sc-putaway-submit">${icon('check')} Selesaikan put-away</button>
      `,
    });
    const form = modal.querySelector('#sc-putaway-form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const destinationLocationId = String(data.get('destinationLocationId') ?? '');
      if (!destinationLocationId) {
        showToast('Lokasi belum dipilih', 'Pilih lokasi tujuan penyimpanan.', 'error');
        return;
      }
      const submit = modal.querySelector('#sc-putaway-submit');
      submit.disabled = true;
      try {
        await api(`/supply-chain/putaway-tasks/${taskId}`, {
          method: 'PATCH',
          body: { destinationLocationId },
        });
        await api(`/supply-chain/putaway-tasks/${taskId}/complete`, { method: 'POST', body: {} });
        closeModal();
        showToast('Put-away selesai');
        await loadSupplyChain(true);
      } catch (error) {
        submit.disabled = false;
        showToast('Gagal memproses', error.message, 'error');
      }
    });
  } catch (error) {
    closeModal();
    showToast('Gagal memuat data', error.message, 'error');
  }
}

async function openScAllocationModal() {
  openModal({
    title: 'Alokasi gudang',
    kicker: 'Gudang',
    subtitle: 'Memuat data gudang...',
    body: tableLoading(4),
  });
  try {
    const { merchants, warehouses, items } = await scCommonData();
    if (!warehouses.length || !items.length) {
      closeModal();
      showToast('Data belum tersedia', 'Tambahkan gudang dan item persediaan terlebih dahulu.', 'error');
      return;
    }
    const firstMerchant = warehouses[0].merchantId;
    const modal = openModal({
      title: 'Alokasi gudang',
      kicker: 'Gudang',
      subtitle: 'Alokasi mereservasi stok untuk order sebelum picking.',
      body: `
        <form id="sc-allocation-form" class="form-grid">
          <label class="field field-span">
            <span>Pedagang *</span>
            <select name="merchantId" id="sc-alloc-merchant" required>${inventoryMerchantOptions(merchants, firstMerchant)}</select>
          </label>
          <label class="field">
            <span>Gudang *</span>
            <select name="warehouseId" id="sc-alloc-warehouse" required>${inventoryWarehouseOptions(warehouses, '', firstMerchant)}</select>
          </label>
          <label class="field">
            <span>Lokasi *</span>
            <select name="warehouseLocationId" id="sc-alloc-location" required></select>
          </label>
          <label class="field field-span">
            <span>Item *</span>
            <select name="inventoryItemId" id="sc-alloc-item" required>${inventoryItemOptions(items, firstMerchant)}</select>
          </label>
          <label class="field">
            <span>Jumlah *</span>
            <input name="quantity" type="number" min="0.001" step="0.001" required value="1" />
          </label>
          <label class="field">
            <span>Catatan</span>
            <input name="notes" maxlength="2000" />
          </label>
        </form>
      `,
      footer: `
        <button class="button button-ghost" type="button" data-modal-close>Batal</button>
        <button class="button button-primary" type="submit" form="sc-allocation-form" id="sc-alloc-submit">${icon('check')} Simpan alokasi</button>
      `,
    });
    const form = modal.querySelector('#sc-allocation-form');
    const merchantSelect = modal.querySelector('#sc-alloc-merchant');
    const warehouseSelect = modal.querySelector('#sc-alloc-warehouse');
    const locationSelect = modal.querySelector('#sc-alloc-location');
    const itemSelect = modal.querySelector('#sc-alloc-item');
    const refreshLocations = async () => {
      locationSelect.innerHTML = await inventoryLocationOptions(warehouseSelect.value);
    };
    const refreshMerchant = async () => {
      warehouseSelect.innerHTML = inventoryWarehouseOptions(warehouses, '', merchantSelect.value);
      itemSelect.innerHTML = inventoryItemOptions(items, merchantSelect.value);
      await refreshLocations();
    };
    merchantSelect.addEventListener('change', () => {
      void refreshMerchant();
    });
    warehouseSelect.addEventListener('change', () => {
      void refreshLocations();
    });
    await refreshLocations();
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const submit = modal.querySelector('#sc-alloc-submit');
      if (!locationSelect.value) {
        showToast('Lokasi belum dipilih', 'Pilih lokasi stok.', 'error');
        return;
      }
      submit.disabled = true;
      try {
        await api('/supply-chain/warehouse-allocations', {
          method: 'POST',
          body: {
            merchantId: merchantSelect.value,
            warehouseId: warehouseSelect.value,
            warehouseLocationId: locationSelect.value,
            inventoryItemId: itemSelect.value,
            quantity: String(data.get('quantity') ?? '0'),
            notes: String(data.get('notes') ?? '').trim() || undefined,
          },
        });
        closeModal();
        showToast('Alokasi dibuat');
        await loadSupplyChain(true);
      } catch (error) {
        submit.disabled = false;
        showToast('Gagal menyimpan', error.message, 'error');
      }
    });
  } catch (error) {
    closeModal();
    showToast('Gagal memuat data', error.message, 'error');
  }
}

async function openScPickingModal(prefillAllocationId = '') {
  openModal({
    title: 'Tugas picking',
    kicker: 'Gudang',
    subtitle: 'Memuat alokasi aktif...',
    body: tableLoading(3),
  });
  try {
    const allocations = (await api('/supply-chain/warehouse-allocations?limit=100&status=allocated')).data ?? [];
    if (!allocations.length) {
      closeModal();
      showToast('Belum ada alokasi', 'Buat alokasi gudang terlebih dahulu.', 'error');
      return;
    }
    const selected = allocations.find((row) => row.id === prefillAllocationId) ?? allocations[0];
    const modal = openModal({
      title: 'Tugas picking',
      kicker: 'Gudang',
      subtitle: 'Picking mengambil barang dari lokasi alokasi.',
      body: `
        <form id="sc-picking-form" class="form-grid">
          <label class="field field-span">
            <span>Alokasi *</span>
            <select name="allocationId" required>
              ${allocations
                .map(
                  (row) =>
                    `<option value="${escapeHtml(row.id)}" ${row.id === selected.id ? 'selected' : ''}>${escapeHtml(row.allocationNumber)} • ${escapeHtml(row.inventoryItemName)} • ${formatNumber(row.quantity)}</option>`,
                )
                .join('')}
            </select>
          </label>
          <label class="field">
            <span>Prioritas</span>
            <select name="priority">
              <option value="normal">Normal</option>
              <option value="low">Rendah</option>
              <option value="high">Tinggi</option>
              <option value="urgent">Mendesak</option>
            </select>
          </label>
          <label class="field field-span">
            <span>Catatan</span>
            <textarea name="notes" rows="2" maxlength="2000"></textarea>
          </label>
        </form>
      `,
      footer: `
        <button class="button button-ghost" type="button" data-modal-close>Batal</button>
        <button class="button button-primary" type="submit" form="sc-picking-form" id="sc-picking-submit">${icon('check')} Buat picking</button>
      `,
    });
    const form = modal.querySelector('#sc-picking-form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const allocationId = String(data.get('allocationId') ?? '');
      const allocation = allocations.find((row) => row.id === allocationId);
      if (!allocation) return;
      const submit = modal.querySelector('#sc-picking-submit');
      submit.disabled = true;
      try {
        await api('/supply-chain/picking-tasks', {
          method: 'POST',
          body: {
            merchantId: allocation.merchantId,
            warehouseId: allocation.warehouseId,
            allocationId,
            priority: String(data.get('priority') ?? 'normal'),
            notes: String(data.get('notes') ?? '').trim() || undefined,
          },
        });
        closeModal();
        showToast('Tugas picking dibuat');
        await loadSupplyChain(true);
      } catch (error) {
        submit.disabled = false;
        showToast('Gagal membuat picking', error.message, 'error');
      }
    });
  } catch (error) {
    closeModal();
    showToast('Gagal memuat data', error.message, 'error');
  }
}

async function openScPackingModal(prefillPickingId = '') {
  openModal({
    title: 'Tugas packing',
    kicker: 'Gudang',
    subtitle: 'Memuat picking selesai...',
    body: tableLoading(3),
  });
  try {
    const picking = (await api('/supply-chain/picking-tasks?limit=100&status=picked')).data ?? [];
    if (!picking.length) {
      closeModal();
      showToast('Belum ada picking selesai', 'Selesaikan tugas picking terlebih dahulu.', 'error');
      return;
    }
    const selected = picking.find((row) => row.id === prefillPickingId) ?? picking[0];
    const modal = openModal({
      title: 'Tugas packing',
      kicker: 'Gudang',
      subtitle: 'Packing menyiapkan paket sebelum pengiriman.',
      body: `
        <form id="sc-packing-form" class="form-grid">
          <label class="field field-span">
            <span>Picking *</span>
            <select name="pickingTaskId" required>
              ${picking
                .map(
                  (row) =>
                    `<option value="${escapeHtml(row.id)}" ${row.id === selected.id ? 'selected' : ''}>${escapeHtml(row.taskNumber)} • ${escapeHtml(row.merchantName)}</option>`,
                )
                .join('')}
            </select>
          </label>
          <label class="field">
            <span>Jumlah paket *</span>
            <input name="packageCount" type="number" min="1" max="1000" value="1" required />
          </label>
          <label class="field">
            <span>Berat (gram)</span>
            <input name="weightGram" type="number" min="0" />
          </label>
          <label class="field">
            <span>Dimensi</span>
            <input name="dimensions" maxlength="64" placeholder="Contoh: 20x20x15" />
          </label>
          <label class="field field-span">
            <span>Catatan</span>
            <textarea name="notes" rows="2" maxlength="2000"></textarea>
          </label>
        </form>
      `,
      footer: `
        <button class="button button-ghost" type="button" data-modal-close>Batal</button>
        <button class="button button-primary" type="submit" form="sc-packing-form" id="sc-packing-submit">${icon('check')} Buat packing</button>
      `,
    });
    const form = modal.querySelector('#sc-packing-form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const pickingTaskId = String(data.get('pickingTaskId') ?? '');
      const pickingRow = picking.find((row) => row.id === pickingTaskId);
      if (!pickingRow) return;
      const submit = modal.querySelector('#sc-packing-submit');
      submit.disabled = true;
      try {
        await api('/supply-chain/packing-tasks', {
          method: 'POST',
          body: {
            merchantId: pickingRow.merchantId,
            warehouseId: pickingRow.warehouseId,
            pickingTaskId,
            packageCount: Number(data.get('packageCount') ?? 1),
            weightGram: String(data.get('weightGram') ?? '').trim()
              ? Number(data.get('weightGram'))
              : undefined,
            dimensions: String(data.get('dimensions') ?? '').trim() || undefined,
            notes: String(data.get('notes') ?? '').trim() || undefined,
          },
        });
        closeModal();
        showToast('Tugas packing dibuat');
        await loadSupplyChain(true);
      } catch (error) {
        submit.disabled = false;
        showToast('Gagal membuat packing', error.message, 'error');
      }
    });
  } catch (error) {
    closeModal();
    showToast('Gagal memuat data', error.message, 'error');
  }
}

async function openScDispatchModal(prefillPackingId = '') {
  openModal({
    title: 'Pengiriman',
    kicker: 'Gudang',
    subtitle: 'Memuat paket siap kirim...',
    body: tableLoading(3),
  });
  try {
    const packing = (await api('/supply-chain/packing-tasks?limit=100&status=packed')).data ?? [];
    if (!packing.length) {
      closeModal();
      showToast('Belum ada paket siap kirim', 'Selesaikan tugas packing terlebih dahulu.', 'error');
      return;
    }
    const selected = packing.find((row) => row.id === prefillPackingId) ?? packing[0];
    const modal = openModal({
      title: 'Pengiriman',
      kicker: 'Gudang',
      subtitle: 'Catat pengiriman paket ke pelanggan.',
      body: `
        <form id="sc-dispatch-form" class="form-grid">
          <label class="field field-span">
            <span>Packing *</span>
            <select name="packingTaskId" required>
              ${packing
                .map(
                  (row) =>
                    `<option value="${escapeHtml(row.id)}" ${row.id === selected.id ? 'selected' : ''}>${escapeHtml(row.taskNumber)} • ${escapeHtml(row.merchantName)}</option>`,
                )
                .join('')}
            </select>
          </label>
          <label class="field">
            <span>Kurir</span>
            <input name="courierName" maxlength="255" />
          </label>
          <label class="field">
            <span>Nomor resi</span>
            <input name="trackingNumber" maxlength="128" />
          </label>
          <label class="field">
            <span>Nomor kendaraan</span>
            <input name="vehicleNumber" maxlength="64" />
          </label>
          <label class="field">
            <span>Nama penerima</span>
            <input name="recipientName" maxlength="255" />
          </label>
          <label class="field field-span">
            <span>Catatan</span>
            <textarea name="notes" rows="2" maxlength="2000"></textarea>
          </label>
        </form>
      `,
      footer: `
        <button class="button button-ghost" type="button" data-modal-close>Batal</button>
        <button class="button button-primary" type="submit" form="sc-dispatch-form" id="sc-dispatch-submit">${icon('check')} Buat pengiriman</button>
      `,
    });
    const form = modal.querySelector('#sc-dispatch-form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const packingTaskId = String(data.get('packingTaskId') ?? '');
      const packingRow = packing.find((row) => row.id === packingTaskId);
      if (!packingRow) return;
      const submit = modal.querySelector('#sc-dispatch-submit');
      submit.disabled = true;
      try {
        await api('/supply-chain/dispatch-records', {
          method: 'POST',
          body: {
            merchantId: packingRow.merchantId,
            warehouseId: packingRow.warehouseId,
            packingTaskId,
            courierName: String(data.get('courierName') ?? '').trim() || undefined,
            trackingNumber: String(data.get('trackingNumber') ?? '').trim() || undefined,
            vehicleNumber: String(data.get('vehicleNumber') ?? '').trim() || undefined,
            recipientName: String(data.get('recipientName') ?? '').trim() || undefined,
            notes: String(data.get('notes') ?? '').trim() || undefined,
          },
        });
        closeModal();
        showToast('Pengiriman dibuat');
        await loadSupplyChain(true);
      } catch (error) {
        submit.disabled = false;
        showToast('Gagal membuat pengiriman', error.message, 'error');
      }
    });
  } catch (error) {
    closeModal();
    showToast('Gagal memuat data', error.message, 'error');
  }
}

async function openScReturnModal() {
  openModal({
    title: 'Retur gudang',
    kicker: 'Gudang',
    subtitle: 'Memuat data gudang...',
    body: tableLoading(4),
  });
  try {
    const { merchants, warehouses, items } = await scCommonData();
    if (!warehouses.length) {
      closeModal();
      showToast('Gudang belum ada', 'Tambahkan gudang terlebih dahulu.', 'error');
      return;
    }
    const firstMerchant = warehouses[0].merchantId;
    const modal = openModal({
      title: 'Retur gudang',
      kicker: 'Gudang',
      subtitle: 'Catat barang yang kembali ke gudang.',
      body: `
        <form id="sc-return-form" class="form-grid">
          <label class="field field-span">
            <span>Pedagang *</span>
            <select name="merchantId" id="sc-return-merchant" required>${inventoryMerchantOptions(merchants, firstMerchant)}</select>
          </label>
          <label class="field">
            <span>Gudang *</span>
            <select name="warehouseId" id="sc-return-warehouse" required>${inventoryWarehouseOptions(warehouses, '', firstMerchant)}</select>
          </label>
          <label class="field">
            <span>Lokasi *</span>
            <select name="warehouseLocationId" id="sc-return-location" required></select>
          </label>
          <label class="field field-span">
            <span>Item *</span>
            <select name="inventoryItemId" id="sc-return-item" required>${inventoryItemOptions(items, firstMerchant)}</select>
          </label>
          <label class="field">
            <span>Jumlah *</span>
            <input name="quantity" type="number" min="0.001" step="0.001" required value="1" />
          </label>
          <label class="field field-span">
            <span>Alasan *</span>
            <input name="reason" required minlength="3" maxlength="2000" placeholder="Contoh: barang rusak dari pelanggan" />
          </label>
          <label class="field field-span">
            <span>Catatan</span>
            <textarea name="notes" rows="2" maxlength="2000"></textarea>
          </label>
        </form>
      `,
      footer: `
        <button class="button button-ghost" type="button" data-modal-close>Batal</button>
        <button class="button button-primary" type="submit" form="sc-return-form" id="sc-return-submit">${icon('check')} Simpan retur</button>
      `,
    });
    const form = modal.querySelector('#sc-return-form');
    const merchantSelect = modal.querySelector('#sc-return-merchant');
    const warehouseSelect = modal.querySelector('#sc-return-warehouse');
    const locationSelect = modal.querySelector('#sc-return-location');
    const itemSelect = modal.querySelector('#sc-return-item');
    const refreshLocations = async () => {
      locationSelect.innerHTML = await inventoryLocationOptions(warehouseSelect.value);
    };
    const refreshMerchant = async () => {
      warehouseSelect.innerHTML = inventoryWarehouseOptions(warehouses, '', merchantSelect.value);
      itemSelect.innerHTML = inventoryItemOptions(items, merchantSelect.value);
      await refreshLocations();
    };
    merchantSelect.addEventListener('change', () => {
      void refreshMerchant();
    });
    warehouseSelect.addEventListener('change', () => {
      void refreshLocations();
    });
    await refreshLocations();
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      if (!locationSelect.value || !itemSelect.value) {
        showToast('Data belum lengkap', 'Pilih lokasi dan item retur.', 'error');
        return;
      }
      const submit = modal.querySelector('#sc-return-submit');
      submit.disabled = true;
      try {
        await api('/supply-chain/warehouse-returns', {
          method: 'POST',
          body: {
            merchantId: merchantSelect.value,
            warehouseId: warehouseSelect.value,
            warehouseLocationId: locationSelect.value,
            inventoryItemId: itemSelect.value,
            quantity: String(data.get('quantity') ?? '0'),
            reason: String(data.get('reason') ?? '').trim(),
            notes: String(data.get('notes') ?? '').trim() || undefined,
          },
        });
        closeModal();
        showToast('Retur gudang dibuat');
        await loadSupplyChain(true);
      } catch (error) {
        submit.disabled = false;
        showToast('Gagal menyimpan retur', error.message, 'error');
      }
    });
  } catch (error) {
    closeModal();
    showToast('Gagal memuat data', error.message, 'error');
  }
}

async function openScGroupModal() {
  openModal({
    title: 'Grup pembelian kolektif',
    kicker: 'Pengadaan',
    subtitle: 'Memuat pedagang...',
    body: tableLoading(3),
  });
  try {
    const merchants = (await api('/merchants?limit=100')).data ?? [];
    if (!merchants.length) {
      closeModal();
      showToast('Pedagang belum ada', 'Tambahkan pedagang terlebih dahulu.', 'error');
      return;
    }
    const firstMerchant = merchants[0].id;
    const modal = openModal({
      title: 'Grup pembelian kolektif',
      kicker: 'Pengadaan',
      subtitle: 'Gabungkan kebutuhan pembelian untuk mendapatkan harga lebih baik.',
      body: `
        <form id="sc-group-form" class="form-grid">
          <label class="field">
            <span>Pedagang *</span>
            <select name="merchantId" id="sc-group-merchant" required>${inventoryMerchantOptions(merchants, firstMerchant)}</select>
          </label>
          <label class="field">
            <span>Supplier</span>
            <select name="supplierId" id="sc-group-supplier"><option value="">Pilih supplier</option></select>
          </label>
          <label class="field field-span">
            <span>Judul *</span>
            <input name="title" required minlength="3" maxlength="255" placeholder="Contoh: Pembelian minyak goreng bersama" />
          </label>
          <label class="field">
            <span>Target jumlah *</span>
            <input name="targetQuantity" type="number" min="0.001" step="0.001" required value="1" />
          </label>
          <label class="field">
            <span>Satuan</span>
            <input name="unit" maxlength="32" value="pcs" />
          </label>
          <label class="field">
            <span>Harga target</span>
            <input name="targetPrice" type="number" min="0" step="0.01" value="0" />
          </label>
          <label class="field">
            <span>Ditutup pada</span>
            <input name="closesAt" type="datetime-local" />
          </label>
          <label class="field field-span">
            <span>Deskripsi</span>
            <textarea name="description" rows="2" maxlength="2000"></textarea>
          </label>
        </form>
      `,
      footer: `
        <button class="button button-ghost" type="button" data-modal-close>Batal</button>
        <button class="button button-primary" type="submit" form="sc-group-form" id="sc-group-submit">${icon('check')} Simpan grup</button>
      `,
    });
    const form = modal.querySelector('#sc-group-form');
    const merchantSelect = modal.querySelector('#sc-group-merchant');
    const supplierSelect = modal.querySelector('#sc-group-supplier');
    const refreshSuppliers = async () => {
      supplierSelect.innerHTML = '<option value="">Pilih supplier</option>';
      if (!merchantSelect.value) return;
      const result = await api(
        `/supply-chain/supplier-options?merchantId=${encodeURIComponent(merchantSelect.value)}`,
      );
      supplierSelect.innerHTML = scSupplierOptions(result.data ?? []);
    };
    merchantSelect.addEventListener('change', () => {
      void refreshSuppliers();
    });
    await refreshSuppliers();
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const submit = modal.querySelector('#sc-group-submit');
      const closesAt = String(data.get('closesAt') ?? '').trim();
      submit.disabled = true;
      try {
        await api('/supply-chain/collective-purchase-groups', {
          method: 'POST',
          body: {
            merchantId: merchantSelect.value,
            supplierId: supplierSelect.value || undefined,
            title: String(data.get('title') ?? '').trim(),
            targetQuantity: String(data.get('targetQuantity') ?? '0'),
            unit: String(data.get('unit') ?? 'pcs').trim() || 'pcs',
            targetPrice: String(data.get('targetPrice') ?? '0'),
            closesAt: closesAt ? new Date(closesAt).toISOString() : undefined,
            description: String(data.get('description') ?? '').trim() || undefined,
          },
        });
        closeModal();
        showToast('Grup pembelian dibuat');
        await loadSupplyChain(true);
      } catch (error) {
        submit.disabled = false;
        showToast('Gagal menyimpan', error.message, 'error');
      }
    });
  } catch (error) {
    closeModal();
    showToast('Gagal memuat data', error.message, 'error');
  }
}

/* --------------------------------- Audit ------------------------------ */

async function loadAudit(force = false) {
  const sequence = ++state.sequences.audit;
  const filters = state.filters.audit;

  if (!state.audit || force) {
    $('#audit-table').innerHTML = tableLoading(6);
  }
  $('#audit-count').textContent = 'Memuat…';
  setSpinner('#refresh-audit', true);

  try {
    const result = await api(
      `/audit-logs${buildQuery({ page: 1, limit: 100, action: filters.search, entityType: filters.entityType })}`,
    );
    if (sequence !== state.sequences.audit) return;
    state.audit = result;
    renderAudit();
  } catch (error) {
    if (sequence !== state.sequences.audit) return;
    $('#audit-count').textContent = 'Gagal memuat';
    $('#audit-table').innerHTML = errorState(error.message, 'data-retry-audit');
  } finally {
    if (sequence === state.sequences.audit) setSpinner('#refresh-audit', false);
  }
}

function renderAudit() {
  const result = state.audit;
  if (!result) return;
  const rows = result.data ?? [];
  const total = Number(result.meta?.total ?? rows.length);
  $('#audit-count').textContent = `${formatNumber(total)} aktivitas`;

  if (!rows.length) {
    $('#audit-table').innerHTML = emptyState(
      'Belum ada audit log',
      state.filters.audit.search || state.filters.audit.entityType
        ? 'Tidak ada aktivitas yang cocok dengan filter ini.'
        : 'Aktivitas perubahan data akan tercatat otomatis di sini.',
    );
    return;
  }

  $('#audit-table').innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Waktu</th>
            <th>Aksi</th>
            <th>Entitas</th>
            <th>Aktor</th>
            <th>IP</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  <td class="cell-nowrap">
                    <span class="cell-main">${escapeHtml(formatDateTime(row.createdAt))}</span>
                    <span class="cell-sub">${escapeHtml(relativeTime(row.createdAt))}</span>
                  </td>
                  <td>
                    <span class="cell-main">${escapeHtml(actionLabel(row.action))}</span>
                    <span class="cell-sub"><span class="cell-code">${escapeHtml(row.action)}</span></span>
                  </td>
                  <td>
                    <span class="cell-main">${escapeHtml(entityLabel(row.entityType))}</span>
                    <span class="cell-sub">${escapeHtml(shortId(row.entityId))}</span>
                  </td>
                  <td><span class="cell-code">${escapeHtml(shortId(row.actorUserId))}</span></td>
                  <td class="cell-muted">${escapeHtml(row.ipAddress ?? '—')}</td>
                  <td>
                    <button class="action-link" type="button" data-audit-detail="${escapeHtml(row.id)}">
                      ${icon('arrow-right')} Detail
                    </button>
                  </td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function openAuditDetail(auditId) {
  const row = state.audit?.data?.find((item) => item.id === auditId);
  if (!row) return;

  const jsonBlock = (value) => {
    if (value === null || value === undefined) return '<span class="cell-muted">—</span>';
    const formatted = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    return `<pre class="json-block">${escapeHtml(formatted)}</pre>`;
  };

  openModal({
    title: actionLabel(row.action),
    kicker: 'Audit trail',
    subtitle: `${entityLabel(row.entityType)} · ${formatDateTime(row.createdAt)}`,
    wide: true,
    body: `
      <dl class="detail-list">
        <div class="detail-row"><dt>Action</dt><dd><span class="cell-code">${escapeHtml(row.action)}</span></dd></div>
        <div class="detail-row"><dt>Entity</dt><dd>${escapeHtml(entityLabel(row.entityType))} · ${escapeHtml(row.entityId ?? '—')}</dd></div>
        <div class="detail-row"><dt>Aktor</dt><dd>${escapeHtml(row.actorUserId ?? 'Sistem')}</dd></div>
        <div class="detail-row"><dt>IP address</dt><dd>${escapeHtml(row.ipAddress ?? '—')}</dd></div>
        <div class="detail-row"><dt>User agent</dt><dd>${escapeHtml(row.userAgent ?? '—')}</dd></div>
      </dl>
      <div class="detail-list" style="margin-top:14px">
        <div class="detail-row"><dt>Nilai lama</dt><dd>${jsonBlock(row.oldValues)}</dd></div>
        <div class="detail-row"><dt>Nilai baru</dt><dd>${jsonBlock(row.newValues)}</dd></div>
      </div>
    `,
    footer: '<button class="button button-ghost" type="button" data-modal-close>Tutup</button>',
  });
}

/* -------------------------------- Sidebar ----------------------------- */

function openSidebar() {
  $('#sidebar').classList.add('is-open');
  $('#sidebar-backdrop').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  $('#sidebar').classList.remove('is-open');
  $('#sidebar-backdrop').hidden = true;
  if (!state.modalClose) document.body.style.overflow = '';
}

function setSpinner(selector, active) {
  $(selector)?.classList.toggle('is-spinning', active);
}

async function refreshActiveView() {
  const button = $('#refresh-button');
  button.classList.add('is-spinning');
  try {
    await loadView(state.activeView);
  } finally {
    setTimeout(() => button.classList.remove('is-spinning'), 350);
  }
}

async function logout() {
  const token = getToken();
  const button = $('#logout-button');
  button.disabled = true;
  button.innerHTML = '<span class="spinner"></span><span>Keluar…</span>';
  try {
    if (token) {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      });
    }
  } catch {
    // Session lokal tetap dibersihkan walau request logout gagal.
  } finally {
    clearSession();
    window.location.replace('/login');
  }
}

/* --------------------------- Marketing & CRM -------------------------- */

const MKT_MARKETING_TABLES = [
  '#mkt-campaigns-table',
  '#mkt-promotions-table',
  '#mkt-coupons-table',
  '#mkt-ads-table',
  '#mkt-performance-table',
];

const MKT_CRM_TABLES = [
  '#crm-customers-table',
  '#crm-groups-table',
  '#crm-segments-table',
  '#crm-loyalty-table',
  '#crm-interactions-table',
  '#crm-complaints-table',
];

function mktOptions(rows, labelFn, selectedId = '') {
  const options = rows
    .map(
      (row) =>
        `<option value="${escapeHtml(row.id)}" ${row.id === selectedId ? 'selected' : ''}>${escapeHtml(labelFn(row))}</option>`,
    )
    .join('');
  return options;
}

function mktMerchantOptions(merchants, selectedId = '') {
  return (
    '<option value="">Pilih merchant</option>' +
    mktOptions(merchants, (row) => row.businessName || row.code, selectedId)
  );
}

function mktCustomerOptions(customers, selectedId = '') {
  return (
    '<option value="">Pilih pelanggan</option>' +
    mktOptions(
      customers,
      (row) => `${row.name} (${row.code})`,
      selectedId,
    )
  );
}

function mktCampaignOptions(campaigns, selectedId = '') {
  return (
    '<option value="">Tanpa kampanye</option>' +
    mktOptions(campaigns, (row) => `${row.name} (${row.code})`, selectedId)
  );
}

function mktPromotionOptions(promotions, selectedId = '') {
  return (
    '<option value="">Tanpa promosi</option>' +
    mktOptions(promotions, (row) => `${row.name} (${row.code})`, selectedId)
  );
}

function mktPeriod(start, end) {
  if (!start && !end) return '—';
  return `${formatDate(start)} – ${formatDate(end)}`;
}

function mktDiscountLabel(discountType, discountValue) {
  if (discountType === 'percentage') return `${formatNumber(discountValue)}%`;
  if (discountType === 'free_shipping') return 'Gratis ongkir';
  return formatMoney(discountValue);
}

async function mktMarketingData() {
  const [merchants, campaigns, promotions] = await Promise.all([
    api('/merchants?limit=100'),
    api('/marketing/campaigns?limit=100'),
    api('/marketing/promotions?limit=100'),
  ]);
  return {
    merchants: merchants.data ?? [],
    campaigns: campaigns.data ?? [],
    promotions: promotions.data ?? [],
  };
}

async function mktCrmData() {
  const [merchants, customers] = await Promise.all([
    api('/merchants?limit=100'),
    api('/marketing/customers?limit=100'),
  ]);
  return {
    merchants: merchants.data ?? [],
    customers: customers.data ?? [],
  };
}

/* ------------------------------- Marketing ---------------------------- */

async function loadMarketing(force = false) {
  const sequence = ++state.sequences.marketing;
  if (!force && state.marketing) {
    renderMarketing();
    return;
  }
  for (const selector of MKT_MARKETING_TABLES) {
    const host = $(selector);
    if (host) host.innerHTML = tableLoading(2);
  }
  try {
    const results = await Promise.all([
      api('/marketing/campaigns?limit=100'),
      api('/marketing/promotions?limit=100'),
      api('/marketing/coupons?limit=100'),
      api('/marketing/advertisements?limit=100'),
      api('/marketing/campaign-performance?limit=100'),
      api('/marketing/coupon-redemptions?limit=100'),
    ]);
    if (sequence !== state.sequences.marketing) return;
    state.marketing = {
      campaigns: results[0].data ?? [],
      promotions: results[1].data ?? [],
      coupons: results[2].data ?? [],
      advertisements: results[3].data ?? [],
      performance: results[4].data ?? [],
      redemptions: results[5].data ?? [],
    };
    renderMarketing();
  } catch (error) {
    if (sequence !== state.sequences.marketing) return;
    for (const selector of MKT_MARKETING_TABLES) {
      const host = $(selector);
      if (host) host.innerHTML = errorState(error.message, 'data-mkt-retry');
    }
    showToast('Gagal memuat pemasaran', error.message, 'error');
  }
}

function renderMarketing() {
  const data = state.marketing;
  if (!data) return;
  const activeCampaigns = data.campaigns.filter((row) =>
    ['active', 'scheduled'].includes(row.status),
  ).length;
  const totalBudget = data.campaigns.reduce((sum, row) => sum + Number(row.budget ?? 0), 0);
  const activeCoupons = data.coupons.filter((row) => row.status === 'active').length;
  scSetText('#mkt-stat-campaigns', formatNumber(activeCampaigns));
  scSetText('#mkt-stat-budget', formatMoney(totalBudget));
  scSetText('#mkt-stat-coupons', formatNumber(activeCoupons));
  scSetText('#mkt-stat-redemptions', formatNumber(data.redemptions.length));
  const summary = $('#mkt-summary-badge');
  if (summary) {
    summary.hidden = activeCampaigns <= 0;
    summary.textContent = `${formatNumber(activeCampaigns)} kampanye aktif`;
  }
  scSetBadge('#mkt-campaign-count', data.campaigns.length, 'kampanye');
  scSetBadge('#mkt-promotion-count', data.promotions.length, 'promosi');
  scSetBadge('#mkt-coupon-count', data.coupons.length, 'kupon');
  scSetBadge('#mkt-ad-count', data.advertisements.length, 'iklan');
  scSetBadge('#mkt-performance-count', data.performance.length, 'catatan');

  scRenderTable(
    '#mkt-campaigns-table',
    ['Kampanye', 'Merchant', 'Anggaran', 'Periode', 'Status', 'Aksi'],
    data.campaigns,
    (row) => {
      const actions = [scButton('Detail', `data-mkt-action="campaign-detail" data-mkt-id="${escapeHtml(row.id)}"`)];
      if (state.canWriteMarketing) {
        if (['draft', 'scheduled', 'paused'].includes(row.status)) {
          actions.push(
            scButton('Aktifkan', `data-mkt-action="campaign" data-mkt-id="${escapeHtml(row.id)}" data-mkt-op="activate"`),
          );
        }
        if (row.status === 'active') {
          actions.push(
            scButton('Jeda', `data-mkt-action="campaign" data-mkt-id="${escapeHtml(row.id)}" data-mkt-op="pause"`),
          );
        }
        if (row.status === 'paused') {
          actions.push(
            scButton('Lanjutkan', `data-mkt-action="campaign" data-mkt-id="${escapeHtml(row.id)}" data-mkt-op="resume"`),
          );
        }
        if (['draft', 'scheduled', 'active', 'paused'].includes(row.status)) {
          actions.push(
            scButton('Batalkan', `data-mkt-action="campaign" data-mkt-id="${escapeHtml(row.id)}" data-mkt-op="cancel"`),
          );
        }
      }
      return `
        <tr>
          <td>
            <div class="cell-title">${escapeHtml(row.name)}</div>
            <div class="cell-muted">${escapeHtml(row.code)} • ${escapeHtml(row.objective)}</div>
          </td>
          <td>${escapeHtml(row.merchantName)}</td>
          <td>
            <div class="cell-title">${formatMoney(row.spent)} / ${formatMoney(row.budget)}</div>
            <div class="cell-muted">Target ${formatMoney(row.targetRevenue)}</div>
          </td>
          <td>${escapeHtml(mktPeriod(row.startsAt, row.endsAt))}</td>
          <td>${statusBadge(row.status)}</td>
          <td>${scActions(actions)}</td>
        </tr>
      `;
    },
    'Belum ada kampanye',
    'Buat kampanye untuk mulai merencanakan promosi dan iklan.',
  );

  scRenderTable(
    '#mkt-promotions-table',
    ['Promosi', 'Merchant', 'Tipe', 'Min. belanja', 'Status', 'Aksi'],
    data.promotions,
    (row) => {
      const actions = [];
      if (state.canWriteMarketing) {
        if (['draft', 'scheduled', 'paused'].includes(row.status)) {
          actions.push(scButton('Aktifkan', `data-mkt-action="promotion" data-mkt-id="${escapeHtml(row.id)}" data-mkt-op="activate"`));
        }
        if (row.status === 'active') {
          actions.push(scButton('Jeda', `data-mkt-action="promotion" data-mkt-id="${escapeHtml(row.id)}" data-mkt-op="pause"`));
        }
        if (['draft', 'scheduled', 'active', 'paused'].includes(row.status)) {
          actions.push(scButton('Batalkan', `data-mkt-action="promotion" data-mkt-id="${escapeHtml(row.id)}" data-mkt-op="cancel"`));
        }
      }
      return `
        <tr>
          <td>
            <div class="cell-title">${escapeHtml(row.name)}</div>
            <div class="cell-muted">${escapeHtml(row.code)}${row.campaignName ? ` • ${escapeHtml(row.campaignName)}` : ''}</div>
          </td>
          <td>${escapeHtml(row.merchantName)}</td>
          <td>${statusBadge(row.type)}</td>
          <td>${formatMoney(row.minPurchase)}</td>
          <td>${statusBadge(row.status)}</td>
          <td>${scActions(actions)}</td>
        </tr>
      `;
    },
    'Belum ada promosi',
    'Promosi dapat dikaitkan ke kampanye dan memiliki aturan diskon.',
  );

  scRenderTable(
    '#mkt-coupons-table',
    ['Kupon', 'Merchant', 'Diskon', 'Kuota', 'Periode', 'Status', 'Aksi'],
    data.coupons,
    (row) => {
      const actions = [];
      if (state.canWriteMarketing && row.status === 'active') {
        actions.push(scButton('Nonaktifkan', `data-mkt-action="coupon-deactivate" data-mkt-id="${escapeHtml(row.id)}"`));
      }
      return `
        <tr>
          <td>
            <div class="cell-title">${escapeHtml(row.code)}</div>
            <div class="cell-muted">${escapeHtml(row.name || row.promotionName || '—')}</div>
          </td>
          <td>${escapeHtml(row.merchantName)}</td>
          <td>${escapeHtml(mktDiscountLabel(row.discountType, row.discountValue))}</td>
          <td>${formatNumber(row.usedCount)} / ${row.usageLimit === null ? '∞' : formatNumber(row.usageLimit)}</td>
          <td>${escapeHtml(mktPeriod(row.startsAt, row.endsAt))}</td>
          <td>${statusBadge(row.status)}</td>
          <td>${scActions(actions)}</td>
        </tr>
      `;
    },
    'Belum ada kupon',
    'Buat kupon agar pelanggan dapat memperoleh potongan harga.',
  );

  scRenderTable(
    '#mkt-ads-table',
    ['Iklan', 'Merchant', 'Penempatan', 'Anggaran', 'Metrik', 'Status', 'Aksi'],
    data.advertisements,
    (row) => {
      const actions = [];
      if (state.canWriteMarketing && !['cancelled', 'completed'].includes(row.status)) {
        actions.push(scButton('Batalkan', `data-mkt-action="ad-cancel" data-mkt-id="${escapeHtml(row.id)}"`));
      }
      return `
        <tr>
          <td>
            <div class="cell-title">${escapeHtml(row.name)}</div>
            <div class="cell-muted">${escapeHtml(row.campaignName || row.type)}</div>
          </td>
          <td>${escapeHtml(row.merchantName)}</td>
          <td>${escapeHtml(row.placement || '—')}</td>
          <td>${formatMoney(row.spent)} / ${formatMoney(row.budget)}</td>
          <td>
            <div class="cell-title">${formatNumber(row.impressions)} tayang</div>
            <div class="cell-muted">${formatNumber(row.clicks)} klik • ${formatNumber(row.conversions)} konversi</div>
          </td>
          <td>${statusBadge(row.status)}</td>
          <td>${scActions(actions)}</td>
        </tr>
      `;
    },
    'Belum ada iklan',
    'Iklan dapat dihubungkan dengan kampanye dan penempatan tertentu.',
  );

  scRenderTable(
    '#mkt-performance-table',
    ['Kampanye', 'Channel', 'Tanggal', 'Tayangan / klik', 'Konversi', 'Belanja / pendapatan'],
    data.performance,
    (row) => `
      <tr>
        <td>
          <div class="cell-title">${escapeHtml(row.campaignName)}</div>
          <div class="cell-muted">${escapeHtml(row.merchantName)}</div>
        </td>
        <td>${escapeHtml(row.channelType || 'Semua channel')}</td>
        <td>${escapeHtml(formatDate(row.date))}</td>
        <td>${formatNumber(row.impressions)} / ${formatNumber(row.clicks)}</td>
        <td>${formatNumber(row.conversions)}</td>
        <td>
          <div class="cell-title">${formatMoney(row.spend)} / ${formatMoney(row.revenue)}</div>
          <div class="cell-muted">${formatNumber(row.orders)} order • ${formatNumber(row.newCustomers)} pelanggan baru</div>
        </td>
      </tr>
    `,
    'Belum ada data performa',
    'Catat performa harian per channel untuk mengukur hasil kampanye.',
  );
}

async function openMarketingCampaignDetail(id) {
  try {
    const result = await api(`/marketing/campaigns/${id}`);
    const campaign = result.data;
    const channels = (campaign.channels ?? [])
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.channelType)}</td>
            <td>${escapeHtml(row.name || '—')}</td>
            <td>${formatMoney(row.spent)} / ${formatMoney(row.budget)}</td>
            <td>${formatNumber(row.targetConversions)} target</td>
          </tr>`,
      )
      .join('');
    const performance = (campaign.performance ?? [])
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(formatDate(row.date))}</td>
            <td>${formatNumber(row.impressions)} / ${formatNumber(row.clicks)}</td>
            <td>${formatNumber(row.conversions)}</td>
            <td>${formatMoney(row.revenue)}</td>
          </tr>`,
      )
      .join('');
    openModal({
      title: campaign.name,
      kicker: 'Detail kampanye',
      subtitle: `${campaign.code} • ${campaign.merchantName ?? ''}`,
      wide: true,
      body: `
        <dl class="detail-list">
          <div class="detail-row"><dt>Status</dt><dd>${statusBadge(campaign.status)}</dd></div>
          <div class="detail-row"><dt>Objective</dt><dd>${escapeHtml(campaign.objective)}</dd></div>
          <div class="detail-row"><dt>Periode</dt><dd>${escapeHtml(mktPeriod(campaign.startsAt, campaign.endsAt))}</dd></div>
          <div class="detail-row"><dt>Anggaran</dt><dd>${formatMoney(campaign.spent)} / ${formatMoney(campaign.budget)}</dd></div>
          <div class="detail-row"><dt>Target pendapatan</dt><dd>${formatMoney(campaign.targetRevenue)}</dd></div>
          <div class="detail-row"><dt>Target audiens</dt><dd>${escapeHtml(campaign.targetAudience || '—')}</dd></div>
        </dl>
        <h4 class="detail-heading">Channel</h4>
        ${
          channels
            ? `<div class="table-wrap"><table class="table"><thead><tr><th>Channel</th><th>Nama</th><th>Belanja / anggaran</th><th>Target</th></tr></thead><tbody>${channels}</tbody></table></div>`
            : emptyState('Belum ada channel', 'Tambahkan channel agar performa dapat dipantau.')
        }
        <h4 class="detail-heading">Performa terbaru</h4>
        ${
          performance
            ? `<div class="table-wrap"><table class="table"><thead><tr><th>Tanggal</th><th>Tayangan / klik</th><th>Konversi</th><th>Pendapatan</th></tr></thead><tbody>${performance}</tbody></table></div>`
            : emptyState('Belum ada performa', 'Catat performa harian kampanye.')
        }
      `,
    });
  } catch (error) {
    showToast('Gagal memuat kampanye', error.message, 'error');
  }
}

function openMarketingCampaignModal(common) {
  const modal = openModal({
    title: 'Kampanye baru',
    kicker: 'Digital marketing',
    subtitle: 'Rencanakan kampanye multichannel untuk merchant.',
    body: `
      <form id="mkt-campaign-form" class="form-grid">
        <label class="field field-span"><span>Merchant</span><select name="merchantId" required>${mktMerchantOptions(common.merchants)}</select></label>
        <label class="field field-span"><span>Nama kampanye</span><input name="name" required maxlength="255" placeholder="contoh: Promo Ramadan 2026" /></label>
        <label class="field"><span>Objective</span><select name="objective"><option value="awareness">Awareness</option><option value="acquisition" selected>Akuisisi</option><option value="retention">Retensi</option><option value="engagement">Engagement</option></select></label>
        <label class="field"><span>Status</span><select name="status"><option value="draft">Draft</option><option value="scheduled">Dijadwalkan</option><option value="active">Aktif</option></select></label>
        <label class="field"><span>Anggaran</span><input name="budget" type="number" min="0" step="0.01" value="0" /></label>
        <label class="field"><span>Target pendapatan</span><input name="targetRevenue" type="number" min="0" step="0.01" value="0" /></label>
        <label class="field field-span"><span>Target audiens</span><textarea name="targetAudience" rows="2" maxlength="4000" placeholder="Opsional"></textarea></label>
        <label class="field field-span"><span>Deskripsi</span><textarea name="description" rows="2" maxlength="4000" placeholder="Opsional"></textarea></label>
      </form>
    `,
    footer: `
      <button class="button button-ghost" type="button" data-modal-close>Batal</button>
      <button class="button button-primary" type="submit" form="mkt-campaign-form">Simpan kampanye</button>
    `,
  });
  const form = modal?.querySelector('#mkt-campaign-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const submit = modal.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      await api('/marketing/campaigns', {
        method: 'POST',
        body: {
          merchantId: String(data.get('merchantId')),
          name: String(data.get('name')),
          objective: String(data.get('objective')),
          status: String(data.get('status')),
          budget: String(data.get('budget') || 0),
          targetRevenue: String(data.get('targetRevenue') || 0),
          targetAudience: String(data.get('targetAudience') || '') || undefined,
          description: String(data.get('description') || '') || undefined,
        },
      });
      closeModal();
      showToast('Kampanye dibuat', 'Data kampanye berhasil disimpan.');
      loadMarketing(true);
    } catch (error) {
      showToast('Gagal menyimpan kampanye', error.message, 'error');
    } finally {
      submit.disabled = false;
    }
  });
}

function openMarketingPromotionModal(common) {
  const modal = openModal({
    title: 'Promosi baru',
    kicker: 'Promotion engine',
    subtitle: 'Atur diskon dan batas pemakaian promosi.',
    body: `
      <form id="mkt-promotion-form" class="form-grid">
        <label class="field field-span"><span>Merchant</span><select name="merchantId" required>${mktMerchantOptions(common.merchants)}</select></label>
        <label class="field field-span"><span>Kampanye</span><select name="campaignId">${mktCampaignOptions(common.campaigns)}</select></label>
        <label class="field field-span"><span>Nama promosi</span><input name="name" required maxlength="255" placeholder="contoh: Diskon Akhir Pekan" /></label>
        <label class="field"><span>Tipe</span><select name="type"><option value="percentage">Persentase</option><option value="fixed_amount">Nominal tetap</option><option value="free_shipping">Gratis ongkir</option><option value="bundle">Bundle</option><option value="buy_x_get_y">Beli X dapat Y</option></select></label>
        <label class="field"><span>Status</span><select name="status"><option value="draft">Draft</option><option value="active" selected>Aktif</option></select></label>
        <label class="field"><span>Minimum belanja</span><input name="minPurchase" type="number" min="0" step="0.01" value="0" /></label>
        <label class="field"><span>Maksimum diskon</span><input name="maxDiscount" type="number" min="0" step="0.01" placeholder="Opsional" /></label>
        <label class="field"><span>Kuota pemakaian</span><input name="usageLimit" type="number" min="0" step="1" placeholder="Opsional" /></label>
        <label class="field"><span>Batas per pelanggan</span><input name="perCustomerLimit" type="number" min="0" step="1" placeholder="Opsional" /></label>
        <label class="field field-span"><span>Deskripsi</span><textarea name="description" rows="2" maxlength="4000" placeholder="Opsional"></textarea></label>
      </form>
    `,
    footer: `
      <button class="button button-ghost" type="button" data-modal-close>Batal</button>
      <button class="button button-primary" type="submit" form="mkt-promotion-form">Simpan promosi</button>
    `,
  });
  const form = modal?.querySelector('#mkt-promotion-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const submit = modal.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      await api('/marketing/promotions', {
        method: 'POST',
        body: {
          merchantId: String(data.get('merchantId')),
          campaignId: String(data.get('campaignId') || '') || undefined,
          name: String(data.get('name')),
          type: String(data.get('type')),
          status: String(data.get('status')),
          minPurchase: String(data.get('minPurchase') || 0),
          maxDiscount: String(data.get('maxDiscount') || '') || undefined,
          usageLimit: String(data.get('usageLimit') || '') || undefined,
          perCustomerLimit: String(data.get('perCustomerLimit') || '') || undefined,
          description: String(data.get('description') || '') || undefined,
        },
      });
      closeModal();
      showToast('Promosi dibuat', 'Promosi berhasil disimpan.');
      loadMarketing(true);
    } catch (error) {
      showToast('Gagal menyimpan promosi', error.message, 'error');
    } finally {
      submit.disabled = false;
    }
  });
}

function openMarketingCouponModal(common) {
  const modal = openModal({
    title: 'Kupon baru',
    kicker: 'Voucher & coupon',
    subtitle: 'Kupon dapat dipakai pada order commerce merchant.',
    body: `
      <form id="mkt-coupon-form" class="form-grid">
        <label class="field field-span"><span>Merchant</span><select name="merchantId" required>${mktMerchantOptions(common.merchants)}</select></label>
        <label class="field field-span"><span>Promosi</span><select name="promotionId">${mktPromotionOptions(common.promotions)}</select></label>
        <label class="field"><span>Kode kupon</span><input name="code" required maxlength="64" placeholder="contoh: HEMAT10" /></label>
        <label class="field"><span>Nama</span><input name="name" maxlength="255" placeholder="Opsional" /></label>
        <label class="field"><span>Tipe diskon</span><select name="discountType"><option value="percentage">Persentase</option><option value="fixed_amount">Nominal tetap</option><option value="free_shipping">Gratis ongkir</option></select></label>
        <label class="field"><span>Nilai diskon</span><input name="discountValue" type="number" min="0" step="0.01" value="0" /></label>
        <label class="field"><span>Minimum belanja</span><input name="minPurchase" type="number" min="0" step="0.01" value="0" /></label>
        <label class="field"><span>Maksimum diskon</span><input name="maxDiscount" type="number" min="0" step="0.01" placeholder="Opsional" /></label>
        <label class="field"><span>Kuota</span><input name="usageLimit" type="number" min="0" step="1" placeholder="Opsional" /></label>
        <label class="field"><span>Batas per pelanggan</span><input name="perCustomerLimit" type="number" min="0" step="1" placeholder="Opsional" /></label>
      </form>
    `,
    footer: `
      <button class="button button-ghost" type="button" data-modal-close>Batal</button>
      <button class="button button-primary" type="submit" form="mkt-coupon-form">Simpan kupon</button>
    `,
  });
  const form = modal?.querySelector('#mkt-coupon-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const submit = modal.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      await api('/marketing/coupons', {
        method: 'POST',
        body: {
          merchantId: String(data.get('merchantId')),
          promotionId: String(data.get('promotionId') || '') || undefined,
          code: String(data.get('code')).toUpperCase(),
          name: String(data.get('name') || '') || undefined,
          discountType: String(data.get('discountType')),
          discountValue: String(data.get('discountValue') || 0),
          minPurchase: String(data.get('minPurchase') || 0),
          maxDiscount: String(data.get('maxDiscount') || '') || undefined,
          usageLimit: String(data.get('usageLimit') || '') || undefined,
          perCustomerLimit: String(data.get('perCustomerLimit') || '') || undefined,
        },
      });
      closeModal();
      showToast('Kupon dibuat', 'Kupon siap digunakan pada order commerce.');
      loadMarketing(true);
    } catch (error) {
      showToast('Gagal menyimpan kupon', error.message, 'error');
    } finally {
      submit.disabled = false;
    }
  });
}

function openMarketingAdModal(common) {
  const modal = openModal({
    title: 'Iklan baru',
    kicker: 'Paid media',
    subtitle: 'Hubungkan iklan dengan kampanye dan penempatan.',
    body: `
      <form id="mkt-ad-form" class="form-grid">
        <label class="field field-span"><span>Merchant</span><select name="merchantId" required>${mktMerchantOptions(common.merchants)}</select></label>
        <label class="field field-span"><span>Kampanye</span><select name="campaignId">${mktCampaignOptions(common.campaigns)}</select></label>
        <label class="field field-span"><span>Nama iklan</span><input name="name" required maxlength="255" /></label>
        <label class="field"><span>Tipe</span><select name="type"><option value="banner">Banner</option><option value="sponsored_product">Produk sponsor</option><option value="social_post">Posting sosial</option><option value="email">Email</option><option value="other">Lainnya</option></select></label>
        <label class="field"><span>Status</span><select name="status"><option value="draft">Draft</option><option value="scheduled" selected>Dijadwalkan</option><option value="active">Aktif</option></select></label>
        <label class="field"><span>Penempatan</span><input name="placement" maxlength="128" placeholder="contoh: storefront_home" /></label>
        <label class="field"><span>Anggaran</span><input name="budget" type="number" min="0" step="0.01" value="0" /></label>
        <label class="field field-span"><span>URL kreatif</span><input name="creativeUrl" maxlength="2048" placeholder="https://..." /></label>
        <label class="field field-span"><span>URL target</span><input name="targetUrl" maxlength="2048" placeholder="https://..." /></label>
      </form>
    `,
    footer: `
      <button class="button button-ghost" type="button" data-modal-close>Batal</button>
      <button class="button button-primary" type="submit" form="mkt-ad-form">Simpan iklan</button>
    `,
  });
  const form = modal?.querySelector('#mkt-ad-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const submit = modal.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      await api('/marketing/advertisements', {
        method: 'POST',
        body: {
          merchantId: String(data.get('merchantId')),
          campaignId: String(data.get('campaignId') || '') || undefined,
          name: String(data.get('name')),
          type: String(data.get('type')),
          status: String(data.get('status')),
          placement: String(data.get('placement') || '') || undefined,
          budget: String(data.get('budget') || 0),
          creativeUrl: String(data.get('creativeUrl') || '') || undefined,
          targetUrl: String(data.get('targetUrl') || '') || undefined,
        },
      });
      closeModal();
      showToast('Iklan dibuat', 'Iklan berhasil disimpan.');
      loadMarketing(true);
    } catch (error) {
      showToast('Gagal menyimpan iklan', error.message, 'error');
    } finally {
      submit.disabled = false;
    }
  });
}

async function mktRunMarketingAction(action, id, op) {
  try {
    if (action === 'campaign') {
      await api(`/marketing/campaigns/${id}/${op}`, { method: 'POST' });
      showToast('Kampanye diperbarui', 'Status kampanye berhasil diubah.');
    } else if (action === 'promotion') {
      await api(`/marketing/promotions/${id}/${op}`, { method: 'POST' });
      showToast('Promosi diperbarui', 'Status promosi berhasil diubah.');
    } else if (action === 'coupon-deactivate') {
      await api(`/marketing/coupons/${id}`, { method: 'DELETE' });
      showToast('Kupon dinonaktifkan', 'Kupon tidak dapat dipakai lagi.');
    } else if (action === 'ad-cancel') {
      await api(`/marketing/advertisements/${id}`, { method: 'DELETE' });
      showToast('Iklan dibatalkan', 'Iklan berhasil dinonaktifkan.');
    }
    loadMarketing(true);
  } catch (error) {
    showToast('Aksi gagal', error.message, 'error');
  }
}

/* --------------------------------- CRM -------------------------------- */

async function loadCrm(force = false) {
  const sequence = ++state.sequences.crm;
  if (!force && state.crm) {
    renderCrm();
    return;
  }
  for (const selector of MKT_CRM_TABLES) {
    const host = $(selector);
    if (host) host.innerHTML = tableLoading(2);
  }
  try {
    const search = state.filters.crm.search
      ? `&search=${encodeURIComponent(state.filters.crm.search)}`
      : '';
    const results = await Promise.all([
      api(`/marketing/customers?limit=100${search}`),
      api('/marketing/customer-groups?limit=100'),
      api('/marketing/customer-segments?limit=100'),
      api('/marketing/loyalty-accounts?limit=100'),
      api('/marketing/interactions?limit=100'),
      api('/marketing/complaints?limit=100'),
    ]);
    if (sequence !== state.sequences.crm) return;
    state.crm = {
      customers: results[0].data ?? [],
      groups: results[1].data ?? [],
      segments: results[2].data ?? [],
      loyalty: results[3].data ?? [],
      interactions: results[4].data ?? [],
      complaints: results[5].data ?? [],
    };
    renderCrm();
  } catch (error) {
    if (sequence !== state.sequences.crm) return;
    for (const selector of MKT_CRM_TABLES) {
      const host = $(selector);
      if (host) host.innerHTML = errorState(error.message, 'data-crm-retry');
    }
    showToast('Gagal memuat CRM', error.message, 'error');
  }
}

function renderCrm() {
  const data = state.crm;
  if (!data) return;
  const openComplaints = data.complaints.filter((row) =>
    ['open', 'in_progress'].includes(row.status),
  ).length;
  scSetText('#crm-stat-customers', formatNumber(data.customers.length));
  scSetText('#crm-stat-loyalty', formatNumber(data.loyalty.length));
  scSetText('#crm-stat-segments', formatNumber(data.groups.length + data.segments.length));
  scSetText('#crm-stat-complaints', formatNumber(openComplaints));
  const summary = $('#crm-summary-badge');
  if (summary) {
    summary.hidden = openComplaints <= 0;
    summary.textContent = `${formatNumber(openComplaints)} keluhan terbuka`;
  }
  scSetBadge('#crm-customer-count', data.customers.length, 'pelanggan');
  scSetBadge('#crm-group-count', data.groups.length, 'grup');
  scSetBadge('#crm-loyalty-count', data.loyalty.length, 'akun');
  scSetBadge('#crm-interaction-count', data.interactions.length, 'interaksi');
  scSetBadge('#crm-complaint-count', data.complaints.length, 'keluhan');

  scRenderTable(
    '#crm-customers-table',
    ['Pelanggan', 'Kontak', 'Merchant', 'Aktivitas', 'Status', 'Aksi'],
    data.customers,
    (row) => `
      <tr>
        <td>
          <div class="cell-title">${escapeHtml(row.name)}</div>
          <div class="cell-muted">${escapeHtml(row.code)} • ${escapeHtml(statusLabel(row.source))}</div>
        </td>
        <td>
          <div class="cell-title">${escapeHtml(row.email || '—')}</div>
          <div class="cell-muted">${escapeHtml(row.phone || '—')}</div>
        </td>
        <td>${escapeHtml(row.merchantName)}</td>
        <td>
          <div class="cell-title">${formatNumber(row.totalOrders)} order</div>
          <div class="cell-muted">${formatMoney(row.totalSpent)} • ${escapeHtml(formatDate(row.lastOrderAt))}</div>
        </td>
        <td>${statusBadge(row.status)}</td>
        <td>${scActions([
          scButton('Detail', `data-mkt-action="customer-detail" data-mkt-id="${escapeHtml(row.id)}"`),
        ])}</td>
      </tr>
    `,
    'Belum ada pelanggan',
    'Tambahkan pelanggan atau hubungkan pengguna commerce ke profil CRM.',
  );

  scRenderTable(
    '#crm-groups-table',
    ['Grup pelanggan', 'Merchant', 'Diskon', 'Status', 'Aksi'],
    data.groups,
    (row) => `
      <tr>
        <td>
          <div class="cell-title">${escapeHtml(row.name)}</div>
          <div class="cell-muted">${escapeHtml(row.code)}</div>
        </td>
        <td>${escapeHtml(row.merchantName)}</td>
        <td>${formatNumber(row.discountPercent)}%</td>
        <td>${statusBadge(row.status)}</td>
        <td>${scActions([
          scButton('Detail', `data-mkt-action="group-detail" data-mkt-id="${escapeHtml(row.id)}"`),
        ])}</td>
      </tr>
    `,
    'Belum ada grup pelanggan',
    'Grup membantu mengelompokkan pelanggan dengan benefit khusus.',
  );

  scRenderTable(
    '#crm-segments-table',
    ['Segmen pelanggan', 'Merchant', 'Tipe', 'Anggota', 'Status', 'Aksi'],
    data.segments,
    (row) => {
      const actions = [
        scButton('Detail', `data-mkt-action="segment-detail" data-mkt-id="${escapeHtml(row.id)}"`),
      ];
      if (row.type === 'dynamic' && state.canWriteCrm) {
        actions.push(
          scButton('Refresh', `data-mkt-action="segment-refresh" data-mkt-id="${escapeHtml(row.id)}"`),
        );
      }
      return `
        <tr>
          <td>
            <div class="cell-title">${escapeHtml(row.name)}</div>
            <div class="cell-muted">${escapeHtml(row.code)}</div>
          </td>
          <td>${escapeHtml(row.merchantName)}</td>
          <td>${statusBadge(row.type)}</td>
          <td>${formatNumber(row.memberCount)}</td>
          <td>${statusBadge(row.status)}</td>
          <td>${scActions(actions)}</td>
        </tr>
      `;
    },
    'Belum ada segmen',
    'Segmen dinamis diperbarui otomatis berdasarkan kriteria.',
  );

  scRenderTable(
    '#crm-loyalty-table',
    ['Member', 'Pelanggan', 'Saldo poin', 'Lifetime', 'Tier', 'Status', 'Aksi'],
    data.loyalty,
    (row) => `
      <tr>
        <td>
          <div class="cell-title">${escapeHtml(row.memberCode)}</div>
          <div class="cell-muted">${escapeHtml(row.merchantName)}</div>
        </td>
        <td>
          <div class="cell-title">${escapeHtml(row.customerName)}</div>
          <div class="cell-muted">${escapeHtml(row.customerCode)}</div>
        </td>
        <td>${formatNumber(row.pointsBalance)}</td>
        <td>
          <div class="cell-title">${formatNumber(row.lifetimePoints)} poin</div>
          <div class="cell-muted">${formatMoney(row.lifetimeSpend)}</div>
        </td>
        <td>${statusBadge(row.tier)}</td>
        <td>${statusBadge(row.status)}</td>
        <td>${scActions(
          state.canWriteCrm
            ? [scButton('Poin', `data-mkt-action="loyalty-points" data-mkt-id="${escapeHtml(row.id)}" data-mkt-name="${escapeHtml(row.customerName)}"`)]
            : [],
        )}</td>
      </tr>
    `,
    'Belum ada akun loyalty',
    'Buat akun loyalty untuk mulai mengumpulkan dan menukar poin pelanggan.',
  );

  scRenderTable(
    '#crm-interactions-table',
    ['Interaksi', 'Pelanggan', 'Arah', 'Jadwal', 'Status', 'Aksi'],
    data.interactions,
    (row) => {
      const actions = [];
      if (state.canWriteCrm && row.status === 'open') {
        actions.push(scButton('Selesai', `data-mkt-action="interaction-complete" data-mkt-id="${escapeHtml(row.id)}"`));
        actions.push(scButton('Batalkan', `data-mkt-action="interaction-cancel" data-mkt-id="${escapeHtml(row.id)}"`));
      }
      return `
        <tr>
          <td>
            <div class="cell-title">${escapeHtml(row.subject || statusLabel(row.type))}</div>
            <div class="cell-muted">${escapeHtml(row.customerName)} • ${escapeHtml(statusLabel(row.type))}</div>
          </td>
          <td>${escapeHtml(row.customerCode)}</td>
          <td>${statusBadge(row.direction)}</td>
          <td>${escapeHtml(formatDateTime(row.scheduledAt))}</td>
          <td>${statusBadge(row.status)}</td>
          <td>${scActions(actions)}</td>
        </tr>
      `;
    },
    'Belum ada interaksi',
    'Catat telepon, email, WhatsApp, dan tindak lanjut pelanggan.',
  );

  scRenderTable(
    '#crm-complaints-table',
    ['Keluhan', 'Pelanggan', 'Prioritas', 'Penugasan', 'Status', 'Aksi'],
    data.complaints,
    (row) => {
      const actions = [scButton('Detail', `data-mkt-action="complaint-detail" data-mkt-id="${escapeHtml(row.id)}"`)];
      if (state.canWriteCrm) {
        if (row.status === 'open') {
          actions.push(scButton('Proses', `data-mkt-action="complaint-start" data-mkt-id="${escapeHtml(row.id)}"`));
        }
        if (['open', 'in_progress'].includes(row.status)) {
          actions.push(scButton('Selesaikan', `data-mkt-action="complaint-resolve" data-mkt-id="${escapeHtml(row.id)}"`));
        }
        if (state.canManageCrm && ['resolved', 'rejected'].includes(row.status)) {
          actions.push(scButton('Tutup', `data-mkt-action="complaint-close" data-mkt-id="${escapeHtml(row.id)}"`));
        }
      }
      return `
        <tr>
          <td>
            <div class="cell-title">${escapeHtml(row.subject)}</div>
            <div class="cell-muted">${escapeHtml(row.complaintNumber)} • ${escapeHtml(row.category || '—')}</div>
          </td>
          <td>${escapeHtml(row.customerName)}</td>
          <td>${statusBadge(row.priority)}</td>
          <td>${escapeHtml(row.assignedToName || '—')}</td>
          <td>${statusBadge(row.status)}</td>
          <td>${scActions(actions)}</td>
        </tr>
      `;
    },
    'Belum ada keluhan',
    'Keluhan pelanggan akan muncul di sini untuk ditindaklanjuti.',
  );
}

async function openCustomerDetail(id) {
  try {
    const result = await api(`/marketing/customers/${id}`);
    const customer = result.data;
    const groups = (customer.groups ?? []).map((row) => escapeHtml(row.name)).join(', ') || '—';
    const segments = (customer.segments ?? []).map((row) => escapeHtml(row.name)).join(', ') || '—';
    openModal({
      title: customer.name,
      kicker: 'Profil pelanggan',
      subtitle: `${customer.code} • ${customer.email || customer.phone || 'tanpa kontak'}`,
      wide: true,
      body: `
        <dl class="detail-list">
          <div class="detail-row"><dt>Status</dt><dd>${statusBadge(customer.status)}</dd></div>
          <div class="detail-row"><dt>Sumber</dt><dd>${escapeHtml(statusLabel(customer.source))}</dd></div>
          <div class="detail-row"><dt>Bergabung</dt><dd>${escapeHtml(formatDate(customer.joinedAt))}</dd></div>
          <div class="detail-row"><dt>Order</dt><dd>${formatNumber(customer.totalOrders)} • ${formatMoney(customer.totalSpent)}</dd></div>
          <div class="detail-row"><dt>Order terakhir</dt><dd>${escapeHtml(formatDateTime(customer.lastOrderAt))}</dd></div>
          <div class="detail-row"><dt>Grup</dt><dd>${groups}</dd></div>
          <div class="detail-row"><dt>Segmen</dt><dd>${segments}</dd></div>
          <div class="detail-row"><dt>Loyalty</dt><dd>${customer.loyaltyAccount ? `${formatNumber(customer.loyaltyAccount.pointsBalance)} poin • ${escapeHtml(statusLabel(customer.loyaltyAccount.tier))}` : 'Belum terdaftar'}</dd></div>
          <div class="detail-row"><dt>Alamat profil</dt><dd>${escapeHtml(customer.profile?.address || '—')}</dd></div>
        </dl>
        <h4 class="detail-heading">Interaksi terbaru</h4>
        ${
          (customer.recentInteractions ?? []).length
            ? `<div class="table-wrap"><table class="table"><thead><tr><th>Jenis</th><th>Subjek</th><th>Status</th><th>Tanggal</th></tr></thead><tbody>${customer.recentInteractions
                .map(
                  (row) => `<tr><td>${escapeHtml(statusLabel(row.type))}</td><td>${escapeHtml(row.subject || '—')}</td><td>${statusBadge(row.status)}</td><td>${escapeHtml(formatDateTime(row.createdAt))}</td></tr>`,
                )
                .join('')}</tbody></table></div>`
            : emptyState('Belum ada interaksi', 'Catat interaksi agar riwayat pelanggan lengkap.')
        }
      `,
      footer: state.canWriteCrm
        ? `<button class="button button-ghost" type="button" data-modal-close>Tutup</button>
           <button class="button button-primary" type="button" data-mkt-action="customer-refresh" data-mkt-id="${escapeHtml(customer.id)}">Segarkan metrik</button>`
        : '<button class="button button-ghost" type="button" data-modal-close>Tutup</button>',
    });
  } catch (error) {
    showToast('Gagal memuat pelanggan', error.message, 'error');
  }
}

async function openGroupDetail(id) {
  try {
    const [groupResult, common] = await Promise.all([
      api(`/marketing/customer-groups/${id}`),
      mktCrmData(),
    ]);
    const group = groupResult.data;
    const members = (group.members ?? [])
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.name)}</td>
            <td>${escapeHtml(row.email || row.phone || '—')}</td>
            <td>${statusBadge(row.status)}</td>
            <td>${escapeHtml(formatDate(row.joinedAt))}</td>
            <td>${state.canWriteCrm ? scButton('Keluarkan', `data-mkt-action="group-member-remove" data-mkt-id="${escapeHtml(group.id)}" data-mkt-customer="${escapeHtml(row.id)}"`) : '—'}</td>
          </tr>`,
      )
      .join('');
    const modal = openModal({
      title: group.name,
      kicker: 'Grup pelanggan',
      subtitle: `${group.code} • diskon ${formatNumber(group.discountPercent)}%`,
      wide: true,
      body: `
        <dl class="detail-list">
          <div class="detail-row"><dt>Status</dt><dd>${statusBadge(group.status)}</dd></div>
          <div class="detail-row"><dt>Merchant</dt><dd>${escapeHtml(group.merchantName || '—')}</dd></div>
          <div class="detail-row"><dt>Deskripsi</dt><dd>${escapeHtml(group.description || '—')}</dd></div>
        </dl>
        ${
          members
            ? `<div class="table-wrap"><table class="table"><thead><tr><th>Pelanggan</th><th>Kontak</th><th>Status</th><th>Bergabung</th><th>Aksi</th></tr></thead><tbody>${members}</tbody></table></div>`
            : emptyState('Grup masih kosong', 'Tambahkan pelanggan ke grup ini.')
        }
        ${
          state.canWriteCrm
            ? `<form id="mkt-group-member-form" class="form-grid detail-form">
                 <label class="field field-span"><span>Tambah pelanggan</span><select name="customerId" required>${mktCustomerOptions(common.customers)}</select></label>
               </form>`
            : ''
        }
      `,
      footer: state.canWriteCrm
        ? `<button class="button button-ghost" type="button" data-modal-close>Tutup</button>
           <button class="button button-primary" type="submit" form="mkt-group-member-form">Tambah anggota</button>`
        : '<button class="button button-ghost" type="button" data-modal-close>Tutup</button>',
    });
    modal?.querySelector('#mkt-group-member-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      try {
        await api(`/marketing/customer-groups/${group.id}/members`, {
          method: 'POST',
          body: { customerId: String(formData.get('customerId')) },
        });
        showToast('Anggota ditambahkan', 'Pelanggan masuk ke grup.');
        await openGroupDetail(group.id);
        loadCrm(true);
      } catch (error) {
        showToast('Gagal menambah anggota', error.message, 'error');
      }
    });
  } catch (error) {
    showToast('Gagal memuat grup', error.message, 'error');
  }
}

async function openSegmentDetail(id) {
  try {
    const [segmentResult, common] = await Promise.all([
      api(`/marketing/customer-segments/${id}`),
      mktCrmData(),
    ]);
    const segment = segmentResult.data;
    const members = (segment.members ?? [])
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.name)}</td>
            <td>${escapeHtml(row.email || row.phone || '—')}</td>
            <td>${formatNumber(row.totalOrders)}</td>
            <td>${formatMoney(row.totalSpent)}</td>
            <td>${state.canWriteCrm && segment.type === 'manual' ? scButton('Keluarkan', `data-mkt-action="segment-member-remove" data-mkt-id="${escapeHtml(segment.id)}" data-mkt-customer="${escapeHtml(row.id)}"`) : '—'}</td>
          </tr>`,
      )
      .join('');
    openModal({
      title: segment.name,
      kicker: 'Segmen pelanggan',
      subtitle: `${segment.code} • ${statusLabel(segment.type)}`,
      wide: true,
      body: `
        <dl class="detail-list">
          <div class="detail-row"><dt>Status</dt><dd>${statusBadge(segment.status)}</dd></div>
          <div class="detail-row"><dt>Jumlah anggota</dt><dd>${formatNumber(segment.memberCount)}</dd></div>
          <div class="detail-row"><dt>Kriteria</dt><dd>${escapeHtml(JSON.stringify(segment.criteria ?? {}, null, 0))}</dd></div>
        </dl>
        ${
          members
            ? `<div class="table-wrap"><table class="table"><thead><tr><th>Pelanggan</th><th>Kontak</th><th>Order</th><th>Belanja</th><th>Aksi</th></tr></thead><tbody>${members}</tbody></table></div>`
            : emptyState('Segmen masih kosong', 'Perbarui segmen atau tambahkan pelanggan manual.')
        }
        ${
          state.canWriteCrm && segment.type === 'manual'
            ? `<form id="mkt-segment-member-form" class="form-grid detail-form">
                 <label class="field field-span"><span>Tambah pelanggan</span><select name="customerId" required>${mktCustomerOptions(common.customers)}</select></label>
               </form>`
            : ''
        }
      `,
      footer: state.canWriteCrm
        ? `<button class="button button-ghost" type="button" data-modal-close>Tutup</button>
           ${segment.type === 'dynamic' ? `<button class="button button-primary" type="button" data-mkt-action="segment-refresh" data-mkt-id="${escapeHtml(segment.id)}">Refresh anggota</button>` : `<button class="button button-primary" type="submit" form="mkt-segment-member-form">Tambah anggota</button>`}`
        : '<button class="button button-ghost" type="button" data-modal-close>Tutup</button>',
    });
    const form = $(`#mkt-segment-member-form`);
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      try {
        await api(`/marketing/customer-segments/${segment.id}/members`, {
          method: 'POST',
          body: { customerId: String(formData.get('customerId')) },
        });
        showToast('Anggota ditambahkan', 'Pelanggan masuk ke segmen.');
        await openSegmentDetail(segment.id);
        loadCrm(true);
      } catch (error) {
        showToast('Gagal menambah anggota', error.message, 'error');
      }
    });
  } catch (error) {
    showToast('Gagal memuat segmen', error.message, 'error');
  }
}

function openCustomerModal(common) {
  const modal = openModal({
    title: 'Pelanggan baru',
    kicker: 'CRM',
    subtitle: 'Buat profil pelanggan untuk merchant.',
    body: `
      <form id="crm-customer-form" class="form-grid">
        <label class="field field-span"><span>Merchant</span><select name="merchantId" required>${mktMerchantOptions(common.merchants)}</select></label>
        <label class="field field-span"><span>Nama pelanggan</span><input name="name" required maxlength="255" /></label>
        <label class="field"><span>Email</span><input name="email" type="email" maxlength="255" placeholder="Opsional" /></label>
        <label class="field"><span>Telepon</span><input name="phone" maxlength="32" placeholder="Opsional" /></label>
        <label class="field"><span>Sumber</span><select name="source"><option value="manual">Manual</option><option value="storefront">Storefront</option><option value="pos">POS</option><option value="marketplace">Marketplace</option><option value="import">Impor</option><option value="other">Lainnya</option></select></label>
        <label class="field"><span>Status</span><select name="status"><option value="active">Aktif</option><option value="inactive">Nonaktif</option><option value="blocked">Diblokir</option></select></label>
        <label class="field field-span"><span>Tag</span><input name="tags" placeholder="pisahkan dengan koma, contoh: vip, grosir" /></label>
        <label class="field field-span"><span>Catatan</span><textarea name="notes" rows="2" maxlength="4000" placeholder="Opsional"></textarea></label>
      </form>
    `,
    footer: `
      <button class="button button-ghost" type="button" data-modal-close>Batal</button>
      <button class="button button-primary" type="submit" form="crm-customer-form">Simpan pelanggan</button>
    `,
  });
  const form = modal?.querySelector('#crm-customer-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const tags = String(data.get('tags') || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    const submit = modal.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      await api('/marketing/customers', {
        method: 'POST',
        body: {
          merchantId: String(data.get('merchantId')),
          name: String(data.get('name')),
          email: String(data.get('email') || '') || undefined,
          phone: String(data.get('phone') || '') || undefined,
          source: String(data.get('source')),
          status: String(data.get('status')),
          tags: tags.length ? tags : undefined,
          notes: String(data.get('notes') || '') || undefined,
        },
      });
      closeModal();
      showToast('Pelanggan dibuat', 'Profil pelanggan berhasil disimpan.');
      loadCrm(true);
    } catch (error) {
      showToast('Gagal menyimpan pelanggan', error.message, 'error');
    } finally {
      submit.disabled = false;
    }
  });
}

function openGroupModal(common) {
  const modal = openModal({
    title: 'Grup pelanggan baru',
    kicker: 'Segmentasi',
    body: `
      <form id="crm-group-form" class="form-grid">
        <label class="field field-span"><span>Merchant</span><select name="merchantId" required>${mktMerchantOptions(common.merchants)}</select></label>
        <label class="field field-span"><span>Nama grup</span><input name="name" required maxlength="255" /></label>
        <label class="field"><span>Diskon (%)</span><input name="discountPercent" type="number" min="0" max="100" step="0.01" value="0" /></label>
        <label class="field"><span>Status</span><select name="status"><option value="active">Aktif</option><option value="inactive">Nonaktif</option></select></label>
        <label class="field field-span"><span>Deskripsi</span><textarea name="description" rows="2" maxlength="4000" placeholder="Opsional"></textarea></label>
      </form>
    `,
    footer: `
      <button class="button button-ghost" type="button" data-modal-close>Batal</button>
      <button class="button button-primary" type="submit" form="crm-group-form">Simpan grup</button>
    `,
  });
  const form = modal?.querySelector('#crm-group-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    try {
      await api('/marketing/customer-groups', {
        method: 'POST',
        body: {
          merchantId: String(data.get('merchantId')),
          name: String(data.get('name')),
          discountPercent: String(data.get('discountPercent') || 0),
          status: String(data.get('status')),
          description: String(data.get('description') || '') || undefined,
        },
      });
      closeModal();
      showToast('Grup dibuat', 'Grup pelanggan berhasil disimpan.');
      loadCrm(true);
    } catch (error) {
      showToast('Gagal menyimpan grup', error.message, 'error');
    }
  });
}

function openSegmentModal(common) {
  const modal = openModal({
    title: 'Segmen pelanggan baru',
    kicker: 'Target audience',
    subtitle: 'Segmen dinamis memakai kriteria untuk memilih anggota.',
    body: `
      <form id="crm-segment-form" class="form-grid">
        <label class="field field-span"><span>Merchant</span><select name="merchantId" required>${mktMerchantOptions(common.merchants)}</select></label>
        <label class="field field-span"><span>Nama segmen</span><input name="name" required maxlength="255" /></label>
        <label class="field"><span>Tipe</span><select name="type"><option value="manual">Manual</option><option value="dynamic">Dinamis</option></select></label>
        <label class="field"><span>Status</span><select name="status"><option value="active">Aktif</option><option value="inactive">Nonaktif</option></select></label>
        <label class="field"><span>Minimum belanja</span><input name="minTotalSpent" type="number" min="0" step="0.01" placeholder="Opsional" /></label>
        <label class="field"><span>Minimum order</span><input name="minTotalOrders" type="number" min="0" step="1" placeholder="Opsional" /></label>
        <label class="field field-span"><span>Tag pelanggan</span><input name="tags" placeholder="pisahkan dengan koma, contoh: vip" /></label>
        <label class="field field-span"><span>Deskripsi</span><textarea name="description" rows="2" maxlength="4000" placeholder="Opsional"></textarea></label>
      </form>
    `,
    footer: `
      <button class="button button-ghost" type="button" data-modal-close>Batal</button>
      <button class="button button-primary" type="submit" form="crm-segment-form">Simpan segmen</button>
    `,
  });
  const form = modal?.querySelector('#crm-segment-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const type = String(data.get('type'));
    const tags = String(data.get('tags') || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    const criteria = {};
    if (String(data.get('minTotalSpent') || '').trim()) {
      criteria.minTotalSpent = String(data.get('minTotalSpent'));
    }
    if (String(data.get('minTotalOrders') || '').trim()) {
      criteria.minTotalOrders = Number(data.get('minTotalOrders'));
    }
    if (tags.length) criteria.tags = tags;
    try {
      await api('/marketing/customer-segments', {
        method: 'POST',
        body: {
          merchantId: String(data.get('merchantId')),
          name: String(data.get('name')),
          type,
          status: String(data.get('status')),
          criteria: type === 'dynamic' ? criteria : undefined,
          description: String(data.get('description') || '') || undefined,
        },
      });
      closeModal();
      showToast('Segmen dibuat', 'Segmen pelanggan berhasil disimpan.');
      loadCrm(true);
    } catch (error) {
      showToast('Gagal menyimpan segmen', error.message, 'error');
    }
  });
}

function openLoyaltyModal(common) {
  const modal = openModal({
    title: 'Akun loyalty baru',
    kicker: 'Loyalty program',
    body: `
      <form id="crm-loyalty-form" class="form-grid">
        <label class="field field-span"><span>Merchant</span><select name="merchantId" required>${mktMerchantOptions(common.merchants)}</select></label>
        <label class="field field-span"><span>Pelanggan</span><select name="customerId" required>${mktCustomerOptions(common.customers)}</select></label>
        <label class="field"><span>Kode member</span><input name="memberCode" maxlength="64" placeholder="Otomatis bila kosong" /></label>
        <label class="field"><span>Tier awal</span><select name="tier"><option value="bronze">Bronze</option><option value="silver">Silver</option><option value="gold">Gold</option><option value="platinum">Platinum</option></select></label>
      </form>
    `,
    footer: `
      <button class="button button-ghost" type="button" data-modal-close>Batal</button>
      <button class="button button-primary" type="submit" form="crm-loyalty-form">Simpan akun</button>
    `,
  });
  const form = modal?.querySelector('#crm-loyalty-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    try {
      await api('/marketing/loyalty-accounts', {
        method: 'POST',
        body: {
          merchantId: String(data.get('merchantId')),
          customerId: String(data.get('customerId')),
          memberCode: String(data.get('memberCode') || '') || undefined,
          tier: String(data.get('tier')),
        },
      });
      closeModal();
      showToast('Akun loyalty dibuat', 'Member dapat mulai mengumpulkan poin.');
      loadCrm(true);
    } catch (error) {
      showToast('Gagal menyimpan akun', error.message, 'error');
    }
  });
}

function openInteractionModal(common) {
  const modal = openModal({
    title: 'Interaksi baru',
    kicker: 'Customer engagement',
    body: `
      <form id="crm-interaction-form" class="form-grid">
        <label class="field field-span"><span>Merchant</span><select name="merchantId" required>${mktMerchantOptions(common.merchants)}</select></label>
        <label class="field field-span"><span>Pelanggan</span><select name="customerId" required>${mktCustomerOptions(common.customers)}</select></label>
        <label class="field"><span>Jenis</span><select name="type"><option value="note">Catatan</option><option value="call">Telepon</option><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="meeting">Pertemuan</option><option value="follow_up">Tindak lanjut</option></select></label>
        <label class="field"><span>Arah</span><select name="direction"><option value="internal">Internal</option><option value="inbound">Masuk</option><option value="outbound">Keluar</option></select></label>
        <label class="field field-span"><span>Subjek</span><input name="subject" maxlength="255" placeholder="Opsional" /></label>
        <label class="field field-span"><span>Isi interaksi</span><textarea name="content" rows="3" required maxlength="8000"></textarea></label>
        <label class="field field-span"><span>Jadwal</span><input name="scheduledAt" type="datetime-local" /></label>
      </form>
    `,
    footer: `
      <button class="button button-ghost" type="button" data-modal-close>Batal</button>
      <button class="button button-primary" type="submit" form="crm-interaction-form">Simpan interaksi</button>
    `,
  });
  const form = modal?.querySelector('#crm-interaction-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const scheduledAt = String(data.get('scheduledAt') || '');
    try {
      await api('/marketing/interactions', {
        method: 'POST',
        body: {
          merchantId: String(data.get('merchantId')),
          customerId: String(data.get('customerId')),
          type: String(data.get('type')),
          direction: String(data.get('direction')),
          subject: String(data.get('subject') || '') || undefined,
          content: String(data.get('content')),
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        },
      });
      closeModal();
      showToast('Interaksi dibuat', 'Riwayat pelanggan berhasil dicatat.');
      loadCrm(true);
    } catch (error) {
      showToast('Gagal menyimpan interaksi', error.message, 'error');
    }
  });
}

function openComplaintModal(common) {
  const modal = openModal({
    title: 'Keluhan baru',
    kicker: 'Customer service',
    body: `
      <form id="crm-complaint-form" class="form-grid">
        <label class="field field-span"><span>Merchant</span><select name="merchantId" required>${mktMerchantOptions(common.merchants)}</select></label>
        <label class="field field-span"><span>Pelanggan</span><select name="customerId" required>${mktCustomerOptions(common.customers)}</select></label>
        <label class="field"><span>Kategori</span><input name="category" maxlength="128" placeholder="contoh: pengiriman" /></label>
        <label class="field"><span>Prioritas</span><select name="priority"><option value="low">Rendah</option><option value="normal" selected>Normal</option><option value="high">Tinggi</option><option value="urgent">Mendesak</option></select></label>
        <label class="field field-span"><span>Subjek</span><input name="subject" required maxlength="255" /></label>
        <label class="field field-span"><span>Deskripsi</span><textarea name="description" rows="3" required maxlength="8000"></textarea></label>
      </form>
    `,
    footer: `
      <button class="button button-ghost" type="button" data-modal-close>Batal</button>
      <button class="button button-primary" type="submit" form="crm-complaint-form">Simpan keluhan</button>
    `,
  });
  const form = modal?.querySelector('#crm-complaint-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    try {
      await api('/marketing/complaints', {
        method: 'POST',
        body: {
          merchantId: String(data.get('merchantId')),
          customerId: String(data.get('customerId')),
          category: String(data.get('category') || '') || undefined,
          subject: String(data.get('subject')),
          description: String(data.get('description')),
          priority: String(data.get('priority')),
        },
      });
      closeModal();
      showToast('Keluhan dibuat', 'Keluhan siap ditindaklanjuti.');
      loadCrm(true);
    } catch (error) {
      showToast('Gagal menyimpan keluhan', error.message, 'error');
    }
  });
}

function openLoyaltyPointsModal(id, customerName) {
  const modal = openModal({
    title: 'Penyesuaian poin',
    kicker: 'Loyalty',
    subtitle: customerName || '',
    body: `
      <form id="crm-points-form" class="form-grid">
        <label class="field"><span>Jenis transaksi</span><select name="type"><option value="earn">Perolehan</option><option value="bonus">Bonus</option><option value="redeem">Penukaran</option><option value="adjustment">Penyesuaian</option><option value="expire">Kedaluwarsa</option></select></label>
        <label class="field"><span>Jumlah poin</span><input name="points" type="number" step="1" min="1" required value="100" /></label>
        <label class="field field-span"><span>Referensi</span><input name="reference" maxlength="128" placeholder="Opsional" /></label>
        <label class="field field-span"><span>Deskripsi</span><textarea name="description" rows="2" maxlength="4000" placeholder="Opsional"></textarea></label>
      </form>
    `,
    footer: `
      <button class="button button-ghost" type="button" data-modal-close>Batal</button>
      <button class="button button-primary" type="submit" form="crm-points-form">Simpan transaksi</button>
    `,
  });
  const form = modal?.querySelector('#crm-points-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    try {
      await api(`/marketing/loyalty-accounts/${id}/transactions`, {
        method: 'POST',
        body: {
          type: String(data.get('type')),
          points: Number(data.get('points')),
          reference: String(data.get('reference') || '') || undefined,
          description: String(data.get('description') || '') || undefined,
        },
      });
      closeModal();
      showToast('Poin diperbarui', 'Saldo loyalty berhasil disesuaikan.');
      loadCrm(true);
    } catch (error) {
      showToast('Gagal memproses poin', error.message, 'error');
    }
  });
}

async function openComplaintDetail(id) {
  try {
    const result = await api(`/marketing/complaints/${id}`);
    const complaint = result.data;
    openModal({
      title: complaint.subject,
      kicker: 'Detail keluhan',
      subtitle: `${complaint.complaintNumber} • ${complaint.customer?.name ?? ''}`,
      wide: true,
      body: `
        <dl class="detail-list">
          <div class="detail-row"><dt>Status</dt><dd>${statusBadge(complaint.status)}</dd></div>
          <div class="detail-row"><dt>Prioritas</dt><dd>${statusBadge(complaint.priority)}</dd></div>
          <div class="detail-row"><dt>Kategori</dt><dd>${escapeHtml(complaint.category || '—')}</dd></div>
          <div class="detail-row"><dt>Order</dt><dd>${escapeHtml(complaint.order?.orderNumber || '—')}</dd></div>
          <div class="detail-row"><dt>Dibuat</dt><dd>${escapeHtml(formatDateTime(complaint.createdAt))}</dd></div>
          <div class="detail-row"><dt>Resolusi</dt><dd>${escapeHtml(complaint.resolution || '—')}</dd></div>
        </dl>
        <p class="detail-text">${escapeHtml(complaint.description)}</p>
      `,
      footer: state.canWriteCrm && ['open', 'in_progress'].includes(complaint.status)
        ? `<button class="button button-ghost" type="button" data-modal-close>Tutup</button>
           <button class="button button-primary" type="button" data-mkt-action="complaint-resolve" data-mkt-id="${escapeHtml(complaint.id)}">Selesaikan</button>`
        : '<button class="button button-ghost" type="button" data-modal-close>Tutup</button>',
    });
  } catch (error) {
    showToast('Gagal memuat keluhan', error.message, 'error');
  }
}

function openComplaintResolveModal(id) {
  const modal = openModal({
    title: 'Selesaikan keluhan',
    kicker: 'Customer service',
    body: `
      <form id="crm-resolve-form" class="form-grid">
        <label class="field field-span"><span>Resolusi</span><textarea name="resolution" rows="4" required maxlength="8000" placeholder="Jelaskan tindakan penyelesaian"></textarea></label>
      </form>
    `,
    footer: `
      <button class="button button-ghost" type="button" data-modal-close>Batal</button>
      <button class="button button-primary" type="submit" form="crm-resolve-form">Selesaikan</button>
    `,
  });
  const form = modal?.querySelector('#crm-resolve-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    try {
      await api(`/marketing/complaints/${id}/resolve`, {
        method: 'POST',
        body: { resolution: String(data.get('resolution')) },
      });
      closeModal();
      showToast('Keluhan diselesaikan', 'Resolusi telah dicatat.');
      loadCrm(true);
    } catch (error) {
      showToast('Gagal menyelesaikan keluhan', error.message, 'error');
    }
  });
}

async function mktRunCrmAction(action, id) {
  try {
    if (action === 'customer-refresh') {
      await api(`/marketing/customers/${id}/refresh-metrics`, {
        method: 'POST',
        body: { syncLoyaltySpend: true },
      });
      showToast('Metrik diperbarui', 'Order dan belanja pelanggan telah disegarkan.');
      await openCustomerDetail(id);
      loadCrm(true);
      return;
    }
    if (action === 'interaction-complete') {
      await api(`/marketing/interactions/${id}/complete`, { method: 'POST' });
      showToast('Interaksi selesai', 'Tindak lanjut telah ditandai selesai.');
    } else if (action === 'interaction-cancel') {
      await api(`/marketing/interactions/${id}/cancel`, { method: 'POST' });
      showToast('Interaksi dibatalkan', 'Interaksi tidak lagi berstatus terbuka.');
    } else if (action === 'complaint-start') {
      await api(`/marketing/complaints/${id}/start`, { method: 'POST' });
      showToast('Keluhan diproses', 'Keluhan masuk ke tahap penanganan.');
    } else if (action === 'complaint-close') {
      await api(`/marketing/complaints/${id}/close`, { method: 'POST' });
      showToast('Keluhan ditutup', 'Keluhan telah ditutup.');
    } else if (action === 'segment-refresh') {
      const result = await api(`/marketing/customer-segments/${id}/refresh`, {
        method: 'POST',
        body: {},
      });
      showToast('Segmen diperbarui', `${formatNumber(result.data.memberCount)} anggota cocok.`);
      if (!$('#modal-root').hidden) {
        await openSegmentDetail(id);
      }
    }
    loadCrm(true);
  } catch (error) {
    showToast('Aksi gagal', error.message, 'error');
  }
}

/* -------------------------------- Events ------------------------------ */

function bindEvents() {
  $$('.nav-item').forEach((item) => {
    item.addEventListener('click', () => setView(item.dataset.view));
  });

  $('#menu-toggle').addEventListener('click', openSidebar);
  $('#sidebar-close').addEventListener('click', closeSidebar);
  $('#sidebar-backdrop').addEventListener('click', closeSidebar);
  $('#logout-button').addEventListener('click', logout);
  $('#refresh-button').addEventListener('click', refreshActiveView);
  $('#hero-refresh').addEventListener('click', () => loadOverview(true));

  $('#create-market-button').addEventListener('click', openCreateMarketModal);
  $('#hero-create-market').addEventListener('click', openCreateMarketModal);

  $('#market-search').addEventListener(
    'input',
    debounce((event) => {
      state.filters.markets.search = event.target.value.trim();
      loadMarkets(true);
    }),
  );
  $('#market-status-filter').addEventListener('change', (event) => {
    state.filters.markets.status = event.target.value;
    loadMarkets(true);
  });
  $('#refresh-markets').addEventListener('click', () => loadMarkets(true));

  $('#merchant-search').addEventListener(
    'input',
    debounce((event) => {
      state.filters.merchants.search = event.target.value.trim();
      loadMerchants(true);
    }),
  );
  $('#merchant-status-filter').addEventListener('change', (event) => {
    state.filters.merchants.status = event.target.value;
    loadMerchants(true);
  });
  $('#refresh-merchants').addEventListener('click', () => loadMerchants(true));

  $('#product-search').addEventListener(
    'input',
    debounce((event) => {
      state.filters.products.search = event.target.value.trim();
      loadProducts(true);
    }),
  );
  $('#product-status-filter').addEventListener('change', (event) => {
    state.filters.products.status = event.target.value;
    loadProducts(true);
  });
  $('#refresh-products').addEventListener('click', () => loadProducts(true));

  $('#create-channel-button').addEventListener('click', openCreateChannelModal);
  $('#storefront-search').addEventListener(
    'input',
    debounce((event) => {
      state.filters.commerce.search = event.target.value.trim();
      loadCommerce(true);
    }),
  );
  $('#storefront-status-filter').addEventListener('change', (event) => {
    state.filters.commerce.status = event.target.value;
    loadCommerce(true);
  });
  $('#refresh-commerce').addEventListener('click', () => loadCommerce(true));

  $('#order-search').addEventListener(
    'input',
    debounce((event) => {
      state.filters.orders.search = event.target.value.trim();
      loadOrders(true);
    }),
  );
  $('#order-status-filter').addEventListener('change', (event) => {
    state.filters.orders.status = event.target.value;
    loadOrders(true);
  });
  $('#refresh-orders').addEventListener('click', () => loadOrders(true));

  $('#payment-search').addEventListener(
    'input',
    debounce((event) => {
      state.filters.payments.search = event.target.value.trim();
      loadPayments(true);
    }),
  );
  $('#payment-status-filter').addEventListener('change', (event) => {
    state.filters.payments.status = event.target.value;
    loadPayments(true);
  });
  $('#refresh-payments').addEventListener('click', () => loadPayments(true));
  $('#create-settlement-button').addEventListener('click', openSettlementCreateModal);
  $('#create-reconciliation-button').addEventListener('click', openReconciliationCreateModal);
  $('#create-payment-method-button').addEventListener('click', openCreatePaymentMethodModal);
  $('#create-payment-provider-button').addEventListener('click', openCreatePaymentProviderModal);

  $('#pos-terminal-search').addEventListener(
    'input',
    debounce((event) => {
      state.filters.pos.terminalSearch = event.target.value.trim();
      loadPos(true);
    }),
  );
  $('#pos-terminal-status-filter').addEventListener('change', (event) => {
    state.filters.pos.terminalStatus = event.target.value;
    loadPos(true);
  });
  $('#pos-register-search').addEventListener(
    'input',
    debounce((event) => {
      state.filters.pos.registerSearch = event.target.value.trim();
      loadPos(true);
    }),
  );
  $('#pos-shift-search').addEventListener(
    'input',
    debounce((event) => {
      state.filters.pos.shiftSearch = event.target.value.trim();
      loadPos(true);
    }),
  );
  $('#pos-shift-status-filter').addEventListener('change', (event) => {
    state.filters.pos.shiftStatus = event.target.value;
    loadPos(true);
  });
  $('#pos-transaction-search').addEventListener(
    'input',
    debounce((event) => {
      state.filters.pos.transactionSearch = event.target.value.trim();
      loadPos(true);
    }),
  );
  $('#pos-transaction-status-filter').addEventListener('change', (event) => {
    state.filters.pos.transactionStatus = event.target.value;
    loadPos(true);
  });
  $('#pos-transaction-sync-filter').addEventListener('change', (event) => {
    state.filters.pos.transactionSync = event.target.value;
    loadPos(true);
  });
  $('#pos-sync-search').addEventListener(
    'input',
    debounce((event) => {
      state.filters.pos.syncSearch = event.target.value.trim();
      loadPos(true);
    }),
  );
  $('#pos-sync-status-filter').addEventListener('change', (event) => {
    state.filters.pos.syncStatus = event.target.value;
    loadPos(true);
  });
  $('#refresh-pos-terminals').addEventListener('click', () => loadPos(true));
  $('#refresh-pos-registers').addEventListener('click', () => loadPos(true));
  $('#refresh-pos-shifts').addEventListener('click', () => loadPos(true));
  $('#refresh-pos-transactions').addEventListener('click', () => loadPos(true));
  $('#refresh-pos-sync').addEventListener('click', () => loadPos(true));
  $('#create-pos-terminal-button').addEventListener('click', () => openPosTerminalModal());
  $('#create-pos-register-button').addEventListener('click', () => openPosRegisterModal());
  $('#open-pos-shift-button').addEventListener('click', openPosShiftModal);
  $('#create-pos-transaction-button').addEventListener('click', openPosTransactionModal);
  $('#sync-pos-offline-button').addEventListener('click', openPosSyncModal);

  $('#inventory-item-search').addEventListener(
    'input',
    debounce((event) => {
      state.filters.inventory.itemSearch = event.target.value.trim();
      loadInventory(true);
    }),
  );
  $('#inventory-item-status-filter').addEventListener('change', (event) => {
    state.filters.inventory.itemStatus = event.target.value;
    loadInventory(true);
  });
  $('#inventory-balance-search').addEventListener(
    'input',
    debounce((event) => {
      state.filters.inventory.balanceSearch = event.target.value.trim();
      loadInventory(true);
    }),
  );
  $('#inventory-balance-low-filter').addEventListener('change', (event) => {
    state.filters.inventory.balanceLow = event.target.value;
    loadInventory(true);
  });
  $('#inventory-movement-search').addEventListener(
    'input',
    debounce((event) => {
      state.filters.inventory.movementSearch = event.target.value.trim();
      loadInventory(true);
    }),
  );
  $('#inventory-movement-type-filter').addEventListener('change', (event) => {
    state.filters.inventory.movementType = event.target.value;
    loadInventory(true);
  });
  $('#inventory-adjustment-search').addEventListener(
    'input',
    debounce((event) => {
      state.filters.inventory.adjustmentSearch = event.target.value.trim();
      loadInventory(true);
    }),
  );
  $('#inventory-adjustment-type-filter').addEventListener('change', (event) => {
    state.filters.inventory.adjustmentType = event.target.value;
    loadInventory(true);
  });
  $('#inventory-count-search').addEventListener(
    'input',
    debounce((event) => {
      state.filters.inventory.countSearch = event.target.value.trim();
      loadInventory(true);
    }),
  );
  $('#inventory-count-status-filter').addEventListener('change', (event) => {
    state.filters.inventory.countStatus = event.target.value;
    loadInventory(true);
  });
  $('#inventory-batch-search').addEventListener(
    'input',
    debounce((event) => {
      state.filters.inventory.batchSearch = event.target.value.trim();
      loadInventory(true);
    }),
  );
  $('#inventory-batch-expiry-filter').addEventListener('change', (event) => {
    state.filters.inventory.batchExpiry = event.target.value;
    loadInventory(true);
  });
  for (const selector of [
    '#refresh-inventory-warehouses',
    '#refresh-inventory-locations',
    '#refresh-inventory-items',
    '#refresh-inventory-balances',
    '#refresh-inventory-movements',
    '#refresh-inventory-adjustments',
    '#refresh-inventory-counts',
    '#refresh-inventory-batches',
  ]) {
    $(selector)?.addEventListener('click', () => loadInventory(true));
  }
  $('#create-inventory-warehouse-button').addEventListener('click', () => openInventoryWarehouseModal());
  $('#create-inventory-location-button').addEventListener('click', () => openInventoryLocationModal());
  $('#create-inventory-item-button').addEventListener('click', () => openInventoryItemModal());
  $('#create-inventory-movement-button').addEventListener('click', openInventoryMovementModal);
  $('#create-inventory-adjustment-button').addEventListener('click', () => openInventoryAdjustmentModal());
  $('#create-inventory-count-button').addEventListener('click', openInventoryCountModal);

  for (const selector of [
    '#refresh-sc-suppliers',
    '#refresh-sc-requisitions',
    '#refresh-sc-quotations',
    '#refresh-sc-orders',
    '#refresh-sc-receipts',
    '#refresh-sc-putaway',
    '#refresh-sc-allocations',
    '#refresh-sc-picking',
    '#refresh-sc-packing',
    '#refresh-sc-dispatch',
    '#refresh-sc-returns',
    '#refresh-sc-groups',
  ]) {
    $(selector)?.addEventListener('click', () => loadSupplyChain(true));
  }
  $('#create-sc-supplier-button').addEventListener('click', () => openScSupplierModal());
  $('#create-sc-requisition-button').addEventListener('click', () => openScRequisitionModal());
  $('#create-sc-allocation-button').addEventListener('click', () => openScAllocationModal());
  $('#create-sc-picking-button').addEventListener('click', () => openScPickingModal());
  $('#create-sc-packing-button').addEventListener('click', () => openScPackingModal());
  $('#create-sc-dispatch-button').addEventListener('click', () => openScDispatchModal());
  $('#create-sc-return-button').addEventListener('click', () => openScReturnModal());
  $('#create-sc-group-button').addEventListener('click', () => openScGroupModal());

  $('#refresh-mkt-all')?.addEventListener('click', () => loadMarketing(true));
  for (const [selector, open] of [
    ['#create-mkt-campaign-button', openMarketingCampaignModal],
    ['#create-mkt-promotion-button', openMarketingPromotionModal],
    ['#create-mkt-coupon-button', openMarketingCouponModal],
    ['#create-mkt-ad-button', openMarketingAdModal],
  ]) {
    $(selector)?.addEventListener('click', async () => {
      try {
        open(await mktMarketingData());
      } catch (error) {
        showToast('Gagal memuat data pendukung', error.message, 'error');
      }
    });
  }
  $('#refresh-crm-customers')?.addEventListener('click', () => loadCrm(true));
  for (const [selector, open] of [
    ['#create-crm-customer-button', openCustomerModal],
    ['#create-crm-group-button', openGroupModal],
    ['#create-crm-segment-button', openSegmentModal],
    ['#create-crm-loyalty-button', openLoyaltyModal],
    ['#create-crm-interaction-button', openInteractionModal],
    ['#create-crm-complaint-button', openComplaintModal],
  ]) {
    $(selector)?.addEventListener('click', async () => {
      try {
        open(await mktCrmData());
      } catch (error) {
        showToast('Gagal memuat data pendukung', error.message, 'error');
      }
    });
  }
  $('#crm-customer-search')?.addEventListener(
    'input',
    debounce((event) => {
      state.filters.crm.search = event.target.value.trim();
      loadCrm(true);
    }),
  );

  $('#audit-search').addEventListener(
    'input',
    debounce((event) => {
      state.filters.audit.search = event.target.value.trim();
      loadAudit(true);
    }),
  );
  $('#audit-entity-filter').addEventListener('change', (event) => {
    state.filters.audit.entityType = event.target.value;
    loadAudit(true);
  });
  $('#refresh-audit').addEventListener('click', () => loadAudit(true));

  document.addEventListener('click', (event) => {
    const goto = event.target.closest('[data-goto]');
    if (goto) {
      setView(goto.dataset.goto);
      return;
    }

    const mktAction = event.target.closest('[data-mkt-action]');
    if (mktAction) {
      const action = mktAction.dataset.mktAction;
      const id = mktAction.dataset.mktId;
      if (action === 'campaign-detail') {
        void openMarketingCampaignDetail(id);
      } else if (action === 'customer-detail') {
        void openCustomerDetail(id);
      } else if (action === 'group-detail') {
        void openGroupDetail(id);
      } else if (action === 'segment-detail') {
        void openSegmentDetail(id);
      } else if (action === 'loyalty-points') {
        openLoyaltyPointsModal(id, mktAction.dataset.mktName);
      } else if (action === 'complaint-detail') {
        void openComplaintDetail(id);
      } else if (action === 'complaint-resolve') {
        openComplaintResolveModal(id);
      } else if (action === 'group-member-remove') {
        void (async () => {
          try {
            await api(`/marketing/customer-groups/${id}/members/${mktAction.dataset.mktCustomer}`, {
              method: 'DELETE',
            });
            showToast('Anggota dikeluarkan', 'Pelanggan telah dikeluarkan dari grup.');
            await openGroupDetail(id);
            loadCrm(true);
          } catch (error) {
            showToast('Gagal mengeluarkan anggota', error.message, 'error');
          }
        })();
      } else if (action === 'segment-member-remove') {
        void (async () => {
          try {
            await api(`/marketing/customer-segments/${id}/members/${mktAction.dataset.mktCustomer}`, {
              method: 'DELETE',
            });
            showToast('Anggota dikeluarkan', 'Pelanggan telah dikeluarkan dari segmen.');
            await openSegmentDetail(id);
            loadCrm(true);
          } catch (error) {
            showToast('Gagal mengeluarkan anggota', error.message, 'error');
          }
        })();
      } else if (['campaign', 'promotion', 'coupon-deactivate', 'ad-cancel'].includes(action)) {
        void mktRunMarketingAction(action, id, mktAction.dataset.mktOp);
      } else {
        void mktRunCrmAction(action, id);
      }
      return;
    }

    const retryOverview = event.target.closest('[data-retry-overview]');
    if (retryOverview) {
      loadOverview(true);
      return;
    }

    const retryMarkets = event.target.closest('[data-retry-markets]');
    if (retryMarkets) {
      loadMarkets(true);
      return;
    }

    const retryMerchants = event.target.closest('[data-retry-merchants]');
    if (retryMerchants) {
      loadMerchants(true);
      return;
    }

    const retryProducts = event.target.closest('[data-retry-products]');
    if (retryProducts) {
      loadProducts(true);
      return;
    }

    const retryCommerce = event.target.closest('[data-retry-commerce]');
    if (retryCommerce) {
      loadCommerce(true);
      return;
    }

    const retryOrders = event.target.closest('[data-retry-orders]');
    if (retryOrders) {
      loadOrders(true);
      return;
    }

    const orderDetail = event.target.closest('[data-order-detail]');
    if (orderDetail) {
      openOrderDetail(orderDetail.dataset.orderDetail);
      return;
    }

    const orderStatus = event.target.closest('[data-order-status]');
    if (orderStatus) {
      updateOrderStatus(
        orderStatus.dataset.orderStatus,
        orderStatus.dataset.nextStatus,
        orderStatus.dataset.orderNumber,
      );
      return;
    }

    const orderCancel = event.target.closest('[data-order-cancel]');
    if (orderCancel) {
      openCancelOrderModal(orderCancel.dataset.orderCancel, orderCancel.dataset.orderNumber);
      return;
    }

    const returnDetail = event.target.closest('[data-return-detail]');
    if (returnDetail) {
      openReturnDetail(returnDetail.dataset.returnDetail);
      return;
    }

    const returnStatus = event.target.closest('[data-return-status]');
    if (returnStatus) {
      updateReturnStatus(
        returnStatus.dataset.returnStatus,
        returnStatus.dataset.nextStatus,
        returnStatus.dataset.returnNumber,
      );
      return;
    }

    const retryPayments = event.target.closest('[data-retry-payments]');
    if (retryPayments) {
      loadPayments(true);
      return;
    }

    const paymentDetail = event.target.closest('[data-payment-detail]');
    if (paymentDetail) {
      openPaymentDetail(paymentDetail.dataset.paymentDetail);
      return;
    }

    const paymentConfirm = event.target.closest('[data-payment-confirm]');
    if (paymentConfirm) {
      confirmPayment(paymentConfirm.dataset.paymentConfirm, paymentConfirm.dataset.paymentNumber);
      return;
    }

    const paymentCancel = event.target.closest('[data-payment-cancel]');
    if (paymentCancel) {
      cancelPayment(paymentCancel.dataset.paymentCancel, paymentCancel.dataset.paymentNumber);
      return;
    }

    const paymentRetry = event.target.closest('[data-payment-retry]');
    if (paymentRetry) {
      retryPayment(paymentRetry.dataset.paymentRetry, paymentRetry.dataset.paymentNumber);
      return;
    }

    const paymentRefund = event.target.closest('[data-payment-refund]');
    if (paymentRefund) {
      openRefundModal(
        paymentRefund.dataset.paymentRefund,
        paymentRefund.dataset.paymentAmount,
        paymentRefund.dataset.paymentRefunded,
        paymentRefund.dataset.paymentCurrency,
      );
      return;
    }

    const refundDetail = event.target.closest('[data-refund-detail]');
    if (refundDetail) {
      openRefundDetail(refundDetail.dataset.refundDetail);
      return;
    }

    const refundStatus = event.target.closest('[data-refund-status]');
    if (refundStatus) {
      updateRefundStatus(
        refundStatus.dataset.refundStatus,
        refundStatus.dataset.nextStatus,
        refundStatus.dataset.refundNumber,
      );
      return;
    }

    const settlementDetail = event.target.closest('[data-settlement-detail]');
    if (settlementDetail) {
      openSettlementDetail(settlementDetail.dataset.settlementDetail);
      return;
    }

    const settlementStatus = event.target.closest('[data-settlement-status]');
    if (settlementStatus) {
      updateSettlementStatus(
        settlementStatus.dataset.settlementStatus,
        settlementStatus.dataset.nextStatus,
        settlementStatus.dataset.settlementNumber,
      );
      return;
    }

    const reconciliationDetail = event.target.closest('[data-reconciliation-detail]');
    if (reconciliationDetail) {
      openReconciliationDetail(reconciliationDetail.dataset.reconciliationDetail);
      return;
    }

    const paymentMethodToggle = event.target.closest('[data-payment-method-toggle]');
    if (paymentMethodToggle) {
      togglePaymentMethod(
        paymentMethodToggle.dataset.paymentMethodToggle,
        paymentMethodToggle.dataset.nextStatus,
        paymentMethodToggle.dataset.methodName,
      );
      return;
    }

    const retryInventory = event.target.closest('[data-retry-inventory]');
    if (retryInventory) {
      loadInventory(true);
      return;
    }

    const inventoryWarehouseEdit = event.target.closest('[data-inventory-warehouse-edit]');
    if (inventoryWarehouseEdit) {
      openInventoryWarehouseModal(inventoryWarehouseEdit.dataset.inventoryWarehouseEdit);
      return;
    }

    const inventoryLocationEdit = event.target.closest('[data-inventory-location-edit]');
    if (inventoryLocationEdit) {
      openInventoryLocationModal(inventoryLocationEdit.dataset.inventoryLocationEdit);
      return;
    }

    const inventoryItemEdit = event.target.closest('[data-inventory-item-edit]');
    if (inventoryItemEdit) {
      openInventoryItemModal(inventoryItemEdit.dataset.inventoryItemEdit);
      return;
    }

    const inventoryAdjust = event.target.closest('[data-inventory-adjust-item]');
    if (inventoryAdjust) {
      openInventoryAdjustmentModal({
        itemId: inventoryAdjust.dataset.inventoryAdjustItem,
        warehouseId: inventoryAdjust.dataset.inventoryAdjustWarehouse,
        locationId: inventoryAdjust.dataset.inventoryAdjustLocation,
      });
      return;
    }

    const inventoryMovementDetail = event.target.closest('[data-inventory-movement-detail]');
    if (inventoryMovementDetail) {
      openInventoryMovementDetail(inventoryMovementDetail.dataset.inventoryMovementDetail);
      return;
    }

    const inventoryCountDetail = event.target.closest('[data-inventory-count-detail]');
    if (inventoryCountDetail) {
      openInventoryCountDetail(inventoryCountDetail.dataset.inventoryCountDetail);
      return;
    }

    const inventoryBatchEdit = event.target.closest('[data-inventory-batch-edit]');
    if (inventoryBatchEdit) {
      openInventoryBatchModal(inventoryBatchEdit.dataset.inventoryBatchEdit);
      return;
    }

    if (event.target.closest('[data-sc-retry]')) {
      loadSupplyChain(true);
      return;
    }

    const prSubmit = event.target.closest('[data-sc-pr-submit]');
    if (prSubmit) {
      void scRunAction(
        `/supply-chain/purchase-requisitions/${prSubmit.dataset.scPrSubmit}/submit`,
        'Permintaan diajukan',
      );
      return;
    }

    const prApprove = event.target.closest('[data-sc-pr-approve]');
    if (prApprove) {
      void scRunAction(
        `/supply-chain/purchase-requisitions/${prApprove.dataset.scPrApprove}/approve`,
        'Permintaan disetujui',
      );
      return;
    }

    const prQuote = event.target.closest('[data-sc-pr-quote]');
    if (prQuote) {
      void openScQuotationModal(prQuote.dataset.scPrQuote);
      return;
    }

    const prConvert = event.target.closest('[data-sc-pr-convert]');
    if (prConvert) {
      void openScConvertRequisitionModal(prConvert.dataset.scPrConvert);
      return;
    }

    const quoteSubmit = event.target.closest('[data-sc-quote-submit]');
    if (quoteSubmit) {
      void scRunAction(
        `/supply-chain/supplier-quotations/${quoteSubmit.dataset.scQuoteSubmit}/submit`,
        'Penawaran diajukan',
      );
      return;
    }

    const quoteAccept = event.target.closest('[data-sc-quote-accept]');
    if (quoteAccept) {
      void scRunAction(
        `/supply-chain/supplier-quotations/${quoteAccept.dataset.scQuoteAccept}/accept`,
        'Penawaran diterima',
      );
      return;
    }

    const quoteConvert = event.target.closest('[data-sc-quote-convert]');
    if (quoteConvert) {
      void openScConvertQuotationModal(quoteConvert.dataset.scQuoteConvert);
      return;
    }

    const poSubmit = event.target.closest('[data-sc-po-submit]');
    if (poSubmit) {
      void scRunAction(
        `/supply-chain/purchase-orders/${poSubmit.dataset.scPoSubmit}/submit`,
        'PO diajukan untuk persetujuan',
      );
      return;
    }

    const poApprove = event.target.closest('[data-sc-po-approve]');
    if (poApprove) {
      void scRunAction(
        `/supply-chain/purchase-orders/${poApprove.dataset.scPoApprove}/approve`,
        'PO disetujui',
      );
      return;
    }

    const poSend = event.target.closest('[data-sc-po-send]');
    if (poSend) {
      void scRunAction(
        `/supply-chain/purchase-orders/${poSend.dataset.scPoSend}/send`,
        'PO dikirim ke supplier',
      );
      return;
    }

    const poReceive = event.target.closest('[data-sc-po-receive]');
    if (poReceive) {
      void openScGoodsReceiptModal(poReceive.dataset.scPoReceive);
      return;
    }

    const poClose = event.target.closest('[data-sc-po-close]');
    if (poClose) {
      void scRunAction(
        `/supply-chain/purchase-orders/${poClose.dataset.scPoClose}/close`,
        'PO ditutup',
      );
      return;
    }

    const poCancel = event.target.closest('[data-sc-po-cancel]');
    if (poCancel) {
      void scRunAction(
        `/supply-chain/purchase-orders/${poCancel.dataset.scPoCancel}/cancel`,
        'PO dibatalkan',
      );
      return;
    }

    const grComplete = event.target.closest('[data-sc-gr-complete]');
    if (grComplete) {
      void scRunAction(
        `/supply-chain/goods-receipts/${grComplete.dataset.scGrComplete}/complete`,
        'Penerimaan barang selesai',
      );
      return;
    }

    const putawayProcess = event.target.closest('[data-sc-putaway-process]');
    if (putawayProcess) {
      void openScPutawayModal(putawayProcess.dataset.scPutawayProcess);
      return;
    }

    const allocationRelease = event.target.closest('[data-sc-alloc-release]');
    if (allocationRelease) {
      void scRunAction(
        `/supply-chain/warehouse-allocations/${allocationRelease.dataset.scAllocRelease}/release`,
        'Alokasi dilepas',
      );
      return;
    }

    const pickStart = event.target.closest('[data-sc-pick-start]');
    if (pickStart) {
      void scRunAction(
        `/supply-chain/picking-tasks/${pickStart.dataset.scPickStart}/start`,
        'Picking dimulai',
      );
      return;
    }

    const pickComplete = event.target.closest('[data-sc-pick-complete]');
    if (pickComplete) {
      void scRunAction(
        `/supply-chain/picking-tasks/${pickComplete.dataset.scPickComplete}/complete`,
        'Picking selesai',
        { body: { items: [] } },
      );
      return;
    }

    const pickPack = event.target.closest('[data-sc-pick-pack]');
    if (pickPack) {
      void openScPackingModal(pickPack.dataset.scPickPack);
      return;
    }

    const packStart = event.target.closest('[data-sc-pack-start]');
    if (packStart) {
      void scRunAction(
        `/supply-chain/packing-tasks/${packStart.dataset.scPackStart}/start`,
        'Packing dimulai',
      );
      return;
    }

    const packComplete = event.target.closest('[data-sc-pack-complete]');
    if (packComplete) {
      void scRunAction(
        `/supply-chain/packing-tasks/${packComplete.dataset.scPackComplete}/complete`,
        'Packing selesai',
      );
      return;
    }

    const packDispatch = event.target.closest('[data-sc-pack-dispatch]');
    if (packDispatch) {
      void openScDispatchModal(packDispatch.dataset.scPackDispatch);
      return;
    }

    const dispatchSend = event.target.closest('[data-sc-dispatch-send]');
    if (dispatchSend) {
      void scRunAction(
        `/supply-chain/dispatch-records/${dispatchSend.dataset.scDispatchSend}/dispatch`,
        'Paket diberangkatkan',
      );
      return;
    }

    const dispatchDeliver = event.target.closest('[data-sc-dispatch-deliver]');
    if (dispatchDeliver) {
      void scRunAction(
        `/supply-chain/dispatch-records/${dispatchDeliver.dataset.scDispatchDeliver}/deliver`,
        'Paket ditandai terkirim',
      );
      return;
    }

    const returnApprove = event.target.closest('[data-sc-return-approve]');
    if (returnApprove) {
      void scRunAction(
        `/supply-chain/warehouse-returns/${returnApprove.dataset.scReturnApprove}/approve`,
        'Retur disetujui',
      );
      return;
    }

    const returnReceive = event.target.closest('[data-sc-return-receive]');
    if (returnReceive) {
      void scRunAction(
        `/supply-chain/warehouse-returns/${returnReceive.dataset.scReturnReceive}/receive`,
        'Retur diterima gudang',
      );
      return;
    }

    const returnRestock = event.target.closest('[data-sc-return-restock]');
    if (returnRestock) {
      void scRunAction(
        `/supply-chain/warehouse-returns/${returnRestock.dataset.scReturnRestock}/restock`,
        'Retur kembali ke stok',
        { body: {} },
      );
      return;
    }

    const returnReject = event.target.closest('[data-sc-return-reject]');
    if (returnReject) {
      void scRunAction(
        `/supply-chain/warehouse-returns/${returnReject.dataset.scReturnReject}/reject`,
        'Retur ditolak',
      );
      return;
    }

    const groupClose = event.target.closest('[data-sc-group-close]');
    if (groupClose) {
      void scRunAction(
        `/supply-chain/collective-purchase-groups/${groupClose.dataset.scGroupClose}/close`,
        'Grup pembelian ditutup',
      );
      return;
    }

    const retryPos = event.target.closest('[data-retry-pos]');
    if (retryPos) {
      loadPos(true);
      return;
    }

    const posTerminalEdit = event.target.closest('[data-pos-terminal-edit]');
    if (posTerminalEdit) {
      openPosTerminalModal(posTerminalEdit.dataset.posTerminalEdit);
      return;
    }

    const posRegisterEdit = event.target.closest('[data-pos-register-edit]');
    if (posRegisterEdit) {
      openPosRegisterModal(posRegisterEdit.dataset.posRegisterEdit);
      return;
    }

    const posShiftDetail = event.target.closest('[data-pos-shift-detail]');
    if (posShiftDetail) {
      openPosShiftDetail(posShiftDetail.dataset.posShiftDetail);
      return;
    }

    const posShiftClose = event.target.closest('[data-pos-shift-close]');
    if (posShiftClose) {
      openPosCloseShiftModal(
        posShiftClose.dataset.posShiftClose,
        posShiftClose.dataset.posShiftNumber,
      );
      return;
    }

    const posCashMovement = event.target.closest('[data-pos-cash-movement]');
    if (posCashMovement) {
      openPosCashMovementModal(
        posCashMovement.dataset.posCashMovement,
        posCashMovement.dataset.posShiftNumber,
        posCashMovement.dataset.posCashType,
      );
      return;
    }

    const posTransactionDetail = event.target.closest('[data-pos-transaction-detail]');
    if (posTransactionDetail) {
      openPosTransactionDetail(posTransactionDetail.dataset.posTransactionDetail);
      return;
    }

    const posTransactionVoid = event.target.closest('[data-pos-transaction-void]');
    if (posTransactionVoid) {
      openPosVoidModal(
        posTransactionVoid.dataset.posTransactionVoid,
        posTransactionVoid.dataset.posTransactionNumber,
      );
      return;
    }

    const posTransactionSync = event.target.closest('[data-pos-transaction-sync]');
    if (posTransactionSync) {
      syncPosTransaction(
        posTransactionSync.dataset.posTransactionSync,
        posTransactionSync.dataset.posTransactionNumber,
      );
      return;
    }

    const retryAudit = event.target.closest('[data-retry-audit]');
    if (retryAudit) {
      loadAudit(true);
      return;
    }

    const createChannel = event.target.closest('[data-create-channel]');
    if (createChannel) {
      openCreateChannelModal();
      return;
    }

    const storefrontDetail = event.target.closest('[data-storefront-detail]');
    if (storefrontDetail) {
      openStorefrontDetail(storefrontDetail.dataset.storefrontDetail);
      return;
    }

    const storefrontStatus = event.target.closest('[data-storefront-status]');
    if (storefrontStatus) {
      updateStorefrontStatus(
        storefrontStatus.dataset.storefrontStatus,
        storefrontStatus.dataset.nextStatus,
        storefrontStatus.dataset.storefrontName,
      );
      return;
    }

    const channelToggle = event.target.closest('[data-channel-toggle]');
    if (channelToggle) {
      updateChannelStatus(
        channelToggle.dataset.channelToggle,
        channelToggle.dataset.nextStatus,
        channelToggle.dataset.channelName,
      );
      return;
    }

    const createMarket = event.target.closest('[data-create-market]');
    if (createMarket) {
      openCreateMarketModal();
      return;
    }

    const verify = event.target.closest('[data-verify-merchant]');
    if (verify) {
      openVerifyModal(verify.dataset.verifyMerchant, verify.dataset.merchantName);
      return;
    }

    const marketDetail = event.target.closest('[data-market-detail]');
    if (marketDetail) {
      openMarketDetail(marketDetail.dataset.marketDetail);
      return;
    }

    const productDetail = event.target.closest('[data-product-detail]');
    if (productDetail) {
      openProductDetail(productDetail.dataset.productDetail);
      return;
    }

    const auditDetail = event.target.closest('[data-audit-detail]');
    if (auditDetail) {
      openAuditDetail(auditDetail.dataset.auditDetail);
      return;
    }

    if (event.target.closest('[data-modal-close]')) {
      closeModal();
    }
  });

  $('#modal-root').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (!$('#modal-root').hidden) {
        closeModal();
      } else if ($('#sidebar').classList.contains('is-open')) {
        closeSidebar();
      }
    }
  });

  window.addEventListener('hashchange', () => setView(getViewFromHash(), false));
  window.addEventListener('resize', () => {
    if (window.innerWidth > 980) closeSidebar();
  });
}

/* -------------------------------- Boot -------------------------------- */

async function bootstrap() {
  const token = getToken();
  if (!token) {
    window.location.replace('/login');
    return;
  }

  bindEvents();

  let profile = null;
  try {
    const result = await api('/auth/me');
    profile = result.data;
    if (!isAdminProfile(profile)) {
      clearSession();
      window.location.replace('/login?forbidden=1');
      return;
    }
    const storage = localStorage.getItem(TOKEN_KEY) ? localStorage : sessionStorage;
    storage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    if (!getToken()) return;
    profile = getCachedProfile();
    if (!profile || !isAdminProfile(profile)) {
      window.location.replace('/login');
      return;
    }
    showToast('Mode terbatas', 'Profil tidak dapat disegarkan. Menampilkan data tersimpan.', 'error');
  }

  if (!profile) {
    clearSession();
    window.location.replace('/login');
    return;
  }

  applyProfile(profile);
  void refreshPendingCount();
  setView(getViewFromHash(), false);
}

void bootstrap();
