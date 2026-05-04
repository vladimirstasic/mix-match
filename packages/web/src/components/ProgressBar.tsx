import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Music, Disc3 } from "lucide-react";

interface Props {
  phase: "uploading" | "processing";
  uploadProgress: number;
  chunksProcessed: number;
  totalChunks: number;
  currentTrack: string | null;
  tracksFound: number;
}

export function ProgressBar({ phase, uploadProgress, chunksProcessed, totalChunks, currentTrack, tracksFound }: Props) {
  const getEta = () => {
    if (phase !== "processing" || totalChunks <= 0) return null;
    const remaining = totalChunks - chunksProcessed;
    if (remaining <= 0) return "Finishing up...";
    if (remaining < 60) return `~${remaining}s remaining`;
    return `~${Math.ceil(remaining / 60)} min remaining`;
  };

  const isIndeterminate = phase === "uploading" && uploadProgress === -1;
  const pct = phase === "uploading"
    ? (isIndeterminate ? 0 : uploadProgress)
    : totalChunks > 0
      ? Math.round((chunksProcessed / totalChunks) * 100)
      : 0;

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        <div className="flex justify-center">
          <div className="relative">
            <Disc3 className="w-16 h-16 text-primary animate-spin" style={{ animationDuration: "3s" }} />
            <Music className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
        </div>

        {phase === "processing" && chunksProcessed === 0 && (
          <p className="text-xs text-muted-foreground animate-pulse text-center">
            Queued — processing will begin shortly
          </p>
        )}

        {isIndeterminate ? (
          <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
            <div className="h-full w-1/3 rounded-full bg-primary animate-pulse" style={{
              animation: "indeterminate 1.5s ease-in-out infinite",
            }} />
            <style>{`
              @keyframes indeterminate {
                0% { transform: translateX(-100%); width: 33%; }
                50% { transform: translateX(150%); width: 33%; }
                100% { transform: translateX(400%); width: 33%; }
              }
            `}</style>
          </div>
        ) : (
          <Progress value={pct} className="h-2" />
        )}

        <div className="text-center space-y-1">
          <p className="text-sm text-muted-foreground">
            {phase === "uploading"
              ? isIndeterminate
                ? "Downloading audio..."
                : `Uploading... ${pct}%`
              : tracksFound > 0
                ? `Analyzing songs... found ${tracksFound} so far (${pct}%)`
                : `Analyzing songs... ${pct}%`}
          </p>

          {phase === "uploading" && isIndeterminate && (
            <p className="text-xs text-muted-foreground/60 animate-pulse">
              This may take a moment depending on the source
            </p>
          )}

          {phase === "processing" && (
            <p className="text-xs text-muted-foreground/60">
              {chunksProcessed > 0 && totalChunks > 0
                ? `Scanning segment ${chunksProcessed} of ${totalChunks}`
                : "Preparing audio..."}
            </p>
          )}

          {phase === "processing" && getEta() && (
            <p className="text-xs text-muted-foreground/60">
              {getEta()}
            </p>
          )}

          {currentTrack && (
            <p className="text-sm text-primary font-medium mt-2">
              Detected: {currentTrack}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
