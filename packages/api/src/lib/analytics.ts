import { PostHog } from 'posthog-node';
import { config } from '../config.js';

const client = config.posthog.apiKey
  ? new PostHog(config.posthog.apiKey, { host: config.posthog.host, flushAt: 1, flushInterval: 0 })
  : null;

// No-ops entirely until POSTHOG_API_KEY is set — safe to call from anywhere
// without an env-var check at every call site.
export function trackServer(distinctId: string, event: string, properties?: Record<string, unknown>) {
  client?.capture({ distinctId, event, properties });
}
