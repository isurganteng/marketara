const RESERVED_SLUGS = new Set(['api', 'admin', 'app', 'auth', 'system', 'www']);

export function slugify(value: string): string {
  const base = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || 'item';
}

/** Slug unik dengan suffix acak agar aman terhadap unique constraint. */
export function uniqueSlug(value: string, prefix?: string): string {
  const base = prefix ? `${prefix}-${slugify(value)}` : slugify(value);
  const safe = RESERVED_SLUGS.has(base) ? `${base}-1` : base;
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${safe.slice(0, 90)}-${suffix}`;
}

/** Contoh: MRC-20261119-4F2A9C */
export function generateCode(prefix: string): string {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${date}-${random}`;
}
