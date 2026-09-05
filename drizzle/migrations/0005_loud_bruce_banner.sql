CREATE TYPE "public"."mirror_batch_status" AS ENUM('pending', 'generating', 'complete', 'failed');--> statement-breakpoint
CREATE TYPE "public"."mirror_job_status" AS ENUM('pending', 'complete');--> statement-breakpoint
CREATE TABLE "mirror_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jobId" uuid NOT NULL,
	"orderIndex" integer NOT NULL,
	"startPage" integer NOT NULL,
	"endPage" integer NOT NULL,
	"status" "mirror_batch_status" DEFAULT 'pending' NOT NULL,
	"pageTexts" jsonb,
	"cards" jsonb,
	"errorMessage" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mirror_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"fileName" text NOT NULL,
	"fileKey" text NOT NULL,
	"pageCount" integer DEFAULT 0 NOT NULL,
	"depth" text DEFAULT 'balanced' NOT NULL,
	"status" "mirror_job_status" DEFAULT 'pending' NOT NULL,
	"deckId" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mirror_batches" ADD CONSTRAINT "mirror_batches_jobId_mirror_jobs_id_fk" FOREIGN KEY ("jobId") REFERENCES "public"."mirror_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mirror_jobs" ADD CONSTRAINT "mirror_jobs_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mirror_jobs" ADD CONSTRAINT "mirror_jobs_deckId_decks_id_fk" FOREIGN KEY ("deckId") REFERENCES "public"."decks"("id") ON DELETE no action ON UPDATE no action;