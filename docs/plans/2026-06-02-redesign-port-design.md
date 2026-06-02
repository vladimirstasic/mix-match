# Redesign port — demo → real app (design)

**Date:** 2026-06-02
**Branch:** `redesign`
**Source of truth (visuals):** `demo/index.html`, `demo/styles.css`, `demo/app.js`
**Target:** `packages/web/` (React + Vite + Tailwind v4 + shadcn/ui)

## Decisions (locked)

| # | Question | Choice |
|---|----------|--------|
| 1 | Scope | **B** — full app overhaul (landing, dashboard, analysis, profile, public) |
| 2 | Typography | **A** — Space Grotesk (display) + JetBrains Mono (labels/buttons/numbers) |
| 3 | Color | **C** — Winamp green primary; Spotify green reserved for Spotify-specific UI |
| 4 | Visual chrome | **B** — full chrome (grid + scanlines + waveform) on public/marketing pages; grid only on app pages; none on Analysis |
| 5 | Strategy | **A** — token swap + selective rebuild (no parallel route, no full component rewrite) |

## Brand strings

- Logo everywhere: `MIXMATCH /studio` (matches `mixmatch.studio` domain).
- Section headers in mono comment style: `// SECTION NAME`.
- Beta badge: `LED · MIXMATCH /studio · BETA`.

## Light/dark

Both modes stay. Light = "lab paper", dark = near-black instrument. Already wired via `ThemeToggle.tsx`.

---

## Step 1 — Token swap (`packages/web/src/index.css`)

**Goal:** existing shadcn components (Button, Card, Dialog, Progress) automatically pick up the new look without `*.tsx` edits.

**Changes (`@theme inline` + `:root` + `.dark`):**

```css
/* dark (default) */
--background: #06080a;
--foreground: #dfeadd;
--card: rgba(10,16,12,0.72);
--card-foreground: #dfeadd;
--popover: #0a120c;
--popover-foreground: #dfeadd;
--primary: #1fe048;             /* Winamp signal green */
--primary-foreground: #0a0a0a;
--secondary: rgba(223,234,221,0.08);
--secondary-foreground: #dfeadd;
--muted: rgba(223,234,221,0.06);
--muted-foreground: rgba(223,234,221,0.56);
--accent: #ffd21e;              /* spectrum yellow accent */
--accent-foreground: #0a0a0a;
--border: rgba(223,234,221,0.14);
--input: rgba(223,234,221,0.14);
--ring: #1fe048;
--radius: 0px;

/* light */
:root.light, [data-theme='light'] {
  --background: #e8ede6;
  --foreground: #0e140f;
  --card: #f1f5ef;
  --card-foreground: #0e140f;
  --primary: #0f7a3a;
  --primary-foreground: #ffffff;
  --border: rgba(14,20,15,0.16);
  --muted-foreground: rgba(14,20,15,0.62);
  --accent: #b8860b;
  --ring: #0f7a3a;
}

/* spotify — separate token, never primary */
--spotify: #1DB954;
--spotify-foreground: #ffffff;

/* fonts */
--font-sans: 'Space Grotesk', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', ui-monospace, monospace;
```

**Files touched:** `packages/web/src/index.css` only.

**Verification:** `pnpm dev` → all 5 routes load → no console errors → buttons/cards visually different but layouts intact.

**Rollback:** revert single file.

---

## Step 2 — Fonts (Space Grotesk + JetBrains Mono)

**Goal:** load Space Grotesk via Google Fonts, keep JetBrains Mono.

**Changes:**

- `packages/web/index.html` — add preconnect + font link (same as `demo/index.html` line 8-12).

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

**Files touched:** `packages/web/index.html`.

**Verification:** DevTools → Network → font woff2 loads. FCP regression ≤100ms.

**Rollback:** remove `<link>` tags; CSS falls back to `system-ui` because `--font-sans` lists fallbacks.

---

## Step 3 — Bevel button + spotify variant (`packages/web/src/components/ui/button.tsx`)

**Goal:** primary buttons get mono uppercase + clip-path bevel; new `spotify` variant for Spotify-related actions.

**Changes:**

1. In `index.css` — add utility:
   ```css
   .clip-bevel {
     clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
   }
   ```
2. In `button.tsx` `buttonVariants` cva — extend `variant`:
   ```ts
   default: "bg-primary text-primary-foreground hover:brightness-110 font-mono uppercase tracking-[0.08em]",
   spotify: "bg-[var(--spotify)] text-[var(--spotify-foreground)] hover:brightness-110 font-mono uppercase tracking-[0.08em]",
   outline: "border border-border text-foreground hover:border-primary hover:text-primary font-mono uppercase tracking-[0.08em]",
   // ghost / link / destructive — unchanged
   ```
3. Hover transform — add `hover:-translate-y-px` to `default` and `spotify`.

**Files touched:** `packages/web/src/components/ui/button.tsx`, `packages/web/src/index.css`.

**Verification:** open every page that renders a Button; primary CTAs render in Winamp green + mono uppercase; existing `variant="outline"` still works; Spotify-related buttons get retag to `variant="spotify"` (see Step 8).

**Rollback:** revert button.tsx; existing call sites remain valid because old variants kept.

---

## Step 4 — Mono label utilities (`packages/web/src/index.css`)

**Goal:** small mono micro-copy ("// INPUT — NEW SCAN", "SRC: FILE", "MODE", "BETA") becomes a single utility.

**Changes — add to `index.css`:**

```css
.label-mono {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted-foreground);
}
.label-mono-strong {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--foreground);
}
.label-comment {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--muted-foreground);
}
.label-comment::before { content: "// "; opacity: 0.6; }
```

**No component changes in this step** — they come per-screen in steps 8–10.

**Files touched:** `packages/web/src/index.css`.

**Verification:** N/A this step (utilities only).

---

## Step 5 — GridOverlay component

**Goal:** 44px CSS grid with radial mask, fixed behind content.

**New file:** `packages/web/src/components/layout/GridOverlay.tsx`

```tsx
export function GridOverlay() {
  return <div aria-hidden className="grid-overlay" />;
}
```

**CSS in `index.css`:**

```css
.grid-overlay {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-image:
    linear-gradient(var(--grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid) 1px, transparent 1px);
  background-size: 44px 44px;
  mask: radial-gradient(120% 90% at 50% 30%, #000 40%, transparent 95%);
  -webkit-mask: radial-gradient(120% 90% at 50% 30%, #000 40%, transparent 95%);
}
:root, [data-theme='dark'] { --grid: rgba(31, 224, 72, 0.05); }
[data-theme='light'] { --grid: rgba(15, 122, 58, 0.05); }
```

**Files touched:** new `GridOverlay.tsx`, `index.css`.

**Verification:** mount on landing → see faint grid in dark, faint olive grid in light.

---

## Step 6 — Scanlines component (dark only)

**New file:** `packages/web/src/components/layout/Scanlines.tsx`

```tsx
export function Scanlines() {
  return <div aria-hidden className="scanlines" />;
}
```

**CSS:**

```css
.scanlines {
  position: fixed;
  inset: 0;
  z-index: 60;
  pointer-events: none;
  background: repeating-linear-gradient(to bottom, rgba(255,255,255,0.025) 0 1px, transparent 1px 3px);
  mix-blend-mode: overlay;
  opacity: 0.5;
}
[data-theme='light'] .scanlines { display: none; }
```

**Verification:** dark theme → faint scanlines visible. Light theme → invisible.

---

## Step 7 — WaveformBackdrop (lazy three.js)

**Goal:** port demo's TSL waveform shader as a React component, lazy-loaded, mobile-skipped, reduced-motion-skipped.

**New file:** `packages/web/src/components/layout/WaveformBackdrop.tsx`

```tsx
import { useEffect, useRef } from 'react';

export default function WaveformBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.innerWidth < 640) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    (async () => {
      const mod = await import('./waveformShader'); // ported from demo/app.js
      if (cancelled) return;
      dispose = mod.mount(ref.current!);
    })();
    return () => { cancelled = true; dispose?.(); };
  }, []);
  return <canvas ref={ref} aria-hidden className="waveform-backdrop" />;
}
```

**Companion file:** `packages/web/src/components/layout/waveformShader.ts` — port the relevant chunk of `demo/app.js` (the TSL waveform creation, animation loop, palette switching). Export `mount(canvas) → dispose`.

**CSS:**

```css
.waveform-backdrop {
  position: fixed;
  inset: 0;
  z-index: -2;
  width: 100%;
  height: 100%;
  display: block;
}
```

**Dependency:** verify `three` already in `packages/web/package.json`. If not, `pnpm add three`.

**Verification:**
- Desktop: animated waveform visible behind landing.
- Mobile (devtools < 640px): no canvas, no three.js bundle in network tab.
- `prefers-reduced-motion: reduce`: no animation.
- Bundle: three.js shows up in async chunk, not in main bundle.

---

## Step 8 — `BackWrapper` chrome prop

**Goal:** centralize chrome decision per route.

**Change:** `packages/web/src/components/layout/BackWrapper.tsx`

```tsx
type Chrome = 'full' | 'grid' | 'none';
export function BackWrapper({ chrome = 'grid', children }: { chrome?: Chrome; children: ReactNode }) {
  return (
    <>
      {chrome !== 'none' && <GridOverlay />}
      {chrome === 'full' && <Scanlines />}
      {chrome === 'full' && <Suspense fallback={null}><WaveformBackdrop /></Suspense>}
      {children}
    </>
  );
}
```

**Per-route props:**

| Route | chrome |
|-------|--------|
| `LandingPage` | `full` |
| `DjProfile` (`/dj/:handle`) | `full` |
| `PublicTracklist` (`/t/:slug`) | `full` |
| `HomeView` (`/app`) | `grid` |
| `Dashboard` | `grid` |
| `Analysis` (`/a/:id`) | `none` |

**Verification:** navigate each route, observe chrome layers from devtools elements panel.

---

## Step 9 — `HomeView.tsx` restructure (closest 1:1 to demo)

**Goal:** upload console matches demo screenshot.

**Changes:**

1. Panel header: `<div className="label-comment">INPUT — NEW SCAN</div>` (left), `<span className="label-mono">SRC: {tab === 'upload' ? 'FILE' : 'URL'}</span>` (right).
2. Tabs: replace shadcn Tabs with custom segmented bar:
   - Two `<button>` elements, full width, equal columns.
   - Active: `bg-primary text-primary-foreground font-mono uppercase tracking-[0.08em]`.
   - Inactive: `text-muted-foreground border-r border-border`.
3. Dropzone:
   - `border: 1px dashed var(--border)`, no rounded corners.
   - Mono label: `▲ DROP MP3 · WAV · FLAC · M4A — or click · up to 3h`.
   - Active drag state: `border-color: var(--primary)`.
4. Mode row:
   - `<span className="label-mono">MODE</span>` followed by two segmented chips.
   - FAST chip: `FAST` (display) + `~20s` (mono dim suffix).
   - DETAILED chip: `DETAILED` + `~2min`.
   - Active: filled green; inactive: bordered transparent.
5. Run button: `<Button className="clip-bevel w-full" size="lg">RUN ANALYSIS</Button>`.

**Files touched:** `packages/web/src/components/layout/HomeView.tsx` only.

**Verification:** side-by-side with `demo/index.html` console — visual match within 5%.

---

## Step 10 — Per-screen mono labels & button retags (surgical pass)

For each file below, only label/text/button-variant changes. **No structural changes.**

**`Header.tsx`:**
- Logo: `<span className="font-semibold tracking-tight">MIXMATCH</span><span className="font-mono text-xs text-muted-foreground ml-1">/studio</span>`.
- BETA badge: prepend `<span className="led" />` (small green dot).

**`LandingPage.tsx`:**
- Wrap hero in instrument frame: top-left `MIXMATCH /studio`, top-right `BETA · LED`.
- All primary CTA buttons → `className="clip-bevel"`.
- Section headings → `.label-comment` style above each section.
- Add `BackWrapper chrome="full"` if not already wrapping.

**`Dashboard`:**
- Section titles: `<h2 className="label-comment">RECENT SCANS</h2>` etc.
- Card headers in mono.
- Numbers (counts, plays, %) in `font-mono`.

**`Analysis` / `Timeline.tsx`:**
- Above tracklist: `<div className="label-comment">TRACKLIST · {N} MATCHES</div>`.
- Confidence chips: mono uppercase.
- Spotify export button: `<Button variant="spotify" className="clip-bevel">EXPORT TO SPOTIFY</Button>`.
- `BackWrapper chrome="none"`.

**`DjProfile.tsx` / `PublicTracklist.tsx`:**
- Top frame like landing.
- Metadata rows (`SET LENGTH`, `IDENTIFIED N TRACKS`) in `.label-mono`.
- Body text remains Space Grotesk.
- "Go to MixMatch" button → `clip-bevel`.

**`SpotifyPlaylistModal.tsx`:**
- "Create Playlist" button → `<Button variant="spotify">`.

**Files touched:** Header, LandingPage, Dashboard view, Timeline, DjProfile, PublicTracklist, SpotifyPlaylistModal. All ≤30-line diffs each.

**Verification:** per file, side-by-side check; `pnpm test` (if any UI tests) green.

---

## Success criteria (whole port)

- [ ] Side-by-side: `demo/index.html` and live `pnpm dev` landing — 90% visual match (header frame, hero, console preview, CTA bevels, fonts, colors).
- [ ] Light/dark toggle works on every route. Buttons readable in both.
- [ ] Spotify-related actions are Spotify-green; everything else Winamp-green. No mixed-button collisions in same view.
- [ ] Existing functional flows pass: upload → analyze → results → export to Spotify, profile view, public tracklist.
- [ ] Lighthouse desktop perf on landing: regression ≤5 points vs `main`.
- [ ] Mobile (≤640px): no three.js loaded, grid visible, scanlines off, all flows work.
- [ ] No regression in TypeScript strict checks; no new lint errors after `pnpm format`.

## Out of scope (explicit)

- Clerk-rendered auth screens — keep Clerk default styling, just inherit primary color.
- Marketing copy changes — only typographic form changes (case, font, prefix), not wording.
- New routes or features.
- Backend/API changes.
- Any change to `packages/api/`.

## Verification gate (mid-port checkpoint)

After Step 4 (token swap + fonts + button + mono utilities), pause and review:
- Has identity already arrived? If yes, decide whether Steps 5-10 are still wanted.
- This is the natural stopping point if the team wants to ship something incremental.

## Rollback plan

Each step is a single commit on `redesign`. To roll back: `git revert <sha>` per step. Steps 1, 3, 4 are CSS-only and reversible without functional risk. Steps 7, 9 are the heaviest; if they regress perf or break, revert just those two and the rest of the port still stands.

## Tracking

TaskCreate list opened at start of implementation, one task per step, marked completed sequentially.
