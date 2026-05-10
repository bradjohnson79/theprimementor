-- Guided private session SKU expansion.
-- Additive and idempotent: no drops, no enum changes, and no historical Focus data changes.

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
    'qa-session-30',
    'Q&A Session',
    'qa_session',
    30,
    14900,
    'CAD',
    10,
    10,
    true
  ),
  (
    'qa-session-45',
    'Q&A Session',
    'qa_session',
    45,
    19900,
    'CAD',
    10,
    10,
    true
  ),
  (
    'qa-session-60',
    'Q&A Session',
    'qa_session',
    60,
    24900,
    'CAD',
    10,
    10,
    true
  ),
  (
    'mentoring-session-45',
    'Mentoring Session',
    'mentoring',
    45,
    19900,
    'CAD',
    10,
    10,
    true
  ),
  (
    'wisdom-mentoring-90',
    'Mentoring Session',
    'mentoring',
    90,
    29900,
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
