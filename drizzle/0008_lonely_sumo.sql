CREATE SCHEMA "marketing";
--> statement-breakpoint
CREATE TYPE "marketing"."advertisement_status" AS ENUM('draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "marketing"."advertisement_type" AS ENUM('banner', 'sponsored_product', 'social_post', 'email', 'other');--> statement-breakpoint
CREATE TYPE "marketing"."campaign_channel_type" AS ENUM('storefront', 'marketplace', 'social', 'email', 'whatsapp', 'pos', 'offline', 'other');--> statement-breakpoint
CREATE TYPE "marketing"."campaign_objective" AS ENUM('awareness', 'acquisition', 'retention', 'engagement');--> statement-breakpoint
CREATE TYPE "marketing"."campaign_status" AS ENUM('draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "marketing"."complaint_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "marketing"."complaint_status" AS ENUM('open', 'in_progress', 'resolved', 'rejected', 'closed');--> statement-breakpoint
CREATE TYPE "marketing"."coupon_discount_type" AS ENUM('percentage', 'fixed_amount', 'free_shipping');--> statement-breakpoint
CREATE TYPE "marketing"."coupon_redemption_status" AS ENUM('applied', 'redeemed', 'cancelled');--> statement-breakpoint
CREATE TYPE "marketing"."coupon_status" AS ENUM('active', 'inactive', 'expired', 'exhausted');--> statement-breakpoint
CREATE TYPE "marketing"."customer_group_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "marketing"."customer_segment_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "marketing"."customer_segment_type" AS ENUM('manual', 'dynamic');--> statement-breakpoint
CREATE TYPE "marketing"."customer_source" AS ENUM('storefront', 'pos', 'manual', 'import', 'marketplace', 'other');--> statement-breakpoint
CREATE TYPE "marketing"."customer_status" AS ENUM('active', 'inactive', 'blocked');--> statement-breakpoint
CREATE TYPE "marketing"."discount_rule_target" AS ENUM('order', 'product', 'category', 'shipping');--> statement-breakpoint
CREATE TYPE "marketing"."discount_rule_type" AS ENUM('percentage', 'fixed_amount', 'free_shipping', 'buy_x_get_y');--> statement-breakpoint
CREATE TYPE "marketing"."customer_interaction_direction" AS ENUM('inbound', 'outbound', 'internal');--> statement-breakpoint
CREATE TYPE "marketing"."customer_interaction_status" AS ENUM('open', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "marketing"."customer_interaction_type" AS ENUM('note', 'call', 'email', 'whatsapp', 'meeting', 'complaint', 'follow_up');--> statement-breakpoint
CREATE TYPE "marketing"."loyalty_account_status" AS ENUM('active', 'suspended', 'closed');--> statement-breakpoint
CREATE TYPE "marketing"."loyalty_tier" AS ENUM('bronze', 'silver', 'gold', 'platinum');--> statement-breakpoint
CREATE TYPE "marketing"."loyalty_transaction_type" AS ENUM('earn', 'redeem', 'adjustment', 'expire', 'bonus');--> statement-breakpoint
CREATE TYPE "marketing"."promotion_status" AS ENUM('draft', 'scheduled', 'active', 'paused', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "marketing"."promotion_type" AS ENUM('percentage', 'fixed_amount', 'free_shipping', 'bundle', 'buy_x_get_y');--> statement-breakpoint
CREATE TABLE "marketing"."advertisements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"campaign_id" uuid,
	"name" varchar(255) NOT NULL,
	"type" "marketing"."advertisement_type" DEFAULT 'banner' NOT NULL,
	"status" "marketing"."advertisement_status" DEFAULT 'draft' NOT NULL,
	"placement" varchar(128),
	"creative_url" text,
	"target_url" text,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"budget" numeric(16, 2) DEFAULT '0' NOT NULL,
	"spent" numeric(16, 2) DEFAULT '0' NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"revenue" numeric(16, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing"."campaign_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"channel_type" "marketing"."campaign_channel_type" NOT NULL,
	"name" varchar(128),
	"budget" numeric(16, 2) DEFAULT '0' NOT NULL,
	"spent" numeric(16, 2) DEFAULT '0' NOT NULL,
	"target_conversions" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing"."campaign_performance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"channel_id" uuid,
	"date" date NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"spend" numeric(16, 2) DEFAULT '0' NOT NULL,
	"revenue" numeric(16, 2) DEFAULT '0' NOT NULL,
	"orders" integer DEFAULT 0 NOT NULL,
	"new_customers" integer DEFAULT 0 NOT NULL,
	"metrics" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing"."coupon_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"coupon_id" uuid NOT NULL,
	"order_id" uuid,
	"customer_id" uuid,
	"user_id" uuid,
	"code" varchar(64) NOT NULL,
	"discount_amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"status" "marketing"."coupon_redemption_status" DEFAULT 'redeemed' NOT NULL,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing"."coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"promotion_id" uuid,
	"code" varchar(64) NOT NULL,
	"name" varchar(255),
	"description" text,
	"status" "marketing"."coupon_status" DEFAULT 'active' NOT NULL,
	"discount_type" "marketing"."coupon_discount_type" NOT NULL,
	"discount_value" numeric(16, 2) DEFAULT '0' NOT NULL,
	"min_purchase" numeric(16, 2) DEFAULT '0' NOT NULL,
	"max_discount" numeric(16, 2),
	"usage_limit" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"per_customer_limit" integer,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing"."customer_complaints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"order_id" uuid,
	"complaint_number" varchar(64) NOT NULL,
	"category" varchar(128),
	"subject" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"priority" "marketing"."complaint_priority" DEFAULT 'normal' NOT NULL,
	"status" "marketing"."complaint_status" DEFAULT 'open' NOT NULL,
	"assigned_to" uuid,
	"resolution" text,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing"."customer_group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing"."customer_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"discount_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"status" "marketing"."customer_group_status" DEFAULT 'active' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing"."customer_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"type" "marketing"."customer_interaction_type" NOT NULL,
	"direction" "marketing"."customer_interaction_direction" DEFAULT 'internal' NOT NULL,
	"subject" varchar(255),
	"content" text NOT NULL,
	"status" "marketing"."customer_interaction_status" DEFAULT 'open' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing"."customer_profiles" (
	"customer_id" uuid PRIMARY KEY NOT NULL,
	"company_name" varchar(255),
	"tax_number" varchar(64),
	"address" text,
	"city" varchar(128),
	"province" varchar(128),
	"postal_code" varchar(20),
	"country" varchar(2) DEFAULT 'ID' NOT NULL,
	"avatar_url" text,
	"preferences" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing"."customer_segment_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"segment_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing"."customer_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"type" "marketing"."customer_segment_type" DEFAULT 'manual' NOT NULL,
	"criteria" jsonb,
	"status" "marketing"."customer_segment_status" DEFAULT 'active' NOT NULL,
	"member_count" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing"."customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"user_id" uuid,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(32),
	"status" "marketing"."customer_status" DEFAULT 'active' NOT NULL,
	"source" "marketing"."customer_source" DEFAULT 'manual' NOT NULL,
	"birth_date" date,
	"gender" varchar(32),
	"tags" jsonb,
	"notes" text,
	"total_orders" integer DEFAULT 0 NOT NULL,
	"total_spent" numeric(16, 2) DEFAULT '0' NOT NULL,
	"last_order_at" timestamp with time zone,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "marketing"."discount_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"promotion_id" uuid NOT NULL,
	"name" varchar(255),
	"rule_type" "marketing"."discount_rule_type" NOT NULL,
	"target_type" "marketing"."discount_rule_target" DEFAULT 'order' NOT NULL,
	"threshold_amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"threshold_quantity" integer DEFAULT 0 NOT NULL,
	"discount_value" numeric(16, 2) DEFAULT '0' NOT NULL,
	"max_discount" numeric(16, 2),
	"config" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing"."loyalty_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"member_code" varchar(64) NOT NULL,
	"tier" "marketing"."loyalty_tier" DEFAULT 'bronze' NOT NULL,
	"points_balance" integer DEFAULT 0 NOT NULL,
	"lifetime_points" integer DEFAULT 0 NOT NULL,
	"lifetime_spend" numeric(16, 2) DEFAULT '0' NOT NULL,
	"status" "marketing"."loyalty_account_status" DEFAULT 'active' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing"."loyalty_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"type" "marketing"."loyalty_transaction_type" NOT NULL,
	"points" integer NOT NULL,
	"balance_before" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"order_id" uuid,
	"reference" varchar(128),
	"description" text,
	"expires_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing"."marketing_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"objective" "marketing"."campaign_objective" DEFAULT 'awareness' NOT NULL,
	"status" "marketing"."campaign_status" DEFAULT 'draft' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"budget" numeric(16, 2) DEFAULT '0' NOT NULL,
	"spent" numeric(16, 2) DEFAULT '0' NOT NULL,
	"target_revenue" numeric(16, 2) DEFAULT '0' NOT NULL,
	"target_audience" text,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing"."promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"campaign_id" uuid,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"type" "marketing"."promotion_type" NOT NULL,
	"status" "marketing"."promotion_status" DEFAULT 'draft' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"priority" integer DEFAULT 0 NOT NULL,
	"stackable" boolean DEFAULT false NOT NULL,
	"min_purchase" numeric(16, 2) DEFAULT '0' NOT NULL,
	"max_discount" numeric(16, 2),
	"usage_limit" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"per_customer_limit" integer,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "marketing"."advertisements" ADD CONSTRAINT "advertisements_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."advertisements" ADD CONSTRAINT "advertisements_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "marketing"."marketing_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."advertisements" ADD CONSTRAINT "advertisements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."campaign_channels" ADD CONSTRAINT "campaign_channels_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."campaign_channels" ADD CONSTRAINT "campaign_channels_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "marketing"."marketing_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."campaign_performance" ADD CONSTRAINT "campaign_performance_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."campaign_performance" ADD CONSTRAINT "campaign_performance_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "marketing"."marketing_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."campaign_performance" ADD CONSTRAINT "campaign_performance_channel_id_campaign_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "marketing"."campaign_channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "marketing"."coupons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "commerce"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."coupons" ADD CONSTRAINT "coupons_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."coupons" ADD CONSTRAINT "coupons_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "marketing"."promotions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."coupons" ADD CONSTRAINT "coupons_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."customer_complaints" ADD CONSTRAINT "customer_complaints_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."customer_complaints" ADD CONSTRAINT "customer_complaints_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "marketing"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."customer_complaints" ADD CONSTRAINT "customer_complaints_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "commerce"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."customer_complaints" ADD CONSTRAINT "customer_complaints_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."customer_complaints" ADD CONSTRAINT "customer_complaints_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."customer_group_members" ADD CONSTRAINT "customer_group_members_group_id_customer_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "marketing"."customer_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."customer_group_members" ADD CONSTRAINT "customer_group_members_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "marketing"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."customer_groups" ADD CONSTRAINT "customer_groups_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."customer_groups" ADD CONSTRAINT "customer_groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."customer_interactions" ADD CONSTRAINT "customer_interactions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."customer_interactions" ADD CONSTRAINT "customer_interactions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "marketing"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."customer_interactions" ADD CONSTRAINT "customer_interactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."customer_profiles" ADD CONSTRAINT "customer_profiles_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "marketing"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."customer_segment_members" ADD CONSTRAINT "customer_segment_members_segment_id_customer_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "marketing"."customer_segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."customer_segment_members" ADD CONSTRAINT "customer_segment_members_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "marketing"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."customer_segments" ADD CONSTRAINT "customer_segments_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."customer_segments" ADD CONSTRAINT "customer_segments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."customers" ADD CONSTRAINT "customers_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."customers" ADD CONSTRAINT "customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."customers" ADD CONSTRAINT "customers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."discount_rules" ADD CONSTRAINT "discount_rules_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."discount_rules" ADD CONSTRAINT "discount_rules_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "marketing"."promotions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "marketing"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_account_id_loyalty_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "marketing"."loyalty_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "marketing"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "commerce"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."promotions" ADD CONSTRAINT "promotions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."promotions" ADD CONSTRAINT "promotions_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "marketing"."marketing_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing"."promotions" ADD CONSTRAINT "promotions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "advertisements_merchant_idx" ON "marketing"."advertisements" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "advertisements_campaign_idx" ON "marketing"."advertisements" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "advertisements_status_idx" ON "marketing"."advertisements" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_channels_campaign_type_uq" ON "marketing"."campaign_channels" USING btree ("campaign_id","channel_type");--> statement-breakpoint
CREATE INDEX "campaign_channels_merchant_idx" ON "marketing"."campaign_channels" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "campaign_channels_campaign_idx" ON "marketing"."campaign_channels" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "campaign_performance_merchant_idx" ON "marketing"."campaign_performance" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "campaign_performance_campaign_idx" ON "marketing"."campaign_performance" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "campaign_performance_date_idx" ON "marketing"."campaign_performance" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "coupon_redemptions_coupon_order_uq" ON "marketing"."coupon_redemptions" USING btree ("coupon_id","order_id");--> statement-breakpoint
CREATE INDEX "coupon_redemptions_merchant_idx" ON "marketing"."coupon_redemptions" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "coupon_redemptions_coupon_idx" ON "marketing"."coupon_redemptions" USING btree ("coupon_id");--> statement-breakpoint
CREATE INDEX "coupon_redemptions_customer_idx" ON "marketing"."coupon_redemptions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "coupon_redemptions_status_idx" ON "marketing"."coupon_redemptions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_code_uq" ON "marketing"."coupons" USING btree ("merchant_id","code");--> statement-breakpoint
CREATE INDEX "coupons_merchant_idx" ON "marketing"."coupons" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "coupons_promotion_idx" ON "marketing"."coupons" USING btree ("promotion_id");--> statement-breakpoint
CREATE INDEX "coupons_status_idx" ON "marketing"."coupons" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_complaints_number_uq" ON "marketing"."customer_complaints" USING btree ("complaint_number");--> statement-breakpoint
CREATE INDEX "customer_complaints_merchant_idx" ON "marketing"."customer_complaints" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "customer_complaints_customer_idx" ON "marketing"."customer_complaints" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_complaints_status_idx" ON "marketing"."customer_complaints" USING btree ("status");--> statement-breakpoint
CREATE INDEX "customer_complaints_priority_idx" ON "marketing"."customer_complaints" USING btree ("priority");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_group_members_uq" ON "marketing"."customer_group_members" USING btree ("group_id","customer_id");--> statement-breakpoint
CREATE INDEX "customer_group_members_customer_idx" ON "marketing"."customer_group_members" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_groups_code_uq" ON "marketing"."customer_groups" USING btree ("merchant_id","code");--> statement-breakpoint
CREATE INDEX "customer_groups_merchant_idx" ON "marketing"."customer_groups" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "customer_groups_status_idx" ON "marketing"."customer_groups" USING btree ("status");--> statement-breakpoint
CREATE INDEX "customer_interactions_merchant_idx" ON "marketing"."customer_interactions" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "customer_interactions_customer_idx" ON "marketing"."customer_interactions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_interactions_status_idx" ON "marketing"."customer_interactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "customer_interactions_scheduled_idx" ON "marketing"."customer_interactions" USING btree ("scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_segment_members_uq" ON "marketing"."customer_segment_members" USING btree ("segment_id","customer_id");--> statement-breakpoint
CREATE INDEX "customer_segment_members_customer_idx" ON "marketing"."customer_segment_members" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_segments_code_uq" ON "marketing"."customer_segments" USING btree ("merchant_id","code");--> statement-breakpoint
CREATE INDEX "customer_segments_merchant_idx" ON "marketing"."customer_segments" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "customer_segments_status_idx" ON "marketing"."customer_segments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_code_uq" ON "marketing"."customers" USING btree ("merchant_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_merchant_user_uq" ON "marketing"."customers" USING btree ("merchant_id","user_id");--> statement-breakpoint
CREATE INDEX "customers_merchant_idx" ON "marketing"."customers" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "customers_email_idx" ON "marketing"."customers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "customers_phone_idx" ON "marketing"."customers" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "customers_status_idx" ON "marketing"."customers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "discount_rules_merchant_idx" ON "marketing"."discount_rules" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "discount_rules_promotion_idx" ON "marketing"."discount_rules" USING btree ("promotion_id");--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_accounts_customer_uq" ON "marketing"."loyalty_accounts" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_accounts_member_code_uq" ON "marketing"."loyalty_accounts" USING btree ("merchant_id","member_code");--> statement-breakpoint
CREATE INDEX "loyalty_accounts_merchant_idx" ON "marketing"."loyalty_accounts" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "loyalty_accounts_status_idx" ON "marketing"."loyalty_accounts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "loyalty_transactions_merchant_idx" ON "marketing"."loyalty_transactions" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "loyalty_transactions_account_idx" ON "marketing"."loyalty_transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "loyalty_transactions_customer_idx" ON "marketing"."loyalty_transactions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "loyalty_transactions_type_idx" ON "marketing"."loyalty_transactions" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_campaigns_code_uq" ON "marketing"."marketing_campaigns" USING btree ("merchant_id","code");--> statement-breakpoint
CREATE INDEX "marketing_campaigns_merchant_idx" ON "marketing"."marketing_campaigns" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "marketing_campaigns_status_idx" ON "marketing"."marketing_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "marketing_campaigns_dates_idx" ON "marketing"."marketing_campaigns" USING btree ("starts_at","ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "promotions_code_uq" ON "marketing"."promotions" USING btree ("merchant_id","code");--> statement-breakpoint
CREATE INDEX "promotions_merchant_idx" ON "marketing"."promotions" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "promotions_campaign_idx" ON "marketing"."promotions" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "promotions_status_idx" ON "marketing"."promotions" USING btree ("status");