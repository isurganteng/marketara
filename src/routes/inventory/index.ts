import { Hono } from 'hono';
import type { AppEnv } from '../../lib/app-env';
import { requireAuth } from '../../middleware/auth';
import { inventoryCountRoutes } from './counts';
import { inventoryMovementRoutes } from './movements';
import { inventoryResourceRoutes } from './resources';

export const inventoryRoutesIndex = new Hono<AppEnv>();

inventoryRoutesIndex.use('*', requireAuth);
inventoryRoutesIndex.route('/', inventoryResourceRoutes);
inventoryRoutesIndex.route('/', inventoryMovementRoutes);
inventoryRoutesIndex.route('/', inventoryCountRoutes);
