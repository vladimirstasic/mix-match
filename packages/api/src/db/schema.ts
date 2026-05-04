import { pgTable, uuid, varchar, integer, jsonb, text, timestamp, real, boolean, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  clerkId: varchar('clerk_id', { length: 255 }).primaryKey(),
  username: varchar('username', { length: 50 }).unique(),
  plan: varchar('plan', { length: 20 }).notNull().default('free'),
  creditsRemaining: integer('credits_remaining').notNull().default(3),
  creditsResetAt: timestamp('credits_reset_at').notNull().defaultNow(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const analyses = pgTable(
  'analyses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    filename: varchar('filename', { length: 255 }).notNull(),
    fileSize: integer('file_size').notNull(),
    fileHash: varchar('file_hash', { length: 64 }),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    totalChunks: integer('total_chunks'),
    processedChunks: integer('processed_chunks').default(0),
    results: jsonb('results'),
    metrics: jsonb('metrics'),
    error: text('error'),
    waveformData: jsonb('waveform_data'),
    chunksDir: varchar('chunks_dir', { length: 500 }),
    chunksExpireAt: timestamp('chunks_expire_at'),
    userId: varchar('user_id', { length: 255 }).references(() => users.clerkId),
    mode: varchar('mode', { length: 10 }).default('fast'),
    isPublic: boolean('is_public').default(false),
    isFavorite: boolean('is_favorite').default(false),
    slug: varchar('slug', { length: 50 }).unique(),
    viewCount: integer('view_count').default(0),
    tags: jsonb('tags').$type<string[]>().default([]),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  table => [index('analyses_user_id_idx').on(table.userId), index('analyses_slug_idx').on(table.slug)],
);

export const segments = pgTable(
  'segments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    analysisId: uuid('analysis_id')
      .notNull()
      .references(() => analyses.id, { onDelete: 'cascade' }),
    startSec: integer('start_sec').notNull(),
    endSec: integer('end_sec').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('unknown'),
    trackName: varchar('track_name', { length: 500 }),
    artist: varchar('artist', { length: 255 }),
    title: varchar('title', { length: 255 }),
    acrid: varchar('acrid', { length: 100 }),
    confidence: real('confidence'),
    bpm: integer('bpm'),
    genre: varchar('genre', { length: 100 }),
    musicalKey: varchar('musical_key', { length: 10 }),
    externalLinks: jsonb('external_links'),
    isBookmarked: boolean('is_bookmarked').default(false),
    attempts: integer('attempts').notNull().default(1),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  table => [index('segments_analysis_id_idx').on(table.analysisId)],
);

export const votes = pgTable(
  'votes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    segmentId: uuid('segment_id')
      .notNull()
      .references(() => segments.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.clerkId),
    value: integer('value').notNull(), // +1 or -1
    createdAt: timestamp('created_at').defaultNow(),
  },
  table => [index('votes_segment_id_idx').on(table.segmentId)],
);

export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  segmentId: uuid('segment_id')
    .notNull()
    .references(() => segments.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.clerkId),
  text: varchar('text', { length: 500 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const follows = pgTable(
  'follows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    followerId: varchar('follower_id', { length: 255 })
      .notNull()
      .references(() => users.clerkId, { onDelete: 'cascade' }),
    followingUsername: varchar('following_username', { length: 50 }).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  table => [index('follows_follower_id_idx').on(table.followerId)],
);
