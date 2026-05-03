import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { getUserAnalyses, type AnalysisSummary } from "../api/client";
import { Clock, CheckCircle, Loader2, XCircle, ExternalLink } from "lucide-react";

interface Props {
  onSelectAnalysis: (id: string) => void;
}

export function Dashboard({ onSelectAnalysis }: Props) {
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserAnalyses().then(setAnalyses).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center text-muted-foreground py-4"><Loader2 className="w-5 h-5 animate-spin inline" /> Loading...</div>;
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
            <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
