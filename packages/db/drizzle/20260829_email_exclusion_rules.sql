CREATE TABLE IF NOT EXISTS "email_exclusion_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "kind" text NOT NULL,
  "value" text NOT NULL,
  "pattern" text NOT NULL,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_exclusion_rules_kind_value_uidx" ON "email_exclusion_rules" ("kind", "value");
