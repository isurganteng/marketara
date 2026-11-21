CREATE SCHEMA "catalog";
--> statement-breakpoint
CREATE TYPE "catalog"."attribute_type" AS ENUM('text', 'number', 'boolean', 'select');--> statement-breakpoint
CREATE TYPE "catalog"."product_status" AS ENUM('draft', 'active', 'inactive', 'archived');--> statement-breakpoint
CREATE TYPE "catalog"."sku_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "catalog"."variant_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TABLE "catalog"."brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"logo_url" text,
	"website" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog"."product_attribute_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"attribute_id" uuid NOT NULL,
	"value_id" uuid,
	"custom_value" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog"."product_attribute_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attribute_id" uuid NOT NULL,
	"value" varchar(128) NOT NULL,
	"label" varchar(128),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog"."product_attributes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"type" "catalog"."attribute_type" DEFAULT 'text' NOT NULL,
	"is_variant_attribute" boolean DEFAULT false NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog"."product_catalog_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"catalog_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"price_override" numeric(16, 2),
	"is_visible" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog"."product_catalogs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog"."product_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"image_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog"."product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"url" text NOT NULL,
	"alt_text" varchar(255),
	"is_primary" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog"."product_skus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"unit_id" uuid,
	"sku_code" varchar(100) NOT NULL,
	"barcode" varchar(100),
	"price" numeric(16, 2) NOT NULL,
	"cost_price" numeric(16, 2),
	"status" "catalog"."sku_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog"."product_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(128) NOT NULL,
	"symbol" varchar(16),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog"."product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(64),
	"attributes" jsonb,
	"price" numeric(16, 2),
	"is_default" boolean DEFAULT false NOT NULL,
	"status" "catalog"."variant_status" DEFAULT 'active' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog"."products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"category_id" uuid,
	"brand_id" uuid,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"short_description" text,
	"description" text,
	"status" "catalog"."product_status" DEFAULT 'draft' NOT NULL,
	"base_price" numeric(16, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"weight_gram" integer,
	"dimensions" jsonb,
	"is_featured" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "catalog"."product_attribute_assignments" ADD CONSTRAINT "product_attribute_assignments_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."product_attribute_assignments" ADD CONSTRAINT "product_attribute_assignments_attribute_id_product_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "catalog"."product_attributes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."product_attribute_assignments" ADD CONSTRAINT "product_attribute_assignments_value_id_product_attribute_values_id_fk" FOREIGN KEY ("value_id") REFERENCES "catalog"."product_attribute_values"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."product_attribute_values" ADD CONSTRAINT "product_attribute_values_attribute_id_product_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "catalog"."product_attributes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."product_catalog_items" ADD CONSTRAINT "product_catalog_items_catalog_id_product_catalogs_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "catalog"."product_catalogs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."product_catalog_items" ADD CONSTRAINT "product_catalog_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."product_catalogs" ADD CONSTRAINT "product_catalogs_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."product_categories" ADD CONSTRAINT "product_categories_parent_id_product_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "catalog"."product_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."product_skus" ADD CONSTRAINT "product_skus_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."product_skus" ADD CONSTRAINT "product_skus_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "catalog"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."product_skus" ADD CONSTRAINT "product_skus_unit_id_product_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "catalog"."product_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."products" ADD CONSTRAINT "products_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."products" ADD CONSTRAINT "products_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "catalog"."product_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "catalog"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."products" ADD CONSTRAINT "products_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "brands_code_uq" ON "catalog"."brands" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "brands_slug_uq" ON "catalog"."brands" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "product_attribute_assignments_uq" ON "catalog"."product_attribute_assignments" USING btree ("product_id","attribute_id");--> statement-breakpoint
CREATE INDEX "product_attribute_assignments_product_idx" ON "catalog"."product_attribute_assignments" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_attribute_values_uq" ON "catalog"."product_attribute_values" USING btree ("attribute_id","value");--> statement-breakpoint
CREATE INDEX "product_attribute_values_attr_idx" ON "catalog"."product_attribute_values" USING btree ("attribute_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_attributes_code_uq" ON "catalog"."product_attributes" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "product_catalog_items_uq" ON "catalog"."product_catalog_items" USING btree ("catalog_id","product_id");--> statement-breakpoint
CREATE INDEX "product_catalog_items_product_idx" ON "catalog"."product_catalog_items" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_catalogs_merchant_slug_uq" ON "catalog"."product_catalogs" USING btree ("merchant_id","slug");--> statement-breakpoint
CREATE INDEX "product_catalogs_merchant_idx" ON "catalog"."product_catalogs" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_code_uq" ON "catalog"."product_categories" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_slug_uq" ON "catalog"."product_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "product_categories_parent_idx" ON "catalog"."product_categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "product_images_product_idx" ON "catalog"."product_images" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_skus_code_uq" ON "catalog"."product_skus" USING btree ("sku_code");--> statement-breakpoint
CREATE UNIQUE INDEX "product_skus_barcode_uq" ON "catalog"."product_skus" USING btree ("barcode");--> statement-breakpoint
CREATE INDEX "product_skus_product_idx" ON "catalog"."product_skus" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_skus_variant_idx" ON "catalog"."product_skus" USING btree ("variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_units_code_uq" ON "catalog"."product_units" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_code_uq" ON "catalog"."product_variants" USING btree ("product_id","code");--> statement-breakpoint
CREATE INDEX "product_variants_product_idx" ON "catalog"."product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_merchant_slug_uq" ON "catalog"."products" USING btree ("merchant_id","slug");--> statement-breakpoint
CREATE INDEX "products_merchant_idx" ON "catalog"."products" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "catalog"."products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "products_brand_idx" ON "catalog"."products" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "catalog"."products" USING btree ("status");