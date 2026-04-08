import { useCallback, useRef, useState, type DragEvent } from "react";
import { MAX_FILE_SIZE, ALLOWED_MIMETYPES } from "@mix-detective/shared";

interface Props {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

export function FileUpload({ onFileSelected, disabled }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    onFileSelected(file);
  }, [onFileSelected]);

  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  return (
    <div
      className={`upload-zone ${dragOver ? "drag-over" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      style={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? "none" : "auto" }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".mp3,.wav,.flac,.m4a"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        hidden
      />
      <p className="upload-icon">🎵</p>
      <p>Drop your DJ mix here or click to browse</p>
      <p className="upload-hint">MP3, WAV, FLAC, M4A — up to 200MB</p>
      {error && <p className="upload-error">{error}</p>}
    </div>
  );
}
