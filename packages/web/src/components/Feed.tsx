import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

interface FeedMix {
  id: string;
  filename: string;
  status: string;
  createdAt: string;
  slug: string | null;
}

interface Props {
  onSelectAnalysis: (id: string) => void;
}

export function Feed({ onSelectAnalysis }: Props) {
  const [mixes, setMixes] = useState<FeedMix[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/user/feed`)
      .then(r => r.ok ? r.json() : [])
      .then(setMixes)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-4"><Loader2 className="w-5 h-5 animate-spin inline" /></div>;
  if (mixes.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">Follow DJs to see their mixes here</p>;

  return (
    <div className="space-y-2">
      {mixes.map(mix => (
        <Card key={mix.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => onSelectAnalysis(mix.id)}>
          <CardContent className="py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{mix.filename}</p>
              <p className="text-xs text-muted-foreground">{new Date(mix.createdAt).toLocaleDateString()}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
