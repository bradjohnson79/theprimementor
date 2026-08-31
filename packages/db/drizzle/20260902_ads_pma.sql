CREATE TABLE IF NOT EXISTS "ads_pma_projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "offer_key" text DEFAULT 'divin8_reports' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ads_pma_projects_slug_uidx"
  ON "ads_pma_projects" ("slug");

CREATE TABLE IF NOT EXISTS "ads_pma_analyses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "ads_pma_projects"("id") ON DELETE CASCADE,
  "status" text DEFAULT 'queued' NOT NULL,
  "stage" text,
  "seeds" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "error" text,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ads_pma_analyses_project_created_idx"
  ON "ads_pma_analyses" ("project_id", "created_at");
