import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Save } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

interface Track {
  artist: string;
  title: string;
  startMin: string;
  startSec: string;
}

interface Props {
  onCreated: (analysisId: string) => void;
  onBack: () => void;
}

export function ManualTracklist({ onCreated, onBack }: Props) {
  const [mixTitle, setMixTitle] = useState("");
  const [tracks, setTracks] = useState<Track[]>([{ artist: "", title: "", startMin: "0", startSec: "0" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addTrack = () => {
    setTracks([...tracks, { artist: "", title: "", startMin: "0", startSec: "0" }]);
  };

  const removeTrack = (i: number) => {
    setTracks(tracks.filter((_, idx) => idx !== i));
  };

  const updateTrack = (i: number, field: keyof Track, value: string) => {
    setTracks(tracks.map((t, idx) => idx === i ? { ...t, [field]: value } : t));
  };

  const save = async () => {
    if (!mixTitle.trim()) { setError("Mix title required"); return; }
    if (tracks.some(t => !t.artist.trim() || !t.title.trim())) { setError("All tracks need artist and title"); return; }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: mixTitle,
        tracks: tracks.map((t, i) => {
          const startSec = parseInt(t.startMin) * 60 + parseInt(t.startSec || "0");
          const nextTrack = tracks[i + 1];
          const endSec = nextTrack ? parseInt(nextTrack.startMin) * 60 + parseInt(nextTrack.startSec || "0") : startSec + 300;
          return {
            artist: t.artist,
            title: t.title,
            trackName: `${t.artist} - ${t.title}`,
            startSec,
            endSec,
          };
        }),
      };

      const res = await fetch(`${API_BASE}/analysis/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save");
      const { analysisId } = await res.json();
      onCreated(analysisId);
    } catch {
      setError("Failed to save tracklist");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>Back</Button>
        <h2 className="text-xl font-semibold">Manual Tracklist</h2>
      </div>

      <input
        value={mixTitle}
        onChange={e => setMixTitle(e.target.value)}
        placeholder="Mix title..."
        className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />

      {tracks.map((track, i) => (
        <Card key={i}>
          <CardContent className="py-3 flex items-center gap-2">
            <div className="flex gap-1 items-center shrink-0">
              <input value={track.startMin} onChange={e => updateTrack(i, "startMin", e.target.value)} className="w-10 px-1 py-1 text-center text-xs rounded border border-input bg-background" placeholder="0" />
              <span className="text-xs text-muted-foreground">:</span>
              <input value={track.startSec} onChange={e => updateTrack(i, "startSec", e.target.value)} className="w-10 px-1 py-1 text-center text-xs rounded border border-input bg-background" placeholder="00" />
            </div>
            <input value={track.artist} onChange={e => updateTrack(i, "artist", e.target.value)} placeholder="Artist" className="flex-1 px-2 py-1 text-sm rounded border border-input bg-background" />
            <span className="text-muted-foreground">—</span>
            <input value={track.title} onChange={e => updateTrack(i, "title", e.target.value)} placeholder="Title" className="flex-1 px-2 py-1 text-sm rounded border border-input bg-background" />
            {tracks.length > 1 && (
              <Button variant="ghost" size="sm" onClick={() => removeTrack(i)}><Trash2 className="w-3 h-3" /></Button>
            )}
          </CardContent>
        </Card>
      ))}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={addTrack}><Plus className="w-4 h-4 mr-1" /> Add Track</Button>
        <Button onClick={save} disabled={saving} className="ml-auto">
          <Save className="w-4 h-4 mr-1" /> {saving ? "Saving..." : "Save Tracklist"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
