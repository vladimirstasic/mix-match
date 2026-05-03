import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Disc3, Music } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

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

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function PublicTracklist() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<PublicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    fetch(`${API_BASE}/t/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then(setData)
      .catch(() => setError("Tracklist not found"))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{error || "Not found"}</p>
        <Link to="/">
          <Button>Go to MixMatch</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <header className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Disc3 className="w-12 h-12 text-primary" />
              <Music className="w-5 h-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">{data.filename}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date(data.createdAt).toLocaleDateString()} — {data.segments.length} tracks identified
          </p>
        </header>

        <div className="space-y-2 mb-8">
          {data.segments.map((seg) => (
            <Card key={seg.id} className="border-l-4 border-l-green-500">
              <CardContent className="flex items-center gap-4 py-3">
                <span className="font-mono text-sm text-muted-foreground whitespace-nowrap min-w-[120px]">
                  {formatTime(seg.startSec)} — {formatTime(seg.endSec)}
                </span>
                <Check className="w-4 h-4 text-green-500 shrink-0" />
                <span className="font-medium text-sm">{seg.trackName}</span>
                {seg.externalLinks?.spotify && (
                  <a
                    href={seg.externalLinks.spotify}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-xs text-green-500 bg-green-500/10 rounded px-1.5 py-0.5 hover:bg-green-500/20 shrink-0"
                  >
                    Spotify
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center border-t pt-8">
          <p className="text-muted-foreground mb-4">Powered by MixMatch</p>
          <Link to="/">
            <Button>Analyze your own mix</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
