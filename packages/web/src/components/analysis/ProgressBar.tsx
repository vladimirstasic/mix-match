interface Props {
  phase: 'uploading' | 'processing';
  uploadProgress: number;
  chunksProcessed: number;
  totalChunks: number;
  currentTrack: string | null;
  tracksFound: number;
}

export function ProgressBar({ phase, uploadProgress, chunksProcessed, totalChunks, currentTrack, tracksFound }: Props) {
  const isIndeterminate = phase === 'uploading' && uploadProgress === -1;
  const pct =
    phase === 'uploading'
      ? isIndeterminate
        ? 0
        : uploadProgress
      : totalChunks > 0
        ? Math.round((chunksProcessed / totalChunks) * 100)
        : 0;

  const remaining = totalChunks - chunksProcessed;
  const eta =
    phase !== 'processing' || totalChunks <= 0
      ? '--'
      : remaining <= 0
        ? '0s'
        : remaining < 60
          ? `${remaining}s`
          : `${Math.ceil(remaining / 60)}m`;

  const state = phase === 'uploading' ? (isIndeterminate ? 'INGEST' : 'UPLOAD') : 'SCANNING';

  return (
    <div className="scope">
      <span className="corner tl" aria-hidden />
      <span className="corner tr" aria-hidden />
      <span className="corner bl" aria-hidden />
      <span className="corner br" aria-hidden />

      <div className="scope-hud">
        <span className="eq" aria-hidden>
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
        <span>
          SEGMENT{' '}
          <b>
            {String(chunksProcessed).padStart(3, '0')} / {String(totalChunks).padStart(3, '0')}
          </b>
        </span>
        <span>
          FOUND <b>{tracksFound}</b>
        </span>
        <span>
          ETA <b>{eta}</b>
        </span>
        <span className="hud-state">{state}</span>
      </div>

      <div className="scope-center">
        <div className="s-pct">{pct}%</div>
        <div className="s-track">
          {phase === 'uploading' && isIndeterminate && 'fetching media…'}
          {phase === 'uploading' && !isIndeterminate && `uploading… ${pct}%`}
          {phase === 'processing' && chunksProcessed === 0 && 'queued — preparing audio…'}
          {phase === 'processing' &&
            chunksProcessed > 0 &&
            (currentTrack ?? `scanning segment ${chunksProcessed}/${totalChunks}`)}
        </div>
      </div>

      <div className="s-progress">
        <i style={{ width: `${pct}%` }} className={isIndeterminate ? 'is-indeterminate' : ''} />
      </div>
    </div>
  );
}
