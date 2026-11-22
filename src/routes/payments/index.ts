import { Hono } from 'hono';
import type { AppEnv } from '../../lib/app-env';
import { requireAuth } from '../../middleware/auth';
import { paymentAccountRoutes } from './accounts';
import { paymentProviderRoutes } from './providers';
import { paymentReconciliationRoutes } from './reconciliations';
import { paymentRefundRoutes } from './refunds';
import { paymentSettlementRoutes } from './settlements';
import { paymentRoutes } from './payments';

export const paymentRoutesIndex = new Hono<AppEnv>();

paymentRoutesIndex.use('*', requireAuth);
paymentRoutesIndex.route('/', paymentProviderRoutes);
paymentRoutesIndex.route('/', paymentAccountRoutes);
paymentRoutesIndex.route('/', paymentRefundRoutes);
paymentRoutesIndex.route('/', paymentSettlementRoutes);
paymentRoutesIndex.route('/', paymentReconciliationRoutes);
paymentRoutesIndex.route('/', paymentRoutes);
