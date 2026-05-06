import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Disc3, Loader2, Music } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface DjProfileData {
  username: string;
  mixes: { id: string; filename: string; status: string; createdAt: string; slug: string | null }[];
  badges?: string[];
}

export function DjProfile() {
  const { username } = useParams<{ username: string }>();
  const [data, setData] = useState<DjProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    if (!username) return;
    fetch(`${API_BASE}/dj/${username}`, { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [username]);

  const toggleFollow = async () => {
    const res = await fetch(`${API_BASE}/dj/${username}/follow`, { method: 'POST', credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setFollowing(data.following);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl scale-150" />
          <Loader2 className="relative w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );

  if (!data)
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">DJ not found</p>
        <Link to="/">
          <Button>Go to MixMatch</Button>
        </Link>
      </div>
    );

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-[-20%] left-[20%] w-[400px] h-[400px] rounded-full bg-purple-600/8 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[10%] w-[300px] h-[300px] rounded-full bg-violet-500/6 blur-[80px]" />
      </div>

      <div className="max-w-2xl mx-auto px-4 py-12">
        <header className="text-center mb-10">
          <div className="flex justify-center mb-5">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl scale-150" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <Disc3 className="w-10 h-10 text-white" />
              </div>
            </div>
          </div>
          <h1 className="text-2xl font-bold">@{data.username}</h1>
          {data.badges && data.badges.length > 0 && (
            <div className="flex justify-center gap-2 mt-3">
              {data.badges.map(badge => (
                <span
                  key={badge}
                  className="text-xs bg-primary/10 text-primary rounded-full px-3 py-1 border border-primary/20"
                >
                  {badge}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center justify-center gap-3 mt-4">
            <Button variant={following ? 'outline' : 'default'} size="sm" onClick={toggleFollow}>
              {following ? 'Following' : 'Follow'}
            </Button>
            <span className="text-sm text-muted-foreground">
              {data.mixes.length} mix{data.mixes.length !== 1 ? 'es' : ''}
            </span>
          </div>
        </header>

        <div className="space-y-3">
          {data.mixes.map(mix => (
            <Card key={mix.id} className="group">
              <CardContent className="py-4 px-5">
                <Link to={mix.slug ? `/t/${mix.slug}` : '#'} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <Music className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{mix.filename}</p>
                    <p className="text-xs text-muted-foreground">{new Date(mix.createdAt).toLocaleDateString()}</p>
                  </div>
                </Link>
              </CardContent>
            </Card>
          ))}
          {data.mixes.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No public mixes yet</p>
            </div>
          )}
        </div>

        <div className="text-center border-t border-border/50 pt-8 mt-12">
          <p className="text-sm text-muted-foreground mb-4">Powered by MixMatch</p>
          <Link to="/">
            <Button variant="outline">Analyze your own mix</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
