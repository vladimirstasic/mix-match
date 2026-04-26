CREATE TABLE "users" (
	"clerk_id" varchar(255) PRIMARY KEY NOT NULL,
	"plan" varchar(20) DEFAULT 'free' NOT NULL,
	"credits_remaining" integer DEFAULT 3 NOT NULL,
	"credits_reset_at" timestamp DEFAULT now() NOT NULL,
	"stripe_customer_id" varchar(255),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "analyses" ADD COLUMN "user_id" varchar(255);--> statement-breakpoint
ALTER TABLE "analyses" ADD COLUMN "mode" varchar(10) DEFAULT 'fast';--> statement-breakpoint
ALTER TABLE "analyses" ADD COLUMN "is_public" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "analyses" ADD COLUMN "slug" varchar(50);--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_user_id_users_clerk_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("clerk_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_slug_unique" UNIQUE("slug");