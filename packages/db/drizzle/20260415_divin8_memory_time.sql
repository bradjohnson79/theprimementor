CREATE TABLE IF NOT EXISTS "conversation_memories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL REFERENCES "conversation_threads"("id") ON DELETE cascade,
  "user_id" text NOT NULL,
  "type" text NOT NULL,
  "content" text NOT NULL,
  "relevance_score" double precision DEFAULT 0.5 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "conversation_memories_conversation_created_idx"
  ON "conversation_memories" ("conversation_id", "created_at");

CREATE INDEX IF NOT EXISTS "conversation_memories_user_created_idx"
  ON "conversation_memories" ("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "conversation_memories_user_type_created_idx"
  ON "conversation_memories" ("user_id", "type", "created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "conversation_memories_conversation_type_content_uidx"
  ON "conversation_memories" ("conversation_id", "type", "content");
