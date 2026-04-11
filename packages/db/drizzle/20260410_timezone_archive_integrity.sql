ALTER TABLE "bookings" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;
ALTER TABLE "bookings" ADD COLUMN "archived_at" timestamp with time zone;

ALTER TABLE "reports" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;
ALTER TABLE "reports" ADD COLUMN "archived_at" timestamp with time zone;

ALTER TABLE "subscriptions" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;
ALTER TABLE "subscriptions" ADD COLUMN "archived_at" timestamp with time zone;

ALTER TABLE "mentoring_circle_registrations" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;
ALTER TABLE "mentoring_circle_registrations" ADD COLUMN "archived_at" timestamp with time zone;

ALTER TABLE "orders" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;
ALTER TABLE "orders" ADD COLUMN "archived_at" timestamp with time zone;
