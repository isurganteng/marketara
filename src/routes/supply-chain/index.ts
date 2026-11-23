import { Hono } from 'hono';
import type { AppEnv } from '../../lib/app-env';
import { requireAuth } from '../../middleware/auth';
import { supplyChainCollectiveRoutes } from './collective';
import { supplyChainOutboundRoutes } from './outbound';
import { supplyChainProcurementRoutes } from './procurement';
import { supplyChainPurchaseOrderRoutes } from './purchase-orders';
import { supplyChainReceivingRoutes } from './receiving';
import { supplyChainSupplierRoutes } from './suppliers';
import { supplyChainWarehouseRoutes } from './warehouse';

export const supplyChainRoutesIndex = new Hono<AppEnv>();

supplyChainRoutesIndex.use('*', requireAuth);
supplyChainRoutesIndex.route('/', supplyChainSupplierRoutes);
supplyChainRoutesIndex.route('/', supplyChainProcurementRoutes);
supplyChainRoutesIndex.route('/', supplyChainPurchaseOrderRoutes);
supplyChainRoutesIndex.route('/', supplyChainReceivingRoutes);
supplyChainRoutesIndex.route('/', supplyChainWarehouseRoutes);
supplyChainRoutesIndex.route('/', supplyChainOutboundRoutes);
supplyChainRoutesIndex.route('/', supplyChainCollectiveRoutes);
