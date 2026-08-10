import { SignInButton } from '@clerk/clerk-react';
import { Check, Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { BETA_SCANS_PER_DAY, PLAN_LIMITS, PLAN_PRICES } from '@mix-match/shared';
import { PageChrome, ThemeToggle } from '../layout';
import { BuyLinks } from '../analysis/BuyLinks';
import { AcrcloudAttribution } from '../AcrcloudAttribution';
import { useWaitlist } from '../../hooks/useWaitlist';

const NAV_LINKS = [
  { href: '#how', label: '[01] PIPELINE' },
  { href: '#accuracy', label: '[02] RECOGNITION' },
  { href: '#features', label: '[03] MODULES' },
  { href: '#pricing', label: '[04] PLANS' },
];

const PIPELINE = [
  { n: '01', title: 'Ingest', body: 'Drag a recording or paste a SoundCloud / Mixcloud link. We fetch and decode it.' },
  {
    n: '02',
    title: 'Fingerprint',
    body: 'Acoustic fingerprints are extracted across the whole set, segment by segment.',
  },
  {
    n: '03',
    title: 'Match',
    body: 'Each segment is matched against the catalog. Weak matches are discarded rather than guessed at.',
  },
  {
    n: '04',
    title: 'Export',
    body: 'Timestamps and streaming links, exported as Mixcloud, SoundCloud, YouTube, Markdown or plain text.',
  },
];

// A real excerpt from a real scan, not a mock-up: these six rows are lifted verbatim
// from packages/api/src/services/__fixtures__/kengarden-015-output.json — the recorded
// output of one 118-minute set (71 segments, 54 distinct tracks). Kept as-is on purpose,
// including the 15-second one-off at 10:00 and the unidentified stretch at 02:45, because
// that is what real output looks like. The source mix and its DJ are deliberately not
// named. No field here is invented — the row renders only what the fixture contains.
const RECOGNITION_LOG: { time: string; track: string | null }[] = [
  { time: '01:30 — 02:45', track: 'Missy Elliott, 50 Cent — Work It' },
  { time: '02:45 — 04:30', track: null },
  { time: '04:30 — 09:45', track: 'Moeaike, SOMMERS (UK) — I’m For Real (Original Mix)' },
  { time: '10:00 — 10:15', track: 'Ankhoi, Luch — THE FUTURE (Extended)' },
  { time: '10:30 — 16:45', track: 'Ankhoi, Luch — THE FUTURE' },
  { time: '17:00 — 17:45', track: 'NICK ROBERTS, KIII RODRIGUEZ — Mami (Extended Mix)' },
];

const MODULES = [
  {
    k: 'AUDIO_FINGERPRINT',
    title: 'Recognition engine',
    body: 'ACRCloud acoustic fingerprinting matches every segment against a global track database and scores each hit, keeping only matches above a confidence floor — even pitch- or tempo-shifted tracks.',
  },
  {
    k: 'URL_INGEST',
    title: 'URL scanning',
    body: 'Paste a SoundCloud or Mixcloud link. We fetch and decode the audio for you.',
  },
  {
    k: 'SPOTIFY_EXPORT',
    title: 'Spotify playlists',
    body: 'Send a finished tracklist to Spotify as a playlist — you approve access with your Spotify account, then it lands in your library.',
  },
  {
    k: 'MULTI_FORMAT',
    title: 'Multi-format export',
    body: 'Mixcloud, SoundCloud, YouTube timestamps, plain text. Copy and post.',
  },
  {
    k: 'PUBLIC_PAGE',
    title: 'Shareable pages',
    body: 'Public tracklist page on its own shareable link. Embedded players, clean layout.',
  },
  {
    k: 'STREAMING_LINKS',
    title: 'Streaming links',
    body: 'Spotify, Apple Music, Beatport, YouTube and Deezer links wherever the catalogue has them, with inline players for Spotify, YouTube and Deezer.',
  },
];

// Prices and quotas come from @mix-match/shared so this page can't drift from
// /pricing — the two used to advertise different Pro prices and scan counts.
const PLANS = [
  {
    name: 'Free',
    num: `$${PLAN_PRICES.free}`,
    per: '/ forever',
    features: [
      `${PLAN_LIMITS.free.scans} scans / month`,
      `${BETA_SCANS_PER_DAY} scans / day`,
      'Text export',
      'Public share pages',
    ],
    cta: 'GET STARTED',
    featured: false,
    soon: false,
  },
  {
    name: 'Pro',
    num: `$${PLAN_PRICES.pro}`,
    per: '/ month',
    features: [
      `${PLAN_LIMITS.pro.scans} scans / month`,
      'All export formats',
      'Spotify playlists',
      'Streaming links',
      'Manual editing',
    ],
    cta: 'COMING SOON',
    featured: true,
    soon: true,
  },
];

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLHeadElement>(null);
  const waitlist = useWaitlist('pro');

  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [menuOpen]);

  return (
    <div className="min-h-screen text-foreground overflow-hidden">
      <PageChrome variant="full" />

      <header className="landing-bar" ref={menuRef}>
        <a className="unit" href="#top">
          <span className="led" aria-hidden />
          <span className="unit-name">MIXMATCH</span>
          <span className="unit-sub">/studio</span>
          <span className="tag">BETA</span>
        </a>
        <nav className="bar-nav" aria-label="Primary">
          <a href="#how">[01] PIPELINE</a>
          <a href="#accuracy">[02] RECOGNITION</a>
          <a href="#features">[03] MODULES</a>
          <a href="#pricing">[04] PLANS</a>
        </nav>
        <div className="bar-actions">
          <span className="bar-theme">
            <ThemeToggle />
          </span>
          <SignInButton mode="modal">
            <button className="ctrl bar-signin">SIGN IN</button>
          </SignInButton>
          <SignInButton mode="modal">
            <button className="btn-demo" type="button">
              GET STARTED
            </button>
          </SignInButton>
          <button
            className="bar-burger"
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(o => !o)}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
        {menuOpen && (
          <nav className="bar-menu" aria-label="Primary mobile">
            {NAV_LINKS.map(link => (
              <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
                {link.label}
              </a>
            ))}
            <SignInButton mode="modal">
              <button className="ctrl" onClick={() => setMenuOpen(false)}>
                SIGN IN
              </button>
            </SignInButton>
            <ThemeToggle />
          </nav>
        )}
      </header>

      <main id="top">
        <section className="hero">
          <span className="corner tl" aria-hidden />
          <span className="corner tr" aria-hidden />
          <span className="corner bl" aria-hidden />
          <span className="corner br" aria-hidden />
          <div className="hud" aria-hidden>
            <span className="eq">
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
            <span>
              BPM <b>124.0</b>
            </span>
            <span>
              KEY <b>Am · 7A</b>
            </span>
            <span>
              RATE <b>44.1 kHz</b>
            </span>
            <span className="hud-state">MONITOR</span>
          </div>
          <div className="hero-content">
            <p className="kicker">// AI AUDIO FORENSICS — TRACK RECOGNITION</p>
            <h1>
              Identify every track
              <br />
              in your mix
            </h1>
            <p className="lede">
              Upload a DJ set or drop in a SoundCloud or Mixcloud link — no crowd-tagging, no waiting on a community to
              identify it. The engine listens through the whole mix and returns a timestamped tracklist with streaming
              links for every track it can identify.
            </p>
            <div className="hero-cta">
              <SignInButton mode="modal">
                <button className="btn-demo btn-lg" type="button">
                  RUN A SCAN
                </button>
              </SignInButton>
              <SignInButton mode="modal">
                <button className="ctrl ctrl-lg">OPEN THE CONSOLE →</button>
              </SignInButton>
            </div>
            <p className="trust">
              NO CARD · {PLAN_LIMITS.free.scans} SCANS / MO · {BETA_SCANS_PER_DAY} / DAY
            </p>
          </div>
        </section>

        <section className="panel" id="how">
          <div className="wrap">
            <h2 className="head">
              <i>[01]</i> Pipeline
            </h2>
            <div className="rows steps">
              {PIPELINE.map(s => (
                <article key={s.n} className="cell">
                  <span className="cno">{s.n}</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="panel alt" id="accuracy">
          <div className="wrap narrow">
            <h2 className="head">
              <i>[02]</i> What a result looks like
            </h2>
            <p className="sub">
              A real excerpt from one 118-minute set, in the same layout your results use. Nothing here is cleaned up:
              the gap at 02:45 came back unidentified, and 10:00 is a 15-second hit the engine caught between two longer
              plays.
            </p>
            <div className="log">
              <div className="log-top">
                <span>RECOGNITION_LOG</span>
                <span>5 / 6 · 83%</span>
              </div>
              <div className="log-body space-y-2 p-2">
                {RECOGNITION_LOG.map(r => (
                  <div
                    key={r.time}
                    className={`log-row ${r.track ? 'identified' : 'unknown'}`}
                    style={{ display: 'block' }}
                  >
                    <div className="py-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                      <span className="font-mono text-[11px] text-muted-foreground whitespace-nowrap sm:min-w-[110px]">
                        {r.time}
                      </span>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {r.track && (
                          <div className="w-4 h-4 bg-primary/15 flex items-center justify-center shrink-0">
                            <Check className="w-2.5 h-2.5 text-primary" />
                          </div>
                        )}
                        <span
                          className={`text-sm flex-1 min-w-0 truncate ${
                            r.track ? 'font-medium' : 'italic text-muted-foreground/70'
                          }`}
                        >
                          {r.track ?? 'Unidentified'}
                        </span>
                      </div>
                      {/* The real BuyLinks component, not a copy of it: buildBuyLinks() derives
                          these chips from the track name alone (lib/affiliate.ts), so what renders
                          here is byte-identical to what renders in a signed-in result. */}
                      {r.track && (
                        <div className="flex items-center gap-1 shrink-0">
                          <BuyLinks trackName={r.track} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p className="sub" style={{ marginTop: '1rem', marginBottom: 0, fontSize: '0.85rem' }}>
              The BUY chips above are the real ones — they are built from the track name, so they work for every
              identified track. In your account each row also carries BPM, key and genre, and Spotify, YouTube and
              Deezer chips with inline players wherever the catalogue returns a match for that exact track. Best on
              commercially released tracks: unreleased edits, white labels, and ID-only cuts come back unidentified
              rather than guessed.
            </p>
          </div>
        </section>

        <section className="panel" id="features">
          <div className="wrap">
            <h2 className="head">
              <i>[03]</i> Modules
            </h2>
            <div className="rows features">
              {MODULES.map(m => (
                <article key={m.k} className="cell feature">
                  <span className="fkey">{m.k}</span>
                  <h3>{m.title}</h3>
                  <p>{m.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="panel alt" id="pricing">
          <div className="wrap">
            <h2 className="head">
              <i>[04]</i> Plans
            </h2>
            <div className="pricing-rows pricing-rows-2">
              {PLANS.map(p => (
                <div key={p.name} className={`price ${p.featured ? 'featured' : ''}`}>
                  {p.featured && <span className="ptag">{p.soon ? 'SOON' : 'POPULAR'}</span>}
                  <h3>{p.name}</h3>
                  <div className="pamt">
                    <span className="num">{p.num}</span>
                    <span className="per"> {p.per}</span>
                  </div>
                  <ul>
                    {p.features.map(f => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  {p.soon ? (
                    waitlist.done ? (
                      <p className="text-center text-sm" style={{ padding: '0.6rem 0' }}>
                        You&apos;re on the list — we&apos;ll email you.
                      </p>
                    ) : waitlist.open ? (
                      <form
                        onSubmit={e => {
                          e.preventDefault();
                          waitlist.submit();
                        }}
                        style={{ display: 'flex', gap: '0.4rem' }}
                      >
                        <input
                          type="email"
                          required
                          value={waitlist.email}
                          onChange={e => waitlist.setEmail(e.target.value)}
                          placeholder="you@email.com"
                          className="flex-1 w-full px-3 border border-border bg-transparent font-mono text-sm focus:outline-none focus:border-primary"
                        />
                        <button className="ctrl" type="submit" disabled={waitlist.submitting}>
                          {waitlist.submitting ? '...' : 'NOTIFY ME'}
                        </button>
                      </form>
                    ) : (
                      <button
                        className="btn-demo"
                        type="button"
                        onClick={waitlist.openForm}
                        style={{ width: '100%', justifyContent: 'center', opacity: 0.55, cursor: 'pointer' }}
                      >
                        {p.cta}
                      </button>
                    )
                  ) : (
                    <SignInButton mode="modal">
                      <button className="ctrl" type="button" style={{ width: '100%', justifyContent: 'center' }}>
                        {p.cta}
                      </button>
                    </SignInButton>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="panel cta-panel">
          <div className="wrap narrow center">
            <h2 className="head big">Your mix. Every track. Identified.</h2>
            <SignInButton mode="modal">
              <button className="btn-demo btn-lg" type="button">
                RUN YOUR FIRST SCAN
              </button>
            </SignInButton>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="foot-in">
          <span>
            <span className="led" aria-hidden /> MIXMATCH /studio · BETA
          </span>
          <AcrcloudAttribution logoClassName="h-4" />
        </div>
      </footer>
    </div>
  );
}
