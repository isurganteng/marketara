import { Hono } from 'hono';
import type { AppEnv } from '../../lib/app-env';
import { requireAuth } from '../../middleware/auth';
import { posResourceRoutes } from './resources';
import { posShiftRoutes } from './shifts';
import { posTransactionRoutes } from './transactions';

export const posRoutesIndex = new Hono<AppEnv>();

posRoutesIndex.use('*', requireAuth);
posRoutesIndex.route('/', posResourceRoutes);
posRoutesIndex.route('/', posShiftRoutes);
posRoutesIndex.route('/', posTransactionRoutes);
