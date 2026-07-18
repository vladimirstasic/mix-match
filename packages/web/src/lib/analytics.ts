import posthog from 'posthog-js';

const API_KEY = import.meta.env.VITE_POSTHOG_KEY;
const API_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

let enabled = false;

// No-ops entirely until VITE_POSTHOG_KEY is set — safe to call from anywhere
// without an env-var check at every call site.
export function initAnalytics() {
  if (!API_KEY) return;
  posthog.init(API_KEY, { api_host: API_HOST, capture_pageview: true, person_profiles: 'identified_only' });
  enabled = true;
}

export function track(event: string, props?: Record<string, unknown>) {
  if (!enabled) return;
  posthog.capture(event, props);
}

export function identifyUser(userId: string) {
  if (!enabled) return;
  posthog.identify(userId);
}
