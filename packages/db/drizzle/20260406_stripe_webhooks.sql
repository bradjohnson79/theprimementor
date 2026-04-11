CREATE TABLE "stripe_customers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "stripe_customer_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stripe_customers" ADD CONSTRAINT "stripe_customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_customers_user_uidx" ON "stripe_customers" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_customers_customer_uidx" ON "stripe_customers" USING btree ("stripe_customer_id");
--> statement-breakpoint
CREATE TABLE "subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "stripe_subscription_id" text NOT NULL,
  "stripe_customer_id" text NOT NULL,
  "tier" text,
  "status" text DEFAULT 'incomplete' NOT NULL,
  "cancel_at_period_end" boolean DEFAULT false NOT NULL,
  "current_period_end" timestamp with time zone,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_stripe_subscription_uidx" ON "subscriptions" USING btree ("stripe_subscription_id");
--> statement-breakpoint
CREATE INDEX "subscriptions_user_created_idx" ON "subscriptions" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX "subscriptions_status_period_idx" ON "subscriptions" USING btree ("status","current_period_end");
--> statement-breakpoint
CREATE TABLE "webhook_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" text DEFAULT 'stripe' NOT NULL,
  "stripe_event_id" text NOT NULL,
  "stripe_event_type" text NOT NULL,
  "payload" jsonb,
  "processed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_stripe_event_uidx" ON "webhook_events" USING btree ("stripe_event_id");
--> statement-breakpoint
CREATE INDEX "webhook_events_provider_created_idx" ON "webhook_events" USING btree ("provider","created_at");
--> statement-breakpoint
CREATE INDEX "webhook_events_processed_idx" ON "webhook_events" USING btree ("processed_at");
