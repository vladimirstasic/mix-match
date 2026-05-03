import { SignInButton } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Disc3, Music, Download, Share2, Headphones, Zap, Search, Globe } from "lucide-react";

const FEATURES = [
  {
    icon: Search,
    title: "Auto Recognition",
    description: "Upload a mix and instantly identify every track with timestamps.",
  },
  {
    icon: Download,
    title: "Export Tracklists",
    description: "Export in Mixcloud, SoundCloud, or plain text format. Ready to post.",
  },
  {
    icon: Share2,
    title: "Shareable Pages",
    description: "Generate a public link to your tracklist. Share with fans or clients.",
  },
  {
    icon: Headphones,
    title: "Streaming Links",
    description: "Spotify, YouTube, and Deezer links for every identified track.",
  },
];

const DEMO_TRACKS = [
  { time: "00:00 — 05:30", track: "Dorisburg - Irrbloss", hasSpotify: true },
  { time: "05:30 — 11:15", track: "Hatikvah - Unforgettable", hasSpotify: true },
  { time: "11:15 — 16:40", track: "DJ Hell - The Angst (Henrik Schwarz Remix)", hasSpotify: false },
  { time: "16:40 — 22:10", track: "Jonathan Kaspar - 1993", hasSpotify: true },
  { time: "22:10 — 28:00", track: "Âme - Rej", hasSpotify: true },
];

const PRICING = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    features: ["3 mixes per month", "Fast mode only", "Text export", "Watermarked share pages"],
    cta: "Get Started",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$9.99",
    period: "/ month",
    features: ["30 mixes per month", "Fast + Detailed modes", "All export formats", "Clean share pages", "Streaming links", "Manual track editing"],
    cta: "Start Free Trial",
    highlighted: true,
  },
  {
    name: "Studio",
    price: "$29.99",
    period: "/ month",
    features: ["Unlimited mixes", "Everything in Pro", "URL scanning", "API access", "Priority processing", "Bulk upload"],
    cta: "Contact Us",
    highlighted: false,
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 py-24 text-center">
          <div className="flex justify-center mb-8">
            <div className="relative">
              <Disc3 className="w-20 h-20 text-primary animate-spin" style={{ animationDuration: "8s" }} />
              <Music className="w-8 h-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
          </div>

          <h1 className="text-5xl font-bold tracking-tight mb-4">
            Identify every track in your mix
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Upload a DJ mix, radio show, or podcast — get a complete tracklist with timestamps, streaming links, and export options. Powered by audio fingerprinting.
          </p>

          <div className="flex items-center justify-center gap-4">
            <SignInButton mode="modal">
              <Button size="lg" className="text-lg px-8 py-6">
                <Zap className="w-5 h-5 mr-2" />
                Get Started Free
              </Button>
            </SignInButton>
          </div>

          <p className="text-sm text-muted-foreground mt-4">No credit card required</p>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 border-t">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Everything you need</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="border-muted">
                <CardContent className="pt-6">
                  <feature.icon className="w-8 h-8 text-primary mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Demo */}
      <section className="py-20 border-t">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">See it in action</h2>
          <p className="text-center text-muted-foreground mb-8">Here's what a typical result looks like</p>

          <Card>
            <CardContent className="pt-6 space-y-2">
              {DEMO_TRACKS.map((t, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-l-4 border-l-green-500 pl-3 rounded">
                  <span className="font-mono text-sm text-muted-foreground whitespace-nowrap">{t.time}</span>
                  <span className="font-medium text-sm">{t.track}</span>
                  {t.hasSpotify && (
                    <span className="text-xs text-green-500 bg-green-500/10 rounded px-1.5 py-0.5 ml-auto shrink-0">
                      Spotify
                    </span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex items-center justify-center gap-2 mt-4">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Also supports YouTube, SoundCloud, and Mixcloud URLs</span>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 border-t">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Simple pricing</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PRICING.map((plan) => (
              <Card
                key={plan.name}
                className={plan.highlighted ? "border-primary ring-2 ring-primary/20" : "border-muted"}
              >
                <CardContent className="pt-6 flex flex-col h-full">
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <div className="mt-2 mb-4">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground ml-1">{plan.period}</span>
                  </div>
                  <ul className="space-y-2 mb-6 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <SignInButton mode="modal">
                    <Button
                      className="w-full"
                      variant={plan.highlighted ? "default" : "outline"}
                    >
                      {plan.cta}
                    </Button>
                  </SignInButton>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>MixMatch — Automatic track identification for DJ mixes</p>
        </div>
      </footer>
    </div>
  );
}
