import { Router } from "express";
import { getAuth } from "@clerk/express";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { votes, comments, segments, users } from "../db/schema.js";

export const communityRouter = Router();

// POST /api/segments/:id/vote — upvote or downvote
communityRouter.post("/segments/:id/vote", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  await db.insert(users).values({ clerkId: userId }).onConflictDoNothing();

  const segmentId = req.params.id as string;
  const { value } = req.body; // 1 or -1
  if (value !== 1 && value !== -1) { res.status(400).json({ error: "Value must be 1 or -1" }); return; }

  // Upsert vote
  const existing = await db.select().from(votes)
    .where(and(eq(votes.segmentId, segmentId), eq(votes.userId, userId))).limit(1);

  if (existing.length > 0) {
    if (existing[0].value === value) {
      // Remove vote (toggle off)
      await db.delete(votes).where(eq(votes.id, existing[0].id));
    } else {
      // Change vote
      await db.update(votes).set({ value }).where(eq(votes.id, existing[0].id));
    }
  } else {
    await db.insert(votes).values({ segmentId, userId, value });
  }

  // Return total score
  const result = await db.select({ total: sql<number>`COALESCE(SUM(${votes.value}), 0)` })
    .from(votes).where(eq(votes.segmentId, segmentId));

  res.json({ score: Number(result[0]?.total || 0) });
});

// GET /api/segments/:id/comments — get comments
communityRouter.get("/segments/:id/comments", async (req, res) => {
  const segmentId = req.params.id as string;
  const rows = await db.select().from(comments)
    .where(eq(comments.segmentId, segmentId))
    .orderBy(comments.createdAt);
  res.json(rows);
});

// POST /api/segments/:id/comments — add comment
communityRouter.post("/segments/:id/comments", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  await db.insert(users).values({ clerkId: userId }).onConflictDoNothing();

  const segmentId = req.params.id as string;
  const { text } = req.body;
  if (!text || typeof text !== "string" || text.length > 500) {
    res.status(400).json({ error: "Comment text required (max 500 chars)" });
    return;
  }

  const [comment] = await db.insert(comments).values({ segmentId, userId, text }).returning();
  res.json(comment);
});
