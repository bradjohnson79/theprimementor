CREATE TYPE "public"."notification_recipient_type" AS ENUM('user', 'admin');
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'sent', 'failed', 'skipped_duplicate');

CREATE TABLE "notification_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "user_id" uuid,
  "recipient_type" "notification_recipient_type" NOT NULL,
  "recipient" text NOT NULL,
  "provider" text NOT NULL,
  "provider_message_id" text,
  "template_version" text NOT NULL,
  "status" "notification_status" DEFAULT 'pending' NOT NULL,
  "payload" jsonb NOT NULL,
  "failure_reason" text,
  "sent_at" timestamp with time zone,
  "last_attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE "notification_events"
  ADD CONSTRAINT "notification_events_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

CREATE UNIQUE INDEX "notification_events_event_entity_recipient_uidx"
  ON "notification_events" USING btree ("event_type", "entity_id", "recipient_type");

CREATE INDEX "notification_events_status_attempted_idx"
  ON "notification_events" USING btree ("status", "last_attempted_at");

CREATE INDEX "notification_events_recipient_type_sent_idx"
  ON "notification_events" USING btree ("recipient_type", "sent_at");

CREATE TABLE "notification_settings" (
  "id" text PRIMARY KEY NOT NULL,
  "enabled_events" jsonb NOT NULL,
  "admin_recipients" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX "notification_settings_created_idx"
  ON "notification_settings" USING btree ("created_at");
