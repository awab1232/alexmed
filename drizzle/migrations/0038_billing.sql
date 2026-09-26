CREATE TYPE "public"."billing_period" AS ENUM('monthly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."payment_request_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'expired', 'cancelled', 'pending', 'paused');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updatedBy" uuid,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"planId" varchar(32) NOT NULL,
	"billingPeriod" "billing_period" DEFAULT 'monthly' NOT NULL,
	"durationMonths" integer DEFAULT 1 NOT NULL,
	"amountCents" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"paymentMethod" text NOT NULL,
	"reference" text,
	"proofUrl" text,
	"note" text,
	"status" "payment_request_status" DEFAULT 'pending' NOT NULL,
	"adminNote" text,
	"reviewedBy" uuid,
	"reviewedAt" timestamp with time zone,
	"subscriptionId" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"tagline" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"priceMonthlyCents" integer DEFAULT 0 NOT NULL,
	"priceYearlyCents" integer,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"assistantDailyLimit" integer NOT NULL,
	"assistantTokenDailyLimit" integer,
	"questionsDailyLimit" integer NOT NULL,
	"questionsMonthlyLimit" integer,
	"booksDailyLimit" integer NOT NULL,
	"booksMonthlyLimit" integer,
	"maxFileSizeMb" integer NOT NULL,
	"processingConcurrency" integer DEFAULT 2 NOT NULL,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"highlighted" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"subscriptionId" uuid,
	"adminId" uuid,
	"action" text NOT NULL,
	"previousPlan" varchar(32),
	"newPlan" varchar(32),
	"previousStatus" text,
	"newStatus" text,
	"previousEndDate" timestamp with time zone,
	"newEndDate" timestamp with time zone,
	"metadata" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"planId" varchar(32) NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"billingPeriod" "billing_period" DEFAULT 'monthly' NOT NULL,
	"startDate" timestamp with time zone NOT NULL,
	"endDate" timestamp with time zone,
	"paymentMethod" text,
	"paymentReference" text,
	"paymentRequestId" uuid,
	"activatedBy" uuid,
	"cancelledAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"day" varchar(10) NOT NULL,
	"assistantMessages" integer DEFAULT 0 NOT NULL,
	"assistantTokens" integer DEFAULT 0 NOT NULL,
	"questionFiles" integer DEFAULT 0 NOT NULL,
	"bookFiles" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_monthly" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"month" varchar(7) NOT NULL,
	"questionFiles" integer DEFAULT 0 NOT NULL,
	"bookFiles" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updatedBy_users_id_fk" FOREIGN KEY ("updatedBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_planId_plans_id_fk" FOREIGN KEY ("planId") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_reviewedBy_users_id_fk" FOREIGN KEY ("reviewedBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_audit_logs" ADD CONSTRAINT "subscription_audit_logs_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_audit_logs" ADD CONSTRAINT "subscription_audit_logs_adminId_users_id_fk" FOREIGN KEY ("adminId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_plans_id_fk" FOREIGN KEY ("planId") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_activatedBy_users_id_fk" FOREIGN KEY ("activatedBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_daily" ADD CONSTRAINT "usage_daily_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_monthly" ADD CONSTRAINT "usage_monthly_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_requests_status_created_idx" ON "payment_requests" USING btree ("status","createdAt");--> statement-breakpoint
CREATE INDEX "payment_requests_user_created_idx" ON "payment_requests" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_requests_one_pending_per_user" ON "payment_requests" USING btree ("userId") WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX "subscription_audit_user_created_idx" ON "subscription_audit_logs" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "subscriptions_user_status_idx" ON "subscriptions" USING btree ("userId","status");--> statement-breakpoint
CREATE INDEX "subscriptions_user_end_idx" ON "subscriptions" USING btree ("userId","endDate");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_one_active_per_user" ON "subscriptions" USING btree ("userId") WHERE status = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "usage_daily_user_day_idx" ON "usage_daily" USING btree ("userId","day");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_monthly_user_month_idx" ON "usage_monthly" USING btree ("userId","month");--> statement-breakpoint
INSERT INTO "plans" ("id","name","tagline","description","priceMonthlyCents","priceYearlyCents","currency","assistantDailyLimit","assistantTokenDailyLimit","questionsDailyLimit","questionsMonthlyLimit","booksDailyLimit","booksMonthlyLimit","maxFileSizeMb","processingConcurrency","features","highlighted","active","sortOrder") VALUES
('free','Free','ابدأ مجانًا','للدراسة اليومية وتجربة أدوات NiroLearn',0,NULL,'USD',20,10000,2,15,3,15,100,2,'{"ASSISTANT":true,"BOOK_UPLOAD":true,"QUESTION_UPLOAD":true,"CARDS":true,"QUIZ":true,"SUMMARY":true,"MIND_MAP":true,"EXAM_FOCUS":true,"CHAT_HISTORY":true,"PRIORITY_PROCESSING":false,"LARGE_FILES":false}'::jsonb,false,true,0),
('pro','Pro','للطالب النشط','مساحة أكبر، معالجة أسرع، واستخدام أعلى لأدوات الدراسة',1000,NULL,'USD',100,NULL,10,100,10,100,250,3,'{"ASSISTANT":true,"BOOK_UPLOAD":true,"QUESTION_UPLOAD":true,"CARDS":true,"QUIZ":true,"SUMMARY":true,"MIND_MAP":true,"EXAM_FOCUS":true,"CHAT_HISTORY":true,"PRIORITY_PROCESSING":true,"LARGE_FILES":false}'::jsonb,true,true,1),
('ultimate','Ultimate','للدراسة المكثفة','للطلبة الذين يعتمدون على NiroLearn بشكل يومي وبحجم ملفات أكبر',2000,NULL,'USD',500,NULL,20,NULL,20,NULL,500,4,'{"ASSISTANT":true,"BOOK_UPLOAD":true,"QUESTION_UPLOAD":true,"CARDS":true,"QUIZ":true,"SUMMARY":true,"MIND_MAP":true,"EXAM_FOCUS":true,"CHAT_HISTORY":true,"PRIORITY_PROCESSING":true,"LARGE_FILES":true}'::jsonb,false,true,2)
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
INSERT INTO "app_settings" ("key","value") VALUES
('billing','{"paymentInstructions":"الدفع حاليًا يتم يدويًا. تواصل مع فريق NiroLearn لتحصل على طريقة الدفع المناسبة لبلدك، وبعد الدفع أرسل طلب الترقية مع رقم العملية، وسنفعّل باقتك بعد التأكد.","supportContact":{"label":"تواصل مع الدعم","url":""},"paymentMethods":["تحويل بنكي","محفظة إلكترونية","أخرى"],"currencyRates":{"JOD":0.709,"SAR":3.75,"AED":3.6725,"KWD":0.307,"QAR":3.64,"BHD":0.376,"OMR":0.3845,"ILS":3.7,"LBP":89500,"SYP":13000,"IQD":1310,"EGP":48.5}}'::jsonb)
ON CONFLICT ("key") DO NOTHING;
