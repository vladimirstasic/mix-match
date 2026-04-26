import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface Props {
  phase: "uploading" | "processing";
  uploadProgress: number;
  chunksProcessed: number;
  totalChunks: number;
  currentTrack: string | null;
  tracksFound: number;
}

export function ProgressBar({ phase, uploadProgress, chunksProcessed, totalChunks, currentTrack, tracksFound }: Props) {
  const pct = phase === "uploading"
    ? uploadProgress
    : totalChunks > 0
      ? Math.round((chunksProcessed / totalChunks) * 100)
      : 0;

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <Progress value={pct} className="h-2" />
        <p className="text-sm text-center text-muted-foreground">
          {phase === "uploading"
            ? `Uploading... ${pct}%`
            : tracksFound > 0
              ? `Analyzing songs... found ${tracksFound} so far (${pct}%)`
              : `Analyzing songs... ${pct}%`}
        </p>
        {currentTrack && (
          <p className="text-sm text-center text-primary font-medium">
            Detected: {currentTrack}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
