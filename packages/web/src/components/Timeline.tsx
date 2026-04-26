import { useState } from "react";
import type { Segment } from "@mix-match/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCw, Check, HelpCircle, Loader2, Pencil } from "lucide-react";

interface Props {
  segments: Segment[];
  chunksAvailable: boolean;
  analysisId: string;
  onRetrySegment: (segmentId: string) => void;
  onRetryAll: () => void;
  onReset: () => void;
  onEditSegment: (segmentId: string, trackName: string) => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function Timeline({ segments, chunksAvailable, analysisId, onRetrySegment, onRetryAll, onReset, onEditSegment }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const identified = segments.filter((s) => s.status === "identified");
  const unknown = segments.filter((s) => s.status === "unknown");
  const retrying = segments.filter((s) => s.status === "retrying");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          Found {identified.length} track{identified.length !== 1 ? "s" : ""}
          {unknown.length > 0 && (
            <span className="text-muted-foreground font-normal text-base ml-2">
              ({unknown.length} unidentified)
            </span>
          )}
        </h2>
        <div className="flex gap-2">
          {unknown.length > 0 && chunksAvailable && (
            <Button variant="outline" size="sm" onClick={onRetryAll} disabled={retrying.length > 0}>
              <RotateCw className="w-4 h-4 mr-1" />
              Retry all unknown
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onReset}>
            New analysis
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {segments.map((seg) => (
          <Card
            key={seg.id}
            className={`border-l-4 ${
              seg.status === "identified"
                ? "border-l-green-500"
                : seg.status === "retrying"
                ? "border-l-yellow-500"
                : "border-l-muted-foreground/30"
            }`}
          >
            <CardContent className="flex items-center gap-4 py-3">
              <span className="font-mono text-sm text-muted-foreground whitespace-nowrap min-w-[120px]">
                {formatTime(seg.startSec)} — {formatTime(seg.endSec)}
              </span>

              {seg.status === "identified" && (
                <>
                  <Check className="w-4 h-4 text-green-500 shrink-0" />
                  {editingId === seg.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        className="flex-1 bg-transparent border-b border-foreground/30 outline-none text-sm font-medium px-1 py-0.5"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            onEditSegment(seg.id, editValue);
                            setEditingId(null);
                          } else if (e.key === "Escape") {
                            setEditingId(null);
                          }
                        }}
                        autoFocus
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          onEditSegment(seg.id, editValue);
                          setEditingId(null);
                        }}
                      >
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="font-medium">{seg.trackName}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto"
                        onClick={() => {
                          setEditingId(seg.id);
                          setEditValue(seg.trackName ?? "");
                        }}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                </>
              )}

              {seg.status === "unknown" && (
                <>
                  <HelpCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground italic">Unknown track</span>
                  <div className="ml-auto">
                    {chunksAvailable ? (
                      <Button variant="ghost" size="sm" onClick={() => onRetrySegment(seg.id)}>
                        <RotateCw className="w-3 h-3 mr-1" />
                        Retry
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Chunks expired</span>
                    )}
                  </div>
                </>
              )}

              {seg.status === "retrying" && (
                <>
                  <Loader2 className="w-4 h-4 text-yellow-500 animate-spin shrink-0" />
                  <span className="text-muted-foreground italic">Retrying...</span>
                </>
              )}

              {seg.attempts > 1 && (
                <span className="text-xs text-muted-foreground ml-auto">
                  attempt {seg.attempts}
                </span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-4 border-t">
        <span className="text-sm text-muted-foreground">Export:</span>
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/analysis/${analysisId}/export/text`} download>Text</a>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/analysis/${analysisId}/export/mixcloud`} download>Mixcloud</a>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/analysis/${analysisId}/export/soundcloud`} download>SoundCloud</a>
        </Button>
      </div>
    </div>
  );
}
