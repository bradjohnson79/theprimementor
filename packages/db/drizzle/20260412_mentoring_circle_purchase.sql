ALTER TYPE "public"."booking_session_type" ADD VALUE IF NOT EXISTS 'mentoring_circle';

ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "event_key" text;

CREATE UNIQUE INDEX IF NOT EXISTS "bookings_user_type_event_uidx"
  ON "bookings" USING btree ("user_id", "booking_type_id", "event_key")
  WHERE "event_key" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "bookings_event_key_idx"
  ON "bookings" USING btree ("event_key", "status");

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
VALUES (
  'mentoring-circle-prime-law',
  'Mentoring Circle: The Prime Law',
  'mentoring_circle',
  90,
  2500,
  'USD',
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
