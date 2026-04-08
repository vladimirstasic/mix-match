interface Props {
  phase: "uploading" | "processing";
  uploadProgress: number;
  chunksProcessed: number;
  totalChunks: number;
  currentTrack: string | null;
}

export function ProgressBar({ phase, uploadProgress, chunksProcessed, totalChunks, currentTrack }: Props) {
  const pct = phase === "uploading"
    ? uploadProgress
    : totalChunks > 0
      ? Math.round((chunksProcessed / totalChunks) * 100)
      : 0;

  return (
    <div className="progress-container">
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="progress-label">
        {phase === "uploading"
          ? `Uploading... ${pct}%`
          : `Analyzing... chunk ${chunksProcessed} of ${totalChunks}`}
      </p>
      {currentTrack && <p className="progress-track">Now detecting: {currentTrack}</p>}
    </div>
  );
}
