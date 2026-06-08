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
  // Pick the match with the highest score; falls back to most-frequent acrid.
  return [...matches].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
}

interface Span {
  start: number;
  end: number;
}

/**
 * Estimate where the track actually plays in the mix (inferred boundaries),
 * using ACRCloud's play_offset_ms + duration_ms. Falls back to a chunk-sized
 * window centered on the detection point if either is missing.
 */
function inferSpan(match: RawMatch): Span {
  const startSec = match.startSec;
  if (match.playOffsetMs == null || match.durationMs == null) {
    return { start: startSec, end: startSec + CHUNK_DURATION_SEC };
  }
  const playOffsetSec = match.playOffsetMs / 1000;
  const durationSec = match.durationMs / 1000;
  const inferredStart = Math.max(0, startSec - playOffsetSec);
  return { start: inferredStart, end: inferredStart + durationSec };
}

function spansOverlap(a: Span, b: Span, toleranceSec = 30): boolean {
  return a.start <= b.end + toleranceSec && b.start <= a.end + toleranceSec;
}

interface Group {
  matches: RawMatch[];
  span: Span;
}

/**
 * Aggregate raw chunk-level matches into timeline segments.
 *
 * Two key improvements over plain consecutive grouping:
 *
 * 1. Inferred playback span per match — uses ACRCloud's play_offset_ms +
 *    duration_ms so the segment shows the actual track duration in the mix,
 *    not just the detection window of a single chunk. Falls back to the
 *    chunk window if those fields are missing.
 *
 * 2. Same-track merge by overlap, not just consecutive position — if the
 *    same track was detected twice in the mix and the inferred spans
 *    overlap (or fall within a 30s tolerance), they're treated as the
 *    SAME play and merged. If the spans are far apart, they're kept as
 *    separate plays (DJ played the track twice).
 */
export function aggregateMatches(raw: RawMatch[]): TrackMatch[] {
  if (raw.length === 0) return [];

  const sorted = [...raw].sort((a, b) => a.startSec - b.startSec);
  const groups: Group[] = [];

  for (const m of sorted) {
    const span = inferSpan(m);

    const idx = groups.findIndex(g => g.matches.some(gm => isSameTrack(gm, m)) && spansOverlap(g.span, span));

    if (idx >= 0) {
      groups[idx].matches.push(m);
      groups[idx].span = {
        start: Math.min(groups[idx].span.start, span.start),
        end: Math.max(groups[idx].span.end, span.end),
      };
    } else {
      groups.push({ matches: [m], span });
    }
  }

  groups.sort((a, b) => a.span.start - b.span.start);

  return groups.map(g => {
    const rep = pickRepresentative(g.matches);
    return {
      track: `${rep.artist} - ${rep.title}`,
      start: formatTimestamp(g.span.start),
      end: formatTimestamp(g.span.end),
      acrid: rep.acrid,
      bpm: rep.bpm ?? null,
      genre: rep.genre ?? null,
      musicalKey: rep.musicalKey ?? null,
      score: rep.score ?? null,
      externalLinks: rep.externalLinks,
    };
  });
}
