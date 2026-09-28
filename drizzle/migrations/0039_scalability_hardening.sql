CREATE TABLE "ai_model_health" (
	"model" varchar(200) PRIMARY KEY NOT NULL,
	"state" varchar(16) DEFAULT 'closed' NOT NULL,
	"consecutiveFailures" integer DEFAULT 0 NOT NULL,
	"openedUntil" timestamp with time zone,
	"probeStartedAt" timestamp with time zone,
	"lastErrorType" varchar(32),
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_request_leases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"scope" varchar(32) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"releasedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "chapter_generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapterId" uuid NOT NULL,
	"bookId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"kind" varchar(32) NOT NULL,
	"status" varchar(16) DEFAULT 'queued' NOT NULL,
	"rebuild" boolean DEFAULT false NOT NULL,
	"attemptCount" integer DEFAULT 0 NOT NULL,
	"errorType" varchar(32),
	"errorMessage" text,
	"queuedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"startedAt" timestamp with time zone,
	"completedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "extractionLeaseUntil" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ai_request_leases" ADD CONSTRAINT "ai_request_leases_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_generation_jobs" ADD CONSTRAINT "chapter_generation_jobs_chapterId_book_chapters_id_fk" FOREIGN KEY ("chapterId") REFERENCES "public"."book_chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_generation_jobs" ADD CONSTRAINT "chapter_generation_jobs_bookId_books_id_fk" FOREIGN KEY ("bookId") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_generation_jobs" ADD CONSTRAINT "chapter_generation_jobs_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_request_leases_user_id_created_at_idx" ON "ai_request_leases" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "ai_request_leases_live_idx" ON "ai_request_leases" USING btree ("expiresAt") WHERE "releasedAt" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "chapter_generation_jobs_chapter_id_kind_idx" ON "chapter_generation_jobs" USING btree ("chapterId","kind");--> statement-breakpoint
CREATE INDEX "chapter_generation_jobs_book_id_idx" ON "chapter_generation_jobs" USING btree ("bookId");--> statement-breakpoint
CREATE INDEX "chapter_generation_jobs_user_id_status_idx" ON "chapter_generation_jobs" USING btree ("userId","status");--> statement-breakpoint
CREATE INDEX "chapter_generation_jobs_status_idx" ON "chapter_generation_jobs" USING btree ("status");