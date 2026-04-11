CREATE TABLE IF NOT EXISTS "member_entitlements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "stripe_subscription_id" text,
  "tier" text DEFAULT 'seeker' NOT NULL,
  "billing_interval" text DEFAULT 'monthly' NOT NULL,
  "current_period_start" timestamp with time zone,
  "current_period_end" timestamp with time zone,
  "last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member_usage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "period_start" timestamp with time zone NOT NULL,
  "period_end" timestamp with time zone NOT NULL,
  "prompts_used" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member_usage_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "request_id" text NOT NULL,
  "thread_id" uuid,
  "message_id" uuid,
  "period_start" timestamp with time zone NOT NULL,
  "period_end" timestamp with time zone NOT NULL,
  "counted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "member_entitlements" ADD CONSTRAINT "member_entitlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "member_usage" ADD CONSTRAINT "member_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "member_usage_events" ADD CONSTRAINT "member_usage_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "member_entitlements_user_uidx" ON "member_entitlements" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_entitlements_subscription_idx" ON "member_entitlements" USING btree ("stripe_subscription_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "member_usage_user_period_uidx" ON "member_usage" USING btree ("user_id","period_start","period_end");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_usage_user_period_idx" ON "member_usage" USING btree ("user_id","period_start","period_end");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "member_usage_events_user_request_uidx" ON "member_usage_events" USING btree ("user_id","request_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_usage_events_user_counted_idx" ON "member_usage_events" USING btree ("user_id","counted_at");
