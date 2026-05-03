import type { Segment } from "@mix-match/shared";

interface Props {
  segments: Segment[];
  totalDuration: number; // in seconds
  onSegmentClick?: (segmentId: string) => void;
}

export function Waveform({ segments, totalDuration, onSegmentClick }: Props) {
  if (totalDuration <= 0) return null;

  // Generate pseudo-random heights for visual interest (deterministic based on position)
  const barCount = Math.min(200, Math.floor(totalDuration / 2));
  const bars = Array.from({ length: barCount }, (_, i) => {
    const seed = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    return 0.3 + (seed - Math.floor(seed)) * 0.7; // height between 0.3 and 1.0
  });

  const getSegmentAt = (seconds: number) => {
    return segments.find(s => seconds >= s.startSec && seconds < s.endSec);
  };

  const getBarColor = (segment: Segment | undefined) => {
    if (!segment) return "bg-muted-foreground/20";
    if (segment.status === "identified") return "bg-primary";
    if (segment.status === "retrying") return "bg-yellow-500";
    return "bg-muted-foreground/30";
  };

  return (
    <div className="w-full">
      <div className="flex items-end gap-[1px] h-16 w-full">
        {bars.map((height, i) => {
          const seconds = (i / barCount) * totalDuration;
          const segment = getSegmentAt(seconds);
          const color = getBarColor(segment);

          return (
            <div
              key={i}
              className={`flex-1 rounded-sm transition-colors cursor-pointer hover:opacity-80 ${color}`}
              style={{ height: `${height * 100}%` }}
              title={segment?.trackName || `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`}
              onClick={() => segment && onSegmentClick?.(segment.id)}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs text-muted-foreground">0:00</span>
        <span className="text-xs text-muted-foreground">
          {Math.floor(totalDuration / 60)}:{String(Math.floor(totalDuration % 60)).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}
