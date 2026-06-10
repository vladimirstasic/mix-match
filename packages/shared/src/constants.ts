export const CHUNK_DURATION_SEC = 15;
export const MAX_FILE_SIZE = 300 * 1024 * 1024; // 300MB
export const SILENCE_THRESHOLD_DB = -50;
export const COAST_MODE_CONFIRM_COUNT = 3;
export const COAST_MODE_CHECK_INTERVAL = 4;
export const FINGERPRINT_SIMILARITY_THRESHOLD = 0.85;
export const ACRCLOUD_RETRY_COUNT = 3;
export const ACRCLOUD_RETRY_BASE_DELAY_MS = 1000;
export const ACRCLOUD_MIN_SCORE = 20;
export const REDIS_FINGERPRINT_TTL = 30 * 24 * 60 * 60;
export const REDIS_FILE_CACHE_TTL = 90 * 24 * 60 * 60;
export const ALLOWED_MIMETYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
  'audio/x-flac',
  'audio/mp4',
  'audio/x-m4a',
];

export function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const CHUNKS_TTL_HOURS = 24;
export const CHUNK_OVERLAP_SEC = 0;

export const ANALYSIS_MODES = {
  FAST: 'fast',
  DETAILED: 'detailed',
} as const;

export const PLANS = {
  FREE: 'free',
  PRO: 'pro',
  STUDIO: 'studio',
} as const;

export type Plan = (typeof PLANS)[keyof typeof PLANS];

export interface PlanLimits {
  scans: number;
  maxFileBytes: number;
  maxDurationSec: number;
  modes: readonly ('fast' | 'detailed')[];
  youtube: boolean;
  spotifyExport: boolean;
  priorityQueue: boolean;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  [PLANS.FREE]: {
    scans: 3,
    maxFileBytes: 100 * 1024 * 1024,
    maxDurationSec: 5400,
    modes: ['fast'],
    youtube: false,
    spotifyExport: false,
    priorityQueue: false,
  },
  [PLANS.PRO]: {
    scans: 15,
    maxFileBytes: 250 * 1024 * 1024,
    maxDurationSec: Number.POSITIVE_INFINITY,
    modes: ['fast', 'detailed'],
    youtube: true,
    spotifyExport: true,
    priorityQueue: false,
  },
  [PLANS.STUDIO]: {
    scans: 50,
    maxFileBytes: 500 * 1024 * 1024,
    maxDurationSec: Number.POSITIVE_INFINITY,
    modes: ['fast', 'detailed'],
    youtube: true,
    spotifyExport: true,
    priorityQueue: true,
  },
};

export const PLAN_PRICES: Record<Plan, number> = {
  [PLANS.FREE]: 0,
  [PLANS.PRO]: 6,
  [PLANS.STUDIO]: 12,
};

export const PLAN_FULL_PRICES: Record<Plan, number> = {
  [PLANS.FREE]: 0,
  [PLANS.PRO]: 9,
  [PLANS.STUDIO]: 19,
};

export const FOUNDING_MEMBER_SEATS = 100;

export const BETA_END_NOTICE_DAYS = 7;
export const BETA_SCANS_PER_MONTH = 5;
export const BETA_SCANS_PER_DAY = 2;

// Analysis modes — step between chunks (chunk is always 10s, ACRCloud uses first 10s)
export const FAST_STEP_SEC = 120; // 2 min — ~38 calls for 75min mix
export const DETAILED_STEP_SEC = 30; // 30s — ~150 calls for 75min mix
export const CHUNK_STEP_SEC = FAST_STEP_SEC; // default mode

// Post-aggregation consolidation: merge two segments of the SAME track when
// the gap between consecutive detections is <= this many seconds, even if
// other (spurious) tracks were detected in between. DJ replays of the same
// track are normally many minutes apart, so 150s safely collapses the
// "track A split into 3-5 pieces by transition false-positives" case while
// keeping a genuine later replay separate.
export const CONSOLIDATE_GAP_WINDOW_SEC = 150;
