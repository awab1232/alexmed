CREATE TYPE "public"."book_status" AS ENUM('pending', 'processing', 'complete', 'partial_failed');--> statement-breakpoint
ALTER TYPE "public"."book_chapter_status" ADD VALUE 'processing';--> statement-breakpoint
ALTER TYPE "public"."book_chapter_status" ADD VALUE 'retrying';--> statement-breakpoint
ALTER TYPE "public"."mirror_batch_status" ADD VALUE 'processing';--> statement-breakpoint
ALTER TYPE "public"."mirror_batch_status" ADD VALUE 'retrying';--> statement-breakpoint
ALTER TYPE "public"."mirror_job_status" ADD VALUE 'partial_failed';--> statement-breakpoint
ALTER TABLE "book_chapters" ADD COLUMN "attemptCount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "book_chapters" ADD COLUMN "lastStartedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "book_chapters" ADD COLUMN "lastCompletedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "book_chapters" ADD COLUMN "lastErrorAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "status" "book_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "mirror_batches" ADD COLUMN "attemptCount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "mirror_batches" ADD COLUMN "lastStartedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mirror_batches" ADD COLUMN "lastCompletedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mirror_batches" ADD COLUMN "lastErrorAt" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "book_cards_user_id_due_at_idx" ON "book_cards" USING btree ("userId","dueAt");--> statement-breakpoint
CREATE INDEX "book_cards_chapter_id_idx" ON "book_cards" USING btree ("chapterId");--> statement-breakpoint
CREATE INDEX "book_chapters_book_id_order_index_idx" ON "book_chapters" USING btree ("bookId","orderIndex");--> statement-breakpoint
CREATE INDEX "book_chapters_status_idx" ON "book_chapters" USING btree ("status");--> statement-breakpoint
CREATE INDEX "book_review_events_user_id_reviewed_at_idx" ON "book_review_events" USING btree ("userId","reviewedAt");--> statement-breakpoint
CREATE INDEX "books_user_id_created_at_idx" ON "books" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "card_review_events_user_id_reviewed_at_idx" ON "card_review_events" USING btree ("userId","reviewedAt");--> statement-breakpoint
CREATE INDEX "cards_deck_id_source_page_idx" ON "cards" USING btree ("deckId","sourcePage");--> statement-breakpoint
CREATE INDEX "cards_due_at_idx" ON "cards" USING btree ("dueAt");--> statement-breakpoint
CREATE INDEX "decks_user_id_created_at_idx" ON "decks" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "mirror_batches_job_id_order_index_idx" ON "mirror_batches" USING btree ("jobId","orderIndex");--> statement-breakpoint
CREATE INDEX "mirror_batches_status_idx" ON "mirror_batches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mirror_jobs_user_id_created_at_idx" ON "mirror_jobs" USING btree ("userId","createdAt");