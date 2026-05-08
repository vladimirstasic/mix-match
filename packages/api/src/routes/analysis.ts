import { Router } from 'express';

import { eq, and, sql } from 'drizzle-orm';
import { requireUser, getUserId } from '../middleware/auth.js';
import { normalizeString } from '../services/aggregator.js';
import { db } from '../db/client.js';
import { analyses, segments, users } from '../db/schema.js';
import { findAnalysis, findSegment, getAnalysisSegments } from '../db/helpers.js';
import fs from 'fs/promises';
import path from 'path';
import { queueEvents, analysisQueue } from '../queue/index.js';

export const analysisRouter = Router();

// GET /api/analysis/compare?a=uuid1&b=uuid2
analysisRouter.get('/analysis/compare', requireUser, async (req, res) => {
  const idA = req.query.a as string;
  const idB = req.query.b as string;

  if (!idA || !idB) {
    res.status(400).json({ error: 'Provide both ?a=id&b=id' });
    return;
  }

  const analysisA = await findAnalysis(idA);
  const analysisB = await findAnalysis(idB);

  if (!analysisA || !analysisB) {
    res.status(404).json({ error: 'One or both analyses not found' });
    return;
  }

  const segsA = await getAnalysisSegments(idA);
  const segsB = await getAnalysisSegments(idB);

  const identifiedA = segsA.filter(s => s.status === 'identified');
  const identifiedB = segsB.filter(s => s.status === 'identified');

  // Find shared tracks by acrid
  const acridsA = new Set(identifiedA.map(s => s.acrid).filter(Boolean));
  const acridsB = new Set(identifiedB.map(s => s.acrid).filter(Boolean));
  const sharedAcridsArr = [...acridsA].filter(id => acridsB.has(id));
  const sharedAcridsSet = new Set(sharedAcridsArr);

  // Also fuzzy match by normalized artist+title for tracks without matching acrids
  const keysA = new Set(identifiedA.map(s => `${normalizeString(s.artist || '')}::${normalizeString(s.title || '')}`));
  const keysB = new Set(identifiedB.map(s => `${normalizeString(s.artist || '')}::${normalizeString(s.title || '')}`));
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
          inA: `${Math.floor(segA.startSec / 60)}:${String(Math.floor(segA.startSec % 60)).padStart(2, '0')}`,
          inB: `${Math.floor(segB.startSec / 60)}:${String(Math.floor(segB.startSec % 60)).padStart(2, '0')}`,
        });
      }
    }
  }

  // Add fuzzy matches not already covered by acrid
  for (const key of sharedKeysArr) {
    const segA = identifiedA.find(s => `${normalizeString(s.artist || '')}::${normalizeString(s.title || '')}` === key);
    const segB = identifiedB.find(s => `${normalizeString(s.artist || '')}::${normalizeString(s.title || '')}` === key);
    if (segA && segB && segA.trackName && !addedNames.has(segA.trackName)) {
      addedNames.add(segA.trackName);
      sharedTracks.push({
        trackName: segA.trackName,
        inA: `${Math.floor(segA.startSec / 60)}:${String(Math.floor(segA.startSec % 60)).padStart(2, '0')}`,
        inB: `${Math.floor(segB.startSec / 60)}:${String(Math.floor(segB.startSec % 60)).padStart(2, '0')}`,
      });
    }
  }

  res.json({
    mixA: { id: idA, filename: analysisA.filename, totalTracks: identifiedA.length },
    mixB: { id: idB, filename: analysisB.filename, totalTracks: identifiedB.length },
    sharedTracks,
    uniqueToA: identifiedA.filter(
      s =>
        !sharedAcridsSet.has(s.acrid!) &&
        !sharedKeysSet.has(`${normalizeString(s.artist || '')}::${normalizeString(s.title || '')}`),
    ).length,
    uniqueToB: identifiedB.filter(
      s =>
        !sharedAcridsSet.has(s.acrid!) &&
        !sharedKeysSet.has(`${normalizeString(s.artist || '')}::${normalizeString(s.title || '')}`),
    ).length,
  });
});

// POST /api/analysis/manual — create tracklist from manual input
analysisRouter.post('/analysis/manual', requireUser, async (req, res) => {
  const userId = getUserId(req);

  const { title, tracks } = req.body;
  // tracks: [{ trackName: string, artist: string, title: string, startSec: number, endSec: number }]

  if (!title || !Array.isArray(tracks) || tracks.length === 0) {
    res.status(400).json({ error: 'Title and at least one track required' });
    return;
  }

  await db.insert(users).values({ clerkId: userId }).onConflictDoNothing();

  const [analysis] = await db
    .insert(analyses)
    .values({
      filename: title,
      fileSize: 0,
      status: 'completed',
      userId,
    })
    .returning({ id: analyses.id });

  await db.insert(segments).values(
    tracks.map((t: any) => ({
      analysisId: analysis.id,
      startSec: t.startSec || 0,
      endSec: t.endSec || 0,
      status: 'identified',
      trackName: t.trackName || `${t.artist} - ${t.title}`,
      artist: t.artist || null,
      title: t.title || null,
      acrid: null,
      attempts: 1,
    })),
  );

  res.json({ analysisId: analysis.id });
});

// GET /api/analysis/:id/summary — generate mix summary
analysisRouter.get('/analysis/:id/summary', requireUser, async (req, res) => {
  const analysisId = req.params.id as string;
  const analysis = await findAnalysis(analysisId);
  if (!analysis) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const segs = await getAnalysisSegments(analysisId);

  const identified = segs.filter(s => s.status === 'identified');
  const unknown = segs.filter(s => s.status === 'unknown');
  const totalDuration = segs.length > 0 ? Math.max(...segs.map(s => s.endSec)) : 0;

  // Unique artists
  const artists = [...new Set(identified.map(s => s.artist).filter(Boolean))];

  // Unique tracks
  const uniqueTracks = [...new Set(identified.map(s => s.acrid).filter(Boolean))];

  // Most featured artist
  const artistCounts = new Map<string, number>();
  identified.forEach(s => {
    if (s.artist) artistCounts.set(s.artist, (artistCounts.get(s.artist) || 0) + 1);
  });
  const topArtist = [...artistCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  // Coverage
  const identifiedDuration = identified.reduce((sum, s) => sum + (s.endSec - s.startSec), 0);
  const coveragePercent = totalDuration > 0 ? Math.round((identifiedDuration / totalDuration) * 100) : 0;

  // Generate text summary
  const durationMin = Math.round(totalDuration / 60);
  let summary = `${durationMin} minute mix with ${uniqueTracks.length} identified track${uniqueTracks.length !== 1 ? 's' : ''}`;
  summary += ` from ${artists.length} artist${artists.length !== 1 ? 's' : ''}.`;

  if (topArtist && topArtist[1] > 1) {
    summary += ` Most featured: ${topArtist[0]} (${topArtist[1]} segments).`;
  }

  summary += ` ${coveragePercent}% of the mix was identified.`;

  if (unknown.length > 0) {
    summary += ` ${unknown.length} section${unknown.length !== 1 ? 's' : ''} remain unidentified.`;
  }

  res.json({
    summary,
    stats: {
      durationMin,
      totalTracks: uniqueTracks.length,
      totalArtists: artists.length,
      coveragePercent,
      topArtist: topArtist ? { name: topArtist[0], segments: topArtist[1] } : null,
      unknownSections: unknown.length,
    },
    artists,
  });
});

// GET /api/analysis/:id — poll result
analysisRouter.get('/analysis/:id', requireUser, async (req, res) => {
  const analysis = await findAnalysis(req.params.id);

  if (!analysis) {
    res.status(404).json({ error: 'Analysis not found' });
    return;
  }

  const userId = req.userId;
  if (analysis.userId && analysis.userId !== userId) {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }

  const segs = await getAnalysisSegments(req.params.id);

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
analysisRouter.get('/analysis/:id/progress', async (req, res) => {
  const analysis = await findAnalysis(req.params.id);

  if (!analysis) {
    res.status(404).json({ error: 'Analysis not found' });
    return;
  }

  // If already done, send result immediately
  if (analysis.status === 'completed' || analysis.status === 'failed') {
    res.json(analysis);
    return;
  }

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const send = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const onProgress = ({ jobId, data }: { jobId: string; data: unknown }) => {
    const progress = data as Record<string, unknown>;
    if (progress.analysisId === req.params.id) {
      send({ type: 'progress', ...progress });
    }
  };

  const onCompleted = async ({ jobId }: { jobId: string }) => {
    const job = await analysisQueue.getJob(jobId);
    if (job?.data.analysisId === req.params.id) {
      const updated = await findAnalysis(req.params.id);
      send({ type: 'completed', results: updated!.results });
      cleanup();
      res.end();
    }
  };

  const onFailed = async ({ jobId, failedReason }: { jobId: string; failedReason: string }) => {
    const job = await analysisQueue.getJob(jobId);
    if (job?.data.analysisId === req.params.id) {
      send({ type: 'failed', error: failedReason });
      cleanup();
      res.end();
    }
  };

  const cleanup = () => {
    queueEvents.off('progress', onProgress);
    queueEvents.off('completed', onCompleted);
    queueEvents.off('failed', onFailed);
  };

  queueEvents.on('progress', onProgress);
  queueEvents.on('completed', onCompleted);
  queueEvents.on('failed', onFailed);

  req.on('close', cleanup);
});

// PATCH /api/analysis/:id/segments/:segId — manual track edit
analysisRouter.patch('/analysis/:id/segments/:segId', async (req, res) => {
  const userId = req.userId;
  const analysisId = req.params.id as string;
  const segId = req.params.segId as string;
  const { trackName, artist, title } = req.body;

  if (!trackName && !artist && !title) {
    res.status(400).json({ error: 'Provide trackName, artist, or title' });
    return;
  }

  // Verify ownership
  const analysis = await findAnalysis(analysisId);
  if (!analysis) {
    res.status(404).json({ error: 'Analysis not found' });
    return;
  }
  if (analysis.userId && analysis.userId !== userId) {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }

  // Verify segment belongs to this analysis
  const [segment] = await db
    .select()
    .from(segments)
    .where(and(eq(segments.id, segId), eq(segments.analysisId, analysisId)))
    .limit(1);
  if (!segment) {
    res.status(404).json({ error: 'Segment not found' });
    return;
  }

  // Build update - if only trackName provided, parse artist/title from it
  const finalArtist = artist || (trackName ? trackName.split(' - ')[0] : segment.artist);
  const finalTitle = title || (trackName ? trackName.split(' - ').slice(1).join(' - ') : segment.title);
  const finalTrackName = trackName || `${finalArtist} - ${finalTitle}`;

  await db
    .update(segments)
    .set({
      trackName: finalTrackName,
      artist: finalArtist,
      title: finalTitle,
      status: 'identified',
      updatedAt: new Date(),
    })
    .where(eq(segments.id, segId));

  const updated = await findSegment(segId);
  res.json(updated);
});

// PATCH /api/analysis/:id — update metadata (is_public, slug)
analysisRouter.patch('/analysis/:id', requireUser, async (req, res) => {
  const userId = req.userId;
  const analysisId = req.params.id as string;
  const { isPublic, slug } = req.body;

  const analysis = await findAnalysis(analysisId);
  if (!analysis) {
    res.status(404).json({ error: 'Analysis not found' });
    return;
  }
  if (analysis.userId && analysis.userId !== userId) {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (isPublic !== undefined) updates.isPublic = isPublic;
  if (slug !== undefined || isPublic) {
    // Generate slug server-side — ignore any client-provided value
    const crypto = await import('crypto');
    updates.slug = crypto.randomBytes(6).toString('hex');
  }

  await db.update(analyses).set(updates).where(eq(analyses.id, analysisId));

  const updated = await findAnalysis(analysisId);
  res.json(updated);
});

// DELETE /api/analysis/:id
analysisRouter.delete('/analysis/:id', requireUser, async (req, res) => {
  const userId = req.userId;
  const analysisId = req.params.id as string;

  const analysis = await findAnalysis(analysisId);
  if (!analysis) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (analysis.userId && analysis.userId !== userId) {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }

  // Delete chunks directory if it exists
  if (analysis.chunksDir) {
    await fs.rm(analysis.chunksDir, { recursive: true, force: true }).catch(() => {});
    await fs.rmdir(path.dirname(analysis.chunksDir)).catch(() => {});
  }

  // Cascade delete handles segments
  await db.delete(analyses).where(eq(analyses.id, analysisId));

  res.json({ ok: true });
});

// GET /api/t/:slug/og — returns HTML with OG meta tags for social sharing
analysisRouter.get('/t/:slug/og', async (req, res) => {
  const slug = req.params.slug as string;
  const [analysis] = await db.select().from(analyses).where(eq(analyses.slug, slug)).limit(1);
  if (!analysis || !analysis.isPublic) {
    res.status(404).send('Not found');
    return;
  }

  const segs = await getAnalysisSegments(analysis.id);
  const identified = segs.filter(s => s.status === 'identified');

  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const title = esc(`${analysis.filename} — MixMatch`);
  const description = esc(
    identified.length > 0
      ? `${identified.length} tracks: ${identified
          .slice(0, 3)
          .map(s => s.trackName)
          .join(', ')}${identified.length > 3 ? '...' : ''}`
      : 'Tracklist identified by MixMatch',
  );
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const publicUrl = `${frontendUrl}/t/${encodeURIComponent(slug)}`;

  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:type" content="music.playlist" />
  <meta property="og:url" content="${publicUrl}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
</head>
<body>
  <h1>${title}</h1>
  <ul>${identified.map(s => `<li>${esc(s.trackName || 'Unknown')}</li>`).join('')}</ul>
  <p><a href="${publicUrl}">View on MixMatch</a></p>
</body>
</html>`);
});

// GET /api/t/:slug — public tracklist (no auth required)
analysisRouter.get('/t/:slug', async (req, res) => {
  const slug = req.params.slug as string;

  const [analysis] = await db.select().from(analyses).where(eq(analyses.slug, slug)).limit(1);
  if (!analysis || !analysis.isPublic) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const segs = await getAnalysisSegments(analysis.id);

  // Increment view count
  await db
    .update(analyses)
    .set({ viewCount: sql`${analyses.viewCount} + 1` })
    .where(eq(analyses.id, analysis.id));

  res.json({
    filename: analysis.filename,
    segments: segs.filter(s => s.status === 'identified'),
    createdAt: analysis.createdAt,
  });
});

// GET /api/analysis/:id/recommendations
analysisRouter.get('/analysis/:id/recommendations', async (req, res) => {
  const analysisId = req.params.id as string;
  const analysis = await findAnalysis(analysisId);
  if (!analysis) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const segs = await getAnalysisSegments(analysisId);

  const identified = segs.filter(s => s.status === 'identified');

  // Artist frequency
  const artistFreq = new Map<string, { count: number; tracks: string[] }>();
  identified.forEach(s => {
    if (!s.artist) return;
    const entry = artistFreq.get(s.artist) || { count: 0, tracks: [] };
    entry.count++;
    if (!entry.tracks.includes(s.title || '')) entry.tracks.push(s.title || '');
    artistFreq.set(s.artist, entry);
  });

  const topArtists = [...artistFreq.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([name, data]) => ({ name, count: data.count, tracks: data.tracks }));

  // Unique tracks with Spotify links for discovery
  const tracksWithLinks = identified
    .filter(s => s.externalLinks && (s.externalLinks as Record<string, string>).spotify)
    .reduce(
      (acc, s) => {
        if (!acc.find(t => t.acrid === s.acrid)) {
          acc.push({
            trackName: s.trackName,
            artist: s.artist,
            acrid: s.acrid,
            spotifyUrl: (s.externalLinks as Record<string, string>).spotify,
          });
        }
        return acc;
      },
      [] as { trackName: string | null; artist: string | null; acrid: string | null; spotifyUrl: string }[],
    );

  res.json({
    topArtists,
    tracksWithSpotify: tracksWithLinks,
    totalIdentified: identified.length,
  });
});
