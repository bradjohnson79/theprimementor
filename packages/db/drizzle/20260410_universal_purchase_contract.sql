ALTER TYPE "public"."report_member_status" RENAME TO "report_member_status_old";
--> statement-breakpoint
CREATE TYPE "public"."report_member_status" AS ENUM('pending_payment', 'paid', 'fulfilled');
--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "member_status" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "reports"
ALTER COLUMN "member_status"
TYPE "report_member_status"
USING (
  CASE
    WHEN "member_status"::text = 'pending' THEN 'pending_payment'
    WHEN "member_status"::text = 'completed' THEN 'fulfilled'
    ELSE "member_status"::text
  END
)::"report_member_status";
--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "member_status" SET DEFAULT 'pending_payment';
--> statement-breakpoint
DROP TYPE "public"."report_member_status_old";
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "entity_type" text;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "entity_id" text;
--> statement-breakpoint
UPDATE "payments"
SET
  "entity_type" = 'session',
  "entity_id" = "booking_id"::text
WHERE "entity_type" IS NULL;
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "entity_type" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "entity_id" SET NOT NULL;
--> statement-breakpoint
CREATE INDEX "payments_entity_idx" ON "payments" USING btree ("entity_type","entity_id");
--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "stripe_subscription_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "stripe_customer_id" DROP NOT NULL;
