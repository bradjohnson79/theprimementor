CREATE TABLE "report_tier_outputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"tier" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"systems_config" jsonb NOT NULL,
	"model_name" text NOT NULL,
	"reasoning_effort" text NOT NULL,
	"prompt_version" text DEFAULT 'v1' NOT NULL,
	"generated_report" jsonb,
	"full_markdown" text,
	"display_title" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "report_tier_outputs" ADD CONSTRAINT "report_tier_outputs_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "report_tier_outputs_report_tier_uidx" ON "report_tier_outputs" USING btree ("report_id","tier");
