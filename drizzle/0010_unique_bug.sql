CREATE SCHEMA "platform";
--> statement-breakpoint
CREATE SCHEMA "analytics";
--> statement-breakpoint
CREATE TYPE "platform"."api_client_status" AS ENUM('active', 'suspended', 'revoked');--> statement-breakpoint
CREATE TYPE "platform"."api_key_status" AS ENUM('active', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "platform"."data_mapping_direction" AS ENUM('inbound', 'outbound', 'bidirectional');--> statement-breakpoint
CREATE TYPE "platform"."api_http_method" AS ENUM('GET', 'POST', 'PUT', 'PATCH', 'DELETE');--> statement-breakpoint
CREATE TYPE "platform"."integration_connection_status" AS ENUM('pending', 'active', 'disabled', 'error');--> statement-breakpoint
CREATE TYPE "platform"."integration_environment" AS ENUM('sandbox', 'production');--> statement-breakpoint
CREATE TYPE "platform"."integration_log_status" AS ENUM('success', 'failed');--> statement-breakpoint
CREATE TYPE "platform"."integration_provider_type" AS ENUM('marketplace', 'payment', 'logistics', 'government', 'messaging', 'analytics', 'erp', 'crm', 'other');--> statement-breakpoint
CREATE TYPE "platform"."integration_status" AS ENUM('active', 'inactive', 'deprecated');--> statement-breakpoint
CREATE TYPE "platform"."webhook_event_status" AS ENUM('pending', 'processing', 'delivered', 'failed', 'dead_letter');--> statement-breakpoint
CREATE TYPE "platform"."webhook_subscription_status" AS ENUM('active', 'paused', 'disabled');--> statement-breakpoint
CREATE TYPE "platform"."notification_channel_type" AS ENUM('email', 'sms', 'whatsapp', 'push', 'in_app', 'webhook');--> statement-breakpoint
CREATE TYPE "platform"."notification_delivery_status" AS ENUM('queued', 'sent', 'delivered', 'failed', 'bounced');--> statement-breakpoint
CREATE TYPE "platform"."notification_message_status" AS ENUM('queued', 'scheduled', 'processing', 'sent', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "platform"."notification_recipient_status" AS ENUM('pending', 'sent', 'delivered', 'failed', 'read');--> statement-breakpoint
CREATE TYPE "platform"."notification_template_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "platform"."configuration_scope" AS ENUM('global', 'organization', 'merchant', 'user');--> statement-breakpoint
CREATE TYPE "platform"."configuration_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "platform"."configuration_value_type" AS ENUM('string', 'number', 'boolean', 'json', 'secret');--> statement-breakpoint
CREATE TYPE "platform"."feature_flag_status" AS ENUM('enabled', 'disabled', 'rollout');--> statement-breakpoint
CREATE TYPE "platform"."localization_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "platform"."ai_message_role" AS ENUM('system', 'user', 'assistant', 'tool');--> statement-breakpoint
CREATE TYPE "platform"."ai_model_status" AS ENUM('active', 'inactive', 'deprecated');--> statement-breakpoint
CREATE TYPE "platform"."ai_model_type" AS ENUM('chat', 'embedding', 'image', 'speech', 'recommendation', 'forecasting');--> statement-breakpoint
CREATE TYPE "platform"."ai_request_status" AS ENUM('queued', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "platform"."ai_response_status" AS ENUM('completed', 'failed', 'filtered');--> statement-breakpoint
CREATE TYPE "platform"."ai_session_status" AS ENUM('active', 'archived', 'closed');--> statement-breakpoint
CREATE TYPE "platform"."forecast_job_status" AS ENUM('queued', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "platform"."forecast_type" AS ENUM('sales', 'demand', 'revenue', 'cashflow', 'inventory');--> statement-breakpoint
CREATE TYPE "platform"."recommendation_status" AS ENUM('generated', 'viewed', 'accepted', 'dismissed');--> statement-breakpoint
CREATE TYPE "platform"."recommendation_type" AS ENUM('product', 'funding', 'merchant', 'market', 'content');--> statement-breakpoint
CREATE TYPE "analytics"."data_load_status" AS ENUM('success', 'failed', 'partial');--> statement-breakpoint
CREATE TYPE "analytics"."data_mart_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "analytics"."data_source_status" AS ENUM('active', 'inactive', 'error');--> statement-breakpoint
CREATE TYPE "analytics"."data_source_type" AS ENUM('postgres', 'api', 'file', 'manual');--> statement-breakpoint
CREATE TYPE "analytics"."etl_job_status" AS ENUM('scheduled', 'running', 'completed', 'failed', 'paused');--> statement-breakpoint
CREATE TYPE "analytics"."etl_job_type" AS ENUM('extract', 'transform', 'load', 'full', 'incremental');--> statement-breakpoint
CREATE TYPE "analytics"."refresh_mode" AS ENUM('manual', 'scheduled');--> statement-breakpoint
CREATE TYPE "analytics"."report_definition_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "analytics"."report_format" AS ENUM('table', 'csv', 'json', 'pdf');--> statement-breakpoint
CREATE TYPE "analytics"."report_run_status" AS ENUM('queued', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "analytics"."snapshot_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TABLE "platform"."api_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" "platform"."api_client_status" DEFAULT 'active' NOT NULL,
	"rate_limit_per_minute" integer DEFAULT 60 NOT NULL,
	"allowed_origins" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."api_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"method" "platform"."api_http_method" NOT NULL,
	"path" varchar(255) NOT NULL,
	"version" varchar(16) DEFAULT 'v1' NOT NULL,
	"description" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"rate_limit_per_minute" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"key_prefix" varchar(24) NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"scopes" jsonb,
	"status" "platform"."api_key_status" DEFAULT 'active' NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."data_mapping_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"source_entity" varchar(128) NOT NULL,
	"target_entity" varchar(128) NOT NULL,
	"direction" "platform"."data_mapping_direction" DEFAULT 'inbound' NOT NULL,
	"mapping" jsonb NOT NULL,
	"transform" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."integration_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"organization_id" uuid,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"environment" "platform"."integration_environment" DEFAULT 'sandbox' NOT NULL,
	"status" "platform"."integration_connection_status" DEFAULT 'pending' NOT NULL,
	"credentials_encrypted" text,
	"config" jsonb,
	"last_sync_at" timestamp with time zone,
	"last_error" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."integration_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid,
	"connection_id" uuid,
	"direction" "platform"."data_mapping_direction" DEFAULT 'outbound' NOT NULL,
	"method" "platform"."api_http_method" DEFAULT 'POST' NOT NULL,
	"path" text NOT NULL,
	"status_code" integer,
	"request_body" jsonb,
	"response_body" jsonb,
	"status" "platform"."integration_log_status" DEFAULT 'success' NOT NULL,
	"duration_ms" integer,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."integration_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "platform"."integration_provider_type" DEFAULT 'other' NOT NULL,
	"description" text,
	"base_url" text,
	"docs_url" text,
	"status" "platform"."integration_status" DEFAULT 'active' NOT NULL,
	"config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"event_type" varchar(128) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "platform"."webhook_event_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"last_error" text,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."webhook_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"url" text NOT NULL,
	"description" text,
	"events" jsonb NOT NULL,
	"secret_hash" varchar(64),
	"status" "platform"."webhook_subscription_status" DEFAULT 'active' NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_triggered_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."communication_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"organization_id" uuid,
	"category" varchar(64) DEFAULT 'general' NOT NULL,
	"channel_type" "platform"."notification_channel_type" NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"quiet_hours_start" varchar(5),
	"quiet_hours_end" varchar(5),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."notification_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"type" "platform"."notification_channel_type" NOT NULL,
	"provider" varchar(128),
	"description" text,
	"config" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."notification_delivery_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"recipient_id" uuid,
	"channel_type" "platform"."notification_channel_type" NOT NULL,
	"provider" varchar(128),
	"provider_message_id" varchar(255),
	"status" "platform"."notification_delivery_status" DEFAULT 'queued' NOT NULL,
	"response" jsonb,
	"error_message" text,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."notification_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_number" varchar(64) NOT NULL,
	"template_id" uuid,
	"channel_id" uuid,
	"channel_type" "platform"."notification_channel_type" DEFAULT 'email' NOT NULL,
	"category" varchar(64) DEFAULT 'general' NOT NULL,
	"subject" varchar(255),
	"body" text NOT NULL,
	"payload" jsonb,
	"status" "platform"."notification_message_status" DEFAULT 'queued' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"scheduled_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."notification_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"user_id" uuid,
	"name" varchar(255),
	"email" varchar(255),
	"phone" varchar(32),
	"status" "platform"."notification_recipient_status" DEFAULT 'pending' NOT NULL,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."notification_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"channel_id" uuid,
	"channel_type" "platform"."notification_channel_type" DEFAULT 'email' NOT NULL,
	"category" varchar(64) DEFAULT 'general' NOT NULL,
	"locale" varchar(16) DEFAULT 'id-ID' NOT NULL,
	"subject" varchar(255),
	"body" text NOT NULL,
	"variables" jsonb,
	"status" "platform"."notification_template_status" DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."configuration_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."feature_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(128) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" "platform"."feature_flag_status" DEFAULT 'disabled' NOT NULL,
	"rollout_percentage" integer DEFAULT 0 NOT NULL,
	"audience" jsonb,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."localization_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"locale" varchar(16) NOT NULL,
	"language" varchar(64) NOT NULL,
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"timezone" varchar(64) DEFAULT 'Asia/Jakarta' NOT NULL,
	"date_format" varchar(32) DEFAULT 'DD/MM/YYYY' NOT NULL,
	"number_format" varchar(32) DEFAULT 'id-ID' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"status" "platform"."localization_status" DEFAULT 'active' NOT NULL,
	"translations" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."reference_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."reference_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"label" varchar(128) NOT NULL,
	"value" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."service_parameters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service" varchar(64) NOT NULL,
	"key" varchar(128) NOT NULL,
	"label" varchar(255) NOT NULL,
	"description" text,
	"value_type" "platform"."configuration_value_type" DEFAULT 'string' NOT NULL,
	"value" text,
	"is_secret" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."system_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid,
	"key" varchar(128) NOT NULL,
	"label" varchar(255) NOT NULL,
	"description" text,
	"value_type" "platform"."configuration_value_type" DEFAULT 'string' NOT NULL,
	"value" text,
	"default_value" text,
	"scope" "platform"."configuration_scope" DEFAULT 'global' NOT NULL,
	"scope_id" uuid,
	"is_secret" boolean DEFAULT false NOT NULL,
	"is_editable" boolean DEFAULT true NOT NULL,
	"status" "platform"."configuration_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."ai_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" "platform"."ai_message_role" NOT NULL,
	"content" text NOT NULL,
	"tokens" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."ai_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"provider" varchar(128) NOT NULL,
	"type" "platform"."ai_model_type" DEFAULT 'chat' NOT NULL,
	"version" varchar(64),
	"description" text,
	"capabilities" jsonb,
	"config" jsonb,
	"status" "platform"."ai_model_status" DEFAULT 'active' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."ai_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_number" varchar(64) NOT NULL,
	"session_id" uuid,
	"model_id" uuid,
	"user_id" uuid,
	"feature" varchar(64) DEFAULT 'assistant' NOT NULL,
	"prompt" text NOT NULL,
	"parameters" jsonb,
	"status" "platform"."ai_request_status" DEFAULT 'queued' NOT NULL,
	"latency_ms" integer,
	"error_message" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."ai_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"content" text NOT NULL,
	"finish_reason" varchar(64),
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"status" "platform"."ai_response_status" DEFAULT 'completed' NOT NULL,
	"safety" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."ai_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_key" varchar(64) NOT NULL,
	"user_id" uuid,
	"organization_id" uuid,
	"merchant_id" uuid,
	"model_id" uuid,
	"title" varchar(255),
	"context_type" varchar(64),
	"context_id" uuid,
	"status" "platform"."ai_session_status" DEFAULT 'active' NOT NULL,
	"metadata" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."ai_usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"model_id" uuid,
	"request_id" uuid,
	"feature" varchar(64) DEFAULT 'assistant' NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"cost" numeric(14, 6) DEFAULT '0' NOT NULL,
	"status" "platform"."ai_request_status" DEFAULT 'completed' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."forecast_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_number" varchar(64) NOT NULL,
	"type" "platform"."forecast_type" DEFAULT 'sales' NOT NULL,
	"merchant_id" uuid,
	"data_source" varchar(128),
	"horizon_days" integer DEFAULT 30 NOT NULL,
	"parameters" jsonb,
	"status" "platform"."forecast_job_status" DEFAULT 'queued' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"result" jsonb,
	"error_message" text,
	"requested_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."recommendation_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"merchant_id" uuid,
	"model_id" uuid,
	"type" "platform"."recommendation_type" DEFAULT 'product' NOT NULL,
	"title" varchar(255) NOT NULL,
	"summary" text,
	"items" jsonb,
	"score" numeric(8, 4),
	"status" "platform"."recommendation_status" DEFAULT 'generated' NOT NULL,
	"source" varchar(128),
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics"."data_load_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"status" "analytics"."data_load_status" DEFAULT 'success' NOT NULL,
	"rows_read" integer DEFAULT 0 NOT NULL,
	"rows_loaded" integer DEFAULT 0 NOT NULL,
	"rows_failed" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"error_message" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics"."data_marts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"schema_name" varchar(64) DEFAULT 'analytics' NOT NULL,
	"table_name" varchar(128) NOT NULL,
	"status" "analytics"."data_mart_status" DEFAULT 'draft' NOT NULL,
	"refresh_mode" "analytics"."refresh_mode" DEFAULT 'manual' NOT NULL,
	"last_refreshed_at" timestamp with time zone,
	"definition" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics"."data_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "analytics"."data_source_type" DEFAULT 'postgres' NOT NULL,
	"description" text,
	"connection_config" jsonb,
	"status" "analytics"."data_source_status" DEFAULT 'active' NOT NULL,
	"last_checked_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics"."etl_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"data_source_id" uuid,
	"type" "analytics"."etl_job_type" DEFAULT 'full' NOT NULL,
	"schedule" varchar(64),
	"source_query" text,
	"target_table" varchar(255),
	"status" "analytics"."etl_job_status" DEFAULT 'scheduled' NOT NULL,
	"last_run_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics"."historical_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_key" varchar(128) NOT NULL,
	"name" varchar(255) NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"entity_id" uuid,
	"snapshot_date" date NOT NULL,
	"data" jsonb NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"status" "analytics"."snapshot_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics"."report_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"data_mart_id" uuid,
	"category" varchar(64) DEFAULT 'general' NOT NULL,
	"query" text,
	"parameters" jsonb,
	"format" "analytics"."report_format" DEFAULT 'table' NOT NULL,
	"status" "analytics"."report_definition_status" DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics"."report_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"run_number" varchar(64) NOT NULL,
	"requested_by" uuid,
	"parameters" jsonb,
	"status" "analytics"."report_run_status" DEFAULT 'queued' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"row_count" integer DEFAULT 0 NOT NULL,
	"output_url" text,
	"error_message" text,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform"."api_clients" ADD CONSTRAINT "api_clients_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."api_clients" ADD CONSTRAINT "api_clients_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."api_keys" ADD CONSTRAINT "api_keys_client_id_api_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "platform"."api_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."api_keys" ADD CONSTRAINT "api_keys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."data_mapping_rules" ADD CONSTRAINT "data_mapping_rules_provider_id_integration_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "platform"."integration_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."integration_connections" ADD CONSTRAINT "integration_connections_provider_id_integration_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "platform"."integration_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."integration_connections" ADD CONSTRAINT "integration_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."integration_connections" ADD CONSTRAINT "integration_connections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."integration_logs" ADD CONSTRAINT "integration_logs_provider_id_integration_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "platform"."integration_providers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."integration_logs" ADD CONSTRAINT "integration_logs_connection_id_integration_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "platform"."integration_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."webhook_events" ADD CONSTRAINT "webhook_events_subscription_id_webhook_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "platform"."webhook_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_client_id_api_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "platform"."api_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."communication_preferences" ADD CONSTRAINT "communication_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."communication_preferences" ADD CONSTRAINT "communication_preferences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."notification_delivery_logs" ADD CONSTRAINT "notification_delivery_logs_message_id_notification_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "platform"."notification_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."notification_delivery_logs" ADD CONSTRAINT "notification_delivery_logs_recipient_id_notification_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "platform"."notification_recipients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."notification_messages" ADD CONSTRAINT "notification_messages_template_id_notification_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "platform"."notification_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."notification_messages" ADD CONSTRAINT "notification_messages_channel_id_notification_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "platform"."notification_channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."notification_messages" ADD CONSTRAINT "notification_messages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."notification_recipients" ADD CONSTRAINT "notification_recipients_message_id_notification_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "platform"."notification_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."notification_recipients" ADD CONSTRAINT "notification_recipients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."notification_templates" ADD CONSTRAINT "notification_templates_channel_id_notification_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "platform"."notification_channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."notification_templates" ADD CONSTRAINT "notification_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."feature_flags" ADD CONSTRAINT "feature_flags_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."reference_values" ADD CONSTRAINT "reference_values_code_id_reference_codes_id_fk" FOREIGN KEY ("code_id") REFERENCES "platform"."reference_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."service_parameters" ADD CONSTRAINT "service_parameters_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."system_settings" ADD CONSTRAINT "system_settings_group_id_configuration_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "platform"."configuration_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."system_settings" ADD CONSTRAINT "system_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."ai_messages" ADD CONSTRAINT "ai_messages_session_id_ai_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "platform"."ai_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."ai_requests" ADD CONSTRAINT "ai_requests_session_id_ai_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "platform"."ai_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."ai_requests" ADD CONSTRAINT "ai_requests_model_id_ai_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "platform"."ai_models"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."ai_requests" ADD CONSTRAINT "ai_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."ai_responses" ADD CONSTRAINT "ai_responses_request_id_ai_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "platform"."ai_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."ai_sessions" ADD CONSTRAINT "ai_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."ai_sessions" ADD CONSTRAINT "ai_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."ai_sessions" ADD CONSTRAINT "ai_sessions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."ai_sessions" ADD CONSTRAINT "ai_sessions_model_id_ai_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "platform"."ai_models"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_model_id_ai_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "platform"."ai_models"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_request_id_ai_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "platform"."ai_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."forecast_jobs" ADD CONSTRAINT "forecast_jobs_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."forecast_jobs" ADD CONSTRAINT "forecast_jobs_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."recommendation_results" ADD CONSTRAINT "recommendation_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."recommendation_results" ADD CONSTRAINT "recommendation_results_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."recommendation_results" ADD CONSTRAINT "recommendation_results_model_id_ai_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "platform"."ai_models"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics"."data_load_logs" ADD CONSTRAINT "data_load_logs_job_id_etl_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "analytics"."etl_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics"."data_sources" ADD CONSTRAINT "data_sources_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics"."etl_jobs" ADD CONSTRAINT "etl_jobs_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "analytics"."data_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics"."etl_jobs" ADD CONSTRAINT "etl_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics"."report_definitions" ADD CONSTRAINT "report_definitions_data_mart_id_data_marts_id_fk" FOREIGN KEY ("data_mart_id") REFERENCES "analytics"."data_marts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics"."report_definitions" ADD CONSTRAINT "report_definitions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics"."report_runs" ADD CONSTRAINT "report_runs_report_id_report_definitions_id_fk" FOREIGN KEY ("report_id") REFERENCES "analytics"."report_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics"."report_runs" ADD CONSTRAINT "report_runs_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_clients_code_uq" ON "platform"."api_clients" USING btree ("code");--> statement-breakpoint
CREATE INDEX "api_clients_org_idx" ON "platform"."api_clients" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "api_clients_status_idx" ON "platform"."api_clients" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "api_endpoints_code_uq" ON "platform"."api_endpoints" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "api_endpoints_route_uq" ON "platform"."api_endpoints" USING btree ("method","path","version");--> statement-breakpoint
CREATE INDEX "api_endpoints_active_idx" ON "platform"."api_endpoints" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_hash_uq" ON "platform"."api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "api_keys_client_idx" ON "platform"."api_keys" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "api_keys_status_idx" ON "platform"."api_keys" USING btree ("status");--> statement-breakpoint
CREATE INDEX "data_mapping_rules_provider_idx" ON "platform"."data_mapping_rules" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "data_mapping_rules_entities_idx" ON "platform"."data_mapping_rules" USING btree ("source_entity","target_entity");--> statement-breakpoint
CREATE INDEX "data_mapping_rules_active_idx" ON "platform"."data_mapping_rules" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_connections_code_uq" ON "platform"."integration_connections" USING btree ("code");--> statement-breakpoint
CREATE INDEX "integration_connections_provider_idx" ON "platform"."integration_connections" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "integration_connections_org_idx" ON "platform"."integration_connections" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "integration_connections_status_idx" ON "platform"."integration_connections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "integration_logs_provider_idx" ON "platform"."integration_logs" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "integration_logs_connection_idx" ON "platform"."integration_logs" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "integration_logs_status_idx" ON "platform"."integration_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "integration_logs_created_idx" ON "platform"."integration_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_providers_code_uq" ON "platform"."integration_providers" USING btree ("code");--> statement-breakpoint
CREATE INDEX "integration_providers_type_idx" ON "platform"."integration_providers" USING btree ("type");--> statement-breakpoint
CREATE INDEX "integration_providers_status_idx" ON "platform"."integration_providers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "webhook_events_subscription_idx" ON "platform"."webhook_events" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "webhook_events_status_idx" ON "platform"."webhook_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "webhook_events_type_idx" ON "platform"."webhook_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "webhook_subscriptions_client_idx" ON "platform"."webhook_subscriptions" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "webhook_subscriptions_status_idx" ON "platform"."webhook_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "communication_preferences_user_uq" ON "platform"."communication_preferences" USING btree ("user_id","category","channel_type");--> statement-breakpoint
CREATE UNIQUE INDEX "communication_preferences_org_uq" ON "platform"."communication_preferences" USING btree ("organization_id","category","channel_type");--> statement-breakpoint
CREATE INDEX "communication_preferences_user_idx" ON "platform"."communication_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_channels_code_uq" ON "platform"."notification_channels" USING btree ("code");--> statement-breakpoint
CREATE INDEX "notification_channels_type_idx" ON "platform"."notification_channels" USING btree ("type");--> statement-breakpoint
CREATE INDEX "notification_delivery_logs_message_idx" ON "platform"."notification_delivery_logs" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "notification_delivery_logs_recipient_idx" ON "platform"."notification_delivery_logs" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "notification_delivery_logs_status_idx" ON "platform"."notification_delivery_logs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_messages_number_uq" ON "platform"."notification_messages" USING btree ("message_number");--> statement-breakpoint
CREATE INDEX "notification_messages_status_idx" ON "platform"."notification_messages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notification_messages_channel_idx" ON "platform"."notification_messages" USING btree ("channel_type");--> statement-breakpoint
CREATE INDEX "notification_messages_created_idx" ON "platform"."notification_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notification_recipients_message_idx" ON "platform"."notification_recipients" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "notification_recipients_user_idx" ON "platform"."notification_recipients" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notification_recipients_status_idx" ON "platform"."notification_recipients" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_templates_code_uq" ON "platform"."notification_templates" USING btree ("code","locale");--> statement-breakpoint
CREATE INDEX "notification_templates_channel_idx" ON "platform"."notification_templates" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "notification_templates_status_idx" ON "platform"."notification_templates" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "configuration_groups_code_uq" ON "platform"."configuration_groups" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "feature_flags_key_uq" ON "platform"."feature_flags" USING btree ("key");--> statement-breakpoint
CREATE INDEX "feature_flags_status_idx" ON "platform"."feature_flags" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "localization_settings_locale_uq" ON "platform"."localization_settings" USING btree ("locale");--> statement-breakpoint
CREATE INDEX "localization_settings_status_idx" ON "platform"."localization_settings" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "reference_codes_code_uq" ON "platform"."reference_codes" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "reference_values_code_uq" ON "platform"."reference_values" USING btree ("code_id","code");--> statement-breakpoint
CREATE INDEX "reference_values_code_id_idx" ON "platform"."reference_values" USING btree ("code_id");--> statement-breakpoint
CREATE UNIQUE INDEX "service_parameters_key_uq" ON "platform"."service_parameters" USING btree ("service","key");--> statement-breakpoint
CREATE UNIQUE INDEX "system_settings_key_scope_uq" ON "platform"."system_settings" USING btree ("key","scope","scope_id");--> statement-breakpoint
CREATE INDEX "system_settings_group_idx" ON "platform"."system_settings" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "system_settings_status_idx" ON "platform"."system_settings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_messages_session_idx" ON "platform"."ai_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "ai_messages_role_idx" ON "platform"."ai_messages" USING btree ("role");--> statement-breakpoint
CREATE INDEX "ai_messages_created_idx" ON "platform"."ai_messages" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_models_code_uq" ON "platform"."ai_models" USING btree ("code");--> statement-breakpoint
CREATE INDEX "ai_models_type_idx" ON "platform"."ai_models" USING btree ("type");--> statement-breakpoint
CREATE INDEX "ai_models_status_idx" ON "platform"."ai_models" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_requests_number_uq" ON "platform"."ai_requests" USING btree ("request_number");--> statement-breakpoint
CREATE INDEX "ai_requests_session_idx" ON "platform"."ai_requests" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "ai_requests_user_idx" ON "platform"."ai_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_requests_status_idx" ON "platform"."ai_requests" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_responses_request_uq" ON "platform"."ai_responses" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "ai_responses_status_idx" ON "platform"."ai_responses" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_sessions_key_uq" ON "platform"."ai_sessions" USING btree ("session_key");--> statement-breakpoint
CREATE INDEX "ai_sessions_user_idx" ON "platform"."ai_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_sessions_merchant_idx" ON "platform"."ai_sessions" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "ai_sessions_status_idx" ON "platform"."ai_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_usage_logs_user_idx" ON "platform"."ai_usage_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_usage_logs_model_idx" ON "platform"."ai_usage_logs" USING btree ("model_id");--> statement-breakpoint
CREATE INDEX "ai_usage_logs_created_idx" ON "platform"."ai_usage_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "forecast_jobs_number_uq" ON "platform"."forecast_jobs" USING btree ("job_number");--> statement-breakpoint
CREATE INDEX "forecast_jobs_merchant_idx" ON "platform"."forecast_jobs" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "forecast_jobs_status_idx" ON "platform"."forecast_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "forecast_jobs_type_idx" ON "platform"."forecast_jobs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "recommendation_results_user_idx" ON "platform"."recommendation_results" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recommendation_results_merchant_idx" ON "platform"."recommendation_results" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "recommendation_results_type_idx" ON "platform"."recommendation_results" USING btree ("type");--> statement-breakpoint
CREATE INDEX "recommendation_results_status_idx" ON "platform"."recommendation_results" USING btree ("status");--> statement-breakpoint
CREATE INDEX "data_load_logs_job_idx" ON "analytics"."data_load_logs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "data_load_logs_status_idx" ON "analytics"."data_load_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "data_load_logs_started_idx" ON "analytics"."data_load_logs" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "data_marts_code_uq" ON "analytics"."data_marts" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "data_marts_table_uq" ON "analytics"."data_marts" USING btree ("schema_name","table_name");--> statement-breakpoint
CREATE INDEX "data_marts_status_idx" ON "analytics"."data_marts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "data_sources_code_uq" ON "analytics"."data_sources" USING btree ("code");--> statement-breakpoint
CREATE INDEX "data_sources_type_idx" ON "analytics"."data_sources" USING btree ("type");--> statement-breakpoint
CREATE INDEX "data_sources_status_idx" ON "analytics"."data_sources" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "etl_jobs_code_uq" ON "analytics"."etl_jobs" USING btree ("code");--> statement-breakpoint
CREATE INDEX "etl_jobs_source_idx" ON "analytics"."etl_jobs" USING btree ("data_source_id");--> statement-breakpoint
CREATE INDEX "etl_jobs_status_idx" ON "analytics"."etl_jobs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "historical_snapshots_key_uq" ON "analytics"."historical_snapshots" USING btree ("snapshot_key");--> statement-breakpoint
CREATE INDEX "historical_snapshots_entity_idx" ON "analytics"."historical_snapshots" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "historical_snapshots_date_idx" ON "analytics"."historical_snapshots" USING btree ("snapshot_date");--> statement-breakpoint
CREATE INDEX "historical_snapshots_status_idx" ON "analytics"."historical_snapshots" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "report_definitions_code_uq" ON "analytics"."report_definitions" USING btree ("code");--> statement-breakpoint
CREATE INDEX "report_definitions_mart_idx" ON "analytics"."report_definitions" USING btree ("data_mart_id");--> statement-breakpoint
CREATE INDEX "report_definitions_status_idx" ON "analytics"."report_definitions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "report_definitions_category_idx" ON "analytics"."report_definitions" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "report_runs_number_uq" ON "analytics"."report_runs" USING btree ("run_number");--> statement-breakpoint
CREATE INDEX "report_runs_report_idx" ON "analytics"."report_runs" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "report_runs_status_idx" ON "analytics"."report_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "report_runs_created_idx" ON "analytics"."report_runs" USING btree ("created_at");