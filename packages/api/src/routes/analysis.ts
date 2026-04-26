import { Router } from "express";
import { getAuth } from "@clerk/express";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { analyses, segments } from "../db/schema.js";
import fs from "fs/promises";
import { queueEvents, analysisQueue } from "../queue/index.js";

export const analysisRouter = Router();

// GET /api/analysis/:id — poll result
analysisRouter.get("/analysis/:id", async (req, res) => {
  const [analysis] = await db
    .select()
    .from(analyses)
    .where(eq(analyses.id, req.params.id))
    .limit(1);

  if (!analysis) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  const { userId } = getAuth(req);
  if (analysis.userId && analysis.userId !== userId) {
    res.status(403).json({ error: "Not authorized" });
    return;
  }

  const segs = await db
    .select()
    .from(segments)
    .where(eq(segments.analysisId, req.params.id))
    .orderBy(segments.startSec);

  let chunksAvailable = false;
  if (analysis.chunksDir) {
    try {
      await fs.access(analysis.chunksDir);
      chunksAvailable = true;
    } catch {
      chunksAvailable = false;
    }
  }

  res.json({
    ...analysis,
    segments: segs,
    chunksAvailable,
  });
});

// GET /api/analysis/:id/progress — SSE stream
analysisRouter.get("/analysis/:id/progress", async (req, res) => {
  const [analysis] = await db
    .select()
    .from(analyses)
    .where(eq(analyses.id, req.params.id))
    .limit(1);

  if (!analysis) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  // If already done, send result immediately
  if (analysis.status === "completed" || analysis.status === "failed") {
    res.json(analysis);
    return;
  }

  // SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const send = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const onProgress = ({ jobId, data }: { jobId: string; data: unknown }) => {
    const progress = data as Record<string, unknown>;
    if (progress.analysisId === req.params.id) {
      send({ type: "progress", ...progress });
    }
  };

  const onCompleted = async ({ jobId }: { jobId: string }) => {
    const job = await analysisQueue.getJob(jobId);
    if (job?.data.analysisId === req.params.id) {
      const [updated] = await db
        .select()
        .from(analyses)
        .where(eq(analyses.id, req.params.id))
        .limit(1);
      send({ type: "completed", results: updated.results });
      cleanup();
      res.end();
    }
  };

  const onFailed = async ({ jobId, failedReason }: { jobId: string; failedReason: string }) => {
    const job = await analysisQueue.getJob(jobId);
    if (job?.data.analysisId === req.params.id) {
      send({ type: "failed", error: failedReason });
      cleanup();
      res.end();
    }
  };

  const cleanup = () => {
    queueEvents.off("progress", onProgress);
    queueEvents.off("completed", onCompleted);
    queueEvents.off("failed", onFailed);
  };

  queueEvents.on("progress", onProgress);
  queueEvents.on("completed", onCompleted);
  queueEvents.on("failed", onFailed);

  req.on("close", cleanup);
});

// PATCH /api/analysis/:id/segments/:segId — manual track edit
analysisRouter.patch("/analysis/:id/segments/:segId", async (req, res) => {
  const { userId } = getAuth(req);
  const analysisId = req.params.id as string;
  const segId = req.params.segId as string;
  const { trackName, artist, title } = req.body;

  if (!trackName && !artist && !title) {
    res.status(400).json({ error: "Provide trackName, artist, or title" });
    return;
  }

  // Verify ownership
  const [analysis] = await db
    .select()
    .from(analyses)
    .where(eq(analyses.id, analysisId))
    .limit(1);
  if (!analysis) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }
  if (analysis.userId && analysis.userId !== userId) {
    res.status(403).json({ error: "Not authorized" });
    return;
  }

  // Verify segment belongs to this analysis
  const [segment] = await db
    .select()
    .from(segments)
    .where(and(eq(segments.id, segId), eq(segments.analysisId, analysisId)))
    .limit(1);
  if (!segment) {
    res.status(404).json({ error: "Segment not found" });
    return;
  }

  // Build update - if only trackName provided, parse artist/title from it
  const finalArtist =
    artist || (trackName ? trackName.split(" - ")[0] : segment.artist);
  const finalTitle =
    title ||
    (trackName ? trackName.split(" - ").slice(1).join(" - ") : segment.title);
  const finalTrackName = trackName || `${finalArtist} - ${finalTitle}`;

  await db
    .update(segments)
    .set({
      trackName: finalTrackName,
      artist: finalArtist,
      title: finalTitle,
      status: "identified",
      updatedAt: new Date(),
    })
    .where(eq(segments.id, segId));

  const [updated] = await db
    .select()
    .from(segments)
    .where(eq(segments.id, segId))
    .limit(1);
  res.json(updated);
});

// GET /api/analysis/:id/export/text
analysisRouter.get("/analysis/:id/export/text", async (req, res) => {
  const analysisId = req.params.id as string;
  const [analysis] = await db.select().from(analyses).where(eq(analyses.id, analysisId)).limit(1);
  if (!analysis) { res.status(404).json({ error: "Analysis not found" }); return; }

  const segs = await db.select().from(segments)
    .where(eq(segments.analysisId, analysisId)).orderBy(segments.startSec);

  const identified = segs.filter(s => s.status === "identified");
  const lines = identified.map((s, i) => {
    const start = formatTime(s.startSec);
    const end = formatTime(s.endSec);
    return `${i + 1}. ${start} - ${end}  ${s.trackName}`;
  });

  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Content-Disposition", `attachment; filename="${analysis.filename || "tracklist"}.txt"`);
  res.send(lines.join("\n"));
});

// GET /api/analysis/:id/export/mixcloud
analysisRouter.get("/analysis/:id/export/mixcloud", async (req, res) => {
  const analysisId = req.params.id as string;
  const [analysis] = await db.select().from(analyses).where(eq(analyses.id, analysisId)).limit(1);
  if (!analysis) { res.status(404).json({ error: "Analysis not found" }); return; }

  const segs = await db.select().from(segments)
    .where(eq(segments.analysisId, analysisId)).orderBy(segments.startSec);

  const identified = segs.filter(s => s.status === "identified");
  const lines = identified.map(s => `${s.artist} - ${s.title} @ ${formatTime(s.startSec)}`);

  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Content-Disposition", `attachment; filename="${analysis.filename || "tracklist"}_mixcloud.txt"`);
  res.send(lines.join("\n"));
});

// GET /api/analysis/:id/export/soundcloud
analysisRouter.get("/analysis/:id/export/soundcloud", async (req, res) => {
  const analysisId = req.params.id as string;
  const [analysis] = await db.select().from(analyses).where(eq(analyses.id, analysisId)).limit(1);
  if (!analysis) { res.status(404).json({ error: "Analysis not found" }); return; }

  const segs = await db.select().from(segments)
    .where(eq(segments.analysisId, analysisId)).orderBy(segments.startSec);

  const identified = segs.filter(s => s.status === "identified");
  const lines = ["Tracklist:", ...identified.map(s => `${formatTime(s.startSec)} ${s.trackName}`)];

  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Content-Disposition", `attachment; filename="${analysis.filename || "tracklist"}_soundcloud.txt"`);
  res.send(lines.join("\n"));
});

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
