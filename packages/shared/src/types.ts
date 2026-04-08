export type AnalysisStatus = "pending" | "processing" | "completed" | "failed";

export interface TrackMatch {
  track: string;
  start: string; // "mm:ss"
  end: string;
}

export interface RawMatch {
  artist: string;
  title: string;
  acrid: string;
  album?: string;
  startSec: number;
}

export interface AnalysisResult {
  id: string;
  filename: string;
  fileSize: number;
  status: AnalysisStatus;
  totalChunks: number | null;
  processedChunks: number;
  results: TrackMatch[] | null;
  metrics: AnalysisMetrics | null;
  error: string | null;
  createdAt: string;
}

export interface AnalysisMetrics {
  totalChunks: number;
  silenceSkipped: number;
  coastSkipped: number;
  dedupSkipped: number;
  cacheHits: number;
  apiCalls: number;
  apiSavingsPercent: number;
  processingTimeMs: number;
  avgApiLatencyMs: number;
}

export interface ProgressEvent {
  type: "progress" | "completed" | "failed";
  chunksProcessed?: number;
  totalChunks?: number;
  currentTrack?: string;
  results?: TrackMatch[];
  error?: string;
}

export interface UploadResponse {
  analysisId: string;
}
