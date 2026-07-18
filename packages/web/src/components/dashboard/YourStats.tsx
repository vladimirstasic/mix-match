import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Loader2 } from 'lucide-react';
import { getUserStats, type UserStats } from '../../api/client';

export function YourStats() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserStats()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="text-center py-4">
        <Loader2 className="w-5 h-5 animate-spin inline" />
      </div>
    );
  if (!stats || stats.trackCount === 0) return null;

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Your Stats</h3>
          <span className="text-sm text-muted-foreground ml-auto">
            {stats.trackCount} tracks · {stats.mixCount} mixes
          </span>
        </div>

        {stats.avgBpm != null && <p className="text-sm text-muted-foreground">Average BPM: {stats.avgBpm}</p>}

        {stats.topGenres.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground mb-1.5">Top genres</p>
            <div className="flex flex-wrap gap-1.5">
              {stats.topGenres.map(g => (
                <span key={g.genre} className="text-xs bg-primary/10 text-primary rounded-full px-2.5 py-0.5">
                  {g.genre} ({g.count})
                </span>
              ))}
            </div>
          </div>
        )}

        {stats.topArtists.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground mb-1.5">Top artists</p>
            <div className="space-y-1">
              {stats.topArtists.map(a => (
                <div key={a.artist} className="flex items-center gap-3 text-sm">
                  <span className="flex-1 truncate">{a.artist}</span>
                  <span className="text-muted-foreground shrink-0">{a.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
