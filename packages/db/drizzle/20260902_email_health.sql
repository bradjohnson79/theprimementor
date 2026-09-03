ALTER TABLE "email_contacts"
  ADD COLUMN IF NOT EXISTS "health_status" text DEFAULT 'unchecked' NOT NULL,
  ADD COLUMN IF NOT EXISTS "health_checked_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "health_source" text,
  ADD COLUMN IF NOT EXISTS "health_reason" text,
  ADD COLUMN IF NOT EXISTS "last_bounce_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "bounce_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "soft_bounce_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "last_soft_bounce_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "email_contacts_health_status_idx"
  ON "email_contacts" ("health_status", "health_checked_at");

CREATE TABLE IF NOT EXISTS "email_suppressions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email_normalized" text NOT NULL,
  "reason" text NOT NULL,
  "source" text NOT NULL,
  "provider_event_id" text,
  "suppressed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_suppressions_email_normalized_uidx"
  ON "email_suppressions" ("email_normalized");
CREATE INDEX IF NOT EXISTS "email_suppressions_reason_created_idx"
  ON "email_suppressions" ("reason", "suppressed_at");

CREATE TABLE IF NOT EXISTS "email_health_checks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "contact_id" uuid,
  "email_normalized" text NOT NULL,
  "previous_status" text,
  "new_status" text NOT NULL,
  "source" text NOT NULL,
  "reason" text,
  "checked_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "email_health_checks_email_checked_idx"
  ON "email_health_checks" ("email_normalized", "checked_at");
CREATE INDEX IF NOT EXISTS "email_health_checks_contact_idx"
  ON "email_health_checks" ("contact_id");

CREATE TABLE IF NOT EXISTS "email_delivery_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" text NOT NULL,
  "provider_event_id" text NOT NULL,
  "email_normalized" text NOT NULL,
  "kind" text NOT NULL,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_delivery_events_provider_event_uidx"
  ON "email_delivery_events" ("provider", "provider_event_id");
CREATE INDEX IF NOT EXISTS "email_delivery_events_email_received_idx"
  ON "email_delivery_events" ("email_normalized", "received_at");

CREATE TABLE IF NOT EXISTS "email_health_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "scope" text NOT NULL,
  "status" text DEFAULT 'queued' NOT NULL,
  "total" integer DEFAULT 0 NOT NULL,
  "completed" integer DEFAULT 0 NOT NULL,
  "counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "email_health_jobs_user_created_idx"
  ON "email_health_jobs" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "email_health_jobs_status_idx"
  ON "email_health_jobs" ("status");
