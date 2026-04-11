ALTER TABLE "reports" ADD COLUMN "full_markdown" text;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "interpretation_tier" text DEFAULT 'intro' NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "display_title" text;
