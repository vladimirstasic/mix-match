import { useCallback, useRef, useState, type DragEvent } from 'react';
import type { AnalysisMode } from '@mix-match/shared';
import { MAX_FILE_SIZE, ALLOWED_MIMETYPES } from '@mix-match/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link, Zap, Search } from 'lucide-react';

interface Props {
  onFileSelected: (file: File, mode: AnalysisMode) => void;
  onUrlSubmitted: (url: string, mode: AnalysisMode) => void;
  disabled?: boolean;
}

export function FileUpload({ onFileSelected, onUrlSubmitted, disabled }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'file' | 'url'>('file');
  const [urlInput, setUrlInput] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) return `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`;
    if (!ALLOWED_MIMETYPES.includes(file.type) && !file.name.match(/\.(mp3|wav|flac|m4a)$/i)) {
      return 'Unsupported file type. Use MP3, WAV, FLAC, or M4A.';
    }
    return null;
  };

  const handleFile = useCallback((file: File) => {
    const err = validate(file);
    if (err) { setError(err); return; }
    setError(null);
    setPendingFile(file);
  }, []);

  const handleUrlSubmit = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) { setError('Please enter a URL'); return; }
    try { new URL(trimmed); } catch { setError('Please enter a valid URL'); return; }
    setError(null);
    setPendingUrl(trimmed);
  };

  const selectMode = (mode: AnalysisMode) => {
    if (pendingFile) {
      onFileSelected(pendingFile, mode);
      setPendingFile(null);
    } else if (pendingUrl) {
      onUrlSubmitted(pendingUrl, mode);
      setPendingUrl(null);
      setUrlInput('');
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  // Mode selection modal
  if (pendingFile || pendingUrl) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setPendingFile(null); setPendingUrl(null); }}>
        <Card className="w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
          <CardContent className="pt-6 space-y-4">
            <h3 className="text-lg font-semibold text-center">Choose scan mode</h3>
            <p className="text-sm text-muted-foreground text-center">
              {pendingFile ? pendingFile.name : pendingUrl}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors"
                onClick={() => selectMode('fast')}
              >
                <Zap className="w-6 h-6 text-primary" />
                <span className="font-medium">Fast</span>
                <span className="text-xs text-muted-foreground text-center">~20 seconds<br />Scans every 2 min</span>
              </button>
              <button
                className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors"
                onClick={() => selectMode('detailed')}
              >
                <Search className="w-6 h-6 text-primary" />
                <span className="font-medium">Detailed</span>
                <span className="text-xs text-muted-foreground text-center">~2 minutes<br />Scans every 30s</span>
              </button>
            </div>
            <p className="text-xs text-muted-foreground text-center">Click outside to cancel</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2">
        <Button variant={tab === 'file' ? 'default' : 'ghost'} size="sm" onClick={() => { setTab('file'); setError(null); }}>
          Upload File
        </Button>
        <Button variant={tab === 'url' ? 'default' : 'ghost'} size="sm" onClick={() => { setTab('url'); setError(null); }}>
          <Link className="w-4 h-4 mr-1" />
          Paste URL
        </Button>
      </div>

      {tab === 'file' ? (
        <Card
          className={`border-2 border-dashed cursor-pointer transition-colors ${
            dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
          } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <input
              ref={inputRef}
              type="file"
              accept=".mp3,.wav,.flac,.m4a"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              hidden
            />
            <div className="text-5xl">🎵</div>
            <div className="text-center">
              <p className="text-lg font-medium">Drop your DJ mix here</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
            </div>
            <p className="text-xs text-muted-foreground">MP3, WAV, FLAC, M4A — up to 300MB</p>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      ) : (
        <Card className={disabled ? 'opacity-50 pointer-events-none' : ''}>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="text-5xl"><Link className="w-12 h-12 text-muted-foreground" /></div>
            <div className="text-center">
              <p className="text-lg font-medium">Paste a URL to scan</p>
              <p className="text-sm text-muted-foreground mt-1">YouTube, SoundCloud, Mixcloud or direct audio link</p>
            </div>
            <input
              type="url"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleUrlSubmit(); }}
              placeholder="https://youtube.com/watch?v=... or soundcloud.com/..."
              className="w-full max-w-md px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button onClick={handleUrlSubmit} disabled={!urlInput.trim()}>Scan</Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
