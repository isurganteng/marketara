CREATE SCHEMA "inventory";
--> statement-breakpoint
CREATE TYPE "inventory"."inventory_batch_status" AS ENUM('active', 'depleted', 'expired', 'quarantined');--> statement-breakpoint
CREATE TYPE "inventory"."inventory_item_status" AS ENUM('active', 'inactive', 'discontinued');--> statement-breakpoint
CREATE TYPE "inventory"."stock_adjustment_type" AS ENUM('increase', 'decrease', 'correction', 'damage', 'loss', 'other');--> statement-breakpoint
CREATE TYPE "inventory"."stock_count_status" AS ENUM('draft', 'counting', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "inventory"."stock_movement_status" AS ENUM('completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "inventory"."stock_movement_type" AS ENUM('inbound', 'outbound', 'transfer', 'adjustment', 'stock_count', 'return');--> statement-breakpoint
CREATE TYPE "inventory"."warehouse_location_status" AS ENUM('active', 'inactive', 'blocked');--> statement-breakpoint
CREATE TYPE "inventory"."warehouse_location_type" AS ENUM('storage', 'receiving', 'picking', 'staging', 'returns', 'quarantine', 'other');--> statement-breakpoint
CREATE TYPE "inventory"."warehouse_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TABLE "inventory"."inventory_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"warehouse_location_id" uuid NOT NULL,
	"batch_number" varchar(100) NOT NULL,
	"manufacture_date" date,
	"expiry_date" date,
	"quantity" numeric(16, 3) DEFAULT '0' NOT NULL,
	"reserved_quantity" numeric(16, 3) DEFAULT '0' NOT NULL,
	"unit_cost" numeric(16, 2) DEFAULT '0' NOT NULL,
	"status" "inventory"."inventory_batch_status" DEFAULT 'active' NOT NULL,
	"supplier_reference" varchar(255),
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory"."inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"sku_id" uuid NOT NULL,
	"status" "inventory"."inventory_item_status" DEFAULT 'active' NOT NULL,
	"min_stock" numeric(16, 3) DEFAULT '0' NOT NULL,
	"max_stock" numeric(16, 3),
	"reorder_point" numeric(16, 3),
	"unit_cost" numeric(16, 2) DEFAULT '0' NOT NULL,
	"track_batches" boolean DEFAULT false NOT NULL,
	"track_expiry" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "inventory"."stock_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"adjustment_number" varchar(32) NOT NULL,
	"merchant_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"warehouse_location_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"type" "inventory"."stock_adjustment_type" NOT NULL,
	"quantity" numeric(16, 3) NOT NULL,
	"before_quantity" numeric(16, 3) NOT NULL,
	"after_quantity" numeric(16, 3) NOT NULL,
	"reason" text NOT NULL,
	"movement_id" uuid,
	"created_by" uuid,
	"approved_by" uuid,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory"."stock_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"warehouse_location_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"quantity" numeric(16, 3) DEFAULT '0' NOT NULL,
	"reserved_quantity" numeric(16, 3) DEFAULT '0' NOT NULL,
	"last_movement_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory"."stock_count_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"count_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"system_quantity" numeric(16, 3) NOT NULL,
	"counted_quantity" numeric(16, 3),
	"difference_quantity" numeric(16, 3),
	"unit_cost" numeric(16, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory"."stock_counts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"count_number" varchar(32) NOT NULL,
	"merchant_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"warehouse_location_id" uuid NOT NULL,
	"status" "inventory"."stock_count_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_by" uuid,
	"completed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory"."stock_movement_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movement_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"batch_id" uuid,
	"quantity" numeric(16, 3) NOT NULL,
	"unit_cost" numeric(16, 2) DEFAULT '0' NOT NULL,
	"total_cost" numeric(16, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory"."stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movement_number" varchar(32) NOT NULL,
	"merchant_id" uuid NOT NULL,
	"type" "inventory"."stock_movement_type" NOT NULL,
	"status" "inventory"."stock_movement_status" DEFAULT 'completed' NOT NULL,
	"source_warehouse_id" uuid,
	"source_location_id" uuid,
	"destination_warehouse_id" uuid,
	"destination_location_id" uuid,
	"reference_type" varchar(64),
	"reference_id" uuid,
	"reference_number" varchar(128),
	"notes" text,
	"total_quantity" numeric(16, 3) DEFAULT '0' NOT NULL,
	"total_cost" numeric(16, 2) DEFAULT '0' NOT NULL,
	"created_by" uuid,
	"completed_by" uuid,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory"."warehouse_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"parent_id" uuid,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "inventory"."warehouse_location_type" DEFAULT 'storage' NOT NULL,
	"status" "inventory"."warehouse_location_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "inventory"."warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"store_id" uuid,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" text,
	"city" varchar(120),
	"province" varchar(120),
	"postal_code" varchar(20),
	"phone" varchar(32),
	"is_default" boolean DEFAULT false NOT NULL,
	"status" "inventory"."warehouse_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "inventory"."inventory_batches" ADD CONSTRAINT "inventory_batches_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."inventory_batches" ADD CONSTRAINT "inventory_batches_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."inventory_batches" ADD CONSTRAINT "inventory_batches_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."inventory_batches" ADD CONSTRAINT "inventory_batches_warehouse_location_id_warehouse_locations_id_fk" FOREIGN KEY ("warehouse_location_id") REFERENCES "inventory"."warehouse_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."inventory_batches" ADD CONSTRAINT "inventory_batches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."inventory_items" ADD CONSTRAINT "inventory_items_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."inventory_items" ADD CONSTRAINT "inventory_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."inventory_items" ADD CONSTRAINT "inventory_items_sku_id_product_skus_id_fk" FOREIGN KEY ("sku_id") REFERENCES "catalog"."product_skus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."inventory_items" ADD CONSTRAINT "inventory_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_adjustments" ADD CONSTRAINT "stock_adjustments_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_adjustments" ADD CONSTRAINT "stock_adjustments_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_adjustments" ADD CONSTRAINT "stock_adjustments_warehouse_location_id_warehouse_locations_id_fk" FOREIGN KEY ("warehouse_location_id") REFERENCES "inventory"."warehouse_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_adjustments" ADD CONSTRAINT "stock_adjustments_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_adjustments" ADD CONSTRAINT "stock_adjustments_movement_id_stock_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "inventory"."stock_movements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_adjustments" ADD CONSTRAINT "stock_adjustments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_adjustments" ADD CONSTRAINT "stock_adjustments_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_balances" ADD CONSTRAINT "stock_balances_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_balances" ADD CONSTRAINT "stock_balances_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_balances" ADD CONSTRAINT "stock_balances_warehouse_location_id_warehouse_locations_id_fk" FOREIGN KEY ("warehouse_location_id") REFERENCES "inventory"."warehouse_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_balances" ADD CONSTRAINT "stock_balances_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_count_items" ADD CONSTRAINT "stock_count_items_count_id_stock_counts_id_fk" FOREIGN KEY ("count_id") REFERENCES "inventory"."stock_counts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_count_items" ADD CONSTRAINT "stock_count_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_counts" ADD CONSTRAINT "stock_counts_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_counts" ADD CONSTRAINT "stock_counts_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_counts" ADD CONSTRAINT "stock_counts_warehouse_location_id_warehouse_locations_id_fk" FOREIGN KEY ("warehouse_location_id") REFERENCES "inventory"."warehouse_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_counts" ADD CONSTRAINT "stock_counts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_counts" ADD CONSTRAINT "stock_counts_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_movement_items" ADD CONSTRAINT "stock_movement_items_movement_id_stock_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "inventory"."stock_movements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_movement_items" ADD CONSTRAINT "stock_movement_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_movement_items" ADD CONSTRAINT "stock_movement_items_batch_id_inventory_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "inventory"."inventory_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_movements" ADD CONSTRAINT "stock_movements_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_movements" ADD CONSTRAINT "stock_movements_source_warehouse_id_warehouses_id_fk" FOREIGN KEY ("source_warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_movements" ADD CONSTRAINT "stock_movements_source_location_id_warehouse_locations_id_fk" FOREIGN KEY ("source_location_id") REFERENCES "inventory"."warehouse_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_movements" ADD CONSTRAINT "stock_movements_destination_warehouse_id_warehouses_id_fk" FOREIGN KEY ("destination_warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_movements" ADD CONSTRAINT "stock_movements_destination_location_id_warehouse_locations_id_fk" FOREIGN KEY ("destination_location_id") REFERENCES "inventory"."warehouse_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_movements" ADD CONSTRAINT "stock_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_movements" ADD CONSTRAINT "stock_movements_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."warehouse_locations" ADD CONSTRAINT "warehouse_locations_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."warehouse_locations" ADD CONSTRAINT "warehouse_locations_parent_id_warehouse_locations_id_fk" FOREIGN KEY ("parent_id") REFERENCES "inventory"."warehouse_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."warehouses" ADD CONSTRAINT "warehouses_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."warehouses" ADD CONSTRAINT "warehouses_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "core"."stores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_batches_item_location_number_uq" ON "inventory"."inventory_batches" USING btree ("inventory_item_id","warehouse_location_id","batch_number");--> statement-breakpoint
CREATE INDEX "inventory_batches_merchant_idx" ON "inventory"."inventory_batches" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "inventory_batches_item_idx" ON "inventory"."inventory_batches" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "inventory_batches_warehouse_idx" ON "inventory"."inventory_batches" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "inventory_batches_expiry_idx" ON "inventory"."inventory_batches" USING btree ("expiry_date");--> statement-breakpoint
CREATE INDEX "inventory_batches_status_idx" ON "inventory"."inventory_batches" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_items_merchant_sku_uq" ON "inventory"."inventory_items" USING btree ("merchant_id","sku_id");--> statement-breakpoint
CREATE INDEX "inventory_items_merchant_idx" ON "inventory"."inventory_items" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "inventory_items_product_idx" ON "inventory"."inventory_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "inventory_items_sku_idx" ON "inventory"."inventory_items" USING btree ("sku_id");--> statement-breakpoint
CREATE INDEX "inventory_items_status_idx" ON "inventory"."inventory_items" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_adjustments_number_uq" ON "inventory"."stock_adjustments" USING btree ("adjustment_number");--> statement-breakpoint
CREATE INDEX "stock_adjustments_merchant_idx" ON "inventory"."stock_adjustments" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "stock_adjustments_warehouse_idx" ON "inventory"."stock_adjustments" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "stock_adjustments_item_idx" ON "inventory"."stock_adjustments" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "stock_adjustments_movement_idx" ON "inventory"."stock_adjustments" USING btree ("movement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_balances_location_item_uq" ON "inventory"."stock_balances" USING btree ("warehouse_location_id","inventory_item_id");--> statement-breakpoint
CREATE INDEX "stock_balances_merchant_idx" ON "inventory"."stock_balances" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "stock_balances_warehouse_idx" ON "inventory"."stock_balances" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "stock_balances_item_idx" ON "inventory"."stock_balances" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_count_items_count_item_uq" ON "inventory"."stock_count_items" USING btree ("count_id","inventory_item_id");--> statement-breakpoint
CREATE INDEX "stock_count_items_count_idx" ON "inventory"."stock_count_items" USING btree ("count_id");--> statement-breakpoint
CREATE INDEX "stock_count_items_item_idx" ON "inventory"."stock_count_items" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_counts_number_uq" ON "inventory"."stock_counts" USING btree ("count_number");--> statement-breakpoint
CREATE INDEX "stock_counts_merchant_idx" ON "inventory"."stock_counts" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "stock_counts_warehouse_idx" ON "inventory"."stock_counts" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "stock_counts_status_idx" ON "inventory"."stock_counts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "stock_counts_started_idx" ON "inventory"."stock_counts" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "stock_movement_items_movement_idx" ON "inventory"."stock_movement_items" USING btree ("movement_id");--> statement-breakpoint
CREATE INDEX "stock_movement_items_item_idx" ON "inventory"."stock_movement_items" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "stock_movement_items_batch_idx" ON "inventory"."stock_movement_items" USING btree ("batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_movements_number_uq" ON "inventory"."stock_movements" USING btree ("movement_number");--> statement-breakpoint
CREATE INDEX "stock_movements_merchant_idx" ON "inventory"."stock_movements" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "stock_movements_type_idx" ON "inventory"."stock_movements" USING btree ("type");--> statement-breakpoint
CREATE INDEX "stock_movements_status_idx" ON "inventory"."stock_movements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "stock_movements_source_warehouse_idx" ON "inventory"."stock_movements" USING btree ("source_warehouse_id");--> statement-breakpoint
CREATE INDEX "stock_movements_destination_warehouse_idx" ON "inventory"."stock_movements" USING btree ("destination_warehouse_id");--> statement-breakpoint
CREATE INDEX "stock_movements_completed_idx" ON "inventory"."stock_movements" USING btree ("completed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouse_locations_warehouse_code_uq" ON "inventory"."warehouse_locations" USING btree ("warehouse_id","code");--> statement-breakpoint
CREATE INDEX "warehouse_locations_warehouse_idx" ON "inventory"."warehouse_locations" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "warehouse_locations_parent_idx" ON "inventory"."warehouse_locations" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "warehouse_locations_status_idx" ON "inventory"."warehouse_locations" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_merchant_code_uq" ON "inventory"."warehouses" USING btree ("merchant_id","code");--> statement-breakpoint
CREATE INDEX "warehouses_merchant_idx" ON "inventory"."warehouses" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "warehouses_store_idx" ON "inventory"."warehouses" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "warehouses_status_idx" ON "inventory"."warehouses" USING btree ("status");