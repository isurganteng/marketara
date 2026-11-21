CREATE SCHEMA "core";
--> statement-breakpoint
CREATE SCHEMA "governance";
--> statement-breakpoint
CREATE TYPE "core"."auth_event" AS ENUM('login_success', 'login_failed', 'logout', 'session_revoked');--> statement-breakpoint
CREATE TYPE "core"."document_status" AS ENUM('pending', 'verified', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "core"."market_status" AS ENUM('planned', 'active', 'inactive', 'maintenance', 'closed');--> statement-breakpoint
CREATE TYPE "core"."membership_status" AS ENUM('active', 'invited', 'suspended', 'left');--> statement-breakpoint
CREATE TYPE "core"."merchant_member_role" AS ENUM('owner', 'manager', 'staff');--> statement-breakpoint
CREATE TYPE "core"."merchant_status" AS ENUM('draft', 'pending_verification', 'verified', 'rejected', 'suspended', 'inactive');--> statement-breakpoint
CREATE TYPE "core"."occupancy_status" AS ENUM('active', 'ended', 'cancelled');--> statement-breakpoint
CREATE TYPE "core"."organization_member_role" AS ENUM('owner', 'admin', 'staff', 'member');--> statement-breakpoint
CREATE TYPE "core"."store_status" AS ENUM('active', 'inactive', 'closed');--> statement-breakpoint
CREATE TYPE "core"."store_type" AS ENUM('physical', 'online', 'hybrid');--> statement-breakpoint
CREATE TYPE "core"."market_unit_status" AS ENUM('available', 'occupied', 'reserved', 'maintenance', 'inactive');--> statement-breakpoint
CREATE TYPE "core"."market_unit_type" AS ENUM('kios', 'lapak', 'toko', 'gudang', 'lainnya');--> statement-breakpoint
CREATE TYPE "core"."user_status" AS ENUM('pending', 'active', 'suspended', 'inactive');--> statement-breakpoint
CREATE TYPE "core"."zone_status" AS ENUM('active', 'inactive', 'maintenance');--> statement-breakpoint
CREATE TABLE "governance"."audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" varchar(64),
	"old_values" jsonb,
	"new_values" jsonb,
	"ip_address" varchar(64),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."authentication_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"email" varchar(255),
	"event" "core"."auth_event" NOT NULL,
	"ip_address" varchar(64),
	"user_agent" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."market_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"zone_id" uuid NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(255) NOT NULL,
	"floor" varchar(32),
	"description" text,
	"status" "core"."zone_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."market_facilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"market_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(64),
	"location_description" text,
	"condition" varchar(32) DEFAULT 'good' NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."market_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_id" uuid NOT NULL,
	"code" varchar(32) NOT NULL,
	"unit_number" varchar(32),
	"type" "core"."market_unit_type" DEFAULT 'kios' NOT NULL,
	"status" "core"."market_unit_status" DEFAULT 'available' NOT NULL,
	"area_size" numeric(12, 2),
	"monthly_fee" numeric(14, 2),
	"description" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."market_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"market_id" uuid NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" "core"."zone_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."markets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"code" varchar(32) NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"address" text,
	"city" varchar(128),
	"province" varchar(128),
	"postal_code" varchar(16),
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"total_area" numeric(14, 2),
	"status" "core"."market_status" DEFAULT 'planned' NOT NULL,
	"opened_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "core"."merchant_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."merchant_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"document_type" varchar(64) NOT NULL,
	"document_number" varchar(128),
	"file_name" varchar(255),
	"file_url" text NOT NULL,
	"issued_at" date,
	"expires_at" date,
	"status" "core"."document_status" DEFAULT 'pending' NOT NULL,
	"note" text,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."merchant_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "core"."merchant_member_role" DEFAULT 'staff' NOT NULL,
	"status" "core"."membership_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."merchant_profiles" (
	"merchant_id" uuid PRIMARY KEY NOT NULL,
	"npwp" varchar(32),
	"nib" varchar(32),
	"founded_at" date,
	"employee_count" integer,
	"annual_revenue" numeric(18, 2),
	"website" varchar(255),
	"instagram" varchar(255),
	"facebook" varchar(255),
	"marketplace_url" text,
	"long_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."merchant_status_histories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"from_status" varchar(32),
	"to_status" varchar(32) NOT NULL,
	"reason" text,
	"changed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."merchants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(32) NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"organization_id" uuid,
	"category_id" uuid,
	"business_name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"logo_url" text,
	"phone" varchar(32),
	"email" varchar(255),
	"status" "core"."merchant_status" DEFAULT 'draft' NOT NULL,
	"verification_note" text,
	"verified_at" timestamp with time zone,
	"verified_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "core"."occupancy_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"market_unit_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"status" "core"."occupancy_status" DEFAULT 'active' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"monthly_fee" numeric(14, 2),
	"agreement_number" varchar(128),
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."organization_branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" text,
	"city" varchar(128),
	"province" varchar(128),
	"postal_code" varchar(16),
	"phone" varchar(32),
	"is_main" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "core"."organization_member_role" DEFAULT 'member' NOT NULL,
	"status" "core"."membership_status" DEFAULT 'active' NOT NULL,
	"invited_by" uuid,
	"joined_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."organization_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type_id" uuid,
	"parent_id" uuid,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"legal_name" varchar(255),
	"registration_number" varchar(64),
	"tax_number" varchar(64),
	"description" text,
	"logo_url" text,
	"email" varchar(255),
	"phone" varchar(32),
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "core"."permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(100) NOT NULL,
	"name" varchar(128) NOT NULL,
	"module" varchar(64) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"market_unit_id" uuid,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"type" "core"."store_type" DEFAULT 'physical' NOT NULL,
	"status" "core"."store_status" DEFAULT 'active' NOT NULL,
	"description" text,
	"phone" varchar(32),
	"email" varchar(255),
	"address" text,
	"city" varchar(128),
	"province" varchar(128),
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"operating_hours" jsonb,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "core"."user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"organization_id" uuid,
	"assigned_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"ip_address" varchar(64),
	"user_agent" text,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(32),
	"full_name" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"avatar_url" text,
	"status" "core"."user_status" DEFAULT 'active' NOT NULL,
	"email_verified_at" timestamp with time zone,
	"phone_verified_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "governance"."audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."authentication_logs" ADD CONSTRAINT "authentication_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."market_blocks" ADD CONSTRAINT "market_blocks_zone_id_market_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "core"."market_zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."market_facilities" ADD CONSTRAINT "market_facilities_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "core"."markets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."market_units" ADD CONSTRAINT "market_units_block_id_market_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "core"."market_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."market_zones" ADD CONSTRAINT "market_zones_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "core"."markets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."markets" ADD CONSTRAINT "markets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."merchant_documents" ADD CONSTRAINT "merchant_documents_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."merchant_documents" ADD CONSTRAINT "merchant_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."merchant_memberships" ADD CONSTRAINT "merchant_memberships_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."merchant_memberships" ADD CONSTRAINT "merchant_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."merchant_profiles" ADD CONSTRAINT "merchant_profiles_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."merchant_status_histories" ADD CONSTRAINT "merchant_status_histories_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."merchant_status_histories" ADD CONSTRAINT "merchant_status_histories_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."merchants" ADD CONSTRAINT "merchants_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "core"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."merchants" ADD CONSTRAINT "merchants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."merchants" ADD CONSTRAINT "merchants_category_id_merchant_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "core"."merchant_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."merchants" ADD CONSTRAINT "merchants_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."occupancy_records" ADD CONSTRAINT "occupancy_records_market_unit_id_market_units_id_fk" FOREIGN KEY ("market_unit_id") REFERENCES "core"."market_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."occupancy_records" ADD CONSTRAINT "occupancy_records_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."occupancy_records" ADD CONSTRAINT "occupancy_records_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."organization_branches" ADD CONSTRAINT "organization_branches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."organization_members" ADD CONSTRAINT "organization_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."organizations" ADD CONSTRAINT "organizations_type_id_organization_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "core"."organization_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."organizations" ADD CONSTRAINT "organizations_parent_id_organizations_id_fk" FOREIGN KEY ("parent_id") REFERENCES "core"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."organizations" ADD CONSTRAINT "organizations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "core"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "core"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."stores" ADD CONSTRAINT "stores_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."stores" ADD CONSTRAINT "stores_market_unit_id_market_units_id_fk" FOREIGN KEY ("market_unit_id") REFERENCES "core"."market_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "core"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."user_roles" ADD CONSTRAINT "user_roles_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "governance"."audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "governance"."audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "governance"."audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "authentication_logs_user_idx" ON "core"."authentication_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "authentication_logs_created_idx" ON "core"."authentication_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "market_blocks_code_uq" ON "core"."market_blocks" USING btree ("zone_id","code");--> statement-breakpoint
CREATE INDEX "market_facilities_market_idx" ON "core"."market_facilities" USING btree ("market_id");--> statement-breakpoint
CREATE UNIQUE INDEX "market_units_code_uq" ON "core"."market_units" USING btree ("block_id","code");--> statement-breakpoint
CREATE INDEX "market_units_status_idx" ON "core"."market_units" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "market_zones_code_uq" ON "core"."market_zones" USING btree ("market_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "markets_code_uq" ON "core"."markets" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "markets_slug_uq" ON "core"."markets" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "markets_org_idx" ON "core"."markets" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "markets_status_idx" ON "core"."markets" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_categories_code_uq" ON "core"."merchant_categories" USING btree ("code");--> statement-breakpoint
CREATE INDEX "merchant_documents_merchant_idx" ON "core"."merchant_documents" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_memberships_uq" ON "core"."merchant_memberships" USING btree ("merchant_id","user_id");--> statement-breakpoint
CREATE INDEX "merchant_memberships_user_idx" ON "core"."merchant_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "merchant_status_histories_merchant_idx" ON "core"."merchant_status_histories" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "merchants_code_uq" ON "core"."merchants" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "merchants_slug_uq" ON "core"."merchants" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "merchants_owner_idx" ON "core"."merchants" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "merchants_org_idx" ON "core"."merchants" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "merchants_status_idx" ON "core"."merchants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "occupancy_records_merchant_idx" ON "core"."occupancy_records" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "occupancy_records_unit_idx" ON "core"."occupancy_records" USING btree ("market_unit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "occupancy_records_active_unit_uq" ON "core"."occupancy_records" USING btree ("market_unit_id") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "organization_branches_org_idx" ON "core"."organization_branches" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_members_uq" ON "core"."organization_members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "organization_members_user_idx" ON "core"."organization_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_types_code_uq" ON "core"."organization_types" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_uq" ON "core"."organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "organizations_type_idx" ON "core"."organizations" USING btree ("type_id");--> statement-breakpoint
CREATE INDEX "organizations_parent_idx" ON "core"."organizations" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_code_uq" ON "core"."permissions" USING btree ("code");--> statement-breakpoint
CREATE INDEX "permissions_module_idx" ON "core"."permissions" USING btree ("module");--> statement-breakpoint
CREATE UNIQUE INDEX "role_permissions_uq" ON "core"."role_permissions" USING btree ("role_id","permission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_code_uq" ON "core"."roles" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "stores_slug_uq" ON "core"."stores" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "stores_merchant_idx" ON "core"."stores" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "stores_status_idx" ON "core"."stores" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_scope_uq" ON "core"."user_roles" USING btree ("user_id","role_id","organization_id");--> statement-breakpoint
CREATE INDEX "user_roles_user_idx" ON "core"."user_roles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_sessions_token_uq" ON "core"."user_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "user_sessions_user_idx" ON "core"."user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "core"."users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_uq" ON "core"."users" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "core"."users" USING btree ("status");