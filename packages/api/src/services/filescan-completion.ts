import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { analyses, segments as segmentsTable } from '../db/schema.js';
import { aggregateMatches, consolidateTimeline } from './aggregator.js';
import { buildSegments } from './segments.js';
import { mapAndEnrichFileScanResults, type FileScanFile } from './acrcloud-filescan.js';

export async function completeFileScanAnalysis(analysisId: string, file: FileScanFile): Promise<void> {
  const entries = file.results?.music ?? [];
  const matches = await mapAndEnrichFileScanResults(entries);

  const results = consolidateTimeline(aggregateMatches(matches));

  const [row] = await db
    .select({ waveformData: analyses.waveformData })
    .from(analyses)
    .where(eq(analyses.id, analysisId));
  const waveformData = (row?.waveformData as number[] | null) ?? [];
  const totalDurationSec = waveformData.length || Math.ceil(file.duration ?? 0);

  const segmentData = buildSegments(results, totalDurationSec);
  if (segmentData.length > 0) {
    await db.insert(segmentsTable).values(
      segmentData.map(s => ({
        analysisId,
        startSec: s.startSec,
        endSec: s.endSec,
        status: s.status,
        trackName: s.trackName,
        artist: s.artist,
        title: s.title,
        acrid: s.acrid,
        bpm: s.bpm,
        genre: s.genre,
        musicalKey: s.musicalKey,
        confidence: s.confidence,
        externalLinks: s.externalLinks,
        attempts: 1,
      })),
    );
  }

  await db
    .update(analyses)
    .set({
      status: 'completed',
      scanState: file.state,
      results,
      updatedAt: new Date(),
    })
    .where(eq(analyses.id, analysisId));
}

export async function failFileScanAnalysis(analysisId: string, reason: string, scanState?: number): Promise<void> {
  await db
    .update(analyses)
    .set({
      status: 'failed',
      error: reason,
      scanState: scanState ?? null,
      updatedAt: new Date(),
    })
    .where(eq(analyses.id, analysisId));
}
