CREATE TABLE "seo_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "page_key" text NOT NULL,
  "title" text,
  "meta_description" text,
  "keywords" jsonb DEFAULT '{"primary":[],"secondary":[]}'::jsonb NOT NULL,
  "og_image" text,
  "robots_index" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX "seo_settings_page_key_uidx" ON "seo_settings" USING btree ("page_key");
CREATE INDEX "seo_settings_created_idx" ON "seo_settings" USING btree ("created_at");
