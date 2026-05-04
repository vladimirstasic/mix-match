import { Router } from "express";
import { getAuth } from "@clerk/express";
import { eq, desc, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { analyses, users } from "../db/schema.js";

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
    slug: analyses.slug,
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
