ALTER TYPE "public"."book_status" ADD VALUE 'extracting';--> statement-breakpoint
ALTER TYPE "public"."book_status" ADD VALUE 'failed';--> statement-breakpoint
ALTER TYPE "public"."mirror_job_status" ADD VALUE 'extracting';--> statement-breakpoint
ALTER TYPE "public"."mirror_job_status" ADD VALUE 'failed';--> statement-breakpoint
ALTER TABLE "books" ALTER COLUMN "chapterDetectionMethod" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "pageTexts" jsonb;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "pagesNeedingOcr" jsonb;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "ocrFailedPages" jsonb;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "extractionError" text;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "extractionAttemptCount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "mirror_jobs" ADD COLUMN "pageTexts" jsonb;--> statement-breakpoint
ALTER TABLE "mirror_jobs" ADD COLUMN "pagesNeedingOcr" jsonb;--> statement-breakpoint
ALTER TABLE "mirror_jobs" ADD COLUMN "ocrFailedPages" jsonb;--> statement-breakpoint
ALTER TABLE "mirror_jobs" ADD COLUMN "extractionError" text;--> statement-breakpoint
ALTER TABLE "mirror_jobs" ADD COLUMN "extractionAttemptCount" integer DEFAULT 0 NOT NULL;