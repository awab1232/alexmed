CREATE TYPE "public"."extracted_question_ai_status" AS ENUM('pending', 'processing', 'complete', 'failed');--> statement-breakpoint
CREATE TYPE "public"."question_file_page_status" AS ENUM('pending', 'processing', 'complete', 'failed');--> statement-breakpoint
CREATE TABLE "extracted_question_image_relations" (
	"questionId" uuid NOT NULL,
	"imageId" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "extracted_question_image_relations_questionId_imageId_pk" PRIMARY KEY("questionId","imageId")
);
--> statement-breakpoint
CREATE TABLE "extracted_question_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bookId" uuid NOT NULL,
	"pageNumber" integer NOT NULL,
	"storageKey" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_file_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bookId" uuid NOT NULL,
	"pageNumber" integer NOT NULL,
	"status" "question_file_page_status" DEFAULT 'pending' NOT NULL,
	"attemptCount" integer DEFAULT 0 NOT NULL,
	"errorMessage" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "extracted_questions" ADD COLUMN "keywords" jsonb;--> statement-breakpoint
ALTER TABLE "extracted_questions" ADD COLUMN "aiExplanationAr" text;--> statement-breakpoint
ALTER TABLE "extracted_questions" ADD COLUMN "aiStatus" "extracted_question_ai_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "extracted_questions" ADD COLUMN "aiError" text;--> statement-breakpoint
ALTER TABLE "extracted_questions" ADD COLUMN "aiAttemptCount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "extracted_question_image_relations" ADD CONSTRAINT "extracted_question_image_relations_questionId_extracted_questions_id_fk" FOREIGN KEY ("questionId") REFERENCES "public"."extracted_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_question_image_relations" ADD CONSTRAINT "extracted_question_image_relations_imageId_extracted_question_images_id_fk" FOREIGN KEY ("imageId") REFERENCES "public"."extracted_question_images"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_question_images" ADD CONSTRAINT "extracted_question_images_bookId_books_id_fk" FOREIGN KEY ("bookId") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_file_pages" ADD CONSTRAINT "question_file_pages_bookId_books_id_fk" FOREIGN KEY ("bookId") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "extracted_question_image_relations_image_id_idx" ON "extracted_question_image_relations" USING btree ("imageId");--> statement-breakpoint
CREATE INDEX "extracted_question_images_book_id_page_number_idx" ON "extracted_question_images" USING btree ("bookId","pageNumber");--> statement-breakpoint
CREATE UNIQUE INDEX "question_file_pages_book_id_page_number_idx" ON "question_file_pages" USING btree ("bookId","pageNumber");--> statement-breakpoint
CREATE INDEX "question_file_pages_status_idx" ON "question_file_pages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "extracted_questions_ai_status_idx" ON "extracted_questions" USING btree ("aiStatus");