ALTER TABLE "payments" ADD COLUMN "user_id" uuid;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "booking_id" uuid;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "amount_cents" integer;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "currency" text;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "provider" text;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "provider_payment_intent_id" text;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "provider_customer_id" text;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "metadata" jsonb;
--> statement-breakpoint
UPDATE "payments" AS p
SET "user_id" = c."user_id"
FROM "clients" AS c
WHERE p."client_id" = c."id";
--> statement-breakpoint
UPDATE "payments"
SET
  "amount_cents" = "amount",
  "currency" = 'CAD',
  "provider" = 'stripe',
  "provider_payment_intent_id" = "stripe_payment_id"
WHERE "amount_cents" IS NULL;
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "amount_cents" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "currency" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "provider" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "status" SET DEFAULT 'pending';
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "provider" SET DEFAULT 'stripe';
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "client_id";
--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "stripe_payment_id";
--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "amount";
--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "type";
--> statement-breakpoint
CREATE INDEX "payments_user_created_idx" ON "payments" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX "payments_status_created_idx" ON "payments" USING btree ("status","created_at");
--> statement-breakpoint
CREATE INDEX "payments_booking_idx" ON "payments" USING btree ("booking_id");
