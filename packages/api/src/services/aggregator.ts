import type { RawMatch, TrackMatch } from "@mix-detective/shared";
import { CHUNK_DURATION_SEC } from "@mix-detective/shared";
import { formatTimestamp } from "./ffmpeg.js";

export function aggregateMatches(raw: RawMatch[]): TrackMatch[] {
  if (raw.length === 0) return [];

  const sorted = [...raw].sort((a, b) => a.startSec - b.startSec);

  const timeline: TrackMatch[] = [];
  let current = sorted[0];
  let groupStart = current.startSec;
  let groupEnd = current.startSec + CHUNK_DURATION_SEC;

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    const sameTrack = next.artist === current.artist && next.title === current.title;

    if (sameTrack) {
      groupEnd = next.startSec + CHUNK_DURATION_SEC;
    } else {
      timeline.push({
        track: `${current.artist} - ${current.title}`,
        start: formatTimestamp(groupStart),
        end: formatTimestamp(groupEnd),
      });
      current = next;
      groupStart = next.startSec;
      groupEnd = next.startSec + CHUNK_DURATION_SEC;
    }
  }

  timeline.push({
    track: `${current.artist} - ${current.title}`,
    start: formatTimestamp(groupStart),
    end: formatTimestamp(groupEnd),
  });

  return timeline;
}
