-- Canonical Prime Mentor guided session booking types.
-- Keeps historical rows intact while ensuring the active purchasable catalog exists.

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
  ('qa-session-30', 'Q&A Session', 'qa_session', 30, 13900, 'CAD', 10, 10, true),
  ('qa-session-45', 'Q&A Session', 'qa_session', 45, 18900, 'CAD', 10, 10, true),
  ('qa-session-60', 'Q&A Session', 'qa_session', 60, 23900, 'CAD', 10, 10, true),
  ('mentoring-session-45', 'Mentoring Session', 'mentoring', 45, 19900, 'CAD', 10, 10, true),
  ('wisdom-mentoring-90', 'Mentoring Session', 'mentoring', 90, 29900, 'CAD', 10, 10, true),
  ('regeneration-session', 'Regeneration Session', 'regeneration', 0, 9900, 'CAD', 10, 10, true)
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
