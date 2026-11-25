CREATE TYPE "governance"."access_policy_effect" AS ENUM('allow', 'deny');--> statement-breakpoint
CREATE TYPE "governance"."access_policy_status" AS ENUM('draft', 'active', 'inactive');--> statement-breakpoint
CREATE TYPE "governance"."access_policy_type" AS ENUM('role_based', 'attribute_based', 'purpose_based', 'data_sharing');--> statement-breakpoint
CREATE TYPE "governance"."consent_status" AS ENUM('pending', 'granted', 'withdrawn', 'expired');--> statement-breakpoint
CREATE TYPE "governance"."consent_type" AS ENUM('marketing', 'analytics', 'data_sharing', 'profiling', 'terms', 'privacy_policy');--> statement-breakpoint
CREATE TYPE "governance"."data_access_action" AS ENUM('read', 'create', 'update', 'delete', 'export', 'share');--> statement-breakpoint
CREATE TYPE "governance"."data_access_status" AS ENUM('granted', 'denied', 'error');--> statement-breakpoint
CREATE TYPE "governance"."data_classification_level" AS ENUM('public', 'internal', 'confidential', 'restricted');--> statement-breakpoint
CREATE TYPE "governance"."incident_category" AS ENUM('data_breach', 'unauthorized_access', 'malware', 'phishing', 'denial_of_service', 'misconfiguration', 'other');--> statement-breakpoint
CREATE TYPE "governance"."incident_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "governance"."incident_status" AS ENUM('open', 'investigating', 'contained', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "governance"."privacy_request_status" AS ENUM('submitted', 'verified', 'processing', 'completed', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "governance"."privacy_request_type" AS ENUM('access', 'correction', 'deletion', 'portability', 'objection', 'restriction');--> statement-breakpoint
CREATE TYPE "governance"."retention_action" AS ENUM('archive', 'delete', 'anonymize', 'review');--> statement-breakpoint
CREATE TYPE "governance"."retention_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TABLE "governance"."data_access_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"data_classification_id" uuid,
	"resource_type" varchar(100) NOT NULL,
	"resource_id" varchar(64),
	"action" "governance"."data_access_action" NOT NULL,
	"status" "governance"."data_access_status" DEFAULT 'granted' NOT NULL,
	"purpose" varchar(255),
	"ip_address" varchar(64),
	"user_agent" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "governance"."data_access_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"data_classification_id" uuid,
	"policy_type" "governance"."access_policy_type" DEFAULT 'role_based' NOT NULL,
	"effect" "governance"."access_policy_effect" DEFAULT 'allow' NOT NULL,
	"subject_type" varchar(64),
	"subject_id" varchar(64),
	"resource" varchar(128),
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"conditions" jsonb,
	"priority" integer DEFAULT 100 NOT NULL,
	"status" "governance"."access_policy_status" DEFAULT 'draft' NOT NULL,
	"effective_from" timestamp with time zone,
	"effective_to" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "governance"."data_classifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"category" varchar(64),
	"sensitivity_level" "governance"."data_classification_level" DEFAULT 'internal' NOT NULL,
	"retention_days" integer,
	"handling_rules" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "governance"."data_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"organization_id" uuid,
	"consent_type" "governance"."consent_type" NOT NULL,
	"purpose" text,
	"status" "governance"."consent_status" DEFAULT 'pending' NOT NULL,
	"version" varchar(32) DEFAULT '1.0' NOT NULL,
	"granted_at" timestamp with time zone,
	"withdrawn_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"source" varchar(64),
	"evidence" jsonb,
	"ip_address" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "governance"."data_retention_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"entity_type" varchar(100) NOT NULL,
	"data_classification_id" uuid,
	"retention_days" integer NOT NULL,
	"action" "governance"."retention_action" DEFAULT 'archive' NOT NULL,
	"legal_basis" text,
	"status" "governance"."retention_status" DEFAULT 'active' NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "governance"."privacy_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_number" varchar(32) NOT NULL,
	"user_id" uuid,
	"requester_name" varchar(255) NOT NULL,
	"requester_email" varchar(255) NOT NULL,
	"request_type" "governance"."privacy_request_type" NOT NULL,
	"status" "governance"."privacy_request_status" DEFAULT 'submitted' NOT NULL,
	"description" text,
	"response_notes" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"assigned_to" uuid,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "governance"."security_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_number" varchar(32) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"category" "governance"."incident_category" DEFAULT 'other' NOT NULL,
	"severity" "governance"."incident_severity" DEFAULT 'medium' NOT NULL,
	"status" "governance"."incident_status" DEFAULT 'open' NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"occurred_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"reported_by" uuid,
	"assigned_to" uuid,
	"data_classification_id" uuid,
	"affected_systems" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"affected_records" integer,
	"containment_actions" text,
	"root_cause" text,
	"remediation" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "governance"."data_access_logs" ADD CONSTRAINT "data_access_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance"."data_access_logs" ADD CONSTRAINT "data_access_logs_data_classification_id_data_classifications_id_fk" FOREIGN KEY ("data_classification_id") REFERENCES "governance"."data_classifications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance"."data_access_policies" ADD CONSTRAINT "data_access_policies_data_classification_id_data_classifications_id_fk" FOREIGN KEY ("data_classification_id") REFERENCES "governance"."data_classifications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance"."data_access_policies" ADD CONSTRAINT "data_access_policies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance"."data_classifications" ADD CONSTRAINT "data_classifications_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance"."data_consents" ADD CONSTRAINT "data_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance"."data_consents" ADD CONSTRAINT "data_consents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance"."data_retention_policies" ADD CONSTRAINT "data_retention_policies_data_classification_id_data_classifications_id_fk" FOREIGN KEY ("data_classification_id") REFERENCES "governance"."data_classifications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance"."data_retention_policies" ADD CONSTRAINT "data_retention_policies_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance"."data_retention_policies" ADD CONSTRAINT "data_retention_policies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance"."privacy_requests" ADD CONSTRAINT "privacy_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance"."privacy_requests" ADD CONSTRAINT "privacy_requests_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance"."security_incidents" ADD CONSTRAINT "security_incidents_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance"."security_incidents" ADD CONSTRAINT "security_incidents_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance"."security_incidents" ADD CONSTRAINT "security_incidents_data_classification_id_data_classifications_id_fk" FOREIGN KEY ("data_classification_id") REFERENCES "governance"."data_classifications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "data_access_logs_user_idx" ON "governance"."data_access_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "data_access_logs_resource_idx" ON "governance"."data_access_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "data_access_logs_created_idx" ON "governance"."data_access_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "data_access_policies_code_uq" ON "governance"."data_access_policies" USING btree ("code");--> statement-breakpoint
CREATE INDEX "data_access_policies_classification_idx" ON "governance"."data_access_policies" USING btree ("data_classification_id");--> statement-breakpoint
CREATE INDEX "data_access_policies_status_idx" ON "governance"."data_access_policies" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "data_classifications_code_uq" ON "governance"."data_classifications" USING btree ("code");--> statement-breakpoint
CREATE INDEX "data_classifications_level_idx" ON "governance"."data_classifications" USING btree ("sensitivity_level");--> statement-breakpoint
CREATE INDEX "data_consents_user_idx" ON "governance"."data_consents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "data_consents_org_idx" ON "governance"."data_consents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "data_consents_status_idx" ON "governance"."data_consents" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "data_retention_policies_code_uq" ON "governance"."data_retention_policies" USING btree ("code");--> statement-breakpoint
CREATE INDEX "data_retention_policies_entity_idx" ON "governance"."data_retention_policies" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "data_retention_policies_status_idx" ON "governance"."data_retention_policies" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "privacy_requests_number_uq" ON "governance"."privacy_requests" USING btree ("request_number");--> statement-breakpoint
CREATE INDEX "privacy_requests_status_idx" ON "governance"."privacy_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "privacy_requests_email_idx" ON "governance"."privacy_requests" USING btree ("requester_email");--> statement-breakpoint
CREATE UNIQUE INDEX "security_incidents_number_uq" ON "governance"."security_incidents" USING btree ("incident_number");--> statement-breakpoint
CREATE INDEX "security_incidents_status_idx" ON "governance"."security_incidents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "security_incidents_severity_idx" ON "governance"."security_incidents" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "security_incidents_detected_idx" ON "governance"."security_incidents" USING btree ("detected_at");