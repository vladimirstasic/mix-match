import { useState } from 'react';
import type { Segment } from '@mix-match/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { apiFetch } from '../../api/client';

interface Props {
  open: boolean;
  onClose: () => void;
  segments: Segment[];
  analysisId: string;
  filename?: string | null;
}

export function SpotifyPlaylistModal({ open, onClose, segments, analysisId, filename }: Props) {
  const tracks = segments
    .filter(s => s.status === 'identified' && s.externalLinks && (s.externalLinks as Record<string, string>).spotify)
    .map(s => {
      const links = s.externalLinks as Record<string, string>;
      const match = links.spotify.match(/track\/([a-zA-Z0-9]+)/);
      return {
        id: s.id,
        name: s.trackName || 'Unknown',
        uri: match ? `spotify:track:${match[1]}` : null,
        isDuplicate: false,
      };
    })
    .filter(t => t.uri);

  const seen = new Set<string>();
  for (const t of tracks) {
    if (seen.has(t.uri!)) t.isDuplicate = true;
    else seen.add(t.uri!);
  }

  const [selected, setSelected] = useState<Set<string>>(() => {
    return new Set(tracks.filter(t => !t.isDuplicate).map(t => t.id));
  });
  const [playlistName, setPlaylistName] = useState(filename ? `${filename} — MixMatch` : 'MixMatch Tracklist');
  const [creating, setCreating] = useState(false);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(tracks.map(t => t.id)));
  const deselectAll = () => setSelected(new Set());

  const handleCreate = async () => {
    const selectedUris = tracks.filter(t => selected.has(t.id)).map(t => t.uri!);
    if (selectedUris.length === 0) return;

    setCreating(true);
    try {
      const res = await apiFetch('/spotify/prepare', {
        method: 'POST',
        body: JSON.stringify({ analysisId, playlistName, selectedUris }),
      });
      const { token } = await res.json();
      const apiBase = import.meta.env.VITE_API_URL || '/api';
      window.location.href = `${apiBase}/spotify/auth?token=${token}`;
    } catch {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogTitle>Create Spotify Playlist</DialogTitle>
        <input
          type="text"
          value={playlistName}
          onChange={e => setPlaylistName(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {selected.size} of {tracks.length} tracks selected
          </span>
          <div className="flex gap-2">
            <button className="hover:text-foreground" onClick={selectAll}>
              Select all
            </button>
            <button className="hover:text-foreground" onClick={deselectAll}>
              Deselect all
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {tracks.map(t => (
            <label key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent cursor-pointer">
              <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} className="rounded" />
              <span className={`text-sm truncate ${t.isDuplicate ? 'text-muted-foreground line-through' : ''}`}>
                {t.name}
              </span>
              {t.isDuplicate && <span className="text-[10px] text-yellow-500 shrink-0">duplicate</span>}
            </label>
          ))}
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={creating}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleCreate} disabled={creating || selected.size === 0}>
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : `Create Playlist (${selected.size})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
