CREATE TABLE "segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_id" uuid NOT NULL,
	"start_sec" integer NOT NULL,
	"end_sec" integer NOT NULL,
	"status" varchar(20) DEFAULT 'unknown' NOT NULL,
	"track_name" varchar(500),
	"artist" varchar(255),
	"title" varchar(255),
	"acrid" varchar(100),
	"confidence" real,
	"attempts" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "analyses" ADD COLUMN "chunks_dir" varchar(500);--> statement-breakpoint
ALTER TABLE "analyses" ADD COLUMN "chunks_expire_at" timestamp;--> statement-breakpoint
ALTER TABLE "segments" ADD CONSTRAINT "segments_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;