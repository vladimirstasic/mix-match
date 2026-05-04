import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Disc3, Music, Loader2 } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

interface DjProfileData {
  username: string;
  mixes: { id: string; filename: string; status: string; createdAt: string; slug: string | null }[];
}

export function DjProfile() {
  const { username } = useParams<{ username: string }>();
  const [data, setData] = useState<DjProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!username) return;
    fetch(`${API_BASE}/dj/${username}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  if (!data) return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-4">
      <p className="text-muted-foreground">DJ not found</p>
      <Link to="/"><Button>Go to MixMatch</Button></Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <header className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Disc3 className="w-16 h-16 text-primary" />
              <Music className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
          </div>
          <h1 className="text-3xl font-bold">@{data.username}</h1>
          <p className="text-sm text-muted-foreground mt-1">{data.mixes.length} public mix{data.mixes.length !== 1 ? "es" : ""}</p>
        </header>

        <div className="space-y-3">
          {data.mixes.map(mix => (
            <Card key={mix.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="py-4">
                <Link to={mix.slug ? `/t/${mix.slug}` : "#"} className="block">
                  <p className="font-medium">{mix.filename}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(mix.createdAt).toLocaleDateString()}</p>
                </Link>
              </CardContent>
            </Card>
          ))}
          {data.mixes.length === 0 && (
            <p className="text-center text-muted-foreground">No public mixes yet</p>
          )}
        </div>

        <div className="text-center border-t pt-8 mt-8">
          <p className="text-muted-foreground mb-4">Powered by MixMatch</p>
          <Link to="/"><Button>Analyze your own mix</Button></Link>
        </div>
      </div>
    </div>
  );
}
