ALTER TABLE "cards" ADD COLUMN "jobId" uuid;--> statement-breakpoint
ALTER TABLE "mirror_jobs" ADD COLUMN "sourceType" text DEFAULT 'file' NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_jobId_mirror_jobs_id_fk" FOREIGN KEY ("jobId") REFERENCES "public"."mirror_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cards_job_id_idx" ON "cards" USING btree ("jobId");