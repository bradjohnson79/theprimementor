CREATE TABLE "conversation_threads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "title" text NOT NULL,
  "meta" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversation_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "thread_id" uuid NOT NULL,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation_messages"
  ADD CONSTRAINT "conversation_messages_thread_id_conversation_threads_id_fk"
  FOREIGN KEY ("thread_id") REFERENCES "public"."conversation_threads"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "conversation_threads_user_updated_idx"
  ON "conversation_threads" USING btree ("user_id","updated_at");
--> statement-breakpoint
CREATE INDEX "conversation_messages_thread_created_idx"
  ON "conversation_messages" USING btree ("thread_id","created_at");
