CREATE TYPE "public"."book_card_rating" AS ENUM('hard', 'good', 'easy');--> statement-breakpoint
CREATE TYPE "public"."book_chapter_status" AS ENUM('pending', 'analyzing', 'complete', 'failed');--> statement-breakpoint
CREATE TABLE "book_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapterId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"questionAr" text NOT NULL,
	"questionEn" text NOT NULL,
	"answerAr" text NOT NULL,
	"answerEn" text NOT NULL,
	"relatedTermEn" text,
	"sourcePage" integer NOT NULL,
	"easeFactor" real DEFAULT 2.5 NOT NULL,
	"intervalDays" integer DEFAULT 0 NOT NULL,
	"dueAt" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewCount" integer DEFAULT 0 NOT NULL,
	"lastRating" "book_card_rating",
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bookId" uuid NOT NULL,
	"orderIndex" integer NOT NULL,
	"title" text NOT NULL,
	"startPage" integer NOT NULL,
	"endPage" integer NOT NULL,
	"status" "book_chapter_status" DEFAULT 'pending' NOT NULL,
	"pageTexts" jsonb,
	"explanationAr" text,
	"explanationEn" text,
	"keyPoints" jsonb,
	"chapterSummary" text,
	"errorMessage" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_mcq_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mcqId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"selectedIndex" integer NOT NULL,
	"isCorrect" boolean NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_mcqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapterId" uuid NOT NULL,
	"questionEn" text NOT NULL,
	"choices" jsonb NOT NULL,
	"correctIndex" integer NOT NULL,
	"explanationEn" text NOT NULL,
	"sourcePage" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_review_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cardId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"rating" "book_card_rating" NOT NULL,
	"reviewedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapterId" uuid NOT NULL,
	"ar" text NOT NULL,
	"en" text NOT NULL,
	"pronunciation" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"fileName" text NOT NULL,
	"fileKey" text,
	"pageCount" integer DEFAULT 0 NOT NULL,
	"chapterDetectionMethod" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "book_cards" ADD CONSTRAINT "book_cards_chapterId_book_chapters_id_fk" FOREIGN KEY ("chapterId") REFERENCES "public"."book_chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_cards" ADD CONSTRAINT "book_cards_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_chapters" ADD CONSTRAINT "book_chapters_bookId_books_id_fk" FOREIGN KEY ("bookId") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_mcq_attempts" ADD CONSTRAINT "book_mcq_attempts_mcqId_book_mcqs_id_fk" FOREIGN KEY ("mcqId") REFERENCES "public"."book_mcqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_mcq_attempts" ADD CONSTRAINT "book_mcq_attempts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_mcqs" ADD CONSTRAINT "book_mcqs_chapterId_book_chapters_id_fk" FOREIGN KEY ("chapterId") REFERENCES "public"."book_chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_review_events" ADD CONSTRAINT "book_review_events_cardId_book_cards_id_fk" FOREIGN KEY ("cardId") REFERENCES "public"."book_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_review_events" ADD CONSTRAINT "book_review_events_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_terms" ADD CONSTRAINT "book_terms_chapterId_book_chapters_id_fk" FOREIGN KEY ("chapterId") REFERENCES "public"."book_chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;