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
  audit: null,
  pendingCount: 0,
  canWriteCommerce: false,
  canManageCommerce: false,
  sequences: { overview: 0, markets: 0, merchants: 0, products: 0, commerce: 0, orders: 0, audit: 0 },
  filters: {
    markets: { search: '', status: '' },
    merchants: { search: '', status: '' },
    products: { search: '', status: '' },
    commerce: { search: '', status: '' },
    orders: { search: '', status: '' },
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
  state.canWriteCommerce = permissions.includes('*') || permissions.includes('commerce:write');
  state.canManageCommerce = permissions.includes('*') || permissions.includes('commerce:manage');
  const commerceNav = $('[data-view="commerce"]');
  if (commerceNav) commerceNav.hidden = !canCommerce;
  const ordersNav = $('[data-view="orders"]');
  if (ordersNav) ordersNav.hidden = !canCommerce;
  const createChannelButton = $('#create-channel-button');
  if (createChannelButton) createChannelButton.hidden = !state.canManageCommerce;

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
