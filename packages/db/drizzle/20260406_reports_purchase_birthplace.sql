CREATE TYPE "public"."report_member_status" AS ENUM('pending', 'completed');
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "birth_place_name" text;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "birth_lat" double precision;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "birth_lng" double precision;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "birth_timezone" text;
--> statement-breakpoint
UPDATE "bookings"
SET "birth_place_name" = "birth_place"
WHERE "birth_place_name" IS NULL AND "birth_place" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "user_id" uuid;
--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "member_status" "report_member_status" DEFAULT 'pending' NOT NULL;
--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "purchase_intake" jsonb;
--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "birth_place_name" text;
--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "birth_lat" double precision;
--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "birth_lng" double precision;
--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "birth_timezone" text;
--> statement-breakpoint
UPDATE "reports" AS r
SET "user_id" = c."user_id"
FROM "clients" AS c
WHERE r."client_id" = c."id"
  AND r."user_id" IS NULL;
--> statement-breakpoint
UPDATE "reports"
SET "member_status" = CASE
  WHEN "full_markdown" IS NOT NULL THEN 'completed'::report_member_status
  WHEN "generated_report" IS NOT NULL THEN 'completed'::report_member_status
  WHEN "status" IN ('interpreted', 'reviewed', 'finalized', 'final') THEN 'completed'::report_member_status
  ELSE 'pending'::report_member_status
END;
--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "reports_user_created_idx" ON "reports" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX "reports_member_status_created_idx" ON "reports" USING btree ("member_status","created_at");
