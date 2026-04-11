CREATE TYPE "public"."booking_session_type" AS ENUM('focus', 'mentoring', 'regeneration');
--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('pending', 'confirmed', 'completed', 'cancelled');
--> statement-breakpoint
ALTER TABLE "booking_types" ADD COLUMN "session_type" "booking_session_type";
--> statement-breakpoint
UPDATE "booking_types"
SET "session_type" = 'mentoring'
WHERE "session_type" IS NULL;
--> statement-breakpoint
ALTER TABLE "booking_types" ALTER COLUMN "session_type" SET DEFAULT 'mentoring';
--> statement-breakpoint
ALTER TABLE "booking_types" ALTER COLUMN "session_type" SET NOT NULL;
--> statement-breakpoint
UPDATE "booking_types"
SET
  "name" = 'Mentoring Session',
  "session_type" = 'mentoring',
  "duration_minutes" = 90,
  "price_cents" = 29900,
  "currency" = 'CAD',
  "buffer_before_minutes" = 10,
  "buffer_after_minutes" = 10,
  "is_active" = true
WHERE "id" = 'wisdom-mentoring-90';
--> statement-breakpoint
INSERT INTO "booking_types" (
  "id",
  "name",
  "session_type",
  "duration_minutes",
  "price_cents",
  "currency",
  "buffer_before_minutes",
  "buffer_after_minutes",
  "is_active"
)
VALUES
  (
    'focus-session-45',
    'Focus Session',
    'focus',
    45,
    14900,
    'CAD',
    10,
    10,
    true
  ),
  (
    'regeneration-session',
    'Regeneration Session',
    'regeneration',
    0,
    12900,
    'CAD',
    0,
    0,
    true
  )
ON CONFLICT ("id") DO UPDATE
SET
  "name" = excluded."name",
  "session_type" = excluded."session_type",
  "duration_minutes" = excluded."duration_minutes",
  "price_cents" = excluded."price_cents",
  "currency" = excluded."currency",
  "buffer_before_minutes" = excluded."buffer_before_minutes",
  "buffer_after_minutes" = excluded."buffer_after_minutes",
  "is_active" = excluded."is_active";
--> statement-breakpoint
ALTER TABLE "bookings" RENAME COLUMN "timezone_at_booking" TO "timezone";
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "session_type" "booking_session_type";
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "full_name" text;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "email" text;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "phone" text;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "birth_date" text;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "birth_time" text;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "birth_place" text;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "consent_given" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "intake" jsonb;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "join_url" text;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "start_url" text;
--> statement-breakpoint
UPDATE "bookings" AS b
SET "session_type" = bt."session_type"
FROM "booking_types" AS bt
WHERE b."booking_type_id" = bt."id"
  AND b."session_type" IS NULL;
--> statement-breakpoint
UPDATE "bookings" AS b
SET "email" = u."email"
FROM "users" AS u
WHERE b."user_id" = u."id"
  AND b."email" IS NULL;
--> statement-breakpoint
UPDATE "bookings"
SET "session_type" = 'mentoring'
WHERE "session_type" IS NULL;
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "session_type" SET DEFAULT 'mentoring';
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "session_type" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "start_time_utc" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "end_time_utc" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "status" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "status" TYPE "booking_status" USING "status"::"booking_status";
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'pending';
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_schedule_pair_chk" CHECK (
  ("start_time_utc" IS NULL AND "end_time_utc" IS NULL)
  OR ("start_time_utc" IS NOT NULL AND "end_time_utc" IS NOT NULL)
);
