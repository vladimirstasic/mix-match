import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { PLANS, PLAN_LIMITS, BETA_SCANS_PER_MONTH, BETA_SCANS_PER_DAY, type Plan } from '@mix-match/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Crown, Loader2, CheckCircle2, Sparkles, Rocket } from 'lucide-react';
import { getUserProfile } from '../api/client';
import { openPortal } from '../api/billing';

interface Profile {
  username: string | null;
  plan: string;
  creditsRemaining: number;
  creditsResetAt: string | null;
  isFoundingMember: boolean;
  betaMode: boolean;
}

export function AccountPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load(retries = 3) {
      const data = await getUserProfile();
      if (cancelled) return;
      if (data) {
        setProfile(data);
        setLoading(false);
      } else if (retries > 0) {
        setTimeout(() => load(retries - 1), 1500);
      } else {
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePortal = async () => {
    setPortalLoading(true);
    setError(null);
    try {
      const url = await openPortal();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open billing portal');
      setPortalLoading(false);
    }
  };

  const plan = (profile?.plan ?? PLANS.FREE) as Plan;
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS[PLANS.FREE];
  const used = Math.max(0, limits.scans - (profile?.creditsRemaining ?? 0));
  const resetDate = profile?.creditsResetAt ? new Date(profile.creditsResetAt) : null;

  return (
    <>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <SignedIn>
        <div className="min-h-screen bg-background text-foreground">
          <div className="mx-auto max-w-2xl px-6 py-12">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </Link>

            <h1 className="text-3xl font-bold mb-8">Account</h1>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : profile?.betaMode ? (
              <div className="space-y-6">
                <Card className="border-primary/40 shadow-lg shadow-primary/10">
                  <CardContent className="p-6 flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Rocket className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                          <Sparkles className="w-3 h-3" />
                          Beta Member
                        </span>
                        <h2 className="text-xl font-semibold mt-2">All premium features unlocked</h2>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Beta scans used this month</span>
                        <span className="text-sm font-medium">
                          {Math.max(0, BETA_SCANS_PER_MONTH - (profile?.creditsRemaining ?? 0))} /{' '}
                          {BETA_SCANS_PER_MONTH}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{
                            width: `${Math.min(100, (Math.max(0, BETA_SCANS_PER_MONTH - (profile?.creditsRemaining ?? 0)) / BETA_SCANS_PER_MONTH) * 100)}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Daily cap: {BETA_SCANS_PER_DAY} scans/day. Resets at midnight UTC.
                      </p>
                    </div>

                    <p className="text-xs text-muted-foreground border-t border-border/50 pt-3">
                      We'll announce Beta end at least 7 days in advance via email. First 100 to subscribe afterwards
                      lock in lifetime Founding Member pricing — $6/mo Pro or $12/mo Studio.
                    </p>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="space-y-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <p className="text-sm text-muted-foreground">Current plan</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Crown className="w-5 h-5 text-primary" />
                          <h2 className="text-2xl font-semibold capitalize">{plan}</h2>
                          {profile?.isFoundingMember && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                              <Sparkles className="w-3 h-3" />
                              Founding Member
                            </span>
                          )}
                        </div>
                        {profile?.isFoundingMember && (
                          <p className="text-xs text-muted-foreground mt-2">Lifetime pricing locked in.</p>
                        )}
                      </div>
                      {plan === PLANS.FREE ? (
                        <Link to="/pricing">
                          <Button>Upgrade</Button>
                        </Link>
                      ) : (
                        <Button variant="outline" onClick={handlePortal} disabled={portalLoading}>
                          {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Manage billing'}
                        </Button>
                      )}
                    </div>

                    <div>
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Scans used this period</span>
                        <span className="text-sm font-medium">
                          {used} / {limits.scans}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${Math.min(100, (used / limits.scans) * 100)}%` }}
                        />
                      </div>
                      {resetDate && (
                        <p className="text-xs text-muted-foreground mt-2">Resets on {resetDate.toLocaleDateString()}</p>
                      )}
                    </div>

                    {error && <p className="text-sm text-destructive mt-4">{error}</p>}
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6 space-y-3">
                    <h3 className="font-semibold">Plan features</h3>
                    <ul className="text-sm space-y-2 text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                        Up to {Math.round(limits.maxFileBytes / 1024 / 1024)} MB uploads
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                        {limits.modes.includes('detailed') ? 'Fast + detailed scan modes' : 'Fast scan mode only'}
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                        SoundCloud, Mixcloud, upload
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                        Spotify playlist export {limits.spotifyExport ? '' : '(upgrade required)'}
                      </li>
                      {limits.priorityQueue && (
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                          Priority queue
                        </li>
                      )}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </SignedIn>
    </>
  );
}
