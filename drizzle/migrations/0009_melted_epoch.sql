-- كتبي visual content (images/diagrams/tables): fully additive — 2 new
-- tables + 5 new enum types, zero changes to any existing table (بما فيها
-- books/bookChapters/bookCards/bookMcqs نفسها، ولا أي جدول مِرآة/مكتبة الأدمن).
-- Manual rollback, in reverse order, if ever needed:
--   DROP TABLE book_visual_assets;
--   DROP TABLE book_pages;
--   DROP TYPE book_visual_review_status;
--   DROP TYPE book_visual_confidence;
--   DROP TYPE book_visual_asset_type;
--   DROP TYPE book_page_visual_status;
--   DROP TYPE book_page_text_status;
CREATE TYPE "public"."book_page_text_status" AS ENUM('pending', 'complete', 'failed');--> statement-breakpoint
CREATE TYPE "public"."book_page_visual_status" AS ENUM('pending', 'processing', 'complete', 'needs_review', 'failed');--> statement-breakpoint
CREATE TYPE "public"."book_visual_asset_type" AS ENUM('image', 'diagram', 'table', 'screenshot', 'chart');--> statement-breakpoint
CREATE TYPE "public"."book_visual_confidence" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."book_visual_review_status" AS ENUM('complete', 'needs_review');--> statement-breakpoint
CREATE TABLE "book_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bookId" uuid NOT NULL,
	"chapterId" uuid,
	"pageNumber" integer NOT NULL,
	"storageKey" text,
	"previewKey" text,
	"extractedText" text,
	"textStatus" "book_page_text_status" DEFAULT 'pending' NOT NULL,
	"visualStatus" "book_page_visual_status" DEFAULT 'pending' NOT NULL,
	"width" integer,
	"height" integer,
	"hasImages" boolean DEFAULT false NOT NULL,
	"hasTables" boolean DEFAULT false NOT NULL,
	"hasDiagrams" boolean DEFAULT false NOT NULL,
	"errorMessage" text,
	"attemptCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_visual_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bookId" uuid NOT NULL,
	"chapterId" uuid,
	"pageId" uuid NOT NULL,
	"assetType" "book_visual_asset_type" NOT NULL,
	"storageKey" text NOT NULL,
	"previewKey" text,
	"altText" text,
	"descriptionAr" text,
	"descriptionEn" text,
	"boundingBox" jsonb,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"confidence" "book_visual_confidence",
	"reviewStatus" "book_visual_review_status" DEFAULT 'complete' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "book_pages" ADD CONSTRAINT "book_pages_bookId_books_id_fk" FOREIGN KEY ("bookId") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_pages" ADD CONSTRAINT "book_pages_chapterId_book_chapters_id_fk" FOREIGN KEY ("chapterId") REFERENCES "public"."book_chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_visual_assets" ADD CONSTRAINT "book_visual_assets_bookId_books_id_fk" FOREIGN KEY ("bookId") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_visual_assets" ADD CONSTRAINT "book_visual_assets_chapterId_book_chapters_id_fk" FOREIGN KEY ("chapterId") REFERENCES "public"."book_chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_visual_assets" ADD CONSTRAINT "book_visual_assets_pageId_book_pages_id_fk" FOREIGN KEY ("pageId") REFERENCES "public"."book_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "book_pages_book_id_page_number_idx" ON "book_pages" USING btree ("bookId","pageNumber");--> statement-breakpoint
CREATE INDEX "book_pages_chapter_id_idx" ON "book_pages" USING btree ("chapterId");--> statement-breakpoint
CREATE INDEX "book_pages_visual_status_idx" ON "book_pages" USING btree ("visualStatus");--> statement-breakpoint
CREATE INDEX "book_visual_assets_page_id_idx" ON "book_visual_assets" USING btree ("pageId");--> statement-breakpoint
CREATE INDEX "book_visual_assets_book_id_idx" ON "book_visual_assets" USING btree ("bookId");