import { zValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import type { ZodSchema } from 'zod';
import { errorBody } from './errors';

/** zValidator dengan format error konsisten. */
export function validate<T extends ZodSchema, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json(
        errorBody('VALIDATION_ERROR', 'Validation failed', result.error.issues),
        422,
      );
    }
  });
}
