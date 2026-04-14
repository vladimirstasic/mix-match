CREATE TABLE "analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" varchar(255) NOT NULL,
	"file_size" integer NOT NULL,
	"file_hash" varchar(64),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"total_chunks" integer,
	"processed_chunks" integer DEFAULT 0,
	"results" jsonb,
	"metrics" jsonb,
	"error" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
