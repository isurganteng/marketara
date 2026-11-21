import { randomUUID } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import { env } from '../config';

export const requestLogger: MiddlewareHandler = async (c, next) => {
  const requestId = c.req.header('x-request-id') ?? randomUUID();
  c.header('x-request-id', requestId);
  const startedAt = performance.now();

  try {
    await next();
  } finally {
    const line = {
      level: 'info',
      type: 'request',
      requestId,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Math.round(performance.now() - startedAt),
    };
    if (env.isProduction) {
      console.log(JSON.stringify(line));
    } else {
      console.log(
        `[${line.status}] ${line.method} ${line.path} ${line.durationMs}ms (${requestId})`,
      );
    }
  }
};
