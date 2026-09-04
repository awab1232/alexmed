CREATE TYPE "public"."card_confidence" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."card_status" AS ENUM('complete', 'needs_review');--> statement-breakpoint
CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deckId" uuid NOT NULL,
	"question" text NOT NULL,
	"questionArabic" text NOT NULL,
	"answer" text NOT NULL,
	"answerArabic" text NOT NULL,
	"explanation" text NOT NULL,
	"explanationArabic" text NOT NULL,
	"keyIdea" text NOT NULL,
	"keyIdeaArabic" text NOT NULL,
	"keyword" text NOT NULL,
	"keywordArabic" text NOT NULL,
	"sourcePage" integer NOT NULL,
	"status" "card_status" NOT NULL,
	"confidence" "card_confidence" NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"fileName" text NOT NULL,
	"fileKey" text,
	"pageCount" integer DEFAULT 0 NOT NULL,
	"depth" text DEFAULT 'balanced' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_deckId_decks_id_fk" FOREIGN KEY ("deckId") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;