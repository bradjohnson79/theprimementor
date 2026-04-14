DO $$
BEGIN
  CREATE TYPE "public"."order_refund_reason" AS ENUM(
    'requested_by_customer',
    'fraudulent',
    'duplicate',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TYPE "public"."persisted_order_type" ADD VALUE IF NOT EXISTS 'mentor_training';
--> statement-breakpoint
ALTER TYPE "public"."persisted_order_status" ADD VALUE IF NOT EXISTS 'refunded';
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "refunded_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "refund_reason" "public"."order_refund_reason";
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "refund_note" text;
