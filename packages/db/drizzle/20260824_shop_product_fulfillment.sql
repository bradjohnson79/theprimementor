ALTER TABLE "shop_products" ADD COLUMN IF NOT EXISTS "fulfillment_type" text;
ALTER TABLE "shop_products" ADD COLUMN IF NOT EXISTS "fulfillment_download_url" text;
ALTER TABLE "shop_products" ADD COLUMN IF NOT EXISTS "fulfillment_download_label" text;
ALTER TABLE "shop_products" ADD COLUMN IF NOT EXISTS "fulfillment_email_enabled" boolean NOT NULL DEFAULT true;
ALTER TABLE "shop_products" ADD COLUMN IF NOT EXISTS "fulfillment_instructions" text;
