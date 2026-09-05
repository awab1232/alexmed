CREATE TABLE "card_review_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cardId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"rating" "book_card_rating" NOT NULL,
	"reviewedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "easeFactor" real DEFAULT 2.5 NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "intervalDays" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "dueAt" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "reviewCount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "lastRating" "book_card_rating";--> statement-breakpoint
ALTER TABLE "card_review_events" ADD CONSTRAINT "card_review_events_cardId_cards_id_fk" FOREIGN KEY ("cardId") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_review_events" ADD CONSTRAINT "card_review_events_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;