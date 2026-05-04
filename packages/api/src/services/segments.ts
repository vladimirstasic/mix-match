import type { ExternalLinks, TrackMatch } from "@mix-match/shared";

export interface SegmentData {
  startSec: number;
  endSec: number;
  status: "identified" | "unknown";
  trackName: string | null;
  artist: string | null;
  title: string | null;
  acrid: string | null;
  bpm: number | null;
  genre: string | null;
  externalLinks: ExternalLinks | null;
}

export function buildSegments(
  aggregatedMatches: TrackMatch[],
  totalDurationSec: number
): SegmentData[] {
  if (aggregatedMatches.length === 0) {
    return [{
      startSec: 0,
      endSec: totalDurationSec,
      status: "unknown",
      trackName: null,
      artist: null,
      title: null,
      acrid: null,
      bpm: null,
      genre: null,
      externalLinks: null,
    }];
  }

  const segments: SegmentData[] = [];
  const toSec = (ts: string) => {
    const [m, s] = ts.split(":").map(Number);
    return m * 60 + s;
  };

  let cursor = 0;

  for (const match of aggregatedMatches) {
    const matchStart = toSec(match.start);
    const matchEnd = toSec(match.end);

    if (matchStart > cursor) {
      segments.push({
        startSec: cursor, endSec: matchStart, status: "unknown",
        trackName: null, artist: null, title: null, acrid: null, bpm: null, genre: null, externalLinks: null,
      });
    }

    const [artist, ...titleParts] = match.track.split(" - ");
    const title = titleParts.join(" - ");

    segments.push({
      startSec: matchStart, endSec: matchEnd, status: "identified",
      trackName: match.track, artist, title, acrid: match.acrid || null,
      bpm: match.bpm ?? null,
      genre: match.genre ?? null,
      externalLinks: match.externalLinks || null,
    });

    cursor = matchEnd;
  }

  if (cursor < totalDurationSec) {
    segments.push({
      startSec: cursor, endSec: totalDurationSec, status: "unknown",
      trackName: null, artist: null, title: null, acrid: null, bpm: null, genre: null, externalLinks: null,
    });
  }

  return segments;
}
