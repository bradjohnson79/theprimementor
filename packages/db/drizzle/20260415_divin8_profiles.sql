CREATE TABLE "profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "full_name" text NOT NULL,
  "tag" text NOT NULL,
  "birth_date" date NOT NULL,
  "birth_time" text NOT NULL,
  "birth_place" text NOT NULL,
  "lat" double precision NOT NULL,
  "lng" double precision NOT NULL,
  "timezone" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "profiles"
  ADD CONSTRAINT "profiles_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX "profiles_user_tag_uidx" ON "profiles" USING btree ("user_id", "tag");
CREATE INDEX "profiles_user_idx" ON "profiles" USING btree ("user_id");
CREATE INDEX "profiles_tag_idx" ON "profiles" USING btree ("tag");
