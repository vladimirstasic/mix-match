import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

interface Props {
  analysisId: string;
}

interface RecommendationData {
  topArtists: { name: string; count: number; tracks: string[] }[];
  tracksWithSpotify: { trackName: string | null; artist: string | null; spotifyUrl: string }[];
  totalIdentified: number;
}

export function Recommendations({ analysisId }: Props) {
  const [data, setData] = useState<RecommendationData | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/analysis/${analysisId}/recommendations`)
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {});
  }, [analysisId]);

  if (!data || data.topArtists.length === 0) return null;

  return (
    <div className="space-y-4 mt-6 border-t pt-6">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Artist Breakdown</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {data.topArtists.slice(0, 6).map(artist => (
          <Card key={artist.name} className="bg-muted/20">
            <CardContent className="py-3 text-center">
              <p className="font-medium text-sm truncate">{artist.name}</p>
              <p className="text-xs text-muted-foreground">
                {artist.tracks.length} track{artist.tracks.length !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
