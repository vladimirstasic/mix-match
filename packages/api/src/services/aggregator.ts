import type { RawMatch, TrackMatch } from "@mix-match/shared";
import { CHUNK_DURATION_SEC } from "@mix-match/shared";
import { formatTimestamp } from "./ffmpeg.js";

export function normalizeString(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTrackKey(artist: string, title: string): string {
  return `${normalizeString(artist)}::${normalizeString(title)}`;
}

export function isSameTrack(a: RawMatch, b: RawMatch): boolean {
  if (a.acrid && b.acrid && a.acrid === b.acrid) return true;
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
  return matches.find((m) => m.acrid === bestAcrid) || matches[0];
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

    if (isSameTrack(groupMatches[groupMatches.length - 1], next)) {
      groupMatches.push(next);
      groupEnd = next.startSec + CHUNK_DURATION_SEC;
    } else {
      const rep = pickRepresentative(groupMatches);
      timeline.push({
        track: `${rep.artist} - ${rep.title}`,
        start: formatTimestamp(groupStart),
        end: formatTimestamp(groupEnd),
        acrid: rep.acrid,
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
  });

  return timeline;
}
