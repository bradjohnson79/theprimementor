ALTER TYPE "public"."booking_status" RENAME TO "booking_status_old";
--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('pending_payment', 'paid', 'scheduled', 'completed', 'cancelled');
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "status" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "bookings"
ALTER COLUMN "status"
TYPE "booking_status"
USING (
  CASE
    WHEN "status"::text = 'pending_availability' THEN 'paid'
    ELSE "status"::text
  END
)::"booking_status";
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'pending_payment';
--> statement-breakpoint
DROP TYPE "public"."booking_status_old";
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "intake_snapshot" jsonb;
