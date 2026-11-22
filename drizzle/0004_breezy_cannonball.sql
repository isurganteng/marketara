CREATE SCHEMA "payment";
--> statement-breakpoint
CREATE TYPE "payment"."merchant_payment_account_status" AS ENUM('pending_verification', 'active', 'inactive');--> statement-breakpoint
CREATE TYPE "payment"."payment_attempt_status" AS ENUM('created', 'pending', 'succeeded', 'failed', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "payment"."payment_event_type" AS ENUM('created', 'authorized', 'paid', 'failed', 'expired', 'cancelled', 'refund', 'settlement', 'callback', 'other');--> statement-breakpoint
CREATE TYPE "payment"."payment_method_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "payment"."payment_method_type" AS ENUM('qris', 'ewallet', 'bank_transfer', 'virtual_account', 'credit_card', 'cash', 'other');--> statement-breakpoint
CREATE TYPE "payment"."payment_provider_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "payment"."payment_provider_type" AS ENUM('gateway', 'bank', 'ewallet', 'qris', 'manual', 'other');--> statement-breakpoint
CREATE TYPE "payment"."payment_status" AS ENUM('pending', 'authorized', 'paid', 'failed', 'expired', 'cancelled', 'partially_refunded', 'refunded');--> statement-breakpoint
CREATE TYPE "payment"."reconciliation_status" AS ENUM('draft', 'completed', 'discrepancy', 'failed');--> statement-breakpoint
CREATE TYPE "payment"."refund_status" AS ENUM('requested', 'approved', 'processing', 'completed', 'rejected', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "payment"."settlement_status" AS ENUM('draft', 'pending', 'processing', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "payment"."merchant_payment_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"provider_id" uuid,
	"account_name" varchar(255) NOT NULL,
	"account_number" varchar(64) NOT NULL,
	"bank_name" varchar(128),
	"status" "payment"."merchant_payment_account_status" DEFAULT 'pending_verification' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment"."payment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"status" "payment"."payment_attempt_status" DEFAULT 'pending' NOT NULL,
	"provider_reference" varchar(128),
	"request_payload" jsonb,
	"response_payload" jsonb,
	"failure_code" varchar(64),
	"failure_message" text,
	"expires_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment"."payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"attempt_id" uuid,
	"event_type" "payment"."payment_event_type" NOT NULL,
	"source" varchar(32) DEFAULT 'internal' NOT NULL,
	"external_reference" varchar(128),
	"payload" jsonb,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment"."payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"type" "payment"."payment_method_type" DEFAULT 'other' NOT NULL,
	"status" "payment"."payment_method_status" DEFAULT 'active' NOT NULL,
	"description" text,
	"fee_flat" numeric(16, 2) DEFAULT '0' NOT NULL,
	"fee_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"minimum_amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"maximum_amount" numeric(16, 2),
	"instructions" text,
	"config" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment"."payment_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"type" "payment"."payment_provider_type" DEFAULT 'gateway' NOT NULL,
	"status" "payment"."payment_provider_status" DEFAULT 'active' NOT NULL,
	"description" text,
	"logo_url" text,
	"config" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment"."payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_number" varchar(32) NOT NULL,
	"order_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_id" uuid,
	"method_id" uuid,
	"status" "payment"."payment_status" DEFAULT 'pending' NOT NULL,
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"amount" numeric(16, 2) NOT NULL,
	"fee_amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"net_amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"amount_paid" numeric(16, 2) DEFAULT '0' NOT NULL,
	"amount_refunded" numeric(16, 2) DEFAULT '0' NOT NULL,
	"external_reference" varchar(128),
	"checkout_url" text,
	"expires_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"failure_reason" text,
	"metadata" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment"."reconciliations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reconciliation_number" varchar(32) NOT NULL,
	"provider_id" uuid NOT NULL,
	"status" "payment"."reconciliation_status" DEFAULT 'draft' NOT NULL,
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"internal_amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"external_amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"difference_amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"matched_count" integer DEFAULT 0 NOT NULL,
	"unmatched_count" integer DEFAULT 0 NOT NULL,
	"details" jsonb,
	"notes" text,
	"reconciled_by" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment"."refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"refund_number" varchar(32) NOT NULL,
	"payment_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"return_id" uuid,
	"merchant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "payment"."refund_status" DEFAULT 'requested' NOT NULL,
	"amount" numeric(16, 2) NOT NULL,
	"reason" text NOT NULL,
	"external_reference" varchar(128),
	"failure_reason" text,
	"requested_by" uuid,
	"reviewed_by" uuid,
	"processed_by" uuid,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment"."settlement_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"settlement_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"amount" numeric(16, 2) NOT NULL,
	"fee_amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"refund_amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"net_amount" numeric(16, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment"."settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"settlement_number" varchar(32) NOT NULL,
	"merchant_id" uuid NOT NULL,
	"account_id" uuid,
	"status" "payment"."settlement_status" DEFAULT 'draft' NOT NULL,
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"gross_amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"fee_amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"refund_amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"net_amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"payment_count" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"generated_by" uuid,
	"processed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment"."merchant_payment_accounts" ADD CONSTRAINT "merchant_payment_accounts_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment"."merchant_payment_accounts" ADD CONSTRAINT "merchant_payment_accounts_provider_id_payment_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "payment"."payment_providers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment"."payment_attempts" ADD CONSTRAINT "payment_attempts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "payment"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment"."payment_events" ADD CONSTRAINT "payment_events_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "payment"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment"."payment_events" ADD CONSTRAINT "payment_events_attempt_id_payment_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "payment"."payment_attempts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment"."payment_events" ADD CONSTRAINT "payment_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment"."payment_methods" ADD CONSTRAINT "payment_methods_provider_id_payment_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "payment"."payment_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment"."payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "commerce"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment"."payments" ADD CONSTRAINT "payments_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment"."payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment"."payments" ADD CONSTRAINT "payments_provider_id_payment_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "payment"."payment_providers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment"."payments" ADD CONSTRAINT "payments_method_id_payment_methods_id_fk" FOREIGN KEY ("method_id") REFERENCES "payment"."payment_methods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment"."payments" ADD CONSTRAINT "payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment"."reconciliations" ADD CONSTRAINT "reconciliations_provider_id_payment_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "payment"."payment_providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment"."reconciliations" ADD CONSTRAINT "reconciliations_reconciled_by_users_id_fk" FOREIGN KEY ("reconciled_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment"."refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "payment"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment"."refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "commerce"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment"."refunds" ADD CONSTRAINT "refunds_return_id_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "commerce"."returns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment"."refunds" ADD CONSTRAINT "refunds_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment"."refunds" ADD CONSTRAINT "refunds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment"."refunds" ADD CONSTRAINT "refunds_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment"."refunds" ADD CONSTRAINT "refunds_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment"."refunds" ADD CONSTRAINT "refunds_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment"."settlement_items" ADD CONSTRAINT "settlement_items_settlement_id_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "payment"."settlements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment"."settlement_items" ADD CONSTRAINT "settlement_items_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "payment"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment"."settlements" ADD CONSTRAINT "settlements_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment"."settlements" ADD CONSTRAINT "settlements_account_id_merchant_payment_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "payment"."merchant_payment_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment"."settlements" ADD CONSTRAINT "settlements_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "merchant_payment_accounts_merchant_idx" ON "payment"."merchant_payment_accounts" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "merchant_payment_accounts_status_idx" ON "payment"."merchant_payment_accounts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_payment_accounts_default_uq" ON "payment"."merchant_payment_accounts" USING btree ("merchant_id") WHERE is_default = true;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_number_uq" ON "payment"."payment_attempts" USING btree ("payment_id","attempt_number");--> statement-breakpoint
CREATE INDEX "payment_attempts_payment_idx" ON "payment"."payment_attempts" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payment_attempts_status_idx" ON "payment"."payment_attempts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_attempts_created_idx" ON "payment"."payment_attempts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "payment_events_payment_idx" ON "payment"."payment_events" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payment_events_type_idx" ON "payment"."payment_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "payment_events_created_idx" ON "payment"."payment_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_methods_provider_code_uq" ON "payment"."payment_methods" USING btree ("provider_id","code");--> statement-breakpoint
CREATE INDEX "payment_methods_provider_idx" ON "payment"."payment_methods" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "payment_methods_status_idx" ON "payment"."payment_methods" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_methods_type_idx" ON "payment"."payment_methods" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_providers_code_uq" ON "payment"."payment_providers" USING btree ("code");--> statement-breakpoint
CREATE INDEX "payment_providers_status_idx" ON "payment"."payment_providers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_providers_type_idx" ON "payment"."payment_providers" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_number_uq" ON "payment"."payments" USING btree ("payment_number");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_order_uq" ON "payment"."payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_merchant_idx" ON "payment"."payments" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "payments_customer_idx" ON "payment"."payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payment"."payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_provider_idx" ON "payment"."payments" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "payments_method_idx" ON "payment"."payments" USING btree ("method_id");--> statement-breakpoint
CREATE INDEX "payments_created_idx" ON "payment"."payments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "payments_paid_idx" ON "payment"."payments" USING btree ("paid_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reconciliations_number_uq" ON "payment"."reconciliations" USING btree ("reconciliation_number");--> statement-breakpoint
CREATE INDEX "reconciliations_provider_idx" ON "payment"."reconciliations" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "reconciliations_status_idx" ON "payment"."reconciliations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reconciliations_period_idx" ON "payment"."reconciliations" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_number_uq" ON "payment"."refunds" USING btree ("refund_number");--> statement-breakpoint
CREATE INDEX "refunds_payment_idx" ON "payment"."refunds" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "refunds_order_idx" ON "payment"."refunds" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "refunds_return_idx" ON "payment"."refunds" USING btree ("return_id");--> statement-breakpoint
CREATE INDEX "refunds_merchant_idx" ON "payment"."refunds" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "refunds_customer_idx" ON "payment"."refunds" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refunds_status_idx" ON "payment"."refunds" USING btree ("status");--> statement-breakpoint
CREATE INDEX "refunds_requested_idx" ON "payment"."refunds" USING btree ("requested_at");--> statement-breakpoint
CREATE UNIQUE INDEX "settlement_items_payment_uq" ON "payment"."settlement_items" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "settlement_items_settlement_payment_uq" ON "payment"."settlement_items" USING btree ("settlement_id","payment_id");--> statement-breakpoint
CREATE INDEX "settlement_items_settlement_idx" ON "payment"."settlement_items" USING btree ("settlement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "settlements_number_uq" ON "payment"."settlements" USING btree ("settlement_number");--> statement-breakpoint
CREATE INDEX "settlements_merchant_idx" ON "payment"."settlements" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "settlements_status_idx" ON "payment"."settlements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "settlements_period_idx" ON "payment"."settlements" USING btree ("period_start","period_end");