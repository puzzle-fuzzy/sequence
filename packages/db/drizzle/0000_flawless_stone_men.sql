CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."task_domain" AS ENUM('generate', 'analysis', 'transfer');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('queued', 'running', 'retrying', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."record_status" AS ENUM('submitting', 'processing', 'saving_output', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."analysis_step" AS ENUM('asr', 'script');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(50) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"avatar" varchar(512),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(60) NOT NULL,
	"domain" "task_domain" NOT NULL,
	"status" "task_status" DEFAULT 'queued' NOT NULL,
	"priority" integer DEFAULT 5 NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb,
	"locked_by" varchar(60),
	"locked_until" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"next_run_at" timestamp with time zone,
	"error_json" jsonb,
	"record_id" uuid,
	"project_id" uuid,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "generation_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_id" uuid NOT NULL,
	"kind" varchar(30) NOT NULL,
	"source_url" varchar(1024),
	"storage_path" varchar(255) NOT NULL,
	"mime_type" varchar(100),
	"size_bytes" integer,
	"original_filename" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "generation_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"model" varchar(60) NOT NULL,
	"category" varchar(20) NOT NULL,
	"sub_category" varchar(40) NOT NULL,
	"input_params" jsonb NOT NULL,
	"output_result" jsonb,
	"status" "record_status" DEFAULT 'submitting' NOT NULL,
	"cost" jsonb,
	"dedupe_key" varchar(255),
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "analysis_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"video_url" varchar(1024) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"current_step" "analysis_step",
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "analysis_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"step" "analysis_step" NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"result" jsonb,
	"task_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transfer_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"peer_code" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "uploaded_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" varchar(30) NOT NULL,
	"storage_path" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"original_filename" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generation_files" ADD CONSTRAINT "generation_files_record_id_generation_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."generation_records"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generation_records" ADD CONSTRAINT "generation_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "analysis_projects" ADD CONSTRAINT "analysis_projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "analysis_steps" ADD CONSTRAINT "analysis_steps_project_id_analysis_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."analysis_projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "analysis_steps" ADD CONSTRAINT "analysis_steps_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transfer_sessions" ADD CONSTRAINT "transfer_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_status_domain_idx" ON "tasks" USING btree ("status","domain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_next_run_idx" ON "tasks" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_record_idx" ON "tasks" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_project_idx" ON "tasks" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gen_records_user_created_idx" ON "generation_records" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gen_records_dedupe_idx" ON "generation_records" USING btree ("dedupe_key");