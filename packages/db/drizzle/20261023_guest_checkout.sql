-- Guest checkout (Round 4) — additive only. New nullable/defaulted columns, new tables, new
-- indexes. No drops, renames, type changes, NOT NULL additions on existing data, or data
-- rewrites. Safe to run against production (idempotent via IF NOT EXISTS / duplicate_object).

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_guest" boolean DEFAULT false NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "guest_claimed_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email");
CREATE INDEX IF NOT EXISTS "users_is_guest_idx" ON "users" USING btree ("is_guest");

CREATE TABLE IF NOT EXISTS "guest_order_access_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "token_hash" text NOT NULL,
  "purpose" text DEFAULT 'order_page' NOT NULL,
  "email" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "last_used_at" timestamp with time zone,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "guest_claim_audit" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "guest_user_id" uuid,
  "target_user_id" uuid,
  "action" text NOT NULL,
  "matched_email" text NOT NULL,
  "real_clerk_id" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "guest_order_access_tokens"
    ADD CONSTRAINT "guest_order_access_tokens_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "guest_claim_audit"
    ADD CONSTRAINT "guest_claim_audit_guest_user_id_users_id_fk"
    FOREIGN KEY ("guest_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "guest_claim_audit"
    ADD CONSTRAINT "guest_claim_audit_target_user_id_users_id_fk"
    FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "guest_order_access_tokens_token_hash_uidx"
  ON "guest_order_access_tokens" USING btree ("token_hash");
CREATE INDEX IF NOT EXISTS "guest_order_access_tokens_user_idx"
  ON "guest_order_access_tokens" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "guest_order_access_tokens_email_idx"
  ON "guest_order_access_tokens" USING btree ("email");

CREATE INDEX IF NOT EXISTS "guest_claim_audit_guest_user_idx"
  ON "guest_claim_audit" USING btree ("guest_user_id");
CREATE INDEX IF NOT EXISTS "guest_claim_audit_target_user_idx"
  ON "guest_claim_audit" USING btree ("target_user_id");
