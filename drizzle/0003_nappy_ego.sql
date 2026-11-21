CREATE TYPE "commerce"."order_address_type" AS ENUM('shipping', 'billing');--> statement-breakpoint
CREATE TYPE "commerce"."order_note_visibility" AS ENUM('internal', 'customer');--> statement-breakpoint
CREATE TYPE "commerce"."order_status" AS ENUM('pending', 'confirmed', 'processing', 'completed', 'cancelled', 'returned');--> statement-breakpoint
CREATE TYPE "commerce"."return_item_condition" AS ENUM('unopened', 'opened', 'damaged', 'defective', 'other');--> statement-breakpoint
CREATE TYPE "commerce"."return_status" AS ENUM('requested', 'approved', 'rejected', 'received', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "commerce"."sales_transaction_type" AS ENUM('sale', 'cancellation', 'return');--> statement-breakpoint
CREATE TABLE "commerce"."order_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"type" "commerce"."order_address_type" DEFAULT 'shipping' NOT NULL,
	"recipient_name" varchar(255) NOT NULL,
	"phone" varchar(32) NOT NULL,
	"address_line1" text NOT NULL,
	"address_line2" text,
	"city" varchar(128) NOT NULL,
	"province" varchar(128) NOT NULL,
	"postal_code" varchar(16),
	"country" varchar(2) DEFAULT 'ID' NOT NULL,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commerce"."order_cancellations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"notes" text,
	"cancelled_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commerce"."order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid,
	"sku_id" uuid,
	"storefront_product_id" uuid,
	"storefront_id" uuid,
	"product_name" varchar(255) NOT NULL,
	"product_slug" varchar(255),
	"sku_code" varchar(100),
	"quantity" integer NOT NULL,
	"unit_price" numeric(16, 2) NOT NULL,
	"line_total" numeric(16, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"item_snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commerce"."order_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"author_user_id" uuid,
	"visibility" "commerce"."order_note_visibility" DEFAULT 'internal' NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commerce"."order_status_histories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"from_status" "commerce"."order_status",
	"to_status" "commerce"."order_status" NOT NULL,
	"note" text,
	"changed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commerce"."orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" varchar(32) NOT NULL,
	"checkout_session_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"storefront_id" uuid,
	"sales_channel_id" uuid,
	"user_id" uuid NOT NULL,
	"status" "commerce"."order_status" DEFAULT 'pending' NOT NULL,
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"subtotal" numeric(16, 2) DEFAULT '0' NOT NULL,
	"discount_total" numeric(16, 2) DEFAULT '0' NOT NULL,
	"shipping_total" numeric(16, 2) DEFAULT '0' NOT NULL,
	"grand_total" numeric(16, 2) DEFAULT '0' NOT NULL,
	"contact_name" varchar(255),
	"contact_phone" varchar(32),
	"contact_email" varchar(255),
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"processing_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"returned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commerce"."return_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(16, 2) NOT NULL,
	"line_total" numeric(16, 2) NOT NULL,
	"condition" "commerce"."return_item_condition" DEFAULT 'other' NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commerce"."returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_number" varchar(32) NOT NULL,
	"order_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "commerce"."return_status" DEFAULT 'requested' NOT NULL,
	"reason" text NOT NULL,
	"resolution_note" text,
	"requested_by" uuid,
	"reviewed_by" uuid,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commerce"."sales_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_number" varchar(32) NOT NULL,
	"order_id" uuid NOT NULL,
	"return_id" uuid,
	"merchant_id" uuid NOT NULL,
	"type" "commerce"."sales_transaction_type" NOT NULL,
	"amount" numeric(16, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"description" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "commerce"."order_addresses" ADD CONSTRAINT "order_addresses_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "commerce"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."order_cancellations" ADD CONSTRAINT "order_cancellations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "commerce"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."order_cancellations" ADD CONSTRAINT "order_cancellations_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "commerce"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."order_items" ADD CONSTRAINT "order_items_sku_id_product_skus_id_fk" FOREIGN KEY ("sku_id") REFERENCES "catalog"."product_skus"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."order_items" ADD CONSTRAINT "order_items_storefront_product_id_storefront_products_id_fk" FOREIGN KEY ("storefront_product_id") REFERENCES "commerce"."storefront_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."order_items" ADD CONSTRAINT "order_items_storefront_id_storefronts_id_fk" FOREIGN KEY ("storefront_id") REFERENCES "commerce"."storefronts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."order_notes" ADD CONSTRAINT "order_notes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "commerce"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."order_notes" ADD CONSTRAINT "order_notes_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."order_status_histories" ADD CONSTRAINT "order_status_histories_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "commerce"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."order_status_histories" ADD CONSTRAINT "order_status_histories_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."orders" ADD CONSTRAINT "orders_checkout_session_id_checkout_sessions_id_fk" FOREIGN KEY ("checkout_session_id") REFERENCES "commerce"."checkout_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."orders" ADD CONSTRAINT "orders_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."orders" ADD CONSTRAINT "orders_storefront_id_storefronts_id_fk" FOREIGN KEY ("storefront_id") REFERENCES "commerce"."storefronts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."orders" ADD CONSTRAINT "orders_sales_channel_id_sales_channels_id_fk" FOREIGN KEY ("sales_channel_id") REFERENCES "commerce"."sales_channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."return_items" ADD CONSTRAINT "return_items_return_id_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "commerce"."returns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."return_items" ADD CONSTRAINT "return_items_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "commerce"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."returns" ADD CONSTRAINT "returns_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "commerce"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."returns" ADD CONSTRAINT "returns_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."returns" ADD CONSTRAINT "returns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."returns" ADD CONSTRAINT "returns_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."returns" ADD CONSTRAINT "returns_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."sales_transactions" ADD CONSTRAINT "sales_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "commerce"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."sales_transactions" ADD CONSTRAINT "sales_transactions_return_id_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "commerce"."returns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."sales_transactions" ADD CONSTRAINT "sales_transactions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."sales_transactions" ADD CONSTRAINT "sales_transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_addresses_order_idx" ON "commerce"."order_addresses" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_addresses_order_type_uq" ON "commerce"."order_addresses" USING btree ("order_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "order_cancellations_order_uq" ON "commerce"."order_cancellations" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_cancellations_created_idx" ON "commerce"."order_cancellations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "commerce"."order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_product_idx" ON "commerce"."order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "order_items_sku_idx" ON "commerce"."order_items" USING btree ("sku_id");--> statement-breakpoint
CREATE INDEX "order_notes_order_idx" ON "commerce"."order_notes" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_notes_created_idx" ON "commerce"."order_notes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "order_status_histories_order_idx" ON "commerce"."order_status_histories" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_status_histories_created_idx" ON "commerce"."order_status_histories" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_number_uq" ON "commerce"."orders" USING btree ("order_number");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_checkout_merchant_uq" ON "commerce"."orders" USING btree ("checkout_session_id","merchant_id");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "commerce"."orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orders_merchant_idx" ON "commerce"."orders" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "orders_storefront_idx" ON "commerce"."orders" USING btree ("storefront_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "commerce"."orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_placed_idx" ON "commerce"."orders" USING btree ("placed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "return_items_return_order_item_uq" ON "commerce"."return_items" USING btree ("return_id","order_item_id");--> statement-breakpoint
CREATE INDEX "return_items_return_idx" ON "commerce"."return_items" USING btree ("return_id");--> statement-breakpoint
CREATE INDEX "return_items_order_item_idx" ON "commerce"."return_items" USING btree ("order_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "returns_number_uq" ON "commerce"."returns" USING btree ("return_number");--> statement-breakpoint
CREATE INDEX "returns_order_idx" ON "commerce"."returns" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "returns_merchant_idx" ON "commerce"."returns" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "returns_customer_idx" ON "commerce"."returns" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "returns_status_idx" ON "commerce"."returns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "returns_requested_idx" ON "commerce"."returns" USING btree ("requested_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_transactions_number_uq" ON "commerce"."sales_transactions" USING btree ("transaction_number");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_transactions_return_uq" ON "commerce"."sales_transactions" USING btree ("return_id");--> statement-breakpoint
CREATE INDEX "sales_transactions_order_idx" ON "commerce"."sales_transactions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "sales_transactions_merchant_idx" ON "commerce"."sales_transactions" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "sales_transactions_type_idx" ON "commerce"."sales_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "sales_transactions_occurred_idx" ON "commerce"."sales_transactions" USING btree ("occurred_at");