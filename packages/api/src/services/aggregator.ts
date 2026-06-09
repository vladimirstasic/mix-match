import type { RawMatch, TrackMatch } from '@mix-match/shared';
import { CHUNK_DURATION_SEC } from '@mix-match/shared';
import { formatTimestamp } from './ffmpeg.js';

export function normalizeString(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\s+(feat\.?|ft\.?|featuring)\s+.+$/i, '')
    .replace(/,.+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeTrackKey(artist: string, title: string): string {
  return `${normalizeString(artist)}::${normalizeString(title)}`;
}

function spotifyTrackId(url?: string | null): string | null {
  return url?.match(/track\/([a-zA-Z0-9]+)/)?.[1] ?? null;
}

function deezerTrackId(url?: string | null): string | null {
  return url?.match(/track\/(\d+)/)?.[1] ?? null;
}

export function isSameTrack(a: RawMatch, b: RawMatch): boolean {
  if (a.acrid && b.acrid && a.acrid === b.acrid) return true;

  const aSp = spotifyTrackId(a.externalLinks?.spotify);
  const bSp = spotifyTrackId(b.externalLinks?.spotify);
  if (aSp && bSp && aSp === bSp) return true;

  const aDz = deezerTrackId(a.externalLinks?.deezer);
  const bDz = deezerTrackId(b.externalLinks?.deezer);
  if (aDz && bDz && aDz === bDz) return true;

  return normalizeTrackKey(a.artist, a.title) === normalizeTrackKey(b.artist, b.title);
}

function pickRepresentative(matches: RawMatch[]): RawMatch {
  // Highest-scoring match in the group represents it. Falls back to first.
  return [...matches].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
}

/**
 * Compute segment boundaries for an aggregated group of same-track matches.
 *
 * If we have play_offset_ms + duration_ms on at least one match, infer the
 * track's actual playback span in the mix and use that. Otherwise fall back
 * to the chunk-window range (first detection start → last detection end).
 */
function computeBounds(matches: RawMatch[]): { start: number; end: number } {
  const withSpan = matches.find(m => m.playOffsetMs != null && m.durationMs != null);
  if (withSpan) {
    const playOffsetSec = withSpan.playOffsetMs! / 1000;
    const durationSec = withSpan.durationMs! / 1000;
    const start = Math.max(0, withSpan.startSec - playOffsetSec);
    return { start, end: start + durationSec };
  }
  const first = matches[0];
  const last = matches[matches.length - 1];
  return {
    start: first.startSec,
    end: last.startSec + CHUNK_DURATION_SEC,
  };
}

/**
 * Aggregate raw chunk-level matches into timeline segments.
 *
 * Merge logic: classic consecutive-same-track grouping. Walk matches in time
 * order; each new match either extends the current group (if it's the same
 * track as anyone currently in the group) or flushes the current group and
 * starts a new one. This is conservative — DJ playing track A, then B, then
 * A again gives three segments, which is what we want.
 *
 * Segment timestamps come from computeBounds(): when ACRCloud returns
 * play_offset_ms + duration_ms, we show the inferred playback span (e.g.
 * 02:30 — 08:15 for a 5min track); otherwise we fall back to the detection
 * window. The real-track-duration display is the headline UX win without
 * the duplicate-explosion that span-based merging caused on noisy responses.
 */
export function aggregateMatches(raw: RawMatch[]): TrackMatch[] {
  if (raw.length === 0) return [];

  const sorted = [...raw].sort((a, b) => a.startSec - b.startSec);

  const flushed: TrackMatch[] = [];
  let groupMatches: RawMatch[] = [sorted[0]];

  function flush() {
    const rep = pickRepresentative(groupMatches);
    const bounds = computeBounds(groupMatches);
    flushed.push({
      track: `${rep.artist} - ${rep.title}`,
      start: formatTimestamp(bounds.start),
      end: formatTimestamp(bounds.end),
      acrid: rep.acrid,
      bpm: rep.bpm ?? null,
      genre: rep.genre ?? null,
      musicalKey: rep.musicalKey ?? null,
      score: rep.score ?? null,
      externalLinks: rep.externalLinks,
    });
  }

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    if (groupMatches.some(m => isSameTrack(m, next))) {
      groupMatches.push(next);
    } else {
      flush();
      groupMatches = [next];
    }
  }
  flush();

  return flushed;
}
