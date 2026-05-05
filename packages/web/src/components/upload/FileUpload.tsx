import { useCallback, useRef, useState, type DragEvent } from 'react';
import type { AnalysisMode } from '@mix-match/shared';
import { MAX_FILE_SIZE, ALLOWED_MIMETYPES } from '@mix-match/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link, Zap, Search, Upload } from 'lucide-react';

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

  if (pendingFile || pendingUrl) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setPendingFile(null); setPendingUrl(null); }}>
        <Card className="w-full max-w-md mx-4 glow-purple" onClick={e => e.stopPropagation()}>
          <CardContent className="pt-6 space-y-5">
            <h3 className="text-lg font-semibold text-center">Choose scan mode</h3>
            <p className="text-sm text-muted-foreground text-center truncate px-4">
              {pendingFile ? pendingFile.name : pendingUrl}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                className="flex flex-col items-center gap-3 p-5 rounded-xl border border-glass-border bg-muted/30 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 group"
                onClick={() => selectMode('fast')}
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <span className="font-medium">Fast</span>
                <span className="text-xs text-muted-foreground text-center">~20 seconds<br />Scans every 2 min</span>
              </button>
              <button
                className="flex flex-col items-center gap-3 p-5 rounded-xl border border-glass-border bg-muted/30 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 group"
                onClick={() => selectMode('detailed')}
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Search className="w-5 h-5 text-primary" />
                </div>
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
      <div className="flex items-center justify-center gap-1 p-1 rounded-xl bg-glass-bg border border-glass-border w-fit mx-auto">
        <Button variant={tab === 'file' ? 'secondary' : 'ghost'} size="sm" onClick={() => { setTab('file'); setError(null); }}>
          <Upload className="w-3.5 h-3.5 mr-1.5" />
          Upload File
        </Button>
        <Button variant={tab === 'url' ? 'secondary' : 'ghost'} size="sm" onClick={() => { setTab('url'); setError(null); }}>
          <Link className="w-3.5 h-3.5 mr-1.5" />
          Paste URL
        </Button>
      </div>

      {tab === 'file' ? (
        <div
          className={`rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300 ${
            dragOver
              ? 'border-primary bg-primary/5 glow-purple'
              : 'border-border hover:border-primary/40 hover:bg-muted/30'
          } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <input
              ref={inputRef}
              type="file"
              accept=".mp3,.wav,.flac,.m4a"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              hidden
            />
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Upload className="w-6 h-6 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-medium">Drop your DJ mix here</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
            </div>
            <p className="text-xs text-muted-foreground">MP3, WAV, FLAC, M4A — up to 300MB</p>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>
      ) : (
        <Card className={disabled ? 'opacity-50 pointer-events-none' : ''}>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Link className="w-6 h-6 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-medium">Paste a URL to scan</p>
              <p className="text-sm text-muted-foreground mt-1">YouTube, SoundCloud, Mixcloud or direct audio link</p>
            </div>
            <input
              type="url"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleUrlSubmit(); }}
              placeholder="https://youtube.com/watch?v=..."
              className="w-full max-w-md px-4 py-2.5 rounded-xl border border-border bg-glass-bg backdrop-blur-sm text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 transition-all"
            />
            <Button onClick={handleUrlSubmit} disabled={!urlInput.trim()}>Scan</Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
