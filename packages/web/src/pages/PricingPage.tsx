import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton } from '@clerk/clerk-react';
import { PLANS, PLAN_LIMITS, PLAN_PRICES, PLAN_FULL_PRICES, type Plan } from '@mix-match/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Zap, Crown, Star, ArrowLeft, Loader2, Sparkles, Rocket } from 'lucide-react';
import { createCheckout, getFoundingStatus, type FoundingStatus } from '../api/billing';
import { getUserProfile } from '../api/client';

interface TierConfig {
  plan: Plan;
  name: string;
  tagline: string;
  icon: typeof Zap;
  highlight?: boolean;
  features: string[];
}

const TIERS: TierConfig[] = [
  {
    plan: PLANS.FREE,
    name: 'Free',
    tagline: 'Try it out',
    icon: Zap,
    features: [
      `${PLAN_LIMITS.free.scans} scans per month`,
      'SoundCloud, Mixcloud, file upload',
      `Up to ${Math.round(PLAN_LIMITS.free.maxFileBytes / 1024 / 1024)} MB uploads`,
      'Fast scan mode (every 2 min)',
    ],
  },
  {
    plan: PLANS.PRO,
    name: 'Pro',
    tagline: 'For DJs and crate diggers',
    icon: Crown,
    highlight: true,
    features: [
      `${PLAN_LIMITS.pro.scans} scans per month`,
      'SoundCloud, Mixcloud, upload',
      `Up to ${Math.round(PLAN_LIMITS.pro.maxFileBytes / 1024 / 1024)} MB uploads`,
      'Detailed mode (every 30 sec)',
      'Spotify playlist export',
    ],
  },
  {
    plan: PLANS.STUDIO,
    name: 'Studio',
    tagline: 'Power users & small studios',
    icon: Star,
    features: [
      `${PLAN_LIMITS.studio.scans} scans per month`,
      'Everything in Pro',
      `Up to ${Math.round(PLAN_LIMITS.studio.maxFileBytes / 1024 / 1024)} MB uploads`,
      'Priority queue (faster results)',
    ],
  },
];

export function PricingPage() {
  const navigate = useNavigate();
  const [pendingPlan, setPendingPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [founding, setFounding] = useState<FoundingStatus | null>(null);
  const [betaMode, setBetaMode] = useState<boolean>(false);

  useEffect(() => {
    getFoundingStatus().then(setFounding);
    getUserProfile().then(p => {
      if (p) setBetaMode(p.betaMode);
    });
  }, []);

  const isSoldOut = founding?.isSoldOut === true;

  const handleChoose = async (plan: Plan) => {
    if (plan === PLANS.FREE) {
      navigate('/');
      return;
    }
    setPendingPlan(plan);
    setError(null);
    try {
      const url = await createCheckout(plan as 'pro' | 'studio');
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
      setPendingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        {betaMode ? (
          <div className="mx-auto max-w-2xl">
            <Card className="border-primary/40 shadow-lg shadow-primary/10">
              <CardContent className="p-10 flex flex-col items-center gap-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Rocket className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">MixMatch is in Open Beta</h1>
                  <p className="text-muted-foreground mt-3">
                    Try all premium features for free —{' '}
                    <span className="font-medium text-foreground">5 scans/month</span>,{' '}
                    <span className="font-medium text-foreground">2 per day</span>, detailed mode, Spotify export, no
                    credit card. We'll announce Beta end at least 7 days in advance via email.
                  </p>
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 text-sm">
                  <p className="font-semibold text-primary mb-1">Founding Member reward</p>
                  <p className="text-muted-foreground">
                    First 100 users to subscribe when Beta ends lock in lifetime pricing —{' '}
                    <span className="font-semibold text-foreground">$6/mo Pro</span> or{' '}
                    <span className="font-semibold text-foreground">$12/mo Studio</span>. Use Beta to test, give
                    feedback, and claim your seat.
                  </p>
                </div>
                <Link to="/" className="w-full">
                  <Button className="w-full">Start using MixMatch</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold tracking-tight">Choose your plan</h1>
              <p className="text-muted-foreground mt-3">
                Start free. Upgrade when you need longer mixes or more scans.
              </p>
            </div>

            {founding && !isSoldOut && (
              <div className="mx-auto mb-10 max-w-xl flex items-center justify-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-5 py-2 text-sm">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>
                  <span className="font-semibold text-primary">Founding Member lifetime pricing</span> — only{' '}
                  <span className="font-semibold">{founding.seatsRemaining}</span> of {founding.totalSeats} seats left
                </span>
              </div>
            )}

            {founding && isSoldOut && (
              <div className="mx-auto mb-10 max-w-xl flex items-center justify-center gap-2 rounded-full border border-muted-foreground/30 bg-muted/30 px-5 py-2 text-sm text-muted-foreground">
                Founding seats sold out. Email hello@mixmatch.com for waitlist.
              </div>
            )}

            {error && <p className="text-center text-destructive mb-6">{error}</p>}

            <div className="grid md:grid-cols-3 gap-6">
              {TIERS.map(tier => {
                const Icon = tier.icon;
                const price = PLAN_PRICES[tier.plan];
                const isPending = pendingPlan === tier.plan;

                return (
                  <Card
                    key={tier.plan}
                    className={
                      tier.highlight ? 'border-primary/50 shadow-lg shadow-primary/10 relative' : 'border-border'
                    }
                  >
                    {tier.highlight && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-full font-medium">
                        Popular
                      </div>
                    )}
                    <CardContent className="p-6 flex flex-col gap-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h2 className="font-semibold text-lg">{tier.name}</h2>
                          <p className="text-xs text-muted-foreground">{tier.tagline}</p>
                        </div>
                      </div>

                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold">${price}</span>
                        {price > 0 && PLAN_FULL_PRICES[tier.plan] > price && (
                          <span className="text-lg text-muted-foreground line-through">
                            ${PLAN_FULL_PRICES[tier.plan]}
                          </span>
                        )}
                        {price > 0 && <span className="text-muted-foreground">/month</span>}
                      </div>

                      <ul className="space-y-2 text-sm">
                        {tier.features.map(f => (
                          <li key={f} className="flex items-start gap-2">
                            <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>

                      <SignedIn>
                        <Button
                          className="w-full mt-auto"
                          variant={tier.highlight ? 'default' : 'outline'}
                          onClick={() => handleChoose(tier.plan)}
                          disabled={pendingPlan !== null || (isSoldOut && tier.plan !== PLANS.FREE)}
                        >
                          {isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : tier.plan === PLANS.FREE ? (
                            'Start free'
                          ) : isSoldOut ? (
                            'Sold out'
                          ) : (
                            `Choose ${tier.name}`
                          )}
                        </Button>
                      </SignedIn>
                      <SignedOut>
                        <SignInButton mode="modal">
                          <Button className="w-full mt-auto" variant={tier.highlight ? 'default' : 'outline'}>
                            Sign in to choose
                          </Button>
                        </SignInButton>
                      </SignedOut>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <p className="text-center text-xs text-muted-foreground mt-10">
              All plans include Spotify playlist export (Pro+) and can be cancelled anytime.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
