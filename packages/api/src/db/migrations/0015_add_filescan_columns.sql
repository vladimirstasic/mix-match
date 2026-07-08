ALTER TABLE "analyses" ADD COLUMN "engine" varchar(20) DEFAULT 'realtime' NOT NULL;
ALTER TABLE "analyses" ADD COLUMN "filescan_file_id" varchar(100);
ALTER TABLE "analyses" ADD COLUMN "scan_state" integer;
CREATE INDEX "analyses_filescan_file_id_idx" ON "analyses" ("filescan_file_id");
