import { Router } from "express";
import { eq } from "drizzle-orm";
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
