import { pgTable, uuid, varchar, integer, jsonb, text, timestamp, real } from "drizzle-orm/pg-core";

export const analyses = pgTable("analyses", {
  id: uuid("id").primaryKey().defaultRandom(),
  filename: varchar("filename", { length: 255 }).notNull(),
  fileSize: integer("file_size").notNull(),
  fileHash: varchar("file_hash", { length: 64 }),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  totalChunks: integer("total_chunks"),
  processedChunks: integer("processed_chunks").default(0),
  results: jsonb("results"),
  metrics: jsonb("metrics"),
  error: text("error"),
  chunksDir: varchar("chunks_dir", { length: 500 }),
  chunksExpireAt: timestamp("chunks_expire_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const segments = pgTable("segments", {
  id: uuid("id").primaryKey().defaultRandom(),
  analysisId: uuid("analysis_id").notNull().references(() => analyses.id, { onDelete: "cascade" }),
  startSec: integer("start_sec").notNull(),
  endSec: integer("end_sec").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("unknown"),
  trackName: varchar("track_name", { length: 500 }),
  artist: varchar("artist", { length: 255 }),
  title: varchar("title", { length: 255 }),
  acrid: varchar("acrid", { length: 100 }),
  confidence: real("confidence"),
  attempts: integer("attempts").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
