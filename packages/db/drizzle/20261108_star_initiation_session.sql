-- Additive catalog row for the Star Initiation Session.
-- Does not change existing booking types, prices, or webinar records.

ALTER TYPE "public"."booking_session_type" ADD VALUE IF NOT EXISTS 'star_initiation';

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
  'star-initiation-session',
  'Star Initiation Session',
  'star_initiation',
  30,
  9900,
  'CAD',
  10,
  10,
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
  "is_active" = excluded."is_active",
  "updated_at" = now();
