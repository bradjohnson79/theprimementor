CREATE TABLE IF NOT EXISTS "course_lesson_progress" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "course_slug" text NOT NULL,
  "lesson_id" text NOT NULL,
  "completed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_lesson_progress" ADD CONSTRAINT "course_lesson_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "course_lesson_progress_user_course_lesson_uidx" ON "course_lesson_progress" USING btree ("user_id","course_slug","lesson_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_lesson_progress_user_course_completed_idx" ON "course_lesson_progress" USING btree ("user_id","course_slug","completed_at");
