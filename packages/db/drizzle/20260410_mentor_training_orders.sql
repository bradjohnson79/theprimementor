CREATE TYPE "public"."mentor_training_package" AS ENUM('entry', 'seeker', 'initiate');
CREATE TYPE "public"."mentor_training_status" AS ENUM('pending_payment', 'paid', 'in_progress', 'completed', 'cancelled');

CREATE TABLE "mentor_training_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "package_type" "mentor_training_package" NOT NULL,
  "status" "mentor_training_status" DEFAULT 'pending_payment' NOT NULL,
  "timezone" text,
  "location_input" text,
  "lat" double precision,
  "lng" double precision,
  "eligibility_verified_at" timestamp with time zone DEFAULT now() NOT NULL,
  "archived" boolean DEFAULT false NOT NULL,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE "mentor_training_orders"
  ADD CONSTRAINT "mentor_training_orders_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX "mentor_training_orders_user_created_idx"
  ON "mentor_training_orders" USING btree ("user_id","created_at");

CREATE INDEX "mentor_training_orders_status_created_idx"
  ON "mentor_training_orders" USING btree ("status","created_at");

CREATE UNIQUE INDEX "mentor_training_orders_user_package_pending_uidx"
  ON "mentor_training_orders" USING btree ("user_id","package_type")
  WHERE "status" = 'pending_payment';
