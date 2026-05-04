export const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const POLL_INTERVAL_MS = 3000;
export const POLL_RETRY_MS = 5000;
export const RETRY_POLL_MS = 2000;

// View modes
export const VIEW = {
  HOME: 'home',
  COMPARE: 'compare',
  MANUAL: 'manual',
  FEED: 'feed',
} as const;

// These are already in @mix-match/shared types, but useful as runtime constants
export const PHASE = {
  IDLE: 'idle',
  UPLOADING: 'uploading',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export const SEGMENT_STATUS = {
  IDENTIFIED: 'identified',
  UNKNOWN: 'unknown',
  RETRYING: 'retrying',
} as const;
