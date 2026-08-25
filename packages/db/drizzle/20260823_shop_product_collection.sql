ALTER TABLE "shop_products" ADD COLUMN IF NOT EXISTS "collection" text;
CREATE INDEX IF NOT EXISTS "shop_products_collection_idx" ON "shop_products" ("collection");
