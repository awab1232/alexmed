CREATE TABLE "card_marks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cardId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"highlights" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"strokes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card_marks" ADD CONSTRAINT "card_marks_cardId_cards_id_fk" FOREIGN KEY ("cardId") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_marks" ADD CONSTRAINT "card_marks_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "card_marks_user_id_card_id_idx" ON "card_marks" USING btree ("userId","cardId");