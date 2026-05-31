import { SignInButton } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Disc3, Download, Share2, Headphones, Zap, Search, Globe, Music, Users } from 'lucide-react';
import { ThemeToggle } from '../layout';

const FEATURES = [
  {
    icon: Search,
    title: 'Audio Fingerprinting',
    description: 'ACRCloud-powered recognition. Fast mode scans highlights, Detailed mode goes segment by segment.',
  },
  {
    icon: Globe,
    title: 'URL Scanning',
    description: 'Paste a YouTube, SoundCloud, or Mixcloud link. We download and scan automatically.',
  },
  {
    icon: Music,
    title: 'Spotify Playlists',
    description: 'One click turns your tracklist into a Spotify playlist in your account. Instant.',
  },
  {
    icon: Download,
    title: 'Multi-Format Export',
    description: 'Export for Mixcloud, SoundCloud, YouTube timestamps, or plain text. Copy and post.',
  },
  {
    icon: Share2,
    title: 'Shareable Pages',
    description: 'Generate a public tracklist page with a custom URL. Embedded players, clean layout.',
  },
  {
    icon: Headphones,
    title: 'Streaming Links',
    description: 'Spotify, YouTube, and Deezer links with inline players for every identified track.',
  },
];

const DEMO_TRACKS = [
  { time: '00:00 — 05:30', track: 'Dorisburg - Irrbloss', status: 'identified' as const },
  { time: '05:30 — 11:15', track: 'Hatikvah - Unforgettable', status: 'identified' as const },
  { time: '11:15 — 16:40', track: 'DJ Hell - The Angst (Henrik Schwarz Remix)', status: 'identified' as const },
  { time: '16:40 — 22:10', track: 'Unknown section', status: 'unknown' as const },
  { time: '22:10 — 28:00', track: 'Âme - Rej', status: 'identified' as const },
];

const PRICING = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    features: ['5 scans per month', '2 scans per day', 'Fast mode', 'Text export', 'Public share pages'],
    cta: 'Get Started',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$9.99',
    period: '/ month',
    features: [
      '30 mixes per month',
      'Fast + Detailed modes',
      'All export formats',
      'Spotify playlist creation',
      'Streaming links',
      'Manual track editing',
    ],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Studio',
    price: '$29.99',
    period: '/ month',
    features: [
      'Unlimited mixes',
      'Everything in Pro',
      'URL scanning',
      'DJ profile page',
      'Community features',
      'Custom profile URL',
    ],
    cta: 'Contact Us',
    highlighted: false,
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Animated background blobs */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-purple-600/10 blur-[120px] animate-gradient-shift" />
        <div
          className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-violet-500/8 blur-[100px] animate-gradient-shift"
          style={{ animationDelay: '-5s' }}
        />
        <div
          className="absolute top-[40%] right-[20%] w-[300px] h-[300px] rounded-full bg-indigo-500/6 blur-[80px] animate-gradient-shift"
          style={{ animationDelay: '-10s' }}
        />
      </div>

      {/* Glass Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-2xl bg-background/60 border-b border-border/50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Disc3 className="w-5 h-5 text-primary" />
            <span className="font-semibold tracking-tight">MixMatch</span>
            <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 uppercase">
              Beta
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <SignInButton mode="modal">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </SignInButton>
            <SignInButton mode="modal">
              <Button size="sm">Get Started</Button>
            </SignInButton>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl scale-150" />
              <Disc3 className="relative w-16 h-16 text-primary animate-spin" style={{ animationDuration: '8s' }} />
            </div>
          </div>

          <div className="flex justify-center mb-6">
            <span className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              MixMatch is in Beta — features may change as we polish things
            </span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6 gradient-text">
            Identify every track in your mix
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            Upload a DJ mix or paste a YouTube/SoundCloud link — get a complete timestamped tracklist with streaming
            links and one-click export.
          </p>

          <SignInButton mode="modal">
            <Button size="lg" className="text-base px-10 py-6 h-auto">
              <Zap className="w-5 h-5" />
              Start Scanning Free
            </Button>
          </SignInButton>

          <p className="text-sm text-muted-foreground mt-5">
            No credit card required &middot; 5 free scans per month &middot; 2 per day
          </p>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                title: 'Upload or Paste URL',
                desc: 'Drag a file or paste a YouTube/SoundCloud/Mixcloud link',
              },
              {
                step: '02',
                title: 'Choose Scan Mode',
                desc: 'Fast (~20s) for a quick overview, Detailed (~2min) for accuracy',
              },
              {
                step: '03',
                title: 'Get Your Tracklist',
                desc: 'Timestamps, streaming links, export options — all instant',
              },
            ].map(item => (
              <Card key={item.step} className="text-center p-6">
                <CardContent className="p-0 space-y-3">
                  <span className="inline-block text-xs font-mono text-primary/80 bg-primary/10 px-2 py-1 rounded-lg">
                    {item.step}
                  </span>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Product Preview */}
      <section className="py-20">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4">See it in action</h2>
          <p className="text-center text-muted-foreground mb-8">Here's what a typical result looks like</p>

          <Card className="glow-purple overflow-hidden">
            <div className="p-4 border-b border-border/50 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-white/10" />
                <div className="w-3 h-3 rounded-full bg-white/10" />
                <div className="w-3 h-3 rounded-full bg-white/10" />
              </div>
              <span className="text-xs text-muted-foreground ml-2 font-mono">mixmatch.app/t/my-set</span>
            </div>
            <CardContent className="pt-4 space-y-1.5">
              {DEMO_TRACKS.map((t, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 py-2.5 px-3 rounded-xl border-l-3 ${
                    t.status === 'identified'
                      ? 'border-l-green-500 bg-green-500/[0.03]'
                      : 'border-l-muted-foreground/20 bg-muted/30'
                  }`}
                >
                  <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">{t.time}</span>
                  <span
                    className={`text-sm ${t.status === 'unknown' ? 'text-muted-foreground italic' : 'font-medium'}`}
                  >
                    {t.track}
                  </span>
                  {t.status === 'identified' && (
                    <span className="text-[10px] text-green-400 bg-green-500/10 rounded-md px-1.5 py-0.5 ml-auto shrink-0 border border-green-500/20">
                      Spotify
                    </span>
                  )}
                </div>
              ))}
              <div className="pt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>4/5 tracks identified &middot; 80% coverage</span>
                <span className="text-primary font-medium">Export &rarr;</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">Everything you need</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(feature => (
              <Card key={feature.title} className="group">
                <CardContent className="pt-6">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Community */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-4">Built for DJs</h2>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Create your DJ profile and showcase mixes
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Follow your favorite DJs
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Vote on track identifications
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Discover new music through other DJs' mixes
                </li>
              </ul>
            </div>
            <Card className="p-6">
              <CardContent className="p-0 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600" />
                  <div>
                    <p className="font-semibold">@deep_selector</p>
                    <p className="text-xs text-muted-foreground">12 public mixes &middot; 48 followers</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {['Deep House Session Vol. 3', 'Berlin Warehouse Set', 'Ambient Selections'].map(mix => (
                    <div
                      key={mix}
                      className="flex items-center gap-2 p-2 rounded-lg bg-glass-bg border border-border/50"
                    >
                      <Disc3 className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{mix}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4">Simple pricing</h2>
          <p className="text-center text-muted-foreground mb-12">Start free, upgrade when you need more</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PRICING.map(plan => (
              <Card key={plan.name} className={plan.highlighted ? 'border-primary/40 glow-purple relative' : ''}>
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-medium bg-gradient-to-r from-purple-600 to-violet-500 text-white px-3 py-1 rounded-full">
                    Most Popular
                  </div>
                )}
                <CardContent className="pt-8 flex flex-col h-full">
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                  <div className="mt-2 mb-5">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground ml-1 text-sm">{plan.period}</span>
                  </div>
                  <ul className="space-y-2.5 mb-8 flex-1">
                    {plan.features.map(f => (
                      <li key={f} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary mt-0.5 text-xs">&#10003;</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <SignInButton mode="modal">
                    <Button className="w-full" variant={plan.highlighted ? 'default' : 'outline'}>
                      {plan.cta}
                    </Button>
                  </SignInButton>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4 gradient-text">Your mix. Every track. Identified.</h2>
          <p className="text-muted-foreground mb-8">Join DJs who never post an incomplete tracklist.</p>
          <SignInButton mode="modal">
            <Button size="lg" className="text-base px-10 py-6 h-auto">
              Get Started Free
            </Button>
          </SignInButton>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Disc3 className="w-4 h-4" />
            <span>MixMatch</span>
          </div>
          <p>Powered by ACRCloud</p>
        </div>
      </footer>
    </div>
  );
}
