CREATE SCHEMA "business";
--> statement-breakpoint
CREATE SCHEMA "funding";
--> statement-breakpoint
CREATE TYPE "business"."business_document_status" AS ENUM('pending', 'verified', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "business"."business_legal_status" AS ENUM('informal', 'micro', 'small', 'medium', 'cooperative', 'limited_company', 'other');--> statement-breakpoint
CREATE TYPE "business"."business_location_type" AS ENUM('headquarters', 'branch', 'store', 'warehouse', 'production', 'other');--> statement-breakpoint
CREATE TYPE "business"."business_profile_share_status" AS ENUM('active', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "business"."business_profile_status" AS ENUM('draft', 'active', 'verified', 'suspended', 'archived');--> statement-breakpoint
CREATE TYPE "business"."business_target_status" AS ENUM('active', 'achieved', 'missed', 'cancelled');--> statement-breakpoint
CREATE TYPE "business"."business_verification_status" AS ENUM('pending', 'in_review', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "business"."kpi_category" AS ENUM('revenue', 'transaction', 'customer', 'product', 'margin', 'growth', 'operational', 'other');--> statement-breakpoint
CREATE TYPE "business"."kpi_direction" AS ENUM('higher_better', 'lower_better');--> statement-breakpoint
CREATE TYPE "business"."kpi_value_type" AS ENUM('currency', 'number', 'percentage', 'ratio');--> statement-breakpoint
CREATE TYPE "business"."performance_period_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "business"."performance_period_type" AS ENUM('daily', 'weekly', 'monthly', 'quarterly', 'yearly');--> statement-breakpoint
CREATE TYPE "business"."performance_report_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "funding"."financing_agreement_status" AS ENUM('draft', 'signed', 'active', 'terminated');--> statement-breakpoint
CREATE TYPE "funding"."business_plan_status" AS ENUM('draft', 'approved', 'archived');--> statement-breakpoint
CREATE TYPE "funding"."data_room_access_status" AS ENUM('active', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "funding"."data_room_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "funding"."disbursement_status" AS ENUM('pending', 'confirmed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "funding"."financial_projection_type" AS ENUM('revenue', 'expense', 'profit', 'cash_flow', 'other');--> statement-breakpoint
CREATE TYPE "funding"."financing_status" AS ENUM('draft', 'active', 'disbursing', 'closed', 'defaulted', 'cancelled');--> statement-breakpoint
CREATE TYPE "funding"."financing_type" AS ENUM('loan', 'equity', 'grant', 'revenue_sharing', 'lease', 'other');--> statement-breakpoint
CREATE TYPE "funding"."fund_utilization_plan_status" AS ENUM('planned', 'approved', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "funding"."funding_application_status" AS ENUM('draft', 'submitted', 'under_review', 'shortlisted', 'approved', 'rejected', 'withdrawn', 'funded');--> statement-breakpoint
CREATE TYPE "funding"."funding_document_status" AS ENUM('pending', 'verified', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "funding"."funding_instrument_type" AS ENUM('equity', 'debt', 'grant', 'convertible_note', 'revenue_sharing', 'other');--> statement-breakpoint
CREATE TYPE "funding"."funding_match_status" AS ENUM('suggested', 'interested', 'accepted', 'declined', 'closed');--> statement-breakpoint
CREATE TYPE "funding"."funding_opportunity_status" AS ENUM('draft', 'open', 'closed', 'archived');--> statement-breakpoint
CREATE TYPE "funding"."funding_requirement_type" AS ENUM('equity', 'debt', 'grant', 'working_capital', 'asset', 'other');--> statement-breakpoint
CREATE TYPE "funding"."investor_interest_status" AS ENUM('new', 'reviewing', 'interested', 'declined', 'converted', 'withdrawn');--> statement-breakpoint
CREATE TYPE "funding"."investor_status" AS ENUM('active', 'inactive', 'suspended');--> statement-breakpoint
CREATE TYPE "funding"."investor_type" AS ENUM('individual', 'angel', 'venture_capital', 'private_equity', 'bank', 'cooperative', 'government', 'other');--> statement-breakpoint
CREATE TYPE "funding"."monitoring_status" AS ENUM('draft', 'submitted', 'reviewed', 'flagged');--> statement-breakpoint
CREATE TYPE "funding"."proposal_status" AS ENUM('draft', 'in_review', 'submitted', 'published', 'funded', 'rejected', 'archived');--> statement-breakpoint
CREATE TYPE "funding"."proposal_version_status" AS ENUM('draft', 'final', 'archived');--> statement-breakpoint
CREATE TYPE "funding"."referral_status" AS ENUM('pending', 'contacted', 'converted', 'rejected');--> statement-breakpoint
CREATE TYPE "funding"."repayment_status" AS ENUM('scheduled', 'due', 'paid', 'overdue', 'waived', 'cancelled');--> statement-breakpoint
CREATE TYPE "funding"."repayment_transaction_status" AS ENUM('pending', 'completed', 'failed', 'reversed');--> statement-breakpoint
CREATE TYPE "funding"."risk_assessment_status" AS ENUM('draft', 'final');--> statement-breakpoint
CREATE TYPE "funding"."risk_indicator_type" AS ENUM('financial', 'operational', 'market', 'compliance', 'repayment', 'other');--> statement-breakpoint
CREATE TYPE "funding"."risk_level" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "funding"."utilization_report_status" AS ENUM('draft', 'submitted', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "business"."business_activity_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"activity_date" date NOT NULL,
	"activity_type" varchar(64) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"amount" numeric(18, 2),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business"."business_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"event_date" date NOT NULL,
	"category" varchar(64),
	"source" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business"."business_kpi_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"kpi_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"value" numeric(20, 4) DEFAULT '0' NOT NULL,
	"target_value" numeric(20, 4),
	"previous_value" numeric(20, 4),
	"achievement_percent" numeric(8, 2),
	"notes" text,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business"."business_kpis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"category" "business"."kpi_category" DEFAULT 'other' NOT NULL,
	"value_type" "business"."kpi_value_type" DEFAULT 'number' NOT NULL,
	"unit" varchar(32),
	"direction" "business"."kpi_direction" DEFAULT 'higher_better' NOT NULL,
	"formula" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business"."business_legal_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"document_type" varchar(64) NOT NULL,
	"document_number" varchar(128),
	"title" varchar(255) NOT NULL,
	"issued_at" date,
	"expires_at" date,
	"issuer" varchar(255),
	"file_name" varchar(255),
	"file_url" text,
	"status" "business"."business_document_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business"."business_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "business"."business_location_type" DEFAULT 'branch' NOT NULL,
	"address" text,
	"city" varchar(128),
	"province" varchar(128),
	"postal_code" varchar(16),
	"country" varchar(2) DEFAULT 'ID' NOT NULL,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"phone" varchar(32),
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"opening_hours" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business"."business_profile_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"shared_with_user_id" uuid,
	"shared_with_email" varchar(255),
	"token_hash" varchar(64) NOT NULL,
	"permissions" jsonb,
	"status" "business"."business_profile_share_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"last_accessed_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business"."business_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"tagline" varchar(255),
	"description" text,
	"legal_name" varchar(255),
	"legal_status" "business"."business_legal_status" DEFAULT 'informal' NOT NULL,
	"business_type" varchar(128),
	"founded_at" date,
	"employee_count" integer,
	"annual_revenue" numeric(18, 2),
	"website" varchar(255),
	"email" varchar(255),
	"phone" varchar(32),
	"logo_url" text,
	"cover_url" text,
	"address" text,
	"city" varchar(128),
	"province" varchar(128),
	"postal_code" varchar(16),
	"country" varchar(2) DEFAULT 'ID' NOT NULL,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"status" "business"."business_profile_status" DEFAULT 'draft' NOT NULL,
	"verification_status" "business"."business_verification_status" DEFAULT 'pending' NOT NULL,
	"completeness" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"metadata" jsonb,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "business"."business_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"period_id" uuid,
	"kpi_id" uuid,
	"name" varchar(255) NOT NULL,
	"target_value" numeric(20, 4) NOT NULL,
	"actual_value" numeric(20, 4) DEFAULT '0' NOT NULL,
	"unit" varchar(32),
	"start_date" date,
	"end_date" date,
	"status" "business"."business_target_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business"."business_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"status" "business"."business_verification_status" DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"checklist" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business"."growth_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"snapshot_date" date NOT NULL,
	"metric_type" varchar(64) NOT NULL,
	"current_value" numeric(20, 4) DEFAULT '0' NOT NULL,
	"previous_value" numeric(20, 4),
	"growth_percent" numeric(8, 2),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business"."merchant_performance_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"report_number" varchar(64) NOT NULL,
	"title" varchar(255) NOT NULL,
	"summary" text,
	"revenue" numeric(18, 2) DEFAULT '0' NOT NULL,
	"order_count" integer DEFAULT 0 NOT NULL,
	"customer_count" integer DEFAULT 0 NOT NULL,
	"product_count" integer DEFAULT 0 NOT NULL,
	"gross_margin" numeric(18, 2),
	"growth_percent" numeric(8, 2),
	"score" numeric(8, 2),
	"status" "business"."performance_report_status" DEFAULT 'draft' NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"data" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business"."performance_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"type" "business"."performance_period_type" DEFAULT 'monthly' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" "business"."performance_period_status" DEFAULT 'open' NOT NULL,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding"."business_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"proposal_id" uuid,
	"profile_id" uuid,
	"document_type" varchar(64) NOT NULL,
	"title" varchar(255) NOT NULL,
	"file_name" varchar(255),
	"file_url" text,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "funding"."funding_document_status" DEFAULT 'pending' NOT NULL,
	"is_confidential" boolean DEFAULT false NOT NULL,
	"expires_at" date,
	"uploaded_by" uuid,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding"."business_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"executive_summary" text,
	"market_analysis" text,
	"business_model" text,
	"strategy" text,
	"team" text,
	"milestones" jsonb,
	"status" "funding"."business_plan_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding"."business_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"profile_id" uuid,
	"code" varchar(64) NOT NULL,
	"title" varchar(255) NOT NULL,
	"summary" text,
	"status" "funding"."proposal_status" DEFAULT 'draft' NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"target_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"valuation" numeric(18, 2),
	"equity_offered" numeric(8, 2),
	"funding_type" "funding"."funding_instrument_type" DEFAULT 'equity' NOT NULL,
	"submitted_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "funding"."data_room_access_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_room_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"user_id" uuid,
	"email" varchar(255),
	"action" varchar(64) DEFAULT 'view' NOT NULL,
	"status" "funding"."data_room_access_status" DEFAULT 'active' NOT NULL,
	"ip_address" varchar(64),
	"user_agent" text,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding"."data_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" "funding"."data_room_status" DEFAULT 'draft' NOT NULL,
	"access_level" varchar(32) DEFAULT 'private' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding"."disbursement_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"financing_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"disbursement_number" varchar(64) NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"status" "funding"."disbursement_status" DEFAULT 'pending' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"disbursed_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"reference" varchar(128),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding"."financial_projections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"projection_type" "funding"."financial_projection_type" NOT NULL,
	"period_label" varchar(64) NOT NULL,
	"period_start" date,
	"period_end" date,
	"amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"assumptions" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding"."financing_agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"financing_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"agreement_number" varchar(64) NOT NULL,
	"title" varchar(255) NOT NULL,
	"signed_at" timestamp with time zone,
	"effective_at" date,
	"expires_at" date,
	"file_url" text,
	"status" "funding"."financing_agreement_status" DEFAULT 'draft' NOT NULL,
	"terms" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding"."financing_monitoring_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"financing_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"report_number" varchar(64) NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"revenue" numeric(18, 2) DEFAULT '0' NOT NULL,
	"profit" numeric(18, 2) DEFAULT '0' NOT NULL,
	"cash_flow" numeric(18, 2) DEFAULT '0' NOT NULL,
	"repayment_capacity" numeric(18, 2),
	"risk_level" "funding"."risk_level" DEFAULT 'low' NOT NULL,
	"status" "funding"."monitoring_status" DEFAULT 'draft' NOT NULL,
	"findings" text,
	"recommendation" text,
	"submitted_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding"."financing_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"application_id" uuid,
	"proposal_id" uuid,
	"investor_profile_id" uuid,
	"facility_number" varchar(64) NOT NULL,
	"title" varchar(255) NOT NULL,
	"financing_type" "funding"."financing_type" DEFAULT 'loan' NOT NULL,
	"principal_amount" numeric(18, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"interest_rate" numeric(8, 2),
	"equity_percent" numeric(8, 2),
	"tenor_months" integer,
	"status" "funding"."financing_status" DEFAULT 'draft' NOT NULL,
	"start_date" date,
	"end_date" date,
	"closed_at" timestamp with time zone,
	"defaulted_at" timestamp with time zone,
	"notes" text,
	"metadata" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding"."fund_utilization_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"category" varchar(128) NOT NULL,
	"description" text,
	"amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"percentage" numeric(6, 2),
	"timeline" varchar(128),
	"status" "funding"."fund_utilization_plan_status" DEFAULT 'planned' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding"."fund_utilization_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"financing_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"report_number" varchar(64) NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"total_used" numeric(18, 2) DEFAULT '0' NOT NULL,
	"description" text,
	"breakdown" jsonb,
	"status" "funding"."utilization_report_status" DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding"."funding_application_statuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"from_status" "funding"."funding_application_status",
	"to_status" "funding"."funding_application_status" NOT NULL,
	"note" text,
	"changed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding"."funding_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"proposal_id" uuid NOT NULL,
	"opportunity_id" uuid,
	"investor_profile_id" uuid,
	"application_number" varchar(64) NOT NULL,
	"requested_amount" numeric(18, 2) NOT NULL,
	"approved_amount" numeric(18, 2),
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"status" "funding"."funding_application_status" DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"decision_notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding"."funding_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"application_id" uuid,
	"opportunity_id" uuid,
	"investor_profile_id" uuid,
	"score" numeric(5, 2),
	"status" "funding"."funding_match_status" DEFAULT 'suggested' NOT NULL,
	"matched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding"."funding_opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"instrument_type" "funding"."funding_instrument_type" DEFAULT 'equity' NOT NULL,
	"provider_name" varchar(255) NOT NULL,
	"provider_type" "funding"."investor_type" DEFAULT 'other' NOT NULL,
	"min_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"max_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"interest_rate" numeric(8, 2),
	"equity_percent" numeric(8, 2),
	"tenor_months" integer,
	"eligibility" jsonb,
	"requirements" text,
	"status" "funding"."funding_opportunity_status" DEFAULT 'draft' NOT NULL,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"owner_user_id" uuid,
	"organization_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding"."funding_partner_referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"application_id" uuid,
	"opportunity_id" uuid,
	"partner_name" varchar(255) NOT NULL,
	"partner_type" "funding"."investor_type" DEFAULT 'other' NOT NULL,
	"contact_name" varchar(255),
	"contact_email" varchar(255),
	"contact_phone" varchar(32),
	"status" "funding"."referral_status" DEFAULT 'pending' NOT NULL,
	"referral_code" varchar(64),
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding"."funding_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"requirement_type" "funding"."funding_requirement_type" DEFAULT 'equity' NOT NULL,
	"purpose" text NOT NULL,
	"amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"min_amount" numeric(18, 2),
	"max_amount" numeric(18, 2),
	"equity_percent" numeric(8, 2),
	"tenor_months" integer,
	"expected_return_percent" numeric(8, 2),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding"."investor_interests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"investor_profile_id" uuid NOT NULL,
	"proposal_id" uuid,
	"opportunity_id" uuid,
	"application_id" uuid,
	"status" "funding"."investor_interest_status" DEFAULT 'new' NOT NULL,
	"message" text,
	"amount" numeric(18, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding"."investor_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"organization_id" uuid,
	"display_name" varchar(255) NOT NULL,
	"investor_type" "funding"."investor_type" DEFAULT 'individual' NOT NULL,
	"status" "funding"."investor_status" DEFAULT 'active' NOT NULL,
	"email" varchar(255),
	"phone" varchar(32),
	"website" varchar(255),
	"description" text,
	"investment_focus" jsonb,
	"min_ticket" numeric(18, 2),
	"max_ticket" numeric(18, 2),
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"preferred_stages" jsonb,
	"preferred_sectors" jsonb,
	"verified_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding"."proposal_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"summary" text,
	"content" text,
	"change_notes" text,
	"file_url" text,
	"status" "funding"."proposal_version_status" DEFAULT 'draft' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding"."repayment_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"financing_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"installment_number" integer NOT NULL,
	"due_date" date NOT NULL,
	"principal_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"interest_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"fee_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(18, 2) NOT NULL,
	"paid_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"status" "funding"."repayment_status" DEFAULT 'scheduled' NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding"."repayment_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" uuid NOT NULL,
	"financing_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"transaction_number" varchar(64) NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"status" "funding"."repayment_transaction_status" DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp with time zone,
	"method" varchar(64),
	"reference" varchar(128),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding"."risk_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"financing_id" uuid,
	"indicator_id" uuid,
	"assessment_date" date NOT NULL,
	"score" numeric(8, 2) DEFAULT '0' NOT NULL,
	"risk_level" "funding"."risk_level" DEFAULT 'low' NOT NULL,
	"status" "funding"."risk_assessment_status" DEFAULT 'draft' NOT NULL,
	"findings" text,
	"mitigation" text,
	"assessed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding"."risk_indicators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" "funding"."risk_indicator_type" DEFAULT 'other' NOT NULL,
	"description" text,
	"threshold_low" numeric(18, 4),
	"threshold_medium" numeric(18, 4),
	"threshold_high" numeric(18, 4),
	"unit" varchar(32),
	"direction" varchar(32) DEFAULT 'higher_better' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "business"."business_activity_records" ADD CONSTRAINT "business_activity_records_profile_id_business_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "business"."business_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business"."business_activity_records" ADD CONSTRAINT "business_activity_records_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business"."business_history" ADD CONSTRAINT "business_history_profile_id_business_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "business"."business_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business"."business_history" ADD CONSTRAINT "business_history_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business"."business_kpi_values" ADD CONSTRAINT "business_kpi_values_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business"."business_kpi_values" ADD CONSTRAINT "business_kpi_values_kpi_id_business_kpis_id_fk" FOREIGN KEY ("kpi_id") REFERENCES "business"."business_kpis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business"."business_kpi_values" ADD CONSTRAINT "business_kpi_values_period_id_performance_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "business"."performance_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business"."business_kpis" ADD CONSTRAINT "business_kpis_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business"."business_legal_documents" ADD CONSTRAINT "business_legal_documents_profile_id_business_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "business"."business_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business"."business_legal_documents" ADD CONSTRAINT "business_legal_documents_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business"."business_legal_documents" ADD CONSTRAINT "business_legal_documents_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business"."business_locations" ADD CONSTRAINT "business_locations_profile_id_business_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "business"."business_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business"."business_locations" ADD CONSTRAINT "business_locations_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business"."business_profile_shares" ADD CONSTRAINT "business_profile_shares_profile_id_business_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "business"."business_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business"."business_profile_shares" ADD CONSTRAINT "business_profile_shares_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business"."business_profile_shares" ADD CONSTRAINT "business_profile_shares_shared_with_user_id_users_id_fk" FOREIGN KEY ("shared_with_user_id") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business"."business_profile_shares" ADD CONSTRAINT "business_profile_shares_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business"."business_profiles" ADD CONSTRAINT "business_profiles_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business"."business_profiles" ADD CONSTRAINT "business_profiles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business"."business_profiles" ADD CONSTRAINT "business_profiles_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business"."business_targets" ADD CONSTRAINT "business_targets_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business"."business_targets" ADD CONSTRAINT "business_targets_period_id_performance_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "business"."performance_periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business"."business_targets" ADD CONSTRAINT "business_targets_kpi_id_business_kpis_id_fk" FOREIGN KEY ("kpi_id") REFERENCES "business"."business_kpis"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business"."business_verifications" ADD CONSTRAINT "business_verifications_profile_id_business_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "business"."business_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business"."business_verifications" ADD CONSTRAINT "business_verifications_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business"."business_verifications" ADD CONSTRAINT "business_verifications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business"."growth_snapshots" ADD CONSTRAINT "growth_snapshots_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business"."growth_snapshots" ADD CONSTRAINT "growth_snapshots_period_id_performance_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "business"."performance_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business"."merchant_performance_reports" ADD CONSTRAINT "merchant_performance_reports_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business"."merchant_performance_reports" ADD CONSTRAINT "merchant_performance_reports_period_id_performance_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "business"."performance_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business"."merchant_performance_reports" ADD CONSTRAINT "merchant_performance_reports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business"."performance_periods" ADD CONSTRAINT "performance_periods_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business"."performance_periods" ADD CONSTRAINT "performance_periods_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."business_documents" ADD CONSTRAINT "business_documents_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."business_documents" ADD CONSTRAINT "business_documents_proposal_id_business_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "funding"."business_proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."business_documents" ADD CONSTRAINT "business_documents_profile_id_business_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "business"."business_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."business_documents" ADD CONSTRAINT "business_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."business_documents" ADD CONSTRAINT "business_documents_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."business_plans" ADD CONSTRAINT "business_plans_proposal_id_business_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "funding"."business_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."business_plans" ADD CONSTRAINT "business_plans_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."business_proposals" ADD CONSTRAINT "business_proposals_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."business_proposals" ADD CONSTRAINT "business_proposals_profile_id_business_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "business"."business_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."business_proposals" ADD CONSTRAINT "business_proposals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."data_room_access_logs" ADD CONSTRAINT "data_room_access_logs_data_room_id_data_rooms_id_fk" FOREIGN KEY ("data_room_id") REFERENCES "funding"."data_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."data_room_access_logs" ADD CONSTRAINT "data_room_access_logs_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."data_room_access_logs" ADD CONSTRAINT "data_room_access_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."data_rooms" ADD CONSTRAINT "data_rooms_proposal_id_business_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "funding"."business_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."data_rooms" ADD CONSTRAINT "data_rooms_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."data_rooms" ADD CONSTRAINT "data_rooms_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."disbursement_records" ADD CONSTRAINT "disbursement_records_financing_id_financing_records_id_fk" FOREIGN KEY ("financing_id") REFERENCES "funding"."financing_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."disbursement_records" ADD CONSTRAINT "disbursement_records_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."financial_projections" ADD CONSTRAINT "financial_projections_proposal_id_business_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "funding"."business_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."financial_projections" ADD CONSTRAINT "financial_projections_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."financing_agreements" ADD CONSTRAINT "financing_agreements_financing_id_financing_records_id_fk" FOREIGN KEY ("financing_id") REFERENCES "funding"."financing_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."financing_agreements" ADD CONSTRAINT "financing_agreements_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."financing_monitoring_reports" ADD CONSTRAINT "financing_monitoring_reports_financing_id_financing_records_id_fk" FOREIGN KEY ("financing_id") REFERENCES "funding"."financing_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."financing_monitoring_reports" ADD CONSTRAINT "financing_monitoring_reports_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."financing_records" ADD CONSTRAINT "financing_records_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."financing_records" ADD CONSTRAINT "financing_records_application_id_funding_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "funding"."funding_applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."financing_records" ADD CONSTRAINT "financing_records_proposal_id_business_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "funding"."business_proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."financing_records" ADD CONSTRAINT "financing_records_investor_profile_id_investor_profiles_id_fk" FOREIGN KEY ("investor_profile_id") REFERENCES "funding"."investor_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."financing_records" ADD CONSTRAINT "financing_records_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."fund_utilization_plans" ADD CONSTRAINT "fund_utilization_plans_proposal_id_business_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "funding"."business_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."fund_utilization_plans" ADD CONSTRAINT "fund_utilization_plans_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."fund_utilization_reports" ADD CONSTRAINT "fund_utilization_reports_financing_id_financing_records_id_fk" FOREIGN KEY ("financing_id") REFERENCES "funding"."financing_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."fund_utilization_reports" ADD CONSTRAINT "fund_utilization_reports_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."fund_utilization_reports" ADD CONSTRAINT "fund_utilization_reports_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."funding_application_statuses" ADD CONSTRAINT "funding_application_statuses_application_id_funding_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "funding"."funding_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."funding_application_statuses" ADD CONSTRAINT "funding_application_statuses_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."funding_application_statuses" ADD CONSTRAINT "funding_application_statuses_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."funding_applications" ADD CONSTRAINT "funding_applications_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."funding_applications" ADD CONSTRAINT "funding_applications_proposal_id_business_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "funding"."business_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."funding_applications" ADD CONSTRAINT "funding_applications_opportunity_id_funding_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "funding"."funding_opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."funding_applications" ADD CONSTRAINT "funding_applications_investor_profile_id_investor_profiles_id_fk" FOREIGN KEY ("investor_profile_id") REFERENCES "funding"."investor_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."funding_applications" ADD CONSTRAINT "funding_applications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."funding_matches" ADD CONSTRAINT "funding_matches_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."funding_matches" ADD CONSTRAINT "funding_matches_application_id_funding_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "funding"."funding_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."funding_matches" ADD CONSTRAINT "funding_matches_opportunity_id_funding_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "funding"."funding_opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."funding_matches" ADD CONSTRAINT "funding_matches_investor_profile_id_investor_profiles_id_fk" FOREIGN KEY ("investor_profile_id") REFERENCES "funding"."investor_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."funding_opportunities" ADD CONSTRAINT "funding_opportunities_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."funding_opportunities" ADD CONSTRAINT "funding_opportunities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."funding_partner_referrals" ADD CONSTRAINT "funding_partner_referrals_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."funding_partner_referrals" ADD CONSTRAINT "funding_partner_referrals_application_id_funding_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "funding"."funding_applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."funding_partner_referrals" ADD CONSTRAINT "funding_partner_referrals_opportunity_id_funding_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "funding"."funding_opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."funding_partner_referrals" ADD CONSTRAINT "funding_partner_referrals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."funding_requirements" ADD CONSTRAINT "funding_requirements_proposal_id_business_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "funding"."business_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."funding_requirements" ADD CONSTRAINT "funding_requirements_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."investor_interests" ADD CONSTRAINT "investor_interests_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."investor_interests" ADD CONSTRAINT "investor_interests_investor_profile_id_investor_profiles_id_fk" FOREIGN KEY ("investor_profile_id") REFERENCES "funding"."investor_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."investor_interests" ADD CONSTRAINT "investor_interests_proposal_id_business_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "funding"."business_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."investor_interests" ADD CONSTRAINT "investor_interests_opportunity_id_funding_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "funding"."funding_opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."investor_interests" ADD CONSTRAINT "investor_interests_application_id_funding_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "funding"."funding_applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."investor_profiles" ADD CONSTRAINT "investor_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."investor_profiles" ADD CONSTRAINT "investor_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."investor_profiles" ADD CONSTRAINT "investor_profiles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."proposal_versions" ADD CONSTRAINT "proposal_versions_proposal_id_business_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "funding"."business_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."proposal_versions" ADD CONSTRAINT "proposal_versions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."proposal_versions" ADD CONSTRAINT "proposal_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."repayment_schedules" ADD CONSTRAINT "repayment_schedules_financing_id_financing_records_id_fk" FOREIGN KEY ("financing_id") REFERENCES "funding"."financing_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."repayment_schedules" ADD CONSTRAINT "repayment_schedules_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."repayment_transactions" ADD CONSTRAINT "repayment_transactions_schedule_id_repayment_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "funding"."repayment_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."repayment_transactions" ADD CONSTRAINT "repayment_transactions_financing_id_financing_records_id_fk" FOREIGN KEY ("financing_id") REFERENCES "funding"."financing_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."repayment_transactions" ADD CONSTRAINT "repayment_transactions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."risk_assessments" ADD CONSTRAINT "risk_assessments_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."risk_assessments" ADD CONSTRAINT "risk_assessments_financing_id_financing_records_id_fk" FOREIGN KEY ("financing_id") REFERENCES "funding"."financing_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."risk_assessments" ADD CONSTRAINT "risk_assessments_indicator_id_risk_indicators_id_fk" FOREIGN KEY ("indicator_id") REFERENCES "funding"."risk_indicators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."risk_assessments" ADD CONSTRAINT "risk_assessments_assessed_by_users_id_fk" FOREIGN KEY ("assessed_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding"."risk_indicators" ADD CONSTRAINT "risk_indicators_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "business_activity_profile_idx" ON "business"."business_activity_records" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "business_activity_merchant_date_idx" ON "business"."business_activity_records" USING btree ("merchant_id","activity_date");--> statement-breakpoint
CREATE INDEX "business_history_profile_idx" ON "business"."business_history" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "business_history_merchant_date_idx" ON "business"."business_history" USING btree ("merchant_id","event_date");--> statement-breakpoint
CREATE UNIQUE INDEX "business_kpi_values_period_uq" ON "business"."business_kpi_values" USING btree ("kpi_id","period_id");--> statement-breakpoint
CREATE INDEX "business_kpi_values_merchant_idx" ON "business"."business_kpi_values" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "business_kpi_values_period_idx" ON "business"."business_kpi_values" USING btree ("period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "business_kpis_code_uq" ON "business"."business_kpis" USING btree ("merchant_id","code");--> statement-breakpoint
CREATE INDEX "business_kpis_merchant_idx" ON "business"."business_kpis" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "business_kpis_category_idx" ON "business"."business_kpis" USING btree ("category");--> statement-breakpoint
CREATE INDEX "business_legal_docs_profile_idx" ON "business"."business_legal_documents" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "business_legal_docs_status_idx" ON "business"."business_legal_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "business_locations_profile_idx" ON "business"."business_locations" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "business_locations_merchant_idx" ON "business"."business_locations" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "business_profile_shares_token_uq" ON "business"."business_profile_shares" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "business_profile_shares_profile_idx" ON "business"."business_profile_shares" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "business_profile_shares_status_idx" ON "business"."business_profile_shares" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "business_profiles_merchant_uq" ON "business"."business_profiles" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "business_profiles_code_uq" ON "business"."business_profiles" USING btree ("merchant_id","code");--> statement-breakpoint
CREATE INDEX "business_profiles_status_idx" ON "business"."business_profiles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "business_profiles_verification_idx" ON "business"."business_profiles" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "business_targets_merchant_idx" ON "business"."business_targets" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "business_targets_period_idx" ON "business"."business_targets" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "business_targets_status_idx" ON "business"."business_targets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "business_verifications_profile_idx" ON "business"."business_verifications" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "business_verifications_status_idx" ON "business"."business_verifications" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "growth_snapshots_metric_uq" ON "business"."growth_snapshots" USING btree ("period_id","metric_type");--> statement-breakpoint
CREATE INDEX "growth_snapshots_merchant_idx" ON "business"."growth_snapshots" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_performance_reports_number_uq" ON "business"."merchant_performance_reports" USING btree ("merchant_id","report_number");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_performance_reports_period_uq" ON "business"."merchant_performance_reports" USING btree ("merchant_id","period_id");--> statement-breakpoint
CREATE INDEX "merchant_performance_reports_status_idx" ON "business"."merchant_performance_reports" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "performance_periods_code_uq" ON "business"."performance_periods" USING btree ("merchant_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "performance_periods_range_uq" ON "business"."performance_periods" USING btree ("merchant_id","type","start_date","end_date");--> statement-breakpoint
CREATE INDEX "performance_periods_merchant_idx" ON "business"."performance_periods" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "business_documents_merchant_idx" ON "funding"."business_documents" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "business_documents_proposal_idx" ON "funding"."business_documents" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "business_documents_status_idx" ON "funding"."business_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "business_plans_proposal_idx" ON "funding"."business_plans" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "business_plans_merchant_idx" ON "funding"."business_plans" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "business_proposals_code_uq" ON "funding"."business_proposals" USING btree ("merchant_id","code");--> statement-breakpoint
CREATE INDEX "business_proposals_merchant_idx" ON "funding"."business_proposals" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "business_proposals_status_idx" ON "funding"."business_proposals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "data_room_access_room_idx" ON "funding"."data_room_access_logs" USING btree ("data_room_id");--> statement-breakpoint
CREATE INDEX "data_room_access_merchant_idx" ON "funding"."data_room_access_logs" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "data_rooms_proposal_uq" ON "funding"."data_rooms" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "data_rooms_merchant_idx" ON "funding"."data_rooms" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "disbursement_records_number_uq" ON "funding"."disbursement_records" USING btree ("merchant_id","disbursement_number");--> statement-breakpoint
CREATE INDEX "disbursement_records_financing_idx" ON "funding"."disbursement_records" USING btree ("financing_id");--> statement-breakpoint
CREATE INDEX "disbursement_records_status_idx" ON "funding"."disbursement_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "financial_projections_proposal_idx" ON "funding"."financial_projections" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "financial_projections_type_idx" ON "funding"."financial_projections" USING btree ("projection_type");--> statement-breakpoint
CREATE UNIQUE INDEX "financing_agreements_number_uq" ON "funding"."financing_agreements" USING btree ("merchant_id","agreement_number");--> statement-breakpoint
CREATE INDEX "financing_agreements_financing_idx" ON "funding"."financing_agreements" USING btree ("financing_id");--> statement-breakpoint
CREATE UNIQUE INDEX "financing_monitoring_reports_number_uq" ON "funding"."financing_monitoring_reports" USING btree ("merchant_id","report_number");--> statement-breakpoint
CREATE INDEX "financing_monitoring_reports_financing_idx" ON "funding"."financing_monitoring_reports" USING btree ("financing_id");--> statement-breakpoint
CREATE INDEX "financing_monitoring_reports_risk_idx" ON "funding"."financing_monitoring_reports" USING btree ("risk_level");--> statement-breakpoint
CREATE UNIQUE INDEX "financing_records_number_uq" ON "funding"."financing_records" USING btree ("merchant_id","facility_number");--> statement-breakpoint
CREATE INDEX "financing_records_merchant_idx" ON "funding"."financing_records" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "financing_records_status_idx" ON "funding"."financing_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fund_utilization_plans_proposal_idx" ON "funding"."fund_utilization_plans" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "fund_utilization_plans_merchant_idx" ON "funding"."fund_utilization_plans" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fund_utilization_reports_number_uq" ON "funding"."fund_utilization_reports" USING btree ("merchant_id","report_number");--> statement-breakpoint
CREATE INDEX "fund_utilization_reports_financing_idx" ON "funding"."fund_utilization_reports" USING btree ("financing_id");--> statement-breakpoint
CREATE INDEX "fund_utilization_reports_status_idx" ON "funding"."fund_utilization_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "funding_application_statuses_app_idx" ON "funding"."funding_application_statuses" USING btree ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "funding_applications_number_uq" ON "funding"."funding_applications" USING btree ("merchant_id","application_number");--> statement-breakpoint
CREATE UNIQUE INDEX "funding_applications_proposal_opportunity_uq" ON "funding"."funding_applications" USING btree ("proposal_id","opportunity_id");--> statement-breakpoint
CREATE INDEX "funding_applications_merchant_idx" ON "funding"."funding_applications" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "funding_applications_status_idx" ON "funding"."funding_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "funding_matches_merchant_idx" ON "funding"."funding_matches" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "funding_matches_application_idx" ON "funding"."funding_matches" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "funding_matches_status_idx" ON "funding"."funding_matches" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "funding_opportunities_code_uq" ON "funding"."funding_opportunities" USING btree ("code");--> statement-breakpoint
CREATE INDEX "funding_opportunities_status_idx" ON "funding"."funding_opportunities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "funding_opportunities_owner_idx" ON "funding"."funding_opportunities" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "funding_partner_referrals_merchant_idx" ON "funding"."funding_partner_referrals" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "funding_partner_referrals_status_idx" ON "funding"."funding_partner_referrals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "funding_requirements_proposal_idx" ON "funding"."funding_requirements" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "funding_requirements_merchant_idx" ON "funding"."funding_requirements" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "investor_interests_merchant_idx" ON "funding"."investor_interests" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "investor_interests_investor_idx" ON "funding"."investor_interests" USING btree ("investor_profile_id");--> statement-breakpoint
CREATE INDEX "investor_interests_status_idx" ON "funding"."investor_interests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "investor_profiles_user_idx" ON "funding"."investor_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "investor_profiles_org_idx" ON "funding"."investor_profiles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "investor_profiles_status_idx" ON "funding"."investor_profiles" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "proposal_versions_number_uq" ON "funding"."proposal_versions" USING btree ("proposal_id","version");--> statement-breakpoint
CREATE INDEX "proposal_versions_merchant_idx" ON "funding"."proposal_versions" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "repayment_schedules_installment_uq" ON "funding"."repayment_schedules" USING btree ("financing_id","installment_number");--> statement-breakpoint
CREATE INDEX "repayment_schedules_merchant_idx" ON "funding"."repayment_schedules" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "repayment_schedules_due_idx" ON "funding"."repayment_schedules" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "repayment_schedules_status_idx" ON "funding"."repayment_schedules" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "repayment_transactions_number_uq" ON "funding"."repayment_transactions" USING btree ("merchant_id","transaction_number");--> statement-breakpoint
CREATE INDEX "repayment_transactions_schedule_idx" ON "funding"."repayment_transactions" USING btree ("schedule_id");--> statement-breakpoint
CREATE INDEX "repayment_transactions_status_idx" ON "funding"."repayment_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "risk_assessments_merchant_idx" ON "funding"."risk_assessments" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "risk_assessments_financing_idx" ON "funding"."risk_assessments" USING btree ("financing_id");--> statement-breakpoint
CREATE INDEX "risk_assessments_level_idx" ON "funding"."risk_assessments" USING btree ("risk_level");--> statement-breakpoint
CREATE UNIQUE INDEX "risk_indicators_code_uq" ON "funding"."risk_indicators" USING btree ("merchant_id","code");--> statement-breakpoint
CREATE INDEX "risk_indicators_merchant_idx" ON "funding"."risk_indicators" USING btree ("merchant_id");