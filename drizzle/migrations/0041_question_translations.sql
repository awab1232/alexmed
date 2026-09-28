ALTER TABLE "extracted_questions" ADD COLUMN "questionTextAr" text;--> statement-breakpoint
ALTER TABLE "extracted_questions" ADD COLUMN "optionsAr" jsonb;--> statement-breakpoint
ALTER TABLE "extracted_questions" ADD COLUMN "translationSource" varchar(16);