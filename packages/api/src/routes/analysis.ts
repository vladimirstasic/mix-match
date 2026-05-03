import { Router } from "express";
import { getAuth } from "@clerk/express";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { analyses, segments } from "../db/schema.js";
import fs from "fs/promises";
import { queueEvents, analysisQueue } from "../queue/index.js";

export const analysisRouter = Router();

// GET /api/analysis/compare?a=uuid1&b=uuid2
analysisRouter.get("/analysis/compare", async (req, res) => {
  const idA = req.query.a as string;
  const idB = req.query.b as string;

  if (!idA || !idB) {
    res.status(400).json({ error: "Provide both ?a=id&b=id" });
    return;
  }

  const [analysisA] = await db.select().from(analyses).where(eq(analyses.id, idA)).limit(1);
  const [analysisB] = await db.select().from(analyses).where(eq(analyses.id, idB)).limit(1);

  if (!analysisA || !analysisB) {
    res.status(404).json({ error: "One or both analyses not found" });
    return;
  }

  const segsA = await db.select().from(segments)
    .where(eq(segments.analysisId, idA)).orderBy(segments.startSec);
  const segsB = await db.select().from(segments)
    .where(eq(segments.analysisId, idB)).orderBy(segments.startSec);

  const identifiedA = segsA.filter(s => s.status === "identified");
  const identifiedB = segsB.filter(s => s.status === "identified");

  // Find shared tracks by acrid
  const acridsA = new Set(identifiedA.map(s => s.acrid).filter(Boolean));
  const acridsB = new Set(identifiedB.map(s => s.acrid).filter(Boolean));
  const sharedAcridsArr = [...acridsA].filter(id => acridsB.has(id));
  const sharedAcridsSet = new Set(sharedAcridsArr);

  // Also fuzzy match by normalized artist+title for tracks without matching acrids
  const normalize = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "").replace(/\s+/g, " ").trim();
  const keysA = new Set(identifiedA.map(s => `${normalize(s.artist || "")}::${normalize(s.title || "")}`));
  const keysB = new Set(identifiedB.map(s => `${normalize(s.artist || "")}::${normalize(s.title || "")}`));
  const sharedKeysArr = [...keysA].filter(k => keysB.has(k));
  const sharedKeysSet = new Set(sharedKeysArr);

  // Build shared tracks list (combine acrid + fuzzy matches, deduplicate)
  const sharedTracks: { trackName: string; inA: string; inB: string }[] = [];
  const addedNames = new Set<string>();

  for (const acrid of sharedAcridsArr) {
    const segA = identifiedA.find(s => s.acrid === acrid);
    const segB = identifiedB.find(s => s.acrid === acrid);
    if (segA && segB && segA.trackName) {
      if (!addedNames.has(segA.trackName)) {
        addedNames.add(segA.trackName);
        sharedTracks.push({
          trackName: segA.trackName,
          inA: `${Math.floor(segA.startSec / 60)}:${String(Math.floor(segA.startSec % 60)).padStart(2, "0")}`,
          inB: `${Math.floor(segB.startSec / 60)}:${String(Math.floor(segB.startSec % 60)).padStart(2, "0")}`,
        });
      }
    }
  }

  // Add fuzzy matches not already covered by acrid
  for (const key of sharedKeysArr) {
    const segA = identifiedA.find(s => `${normalize(s.artist || "")}::${normalize(s.title || "")}` === key);
    const segB = identifiedB.find(s => `${normalize(s.artist || "")}::${normalize(s.title || "")}` === key);
    if (segA && segB && segA.trackName && !addedNames.has(segA.trackName)) {
      addedNames.add(segA.trackName);
      sharedTracks.push({
        trackName: segA.trackName,
        inA: `${Math.floor(segA.startSec / 60)}:${String(Math.floor(segA.startSec % 60)).padStart(2, "0")}`,
        inB: `${Math.floor(segB.startSec / 60)}:${String(Math.floor(segB.startSec % 60)).padStart(2, "0")}`,
      });
    }
  }

  res.json({
    mixA: { id: idA, filename: analysisA.filename, totalTracks: identifiedA.length },
    mixB: { id: idB, filename: analysisB.filename, totalTracks: identifiedB.length },
    sharedTracks,
    uniqueToA: identifiedA.filter(s => !sharedAcridsSet.has(s.acrid!) && !sharedKeysSet.has(`${normalize(s.artist || "")}::${normalize(s.title || "")}`)).length,
    uniqueToB: identifiedB.filter(s => !sharedAcridsSet.has(s.acrid!) && !sharedKeysSet.has(`${normalize(s.artist || "")}::${normalize(s.title || "")}`)).length,
  });
});

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

// POST /api/analysis/:id/export/spotify-playlist
analysisRouter.post("/analysis/:id/export/spotify-playlist", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const analysisId = req.params.id as string;
  const [analysis] = await db.select().from(analyses).where(eq(analyses.id, analysisId)).limit(1);
  if (!analysis) { res.status(404).json({ error: "Analysis not found" }); return; }

  const segs = await db.select().from(segments)
    .where(eq(segments.analysisId, analysisId)).orderBy(segments.startSec);

  const identified = segs.filter(s => s.status === "identified" && s.externalLinks);

  // Extract Spotify track URIs
  const trackUris: string[] = [];
  for (const seg of identified) {
    const links = seg.externalLinks as Record<string, string> | null;
    if (links?.spotify) {
      const match = links.spotify.match(/track\/([a-zA-Z0-9]+)/);
      if (match) trackUris.push(`spotify:track:${match[1]}`);
    }
  }

  if (trackUris.length === 0) {
    res.status(400).json({ error: "No tracks with Spotify links found" });
    return;
  }

  // Remove duplicates
  const uniqueUris = [...new Set(trackUris)];

  res.json({
    playlistName: analysis.filename || "MixMatch Tracklist",
    trackCount: uniqueUris.length,
    spotifyUris: uniqueUris,
  });
});

// GET /api/analysis/:id/export/youtube
analysisRouter.get("/analysis/:id/export/youtube", async (req, res) => {
  const analysisId = req.params.id as string;
  const [analysis] = await db.select().from(analyses).where(eq(analyses.id, analysisId)).limit(1);
  if (!analysis) { res.status(404).json({ error: "Analysis not found" }); return; }

  const segs = await db.select().from(segments)
    .where(eq(segments.analysisId, analysisId)).orderBy(segments.startSec);

  const identified = segs.filter(s => s.status === "identified");
  const lines = identified.map(s => `${formatTime(s.startSec)} ${s.trackName}`);

  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Content-Disposition", `attachment; filename="${analysis.filename || "tracklist"}_youtube.txt"`);
  res.send(lines.join("\n"));
});

// PATCH /api/analysis/:id — update metadata (is_public, slug)
analysisRouter.patch("/analysis/:id", async (req, res) => {
  const { userId } = getAuth(req);
  const analysisId = req.params.id as string;
  const { isPublic, slug } = req.body;

  const [analysis] = await db.select().from(analyses).where(eq(analyses.id, analysisId)).limit(1);
  if (!analysis) { res.status(404).json({ error: "Analysis not found" }); return; }
  if (analysis.userId && analysis.userId !== userId) { res.status(403).json({ error: "Not authorized" }); return; }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (isPublic !== undefined) updates.isPublic = isPublic;
  if (slug !== undefined) updates.slug = slug;

  await db.update(analyses).set(updates).where(eq(analyses.id, analysisId));

  const [updated] = await db.select().from(analyses).where(eq(analyses.id, analysisId)).limit(1);
  res.json(updated);
});

// GET /api/t/:slug — public tracklist (no auth required)
analysisRouter.get("/t/:slug", async (req, res) => {
  const slug = req.params.slug as string;

  const [analysis] = await db.select().from(analyses).where(eq(analyses.slug, slug)).limit(1);
  if (!analysis || !analysis.isPublic) { res.status(404).json({ error: "Not found" }); return; }

  const segs = await db.select().from(segments)
    .where(eq(segments.analysisId, analysis.id)).orderBy(segments.startSec);

  res.json({
    filename: analysis.filename,
    segments: segs.filter(s => s.status === "identified"),
    createdAt: analysis.createdAt,
  });
});

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
