import { Hono } from 'hono';
import type { AppEnv } from '../../lib/app-env';
import { requireAuth } from '../../middleware/auth';
import { commerceCartRoutes } from './carts';
import { commerceChannelRoutes } from './channels';
import { commerceStorefrontRoutes } from './storefronts';

export { commerceMarketplaceRoutes } from './public';

export const commerceRoutes = new Hono<AppEnv>();

commerceRoutes.use('*', requireAuth);
commerceRoutes.route('/', commerceChannelRoutes);
commerceRoutes.route('/', commerceStorefrontRoutes);
commerceRoutes.route('/', commerceCartRoutes);
