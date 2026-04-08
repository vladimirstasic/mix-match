import type { TrackMatch } from "@mix-detective/shared";

interface Props {
  results: TrackMatch[];
  onReset: () => void;
}

export function Timeline({ results, onReset }: Props) {
  return (
    <div className="timeline">
      <div className="timeline-header">
        <h2>Detected {results.length} track{results.length !== 1 ? "s" : ""}</h2>
        <button onClick={onReset} className="btn-reset">Analyze another mix</button>
      </div>
      <div className="timeline-list">
        {results.map((t, i) => (
          <div key={i} className="timeline-item">
            <div className="timeline-time">
              <span>{t.start}</span>
              <span className="timeline-dash">—</span>
              <span>{t.end}</span>
            </div>
            <div className="timeline-track">{t.track}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
