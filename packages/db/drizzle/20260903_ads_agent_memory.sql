ALTER TABLE "ads_agent_memories"
  ADD COLUMN IF NOT EXISTS "layer" text NOT NULL DEFAULT 'workspace',
  ADD COLUMN IF NOT EXISTS "category" text,
  ADD COLUMN IF NOT EXISTS "entity_key" text,
  ADD COLUMN IF NOT EXISTS "metadata" jsonb,
  ADD COLUMN IF NOT EXISTS "authority" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "conversation_id" uuid REFERENCES "ads_agent_conversations"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "ads_agent_memories_user_layer_idx"
  ON "ads_agent_memories" ("user_id", "layer", "created_at");

CREATE INDEX IF NOT EXISTS "ads_agent_memories_user_entity_idx"
  ON "ads_agent_memories" ("user_id", "entity_key", "created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "ads_agent_memories_user_layer_entity_uidx"
  ON "ads_agent_memories" ("user_id", "layer", "entity_key");
