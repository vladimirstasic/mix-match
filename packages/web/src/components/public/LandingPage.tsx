import { SignInButton } from '@clerk/clerk-react';
import { PageChrome, ThemeToggle } from '../layout';

const PIPELINE = [
  { n: '01', title: 'Ingest', body: 'Drag a recording or paste a SoundCloud / Mixcloud link. We fetch and decode it.' },
  {
    n: '02',
    title: 'Fingerprint',
    body: 'Acoustic fingerprints are extracted across the whole set, segment by segment.',
  },
  { n: '03', title: 'Match', body: 'Each segment is matched against the catalog, with a confidence score per hit.' },
  {
    n: '04',
    title: 'Export',
    body: 'Timestamps, streaming links, and export for Mixcloud, SoundCloud, or plain text.',
  },
];

const RECOGNITION_LOG: { time: string; track: string; conf: number; status: 'identified' | 'unknown' }[] = [
  { time: '00:00 — 05:30', track: 'Dorisburg — Irrbloss', conf: 0.96, status: 'identified' },
  { time: '05:30 — 11:15', track: 'Hatikvah — Unforgettable', conf: 0.91, status: 'identified' },
  { time: '11:15 — 16:40', track: 'DJ Hell — The Angst (Henrik Schwarz Remix)', conf: 0.88, status: 'identified' },
  { time: '16:40 — 22:10', track: 'Unknown section', conf: 0, status: 'unknown' },
  { time: '22:10 — 28:00', track: 'Âme — Rej', conf: 0.94, status: 'identified' },
];

const MODULES = [
  {
    k: 'AUDIO_FINGERPRINT',
    title: 'Recognition engine',
    body: 'ACRCloud-powered. Fast mode scans highlights, Detailed walks segment by segment.',
  },
  {
    k: 'URL_INGEST',
    title: 'URL scanning',
    body: 'Paste a SoundCloud or Mixcloud link. We fetch and decode the audio for you.',
  },
  {
    k: 'SPOTIFY_EXPORT',
    title: 'Spotify playlists',
    body: 'One click turns your tracklist into a Spotify playlist in your account. Instant.',
  },
  {
    k: 'MULTI_FORMAT',
    title: 'Multi-format export',
    body: 'Mixcloud, SoundCloud, YouTube timestamps, plain text. Copy and post.',
  },
  {
    k: 'PUBLIC_PAGE',
    title: 'Shareable pages',
    body: 'Public tracklist page with a custom URL. Embedded players, clean layout.',
  },
  {
    k: 'STREAMING_LINKS',
    title: 'Streaming links',
    body: 'Spotify, YouTube, and Deezer links with inline players for every identified track.',
  },
];

const PLANS = [
  {
    name: 'Free',
    num: '$0',
    per: '/ forever',
    features: ['5 scans / month', '2 scans / day', 'Fast mode', 'Text export', 'Public share pages'],
    cta: 'GET STARTED',
    featured: false,
  },
  {
    name: 'Pro',
    num: '$9.99',
    per: '/ month',
    features: [
      '30 mixes / month',
      'Fast + Detailed',
      'All export formats',
      'Spotify playlists',
      'Streaming links',
      'Manual editing',
    ],
    cta: 'START FREE TRIAL',
    featured: true,
  },
  {
    name: 'Studio',
    num: '$29.99',
    per: '/ month',
    features: [
      'Unlimited mixes',
      'Everything in Pro',
      'URL scanning',
      'DJ profile page',
      'Community features',
      'Custom URL',
    ],
    cta: 'CONTACT US',
    featured: false,
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen text-foreground overflow-hidden">
      <PageChrome variant="full" />

      <header className="landing-bar">
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
          <ThemeToggle />
          <SignInButton mode="modal">
            <button className="ctrl">SIGN IN</button>
          </SignInButton>
          <SignInButton mode="modal">
            <button className="btn-demo" type="button">
              GET STARTED
            </button>
          </SignInButton>
        </div>
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
              Upload a DJ set or drop in a SoundCloud or Mixcloud link. The engine listens through the whole mix and
              returns a timestamped tracklist, with a confidence score on every hit.
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
            <p className="trust">NO CARD · 5 SCANS / MO · 2 / DAY</p>
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
              Every segment timestamped, every hit scored. This is the recognition log from a finished scan.
            </p>
            <div className="log">
              <div className="log-top">
                <span>RECOGNITION_LOG</span>
                <span>4 / 5 · 80%</span>
              </div>
              <div className="log-body">
                {RECOGNITION_LOG.map((r, i) => (
                  <div key={i} className={`log-row ${r.status}`}>
                    <span className="r-time">{r.time}</span>
                    <span className="r-track">{r.track}</span>
                    <span className="r-conf">
                      {r.status === 'identified' ? r.conf.toFixed(2) : '—'}
                      <span className="cbar">
                        <span className="cfill" style={{ width: `${r.conf * 100}%` }} />
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
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
            <div className="pricing-rows">
              {PLANS.map(p => (
                <div key={p.name} className={`price ${p.featured ? 'featured' : ''}`}>
                  {p.featured && <span className="ptag">POPULAR</span>}
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
                  <SignInButton mode="modal">
                    {p.featured ? (
                      <button className="btn-demo" type="button" style={{ width: '100%', justifyContent: 'center' }}>
                        {p.cta}
                      </button>
                    ) : (
                      <button className="ctrl" type="button" style={{ width: '100%', justifyContent: 'center' }}>
                        {p.cta}
                      </button>
                    )}
                  </SignInButton>
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
          <span>POWERED BY ACRCLOUD · BETA</span>
        </div>
      </footer>
    </div>
  );
}
