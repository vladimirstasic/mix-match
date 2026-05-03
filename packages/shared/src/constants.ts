export const CHUNK_DURATION_SEC = 10;
export const MAX_FILE_SIZE = 300 * 1024 * 1024; // 300MB
export const SILENCE_THRESHOLD_DB = -40;
export const COAST_MODE_CONFIRM_COUNT = 3;
export const COAST_MODE_CHECK_INTERVAL = 4;
export const FINGERPRINT_SIMILARITY_THRESHOLD = 0.85;
export const ACRCLOUD_RETRY_COUNT = 3;
export const ACRCLOUD_RETRY_BASE_DELAY_MS = 1000;
export const ACRCLOUD_MIN_SCORE = 30;
export const REDIS_FINGERPRINT_TTL = 30 * 24 * 60 * 60;
export const REDIS_FILE_CACHE_TTL = 90 * 24 * 60 * 60;
export const ALLOWED_MIMETYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
  "audio/x-flac",
  "audio/mp4",
  "audio/x-m4a",
];

export const CHUNKS_TTL_HOURS = 24;
export const CHUNK_OVERLAP_SEC = 0;

// Analysis modes — step between chunks (chunk is always 10s, ACRCloud uses first 10s)
export const FAST_STEP_SEC = 120;    // 2 min — ~38 calls for 75min mix
export const DETAILED_STEP_SEC = 30; // 30s — ~150 calls for 75min mix
export const CHUNK_STEP_SEC = FAST_STEP_SEC; // default mode
