ALTER TYPE "public"."persisted_order_type" ADD VALUE IF NOT EXISTS 'on_demand_webinar';

DO $$ BEGIN
  CREATE TYPE "public"."webinar_recording_grant_source" AS ENUM('stripe_checkout');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "webinar_recording_entitlements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "webinar_id" text NOT NULL,
  "stripe_checkout_session_id" text,
  "stripe_payment_intent_id" text,
  "stripe_price_id" text,
  "amount_cents" integer,
  "currency" text,
  "grant_source" "webinar_recording_grant_source" DEFAULT 'stripe_checkout' NOT NULL,
  "purchased_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "order_id" uuid,
  "payment_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "webinar_recording_progress" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "webinar_id" text NOT NULL,
  "position_seconds" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "webinar_recording_entitlements"
    ADD CONSTRAINT "webinar_recording_entitlements_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "webinar_recording_entitlements"
    ADD CONSTRAINT "webinar_recording_entitlements_order_id_orders_id_fk"
    FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "webinar_recording_entitlements"
    ADD CONSTRAINT "webinar_recording_entitlements_payment_id_payments_id_fk"
    FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "webinar_recording_progress"
    ADD CONSTRAINT "webinar_recording_progress_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "webinar_recording_entitlements_user_webinar_uidx"
  ON "webinar_recording_entitlements" USING btree ("user_id", "webinar_id");
CREATE INDEX IF NOT EXISTS "webinar_recording_entitlements_user_active_idx"
  ON "webinar_recording_entitlements" USING btree ("user_id", "revoked_at");
CREATE INDEX IF NOT EXISTS "webinar_recording_entitlements_webinar_purchased_idx"
  ON "webinar_recording_entitlements" USING btree ("webinar_id", "purchased_at");
CREATE INDEX IF NOT EXISTS "webinar_recording_entitlements_checkout_session_idx"
  ON "webinar_recording_entitlements" USING btree ("stripe_checkout_session_id");
CREATE INDEX IF NOT EXISTS "webinar_recording_entitlements_payment_intent_idx"
  ON "webinar_recording_entitlements" USING btree ("stripe_payment_intent_id");
CREATE UNIQUE INDEX IF NOT EXISTS "webinar_recording_progress_user_webinar_uidx"
  ON "webinar_recording_progress" USING btree ("user_id", "webinar_id");
CREATE INDEX IF NOT EXISTS "webinar_recording_progress_user_updated_idx"
  ON "webinar_recording_progress" USING btree ("user_id", "updated_at");
