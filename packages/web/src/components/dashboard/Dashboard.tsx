import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  getUserAnalyses,
  deleteAnalysis,
  toggleFavorite,
  updateAnalysis,
  type AnalysisSummary,
} from '../../api/client';
import { Clock, CheckCircle, Loader2, XCircle, Trash2, Star, Filter, Lock, Unlock } from 'lucide-react';

interface Props {
  onSelectAnalysis: (id: string) => void;
}

export function Dashboard({ onSelectAnalysis }: Props) {
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getUserAnalyses()
      .then(setAnalyses)
      .finally(() => setLoading(false));
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
    if (showFavoritesOnly) list = list.filter(a => a.isFavorite);
    if (filterTag) list = list.filter(a => (a.tags ?? []).includes(filterTag));
    return list;
  }, [analyses, showFavoritesOnly, filterTag]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmDelete(id);
  };

  const confirmDeleteAction = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    await deleteAnalysis(confirmDelete);
    setAnalyses(prev => prev.filter(a => a.id !== confirmDelete));
    setDeleting(false);
    setConfirmDelete(null);
  };

  const handleToggleFavorite = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const { isFavorite } = await toggleFavorite(id);
    setAnalyses(prev => prev.map(a => (a.id === id ? { ...a, isFavorite } : a)));
  };

  const handleTogglePublic = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const analysis = analyses.find(a => a.id === id);
    if (!analysis) return;
    const newVal = !analysis.isPublic;
    await updateAnalysis(id, { isPublic: newVal });
    setAnalyses(prev => prev.map(a => (a.id === id ? { ...a, isPublic: newVal } : a)));
  };

  if (loading) {
    return (
      <div className="space-y-3 mb-8">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Recent</h3>
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-2xl border border-border/50 p-4 animate-pulse bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded-lg w-3/4" />
                <div className="h-3 bg-muted/50 rounded-lg w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (analyses.length === 0) return null;

  const hasFavorites = analyses.some(a => a.isFavorite);

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'processing':
      case 'pending':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-3 mb-8">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Recent</h3>
        <div className="flex items-center gap-2">
          {hasFavorites && (
            <button
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition-all duration-200 ${
                showFavoritesOnly
                  ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            >
              <Star className={`w-3 h-3 ${showFavoritesOnly ? 'fill-yellow-400' : ''}`} />
              Favorites
            </button>
          )}
          {allTags.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Filter className="w-3 h-3 text-muted-foreground" />
              <select
                className="text-xs bg-glass-bg border border-glass-border rounded-lg px-2 py-1 text-foreground backdrop-blur-sm"
                value={filterTag ?? ''}
                onChange={e => setFilterTag(e.target.value || null)}
              >
                <option value="">All tags</option>
                {allTags.map(t => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
      {(showAll ? displayed : displayed.slice(0, 10)).map(a => (
        <Card key={a.id} className="cursor-pointer group" onClick={() => onSelectAnalysis(a.id)}>
          <CardContent className="flex items-center gap-3 py-3 px-4">
            {statusIcon(a.status)}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{a.filename}</p>
              <p className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button
                className={`p-1.5 rounded-lg transition-colors ${
                  a.isFavorite ? 'text-yellow-400' : 'text-muted-foreground/40 hover:text-yellow-400'
                }`}
                onClick={e => handleToggleFavorite(e, a.id)}
              >
                <Star className={`w-3.5 h-3.5 ${a.isFavorite ? 'fill-yellow-400' : ''}`} />
              </button>
              <button
                className={`p-1.5 rounded-lg transition-colors ${
                  a.isPublic ? 'text-green-400' : 'text-muted-foreground/40 hover:text-muted-foreground'
                }`}
                onClick={e => handleTogglePublic(e, a.id)}
              >
                {a.isPublic ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              </button>
              <button
                className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                onClick={e => handleDelete(e, a.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </CardContent>
        </Card>
      ))}
      {!showAll && displayed.length > 10 && (
        <button
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground py-2 rounded-xl hover:bg-accent transition-colors"
          onClick={() => setShowAll(true)}
        >
          Show all ({displayed.length} total)
        </button>
      )}

      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent hideClose className="max-w-sm">
          <DialogTitle>Delete analysis?</DialogTitle>
          <DialogDescription>This action cannot be undone.</DialogDescription>
          <div className="flex gap-3 justify-center mt-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={confirmDeleteAction} disabled={deleting}>
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
