import type { RawMatch, TrackMatch } from '@mix-match/shared';
import { CHUNK_DURATION_SEC, CONSOLIDATE_GAP_WINDOW_SEC } from '@mix-match/shared';
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
  const counts = new Map<string, number>();
  for (const m of matches) {
    counts.set(m.acrid, (counts.get(m.acrid) || 0) + 1);
  }
  let bestAcrid = matches[0].acrid;
  let bestCount = 0;
  for (const [acrid, count] of counts) {
    if (count > bestCount) {
      bestAcrid = acrid;
      bestCount = count;
    }
  }
  return matches.find(m => m.acrid === bestAcrid) || matches[0];
}

export function aggregateMatches(raw: RawMatch[]): TrackMatch[] {
  if (raw.length === 0) return [];

  const sorted = [...raw].sort((a, b) => a.startSec - b.startSec);

  const timeline: TrackMatch[] = [];
  let groupMatches: RawMatch[] = [sorted[0]];
  let groupStart = sorted[0].startSec;
  let groupEnd = sorted[0].startSec + CHUNK_DURATION_SEC;

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    if (groupMatches.some(m => isSameTrack(m, next))) {
      groupMatches.push(next);
      groupEnd = next.startSec + CHUNK_DURATION_SEC;
    } else {
      const rep = pickRepresentative(groupMatches);
      timeline.push({
        track: `${rep.artist} - ${rep.title}`,
        start: formatTimestamp(groupStart),
        end: formatTimestamp(groupEnd),
        acrid: rep.acrid,
        bpm: rep.bpm ?? null,
        genre: rep.genre ?? null,
        musicalKey: rep.musicalKey ?? null,
        score: rep.score ?? null,
        externalLinks: rep.externalLinks,
      });
      groupMatches = [next];
      groupStart = next.startSec;
      groupEnd = next.startSec + CHUNK_DURATION_SEC;
    }
  }

  const rep = pickRepresentative(groupMatches);
  timeline.push({
    track: `${rep.artist} - ${rep.title}`,
    start: formatTimestamp(groupStart),
    end: formatTimestamp(groupEnd),
    acrid: rep.acrid,
    bpm: rep.bpm ?? null,
    genre: rep.genre ?? null,
    musicalKey: rep.musicalKey ?? null,
    score: rep.score ?? null,
    externalLinks: rep.externalLinks,
  });

  return timeline;
}

/**
 * Loose key for comparing two "Artist - Title" display strings as the same
 * track despite cosmetic metadata differences across ACRCloud chunks:
 *   - separator drift: "Presi On, Spijker" vs "Presi On/Spijker"
 *   - mix-suffix drift: "Day After Day" vs "Day After Day - Extended Mix"
 *   - parenthetical/bracket tags: "(Extended Mix)", "(Original Mix)", "[...]"
 *
 * Lowercases, drops parens/brackets, flattens , / & separators to spaces,
 * strips trailing "extended/original mix|edit|version" tokens, collapses
 * whitespace. "Remix" is preserved (it denotes a genuinely different track).
 */
export function looseTrackKey(track: string): string {
  return (
    track
      .toLowerCase()
      // strip cosmetic mix tags (parenthesised) — but NOT "(... remix)" / "(feat ...)"
      .replace(/\(\s*(extended mix|original mix|extended|original|edit|radio edit|club mix|vocal mix|mix)\s*\)/g, ' ')
      .replace(/\[.*?\]/g, ' ')
      // bare trailing "... extended mix" / "original mix" tokens (not in parens)
      .replace(/\b(extended|original)\s+mix\b/g, ' ')
      .replace(/\bextended\b/g, ' ')
      .replace(/[/&,]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\s*-\s*$/, '')
      .trim()
  );
}

function segmentSpotifyId(s: TrackMatch): string | null {
  return s.externalLinks?.spotify?.match(/track\/([a-zA-Z0-9]+)/)?.[1] ?? null;
}

export function segmentsAreSameTrack(a: TrackMatch, b: TrackMatch): boolean {
  if (a.acrid && b.acrid && a.acrid === b.acrid) return true;
  const aSp = segmentSpotifyId(a);
  const bSp = segmentSpotifyId(b);
  if (aSp && bSp && aSp === bSp) return true;
  return looseTrackKey(a.track) === looseTrackKey(b.track);
}

function parseTimestamp(ts: string): number {
  const parts = ts.split(':').map(Number);
  // Supports mm:ss and the rare h:mm:ss; here timestamps are always mm:ss
  // (minutes can exceed 60, e.g. "113:00"), so treat as [minutes, seconds].
  const [m, sec] = parts;
  return (m || 0) * 60 + (sec || 0);
}

/**
 * Consolidate a timeline so the same track detected multiple times within a
 * short window collapses into one segment — even when spurious detections of
 * OTHER tracks were interleaved between the detections.
 *
 * For each segment we scan backwards through already-emitted segments and
 * merge into the most recent SAME-track segment whose end is within
 * `gapWindowSec` of the current segment's start. Scanning stops once the gap
 * exceeds the window, so a genuine replay of the same track much later in the
 * set (e.g. an intro track reprised near the end) stays a separate segment.
 */
export function consolidateTimeline(
  segments: TrackMatch[],
  gapWindowSec: number = CONSOLIDATE_GAP_WINDOW_SEC,
): TrackMatch[] {
  const out: TrackMatch[] = [];
  for (const seg of segments) {
    const segStart = parseTimestamp(seg.start);

    let mergeInto = -1;
    for (let i = out.length - 1; i >= 0; i--) {
      const cand = out[i];
      const gap = segStart - parseTimestamp(cand.end);
      if (gap > gapWindowSec) continue; // out of window — keep scanning older segments
      if (segmentsAreSameTrack(cand, seg)) {
        mergeInto = i;
        break;
      }
    }

    if (mergeInto >= 0) {
      const target = out[mergeInto];
      if (parseTimestamp(seg.end) > parseTimestamp(target.end)) target.end = seg.end;
      if ((seg.score ?? 0) > (target.score ?? 0)) {
        const start = target.start;
        Object.assign(target, seg);
        target.start = start;
      }
      continue;
    }
    out.push({ ...seg });
  }
  return out;
}
