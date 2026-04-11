ALTER TABLE "reports" RENAME COLUMN "structured_data" TO "blueprint_data";--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "admin_notes" text;
