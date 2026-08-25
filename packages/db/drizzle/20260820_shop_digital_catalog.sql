ALTER TYPE "public"."persisted_order_type" ADD VALUE IF NOT EXISTS 'shop';

DO $$ BEGIN
  CREATE TYPE "public"."shop_product_status" AS ENUM('draft', 'active', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."shop_product_file_kind" AS ENUM('deck', 'booklet', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "shop_products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "status" "shop_product_status" DEFAULT 'draft' NOT NULL,
  "is_active" boolean DEFAULT false NOT NULL,
  "featured" boolean DEFAULT false NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "price_cents" integer NOT NULL,
  "currency" text DEFAULT 'CAD' NOT NULL,
  "stripe_product_id" text,
  "stripe_price_id" text,
  "format_label" text DEFAULT 'Digital Edition' NOT NULL,
  "quick_summary" text,
  "full_description" text,
  "included_items" text,
  "video_url" text,
  "wellness_notice" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "shop_products_slug_uidx" ON "shop_products" ("slug");
CREATE INDEX IF NOT EXISTS "shop_products_active_sort_idx" ON "shop_products" ("is_active", "sort_order", "created_at");
CREATE INDEX IF NOT EXISTS "shop_products_status_sort_idx" ON "shop_products" ("status", "sort_order");

CREATE TABLE IF NOT EXISTS "shop_product_images" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL REFERENCES "shop_products"("id") ON DELETE CASCADE,
  "storage_key" text NOT NULL,
  "alt_text" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_primary" boolean DEFAULT false NOT NULL,
  "mime_type" text,
  "size_bytes" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "shop_product_images_product_sort_idx" ON "shop_product_images" ("product_id", "sort_order");

CREATE TABLE IF NOT EXISTS "shop_product_files" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL REFERENCES "shop_products"("id") ON DELETE CASCADE,
  "storage_key" text NOT NULL,
  "display_name" text NOT NULL,
  "mime_type" text,
  "size_bytes" integer,
  "kind" "shop_product_file_kind" DEFAULT 'other' NOT NULL,
  "is_available" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "shop_product_files_product_kind_idx" ON "shop_product_files" ("product_id", "kind");

CREATE TABLE IF NOT EXISTS "shop_entitlements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "product_id" uuid NOT NULL REFERENCES "shop_products"("id") ON DELETE CASCADE,
  "stripe_checkout_session_id" text,
  "stripe_payment_intent_id" text,
  "order_id" uuid REFERENCES "orders"("id") ON DELETE SET NULL,
  "purchased_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "shop_entitlements_user_product_uidx" ON "shop_entitlements" ("user_id", "product_id");
CREATE INDEX IF NOT EXISTS "shop_entitlements_user_active_idx" ON "shop_entitlements" ("user_id", "revoked_at");
CREATE INDEX IF NOT EXISTS "shop_entitlements_product_purchased_idx" ON "shop_entitlements" ("product_id", "purchased_at");
CREATE INDEX IF NOT EXISTS "shop_entitlements_checkout_session_idx" ON "shop_entitlements" ("stripe_checkout_session_id");
CREATE INDEX IF NOT EXISTS "shop_entitlements_payment_intent_idx" ON "shop_entitlements" ("stripe_payment_intent_id");
