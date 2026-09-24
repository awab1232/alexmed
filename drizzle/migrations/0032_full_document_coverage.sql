ALTER TABLE "book_chapters" ADD COLUMN "coverageManifest" jsonb;--> statement-breakpoint
ALTER TABLE "book_pages" ADD COLUMN "pageType" text;