ALTER TYPE "public"."booking_status" RENAME TO "booking_status_old";
--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('pending_availability', 'scheduled', 'completed', 'cancelled');
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "status" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "bookings"
ALTER COLUMN "status"
TYPE "booking_status"
USING (
  CASE
    WHEN "status"::text = 'pending' THEN 'pending_availability'
    WHEN "status"::text = 'confirmed' THEN 'scheduled'
    ELSE "status"::text
  END
)::"booking_status";
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'pending_availability';
--> statement-breakpoint
DROP TYPE "public"."booking_status_old";
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "availability" jsonb;
