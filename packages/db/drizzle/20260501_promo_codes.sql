CREATE TYPE "public"."promo_discount_type" AS ENUM('percentage');
--> statement-breakpoint
CREATE TYPE "public"."promo_sync_status" AS ENUM('synced', 'needs_sync', 'broken');
--> statement-breakpoint
CREATE TYPE "public"."promo_billing_scope" AS ENUM('one_time', 'recurring');
--> statement-breakpoint
CREATE TABLE "promo_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "discount_type" "promo_discount_type" DEFAULT 'percentage' NOT NULL,
  "discount_value" integer NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "expires_at" timestamp with time zone,
  "usage_limit" integer,
  "times_used" integer DEFAULT 0 NOT NULL,
  "applies_to" jsonb,
  "applies_to_billing" "promo_billing_scope",
  "min_amount_cents" integer,
  "first_time_only" boolean DEFAULT false NOT NULL,
  "campaign" text,
  "stripe_coupon_id" text NOT NULL,
  "stripe_promotion_code_id" text NOT NULL,
  "sync_status" "promo_sync_status" DEFAULT 'needs_sync' NOT NULL,
  "last_validated_at" timestamp with time zone,
  "last_validation_ok" boolean,
  "last_validation_snapshot" jsonb,
  "validation_failure_code" text,
  "validation_failure_message" text,
  "metadata" jsonb,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "promo_code_usages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "promo_code_id" uuid NOT NULL,
  "payment_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promo_code_changes_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "promo_code_id" uuid NOT NULL,
  "field_changed" text NOT NULL,
  "old_value" jsonb,
  "new_value" jsonb,
  "changed_by" uuid,
  "changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "promo_code_usages" ADD CONSTRAINT "promo_code_usages_promo_code_id_promo_codes_id_fk" FOREIGN KEY ("promo_code_id") REFERENCES "public"."promo_codes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "promo_code_usages" ADD CONSTRAINT "promo_code_usages_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "promo_code_changes_log" ADD CONSTRAINT "promo_code_changes_log_promo_code_id_promo_codes_id_fk" FOREIGN KEY ("promo_code_id") REFERENCES "public"."promo_codes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "promo_code_changes_log" ADD CONSTRAINT "promo_code_changes_log_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "promo_codes_code_uidx" ON "promo_codes" USING btree ("code");
--> statement-breakpoint
CREATE UNIQUE INDEX "promo_codes_stripe_coupon_uidx" ON "promo_codes" USING btree ("stripe_coupon_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "promo_codes_stripe_promotion_uidx" ON "promo_codes" USING btree ("stripe_promotion_code_id");
--> statement-breakpoint
CREATE INDEX "promo_codes_active_created_idx" ON "promo_codes" USING btree ("active","created_at");
--> statement-breakpoint
CREATE INDEX "promo_codes_sync_status_updated_idx" ON "promo_codes" USING btree ("sync_status","updated_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "promo_code_usages_promo_payment_uidx" ON "promo_code_usages" USING btree ("promo_code_id","payment_id");
--> statement-breakpoint
CREATE INDEX "promo_code_usages_promo_created_idx" ON "promo_code_usages" USING btree ("promo_code_id","created_at");
--> statement-breakpoint
CREATE INDEX "promo_code_changes_log_promo_changed_idx" ON "promo_code_changes_log" USING btree ("promo_code_id","changed_at");
--> statement-breakpoint
CREATE INDEX "promo_code_changes_log_changed_by_idx" ON "promo_code_changes_log" USING btree ("changed_by","changed_at");
