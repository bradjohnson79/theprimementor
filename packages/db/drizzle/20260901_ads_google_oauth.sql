CREATE TABLE IF NOT EXISTS "ads_google_oauth_states" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "state" text NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "code_verifier" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ads_google_oauth_states_state_uidx"
  ON "ads_google_oauth_states" ("state");

CREATE INDEX IF NOT EXISTS "ads_google_oauth_states_expires_idx"
  ON "ads_google_oauth_states" ("expires_at");

CREATE TABLE IF NOT EXISTS "ads_google_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_key" text NOT NULL,
  "encrypted_tokens" text NOT NULL,
  "token_expires_at" timestamp with time zone,
  "granted_scope" text NOT NULL,
  "status" text DEFAULT 'connected' NOT NULL,
  "validated_at" timestamp with time zone,
  "connected_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ads_google_connections_account_key_uidx"
  ON "ads_google_connections" ("account_key");
