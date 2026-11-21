import type { ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { env } from '../config';
import { ApiError, errorBody } from '../lib/errors';

interface PgErrorLike {
  code?: string;
  constraint_name?: string;
  detail?: string;
}

function isPgError(error: unknown): error is PgErrorLike {
  return typeof error === 'object' && error !== null && 'code' in error;
}

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof ApiError) {
    return c.json(errorBody(err.code, err.message, err.details), err.status as 400);
  }

  if (err instanceof HTTPException) {
    return c.json(errorBody('HTTP_ERROR', err.message), err.status);
  }

  if (isPgError(err)) {
    if (err.code === '23505') {
      return c.json(
        errorBody('CONFLICT', 'Data already exists', {
          constraint: err.constraint_name,
        }),
        409,
      );
    }
    if (err.code === '23503') {
      return c.json(
        errorBody('CONFLICT', 'Operation violates a related data constraint', {
          constraint: err.constraint_name,
        }),
        409,
      );
    }
    if (err.code === '23514') {
      return c.json(
        errorBody('BAD_REQUEST', 'Operation violates a data check constraint'),
        400,
      );
    }
  }

  console.error('[error]', err);
  return c.json(
    errorBody(
      'INTERNAL_ERROR',
      env.isProduction ? 'Internal server error' : (err instanceof Error ? err.message : 'Unknown error'),
    ),
    500,
  );
};

export const notFoundHandler: NotFoundHandler = (c) =>
  c.json(errorBody('NOT_FOUND', `Route ${c.req.method} ${c.req.path} not found`), 404);
