CREATE TABLE IF NOT EXISTS "seo_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "audit_id" uuid NOT NULL,
  "report_json" jsonb NOT NULL,
  "pdf_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE "seo_reports" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE "seo_reports" ADD COLUMN IF NOT EXISTS "audit_id" uuid;
ALTER TABLE "seo_reports" ADD COLUMN IF NOT EXISTS "report_json" jsonb;
ALTER TABLE "seo_reports" ADD COLUMN IF NOT EXISTS "pdf_url" text;
ALTER TABLE "seo_reports" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE "seo_reports" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seo_reports_audit_id_seo_audits_id_fk') THEN
    ALTER TABLE "seo_reports"
      ADD CONSTRAINT "seo_reports_audit_id_seo_audits_id_fk"
      FOREIGN KEY ("audit_id") REFERENCES "public"."seo_audits"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "seo_reports_audit_created_idx"
  ON "seo_reports" USING btree ("audit_id", "created_at");
