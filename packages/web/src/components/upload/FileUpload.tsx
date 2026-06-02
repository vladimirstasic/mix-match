import { useCallback, useRef, useState, type DragEvent } from 'react';
import type { AnalysisMode } from '@mix-match/shared';
import { MAX_FILE_SIZE, ALLOWED_MIMETYPES } from '@mix-match/shared';
import { Button } from '@/components/ui/button';

interface Props {
  onFileSelected: (file: File, mode: AnalysisMode) => void;
  onUrlSubmitted: (url: string, mode: AnalysisMode) => void;
  disabled?: boolean;
}

type Tab = 'file' | 'url';

export function FileUpload({ onFileSelected, onUrlSubmitted, disabled }: Props) {
  const [tab, setTab] = useState<Tab>('file');
  const [mode, setMode] = useState<AnalysisMode>('fast');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState('');
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
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setPendingFile(file);
  }, []);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  const validateUrl = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed) return 'Please enter a URL';
    try {
      new URL(trimmed);
    } catch {
      return 'Please enter a valid URL';
    }
    if (/(?:youtube\.com|youtu\.be)/i.test(trimmed)) {
      return 'YouTube is still in Beta. Try SoundCloud, Mixcloud, or upload an MP3 file.';
    }
    return null;
  };

  const run = () => {
    if (tab === 'file') {
      if (!pendingFile) {
        setError('Drop or select a file first');
        return;
      }
      onFileSelected(pendingFile, mode);
      setPendingFile(null);
    } else {
      const err = validateUrl(urlInput);
      if (err) {
        setError(err);
        return;
      }
      setError(null);
      onUrlSubmitted(urlInput.trim(), mode);
      setUrlInput('');
    }
  };

  const canRun = tab === 'file' ? !!pendingFile : urlInput.trim().length > 0;

  return (
    <div className={`border border-border bg-card ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <span className="label-comment">INPUT — NEW SCAN</span>
        <span className="label-mono">SRC: {tab === 'file' ? 'FILE' : 'URL'}</span>
      </div>

      <div className="grid grid-cols-2">
        <button
          className={`px-4 py-3 font-mono uppercase tracking-[0.08em] text-xs border-r border-border transition-colors ${
            tab === 'file' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => {
            setTab('file');
            setError(null);
          }}
        >
          Upload
        </button>
        <button
          className={`px-4 py-3 font-mono uppercase tracking-[0.08em] text-xs transition-colors ${
            tab === 'url' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => {
            setTab('url');
            setError(null);
          }}
        >
          URL
        </button>
      </div>

      <div className="p-4 space-y-3">
        {tab === 'file' ? (
          <div
            className={`border border-dashed py-10 px-4 text-center cursor-pointer transition-colors ${
              dragOver ? 'border-primary' : 'border-border hover:border-primary/60'
            }`}
            onDragOver={e => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".mp3,.wav,.flac,.m4a"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              hidden
            />
            <span className="label-mono-strong">
              <span className="text-primary">▲ </span>
              {pendingFile ? pendingFile.name : 'DROP MP3 · WAV · FLAC · M4A — or click · up to 300MB'}
            </span>
          </div>
        ) : (
          <input
            type="url"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') run();
            }}
            placeholder="https://soundcloud.com/... or mixcloud.com/..."
            className="w-full px-4 py-3 border border-border bg-transparent font-mono text-sm focus:outline-none focus:border-primary"
          />
        )}

        <div className="flex items-center gap-2">
          <span className="label-mono mr-1">MODE</span>
          <button
            className={`px-3 py-2 font-mono uppercase tracking-[0.08em] text-xs border transition-colors ${
              mode === 'fast'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-foreground hover:border-primary'
            }`}
            onClick={() => setMode('fast')}
          >
            Fast <i className={`not-italic ${mode === 'fast' ? 'opacity-70' : 'opacity-50'}`}>~20s</i>
          </button>
          <button
            className={`px-3 py-2 font-mono uppercase tracking-[0.08em] text-xs border transition-colors ${
              mode === 'detailed'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-foreground hover:border-primary'
            }`}
            onClick={() => setMode('detailed')}
          >
            Detailed <i className={`not-italic ${mode === 'detailed' ? 'opacity-70' : 'opacity-50'}`}>~2min</i>
          </button>
        </div>

        <Button className="clip-bevel w-full" size="lg" disabled={!canRun} onClick={run}>
          Run Analysis
        </Button>

        {error && <p className="text-sm text-destructive font-mono">{error}</p>}
      </div>
    </div>
  );
}
