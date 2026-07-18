import { formatTime } from '@mix-match/shared';

interface UnknownSegmentContext {
  id: string;
  status: string;
  startSec: number;
  endSec: number;
  trackName: string | null;
}

// Heuristic, no-LLM-needed explanation for an unknown segment, using neighboring
// identified tracks already in the data — turns a dead-end "Unknown section" into
// a useful hint about what probably happened there.
const BLEND_GAP_SEC = 20;

export function explainUnknownSegment<T extends UnknownSegmentContext>(seg: T, allSegments: T[]): string {
  const idx = allSegments.findIndex(s => s.id === seg.id);
  const prev = idx > 0 ? allSegments[idx - 1] : null;
  const next = idx >= 0 && idx < allSegments.length - 1 ? allSegments[idx + 1] : null;
  const duration = seg.endSec - seg.startSec;

  const prevName = prev?.status === 'identified' ? prev.trackName : null;
  const nextName = next?.status === 'identified' ? next.trackName : null;

  if (duration <= BLEND_GAP_SEC && prevName && nextName) {
    return `Likely a blended transition between "${prevName}" and "${nextName}"`;
  }
  if (prevName && nextName) {
    return `Unidentified for ${formatTime(duration)} between "${prevName}" and "${nextName}" — possibly an unreleased edit or ID track`;
  }
  if (prevName) {
    return `Unidentified for ${formatTime(duration)} after "${prevName}" — possibly an unreleased edit or ID track`;
  }
  return 'Unidentified section — possibly an unreleased edit, mashup, or ID track';
}
