import type { Database } from "@wisdom/db";
import { sql } from "drizzle-orm";

const REPAIRABLE_PREFIXES = [
  "profiles.",
  "conversation_memories.",
  "seo_settings.",
  "seo_recommendations.",
  "seo_recommendation_apply_history.",
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
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'seo_intent') THEN
      CREATE TYPE "public"."seo_intent" AS ENUM('informational', 'transactional', 'navigational');
    END IF;
  END $$;`,
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
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "page_key" text;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "type" "seo_recommendation_type";`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "reason" text;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "expected_outcome" text;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "current_snapshot" jsonb;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "suggested_snapshot" jsonb;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "impact" "seo_recommendation_impact";`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "admin_impact_override" "seo_recommendation_impact";`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "intent" "seo_intent";`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "confidence" double precision DEFAULT 0 NOT NULL;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "source" "seo_recommendation_source";`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "status" "seo_recommendation_status" DEFAULT 'pending' NOT NULL;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "dedupe_hash" text;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "model_name" text;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp with time zone;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "reviewed_by" uuid;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "last_recommendation_at" timestamp with time zone DEFAULT now() NOT NULL;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;`,
  `ALTER TABLE "seo_recommendations" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seo_recommendations_reviewed_by_users_id_fk') THEN
      ALTER TABLE "seo_recommendations"
        ADD CONSTRAINT "seo_recommendations_reviewed_by_users_id_fk"
        FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id")
        ON DELETE set null ON UPDATE no action;
    END IF;
  END $$;`,
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

export function canRepairKnownSchemaGaps(missingEntries: string[]) {
  return missingEntries.some((entry) => REPAIRABLE_PREFIXES.some((prefix) => entry.startsWith(prefix)));
}

export async function repairKnownSchemaGaps(db: Database) {
  for (const statement of KNOWN_SCHEMA_REPAIR_STATEMENTS) {
    await db.execute(sql.raw(statement));
  }
}
