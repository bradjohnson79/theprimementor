ALTER TYPE "public"."promo_discount_type" ADD VALUE IF NOT EXISTS 'fixed_amount';
--> statement-breakpoint
ALTER TABLE "promo_codes" ADD COLUMN IF NOT EXISTS "discount_currency" text;
