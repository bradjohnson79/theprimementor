-- Q&A session price update (Stripe-aligned: $139 / $189 / $239 CAD)

UPDATE "booking_types"
SET
  "price_cents" = 13900,
  "updated_at" = now()
WHERE "id" = 'qa-session-30';

UPDATE "booking_types"
SET
  "price_cents" = 18900,
  "updated_at" = now()
WHERE "id" = 'qa-session-45';

UPDATE "booking_types"
SET
  "price_cents" = 23900,
  "updated_at" = now()
WHERE "id" = 'qa-session-60';
