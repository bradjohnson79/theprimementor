ALTER TYPE "public"."booking_session_type" ADD VALUE IF NOT EXISTS 'qa_session';

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
  'qa-session-30',
  'Q&A Session',
  'qa_session',
  30,
  14999,
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
