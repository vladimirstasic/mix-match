import { useCallback, useRef, useState, type DragEvent } from "react";
import type { AnalysisMode } from "@mix-match/shared";
import { MAX_FILE_SIZE, ALLOWED_MIMETYPES } from "@mix-match/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "lucide-react";

interface Props {
  onFileSelected: (file: File, mode: AnalysisMode) => void;
  onUrlSubmitted: (url: string, mode: AnalysisMode) => void;
  disabled?: boolean;
}

export function FileUpload({ onFileSelected, onUrlSubmitted, disabled }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AnalysisMode>("fast");
  const [tab, setTab] = useState<"file" | "url">("file");
  const [urlInput, setUrlInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) return `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`;
    if (!ALLOWED_MIMETYPES.includes(file.type) && !file.name.match(/\.(mp3|wav|flac|m4a)$/i)) {
      return "Unsupported file type. Use MP3, WAV, FLAC, or M4A.";
    }
    return null;
  };

  const handleFile = useCallback((file: File) => {
    const err = validate(file);
    if (err) { setError(err); return; }
    setError(null);
    onFileSelected(file, mode);
  }, [onFileSelected, mode]);

  const handleUrlSubmit = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setError("Please enter a URL");
      return;
    }
    try {
      new URL(trimmed);
    } catch {
      setError("Please enter a valid URL");
      return;
    }
    setError(null);
    onUrlSubmitted(trimmed, mode);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2">
        <Button
          variant={tab === "file" ? "default" : "ghost"}
          size="sm"
          onClick={() => { setTab("file"); setError(null); }}
        >
          Upload File
        </Button>
        <Button
          variant={tab === "url" ? "default" : "ghost"}
          size="sm"
          onClick={() => { setTab("url"); setError(null); }}
        >
          <Link className="w-4 h-4 mr-1" />
          Paste URL
        </Button>
      </div>

      {tab === "file" ? (
        <Card
          className={`border-2 border-dashed cursor-pointer transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
          } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <input
              ref={inputRef}
              type="file"
              accept=".mp3,.wav,.flac,.m4a"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
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
        <Card className={disabled ? "opacity-50 pointer-events-none" : ""}>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="text-5xl"><Link className="w-12 h-12 text-muted-foreground" /></div>
            <div className="text-center">
              <p className="text-lg font-medium">Paste a URL to scan</p>
              <p className="text-sm text-muted-foreground mt-1">YouTube, SoundCloud, or direct audio link</p>
            </div>
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleUrlSubmit(); }}
              placeholder="https://youtube.com/watch?v=... or soundcloud.com/..."
              className="w-full max-w-md px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button onClick={handleUrlSubmit} disabled={!urlInput.trim()}>
              Scan
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-center gap-2">
        <Button
          variant={mode === "fast" ? "default" : "outline"}
          size="sm"
          className="text-xs sm:text-sm"
          onClick={(e) => { e.stopPropagation(); setMode("fast"); }}
        >
          Fast
        </Button>
        <Button
          variant={mode === "detailed" ? "default" : "outline"}
          size="sm"
          className="text-xs sm:text-sm"
          onClick={(e) => { e.stopPropagation(); setMode("detailed"); }}
        >
          Detailed
        </Button>
        <span className="text-xs text-muted-foreground ml-2">
          {mode === "fast" ? "Scans every 2 min — quick overview" : "Scans every 30s — more accurate"}
        </span>
      </div>
    </div>
  );
}
