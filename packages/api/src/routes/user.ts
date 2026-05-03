import { Router } from "express";
import { getAuth } from "@clerk/express";
import { eq, desc } from "drizzle-orm";
import { db } from "../db/client.js";
import { analyses } from "../db/schema.js";

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
