ALTER TYPE "public"."booking_status" ADD VALUE IF NOT EXISTS 'paid';
--> statement-breakpoint
ALTER TYPE "public"."booking_status" ADD VALUE IF NOT EXISTS 'pending_payment';
--> statement-breakpoint
UPDATE "bookings"
SET "status" = 'paid'
WHERE "status"::text = 'pending_availability';
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'pending_payment';
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "intake_snapshot" jsonb;
