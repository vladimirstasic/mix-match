ALTER TABLE "analyses" ADD COLUMN "is_favorite" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "analyses" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "segments" ADD COLUMN "is_bookmarked" boolean DEFAULT false;