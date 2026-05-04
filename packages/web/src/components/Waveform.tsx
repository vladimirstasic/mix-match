import { useState, useRef } from "react";
import type { Segment } from "@mix-match/shared";

interface Props {
  segments: Segment[];
  totalDuration: number;
  waveformData?: number[] | null;
  onSegmentClick?: (segmentId: string) => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function Waveform({ segments, totalDuration, waveformData, onSegmentClick }: Props) {
  const [hover, setHover] = useState<{ x: number; seconds: number; segment: Segment | null } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  if (totalDuration <= 0) return null;

  // Use real waveform data if available, otherwise generate pseudo-random
  const barCount = waveformData ? waveformData.length : Math.min(300, Math.floor(totalDuration / 1.5));
  const bars = waveformData
    ? waveformData.map(v => 0.05 + v * 0.95) // min height 5%
    : Array.from({ length: barCount }, (_, i) => {
        const seed = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
        return 0.3 + (seed - Math.floor(seed)) * 0.7;
      });

  const getSegmentAt = (seconds: number) => {
    return segments.find(s => seconds >= s.startSec && seconds < s.endSec) ?? null;
  };

  const getBarColor = (segment: Segment | null, isHovered: boolean) => {
    if (!segment) return isHovered ? "bg-muted-foreground/40" : "bg-muted-foreground/20";
    if (segment.status === "identified") return isHovered ? "bg-green-400" : "bg-green-500/70";
    if (segment.status === "retrying") return isHovered ? "bg-yellow-400" : "bg-yellow-500/70";
    return isHovered ? "bg-muted-foreground/40" : "bg-muted-foreground/30";
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    const seconds = ratio * totalDuration;
    const segment = getSegmentAt(seconds);
    setHover({ x, seconds, segment });
  };

  const handleClick = () => {
    if (hover?.segment) {
      onSegmentClick?.(hover.segment.id);
    }
  };

  // Determine which segment each bar belongs to for hover highlighting
  const hoveredSegmentId = hover?.segment?.id;

  return (
    <div className="w-full relative">
      {/* Tooltip */}
      {hover && (
        <div
          className="absolute bottom-full mb-2 pointer-events-none z-10"
          style={{ left: Math.max(80, Math.min(hover.x, (containerRef?.current?.offsetWidth ?? 300) - 80)) - 80 }}
        >
          <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2 w-[160px] text-center">
            <p className="text-xs font-mono text-muted-foreground">{formatTime(hover.seconds)}</p>
            {hover.segment?.status === "identified" ? (
              <p className="text-sm font-medium truncate mt-0.5">{hover.segment.trackName}</p>
            ) : (
              <p className="text-xs text-muted-foreground italic mt-0.5">Unknown</p>
            )}
            {hover.segment?.bpm && (
              <p className="text-xs text-muted-foreground mt-0.5">{hover.segment.bpm} BPM</p>
            )}
          </div>
        </div>
      )}

      {/* Playhead line */}
      {hover && (
        <div
          className="absolute top-0 bottom-0 w-px bg-foreground/50 pointer-events-none z-10"
          style={{ left: hover.x }}
        />
      )}

      {/* Bars */}
      <div
        ref={containerRef}
        className="flex items-end gap-[1px] h-20 w-full cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
        onClick={handleClick}
      >
        {bars.map((height, i) => {
          const seconds = (i / barCount) * totalDuration;
          const segment = getSegmentAt(seconds);
          const isHovered = segment ? segment.id === hoveredSegmentId : false;
          const color = getBarColor(segment, isHovered);

          return (
            <div
              key={i}
              className={`flex-1 rounded-sm transition-colors ${color}`}
              style={{ height: `${height * 100}%` }}
            />
          );
        })}
      </div>

      {/* Time axis */}
      <div className="flex justify-between mt-1 px-0.5">
        <span className="text-xs text-muted-foreground">0:00</span>
        {totalDuration > 600 && (
          <span className="text-xs text-muted-foreground">{formatTime(totalDuration / 2)}</span>
        )}
        <span className="text-xs text-muted-foreground">{formatTime(totalDuration)}</span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-1 justify-center">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-sm bg-green-500/70" /> Identified
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-sm bg-muted-foreground/30" /> Unknown
        </span>
      </div>
    </div>
  );
}
