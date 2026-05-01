CREATE TABLE IF NOT EXISTS "regeneration_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "stripe_customer_id" text,
  "stripe_subscription_id" text,
  "stripe_price_id" text,
  "stripe_checkout_session_id" text,
  "status" text DEFAULT 'inactive' NOT NULL,
  "access_state" text DEFAULT 'inactive' NOT NULL,
  "current_period_start" timestamp with time zone,
  "current_period_end" timestamp with time zone,
  "cancel_at_period_end" boolean DEFAULT false NOT NULL,
  "canceled_at" timestamp with time zone,
  "ended_at" timestamp with time zone,
  "priority_support" boolean DEFAULT false NOT NULL,
  "is_admin_override" boolean DEFAULT false NOT NULL,
  "override_expires_at" timestamp with time zone,
  "last_payment_failed_at" timestamp with time zone,
  "last_checkout_started_at" timestamp with time zone,
  "last_reconciled_at" timestamp with time zone,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'regeneration_subscriptions_user_id_users_id_fk') THEN
    ALTER TABLE "regeneration_subscriptions"
      ADD CONSTRAINT "regeneration_subscriptions_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "regeneration_subscriptions_user_uidx"
  ON "regeneration_subscriptions" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "regeneration_subscriptions_stripe_subscription_uidx"
  ON "regeneration_subscriptions" USING btree ("stripe_subscription_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "regeneration_subscriptions_status_period_idx"
  ON "regeneration_subscriptions" USING btree ("status", "current_period_end");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "regeneration_subscriptions_priority_support_idx"
  ON "regeneration_subscriptions" USING btree ("priority_support", "updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "regeneration_subscriptions_customer_idx"
  ON "regeneration_subscriptions" USING btree ("stripe_customer_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "regeneration_check_ins" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "subscription_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "week_start" date NOT NULL,
  "week_number" integer NOT NULL,
  "experiences" text,
  "changes_noticed" text,
  "challenges" text,
  "admin_notes" text,
  "submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'regeneration_check_ins_subscription_id_regeneration_subscriptions_id_fk') THEN
    ALTER TABLE "regeneration_check_ins"
      ADD CONSTRAINT "regeneration_check_ins_subscription_id_regeneration_subscriptions_id_fk"
      FOREIGN KEY ("subscription_id") REFERENCES "public"."regeneration_subscriptions"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'regeneration_check_ins_user_id_users_id_fk') THEN
    ALTER TABLE "regeneration_check_ins"
      ADD CONSTRAINT "regeneration_check_ins_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "regeneration_check_ins_user_week_uidx"
  ON "regeneration_check_ins" USING btree ("user_id", "week_start");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "regeneration_check_ins_subscription_created_idx"
  ON "regeneration_check_ins" USING btree ("subscription_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "regeneration_check_ins_user_submitted_idx"
  ON "regeneration_check_ins" USING btree ("user_id", "submitted_at");
