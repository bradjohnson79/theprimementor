CREATE TABLE IF NOT EXISTS "email_contacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "first_name" text,
  "email" text NOT NULL,
  "email_normalized" text NOT NULL,
  "source" text NOT NULL,
  "source_reference" text,
  "imported_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_contacts_email_normalized_uidx" ON "email_contacts" ("email_normalized");
CREATE INDEX IF NOT EXISTS "email_contacts_source_created_idx" ON "email_contacts" ("source", "created_at");
CREATE INDEX IF NOT EXISTS "email_contacts_imported_by_idx" ON "email_contacts" ("imported_by_user_id");

CREATE TABLE IF NOT EXISTS "gmail_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "gmail_address" text NOT NULL,
  "encrypted_tokens" text NOT NULL,
  "token_expires_at" timestamp with time zone,
  "granted_scope" text NOT NULL,
  "status" text DEFAULT 'connected' NOT NULL,
  "connected_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "gmail_connections_user_uidx" ON "gmail_connections" ("user_id");

CREATE TABLE IF NOT EXISTS "gmail_search_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "query" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "gmail_search_profiles_user_name_uidx" ON "gmail_search_profiles" ("user_id", "name");
CREATE INDEX IF NOT EXISTS "gmail_search_profiles_user_created_idx" ON "gmail_search_profiles" ("user_id", "created_at");

CREATE TABLE IF NOT EXISTS "email_contact_gmail_evidence" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "contact_id" uuid NOT NULL REFERENCES "email_contacts"("id") ON DELETE CASCADE,
  "search_profile_id" uuid REFERENCES "gmail_search_profiles"("id") ON DELETE SET NULL,
  "query" text NOT NULL,
  "thread_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "message_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "first_matched_at" timestamp with time zone,
  "last_matched_at" timestamp with time zone,
  "match_count" integer DEFAULT 0 NOT NULL,
  "two_way" boolean DEFAULT false NOT NULL,
  "imported_by_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE SET NULL,
  "imported_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "email_contact_gmail_evidence_contact_idx" ON "email_contact_gmail_evidence" ("contact_id");
CREATE INDEX IF NOT EXISTS "email_contact_gmail_evidence_imported_by_idx" ON "email_contact_gmail_evidence" ("imported_by_user_id");

CREATE TABLE IF NOT EXISTS "gmail_oauth_states" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "state" text NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "code_verifier" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "gmail_oauth_states_state_uidx" ON "gmail_oauth_states" ("state");
CREATE INDEX IF NOT EXISTS "gmail_oauth_states_expires_idx" ON "gmail_oauth_states" ("expires_at");

CREATE TABLE IF NOT EXISTS "gmail_search_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "query" text NOT NULL,
  "profile_id" uuid REFERENCES "gmail_search_profiles"("id") ON DELETE SET NULL,
  "gmail_page_token" text,
  "candidates" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "gmail_search_sessions_user_idx" ON "gmail_search_sessions" ("user_id", "expires_at");

CREATE TABLE IF NOT EXISTS "email_csv_import_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "column_map" jsonb NOT NULL,
  "rows" jsonb NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "email_csv_import_sessions_user_idx" ON "email_csv_import_sessions" ("user_id", "expires_at");
