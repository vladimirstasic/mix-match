import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getUserAnalyses, deleteAnalysis, type AnalysisSummary } from '../../api/client';
import { Loader2 } from 'lucide-react';

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

const statusLabel = (a: AnalysisSummary) => {
  switch (a.status) {
    case 'completed':
      return 'OK';
    case 'processing':
    case 'pending':
      return 'SCAN…';
    case 'failed':
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

  if (loading) {
    return <div className="rl-empty">LOADING…</div>;
  }

  if (analyses.length === 0) {
    return <div className="rl-empty">NO SCANS YET</div>;
  }

  return (
    <>
      <ul className="recent-list">
        {analyses.slice(0, 12).map(a => (
          <li key={a.id} onClick={() => onSelectAnalysis(a.id)}>
            <span className="rl-name">{a.filename}</span>
            <span className="rl-stat">{statusLabel(a)}</span>
            <span className="rl-date">{formatDate(a.createdAt)}</span>
          </li>
        ))}
      </ul>

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
