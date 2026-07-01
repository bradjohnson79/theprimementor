CREATE TABLE IF NOT EXISTS "course_entitlements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "course_slug" text NOT NULL,
  "stripe_checkout_session_id" text,
  "stripe_payment_intent_id" text,
  "order_id" uuid,
  "purchased_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_entitlements" ADD CONSTRAINT "course_entitlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_entitlements" ADD CONSTRAINT "course_entitlements_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "course_entitlements_user_course_uidx" ON "course_entitlements" USING btree ("user_id","course_slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_entitlements_user_active_idx" ON "course_entitlements" USING btree ("user_id","revoked_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_entitlements_course_purchased_idx" ON "course_entitlements" USING btree ("course_slug","purchased_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_entitlements_checkout_session_idx" ON "course_entitlements" USING btree ("stripe_checkout_session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_entitlements_payment_intent_idx" ON "course_entitlements" USING btree ("stripe_payment_intent_id");
