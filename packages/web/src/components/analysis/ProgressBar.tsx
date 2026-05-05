import { Card, CardContent } from '@/components/ui/card';
import { Disc3 } from 'lucide-react';

interface Props {
  phase: 'uploading' | 'processing';
  uploadProgress: number;
  chunksProcessed: number;
  totalChunks: number;
  currentTrack: string | null;
  tracksFound: number;
}

export function ProgressBar({ phase, uploadProgress, chunksProcessed, totalChunks, currentTrack, tracksFound }: Props) {
  const getEta = () => {
    if (phase !== 'processing' || totalChunks <= 0) return null;
    const remaining = totalChunks - chunksProcessed;
    if (remaining <= 0) return 'Finishing up...';
    if (remaining < 60) return `~${remaining}s remaining`;
    return `~${Math.ceil(remaining / 60)} min remaining`;
  };

  const isIndeterminate = phase === 'uploading' && uploadProgress === -1;
  const pct =
    phase === 'uploading'
      ? isIndeterminate
        ? 0
        : uploadProgress
      : totalChunks > 0
        ? Math.round((chunksProcessed / totalChunks) * 100)
        : 0;

  return (
    <Card className="glow-purple">
      <CardContent className="pt-6 space-y-6">
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl scale-150 animate-pulse" />
            <Disc3 className="relative w-14 h-14 text-primary animate-spin" style={{ animationDuration: '3s' }} />
          </div>
        </div>

        {phase === 'processing' && chunksProcessed === 0 && (
          <p className="text-xs text-muted-foreground animate-pulse text-center">
            Queued — processing will begin shortly
          </p>
        )}

        {isIndeterminate ? (
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-purple-600 to-violet-400 animate-[indeterminate_1.5s_ease-in-out_infinite]" />
            <style>{`
              @keyframes indeterminate {
                0% { transform: translateX(-100%); }
                50% { transform: translateX(200%); }
                100% { transform: translateX(400%); }
              }
            `}</style>
          </div>
        ) : (
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-600 to-violet-400 transition-all duration-500 shadow-[0_0_10px_rgba(139,92,246,0.5)]"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}

        <div className="text-center space-y-1">
          <p className="text-sm text-muted-foreground">
            {phase === 'uploading'
              ? isIndeterminate
                ? 'Processing media...'
                : `Uploading... ${pct}%`
              : tracksFound > 0
                ? `Analyzing songs... found ${tracksFound} so far (${pct}%)`
                : `Analyzing songs... ${pct}%`}
          </p>

          {phase === 'uploading' && isIndeterminate && (
            <p className="text-xs text-muted-foreground/60 animate-pulse">
              This may take a moment depending on the source
            </p>
          )}

          {phase === 'processing' && (
            <p className="text-xs text-muted-foreground/60">
              {chunksProcessed > 0 && totalChunks > 0
                ? `Scanning segment ${chunksProcessed} of ${totalChunks}`
                : 'Preparing audio...'}
            </p>
          )}

          {phase === 'processing' && getEta() && <p className="text-xs text-muted-foreground/60">{getEta()}</p>}

          {currentTrack && (
            <p className="text-sm text-primary font-medium mt-2 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/10 inline-block">
              {currentTrack}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
