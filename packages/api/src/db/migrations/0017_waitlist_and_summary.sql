CREATE TABLE "waitlist_signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"plan" varchar(20) DEFAULT 'pro' NOT NULL,
	"user_id" varchar(255),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "waitlist_signups_email_unique" UNIQUE("email")
);
ALTER TABLE "analyses" ADD COLUMN "summary" text;
