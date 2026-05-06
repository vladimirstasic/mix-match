import { useState, useRef } from 'react';
import type { Segment } from '@mix-match/shared';
import { formatTime } from '@mix-match/shared';

interface Props {
  segments: Segment[];
  totalDuration: number;
  waveformData?: number[] | null;
  onSegmentClick?: (segmentId: string) => void;
}

export function Waveform({ segments, totalDuration, waveformData, onSegmentClick }: Props) {
  const [hover, setHover] = useState<{ x: number; seconds: number; segment: Segment | null } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  if (totalDuration <= 0) return null;

  // Use real waveform data if available, otherwise generate pseudo-random
  // Downsample to max 300 bars to prevent flex overflow on long mixes
  const maxBars = 300;
  const rawData = waveformData
    ? waveformData.length > maxBars
      ? Array.from({ length: maxBars }, (_, i) => {
          const start = Math.floor((i / maxBars) * waveformData.length);
          const end = Math.floor(((i + 1) / maxBars) * waveformData.length);
          let max = 0;
          for (let j = start; j < end; j++) { if (waveformData[j] > max) max = waveformData[j]; }
          return max;
        })
      : waveformData
    : null;

  const barCount = rawData ? rawData.length : Math.min(maxBars, Math.floor(totalDuration / 1.5));
  const bars = rawData
    ? rawData.map(v => 0.05 + v * 0.95)
    : Array.from({ length: barCount }, (_, i) => {
        const seed = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
        return 0.3 + (seed - Math.floor(seed)) * 0.7;
      });

  const getSegmentAt = (seconds: number) => {
    return segments.find(s => seconds >= s.startSec && seconds < s.endSec) ?? null;
  };

  const getBarColor = (segment: Segment | null, isHovered: boolean) => {
    if (!segment) return isHovered ? 'bg-muted-foreground/40' : 'bg-muted-foreground/15';
    if (segment.status === 'retrying') return isHovered ? 'bg-yellow-400' : 'bg-yellow-500/70';
    if (segment.status === 'unknown') return isHovered ? 'bg-muted-foreground/40' : 'bg-muted-foreground/25';
    if (segment.status === 'identified') {
      const conf = segment.confidence;
      if (conf != null) {
        if (conf >= 80) return isHovered ? 'bg-green-400' : 'bg-green-500/70';
        if (conf >= 50) return isHovered ? 'bg-lime-400' : 'bg-lime-500/70';
        return isHovered ? 'bg-orange-400' : 'bg-orange-500/70';
      }
      return isHovered ? 'bg-green-400' : 'bg-green-500/70';
    }
    return isHovered ? 'bg-muted-foreground/40' : 'bg-muted-foreground/20';
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
          style={{ left: Math.max(140, Math.min(hover.x, (containerRef?.current?.offsetWidth ?? 400) - 140)) - 140 }}
        >
          <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2 w-[280px] text-center">
            <p className="text-xs font-mono text-muted-foreground">{formatTime(hover.seconds)}</p>
            {hover.segment?.status === 'identified' ? (
              <>
                <p className="text-sm font-medium mt-0.5">{hover.segment.trackName}</p>
                {hover.segment.confidence != null && (
                  <p className="text-xs text-muted-foreground mt-0.5">{hover.segment.confidence}% confidence</p>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground italic mt-0.5">Unknown</p>
            )}
            {hover.segment?.bpm && <p className="text-xs text-muted-foreground mt-0.5">{hover.segment.bpm} BPM</p>}
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
        className="flex items-end gap-[1px] h-20 w-full cursor-crosshair relative overflow-hidden"
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

        {/* Energy curve overlay */}
        {waveformData && waveformData.length > 10 && (
          <svg
            className="absolute inset-0 pointer-events-none"
            viewBox={`0 0 ${barCount} 100`}
            preserveAspectRatio="none"
          >
            <path
              d={(() => {
                // Smooth the data with a moving average (window of 10)
                const windowSize = Math.min(10, Math.floor(bars.length / 5));
                const smoothed = bars.map((_, i) => {
                  const start = Math.max(0, i - windowSize);
                  const end = Math.min(bars.length, i + windowSize + 1);
                  let sum = 0;
                  for (let j = start; j < end; j++) sum += bars[j];
                  return sum / (end - start);
                });
                const points = smoothed.map((v, i) => `${i},${100 - v * 95}`);
                return `M${points.join(' L')}`;
              })()}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-primary/30"
            />
          </svg>
        )}
      </div>

      {/* Transition markers */}
      <div className="absolute top-0 bottom-6 left-0 right-0 pointer-events-none">
        {segments
          .filter(s => s.status === 'identified')
          .map((seg, i, arr) => {
            if (i === 0) return null;
            const prev = arr[i - 1];
            if (!prev || prev.endSec === seg.startSec || Math.abs(prev.endSec - seg.startSec) < 5) {
              const xPercent = (seg.startSec / totalDuration) * 100;
              return (
                <div
                  key={seg.id}
                  className="absolute top-0 bottom-0 w-px bg-white/30"
                  style={{ left: `${xPercent}%` }}
                  title={`Transition at ${formatTime(seg.startSec)}`}
                />
              );
            }
            return null;
          })}
      </div>

      {/* Time axis */}
      <div className="flex justify-between mt-1 px-0.5">
        <span className="text-xs text-muted-foreground">0:00</span>
        {totalDuration > 600 && <span className="text-xs text-muted-foreground">{formatTime(totalDuration / 2)}</span>}
        <span className="text-xs text-muted-foreground">{formatTime(totalDuration)}</span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-1 justify-center">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-sm bg-green-500/70" /> High
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-sm bg-lime-500/70" /> Medium
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-sm bg-orange-500/70" /> Low
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-sm bg-muted-foreground/25" /> Unknown
        </span>
      </div>
    </div>
  );
}
