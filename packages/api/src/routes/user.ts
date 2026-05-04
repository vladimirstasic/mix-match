import { Router } from "express";
import { getAuth } from "@clerk/express";
import { eq, desc, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { analyses, users, segments } from "../db/schema.js";

export const userRouter = Router();

userRouter.get("/user/analyses", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db.select({
    id: analyses.id,
    filename: analyses.filename,
    status: analyses.status,
    mode: analyses.mode,
    createdAt: analyses.createdAt,
    isPublic: analyses.isPublic,
    isFavorite: analyses.isFavorite,
    slug: analyses.slug,
    tags: analyses.tags,
  })
  .from(analyses)
  .where(eq(analyses.userId, userId))
  .orderBy(desc(analyses.createdAt))
  .limit(50);

  res.json(rows);
});

userRouter.patch("/user/profile", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { username } = req.body;
  if (!username || typeof username !== "string") {
    res.status(400).json({ error: "Username required" });
    return;
  }

  const slug = username.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 50);
  if (slug.length < 3) {
    res.status(400).json({ error: "Username must be at least 3 characters" });
    return;
  }

  try {
    await db.update(users).set({ username: slug }).where(eq(users.clerkId, userId));
    res.json({ username: slug });
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "Username already taken" });
      return;
    }
    throw err;
  }
});

userRouter.get("/dj/:username", async (req, res) => {
  const username = req.params.username as string;

  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (!user) { res.status(404).json({ error: "DJ not found" }); return; }

  const mixes = await db.select({
    id: analyses.id,
    filename: analyses.filename,
    status: analyses.status,
    createdAt: analyses.createdAt,
    slug: analyses.slug,
  })
  .from(analyses)
  .where(and(eq(analyses.userId, user.clerkId), eq(analyses.isPublic, true)))
  .orderBy(desc(analyses.createdAt))
  .limit(20);

  res.json({ username: user.username, mixes });
});

userRouter.patch("/analysis/:id/tags", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const analysisId = req.params.id as string;
  const { tags } = req.body;
  if (!Array.isArray(tags)) { res.status(400).json({ error: "Tags must be an array" }); return; }

  const [analysis] = await db.select().from(analyses).where(eq(analyses.id, analysisId)).limit(1);
  if (!analysis) { res.status(404).json({ error: "Not found" }); return; }
  if (analysis.userId !== userId) { res.status(403).json({ error: "Not authorized" }); return; }

  await db.update(analyses).set({ tags }).where(eq(analyses.id, analysisId));
  res.json({ tags });
});

userRouter.patch("/analysis/:id/favorite", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const analysisId = req.params.id as string;
  const [analysis] = await db.select().from(analyses).where(eq(analyses.id, analysisId)).limit(1);
  if (!analysis || analysis.userId !== userId) { res.status(404).json({ error: "Not found" }); return; }

  const newVal = !analysis.isFavorite;
  await db.update(analyses).set({ isFavorite: newVal }).where(eq(analyses.id, analysisId));
  res.json({ isFavorite: newVal });
});

userRouter.patch("/segments/:id/bookmark", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const segmentId = req.params.id as string;
  const [segment] = await db.select().from(segments).where(eq(segments.id, segmentId)).limit(1);
  if (!segment) { res.status(404).json({ error: "Not found" }); return; }

  const newVal = !(segment as any).isBookmarked;
  await db.update(segments).set({ isBookmarked: newVal }).where(eq(segments.id, segmentId));
  res.json({ isBookmarked: newVal });
});

userRouter.post("/analysis/:id/reprocess", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const analysisId = req.params.id as string;
  const [analysis] = await db.select().from(analyses).where(eq(analyses.id, analysisId)).limit(1);
  if (!analysis) { res.status(404).json({ error: "Not found" }); return; }
  if (analysis.userId !== userId) { res.status(403).json({ error: "Not authorized" }); return; }
  if (!analysis.chunksDir) { res.status(410).json({ error: "Audio files expired, please re-upload" }); return; }

  // Reset status
  await db.update(analyses).set({ status: "pending", processedChunks: 0, results: null, metrics: null, error: null, updatedAt: new Date() }).where(eq(analyses.id, analysisId));

  // Delete old segments
  await db.delete(segments).where(eq(segments.analysisId, analysisId));

  res.json({ message: "Analysis reset. Please re-upload the file to reprocess." });
});
