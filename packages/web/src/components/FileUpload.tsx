import { useCallback, useRef, useState, type DragEvent } from "react";
import type { AnalysisMode } from "@mix-match/shared";
import { MAX_FILE_SIZE, ALLOWED_MIMETYPES } from "@mix-match/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  onFileSelected: (file: File, mode: AnalysisMode) => void;
  disabled?: boolean;
}

export function FileUpload({ onFileSelected, disabled }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AnalysisMode>("fast");
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

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  return (
    <div className="space-y-4">
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
          <p className="text-xs text-muted-foreground">MP3, WAV, FLAC, M4A — up to 200MB</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <div className="flex items-center justify-center gap-2">
        <Button
          variant={mode === "fast" ? "default" : "outline"}
          size="sm"
          onClick={(e) => { e.stopPropagation(); setMode("fast"); }}
        >
          Fast
        </Button>
        <Button
          variant={mode === "detailed" ? "default" : "outline"}
          size="sm"
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
