import { Hono } from 'hono';
import type { AppEnv } from '../../lib/app-env';
import { requireAuth } from '../../middleware/auth';
import { catalogCollectionRoutes } from './collections';
import { catalogProductRoutes } from './products';
import { catalogReferenceRoutes } from './reference';

export const catalogRoutes = new Hono<AppEnv>();

catalogRoutes.use('*', requireAuth);
catalogRoutes.route('/', catalogReferenceRoutes);
catalogRoutes.route('/', catalogProductRoutes);
catalogRoutes.route('/', catalogCollectionRoutes);
