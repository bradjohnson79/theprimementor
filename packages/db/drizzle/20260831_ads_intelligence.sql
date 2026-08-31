CREATE TABLE IF NOT EXISTS "ads_agent_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ollama_url" text NOT NULL,
  "preferred_model" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "ads_agent_conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text,
  "model" text,
  "summary" text,
  "context" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ads_agent_conversations_user_updated_idx"
  ON "ads_agent_conversations" ("user_id", "updated_at");

CREATE TABLE IF NOT EXISTS "ads_agent_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL REFERENCES "ads_agent_conversations"("id") ON DELETE CASCADE,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "model" text,
  "context" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ads_agent_messages_conversation_created_idx"
  ON "ads_agent_messages" ("conversation_id", "created_at");

CREATE TABLE IF NOT EXISTS "ads_agent_memories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "content" text NOT NULL,
  "source" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ads_agent_memories_user_kind_idx"
  ON "ads_agent_memories" ("user_id", "kind", "created_at");

CREATE TABLE IF NOT EXISTS "ads_divin8_knowledge_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "category" text NOT NULL,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ads_divin8_knowledge_entries_category_updated_idx"
  ON "ads_divin8_knowledge_entries" ("category", "updated_at");

CREATE TABLE IF NOT EXISTS "ads_campaign_proposals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" text DEFAULT 'draft' NOT NULL,
  "objective" text,
  "campaign_type" text,
  "geography" text,
  "audience" text,
  "budget" text,
  "landing_page" text,
  "strategy_notes" text,
  "experiment_hypothesis" text,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ads_campaign_proposals_user_updated_idx"
  ON "ads_campaign_proposals" ("user_id", "updated_at");
