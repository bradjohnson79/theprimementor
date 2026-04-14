ALTER TABLE "orders"
ADD COLUMN "recording_link" text;

ALTER TABLE "orders"
ADD COLUMN "recording_added_at" timestamp with time zone;
