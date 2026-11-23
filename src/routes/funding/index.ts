import { Hono } from 'hono';
import type { AppEnv } from '../../lib/app-env';
import { requireAuth } from '../../middleware/auth';
import { fundingFinancingRoutes } from './financing';
import { fundingMarketplaceRoutes } from './marketplace';
import { fundingProposalRoutes } from './proposals';

export const fundingRoutesIndex = new Hono<AppEnv>();

fundingRoutesIndex.use('*', requireAuth);
fundingRoutesIndex.route('/', fundingProposalRoutes);
fundingRoutesIndex.route('/', fundingMarketplaceRoutes);
fundingRoutesIndex.route('/', fundingFinancingRoutes);
