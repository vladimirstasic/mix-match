import { pgTable, uuid, varchar, integer, jsonb, text, timestamp } from "drizzle-orm/pg-core";

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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
