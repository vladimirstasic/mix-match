export const CHUNK_DURATION_SEC = 15;
export const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB
export const SILENCE_THRESHOLD_DB = -40;
export const COAST_MODE_CONFIRM_COUNT = 3;
export const COAST_MODE_CHECK_INTERVAL = 4;
export const FINGERPRINT_SIMILARITY_THRESHOLD = 0.85;
export const ACRCLOUD_RETRY_COUNT = 3;
export const ACRCLOUD_RETRY_BASE_DELAY_MS = 1000;
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
export const CHUNK_OVERLAP_SEC = 5;
export const CHUNK_STEP_SEC = CHUNK_DURATION_SEC - CHUNK_OVERLAP_SEC; // 10
