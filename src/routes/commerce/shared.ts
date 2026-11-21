import { asc, desc, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { productImages } from '../../db/schema';

export const numericString = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine(
    (value) => value.trim() !== '' && !Number.isNaN(Number(value)) && Number(value) >= 0,
    'Harus berupa angka >= 0',
  );

export const currencySchema = z
  .string()
  .trim()
  .length(3)
  .transform((value) => value.toUpperCase());

export interface PrimaryImage {
  url: string;
  altText: string | null;
}

/** Ambil satu gambar utama per produk tanpa query per produk. */
export async function getPrimaryImageMap(
  productIds: string[],
): Promise<Map<string, PrimaryImage>> {
  const map = new Map<string, PrimaryImage>();
  if (productIds.length === 0) return map;

  const rows = await db
    .select({
      productId: productImages.productId,
      url: productImages.url,
      altText: productImages.altText,
      isPrimary: productImages.isPrimary,
      sortOrder: productImages.sortOrder,
      createdAt: productImages.createdAt,
    })
    .from(productImages)
    .where(inArray(productImages.productId, productIds))
    .orderBy(
      desc(productImages.isPrimary),
      asc(productImages.sortOrder),
      asc(productImages.createdAt),
    );

  for (const row of rows) {
    if (!map.has(row.productId)) {
      map.set(row.productId, { url: row.url, altText: row.altText });
    }
  }
  return map;
}

/** Harga efektif storefront: override storefront > harga SKU > harga dasar. */
export function resolvePrice(
  priceOverride: string | null | undefined,
  skuPrice: string | null | undefined,
  basePrice: string,
): string {
  return priceOverride ?? skuPrice ?? basePrice;
}

export function money(value: number): string {
  return value.toFixed(2);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}
