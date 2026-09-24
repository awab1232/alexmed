CREATE TYPE "public"."exam_focus_deck_status" AS ENUM('processing', 'finalizing', 'complete', 'partial_failed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."exam_focus_unit_status" AS ENUM('pending', 'processing', 'retrying', 'complete', 'failed');--> statement-breakpoint
CREATE TABLE "exam_focus_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deckId" uuid NOT NULL,
	"orderIndex" integer NOT NULL,
	"category" text NOT NULL,
	"topic" text DEFAULT '' NOT NULL,
	"title" text NOT NULL,
	"points" jsonb NOT NULL,
	"highlightLabel" text DEFAULT '' NOT NULL,
	"highlightText" text DEFAULT '' NOT NULL,
	"flag" text DEFAULT '' NOT NULL,
	"sourcePages" jsonb NOT NULL,
	"unitIndex" integer NOT NULL,
	"searchText" text NOT NULL,
	"bookmarked" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_focus_decks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bookId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"status" "exam_focus_deck_status" DEFAULT 'processing' NOT NULL,
	"totalPages" integer DEFAULT 0 NOT NULL,
	"totalUnits" integer DEFAULT 0 NOT NULL,
	"totalCards" integer DEFAULT 0 NOT NULL,
	"coverage" jsonb,
	"errorMessage" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"completedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "exam_focus_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deckId" uuid NOT NULL,
	"unitIndex" integer NOT NULL,
	"pageStart" integer NOT NULL,
	"pageEnd" integer NOT NULL,
	"pageTexts" jsonb NOT NULL,
	"status" "exam_focus_unit_status" DEFAULT 'pending' NOT NULL,
	"attemptCount" integer DEFAULT 0 NOT NULL,
	"lastStartedAt" timestamp with time zone,
	"facts" jsonb,
	"declaredEmptyPages" jsonb,
	"errorMessage" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exam_focus_cards" ADD CONSTRAINT "exam_focus_cards_deckId_exam_focus_decks_id_fk" FOREIGN KEY ("deckId") REFERENCES "public"."exam_focus_decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_focus_decks" ADD CONSTRAINT "exam_focus_decks_bookId_books_id_fk" FOREIGN KEY ("bookId") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_focus_decks" ADD CONSTRAINT "exam_focus_decks_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_focus_units" ADD CONSTRAINT "exam_focus_units_deckId_exam_focus_decks_id_fk" FOREIGN KEY ("deckId") REFERENCES "public"."exam_focus_decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exam_focus_cards_deck_id_order_idx" ON "exam_focus_cards" USING btree ("deckId","orderIndex");--> statement-breakpoint
CREATE UNIQUE INDEX "exam_focus_decks_book_id_idx" ON "exam_focus_decks" USING btree ("bookId");--> statement-breakpoint
CREATE UNIQUE INDEX "exam_focus_units_deck_id_unit_index_idx" ON "exam_focus_units" USING btree ("deckId","unitIndex");