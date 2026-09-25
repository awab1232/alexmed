CREATE TYPE "public"."book_share_status" AS ENUM('pending', 'accepted', 'declined', 'revoked', 'removed');--> statement-breakpoint
CREATE TABLE "book_card_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"cardId" uuid NOT NULL,
	"intervalDays" integer DEFAULT 0 NOT NULL,
	"dueAt" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewCount" integer DEFAULT 0 NOT NULL,
	"lastRating" "book_card_rating",
	"fsrsStability" real,
	"fsrsDifficulty" real,
	"lastReviewedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_share_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shareId" uuid NOT NULL,
	"actorId" uuid,
	"event" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bookId" uuid NOT NULL,
	"ownerId" uuid NOT NULL,
	"recipientId" uuid NOT NULL,
	"status" "book_share_status" DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"respondedAt" timestamp with time zone,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_focus_bookmarks" (
	"userId" uuid NOT NULL,
	"cardId" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_focus_bookmarks_userId_cardId_pk" PRIMARY KEY("userId","cardId")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"type" text NOT NULL,
	"actorId" uuid,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"readAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_blocks" (
	"blockerId" uuid NOT NULL,
	"blockedId" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_blocks_blockerId_blockedId_pk" PRIMARY KEY("blockerId","blockedId")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "username" varchar(32);--> statement-breakpoint
ALTER TABLE "book_card_progress" ADD CONSTRAINT "book_card_progress_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_card_progress" ADD CONSTRAINT "book_card_progress_cardId_book_cards_id_fk" FOREIGN KEY ("cardId") REFERENCES "public"."book_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_share_events" ADD CONSTRAINT "book_share_events_shareId_book_shares_id_fk" FOREIGN KEY ("shareId") REFERENCES "public"."book_shares"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_share_events" ADD CONSTRAINT "book_share_events_actorId_users_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_shares" ADD CONSTRAINT "book_shares_bookId_books_id_fk" FOREIGN KEY ("bookId") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_shares" ADD CONSTRAINT "book_shares_ownerId_users_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_shares" ADD CONSTRAINT "book_shares_recipientId_users_id_fk" FOREIGN KEY ("recipientId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_focus_bookmarks" ADD CONSTRAINT "exam_focus_bookmarks_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_focus_bookmarks" ADD CONSTRAINT "exam_focus_bookmarks_cardId_exam_focus_cards_id_fk" FOREIGN KEY ("cardId") REFERENCES "public"."exam_focus_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actorId_users_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blockerId_users_id_fk" FOREIGN KEY ("blockerId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blockedId_users_id_fk" FOREIGN KEY ("blockedId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "book_card_progress_user_card_idx" ON "book_card_progress" USING btree ("userId","cardId");--> statement-breakpoint
CREATE INDEX "book_share_events_share_idx" ON "book_share_events" USING btree ("shareId");--> statement-breakpoint
CREATE UNIQUE INDEX "book_shares_live_book_recipient_idx" ON "book_shares" USING btree ("bookId","recipientId") WHERE "book_shares"."status" in ('pending', 'accepted');--> statement-breakpoint
CREATE INDEX "book_shares_recipient_status_idx" ON "book_shares" USING btree ("recipientId","status");--> statement-breakpoint
CREATE INDEX "book_shares_book_status_idx" ON "book_shares" USING btree ("bookId","status");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("userId","createdAt");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");--> statement-breakpoint
INSERT INTO "exam_focus_bookmarks" ("userId", "cardId") SELECT d."userId", c."id" FROM "exam_focus_cards" c JOIN "exam_focus_decks" d ON d."id" = c."deckId" WHERE c."bookmarked" = true ON CONFLICT DO NOTHING;
