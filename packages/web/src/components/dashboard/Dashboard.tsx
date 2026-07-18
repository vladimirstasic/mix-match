import { useState, useEffect } from 'react';
import { ANALYSIS_STATUS } from '../../constants';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { EqualizerLoader } from '@/components/ui/equalizer-loader';
import { getUserAnalyses, deleteAnalysis, toggleFavorite, type AnalysisSummary } from '../../api/client';
import { Loader2, Star } from 'lucide-react';

interface Props {
  onSelectAnalysis: (id: string) => void;
}

const formatDate = (iso: string) => {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const isActive = (a: AnalysisSummary) =>
  a.status === ANALYSIS_STATUS.PROCESSING || a.status === ANALYSIS_STATUS.PENDING;

const statusLabel = (a: AnalysisSummary) => {
  switch (a.status) {
    case ANALYSIS_STATUS.COMPLETED:
      return 'OK';
    case ANALYSIS_STATUS.PROCESSING:
    case ANALYSIS_STATUS.PENDING:
      return 'SCAN…';
    case ANALYSIS_STATUS.FAILED:
      return 'ERR';
    default:
      return a.status.toUpperCase();
  }
};

export function Dashboard({ onSelectAnalysis }: Props) {
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  useEffect(() => {
    getUserAnalyses()
      .then(setAnalyses)
      .finally(() => setLoading(false));
  }, []);

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

  if (loading) {
    return (
      <div className="rl-state" aria-live="polite" aria-busy="true">
        <EqualizerLoader />
        <span className="rl-state-label">LOADING SCANS…</span>
      </div>
    );
  }

  if (analyses.length === 0) {
    return (
      <div className="rl-state">
        <span className="rl-state-label">NO SCANS YET</span>
      </div>
    );
  }

  const visible = favoritesOnly ? analyses.filter(a => a.isFavorite) : analyses;

  return (
    <>
      <div className="rl-filter">
        <button
          type="button"
          className={`rl-fav-toggle ${favoritesOnly ? 'active' : ''}`}
          onClick={() => setFavoritesOnly(v => !v)}
        >
          <Star className="w-3 h-3" fill={favoritesOnly ? 'currentColor' : 'none'} />
          FAVORITES
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="rl-state">
          <span className="rl-state-label">NO FAVORITES YET</span>
        </div>
      ) : (
        <ul className="recent-list">
          {visible.slice(0, 12).map(a => (
            <li key={a.id} onClick={() => onSelectAnalysis(a.id)}>
              <button
                type="button"
                className={`rl-fav-star ${a.isFavorite ? 'active' : ''}`}
                onClick={e => handleToggleFavorite(e, a.id)}
                aria-label="Toggle favorite"
              >
                <Star className="w-3 h-3" fill={a.isFavorite ? 'currentColor' : 'none'} />
              </button>
              <span className="rl-name">{a.filename}</span>
              <span className="rl-stat">{isActive(a) ? <EqualizerLoader label="Scanning" /> : statusLabel(a)}</span>
              <span className="rl-date">{formatDate(a.createdAt)}</span>
            </li>
          ))}
        </ul>
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
    </>
  );
}
