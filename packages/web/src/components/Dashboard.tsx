import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { getUserAnalyses, deleteAnalysis, toggleFavorite, updateAnalysisTags, type AnalysisSummary } from "../api/client";
import { Clock, CheckCircle, Loader2, XCircle, ExternalLink, Trash2, Star, Plus, X, Filter } from "lucide-react";

interface Props {
  onSelectAnalysis: (id: string) => void;
}

export function Dashboard({ onSelectAnalysis }: Props) {
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [editingTagsFor, setEditingTagsFor] = useState<string | null>(null);
  const [newTagInput, setNewTagInput] = useState("");

  useEffect(() => {
    getUserAnalyses().then(setAnalyses).finally(() => setLoading(false));
  }, []);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const a of analyses) {
      for (const t of a.tags ?? []) tagSet.add(t);
    }
    return Array.from(tagSet).sort();
  }, [analyses]);

  const displayed = useMemo(() => {
    let list = analyses;
    if (showFavoritesOnly) list = list.filter((a) => a.isFavorite);
    if (filterTag) list = list.filter((a) => (a.tags ?? []).includes(filterTag));
    return list;
  }, [analyses, showFavoritesOnly, filterTag]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Delete this analysis?")) return;
    await deleteAnalysis(id);
    setAnalyses((prev) => prev.filter((a) => a.id !== id));
  };

  const handleToggleFavorite = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const { isFavorite } = await toggleFavorite(id);
    setAnalyses((prev) => prev.map((a) => a.id === id ? { ...a, isFavorite } : a));
  };

  const handleAddTag = async (e: React.FormEvent, analysisId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const tag = newTagInput.trim().toLowerCase();
    if (!tag) return;
    const analysis = analyses.find((a) => a.id === analysisId);
    if (!analysis) return;
    const current = analysis.tags ?? [];
    if (current.includes(tag)) { setNewTagInput(""); return; }
    const updated = [...current, tag];
    await updateAnalysisTags(analysisId, updated);
    setAnalyses((prev) => prev.map((a) => a.id === analysisId ? { ...a, tags: updated } : a));
    setNewTagInput("");
  };

  const handleRemoveTag = async (e: React.MouseEvent, analysisId: string, tag: string) => {
    e.stopPropagation();
    const analysis = analyses.find((a) => a.id === analysisId);
    if (!analysis) return;
    const updated = (analysis.tags ?? []).filter((t) => t !== tag);
    await updateAnalysisTags(analysisId, updated);
    setAnalyses((prev) => prev.map((a) => a.id === analysisId ? { ...a, tags: updated } : a));
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

  const hasFavorites = analyses.some((a) => a.isFavorite);

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
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Recent Analyses</h3>
        <div className="flex items-center gap-3">
          {hasFavorites && (
            <button
              className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md transition-colors ${
                showFavoritesOnly
                  ? "bg-yellow-500/20 text-yellow-500"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            >
              <Star className={`w-3 h-3 ${showFavoritesOnly ? "fill-yellow-500" : ""}`} />
              Favorites
            </button>
          )}
          {allTags.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Filter className="w-3 h-3 text-muted-foreground" />
              <select
                className="text-xs bg-transparent border border-border rounded px-2 py-1 text-foreground"
                value={filterTag ?? ""}
                onChange={(e) => setFilterTag(e.target.value || null)}
              >
                <option value="">All tags</option>
                {allTags.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
      {displayed.slice(0, 5).map((a) => (
        <Card key={a.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => onSelectAnalysis(a.id)}>
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              {statusIcon(a.status)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{a.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(a.createdAt).toLocaleDateString()} — {a.status}
                </p>
              </div>
              <button
                className={`p-1 rounded transition-colors shrink-0 ${
                  a.isFavorite
                    ? "text-yellow-500 hover:text-yellow-400"
                    : "text-muted-foreground/40 hover:text-yellow-500"
                }`}
                onClick={(e) => handleToggleFavorite(e, a.id)}
                title={a.isFavorite ? "Remove from favorites" : "Add to favorites"}
              >
                <Star className={`w-4 h-4 ${a.isFavorite ? "fill-yellow-500" : ""}`} />
              </button>
              <button
                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                onClick={(e) => handleDelete(e, a.id)}
                title="Delete analysis"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
            </div>
            <div className="flex items-center gap-1.5 mt-2 ml-7 flex-wrap">
              {(a.tags ?? []).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary"
                >
                  {tag}
                  <button
                    className="hover:text-destructive"
                    onClick={(e) => handleRemoveTag(e, a.id, tag)}
                    title="Remove tag"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
              {editingTagsFor === a.id ? (
                <form
                  className="inline-flex"
                  onSubmit={(e) => handleAddTag(e, a.id)}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    autoFocus
                    className="text-[10px] w-16 px-1.5 py-0.5 rounded border border-border bg-background text-foreground outline-none focus:border-primary"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onBlur={() => { setEditingTagsFor(null); setNewTagInput(""); }}
                    placeholder="tag..."
                  />
                </form>
              ) : (
                <button
                  className="inline-flex items-center text-[10px] px-1 py-0.5 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  onClick={(e) => { e.stopPropagation(); setEditingTagsFor(a.id); }}
                  title="Add tag"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
