import { Hono } from 'hono';
import type { AppEnv } from '../../lib/app-env';
import { requireAuth } from '../../middleware/auth';
import { businessPerformanceRoutes } from './performance';
import { businessProfileRoutes } from './profiles';

export const businessRoutesIndex = new Hono<AppEnv>();

businessRoutesIndex.use('*', requireAuth);
businessRoutesIndex.route('/', businessPerformanceRoutes);
businessRoutesIndex.route('/', businessProfileRoutes);
