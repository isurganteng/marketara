CREATE SCHEMA "supply_chain";
--> statement-breakpoint
CREATE TYPE "supply_chain"."collective_purchase_status" AS ENUM('open', 'closed', 'converted', 'cancelled');--> statement-breakpoint
CREATE TYPE "supply_chain"."dispatch_status" AS ENUM('pending', 'dispatched', 'in_transit', 'delivered', 'failed', 'returned', 'cancelled');--> statement-breakpoint
CREATE TYPE "supply_chain"."goods_receipt_status" AS ENUM('draft', 'received', 'inspected', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "supply_chain"."packing_task_status" AS ENUM('pending', 'packing', 'packed', 'cancelled');--> statement-breakpoint
CREATE TYPE "supply_chain"."picking_task_status" AS ENUM('pending', 'in_progress', 'picked', 'cancelled');--> statement-breakpoint
CREATE TYPE "supply_chain"."procurement_approval_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "supply_chain"."procurement_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "supply_chain"."purchase_order_status" AS ENUM('draft', 'pending_approval', 'approved', 'ordered', 'partially_received', 'received', 'cancelled', 'closed');--> statement-breakpoint
CREATE TYPE "supply_chain"."purchase_requisition_status" AS ENUM('draft', 'submitted', 'approved', 'rejected', 'converted', 'cancelled');--> statement-breakpoint
CREATE TYPE "supply_chain"."putaway_task_status" AS ENUM('pending', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "supply_chain"."supplier_quotation_status" AS ENUM('requested', 'submitted', 'accepted', 'rejected', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "supply_chain"."supplier_status" AS ENUM('active', 'inactive', 'suspended');--> statement-breakpoint
CREATE TYPE "supply_chain"."warehouse_allocation_status" AS ENUM('pending', 'allocated', 'released', 'cancelled');--> statement-breakpoint
CREATE TYPE "supply_chain"."warehouse_receipt_source" AS ENUM('goods_receipt', 'transfer', 'return', 'manual');--> statement-breakpoint
CREATE TYPE "supply_chain"."warehouse_receipt_status" AS ENUM('pending', 'receiving', 'received', 'put_away', 'cancelled');--> statement-breakpoint
CREATE TYPE "supply_chain"."warehouse_return_status" AS ENUM('requested', 'approved', 'received', 'restocked', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TABLE "supply_chain"."collective_purchase_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_number" varchar(32) NOT NULL,
	"merchant_id" uuid NOT NULL,
	"supplier_id" uuid,
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" "supply_chain"."collective_purchase_status" DEFAULT 'open' NOT NULL,
	"target_quantity" numeric(16, 3) DEFAULT '0' NOT NULL,
	"current_quantity" numeric(16, 3) DEFAULT '0' NOT NULL,
	"unit" varchar(32) DEFAULT 'pcs' NOT NULL,
	"target_price" numeric(16, 2) DEFAULT '0' NOT NULL,
	"closes_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_chain"."dispatch_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispatch_number" varchar(32) NOT NULL,
	"merchant_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"packing_task_id" uuid,
	"order_id" uuid,
	"status" "supply_chain"."dispatch_status" DEFAULT 'pending' NOT NULL,
	"courier_name" varchar(255),
	"tracking_number" varchar(128),
	"vehicle_number" varchar(64),
	"recipient_name" varchar(255),
	"dispatched_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_chain"."fulfillment_status_histories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"entity_id" uuid NOT NULL,
	"from_status" varchar(64),
	"to_status" varchar(64) NOT NULL,
	"note" text,
	"changed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_chain"."goods_receipt_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goods_receipt_id" uuid NOT NULL,
	"purchase_order_item_id" uuid,
	"inventory_item_id" uuid,
	"product_id" uuid,
	"sku_id" uuid,
	"description" varchar(500) NOT NULL,
	"quantity_received" numeric(16, 3) DEFAULT '0' NOT NULL,
	"quantity_rejected" numeric(16, 3) DEFAULT '0' NOT NULL,
	"unit_cost" numeric(16, 2) DEFAULT '0' NOT NULL,
	"batch_number" varchar(100),
	"manufacture_date" date,
	"expiry_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_chain"."goods_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_number" varchar(32) NOT NULL,
	"merchant_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"warehouse_location_id" uuid NOT NULL,
	"purchase_order_id" uuid,
	"supplier_id" uuid,
	"stock_movement_id" uuid,
	"status" "supply_chain"."goods_receipt_status" DEFAULT 'draft' NOT NULL,
	"received_by" uuid,
	"received_at" timestamp with time zone,
	"inspected_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_chain"."packing_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_number" varchar(32) NOT NULL,
	"merchant_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"picking_task_id" uuid,
	"order_id" uuid,
	"status" "supply_chain"."packing_task_status" DEFAULT 'pending' NOT NULL,
	"package_count" integer DEFAULT 1 NOT NULL,
	"weight_gram" integer,
	"dimensions" varchar(64),
	"assigned_to" uuid,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_chain"."picking_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"picking_task_id" uuid NOT NULL,
	"allocation_id" uuid,
	"inventory_item_id" uuid NOT NULL,
	"warehouse_location_id" uuid NOT NULL,
	"quantity" numeric(16, 3) NOT NULL,
	"picked_quantity" numeric(16, 3) DEFAULT '0' NOT NULL,
	"batch_number" varchar(100),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_chain"."picking_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_number" varchar(32) NOT NULL,
	"merchant_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"allocation_id" uuid,
	"order_id" uuid,
	"status" "supply_chain"."picking_task_status" DEFAULT 'pending' NOT NULL,
	"assigned_to" uuid,
	"priority" "supply_chain"."procurement_priority" DEFAULT 'normal' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_chain"."procurement_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"entity_id" uuid NOT NULL,
	"step" integer DEFAULT 1 NOT NULL,
	"status" "supply_chain"."procurement_approval_status" DEFAULT 'pending' NOT NULL,
	"requested_by" uuid,
	"decided_by" uuid,
	"notes" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_chain"."purchase_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"requisition_item_id" uuid,
	"inventory_item_id" uuid,
	"product_id" uuid,
	"sku_id" uuid,
	"description" varchar(500) NOT NULL,
	"quantity" numeric(16, 3) NOT NULL,
	"received_quantity" numeric(16, 3) DEFAULT '0' NOT NULL,
	"unit_price" numeric(16, 2) NOT NULL,
	"line_total" numeric(16, 2) NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_chain"."purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" varchar(32) NOT NULL,
	"merchant_id" uuid NOT NULL,
	"warehouse_id" uuid,
	"supplier_id" uuid NOT NULL,
	"requisition_id" uuid,
	"quotation_id" uuid,
	"status" "supply_chain"."purchase_order_status" DEFAULT 'draft' NOT NULL,
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"subtotal" numeric(16, 2) DEFAULT '0' NOT NULL,
	"discount_total" numeric(16, 2) DEFAULT '0' NOT NULL,
	"tax_total" numeric(16, 2) DEFAULT '0' NOT NULL,
	"shipping_total" numeric(16, 2) DEFAULT '0' NOT NULL,
	"grand_total" numeric(16, 2) DEFAULT '0' NOT NULL,
	"payment_term_days" integer DEFAULT 0 NOT NULL,
	"expected_delivery_date" date,
	"ordered_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"notes" text,
	"created_by" uuid,
	"approved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_chain"."purchase_requisition_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requisition_id" uuid NOT NULL,
	"inventory_item_id" uuid,
	"product_id" uuid,
	"sku_id" uuid,
	"description" varchar(500) NOT NULL,
	"quantity" numeric(16, 3) NOT NULL,
	"estimated_unit_price" numeric(16, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_chain"."purchase_requisitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requisition_number" varchar(32) NOT NULL,
	"merchant_id" uuid NOT NULL,
	"warehouse_id" uuid,
	"requested_by" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"status" "supply_chain"."purchase_requisition_status" DEFAULT 'draft' NOT NULL,
	"priority" "supply_chain"."procurement_priority" DEFAULT 'normal' NOT NULL,
	"needed_by" date,
	"notes" text,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_chain"."putaway_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_number" varchar(32) NOT NULL,
	"merchant_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"warehouse_receipt_id" uuid,
	"inventory_item_id" uuid NOT NULL,
	"source_location_id" uuid NOT NULL,
	"destination_location_id" uuid,
	"quantity" numeric(16, 3) NOT NULL,
	"batch_number" varchar(100),
	"status" "supply_chain"."putaway_task_status" DEFAULT 'pending' NOT NULL,
	"assigned_to" uuid,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_chain"."supplier_quotation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_id" uuid NOT NULL,
	"requisition_item_id" uuid,
	"inventory_item_id" uuid,
	"product_id" uuid,
	"sku_id" uuid,
	"description" varchar(500) NOT NULL,
	"quantity" numeric(16, 3) NOT NULL,
	"unit_price" numeric(16, 2) NOT NULL,
	"line_total" numeric(16, 2) NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_chain"."supplier_quotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_number" varchar(32) NOT NULL,
	"requisition_id" uuid,
	"merchant_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"status" "supply_chain"."supplier_quotation_status" DEFAULT 'requested' NOT NULL,
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"subtotal" numeric(16, 2) DEFAULT '0' NOT NULL,
	"discount_total" numeric(16, 2) DEFAULT '0' NOT NULL,
	"tax_total" numeric(16, 2) DEFAULT '0' NOT NULL,
	"shipping_total" numeric(16, 2) DEFAULT '0' NOT NULL,
	"grand_total" numeric(16, 2) DEFAULT '0' NOT NULL,
	"valid_until" date,
	"payment_term_days" integer DEFAULT 0 NOT NULL,
	"delivery_days" integer,
	"notes" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_chain"."suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"legal_name" varchar(255),
	"contact_name" varchar(255),
	"contact_email" varchar(255),
	"contact_phone" varchar(32),
	"address" text,
	"city" varchar(120),
	"province" varchar(120),
	"postal_code" varchar(20),
	"country" varchar(2) DEFAULT 'ID' NOT NULL,
	"tax_number" varchar(64),
	"payment_term_days" integer DEFAULT 0 NOT NULL,
	"status" "supply_chain"."supplier_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "supply_chain"."warehouse_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"allocation_number" varchar(32) NOT NULL,
	"merchant_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"warehouse_location_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"order_id" uuid,
	"order_item_id" uuid,
	"quantity" numeric(16, 3) NOT NULL,
	"status" "supply_chain"."warehouse_allocation_status" DEFAULT 'pending' NOT NULL,
	"allocated_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_chain"."warehouse_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_number" varchar(32) NOT NULL,
	"merchant_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"warehouse_location_id" uuid NOT NULL,
	"goods_receipt_id" uuid,
	"purchase_order_id" uuid,
	"stock_movement_id" uuid,
	"source" "supply_chain"."warehouse_receipt_source" DEFAULT 'manual' NOT NULL,
	"status" "supply_chain"."warehouse_receipt_status" DEFAULT 'pending' NOT NULL,
	"expected_quantity" numeric(16, 3) DEFAULT '0' NOT NULL,
	"received_quantity" numeric(16, 3) DEFAULT '0' NOT NULL,
	"received_by" uuid,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_chain"."warehouse_returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_number" varchar(32) NOT NULL,
	"merchant_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"warehouse_location_id" uuid NOT NULL,
	"order_id" uuid,
	"order_return_id" uuid,
	"inventory_item_id" uuid,
	"stock_movement_id" uuid,
	"status" "supply_chain"."warehouse_return_status" DEFAULT 'requested' NOT NULL,
	"reason" text NOT NULL,
	"quantity" numeric(16, 3) DEFAULT '0' NOT NULL,
	"requested_by" uuid,
	"approved_by" uuid,
	"received_at" timestamp with time zone,
	"restocked_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "supply_chain"."collective_purchase_groups" ADD CONSTRAINT "collective_purchase_groups_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."collective_purchase_groups" ADD CONSTRAINT "collective_purchase_groups_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "supply_chain"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."dispatch_records" ADD CONSTRAINT "dispatch_records_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."dispatch_records" ADD CONSTRAINT "dispatch_records_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."dispatch_records" ADD CONSTRAINT "dispatch_records_packing_task_id_packing_tasks_id_fk" FOREIGN KEY ("packing_task_id") REFERENCES "supply_chain"."packing_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."dispatch_records" ADD CONSTRAINT "dispatch_records_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "commerce"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."dispatch_records" ADD CONSTRAINT "dispatch_records_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."fulfillment_status_histories" ADD CONSTRAINT "fulfillment_status_histories_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."fulfillment_status_histories" ADD CONSTRAINT "fulfillment_status_histories_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_goods_receipt_id_goods_receipts_id_fk" FOREIGN KEY ("goods_receipt_id") REFERENCES "supply_chain"."goods_receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_purchase_order_item_id_purchase_order_items_id_fk" FOREIGN KEY ("purchase_order_item_id") REFERENCES "supply_chain"."purchase_order_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory"."inventory_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_sku_id_product_skus_id_fk" FOREIGN KEY ("sku_id") REFERENCES "catalog"."product_skus"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."goods_receipts" ADD CONSTRAINT "goods_receipts_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."goods_receipts" ADD CONSTRAINT "goods_receipts_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."goods_receipts" ADD CONSTRAINT "goods_receipts_warehouse_location_id_warehouse_locations_id_fk" FOREIGN KEY ("warehouse_location_id") REFERENCES "inventory"."warehouse_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."goods_receipts" ADD CONSTRAINT "goods_receipts_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "supply_chain"."purchase_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."goods_receipts" ADD CONSTRAINT "goods_receipts_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "supply_chain"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."goods_receipts" ADD CONSTRAINT "goods_receipts_stock_movement_id_stock_movements_id_fk" FOREIGN KEY ("stock_movement_id") REFERENCES "inventory"."stock_movements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."goods_receipts" ADD CONSTRAINT "goods_receipts_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."packing_tasks" ADD CONSTRAINT "packing_tasks_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."packing_tasks" ADD CONSTRAINT "packing_tasks_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."packing_tasks" ADD CONSTRAINT "packing_tasks_picking_task_id_picking_tasks_id_fk" FOREIGN KEY ("picking_task_id") REFERENCES "supply_chain"."picking_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."packing_tasks" ADD CONSTRAINT "packing_tasks_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "commerce"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."packing_tasks" ADD CONSTRAINT "packing_tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."packing_tasks" ADD CONSTRAINT "packing_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."picking_items" ADD CONSTRAINT "picking_items_picking_task_id_picking_tasks_id_fk" FOREIGN KEY ("picking_task_id") REFERENCES "supply_chain"."picking_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."picking_items" ADD CONSTRAINT "picking_items_allocation_id_warehouse_allocations_id_fk" FOREIGN KEY ("allocation_id") REFERENCES "supply_chain"."warehouse_allocations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."picking_items" ADD CONSTRAINT "picking_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."picking_items" ADD CONSTRAINT "picking_items_warehouse_location_id_warehouse_locations_id_fk" FOREIGN KEY ("warehouse_location_id") REFERENCES "inventory"."warehouse_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."picking_tasks" ADD CONSTRAINT "picking_tasks_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."picking_tasks" ADD CONSTRAINT "picking_tasks_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."picking_tasks" ADD CONSTRAINT "picking_tasks_allocation_id_warehouse_allocations_id_fk" FOREIGN KEY ("allocation_id") REFERENCES "supply_chain"."warehouse_allocations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."picking_tasks" ADD CONSTRAINT "picking_tasks_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "commerce"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."picking_tasks" ADD CONSTRAINT "picking_tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."picking_tasks" ADD CONSTRAINT "picking_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."procurement_approvals" ADD CONSTRAINT "procurement_approvals_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."procurement_approvals" ADD CONSTRAINT "procurement_approvals_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."procurement_approvals" ADD CONSTRAINT "procurement_approvals_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "supply_chain"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_requisition_item_id_purchase_requisition_items_id_fk" FOREIGN KEY ("requisition_item_id") REFERENCES "supply_chain"."purchase_requisition_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory"."inventory_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_sku_id_product_skus_id_fk" FOREIGN KEY ("sku_id") REFERENCES "catalog"."product_skus"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."purchase_orders" ADD CONSTRAINT "purchase_orders_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."purchase_orders" ADD CONSTRAINT "purchase_orders_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "supply_chain"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."purchase_orders" ADD CONSTRAINT "purchase_orders_requisition_id_purchase_requisitions_id_fk" FOREIGN KEY ("requisition_id") REFERENCES "supply_chain"."purchase_requisitions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."purchase_orders" ADD CONSTRAINT "purchase_orders_quotation_id_supplier_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "supply_chain"."supplier_quotations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."purchase_orders" ADD CONSTRAINT "purchase_orders_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."purchase_requisition_items" ADD CONSTRAINT "purchase_requisition_items_requisition_id_purchase_requisitions_id_fk" FOREIGN KEY ("requisition_id") REFERENCES "supply_chain"."purchase_requisitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."purchase_requisition_items" ADD CONSTRAINT "purchase_requisition_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory"."inventory_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."purchase_requisition_items" ADD CONSTRAINT "purchase_requisition_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."purchase_requisition_items" ADD CONSTRAINT "purchase_requisition_items_sku_id_product_skus_id_fk" FOREIGN KEY ("sku_id") REFERENCES "catalog"."product_skus"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "core"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."putaway_tasks" ADD CONSTRAINT "putaway_tasks_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."putaway_tasks" ADD CONSTRAINT "putaway_tasks_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."putaway_tasks" ADD CONSTRAINT "putaway_tasks_warehouse_receipt_id_warehouse_receipts_id_fk" FOREIGN KEY ("warehouse_receipt_id") REFERENCES "supply_chain"."warehouse_receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."putaway_tasks" ADD CONSTRAINT "putaway_tasks_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."putaway_tasks" ADD CONSTRAINT "putaway_tasks_source_location_id_warehouse_locations_id_fk" FOREIGN KEY ("source_location_id") REFERENCES "inventory"."warehouse_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."putaway_tasks" ADD CONSTRAINT "putaway_tasks_destination_location_id_warehouse_locations_id_fk" FOREIGN KEY ("destination_location_id") REFERENCES "inventory"."warehouse_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."putaway_tasks" ADD CONSTRAINT "putaway_tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."putaway_tasks" ADD CONSTRAINT "putaway_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."supplier_quotation_items" ADD CONSTRAINT "supplier_quotation_items_quotation_id_supplier_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "supply_chain"."supplier_quotations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."supplier_quotation_items" ADD CONSTRAINT "supplier_quotation_items_requisition_item_id_purchase_requisition_items_id_fk" FOREIGN KEY ("requisition_item_id") REFERENCES "supply_chain"."purchase_requisition_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."supplier_quotation_items" ADD CONSTRAINT "supplier_quotation_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory"."inventory_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."supplier_quotation_items" ADD CONSTRAINT "supplier_quotation_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."supplier_quotation_items" ADD CONSTRAINT "supplier_quotation_items_sku_id_product_skus_id_fk" FOREIGN KEY ("sku_id") REFERENCES "catalog"."product_skus"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."supplier_quotations" ADD CONSTRAINT "supplier_quotations_requisition_id_purchase_requisitions_id_fk" FOREIGN KEY ("requisition_id") REFERENCES "supply_chain"."purchase_requisitions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."supplier_quotations" ADD CONSTRAINT "supplier_quotations_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."supplier_quotations" ADD CONSTRAINT "supplier_quotations_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "supply_chain"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."suppliers" ADD CONSTRAINT "suppliers_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."suppliers" ADD CONSTRAINT "suppliers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."warehouse_allocations" ADD CONSTRAINT "warehouse_allocations_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."warehouse_allocations" ADD CONSTRAINT "warehouse_allocations_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."warehouse_allocations" ADD CONSTRAINT "warehouse_allocations_warehouse_location_id_warehouse_locations_id_fk" FOREIGN KEY ("warehouse_location_id") REFERENCES "inventory"."warehouse_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."warehouse_allocations" ADD CONSTRAINT "warehouse_allocations_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."warehouse_allocations" ADD CONSTRAINT "warehouse_allocations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "commerce"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."warehouse_allocations" ADD CONSTRAINT "warehouse_allocations_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "commerce"."order_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."warehouse_allocations" ADD CONSTRAINT "warehouse_allocations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."warehouse_receipts" ADD CONSTRAINT "warehouse_receipts_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."warehouse_receipts" ADD CONSTRAINT "warehouse_receipts_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."warehouse_receipts" ADD CONSTRAINT "warehouse_receipts_warehouse_location_id_warehouse_locations_id_fk" FOREIGN KEY ("warehouse_location_id") REFERENCES "inventory"."warehouse_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."warehouse_receipts" ADD CONSTRAINT "warehouse_receipts_goods_receipt_id_goods_receipts_id_fk" FOREIGN KEY ("goods_receipt_id") REFERENCES "supply_chain"."goods_receipts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."warehouse_receipts" ADD CONSTRAINT "warehouse_receipts_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "supply_chain"."purchase_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."warehouse_receipts" ADD CONSTRAINT "warehouse_receipts_stock_movement_id_stock_movements_id_fk" FOREIGN KEY ("stock_movement_id") REFERENCES "inventory"."stock_movements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."warehouse_receipts" ADD CONSTRAINT "warehouse_receipts_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."warehouse_returns" ADD CONSTRAINT "warehouse_returns_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."warehouse_returns" ADD CONSTRAINT "warehouse_returns_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."warehouse_returns" ADD CONSTRAINT "warehouse_returns_warehouse_location_id_warehouse_locations_id_fk" FOREIGN KEY ("warehouse_location_id") REFERENCES "inventory"."warehouse_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."warehouse_returns" ADD CONSTRAINT "warehouse_returns_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "commerce"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."warehouse_returns" ADD CONSTRAINT "warehouse_returns_order_return_id_returns_id_fk" FOREIGN KEY ("order_return_id") REFERENCES "commerce"."returns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."warehouse_returns" ADD CONSTRAINT "warehouse_returns_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory"."inventory_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."warehouse_returns" ADD CONSTRAINT "warehouse_returns_stock_movement_id_stock_movements_id_fk" FOREIGN KEY ("stock_movement_id") REFERENCES "inventory"."stock_movements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."warehouse_returns" ADD CONSTRAINT "warehouse_returns_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain"."warehouse_returns" ADD CONSTRAINT "warehouse_returns_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "collective_purchase_groups_number_uq" ON "supply_chain"."collective_purchase_groups" USING btree ("group_number");--> statement-breakpoint
CREATE INDEX "collective_purchase_groups_merchant_idx" ON "supply_chain"."collective_purchase_groups" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "collective_purchase_groups_supplier_idx" ON "supply_chain"."collective_purchase_groups" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "collective_purchase_groups_status_idx" ON "supply_chain"."collective_purchase_groups" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "dispatch_records_number_uq" ON "supply_chain"."dispatch_records" USING btree ("dispatch_number");--> statement-breakpoint
CREATE INDEX "dispatch_records_merchant_idx" ON "supply_chain"."dispatch_records" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "dispatch_records_warehouse_idx" ON "supply_chain"."dispatch_records" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "dispatch_records_packing_idx" ON "supply_chain"."dispatch_records" USING btree ("packing_task_id");--> statement-breakpoint
CREATE INDEX "dispatch_records_order_idx" ON "supply_chain"."dispatch_records" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "dispatch_records_status_idx" ON "supply_chain"."dispatch_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fulfillment_status_histories_merchant_idx" ON "supply_chain"."fulfillment_status_histories" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "fulfillment_status_histories_entity_idx" ON "supply_chain"."fulfillment_status_histories" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "fulfillment_status_histories_created_idx" ON "supply_chain"."fulfillment_status_histories" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "goods_receipt_items_receipt_idx" ON "supply_chain"."goods_receipt_items" USING btree ("goods_receipt_id");--> statement-breakpoint
CREATE INDEX "goods_receipt_items_order_item_idx" ON "supply_chain"."goods_receipt_items" USING btree ("purchase_order_item_id");--> statement-breakpoint
CREATE INDEX "goods_receipt_items_inventory_item_idx" ON "supply_chain"."goods_receipt_items" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "goods_receipts_number_uq" ON "supply_chain"."goods_receipts" USING btree ("receipt_number");--> statement-breakpoint
CREATE INDEX "goods_receipts_merchant_idx" ON "supply_chain"."goods_receipts" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "goods_receipts_warehouse_idx" ON "supply_chain"."goods_receipts" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "goods_receipts_purchase_order_idx" ON "supply_chain"."goods_receipts" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "goods_receipts_status_idx" ON "supply_chain"."goods_receipts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "packing_tasks_number_uq" ON "supply_chain"."packing_tasks" USING btree ("task_number");--> statement-breakpoint
CREATE INDEX "packing_tasks_merchant_idx" ON "supply_chain"."packing_tasks" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "packing_tasks_warehouse_idx" ON "supply_chain"."packing_tasks" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "packing_tasks_picking_idx" ON "supply_chain"."packing_tasks" USING btree ("picking_task_id");--> statement-breakpoint
CREATE INDEX "packing_tasks_order_idx" ON "supply_chain"."packing_tasks" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "packing_tasks_status_idx" ON "supply_chain"."packing_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "picking_items_task_idx" ON "supply_chain"."picking_items" USING btree ("picking_task_id");--> statement-breakpoint
CREATE INDEX "picking_items_allocation_idx" ON "supply_chain"."picking_items" USING btree ("allocation_id");--> statement-breakpoint
CREATE INDEX "picking_items_item_idx" ON "supply_chain"."picking_items" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "picking_tasks_number_uq" ON "supply_chain"."picking_tasks" USING btree ("task_number");--> statement-breakpoint
CREATE INDEX "picking_tasks_merchant_idx" ON "supply_chain"."picking_tasks" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "picking_tasks_warehouse_idx" ON "supply_chain"."picking_tasks" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "picking_tasks_allocation_idx" ON "supply_chain"."picking_tasks" USING btree ("allocation_id");--> statement-breakpoint
CREATE INDEX "picking_tasks_order_idx" ON "supply_chain"."picking_tasks" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "picking_tasks_status_idx" ON "supply_chain"."picking_tasks" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "procurement_approvals_entity_step_uq" ON "supply_chain"."procurement_approvals" USING btree ("entity_type","entity_id","step");--> statement-breakpoint
CREATE INDEX "procurement_approvals_merchant_idx" ON "supply_chain"."procurement_approvals" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "procurement_approvals_status_idx" ON "supply_chain"."procurement_approvals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "procurement_approvals_entity_idx" ON "supply_chain"."procurement_approvals" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "purchase_order_items_order_idx" ON "supply_chain"."purchase_order_items" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "purchase_order_items_requisition_item_idx" ON "supply_chain"."purchase_order_items" USING btree ("requisition_item_id");--> statement-breakpoint
CREATE INDEX "purchase_order_items_inventory_item_idx" ON "supply_chain"."purchase_order_items" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_orders_number_uq" ON "supply_chain"."purchase_orders" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "purchase_orders_merchant_idx" ON "supply_chain"."purchase_orders" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_supplier_idx" ON "supply_chain"."purchase_orders" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_requisition_idx" ON "supply_chain"."purchase_orders" USING btree ("requisition_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_quotation_idx" ON "supply_chain"."purchase_orders" USING btree ("quotation_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_status_idx" ON "supply_chain"."purchase_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "purchase_orders_created_idx" ON "supply_chain"."purchase_orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "purchase_requisition_items_requisition_idx" ON "supply_chain"."purchase_requisition_items" USING btree ("requisition_id");--> statement-breakpoint
CREATE INDEX "purchase_requisition_items_inventory_item_idx" ON "supply_chain"."purchase_requisition_items" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_requisitions_number_uq" ON "supply_chain"."purchase_requisitions" USING btree ("requisition_number");--> statement-breakpoint
CREATE INDEX "purchase_requisitions_merchant_idx" ON "supply_chain"."purchase_requisitions" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "purchase_requisitions_warehouse_idx" ON "supply_chain"."purchase_requisitions" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "purchase_requisitions_status_idx" ON "supply_chain"."purchase_requisitions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "purchase_requisitions_requested_idx" ON "supply_chain"."purchase_requisitions" USING btree ("requested_by");--> statement-breakpoint
CREATE INDEX "purchase_requisitions_created_idx" ON "supply_chain"."purchase_requisitions" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "putaway_tasks_number_uq" ON "supply_chain"."putaway_tasks" USING btree ("task_number");--> statement-breakpoint
CREATE INDEX "putaway_tasks_merchant_idx" ON "supply_chain"."putaway_tasks" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "putaway_tasks_warehouse_idx" ON "supply_chain"."putaway_tasks" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "putaway_tasks_receipt_idx" ON "supply_chain"."putaway_tasks" USING btree ("warehouse_receipt_id");--> statement-breakpoint
CREATE INDEX "putaway_tasks_status_idx" ON "supply_chain"."putaway_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "putaway_tasks_item_idx" ON "supply_chain"."putaway_tasks" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "supplier_quotation_items_quotation_idx" ON "supply_chain"."supplier_quotation_items" USING btree ("quotation_id");--> statement-breakpoint
CREATE INDEX "supplier_quotation_items_requisition_item_idx" ON "supply_chain"."supplier_quotation_items" USING btree ("requisition_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_quotations_number_uq" ON "supply_chain"."supplier_quotations" USING btree ("quotation_number");--> statement-breakpoint
CREATE INDEX "supplier_quotations_requisition_idx" ON "supply_chain"."supplier_quotations" USING btree ("requisition_id");--> statement-breakpoint
CREATE INDEX "supplier_quotations_merchant_idx" ON "supply_chain"."supplier_quotations" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "supplier_quotations_supplier_idx" ON "supply_chain"."supplier_quotations" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_quotations_status_idx" ON "supply_chain"."supplier_quotations" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_merchant_code_uq" ON "supply_chain"."suppliers" USING btree ("merchant_id","code");--> statement-breakpoint
CREATE INDEX "suppliers_merchant_idx" ON "supply_chain"."suppliers" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "suppliers_name_idx" ON "supply_chain"."suppliers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "suppliers_status_idx" ON "supply_chain"."suppliers" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouse_allocations_number_uq" ON "supply_chain"."warehouse_allocations" USING btree ("allocation_number");--> statement-breakpoint
CREATE INDEX "warehouse_allocations_merchant_idx" ON "supply_chain"."warehouse_allocations" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "warehouse_allocations_warehouse_idx" ON "supply_chain"."warehouse_allocations" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "warehouse_allocations_item_idx" ON "supply_chain"."warehouse_allocations" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "warehouse_allocations_order_idx" ON "supply_chain"."warehouse_allocations" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "warehouse_allocations_status_idx" ON "supply_chain"."warehouse_allocations" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouse_receipts_number_uq" ON "supply_chain"."warehouse_receipts" USING btree ("receipt_number");--> statement-breakpoint
CREATE INDEX "warehouse_receipts_merchant_idx" ON "supply_chain"."warehouse_receipts" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "warehouse_receipts_warehouse_idx" ON "supply_chain"."warehouse_receipts" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "warehouse_receipts_goods_receipt_idx" ON "supply_chain"."warehouse_receipts" USING btree ("goods_receipt_id");--> statement-breakpoint
CREATE INDEX "warehouse_receipts_status_idx" ON "supply_chain"."warehouse_receipts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouse_returns_number_uq" ON "supply_chain"."warehouse_returns" USING btree ("return_number");--> statement-breakpoint
CREATE INDEX "warehouse_returns_merchant_idx" ON "supply_chain"."warehouse_returns" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "warehouse_returns_warehouse_idx" ON "supply_chain"."warehouse_returns" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "warehouse_returns_order_idx" ON "supply_chain"."warehouse_returns" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "warehouse_returns_status_idx" ON "supply_chain"."warehouse_returns" USING btree ("status");