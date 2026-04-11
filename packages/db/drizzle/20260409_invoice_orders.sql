CREATE TYPE "public"."invoice_billing_mode" AS ENUM('one_time', 'subscription');
--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('pending', 'paid', 'failed', 'expired');
--> statement-breakpoint
CREATE TYPE "public"."invoice_product_type" AS ENUM('session', 'report', 'subscription', 'webinar', 'custom');
--> statement-breakpoint
CREATE TYPE "public"."persisted_order_type" AS ENUM('session', 'report', 'subscription', 'subscription_initial', 'subscription_renewal', 'webinar', 'custom');
--> statement-breakpoint
CREATE TYPE "public"."persisted_order_status" AS ENUM('pending', 'completed', 'failed');
--> statement-breakpoint
CREATE TABLE "invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "client_id" uuid NOT NULL,
  "stripe_payment_link" text,
  "stripe_payment_link_id" text,
  "stripe_product_id" text,
  "stripe_price_id" text,
  "stripe_checkout_session_id" text,
  "stripe_payment_intent_id" text,
  "stripe_subscription_id" text,
  "product_type" "invoice_product_type" NOT NULL,
  "label" text NOT NULL,
  "amount" integer NOT NULL,
  "currency" text DEFAULT 'USD' NOT NULL,
  "billing_mode" "invoice_billing_mode" NOT NULL,
  "status" "invoice_status" DEFAULT 'pending' NOT NULL,
  "consumed_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "failure_code" text,
  "failure_message" text,
  "failure_message_normalized" text,
  "last_payment_attempt_at" timestamp with time zone,
  "paid_at" timestamp with time zone,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "client_id" uuid,
  "invoice_id" uuid,
  "subscription_id" text,
  "type" "persisted_order_type" NOT NULL,
  "label" text NOT NULL,
  "amount" integer NOT NULL,
  "currency" text DEFAULT 'USD' NOT NULL,
  "status" "persisted_order_status" DEFAULT 'pending' NOT NULL,
  "payment_reference" text,
  "stripe_payment_intent_id" text,
  "stripe_subscription_id" text,
  "failure_code" text,
  "failure_message" text,
  "failure_message_normalized" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "invoices_user_created_idx" ON "invoices" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX "invoices_client_created_idx" ON "invoices" USING btree ("client_id","created_at");
--> statement-breakpoint
CREATE INDEX "invoices_status_created_idx" ON "invoices" USING btree ("status","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_payment_link_uidx" ON "invoices" USING btree ("stripe_payment_link_id");
--> statement-breakpoint
CREATE INDEX "invoices_checkout_session_idx" ON "invoices" USING btree ("stripe_checkout_session_id");
--> statement-breakpoint
CREATE INDEX "invoices_payment_intent_idx" ON "invoices" USING btree ("stripe_payment_intent_id");
--> statement-breakpoint
CREATE INDEX "invoices_subscription_idx" ON "invoices" USING btree ("stripe_subscription_id");
--> statement-breakpoint
CREATE INDEX "orders_user_created_idx" ON "orders" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX "orders_client_created_idx" ON "orders" USING btree ("client_id","created_at");
--> statement-breakpoint
CREATE INDEX "orders_invoice_created_idx" ON "orders" USING btree ("invoice_id","created_at");
--> statement-breakpoint
CREATE INDEX "orders_subscription_created_idx" ON "orders" USING btree ("subscription_id","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "orders_payment_reference_uidx" ON "orders" USING btree ("payment_reference");
