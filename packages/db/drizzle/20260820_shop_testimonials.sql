CREATE TABLE IF NOT EXISTS "shop_testimonials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_name" text NOT NULL,
  "location" text,
  "title" text,
  "testimonial_text" text NOT NULL,
  "source_label" text,
  "context_label" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "shop_testimonials_active_sort_idx"
  ON "shop_testimonials" ("is_active", "sort_order", "created_at");

CREATE TABLE IF NOT EXISTS "shop_product_testimonials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "testimonial_id" uuid NOT NULL REFERENCES "shop_testimonials"("id") ON DELETE CASCADE,
  "product_id" uuid REFERENCES "shop_products"("id") ON DELETE CASCADE,
  "product_slug" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "shop_product_testimonials_testimonial_slug_uidx"
  ON "shop_product_testimonials" ("testimonial_id", "product_slug");
CREATE INDEX IF NOT EXISTS "shop_product_testimonials_product_idx"
  ON "shop_product_testimonials" ("product_id");
CREATE INDEX IF NOT EXISTS "shop_product_testimonials_slug_idx"
  ON "shop_product_testimonials" ("product_slug");

CREATE TABLE IF NOT EXISTS "shop_settings" (
  "key" text PRIMARY KEY NOT NULL,
  "value" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);
