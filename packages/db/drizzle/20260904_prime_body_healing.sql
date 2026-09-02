ALTER TYPE "public"."booking_session_type" ADD VALUE IF NOT EXISTS 'prime_body_healing';

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
  'prime-body-healing-level-1-live',
  'Prime Body Healing — Level 1 Live',
  'prime_body_healing',
  15,
  7900,
  'CAD',
  10,
  10,
  true
),
(
  'prime-body-healing-level-1-prerecorded',
  'Prime Body Healing — Level 1 Pre-Recorded',
  'prime_body_healing',
  0,
  7900,
  'CAD',
  10,
  10,
  true
),
(
  'prime-body-healing-level-2',
  'Prime Body Healing — Level 2',
  'prime_body_healing',
  0,
  17900,
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
  "is_active" = excluded."is_active";
