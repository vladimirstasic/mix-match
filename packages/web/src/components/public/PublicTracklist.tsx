import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Check, Loader2 } from 'lucide-react';
import { formatTime } from '@mix-match/shared';
import { PageChrome } from '../layout';
import { BuyLinks } from '../analysis/BuyLinks';
import { AffiliateDisclosure } from '../AffiliateDisclosure';
import { AcrcloudAttribution } from '../AcrcloudAttribution';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { explainUnknownSegment } from '../../lib/explainUnknownSegment';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface PublicSegment {
  id: string;
  startSec: number;
  endSec: number;
  status: string;
  trackName: string | null;
  externalLinks: Record<string, string> | null;
}

interface PublicData {
  filename: string;
  segments: PublicSegment[];
  createdAt: string;
}

export function PublicTracklist() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<PublicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    fetch(`${API_BASE}/t/${slug}`)
      .then(res => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then(setData)
      .catch(() => setError('Tracklist not found'))
      .finally(() => setLoading(false));
  }, [slug]);

  const identifiedCount = data?.segments.filter(s => s.trackName).length ?? 0;

  useDocumentMeta(
    data ? `${data.filename} — tracklist identified by MixMatch` : 'MixMatch',
    data
      ? `${identifiedCount}/${data.segments.length} tracks identified in this mix. Timestamped tracklist generated automatically by MixMatch.`
      : undefined,
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground font-mono text-sm uppercase tracking-[0.1em]">{error || 'Not found'}</p>
        <Link to="/">
          <button type="button" className="btn-demo">
            GO TO MIXMATCH
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <PageChrome variant="full" />

      <div className="results-scrim space-y-6 max-w-2xl mx-auto px-4 py-16">
        <div className="label-comment">SHARED SCAN</div>
        <h1 className="r-title break-words">{data.filename}</h1>
        <p className="r-meta">
          {new Date(data.createdAt).toLocaleDateString()} · {identifiedCount} track
          {identifiedCount !== 1 ? 's' : ''} identified
        </p>

        <div className="log">
          <div className="log-top">
            <span>RECOGNITION_LOG</span>
            <span>
              {identifiedCount} / {data.segments.length}
              {data.segments.length > 0 && ` · ${Math.round((identifiedCount / data.segments.length) * 100)}%`}
            </span>
          </div>
          <div className="log-body space-y-2 p-2">
            {data.segments.map(seg => (
              <React.Fragment key={seg.id}>
                <div className={`log-row ${seg.trackName ? 'identified' : 'unknown'}`} style={{ display: 'block' }}>
                  <div className="py-1">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                      <span className="font-mono text-[11px] text-muted-foreground whitespace-nowrap sm:min-w-[110px]">
                        {formatTime(seg.startSec)}
                      </span>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {seg.trackName && (
                          <div className="w-4 h-4 bg-primary/15 flex items-center justify-center shrink-0">
                            <Check className="w-2.5 h-2.5 text-primary" />
                          </div>
                        )}
                        <span className="font-medium text-sm flex-1 min-w-0 truncate">
                          {seg.trackName || 'Unidentified'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {seg.externalLinks?.spotify && (
                          <a
                            href={seg.externalLinks.spotify}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-mono uppercase tracking-[0.08em] text-[var(--spotify)] border border-[var(--spotify)]/40 px-1.5 py-0.5 hover:bg-[var(--spotify)]/10"
                          >
                            SPOTIFY
                          </a>
                        )}
                        {seg.trackName && <BuyLinks trackName={seg.trackName} />}
                      </div>
                    </div>
                    {!seg.trackName && (
                      <p className="text-xs text-muted-foreground/70 italic mt-1 sm:pl-[122px]">
                        {explainUnknownSegment(seg, data.segments)}
                      </p>
                    )}
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="flex justify-center pt-4">
          <Link to="/">
            <Button variant="outline">Analyze your own mix</Button>
          </Link>
        </div>

        <div className="flex flex-col items-center gap-2 text-center">
          <AffiliateDisclosure />
          <AcrcloudAttribution />
        </div>
      </div>
    </div>
  );
}
