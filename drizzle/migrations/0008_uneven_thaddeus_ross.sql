-- مكتبة الأدمن (Admin Library): fully additive — 5 new tables + 5 new enum
-- types, zero changes to any existing table (مِرآة/كتبي/decks/cards/users
-- untouched). Manual rollback, in reverse order, if ever needed:
--   DROP TABLE admin_material_audit_logs;
--   DROP TABLE admin_material_reviews;
--   DROP TABLE admin_material_cards;
--   DROP TABLE admin_material_batches;
--   DROP TABLE admin_materials;
--   DROP TYPE admin_material_difficulty;
--   DROP TYPE admin_material_review_status;
--   DROP TYPE admin_material_confidence;
--   DROP TYPE admin_material_batch_status;
--   DROP TYPE admin_material_status;
CREATE TYPE "public"."admin_material_batch_status" AS ENUM('pending', 'processing', 'complete', 'failed', 'retrying');--> statement-breakpoint
CREATE TYPE "public"."admin_material_confidence" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."admin_material_difficulty" AS ENUM('easy', 'medium', 'hard');--> statement-breakpoint
CREATE TYPE "public"."admin_material_review_status" AS ENUM('pending', 'approved', 'needs_review');--> statement-breakpoint
CREATE TYPE "public"."admin_material_status" AS ENUM('draft', 'processing', 'ready_for_review', 'published', 'archived', 'failed');--> statement-breakpoint
CREATE TABLE "admin_material_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"materialId" uuid,
	"actorUserId" uuid,
	"action" text NOT NULL,
	"metadata" jsonb,
	"ipAddress" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_material_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"materialId" uuid NOT NULL,
	"batchIndex" integer NOT NULL,
	"startPage" integer NOT NULL,
	"endPage" integer NOT NULL,
	"pageTexts" jsonb,
	"status" "admin_material_batch_status" DEFAULT 'pending' NOT NULL,
	"errorMessage" text,
	"attemptCount" integer DEFAULT 0 NOT NULL,
	"lastStartedAt" timestamp with time zone,
	"lastCompletedAt" timestamp with time zone,
	"lastErrorAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_material_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"materialId" uuid NOT NULL,
	"batchId" uuid NOT NULL,
	"questionEn" text NOT NULL,
	"questionAr" text NOT NULL,
	"answerEn" text NOT NULL,
	"answerAr" text NOT NULL,
	"explanationEn" text NOT NULL,
	"explanationAr" text NOT NULL,
	"keyIdeaEn" text NOT NULL,
	"keyIdeaAr" text NOT NULL,
	"keywordEn" text NOT NULL,
	"keywordAr" text NOT NULL,
	"sourcePage" integer NOT NULL,
	"confidence" "admin_material_confidence" NOT NULL,
	"reviewStatus" "admin_material_review_status" DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_material_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"materialCardId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"easeFactor" real DEFAULT 2.5 NOT NULL,
	"intervalDays" integer DEFAULT 0 NOT NULL,
	"dueAt" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewCount" integer DEFAULT 0 NOT NULL,
	"lastRating" "book_card_rating",
	"lastReviewedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "admin_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ownerAdminId" uuid NOT NULL,
	"fileName" text NOT NULL,
	"fileKey" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text,
	"difficulty" "admin_material_difficulty" DEFAULT 'medium' NOT NULL,
	"language" text DEFAULT 'both' NOT NULL,
	"pageCount" integer DEFAULT 0 NOT NULL,
	"cardCount" integer DEFAULT 0 NOT NULL,
	"status" "admin_material_status" DEFAULT 'draft' NOT NULL,
	"pageTexts" jsonb,
	"pagesNeedingOcr" jsonb,
	"ocrFailedPages" jsonb,
	"extractionError" text,
	"extractionAttemptCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"publishedAt" timestamp with time zone,
	"archivedAt" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "admin_material_batches" ADD CONSTRAINT "admin_material_batches_materialId_admin_materials_id_fk" FOREIGN KEY ("materialId") REFERENCES "public"."admin_materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_material_cards" ADD CONSTRAINT "admin_material_cards_materialId_admin_materials_id_fk" FOREIGN KEY ("materialId") REFERENCES "public"."admin_materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_material_cards" ADD CONSTRAINT "admin_material_cards_batchId_admin_material_batches_id_fk" FOREIGN KEY ("batchId") REFERENCES "public"."admin_material_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_material_reviews" ADD CONSTRAINT "admin_material_reviews_materialCardId_admin_material_cards_id_fk" FOREIGN KEY ("materialCardId") REFERENCES "public"."admin_material_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_material_reviews" ADD CONSTRAINT "admin_material_reviews_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_materials" ADD CONSTRAINT "admin_materials_ownerAdminId_users_id_fk" FOREIGN KEY ("ownerAdminId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_material_audit_logs_material_id_idx" ON "admin_material_audit_logs" USING btree ("materialId");--> statement-breakpoint
CREATE INDEX "admin_material_audit_logs_actor_user_id_idx" ON "admin_material_audit_logs" USING btree ("actorUserId");--> statement-breakpoint
CREATE INDEX "admin_material_audit_logs_created_at_idx" ON "admin_material_audit_logs" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "admin_material_batches_material_id_batch_index_idx" ON "admin_material_batches" USING btree ("materialId","batchIndex");--> statement-breakpoint
CREATE INDEX "admin_material_batches_status_idx" ON "admin_material_batches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "admin_material_cards_material_id_source_page_idx" ON "admin_material_cards" USING btree ("materialId","sourcePage");--> statement-breakpoint
CREATE INDEX "admin_material_cards_review_status_idx" ON "admin_material_cards" USING btree ("reviewStatus");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_material_reviews_user_id_card_id_idx" ON "admin_material_reviews" USING btree ("userId","materialCardId");--> statement-breakpoint
CREATE INDEX "admin_material_reviews_user_id_due_at_idx" ON "admin_material_reviews" USING btree ("userId","dueAt");--> statement-breakpoint
CREATE INDEX "admin_materials_status_idx" ON "admin_materials" USING btree ("status");--> statement-breakpoint
CREATE INDEX "admin_materials_owner_admin_id_created_at_idx" ON "admin_materials" USING btree ("ownerAdminId","createdAt");--> statement-breakpoint
CREATE INDEX "admin_materials_category_idx" ON "admin_materials" USING btree ("category");