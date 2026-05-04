import { Router } from 'express';
import { requireUser, getUserId } from '../middleware/auth.js';
import { formatTime } from '@mix-match/shared';
import { findAnalysis, getAnalysisSegments } from '../db/helpers.js';

export const exportRouter = Router();

// GET /api/analysis/:id/export/text
exportRouter.get('/analysis/:id/export/text', requireUser, async (req, res) => {
  const analysisId = req.params.id as string;
  const analysis = await findAnalysis(analysisId);
  if (!analysis) {
    res.status(404).json({ error: 'Analysis not found' });
    return;
  }

  const segs = await getAnalysisSegments(analysisId);

  const identified = segs.filter(s => s.status === 'identified');
  const lines = identified.map((s, i) => {
    const start = formatTime(s.startSec);
    const end = formatTime(s.endSec);
    return `${i + 1}. ${start} - ${end}  ${s.trackName}`;
  });

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', `attachment; filename="${analysis.filename || 'tracklist'}.txt"`);
  res.send(lines.join('\n'));
});

// GET /api/analysis/:id/export/mixcloud
exportRouter.get('/analysis/:id/export/mixcloud', requireUser, async (req, res) => {
  const analysisId = req.params.id as string;
  const analysis = await findAnalysis(analysisId);
  if (!analysis) {
    res.status(404).json({ error: 'Analysis not found' });
    return;
  }

  const segs = await getAnalysisSegments(analysisId);

  const identified = segs.filter(s => s.status === 'identified');
  const lines = identified.map(s => `${s.artist} - ${s.title} @ ${formatTime(s.startSec)}`);

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', `attachment; filename="${analysis.filename || 'tracklist'}_mixcloud.txt"`);
  res.send(lines.join('\n'));
});

// GET /api/analysis/:id/export/soundcloud
exportRouter.get('/analysis/:id/export/soundcloud', requireUser, async (req, res) => {
  const analysisId = req.params.id as string;
  const analysis = await findAnalysis(analysisId);
  if (!analysis) {
    res.status(404).json({ error: 'Analysis not found' });
    return;
  }

  const segs = await getAnalysisSegments(analysisId);

  const identified = segs.filter(s => s.status === 'identified');
  const lines = ['Tracklist:', ...identified.map(s => `${formatTime(s.startSec)} ${s.trackName}`)];

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', `attachment; filename="${analysis.filename || 'tracklist'}_soundcloud.txt"`);
  res.send(lines.join('\n'));
});

// POST /api/analysis/:id/export/spotify-playlist
exportRouter.post('/analysis/:id/export/spotify-playlist', requireUser, async (req, res) => {
  const userId = getUserId(req);

  const analysisId = req.params.id as string;
  const analysis = await findAnalysis(analysisId);
  if (!analysis) {
    res.status(404).json({ error: 'Analysis not found' });
    return;
  }

  const segs = await getAnalysisSegments(analysisId);

  const identified = segs.filter(s => s.status === 'identified' && s.externalLinks);

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
    res.status(400).json({ error: 'No tracks with Spotify links found' });
    return;
  }

  // Remove duplicates
  const uniqueUris = [...new Set(trackUris)];

  res.json({
    playlistName: analysis.filename || 'MixMatch Tracklist',
    trackCount: uniqueUris.length,
    spotifyUris: uniqueUris,
  });
});

// GET /api/analysis/:id/export/youtube
exportRouter.get('/analysis/:id/export/youtube', requireUser, async (req, res) => {
  const analysisId = req.params.id as string;
  const analysis = await findAnalysis(analysisId);
  if (!analysis) {
    res.status(404).json({ error: 'Analysis not found' });
    return;
  }

  const segs = await getAnalysisSegments(analysisId);

  const identified = segs.filter(s => s.status === 'identified');
  const lines = identified.map(s => `${formatTime(s.startSec)} ${s.trackName}`);

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', `attachment; filename="${analysis.filename || 'tracklist'}_youtube.txt"`);
  res.send(lines.join('\n'));
});
