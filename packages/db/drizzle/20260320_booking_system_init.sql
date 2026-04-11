CREATE TABLE "booking_types" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"buffer_before_minutes" integer NOT NULL,
	"buffer_after_minutes" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
INSERT INTO "booking_types" (
	"id",
	"name",
	"duration_minutes",
	"price_cents",
	"currency",
	"buffer_before_minutes",
	"buffer_after_minutes",
	"is_active"
)
VALUES (
	'wisdom-mentoring-90',
	'Wisdom Mentoring Session',
	90,
	29900,
	'CAD',
	10,
	10,
	true
)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "bookings" RENAME COLUMN "date" TO "start_time_utc";
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "user_id" uuid;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "booking_type_id" text;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "end_time_utc" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "timezone_at_booking" text;
--> statement-breakpoint
UPDATE "bookings" AS b
SET "user_id" = c."user_id"
FROM "clients" AS c
WHERE b."client_id" = c."id";
--> statement-breakpoint
UPDATE "bookings"
SET
	"booking_type_id" = 'wisdom-mentoring-90',
	"timezone_at_booking" = 'America/Los_Angeles',
	"end_time_utc" = "start_time_utc" + make_interval(mins => COALESCE("duration", 90)),
	"status" = CASE
		WHEN "status" = 'pending' THEN 'confirmed'
		ELSE "status"
	END;
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "booking_type_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "end_time_utc" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "timezone_at_booking" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'confirmed';
--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "client_id";
--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "type";
--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "duration";
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_booking_type_id_booking_types_id_fk" FOREIGN KEY ("booking_type_id") REFERENCES "public"."booking_types"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "bookings_user_start_idx" ON "bookings" USING btree ("user_id","start_time_utc");
--> statement-breakpoint
CREATE INDEX "bookings_status_start_idx" ON "bookings" USING btree ("status","start_time_utc");
