import type { Context } from 'hono';
import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export interface Pagination {
  page: number;
  limit: number;
  offset: number;
}

export function getPagination(query: { page: number; limit: number }): Pagination {
  return {
    page: query.page,
    limit: query.limit,
    offset: (query.page - 1) * query.limit,
  };
}

export function paginationMeta(total: number, pagination: Pagination) {
  return {
    page: pagination.page,
    limit: pagination.limit,
    total,
    totalPages: Math.ceil(total / pagination.limit),
  };
}

export function ok<T>(c: Context, data: T, status: 200 | 201 = 200) {
  return c.json({ success: true as const, data }, status);
}

export function paginated<T>(
  c: Context,
  data: T[],
  total: number,
  pagination: Pagination,
) {
  return c.json({
    success: true as const,
    data,
    meta: paginationMeta(total, pagination),
  });
}
