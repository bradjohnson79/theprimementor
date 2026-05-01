ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "stripe_invoice_id" text;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "stripe_invoice_url" text;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "stripe_invoice_status" text;
