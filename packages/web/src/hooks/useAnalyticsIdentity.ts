import { useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { identifyUser, resetAnalytics } from '../lib/analytics';

// Ties browser events to the Clerk user id, which is the same distinct_id the API
// uses for its server-side events (analyses.userId references users.clerkId), so
// client and server events land on one person instead of two.
export function useAnalyticsIdentity() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const wasSignedIn = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn && userId) {
      identifyUser(userId);
      wasSignedIn.current = true;
    } else if (wasSignedIn.current) {
      resetAnalytics();
      wasSignedIn.current = false;
    }
  }, [isLoaded, isSignedIn, userId]);
}
