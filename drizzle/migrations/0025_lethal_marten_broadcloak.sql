CREATE TYPE "public"."mirror_image_page_status" AS ENUM('pending', 'processing', 'complete', 'failed');--> statement-breakpoint
CREATE TABLE "mirror_image_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jobId" uuid NOT NULL,
	"pageNumber" integer NOT NULL,
	"status" "mirror_image_page_status" DEFAULT 'pending' NOT NULL,
	"attemptCount" integer DEFAULT 0 NOT NULL,
	"errorMessage" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mirror_page_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jobId" uuid NOT NULL,
	"pageNumber" integer NOT NULL,
	"storageKey" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mirror_image_pages" ADD CONSTRAINT "mirror_image_pages_jobId_mirror_jobs_id_fk" FOREIGN KEY ("jobId") REFERENCES "public"."mirror_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mirror_page_images" ADD CONSTRAINT "mirror_page_images_jobId_mirror_jobs_id_fk" FOREIGN KEY ("jobId") REFERENCES "public"."mirror_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mirror_image_pages_job_id_page_number_idx" ON "mirror_image_pages" USING btree ("jobId","pageNumber");--> statement-breakpoint
CREATE INDEX "mirror_image_pages_status_idx" ON "mirror_image_pages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mirror_page_images_job_id_page_number_idx" ON "mirror_page_images" USING btree ("jobId","pageNumber");