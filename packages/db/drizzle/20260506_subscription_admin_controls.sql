CREATE TABLE IF NOT EXISTS "subscription_admin_audit_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "subscription_kind" text NOT NULL,
  "membership_subscription_id" uuid,
  "regeneration_subscription_id" uuid,
  "stripe_subscription_id" text,
  "admin_user_id" uuid,
  "actor_type" text DEFAULT 'admin' NOT NULL,
  "actor_label" text,
  "action_type" text NOT NULL,
  "previous_status" text,
  "new_status" text,
  "reason" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_admin_audit_entries_membership_subscription_id_subscriptions_id_fk') THEN
    ALTER TABLE "subscription_admin_audit_entries"
      ADD CONSTRAINT "subscription_admin_audit_entries_membership_subscription_id_subscriptions_id_fk"
      FOREIGN KEY ("membership_subscription_id") REFERENCES "public"."subscriptions"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_admin_audit_entries_regeneration_subscription_id_regeneration_subscriptions_id_fk') THEN
    ALTER TABLE "subscription_admin_audit_entries"
      ADD CONSTRAINT "subscription_admin_audit_entries_regeneration_subscription_id_regeneration_subscriptions_id_fk"
      FOREIGN KEY ("regeneration_subscription_id") REFERENCES "public"."regeneration_subscriptions"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_admin_audit_entries_admin_user_id_users_id_fk') THEN
    ALTER TABLE "subscription_admin_audit_entries"
      ADD CONSTRAINT "subscription_admin_audit_entries_admin_user_id_users_id_fk"
      FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_audit_membership_created_idx" ON "subscription_admin_audit_entries" USING btree ("membership_subscription_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_audit_regeneration_created_idx" ON "subscription_admin_audit_entries" USING btree ("regeneration_subscription_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_audit_stripe_created_idx" ON "subscription_admin_audit_entries" USING btree ("stripe_subscription_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_audit_action_created_idx" ON "subscription_admin_audit_entries" USING btree ("action_type", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_audit_actor_created_idx" ON "subscription_admin_audit_entries" USING btree ("actor_type", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription_admin_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "subscription_kind" text NOT NULL,
  "membership_subscription_id" uuid,
  "regeneration_subscription_id" uuid,
  "stripe_subscription_id" text,
  "admin_user_id" uuid,
  "note" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_admin_notes_membership_subscription_id_subscriptions_id_fk') THEN
    ALTER TABLE "subscription_admin_notes"
      ADD CONSTRAINT "subscription_admin_notes_membership_subscription_id_subscriptions_id_fk"
      FOREIGN KEY ("membership_subscription_id") REFERENCES "public"."subscriptions"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_admin_notes_regeneration_subscription_id_regeneration_subscriptions_id_fk') THEN
    ALTER TABLE "subscription_admin_notes"
      ADD CONSTRAINT "subscription_admin_notes_regeneration_subscription_id_regeneration_subscriptions_id_fk"
      FOREIGN KEY ("regeneration_subscription_id") REFERENCES "public"."regeneration_subscriptions"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_admin_notes_admin_user_id_users_id_fk') THEN
    ALTER TABLE "subscription_admin_notes"
      ADD CONSTRAINT "subscription_admin_notes_admin_user_id_users_id_fk"
      FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_notes_membership_created_idx" ON "subscription_admin_notes" USING btree ("membership_subscription_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_notes_regeneration_created_idx" ON "subscription_admin_notes" USING btree ("regeneration_subscription_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_notes_stripe_created_idx" ON "subscription_admin_notes" USING btree ("stripe_subscription_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_notes_admin_created_idx" ON "subscription_admin_notes" USING btree ("admin_user_id", "created_at");
