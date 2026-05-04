import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { getUserAnalyses, deleteAnalysis, type AnalysisSummary } from "../api/client";
import { Clock, CheckCircle, Loader2, XCircle, ExternalLink, Trash2 } from "lucide-react";

interface Props {
  onSelectAnalysis: (id: string) => void;
}

export function Dashboard({ onSelectAnalysis }: Props) {
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserAnalyses().then(setAnalyses).finally(() => setLoading(false));
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Delete this analysis?")) return;
    await deleteAnalysis(id);
    setAnalyses((prev) => prev.filter((a) => a.id !== id));
  };

  if (loading) {
    return (
      <div className="space-y-3 mb-8">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Recent Analyses</h3>
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-lg border border-border p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (analyses.length === 0) return null;

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "processing": case "pending": return <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />;
      case "failed": return <XCircle className="w-4 h-4 text-destructive" />;
      default: return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-3 mb-8">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Recent Analyses</h3>
      {analyses.slice(0, 5).map((a) => (
        <Card key={a.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => onSelectAnalysis(a.id)}>
          <CardContent className="flex items-center gap-3 py-3">
            {statusIcon(a.status)}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{a.filename}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(a.createdAt).toLocaleDateString()} — {a.status}
              </p>
            </div>
            <button
              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
              onClick={(e) => handleDelete(e, a.id)}
              title="Delete analysis"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
