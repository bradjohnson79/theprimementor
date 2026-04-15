DO $$ BEGIN
 CREATE TYPE "public"."seo_recommendation_type" AS ENUM('initial_generation', 'title_update', 'meta_description_update', 'keyword_update', 'no_change');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."seo_recommendation_impact" AS ENUM('low', 'medium', 'high');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."seo_recommendation_source" AS ENUM('initial_scan', 'weekly_optimization');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."seo_recommendation_status" AS ENUM('pending', 'approved', 'rejected', 'applied', 'superseded');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."seo_intent" AS ENUM('informational', 'transactional', 'navigational');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE "seo_recommendations" (
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
);

ALTER TABLE "seo_recommendations"
  ADD CONSTRAINT "seo_recommendations_reviewed_by_users_id_fk"
  FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id")
  ON DELETE set null ON UPDATE no action;

CREATE TABLE "seo_recommendation_apply_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "recommendation_id" uuid NOT NULL,
  "page_key" text NOT NULL,
  "previous_value" jsonb NOT NULL,
  "new_value" jsonb NOT NULL,
  "applied_at" timestamp with time zone DEFAULT now() NOT NULL,
  "applied_by" uuid
);

ALTER TABLE "seo_recommendation_apply_history"
  ADD CONSTRAINT "seo_recommendation_apply_history_recommendation_id_seo_recommendations_id_fk"
  FOREIGN KEY ("recommendation_id") REFERENCES "public"."seo_recommendations"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "seo_recommendation_apply_history"
  ADD CONSTRAINT "seo_recommendation_apply_history_applied_by_users_id_fk"
  FOREIGN KEY ("applied_by") REFERENCES "public"."users"("id")
  ON DELETE set null ON UPDATE no action;

CREATE INDEX "seo_recommendations_page_status_created_idx"
  ON "seo_recommendations" USING btree ("page_key", "status", "created_at");
CREATE INDEX "seo_recommendations_status_created_idx"
  ON "seo_recommendations" USING btree ("status", "created_at");
CREATE INDEX "seo_recommendations_dedupe_hash_idx"
  ON "seo_recommendations" USING btree ("dedupe_hash", "created_at");
CREATE INDEX "seo_recommendations_reviewed_by_idx"
  ON "seo_recommendations" USING btree ("reviewed_by", "reviewed_at");
CREATE INDEX "seo_recommendation_apply_history_recommendation_idx"
  ON "seo_recommendation_apply_history" USING btree ("recommendation_id");
CREATE INDEX "seo_recommendation_apply_history_page_applied_idx"
  ON "seo_recommendation_apply_history" USING btree ("page_key", "applied_at");
CREATE INDEX "seo_recommendation_apply_history_applied_by_idx"
  ON "seo_recommendation_apply_history" USING btree ("applied_by", "applied_at");
