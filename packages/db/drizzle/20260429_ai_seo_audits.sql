DO $$ BEGIN
 ALTER TYPE "public"."seo_recommendation_type" ADD VALUE IF NOT EXISTS 'og_image_update';
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TYPE "public"."seo_recommendation_type" ADD VALUE IF NOT EXISTS 'indexing_update';
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TYPE "public"."seo_recommendation_status" ADD VALUE IF NOT EXISTS 'edited';
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."seo_audit_status" AS ENUM('pending', 'running', 'complete', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."seo_audit_severity" AS ENUM('low', 'medium', 'high');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."seo_recommendation_field" AS ENUM('title', 'meta_description', 'keywords', 'og_image', 'indexing');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."seo_recommendation_action" AS ENUM('update', 'no_change');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."seo_change_source" AS ENUM('manual', 'ai_approved', 'ai_edited', 'rollback');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "seo_audits" (
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
);

ALTER TABLE "seo_audits"
  ADD CONSTRAINT "seo_audits_initiated_by_users_id_fk"
  FOREIGN KEY ("initiated_by") REFERENCES "public"."users"("id")
  ON DELETE set null ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "seo_audits_status_created_idx"
  ON "seo_audits" USING btree ("status", "created_at");
CREATE INDEX IF NOT EXISTS "seo_audits_initiated_by_created_idx"
  ON "seo_audits" USING btree ("initiated_by", "created_at");

CREATE TABLE IF NOT EXISTS "seo_audit_items" (
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
);

ALTER TABLE "seo_audit_items"
  ADD CONSTRAINT "seo_audit_items_audit_id_seo_audits_id_fk"
  FOREIGN KEY ("audit_id") REFERENCES "public"."seo_audits"("id")
  ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "seo_audit_items_audit_severity_idx"
  ON "seo_audit_items" USING btree ("audit_id", "severity", "created_at");
CREATE INDEX IF NOT EXISTS "seo_audit_items_page_issue_idx"
  ON "seo_audit_items" USING btree ("page_key", "issue_type", "created_at");

ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "audit_id" uuid;
ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "field" "seo_recommendation_field";
ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "current_value" jsonb;
ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "suggested_value" jsonb;
ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "edited_value" jsonb;
ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "reasoning" text;
ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "expected_impact" text;
ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "action" "seo_recommendation_action" DEFAULT 'update' NOT NULL;
ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "confidence_score" double precision DEFAULT 0 NOT NULL;
ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;
ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "resolved_at" timestamp with time zone;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seo_recommendations_audit_id_seo_audits_id_fk') THEN
    ALTER TABLE "seo_recommendations"
      ADD CONSTRAINT "seo_recommendations_audit_id_seo_audits_id_fk"
      FOREIGN KEY ("audit_id") REFERENCES "public"."seo_audits"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "seo_recommendations_audit_page_status_idx"
  ON "seo_recommendations" USING btree ("audit_id", "page_key", "status", "created_at");

CREATE TABLE IF NOT EXISTS "seo_changes_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "recommendation_id" uuid,
  "page_key" text NOT NULL,
  "field" "seo_recommendation_field" NOT NULL,
  "old_value" jsonb,
  "new_value" jsonb,
  "source" "seo_change_source" NOT NULL,
  "applied_by" uuid,
  "applied_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seo_changes_log_recommendation_id_seo_recommendations_id_fk') THEN
    ALTER TABLE "seo_changes_log"
      ADD CONSTRAINT "seo_changes_log_recommendation_id_seo_recommendations_id_fk"
      FOREIGN KEY ("recommendation_id") REFERENCES "public"."seo_recommendations"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seo_changes_log_applied_by_users_id_fk') THEN
    ALTER TABLE "seo_changes_log"
      ADD CONSTRAINT "seo_changes_log_applied_by_users_id_fk"
      FOREIGN KEY ("applied_by") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "seo_changes_log_page_applied_idx"
  ON "seo_changes_log" USING btree ("page_key", "applied_at");
CREATE INDEX IF NOT EXISTS "seo_changes_log_recommendation_idx"
  ON "seo_changes_log" USING btree ("recommendation_id", "applied_at");
CREATE INDEX IF NOT EXISTS "seo_changes_log_applied_by_idx"
  ON "seo_changes_log" USING btree ("applied_by", "applied_at");

CREATE TABLE IF NOT EXISTS "seo_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "audit_id" uuid NOT NULL,
  "report_json" jsonb NOT NULL,
  "pdf_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE "seo_reports"
  ADD CONSTRAINT "seo_reports_audit_id_seo_audits_id_fk"
  FOREIGN KEY ("audit_id") REFERENCES "public"."seo_audits"("id")
  ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "seo_reports_audit_created_idx"
  ON "seo_reports" USING btree ("audit_id", "created_at");
