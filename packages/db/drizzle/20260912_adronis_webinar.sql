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
  'webinar-adronis-disclosure-to-contact',
  'Adronis: From Disclosure to Contact',
  'mentoring_circle',
  90,
  1499,
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
