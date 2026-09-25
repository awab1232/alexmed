CREATE TYPE "public"."brain_game_session_status" AS ENUM('active', 'submitted', 'abandoned');--> statement-breakpoint
CREATE TABLE "brain_game_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"gameId" text NOT NULL,
	"currentStage" integer DEFAULT 1 NOT NULL,
	"highestUnlockedStage" integer DEFAULT 1 NOT NULL,
	"completedStages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bestScore" integer DEFAULT 0 NOT NULL,
	"totalScore" integer DEFAULT 0 NOT NULL,
	"totalCorrect" integer DEFAULT 0 NOT NULL,
	"totalWrong" integer DEFAULT 0 NOT NULL,
	"totalAttempts" integer DEFAULT 0 NOT NULL,
	"bestTimeMs" integer,
	"currentStreak" integer DEFAULT 0 NOT NULL,
	"bestStreak" integer DEFAULT 0 NOT NULL,
	"stageBests" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"lastPlayedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brain_game_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"gameId" text NOT NULL,
	"stage" integer NOT NULL,
	"status" "brain_game_session_status" DEFAULT 'active' NOT NULL,
	"seed" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"clientState" jsonb,
	"hintsUsed" integer DEFAULT 0 NOT NULL,
	"startedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"submittedAt" timestamp with time zone,
	"result" jsonb,
	"score" integer,
	"passed" boolean
);
--> statement-breakpoint
ALTER TABLE "brain_game_progress" ADD CONSTRAINT "brain_game_progress_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_game_sessions" ADD CONSTRAINT "brain_game_sessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "brain_game_progress_user_game_idx" ON "brain_game_progress" USING btree ("userId","gameId");--> statement-breakpoint
CREATE INDEX "brain_game_sessions_user_game_status_idx" ON "brain_game_sessions" USING btree ("userId","gameId","status");