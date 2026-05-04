import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, Eye, Loader2 } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

interface AnalyticsData {
  totalViews: number;
  mixes: { id: string; filename: string; viewCount: number; createdAt: string }[];
}

export function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/user/analytics`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-4"><Loader2 className="w-5 h-5 animate-spin inline" /></div>;
  if (!data || data.mixes.length === 0) return null;

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Analytics</h3>
          <span className="text-sm text-muted-foreground ml-auto">{data.totalViews} total views</span>
        </div>
        <div className="space-y-2">
          {data.mixes.filter(m => m.viewCount > 0).map(mix => (
            <div key={mix.id} className="flex items-center gap-3 text-sm">
              <span className="flex-1 truncate">{mix.filename}</span>
              <span className="flex items-center gap-1 text-muted-foreground shrink-0">
                <Eye className="w-3 h-3" /> {mix.viewCount}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
