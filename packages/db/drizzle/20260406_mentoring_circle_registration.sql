CREATE TABLE "mentoring_circle_registrations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "event_key" text NOT NULL,
  "event_title" text NOT NULL,
  "event_start_at" timestamp with time zone NOT NULL,
  "timezone" text NOT NULL,
  "status" text DEFAULT 'registered' NOT NULL,
  "join_url" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "mentoring_circle_registrations"
ADD CONSTRAINT "mentoring_circle_registrations_user_id_users_id_fk"
FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "mentoring_circle_registrations_user_event_uidx"
ON "mentoring_circle_registrations" USING btree ("user_id","event_key");
--> statement-breakpoint
CREATE INDEX "mentoring_circle_registrations_event_start_idx"
ON "mentoring_circle_registrations" USING btree ("event_start_at","status");
