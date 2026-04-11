UPDATE "bookings"
SET "birth_time" = '00:00'
WHERE "birth_time" IS NULL OR btrim("birth_time") = '';
--> statement-breakpoint
ALTER TABLE "bookings"
ALTER COLUMN "birth_time" SET DEFAULT '00:00';
--> statement-breakpoint
ALTER TABLE "bookings"
ALTER COLUMN "birth_time" SET NOT NULL;
