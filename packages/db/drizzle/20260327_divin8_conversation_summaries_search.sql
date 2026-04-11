ALTER TABLE "conversation_threads"
  ADD COLUMN "summary" text,
  ADD COLUMN "search_text" text;
--> statement-breakpoint
CREATE INDEX "conversation_threads_search_text_idx"
  ON "conversation_threads" USING btree ("search_text");
