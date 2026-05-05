import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Loader2, Disc3 } from 'lucide-react';
import { formatTime } from '@mix-match/shared';

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl scale-150" />
          <Loader2 className="relative w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{error || 'Not found'}</p>
        <Link to="/">
          <Button>Go to MixMatch</Button>
        </Link>
      </div>
    );
  }

  const identifiedCount = data.segments.filter(s => s.trackName).length;

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-[-15%] right-[10%] w-[400px] h-[400px] rounded-full bg-purple-600/8 blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[20%] w-[300px] h-[300px] rounded-full bg-indigo-500/6 blur-[80px]" />
      </div>

      <div className="max-w-2xl mx-auto px-4 py-12">
        <header className="text-center mb-10">
          <div className="flex justify-center mb-5">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl scale-150" />
              <Disc3 className="relative w-12 h-12 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold gradient-text">{data.filename}</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {new Date(data.createdAt).toLocaleDateString()} &middot; {identifiedCount} track{identifiedCount !== 1 ? 's' : ''} identified
          </p>
        </header>

        <div className="space-y-2 mb-10">
          {data.segments.map(seg => (
            <React.Fragment key={seg.id}>
              <Card className="border-l-3 border-l-green-500/70">
                <CardContent className="flex items-center gap-3 py-3 px-4">
                  <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {formatTime(seg.startSec)}
                  </span>
                  <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-green-400" />
                  </div>
                  <span className="font-medium text-sm truncate">{seg.trackName}</span>
                  {seg.externalLinks?.spotify && (
                    <a
                      href={seg.externalLinks.spotify}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-[10px] text-green-400 bg-green-500/10 rounded-md px-2 py-0.5 hover:bg-green-500/20 shrink-0 border border-green-500/20 transition-colors"
                    >
                      Spotify
                    </a>
                  )}
                </CardContent>
              </Card>
            </React.Fragment>
          ))}
        </div>

        <div className="text-center border-t border-white/[0.06] pt-8">
          <p className="text-sm text-muted-foreground mb-4">Powered by MixMatch</p>
          <Link to="/">
            <Button variant="outline">Analyze your own mix</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
