CREATE TABLE "book_page_marks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bookId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"pageNumber" integer NOT NULL,
	"highlights" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"strokes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "book_page_marks" ADD CONSTRAINT "book_page_marks_bookId_books_id_fk" FOREIGN KEY ("bookId") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_page_marks" ADD CONSTRAINT "book_page_marks_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "book_page_marks_user_id_book_id_page_number_idx" ON "book_page_marks" USING btree ("userId","bookId","pageNumber");