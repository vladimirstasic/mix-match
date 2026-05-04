export type AnalysisStatus = "pending" | "processing" | "completed" | "failed";

export interface TrackMatch {
  track: string;
  start: string; // "mm:ss"
  end: string;
  acrid?: string;
  bpm?: number | null;
  genre?: string | null;
  externalLinks?: ExternalLinks;
}

export interface ExternalLinks {
  spotify?: string;
  beatport?: string;
  appleMusic?: string;
  youtube?: string;
  deezer?: string;
}

export interface RawMatch {
  artist: string;
  title: string;
  acrid: string;
  album?: string;
  score?: number;
  bpm?: number;
  genre?: string;
  durationMs?: number;
  startSec: number;
  externalLinks?: ExternalLinks;
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
  tracksFound?: number;
  results?: TrackMatch[];
  error?: string;
}

export type AnalysisMode = "fast" | "detailed";

export interface UploadResponse {
  analysisId: string;
}

export type SegmentStatus = "identified" | "unknown" | "retrying";

export interface Segment {
  id: string;
  analysisId: string;
  startSec: number;
  endSec: number;
  status: SegmentStatus;
  trackName: string | null;
  artist: string | null;
  title: string | null;
  acrid: string | null;
  bpm: number | null;
  genre: string | null;
  confidence: number | null;
  externalLinks: ExternalLinks | null;
  isBookmarked: boolean;
  attempts: number;
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisWithSegments extends Omit<AnalysisResult, "results"> {
  segments: Segment[];
  chunksAvailable: boolean;
  chunksExpireAt: string | null;
  results: TrackMatch[] | null;
}
