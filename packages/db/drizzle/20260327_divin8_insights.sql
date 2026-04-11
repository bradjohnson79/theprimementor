CREATE TABLE "insights" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "thread_id" uuid NOT NULL REFERENCES "conversation_threads"("id") ON DELETE cascade,
  "user_id" text NOT NULL,
  "content" text NOT NULL,
  "category" text NOT NULL,
  "confidence" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "insights_thread_created_idx"
  ON "insights" USING btree ("thread_id", "created_at");
--> statement-breakpoint
CREATE INDEX "insights_user_created_idx"
  ON "insights" USING btree ("user_id", "created_at");
--> statement-breakpoint
CREATE INDEX "insights_category_created_idx"
  ON "insights" USING btree ("category", "created_at");
