import { cors } from 'hono/cors';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { env } from './config';
import { db } from './db';
import type { AppEnv } from './lib/app-env';
import { ok } from './lib/http';
import { errorHandler, notFoundHandler } from './middleware/error';
import { requestLogger } from './middleware/logger';
import { auditRoutes } from './routes/audit';
import { authRoutes } from './routes/auth';
import { catalogRoutes } from './routes/catalog';
import { commerceMarketplaceRoutes, commerceRoutes } from './routes/commerce';
import { inventoryRoutesIndex } from './routes/inventory';
import { marketingRoutesIndex } from './routes/marketing';
import { marketRoutes } from './routes/markets';
import { merchantRoutes } from './routes/merchants';
import { organizationRoutes } from './routes/organizations';
import { paymentRoutesIndex } from './routes/payments';
import { posRoutesIndex } from './routes/pos';
import { referenceRoutes } from './routes/reference';
import { supplyChainRoutesIndex } from './routes/supply-chain';

export const app = new Hono<AppEnv>();

app.use('*', requestLogger);
app.use(
  '*',
  cors({
    origin: env.corsOrigin === '*' ? '*' : env.corsOrigin.split(',').map((item) => item.trim()),
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Session-Token', 'X-Request-ID'],
    exposeHeaders: ['X-Request-ID'],
    credentials: env.corsOrigin !== '*',
    maxAge: 86400,
  }),
);

app.get('/', (c) =>
  ok(c, {
    service: 'marketara-api',
    version: '0.1.0',
    docs: '/api/v1',
    login: '/login',
    admin: '/admin',
    marketplace: '/api/v1/commerce/marketplace/storefronts',
  }),
);

app.get('/health', (c) => ok(c, { status: 'ok', uptime: process.uptime() }));

app.get('/health/ready', async (c) => {
  await db.execute(sql`select 1`);
  return ok(c, { status: 'ready', database: 'connected' });
});

/* ------------------------------ Web UI ------------------------------ */

app.use('/assets/*', serveStatic({ root: './public' }));
app.get('/login', serveStatic({ path: './public/login.html' }));
app.get('/login/', serveStatic({ path: './public/login.html' }));
app.get('/admin', serveStatic({ path: './public/admin/index.html' }));
app.get('/admin/', serveStatic({ path: './public/admin/index.html' }));

app.route('/api/v1/auth', authRoutes);
app.route('/api/v1/organizations', organizationRoutes);
app.route('/api/v1/markets', marketRoutes);
app.route('/api/v1/merchants', merchantRoutes);
app.route('/api/v1/catalog', catalogRoutes);
app.route('/api/v1/commerce/marketplace', commerceMarketplaceRoutes);
app.route('/api/v1/commerce', commerceRoutes);
app.route('/api/v1/payments', paymentRoutesIndex);
app.route('/api/v1/pos', posRoutesIndex);
app.route('/api/v1/inventory', inventoryRoutesIndex);
app.route('/api/v1/supply-chain', supplyChainRoutesIndex);
app.route('/api/v1/marketing', marketingRoutesIndex);
app.route('/api/v1/reference', referenceRoutes);
app.route('/api/v1/audit-logs', auditRoutes);

app.notFound(notFoundHandler);
app.onError(errorHandler);
