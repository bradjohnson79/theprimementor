CREATE TABLE IF NOT EXISTS "divin8_knowledge_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "category" text NOT NULL,
  "authority_level" text NOT NULL,
  "status" text DEFAULT 'uploading' NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "current_version_id" uuid,
  "current_version_label" text,
  "original_filename" text NOT NULL,
  "mime_type" text NOT NULL,
  "file_size" integer DEFAULT 0 NOT NULL,
  "source_path" text,
  "content_hash" text,
  "last_processed_at" timestamp with time zone,
  "deleted_at" timestamp with time zone,
  "created_by" text,
  "updated_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "divin8_knowledge_source_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_id" uuid NOT NULL REFERENCES "divin8_knowledge_sources"("id") ON DELETE cascade,
  "version_number" integer NOT NULL,
  "version_label" text NOT NULL,
  "status" text DEFAULT 'uploading' NOT NULL,
  "source_path" text,
  "original_filename" text NOT NULL,
  "mime_type" text NOT NULL,
  "file_size" integer DEFAULT 0 NOT NULL,
  "content_hash" text,
  "extracted_text_hash" text,
  "failure_reason" text,
  "processed_at" timestamp with time zone,
  "created_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "divin8_knowledge_source_versions_source_version_uidx" UNIQUE("source_id", "version_number")
);

CREATE TABLE IF NOT EXISTS "divin8_knowledge_extracted_texts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_id" uuid NOT NULL REFERENCES "divin8_knowledge_sources"("id") ON DELETE cascade,
  "version_id" uuid NOT NULL REFERENCES "divin8_knowledge_source_versions"("id") ON DELETE cascade,
  "extracted_text" text NOT NULL,
  "text_hash" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "divin8_knowledge_extracted_texts_version_uidx" UNIQUE("version_id")
);

CREATE TABLE IF NOT EXISTS "divin8_knowledge_chunks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_id" uuid NOT NULL REFERENCES "divin8_knowledge_sources"("id") ON DELETE cascade,
  "version_id" uuid NOT NULL REFERENCES "divin8_knowledge_source_versions"("id") ON DELETE cascade,
  "category" text NOT NULL,
  "authority_level" text NOT NULL,
  "chunk_index" integer NOT NULL,
  "title" text,
  "content" text NOT NULL,
  "keywords" jsonb,
  "concepts" jsonb,
  "metadata" jsonb,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "divin8_canonical_concepts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_id" uuid REFERENCES "divin8_knowledge_sources"("id") ON DELETE set null,
  "version_id" uuid REFERENCES "divin8_knowledge_source_versions"("id") ON DELETE set null,
  "chunk_id" uuid REFERENCES "divin8_knowledge_chunks"("id") ON DELETE set null,
  "category" text NOT NULL,
  "concept_key" text NOT NULL,
  "display_name" text NOT NULL,
  "canonical_meanings" jsonb,
  "forbidden_interpretations" jsonb,
  "preferred_terms" jsonb,
  "replacement_rules" jsonb,
  "authority_level" text NOT NULL,
  "priority" integer DEFAULT 0 NOT NULL,
  "source_kind" text DEFAULT 'extracted' NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_by" text,
  "updated_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "divin8_knowledge_overrides" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_id" uuid REFERENCES "divin8_knowledge_sources"("id") ON DELETE set null,
  "version_id" uuid REFERENCES "divin8_knowledge_source_versions"("id") ON DELETE set null,
  "concept_id" uuid REFERENCES "divin8_canonical_concepts"("id") ON DELETE set null,
  "category" text NOT NULL,
  "rule_key" text NOT NULL,
  "always_use" text,
  "never_use" jsonb,
  "replacements" jsonb,
  "authority_level" text DEFAULT 'hard_override' NOT NULL,
  "priority" integer DEFAULT 100 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "source_kind" text DEFAULT 'manual' NOT NULL,
  "created_by" text,
  "updated_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "divin8_knowledge_audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "admin_user_id" text NOT NULL,
  "action_type" text NOT NULL,
  "source_id" uuid REFERENCES "divin8_knowledge_sources"("id") ON DELETE set null,
  "version_id" uuid REFERENCES "divin8_knowledge_source_versions"("id") ON DELETE set null,
  "concept_id" uuid REFERENCES "divin8_canonical_concepts"("id") ON DELETE set null,
  "override_id" uuid REFERENCES "divin8_knowledge_overrides"("id") ON DELETE set null,
  "before" jsonb,
  "after" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "divin8_knowledge_sources_status_updated_idx"
  ON "divin8_knowledge_sources" ("status", "updated_at");
CREATE INDEX IF NOT EXISTS "divin8_knowledge_sources_category_authority_idx"
  ON "divin8_knowledge_sources" ("category", "authority_level");
CREATE INDEX IF NOT EXISTS "divin8_knowledge_sources_enabled_updated_idx"
  ON "divin8_knowledge_sources" ("enabled", "updated_at");

CREATE INDEX IF NOT EXISTS "divin8_knowledge_source_versions_source_status_idx"
  ON "divin8_knowledge_source_versions" ("source_id", "status");
CREATE INDEX IF NOT EXISTS "divin8_knowledge_source_versions_processed_idx"
  ON "divin8_knowledge_source_versions" ("processed_at");

CREATE INDEX IF NOT EXISTS "divin8_knowledge_extracted_texts_source_idx"
  ON "divin8_knowledge_extracted_texts" ("source_id");

CREATE INDEX IF NOT EXISTS "divin8_knowledge_chunks_source_version_idx"
  ON "divin8_knowledge_chunks" ("source_id", "version_id");
CREATE INDEX IF NOT EXISTS "divin8_knowledge_chunks_category_authority_idx"
  ON "divin8_knowledge_chunks" ("category", "authority_level");
CREATE INDEX IF NOT EXISTS "divin8_knowledge_chunks_enabled_updated_idx"
  ON "divin8_knowledge_chunks" ("enabled", "updated_at");
CREATE INDEX IF NOT EXISTS "divin8_knowledge_chunks_content_fts_idx"
  ON "divin8_knowledge_chunks" USING gin (to_tsvector('english', coalesce("title", '') || ' ' || "content"));

CREATE INDEX IF NOT EXISTS "divin8_canonical_concepts_category_concept_idx"
  ON "divin8_canonical_concepts" ("category", "concept_key");
CREATE INDEX IF NOT EXISTS "divin8_canonical_concepts_active_priority_idx"
  ON "divin8_canonical_concepts" ("active", "priority");
CREATE INDEX IF NOT EXISTS "divin8_canonical_concepts_source_idx"
  ON "divin8_canonical_concepts" ("source_id");

CREATE INDEX IF NOT EXISTS "divin8_knowledge_overrides_category_rule_idx"
  ON "divin8_knowledge_overrides" ("category", "rule_key");
CREATE INDEX IF NOT EXISTS "divin8_knowledge_overrides_active_priority_idx"
  ON "divin8_knowledge_overrides" ("active", "priority");
CREATE INDEX IF NOT EXISTS "divin8_knowledge_overrides_concept_idx"
  ON "divin8_knowledge_overrides" ("concept_id");

CREATE INDEX IF NOT EXISTS "divin8_knowledge_audit_logs_admin_created_idx"
  ON "divin8_knowledge_audit_logs" ("admin_user_id", "created_at");
CREATE INDEX IF NOT EXISTS "divin8_knowledge_audit_logs_action_created_idx"
  ON "divin8_knowledge_audit_logs" ("action_type", "created_at");
CREATE INDEX IF NOT EXISTS "divin8_knowledge_audit_logs_source_created_idx"
  ON "divin8_knowledge_audit_logs" ("source_id", "created_at");
