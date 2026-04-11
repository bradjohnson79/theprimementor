CREATE TABLE IF NOT EXISTS "conversation_timeline_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "thread_id" uuid NOT NULL REFERENCES "conversation_threads"("id") ON DELETE cascade,
  "user_id" text NOT NULL,
  "summary" text NOT NULL,
  "systems_used" jsonb,
  "tags" jsonb,
  "type" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "conversation_timeline_events_thread_created_idx"
  ON "conversation_timeline_events" ("thread_id", "created_at");

CREATE INDEX IF NOT EXISTS "conversation_timeline_events_user_created_idx"
  ON "conversation_timeline_events" ("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "conversation_timeline_events_type_created_idx"
  ON "conversation_timeline_events" ("type", "created_at");
