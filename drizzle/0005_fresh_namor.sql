CREATE TYPE "commerce"."cash_movement_type" AS ENUM('opening', 'sale', 'refund', 'cash_in', 'cash_out', 'adjustment');--> statement-breakpoint
CREATE TYPE "commerce"."cash_register_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "commerce"."cashier_shift_status" AS ENUM('open', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "commerce"."pos_payment_method" AS ENUM('cash', 'qris', 'debit_card', 'credit_card', 'ewallet', 'bank_transfer', 'other');--> statement-breakpoint
CREATE TYPE "commerce"."pos_sync_direction" AS ENUM('upload', 'download');--> statement-breakpoint
CREATE TYPE "commerce"."pos_sync_log_status" AS ENUM('success', 'failed', 'conflict');--> statement-breakpoint
CREATE TYPE "commerce"."pos_sync_status" AS ENUM('pending', 'synced', 'failed', 'conflict');--> statement-breakpoint
CREATE TYPE "commerce"."pos_terminal_status" AS ENUM('active', 'inactive', 'maintenance');--> statement-breakpoint
CREATE TYPE "commerce"."pos_transaction_status" AS ENUM('completed', 'voided');--> statement-breakpoint
CREATE TABLE "commerce"."cash_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"register_id" uuid NOT NULL,
	"transaction_id" uuid,
	"type" "commerce"."cash_movement_type" NOT NULL,
	"amount" numeric(16, 2) NOT NULL,
	"balance_after" numeric(16, 2),
	"reference_number" varchar(128),
	"note" text,
	"created_by" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commerce"."cash_registers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"terminal_id" uuid,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" "commerce"."cash_register_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "commerce"."cashier_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shift_number" varchar(32) NOT NULL,
	"merchant_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"terminal_id" uuid NOT NULL,
	"register_id" uuid NOT NULL,
	"cashier_id" uuid NOT NULL,
	"status" "commerce"."cashier_shift_status" DEFAULT 'open' NOT NULL,
	"opening_float" numeric(16, 2) DEFAULT '0' NOT NULL,
	"expected_cash" numeric(16, 2) DEFAULT '0' NOT NULL,
	"counted_cash" numeric(16, 2),
	"cash_difference" numeric(16, 2),
	"total_sales" numeric(16, 2) DEFAULT '0' NOT NULL,
	"total_cash_sales" numeric(16, 2) DEFAULT '0' NOT NULL,
	"total_non_cash_sales" numeric(16, 2) DEFAULT '0' NOT NULL,
	"transaction_count" integer DEFAULT 0 NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"opened_by" uuid,
	"closed_by" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commerce"."pos_sync_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"terminal_id" uuid NOT NULL,
	"transaction_id" uuid,
	"direction" "commerce"."pos_sync_direction" DEFAULT 'upload' NOT NULL,
	"status" "commerce"."pos_sync_log_status" NOT NULL,
	"records_count" integer DEFAULT 0 NOT NULL,
	"payload" jsonb,
	"message" text,
	"error_details" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commerce"."pos_terminals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"location" varchar(255),
	"device_identifier" varchar(128),
	"status" "commerce"."pos_terminal_status" DEFAULT 'active' NOT NULL,
	"settings" jsonb,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "commerce"."pos_transaction_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"product_id" uuid,
	"sku_id" uuid,
	"product_name" varchar(255) NOT NULL,
	"sku_code" varchar(100),
	"quantity" integer NOT NULL,
	"unit_price" numeric(16, 2) NOT NULL,
	"discount_amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(16, 2) NOT NULL,
	"notes" text,
	"item_snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commerce"."pos_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_number" varchar(32) NOT NULL,
	"client_transaction_id" varchar(128),
	"merchant_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"terminal_id" uuid NOT NULL,
	"register_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"cashier_id" uuid NOT NULL,
	"status" "commerce"."pos_transaction_status" DEFAULT 'completed' NOT NULL,
	"sync_status" "commerce"."pos_sync_status" DEFAULT 'pending' NOT NULL,
	"payment_method" "commerce"."pos_payment_method" NOT NULL,
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"subtotal" numeric(16, 2) DEFAULT '0' NOT NULL,
	"discount_total" numeric(16, 2) DEFAULT '0' NOT NULL,
	"tax_total" numeric(16, 2) DEFAULT '0' NOT NULL,
	"total" numeric(16, 2) DEFAULT '0' NOT NULL,
	"paid_amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"change_amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"customer_name" varchar(255),
	"customer_phone" varchar(32),
	"notes" text,
	"offline_created_at" timestamp with time zone,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "commerce"."cash_movements" ADD CONSTRAINT "cash_movements_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."cash_movements" ADD CONSTRAINT "cash_movements_shift_id_cashier_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "commerce"."cashier_shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."cash_movements" ADD CONSTRAINT "cash_movements_register_id_cash_registers_id_fk" FOREIGN KEY ("register_id") REFERENCES "commerce"."cash_registers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."cash_movements" ADD CONSTRAINT "cash_movements_transaction_id_pos_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "commerce"."pos_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."cash_movements" ADD CONSTRAINT "cash_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."cash_registers" ADD CONSTRAINT "cash_registers_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."cash_registers" ADD CONSTRAINT "cash_registers_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "core"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."cash_registers" ADD CONSTRAINT "cash_registers_terminal_id_pos_terminals_id_fk" FOREIGN KEY ("terminal_id") REFERENCES "commerce"."pos_terminals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."cashier_shifts" ADD CONSTRAINT "cashier_shifts_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."cashier_shifts" ADD CONSTRAINT "cashier_shifts_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "core"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."cashier_shifts" ADD CONSTRAINT "cashier_shifts_terminal_id_pos_terminals_id_fk" FOREIGN KEY ("terminal_id") REFERENCES "commerce"."pos_terminals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."cashier_shifts" ADD CONSTRAINT "cashier_shifts_register_id_cash_registers_id_fk" FOREIGN KEY ("register_id") REFERENCES "commerce"."cash_registers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."cashier_shifts" ADD CONSTRAINT "cashier_shifts_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "core"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."cashier_shifts" ADD CONSTRAINT "cashier_shifts_opened_by_users_id_fk" FOREIGN KEY ("opened_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."cashier_shifts" ADD CONSTRAINT "cashier_shifts_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."pos_sync_logs" ADD CONSTRAINT "pos_sync_logs_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."pos_sync_logs" ADD CONSTRAINT "pos_sync_logs_terminal_id_pos_terminals_id_fk" FOREIGN KEY ("terminal_id") REFERENCES "commerce"."pos_terminals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."pos_sync_logs" ADD CONSTRAINT "pos_sync_logs_transaction_id_pos_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "commerce"."pos_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."pos_sync_logs" ADD CONSTRAINT "pos_sync_logs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."pos_terminals" ADD CONSTRAINT "pos_terminals_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."pos_terminals" ADD CONSTRAINT "pos_terminals_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "core"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."pos_transaction_items" ADD CONSTRAINT "pos_transaction_items_transaction_id_pos_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "commerce"."pos_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."pos_transaction_items" ADD CONSTRAINT "pos_transaction_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."pos_transaction_items" ADD CONSTRAINT "pos_transaction_items_sku_id_product_skus_id_fk" FOREIGN KEY ("sku_id") REFERENCES "catalog"."product_skus"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."pos_transactions" ADD CONSTRAINT "pos_transactions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."pos_transactions" ADD CONSTRAINT "pos_transactions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "core"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."pos_transactions" ADD CONSTRAINT "pos_transactions_terminal_id_pos_terminals_id_fk" FOREIGN KEY ("terminal_id") REFERENCES "commerce"."pos_terminals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."pos_transactions" ADD CONSTRAINT "pos_transactions_register_id_cash_registers_id_fk" FOREIGN KEY ("register_id") REFERENCES "commerce"."cash_registers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."pos_transactions" ADD CONSTRAINT "pos_transactions_shift_id_cashier_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "commerce"."cashier_shifts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."pos_transactions" ADD CONSTRAINT "pos_transactions_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "core"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cash_movements_shift_idx" ON "commerce"."cash_movements" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "cash_movements_register_idx" ON "commerce"."cash_movements" USING btree ("register_id");--> statement-breakpoint
CREATE INDEX "cash_movements_transaction_idx" ON "commerce"."cash_movements" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "cash_movements_type_idx" ON "commerce"."cash_movements" USING btree ("type");--> statement-breakpoint
CREATE INDEX "cash_movements_occurred_idx" ON "commerce"."cash_movements" USING btree ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_registers_merchant_code_uq" ON "commerce"."cash_registers" USING btree ("merchant_id","code");--> statement-breakpoint
CREATE INDEX "cash_registers_merchant_idx" ON "commerce"."cash_registers" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "cash_registers_store_idx" ON "commerce"."cash_registers" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "cash_registers_terminal_idx" ON "commerce"."cash_registers" USING btree ("terminal_id");--> statement-breakpoint
CREATE INDEX "cash_registers_status_idx" ON "commerce"."cash_registers" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "cashier_shifts_number_uq" ON "commerce"."cashier_shifts" USING btree ("shift_number");--> statement-breakpoint
CREATE UNIQUE INDEX "cashier_shifts_open_register_uq" ON "commerce"."cashier_shifts" USING btree ("register_id") WHERE status = 'open';--> statement-breakpoint
CREATE INDEX "cashier_shifts_merchant_idx" ON "commerce"."cashier_shifts" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "cashier_shifts_terminal_idx" ON "commerce"."cashier_shifts" USING btree ("terminal_id");--> statement-breakpoint
CREATE INDEX "cashier_shifts_register_idx" ON "commerce"."cashier_shifts" USING btree ("register_id");--> statement-breakpoint
CREATE INDEX "cashier_shifts_cashier_idx" ON "commerce"."cashier_shifts" USING btree ("cashier_id");--> statement-breakpoint
CREATE INDEX "cashier_shifts_status_idx" ON "commerce"."cashier_shifts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cashier_shifts_opened_idx" ON "commerce"."cashier_shifts" USING btree ("opened_at");--> statement-breakpoint
CREATE INDEX "pos_sync_logs_merchant_idx" ON "commerce"."pos_sync_logs" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "pos_sync_logs_terminal_idx" ON "commerce"."pos_sync_logs" USING btree ("terminal_id");--> statement-breakpoint
CREATE INDEX "pos_sync_logs_transaction_idx" ON "commerce"."pos_sync_logs" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "pos_sync_logs_status_idx" ON "commerce"."pos_sync_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pos_sync_logs_created_idx" ON "commerce"."pos_sync_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pos_terminals_merchant_code_uq" ON "commerce"."pos_terminals" USING btree ("merchant_id","code");--> statement-breakpoint
CREATE INDEX "pos_terminals_merchant_idx" ON "commerce"."pos_terminals" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "pos_terminals_store_idx" ON "commerce"."pos_terminals" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "pos_terminals_status_idx" ON "commerce"."pos_terminals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pos_transaction_items_transaction_idx" ON "commerce"."pos_transaction_items" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "pos_transaction_items_product_idx" ON "commerce"."pos_transaction_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "pos_transaction_items_sku_idx" ON "commerce"."pos_transaction_items" USING btree ("sku_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pos_transactions_number_uq" ON "commerce"."pos_transactions" USING btree ("transaction_number");--> statement-breakpoint
CREATE UNIQUE INDEX "pos_transactions_client_uq" ON "commerce"."pos_transactions" USING btree ("terminal_id","client_transaction_id") WHERE client_transaction_id is not null;--> statement-breakpoint
CREATE INDEX "pos_transactions_merchant_idx" ON "commerce"."pos_transactions" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "pos_transactions_store_idx" ON "commerce"."pos_transactions" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "pos_transactions_terminal_idx" ON "commerce"."pos_transactions" USING btree ("terminal_id");--> statement-breakpoint
CREATE INDEX "pos_transactions_register_idx" ON "commerce"."pos_transactions" USING btree ("register_id");--> statement-breakpoint
CREATE INDEX "pos_transactions_shift_idx" ON "commerce"."pos_transactions" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "pos_transactions_cashier_idx" ON "commerce"."pos_transactions" USING btree ("cashier_id");--> statement-breakpoint
CREATE INDEX "pos_transactions_status_idx" ON "commerce"."pos_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pos_transactions_sync_idx" ON "commerce"."pos_transactions" USING btree ("sync_status");--> statement-breakpoint
CREATE INDEX "pos_transactions_completed_idx" ON "commerce"."pos_transactions" USING btree ("completed_at");