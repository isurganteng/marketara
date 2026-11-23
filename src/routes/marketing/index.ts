import { Hono } from 'hono';
import type { AppEnv } from '../../lib/app-env';
import { requireAuth } from '../../middleware/auth';
import { marketingCampaignRoutes } from './campaigns';
import { marketingCustomerRoutes } from './customers';
import { marketingEngagementRoutes } from './engagement';
import { marketingLoyaltyRoutes } from './loyalty';
import { marketingPromotionRoutes } from './promotions';

export const marketingRoutesIndex = new Hono<AppEnv>();

marketingRoutesIndex.use('*', requireAuth);
marketingRoutesIndex.route('/', marketingCampaignRoutes);
marketingRoutesIndex.route('/', marketingPromotionRoutes);
marketingRoutesIndex.route('/', marketingCustomerRoutes);
marketingRoutesIndex.route('/', marketingLoyaltyRoutes);
marketingRoutesIndex.route('/', marketingEngagementRoutes);
