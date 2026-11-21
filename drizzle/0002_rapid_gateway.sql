CREATE SCHEMA "commerce";
--> statement-breakpoint
CREATE TYPE "commerce"."address_type" AS ENUM('home', 'office', 'other');--> statement-breakpoint
CREATE TYPE "commerce"."cart_status" AS ENUM('active', 'converted', 'abandoned', 'expired');--> statement-breakpoint
CREATE TYPE "commerce"."checkout_status" AS ENUM('draft', 'pending', 'ready', 'expired', 'cancelled', 'completed');--> statement-breakpoint
CREATE TYPE "commerce"."listing_status" AS ENUM('draft', 'active', 'paused', 'ended');--> statement-breakpoint
CREATE TYPE "commerce"."sales_channel_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "commerce"."sales_channel_type" AS ENUM('web', 'marketplace', 'social', 'pos', 'other');--> statement-breakpoint
CREATE TYPE "commerce"."storefront_status" AS ENUM('draft', 'published', 'inactive', 'suspended');--> statement-breakpoint
CREATE TABLE "commerce"."cart_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cart_id" uuid NOT NULL,
	"storefront_product_id" uuid NOT NULL,
	"sku_id" uuid,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(16, 2) NOT NULL,
	"product_name" varchar(255) NOT NULL,
	"sku_code" varchar(100),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commerce"."channel_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"storefront_id" uuid NOT NULL,
	"product_id" uuid,
	"external_listing_id" varchar(255),
	"title" varchar(255),
	"description" text,
	"price" numeric(16, 2),
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"status" "commerce"."listing_status" DEFAULT 'draft' NOT NULL,
	"external_url" text,
	"metadata" jsonb,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commerce"."checkout_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cart_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "commerce"."checkout_status" DEFAULT 'pending' NOT NULL,
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"subtotal" numeric(16, 2) DEFAULT '0' NOT NULL,
	"discount_total" numeric(16, 2) DEFAULT '0' NOT NULL,
	"shipping_total" numeric(16, 2) DEFAULT '0' NOT NULL,
	"grand_total" numeric(16, 2) DEFAULT '0' NOT NULL,
	"address_id" uuid,
	"address_snapshot" jsonb,
	"items_snapshot" jsonb NOT NULL,
	"contact_name" varchar(255),
	"contact_phone" varchar(32),
	"contact_email" varchar(255),
	"notes" text,
	"expires_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commerce"."customer_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" varchar(64) DEFAULT 'Rumah' NOT NULL,
	"type" "commerce"."address_type" DEFAULT 'home' NOT NULL,
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
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "commerce"."sales_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"type" "commerce"."sales_channel_type" DEFAULT 'web' NOT NULL,
	"status" "commerce"."sales_channel_status" DEFAULT 'active' NOT NULL,
	"description" text,
	"logo_url" text,
	"config" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commerce"."shopping_carts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "commerce"."cart_status" DEFAULT 'active' NOT NULL,
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commerce"."storefront_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storefront_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"price_override" numeric(16, 2),
	"compare_at_price" numeric(16, 2),
	"is_visible" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commerce"."storefronts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"store_id" uuid,
	"sales_channel_id" uuid,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"logo_url" text,
	"banner_url" text,
	"status" "commerce"."storefront_status" DEFAULT 'draft' NOT NULL,
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"contact_name" varchar(255),
	"contact_phone" varchar(32),
	"contact_email" varchar(255),
	"settings" jsonb,
	"is_featured" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "commerce"."cart_items" ADD CONSTRAINT "cart_items_cart_id_shopping_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "commerce"."shopping_carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."cart_items" ADD CONSTRAINT "cart_items_storefront_product_id_storefront_products_id_fk" FOREIGN KEY ("storefront_product_id") REFERENCES "commerce"."storefront_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."cart_items" ADD CONSTRAINT "cart_items_sku_id_product_skus_id_fk" FOREIGN KEY ("sku_id") REFERENCES "catalog"."product_skus"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."channel_listings" ADD CONSTRAINT "channel_listings_channel_id_sales_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "commerce"."sales_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."channel_listings" ADD CONSTRAINT "channel_listings_storefront_id_storefronts_id_fk" FOREIGN KEY ("storefront_id") REFERENCES "commerce"."storefronts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."channel_listings" ADD CONSTRAINT "channel_listings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."checkout_sessions" ADD CONSTRAINT "checkout_sessions_cart_id_shopping_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "commerce"."shopping_carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."checkout_sessions" ADD CONSTRAINT "checkout_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."checkout_sessions" ADD CONSTRAINT "checkout_sessions_address_id_customer_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "commerce"."customer_addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."customer_addresses" ADD CONSTRAINT "customer_addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."shopping_carts" ADD CONSTRAINT "shopping_carts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."storefront_products" ADD CONSTRAINT "storefront_products_storefront_id_storefronts_id_fk" FOREIGN KEY ("storefront_id") REFERENCES "commerce"."storefronts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."storefront_products" ADD CONSTRAINT "storefront_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."storefronts" ADD CONSTRAINT "storefronts_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."storefronts" ADD CONSTRAINT "storefronts_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "core"."stores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."storefronts" ADD CONSTRAINT "storefronts_sales_channel_id_sales_channels_id_fk" FOREIGN KEY ("sales_channel_id") REFERENCES "commerce"."sales_channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cart_items_cart_idx" ON "commerce"."cart_items" USING btree ("cart_id");--> statement-breakpoint
CREATE INDEX "cart_items_storefront_product_idx" ON "commerce"."cart_items" USING btree ("storefront_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_listings_external_uq" ON "commerce"."channel_listings" USING btree ("channel_id","external_listing_id");--> statement-breakpoint
CREATE INDEX "channel_listings_storefront_idx" ON "commerce"."channel_listings" USING btree ("storefront_id");--> statement-breakpoint
CREATE INDEX "channel_listings_product_idx" ON "commerce"."channel_listings" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "channel_listings_status_idx" ON "commerce"."channel_listings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "checkout_sessions_cart_idx" ON "commerce"."checkout_sessions" USING btree ("cart_id");--> statement-breakpoint
CREATE INDEX "checkout_sessions_user_idx" ON "commerce"."checkout_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "checkout_sessions_status_idx" ON "commerce"."checkout_sessions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "checkout_sessions_active_cart_uq" ON "commerce"."checkout_sessions" USING btree ("cart_id") WHERE status in ('draft', 'pending', 'ready');--> statement-breakpoint
CREATE INDEX "customer_addresses_user_idx" ON "commerce"."customer_addresses" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_addresses_default_uq" ON "commerce"."customer_addresses" USING btree ("user_id") WHERE is_default = true and deleted_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "sales_channels_code_uq" ON "commerce"."sales_channels" USING btree ("code");--> statement-breakpoint
CREATE INDEX "sales_channels_status_idx" ON "commerce"."sales_channels" USING btree ("status");--> statement-breakpoint
CREATE INDEX "shopping_carts_user_idx" ON "commerce"."shopping_carts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shopping_carts_active_user_uq" ON "commerce"."shopping_carts" USING btree ("user_id") WHERE status = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "storefront_products_uq" ON "commerce"."storefront_products" USING btree ("storefront_id","product_id");--> statement-breakpoint
CREATE INDEX "storefront_products_product_idx" ON "commerce"."storefront_products" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "storefront_products_visible_idx" ON "commerce"."storefront_products" USING btree ("storefront_id","is_visible");--> statement-breakpoint
CREATE UNIQUE INDEX "storefronts_slug_uq" ON "commerce"."storefronts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "storefronts_merchant_idx" ON "commerce"."storefronts" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "storefronts_store_idx" ON "commerce"."storefronts" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "storefronts_channel_idx" ON "commerce"."storefronts" USING btree ("sales_channel_id");--> statement-breakpoint
CREATE INDEX "storefronts_status_idx" ON "commerce"."storefronts" USING btree ("status");