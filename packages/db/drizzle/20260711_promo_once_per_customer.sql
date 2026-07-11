ALTER TABLE "promo_codes" ADD COLUMN IF NOT EXISTS "once_per_customer" boolean DEFAULT false NOT NULL;
