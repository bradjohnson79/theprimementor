import type { Database } from "@wisdom/db";
import { sql } from "drizzle-orm";

const REPAIRABLE_PREFIXES = [
  "profiles.",
  "conversation_memories.",
  "seo_settings.",
  "seo_audits.",
  "seo_audit_items.",
  "seo_recommendations.",
  "seo_recommendation_apply_history.",
  "seo_changes_log.",
  "seo_reports.",
] as const;

const KNOWN_SCHEMA_REPAIR_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "seo_settings" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "page_key" text NOT NULL,
    "title" text,
    "meta_description" text,
    "keywords" jsonb DEFAULT '{"primary":[],"secondary":[]}'::jsonb NOT NULL,
    "og_image" text,
    "robots_index" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now()
  );`,
  `ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;`,
  `ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "page_key" text;`,
  `ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "title" text;`,
  `ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "meta_description" text;`,
  `ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "keywords" jsonb DEFAULT '{"primary":[],"secondary":[]}'::jsonb NOT NULL;`,
  `ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "og_image" text;`,
  `ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "robots_index" boolean DEFAULT true NOT NULL;`,
  `ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;`,
  `ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "seo_settings_page_key_uidx" ON "seo_settings" USING btree ("page_key");`,
  `CREATE INDEX IF NOT EXISTS "seo_settings_created_idx" ON "seo_settings" USING btree ("created_at");`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'seo_recommendation_type') THEN
      CREATE TYPE "public"."seo_recommendation_type" AS ENUM('initial_generation', 'title_update', 'meta_description_update', 'keyword_update', 'no_change');
    END IF;
  END $$;`,
  `DO $$ BEGIN
    BEGIN
      ALTER TYPE "public"."seo_recommendation_type" ADD VALUE IF NOT EXISTS 'og_image_update';
      ALTER TYPE "public"."seo_recommendation_type" ADD VALUE IF NOT EXISTS 'indexing_update';
    EXCEPTION
      WHEN duplicate_object THEN null;
    END;
  END $$;`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'seo_recommendation_impact') THEN
      CREATE TYPE "public"."seo_recommendation_impact" AS ENUM('low', 'medium', 'high');
    END IF;
  END $$;`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'seo_recommendation_source') THEN
      CREATE TYPE "public"."seo_recommendation_source" AS ENUM('initial_scan', 'weekly_optimization');
    END IF;
  END $$;`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'seo_recommendation_status') THEN
      CREATE TYPE "public"."seo_recommendation_status" AS ENUM('pending', 'approved', 'rejected', 'applied', 'superseded');
    END IF;
  END $$;`,
  `DO $$ BEGIN
    BEGIN
      ALTER TYPE "public"."seo_recommendation_status" ADD VALUE IF NOT EXISTS 'edited';
    EXCEPTION
      WHEN duplicate_object THEN null;
    END;
  END $$;`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'seo_intent') THEN
      CREATE TYPE "public"."seo_intent" AS ENUM('informational', 'transactional', 'navigational');
    END IF;
  END $$;`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'seo_audit_status') THEN
      CREATE TYPE "public"."seo_audit_status" AS ENUM('pending', 'running', 'complete', 'failed');
    END IF;
  END $$;`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'seo_audit_severity') THEN
      CREATE TYPE "public"."seo_audit_severity" AS ENUM('low', 'medium', 'high');
    END IF;
  END $$;`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'seo_recommendation_field') THEN
      CREATE TYPE "public"."seo_recommendation_field" AS ENUM('title', 'meta_description', 'keywords', 'og_image', 'indexing');
    END IF;
  END $$;`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'seo_recommendation_action') THEN
      CREATE TYPE "public"."seo_recommendation_action" AS ENUM('update', 'no_change');
    END IF;
  END $$;`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'seo_change_source') THEN
      CREATE TYPE "public"."seo_change_source" AS ENUM('manual', 'ai_approved', 'ai_edited', 'rollback');
    END IF;
  END $$;`,
  `CREATE TABLE IF NOT EXISTS "seo_audits" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "initiated_by" uuid,
    "scope" text NOT NULL,
    "mode" text DEFAULT 'full' NOT NULL,
    "status" "seo_audit_status" DEFAULT 'pending' NOT NULL,
    "summary_json" jsonb,
    "completed_at" timestamp with time zone,
    "failure_reason" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now()
  );`,
  `ALTER TABLE "seo_audits" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;`,
  `ALTER TABLE "seo_audits" ADD COLUMN IF NOT EXISTS "initiated_by" uuid;`,
  `ALTER TABLE "seo_audits" ADD COLUMN IF NOT EXISTS "scope" text;`,
  `ALTER TABLE "seo_audits" ADD COLUMN IF NOT EXISTS "mode" text DEFAULT 'full' NOT NULL;`,
  `ALTER TABLE "seo_audits" ADD COLUMN IF NOT EXISTS "status" "seo_audit_status" DEFAULT 'pending' NOT NULL;`,
  `ALTER TABLE "seo_audits" ADD COLUMN IF NOT EXISTS "summary_json" jsonb;`,
  `ALTER TABLE "seo_audits" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;`,
  `ALTER TABLE "seo_audits" ADD COLUMN IF NOT EXISTS "failure_reason" text;`,
  `ALTER TABLE "seo_audits" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;`,
  `ALTER TABLE "seo_audits" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seo_audits_initiated_by_users_id_fk') THEN
      ALTER TABLE "seo_audits"
        ADD CONSTRAINT "seo_audits_initiated_by_users_id_fk"
        FOREIGN KEY ("initiated_by") REFERENCES "public"."users"("id")
        ON DELETE set null ON UPDATE no action;
    END IF;
  END $$;`,
  `CREATE INDEX IF NOT EXISTS "seo_audits_status_created_idx" ON "seo_audits" USING btree ("status", "created_at");`,
  `CREATE INDEX IF NOT EXISTS "seo_audits_initiated_by_created_idx" ON "seo_audits" USING btree ("initiated_by", "created_at");`,
  `CREATE TABLE IF NOT EXISTS "seo_audit_items" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "audit_id" uuid NOT NULL,
    "page_key" text NOT NULL,
    "issue_type" text NOT NULL,
    "severity" "seo_audit_severity" NOT NULL,
    "description" text NOT NULL,
    "detected_value" jsonb,
    "recommended_value" jsonb,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now()
  );`,
  `ALTER TABLE "seo_audit_items" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;`,
  `ALTER TABLE "seo_audit_items" ADD COLUMN IF NOT EXISTS "audit_id" uuid;`,
  `ALTER TABLE "seo_audit_items" ADD COLUMN IF NOT EXISTS "page_key" text;`,
  `ALTER TABLE "seo_audit_items" ADD COLUMN IF NOT EXISTS "issue_type" text;`,
  `ALTER TABLE "seo_audit_items" ADD COLUMN IF NOT EXISTS "severity" "seo_audit_severity";`,
  `ALTER TABLE "seo_audit_items" ADD COLUMN IF NOT EXISTS "description" text;`,
  `ALTER TABLE "seo_audit_items" ADD COLUMN IF NOT EXISTS "detected_value" jsonb;`,
  `ALTER TABLE "seo_audit_items" ADD COLUMN IF NOT EXISTS "recommended_value" jsonb;`,
  `ALTER TABLE "seo_audit_items" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;`,
  `ALTER TABLE "seo_audit_items" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seo_audit_items_audit_id_seo_audits_id_fk') THEN
      ALTER TABLE "seo_audit_items"
        ADD CONSTRAINT "seo_audit_items_audit_id_seo_audits_id_fk"
        FOREIGN KEY ("audit_id") REFERENCES "public"."seo_audits"("id")
        ON DELETE cascade ON UPDATE no action;
    END IF;
  END $$;`,
  `CREATE INDEX IF NOT EXISTS "seo_audit_items_audit_severity_idx" ON "seo_audit_items" USING btree ("audit_id", "severity", "created_at");`,
  `CREATE INDEX IF NOT EXISTS "seo_audit_items_page_issue_idx" ON "seo_audit_items" USING btree ("page_key", "issue_type", "created_at");`,
  `CREATE TABLE IF NOT EXISTS "seo_recommendations" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "page_key" text NOT NULL,
    "type" "seo_recommendation_type" NOT NULL,
    "reason" text,
    "expected_outcome" text,
    "current_snapshot" jsonb NOT NULL,
    "suggested_snapshot" jsonb NOT NULL,
    "impact" "seo_recommendation_impact",
    "admin_impact_override" "seo_recommendation_impact",
    "intent" "seo_intent",
    "confidence" double precision DEFAULT 0 NOT NULL,
    "source" "seo_recommendation_source" NOT NULL,
    "status" "seo_recommendation_status" DEFAULT 'pending' NOT NULL,
    "dedupe_hash" text,
    "model_name" text,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" uuid,
    "last_recommendation_at" timestamp with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now()
  );`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "audit_id" uuid;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "page_key" text;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "type" "seo_recommendation_type";`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "reason" text;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "expected_outcome" text;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "current_snapshot" jsonb;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "suggested_snapshot" jsonb;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "field" "seo_recommendation_field";`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "current_value" jsonb;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "suggested_value" jsonb;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "edited_value" jsonb;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "reasoning" text;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "expected_impact" text;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "action" "seo_recommendation_action" DEFAULT 'update' NOT NULL;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "impact" "seo_recommendation_impact";`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "admin_impact_override" "seo_recommendation_impact";`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "intent" "seo_intent";`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "confidence" double precision DEFAULT 0 NOT NULL;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "confidence_score" double precision DEFAULT 0 NOT NULL;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "source" "seo_recommendation_source";`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "status" "seo_recommendation_status" DEFAULT 'pending' NOT NULL;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "dedupe_hash" text;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "model_name" text;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp with time zone;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "reviewed_by" uuid;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "resolved_at" timestamp with time zone;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "last_recommendation_at" timestamp with time zone DEFAULT now() NOT NULL;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seo_recommendations_audit_id_seo_audits_id_fk') THEN
      ALTER TABLE "seo_recommendations"
        ADD CONSTRAINT "seo_recommendations_audit_id_seo_audits_id_fk"
        FOREIGN KEY ("audit_id") REFERENCES "public"."seo_audits"("id")
        ON DELETE set null ON UPDATE no action;
    END IF;
  END $$;`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seo_recommendations_reviewed_by_users_id_fk') THEN
      ALTER TABLE "seo_recommendations"
        ADD CONSTRAINT "seo_recommendations_reviewed_by_users_id_fk"
        FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id")
        ON DELETE set null ON UPDATE no action;
    END IF;
  END $$;`,
  `CREATE INDEX IF NOT EXISTS "seo_recommendations_audit_page_status_idx" ON "seo_recommendations" USING btree ("audit_id", "page_key", "status", "created_at");`,
  `CREATE INDEX IF NOT EXISTS "seo_recommendations_page_status_created_idx" ON "seo_recommendations" USING btree ("page_key", "status", "created_at");`,
  `CREATE INDEX IF NOT EXISTS "seo_recommendations_status_created_idx" ON "seo_recommendations" USING btree ("status", "created_at");`,
  `CREATE INDEX IF NOT EXISTS "seo_recommendations_dedupe_hash_idx" ON "seo_recommendations" USING btree ("dedupe_hash", "created_at");`,
  `CREATE INDEX IF NOT EXISTS "seo_recommendations_reviewed_by_idx" ON "seo_recommendations" USING btree ("reviewed_by", "reviewed_at");`,
  `CREATE TABLE IF NOT EXISTS "seo_recommendation_apply_history" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "recommendation_id" uuid NOT NULL,
    "page_key" text NOT NULL,
    "previous_value" jsonb NOT NULL,
    "new_value" jsonb NOT NULL,
    "applied_at" timestamp with time zone DEFAULT now() NOT NULL,
    "applied_by" uuid
  );`,
  `ALTER TABLE "seo_recommendation_apply_history" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;`,
  `ALTER TABLE "seo_recommendation_apply_history" ADD COLUMN IF NOT EXISTS "recommendation_id" uuid;`,
  `ALTER TABLE "seo_recommendation_apply_history" ADD COLUMN IF NOT EXISTS "page_key" text;`,
  `ALTER TABLE "seo_recommendation_apply_history" ADD COLUMN IF NOT EXISTS "previous_value" jsonb;`,
  `ALTER TABLE "seo_recommendation_apply_history" ADD COLUMN IF NOT EXISTS "new_value" jsonb;`,
  `ALTER TABLE "seo_recommendation_apply_history" ADD COLUMN IF NOT EXISTS "applied_at" timestamp with time zone DEFAULT now() NOT NULL;`,
  `ALTER TABLE "seo_recommendation_apply_history" ADD COLUMN IF NOT EXISTS "applied_by" uuid;`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seo_recommendation_apply_history_recommendation_id_seo_recommendations_id_fk') THEN
      ALTER TABLE "seo_recommendation_apply_history"
        ADD CONSTRAINT "seo_recommendation_apply_history_recommendation_id_seo_recommendations_id_fk"
        FOREIGN KEY ("recommendation_id") REFERENCES "public"."seo_recommendations"("id")
        ON DELETE cascade ON UPDATE no action;
    END IF;
  END $$;`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seo_recommendation_apply_history_applied_by_users_id_fk') THEN
      ALTER TABLE "seo_recommendation_apply_history"
        ADD CONSTRAINT "seo_recommendation_apply_history_applied_by_users_id_fk"
        FOREIGN KEY ("applied_by") REFERENCES "public"."users"("id")
        ON DELETE set null ON UPDATE no action;
    END IF;
  END $$;`,
  `CREATE INDEX IF NOT EXISTS "seo_recommendation_apply_history_recommendation_idx" ON "seo_recommendation_apply_history" USING btree ("recommendation_id");`,
  `CREATE INDEX IF NOT EXISTS "seo_recommendation_apply_history_page_applied_idx" ON "seo_recommendation_apply_history" USING btree ("page_key", "applied_at");`,
  `CREATE INDEX IF NOT EXISTS "seo_recommendation_apply_history_applied_by_idx" ON "seo_recommendation_apply_history" USING btree ("applied_by", "applied_at");`,
  `CREATE TABLE IF NOT EXISTS "seo_changes_log" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "recommendation_id" uuid,
    "page_key" text NOT NULL,
    "field" "seo_recommendation_field" NOT NULL,
    "old_value" jsonb,
    "new_value" jsonb,
    "source" "seo_change_source" NOT NULL,
    "applied_by" uuid,
    "applied_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `ALTER TABLE "seo_changes_log" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;`,
  `ALTER TABLE "seo_changes_log" ADD COLUMN IF NOT EXISTS "recommendation_id" uuid;`,
  `ALTER TABLE "seo_changes_log" ADD COLUMN IF NOT EXISTS "page_key" text;`,
  `ALTER TABLE "seo_changes_log" ADD COLUMN IF NOT EXISTS "field" "seo_recommendation_field";`,
  `ALTER TABLE "seo_changes_log" ADD COLUMN IF NOT EXISTS "old_value" jsonb;`,
  `ALTER TABLE "seo_changes_log" ADD COLUMN IF NOT EXISTS "new_value" jsonb;`,
  `ALTER TABLE "seo_changes_log" ADD COLUMN IF NOT EXISTS "source" "seo_change_source";`,
  `ALTER TABLE "seo_changes_log" ADD COLUMN IF NOT EXISTS "applied_by" uuid;`,
  `ALTER TABLE "seo_changes_log" ADD COLUMN IF NOT EXISTS "applied_at" timestamp with time zone DEFAULT now() NOT NULL;`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seo_changes_log_recommendation_id_seo_recommendations_id_fk') THEN
      ALTER TABLE "seo_changes_log"
        ADD CONSTRAINT "seo_changes_log_recommendation_id_seo_recommendations_id_fk"
        FOREIGN KEY ("recommendation_id") REFERENCES "public"."seo_recommendations"("id")
        ON DELETE set null ON UPDATE no action;
    END IF;
  END $$;`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seo_changes_log_applied_by_users_id_fk') THEN
      ALTER TABLE "seo_changes_log"
        ADD CONSTRAINT "seo_changes_log_applied_by_users_id_fk"
        FOREIGN KEY ("applied_by") REFERENCES "public"."users"("id")
        ON DELETE set null ON UPDATE no action;
    END IF;
  END $$;`,
  `CREATE INDEX IF NOT EXISTS "seo_changes_log_page_applied_idx" ON "seo_changes_log" USING btree ("page_key", "applied_at");`,
  `CREATE INDEX IF NOT EXISTS "seo_changes_log_recommendation_idx" ON "seo_changes_log" USING btree ("recommendation_id", "applied_at");`,
  `CREATE INDEX IF NOT EXISTS "seo_changes_log_applied_by_idx" ON "seo_changes_log" USING btree ("applied_by", "applied_at");`,
  `CREATE TABLE IF NOT EXISTS "seo_reports" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "audit_id" uuid NOT NULL,
    "report_json" jsonb NOT NULL,
    "pdf_url" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now()
  );`,
  `ALTER TABLE "seo_reports" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;`,
  `ALTER TABLE "seo_reports" ADD COLUMN IF NOT EXISTS "audit_id" uuid;`,
  `ALTER TABLE "seo_reports" ADD COLUMN IF NOT EXISTS "report_json" jsonb;`,
  `ALTER TABLE "seo_reports" ADD COLUMN IF NOT EXISTS "pdf_url" text;`,
  `ALTER TABLE "seo_reports" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;`,
  `ALTER TABLE "seo_reports" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seo_reports_audit_id_seo_audits_id_fk') THEN
      ALTER TABLE "seo_reports"
        ADD CONSTRAINT "seo_reports_audit_id_seo_audits_id_fk"
        FOREIGN KEY ("audit_id") REFERENCES "public"."seo_audits"("id")
        ON DELETE cascade ON UPDATE no action;
    END IF;
  END $$;`,
  `CREATE INDEX IF NOT EXISTS "seo_reports_audit_created_idx" ON "seo_reports" USING btree ("audit_id", "created_at");`,
  `CREATE TABLE IF NOT EXISTS "profiles" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "full_name" text NOT NULL,
    "tag" text NOT NULL,
    "birth_date" date NOT NULL,
    "birth_time" text NOT NULL,
    "birth_place" text NOT NULL,
    "lat" double precision NOT NULL,
    "lng" double precision NOT NULL,
    "timezone" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;`,
  `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "user_id" uuid;`,
  `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "full_name" text;`,
  `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "tag" text;`,
  `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "birth_date" date;`,
  `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "birth_time" text;`,
  `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "birth_place" text;`,
  `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "lat" double precision;`,
  `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "lng" double precision;`,
  `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "timezone" text;`,
  `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_users_id_fk') THEN
      ALTER TABLE "profiles"
        ADD CONSTRAINT "profiles_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
        ON DELETE cascade ON UPDATE no action;
    END IF;
  END $$;`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "profiles_user_tag_uidx" ON "profiles" USING btree ("user_id", "tag");`,
  `CREATE INDEX IF NOT EXISTS "profiles_user_idx" ON "profiles" USING btree ("user_id");`,
  `CREATE INDEX IF NOT EXISTS "profiles_tag_idx" ON "profiles" USING btree ("tag");`,
  `CREATE TABLE IF NOT EXISTS "conversation_memories" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "conversation_id" uuid NOT NULL,
    "user_id" text NOT NULL,
    "type" text NOT NULL,
    "content" text NOT NULL,
    "relevance_score" double precision DEFAULT 0.5 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now()
  );`,
  `ALTER TABLE "conversation_memories" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;`,
  `ALTER TABLE "conversation_memories" ADD COLUMN IF NOT EXISTS "conversation_id" uuid;`,
  `ALTER TABLE "conversation_memories" ADD COLUMN IF NOT EXISTS "user_id" text;`,
  `ALTER TABLE "conversation_memories" ADD COLUMN IF NOT EXISTS "type" text;`,
  `ALTER TABLE "conversation_memories" ADD COLUMN IF NOT EXISTS "content" text;`,
  `ALTER TABLE "conversation_memories" ADD COLUMN IF NOT EXISTS "relevance_score" double precision DEFAULT 0.5 NOT NULL;`,
  `ALTER TABLE "conversation_memories" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;`,
  `ALTER TABLE "conversation_memories" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversation_memories_conversation_id_conversation_threads_id_fk') THEN
      ALTER TABLE "conversation_memories"
        ADD CONSTRAINT "conversation_memories_conversation_id_conversation_threads_id_fk"
        FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation_threads"("id")
        ON DELETE cascade ON UPDATE no action;
    END IF;
  END $$;`,
  `CREATE INDEX IF NOT EXISTS "conversation_memories_conversation_created_idx" ON "conversation_memories" USING btree ("conversation_id", "created_at");`,
  `CREATE INDEX IF NOT EXISTS "conversation_memories_user_created_idx" ON "conversation_memories" USING btree ("user_id", "created_at");`,
  `CREATE INDEX IF NOT EXISTS "conversation_memories_user_type_created_idx" ON "conversation_memories" USING btree ("user_id", "type", "created_at");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "conversation_memories_conversation_type_content_uidx" ON "conversation_memories" USING btree ("conversation_id", "type", "content");`,
] as const;

const KNOWN_DATA_REPAIR_STATEMENTS = [
  `ALTER TYPE "public"."booking_session_type" ADD VALUE IF NOT EXISTS 'qa_session';`,
  `INSERT INTO "booking_types" (
    "id",
    "name",
    "session_type",
    "duration_minutes",
    "price_cents",
    "currency",
    "buffer_before_minutes",
    "buffer_after_minutes",
    "is_active"
  )
  VALUES (
    'qa-session-30',
    'Q&A Session',
    'qa_session',
    30,
    14999,
    'CAD',
    10,
    10,
    true
  )
  ON CONFLICT ("id") DO UPDATE
  SET
    "name" = excluded."name",
    "session_type" = excluded."session_type",
    "duration_minutes" = excluded."duration_minutes",
    "price_cents" = excluded."price_cents",
    "currency" = excluded."currency",
    "buffer_before_minutes" = excluded."buffer_before_minutes",
    "buffer_after_minutes" = excluded."buffer_after_minutes",
    "is_active" = true,
    "updated_at" = now();`,
] as const;

export function canRepairKnownSchemaGaps(missingEntries: string[]) {
  return missingEntries.some((entry) => REPAIRABLE_PREFIXES.some((prefix) => entry.startsWith(prefix)));
}

export async function repairKnownSchemaGaps(db: Database) {
  for (const statement of KNOWN_SCHEMA_REPAIR_STATEMENTS) {
    await db.execute(sql.raw(statement));
  }
}

export async function ensureKnownDataRows(db: Database) {
  for (const statement of KNOWN_DATA_REPAIR_STATEMENTS) {
    await db.execute(sql.raw(statement));
  }
}
