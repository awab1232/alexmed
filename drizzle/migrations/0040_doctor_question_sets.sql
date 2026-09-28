CREATE TYPE "public"."doctor_status" AS ENUM('pending', 'approved', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."question_set_code_status" AS ENUM('unused', 'claimed', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."question_set_entitlement_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."question_set_status" AS ENUM('draft', 'published', 'disabled', 'archived');--> statement-breakpoint
CREATE TYPE "public"."question_set_visibility" AS ENUM('listed', 'unlisted');--> statement-breakpoint
CREATE TABLE "doctor_profiles" (
	"userId" uuid PRIMARY KEY NOT NULL,
	"status" "doctor_status" DEFAULT 'pending' NOT NULL,
	"fullName" text NOT NULL,
	"university" text NOT NULL,
	"faculty" text NOT NULL,
	"department" text NOT NULL,
	"universityEmail" varchar(320),
	"note" text,
	"reviewedById" uuid,
	"reviewedAt" timestamp with time zone,
	"rejectionReason" text,
	"suspendedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_set_access_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"setId" uuid NOT NULL,
	"batchId" uuid NOT NULL,
	"codeHash" varchar(64) NOT NULL,
	"codeHint" varchar(4) NOT NULL,
	"status" "question_set_code_status" DEFAULT 'unused' NOT NULL,
	"claimedById" uuid,
	"claimedAt" timestamp with time zone,
	"revokedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_set_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"setId" uuid,
	"actorId" uuid,
	"event" varchar(48) NOT NULL,
	"targetId" uuid,
	"meta" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_set_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"setId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"codeId" uuid,
	"source" varchar(16) DEFAULT 'code' NOT NULL,
	"status" "question_set_entitlement_status" DEFAULT 'active' NOT NULL,
	"grantedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"revokedAt" timestamp with time zone,
	"revokedById" uuid
);
--> statement-breakpoint
CREATE TABLE "question_set_redeem_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid,
	"ipHash" varchar(64),
	"outcome" varchar(16) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bookId" uuid NOT NULL,
	"ownerId" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"subjectLabel" text,
	"academicYear" text,
	"examType" text,
	"visibility" "question_set_visibility" DEFAULT 'unlisted' NOT NULL,
	"status" "question_set_status" DEFAULT 'draft' NOT NULL,
	"startsAt" timestamp with time zone,
	"endsAt" timestamp with time zone,
	"publishedAt" timestamp with time zone,
	"disabledAt" timestamp with time zone,
	"disabledByRole" varchar(16),
	"archivedAt" timestamp with time zone,
	"questionCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_sets_window_check" CHECK ("startsAt" IS NULL OR "endsAt" IS NULL OR "endsAt" > "startsAt")
);
--> statement-breakpoint
ALTER TABLE "doctor_profiles" ADD CONSTRAINT "doctor_profiles_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_profiles" ADD CONSTRAINT "doctor_profiles_reviewedById_users_id_fk" FOREIGN KEY ("reviewedById") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_set_access_codes" ADD CONSTRAINT "question_set_access_codes_setId_question_sets_id_fk" FOREIGN KEY ("setId") REFERENCES "public"."question_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_set_access_codes" ADD CONSTRAINT "question_set_access_codes_claimedById_users_id_fk" FOREIGN KEY ("claimedById") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_set_entitlements" ADD CONSTRAINT "question_set_entitlements_setId_question_sets_id_fk" FOREIGN KEY ("setId") REFERENCES "public"."question_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_set_entitlements" ADD CONSTRAINT "question_set_entitlements_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_set_entitlements" ADD CONSTRAINT "question_set_entitlements_codeId_question_set_access_codes_id_fk" FOREIGN KEY ("codeId") REFERENCES "public"."question_set_access_codes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_set_entitlements" ADD CONSTRAINT "question_set_entitlements_revokedById_users_id_fk" FOREIGN KEY ("revokedById") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_set_redeem_attempts" ADD CONSTRAINT "question_set_redeem_attempts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_sets" ADD CONSTRAINT "question_sets_bookId_books_id_fk" FOREIGN KEY ("bookId") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_sets" ADD CONSTRAINT "question_sets_ownerId_users_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "doctor_profiles_status_created_at_idx" ON "doctor_profiles" USING btree ("status","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "question_set_access_codes_code_hash_idx" ON "question_set_access_codes" USING btree ("codeHash");--> statement-breakpoint
CREATE INDEX "question_set_access_codes_set_id_status_idx" ON "question_set_access_codes" USING btree ("setId","status");--> statement-breakpoint
CREATE INDEX "question_set_audit_events_set_created_idx" ON "question_set_audit_events" USING btree ("setId","createdAt");--> statement-breakpoint
CREATE INDEX "question_set_audit_events_actor_created_idx" ON "question_set_audit_events" USING btree ("actorId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "question_set_entitlements_active_set_user_idx" ON "question_set_entitlements" USING btree ("setId","userId") WHERE "status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "question_set_entitlements_code_id_idx" ON "question_set_entitlements" USING btree ("codeId");--> statement-breakpoint
CREATE INDEX "question_set_entitlements_user_id_status_idx" ON "question_set_entitlements" USING btree ("userId","status");--> statement-breakpoint
CREATE INDEX "question_set_entitlements_set_id_status_idx" ON "question_set_entitlements" USING btree ("setId","status");--> statement-breakpoint
CREATE INDEX "question_set_redeem_attempts_user_created_idx" ON "question_set_redeem_attempts" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "question_set_redeem_attempts_ip_created_idx" ON "question_set_redeem_attempts" USING btree ("ipHash","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "question_sets_book_id_idx" ON "question_sets" USING btree ("bookId");--> statement-breakpoint
CREATE INDEX "question_sets_owner_id_created_at_idx" ON "question_sets" USING btree ("ownerId","createdAt");--> statement-breakpoint
CREATE INDEX "question_sets_listed_published_idx" ON "question_sets" USING btree ("publishedAt") WHERE "visibility" = 'listed' AND "status" = 'published';