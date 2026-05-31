---
name: MixMatch
tagline: Every track in your mix, identified — a DJ-oriented audio fingerprinting app
theme:
  default_mode: dark
  mode_switch: manual + system preference
  style_lineage:
    - glass-morphism (translucent cards, backdrop blur)
    - ambient-gradient (soft blurred purple/violet/indigo blobs)
    - spotify-adjacent (green accent for identified tracks)
    - modern-dashboard (generous whitespace, large type, small icons)

colors:
  brand:
    primary:
      light: "oklch(0.541 0.281 293.009)"    # deep purple
      dark:  "oklch(0.627 0.265 303.9)"      # vivid violet
      role: Primary brand hue. Drives gradient buttons, focus rings, active-tab tint, spinning-disc accent, hero glow.
    gradient_primary:
      from:  "#9333ea"   # purple-600
      via:   "#8b5cf6"   # violet-500
      to:    "#6366f1"   # indigo-500
      role: Hero headings, primary button fill, "Most Popular" pricing badge, progress bar fill.
    disc_accent:
      hex: "#1DB954"     # Spotify green (intentional nod)
      hover: "#1ed760"
      subtle: "#6ee7a0"
      role: Identified-track confirmation (checks, left-borders, confidence ≥80%, Spotify-related actions).
  surface:
    light:
      background:        "oklch(0.985 0.002 285)"
      foreground:        "oklch(0.145 0 0)"
      card:              "oklch(1 0 0)"
      card_foreground:   "oklch(0.145 0 0)"
      popover:           "oklch(1 0 0)"
      secondary:         "oklch(0.955 0.005 285)"
      muted:             "oklch(0.955 0.005 285)"
      muted_foreground:  "oklch(0.45 0 0)"
      accent:            "oklch(0.955 0.005 285)"
      border:            "oklch(0.88 0.005 285)"
      input:             "oklch(0.88 0.005 285)"
      ring:              "oklch(0.541 0.281 293.009)"
    dark:
      background:        "oklch(0.09 0.005 285)"    # near-black, cool tinted
      foreground:        "oklch(0.95 0 0)"
      card:              "oklch(0.12 0.005 285 / 0.6)"     # translucent
      card_foreground:   "oklch(0.95 0 0)"
      popover:           "oklch(0.12 0.008 285 / 0.8)"
      secondary:         "oklch(0.18 0.01 285 / 0.6)"
      muted:             "oklch(0.18 0.01 285 / 0.5)"
      muted_foreground:  "oklch(0.65 0 0)"
      accent:            "oklch(0.2 0.02 285 / 0.5)"
      border:            "oklch(0.3 0.01 285 / 0.3)"
      input:             "oklch(0.2 0.01 285 / 0.5)"
      ring:              "oklch(0.627 0.265 303.9)"
  glass:
    light:
      bg:     "oklch(1 0 0 / 0.7)"
      border: "oklch(0 0 0 / 0.06)"
      hover:  "oklch(0 0 0 / 0.03)"
    dark:
      bg:     "oklch(1 0 0 / 0.03)"
      border: "oklch(1 0 0 / 0.08)"
      hover:  "oklch(1 0 0 / 0.06)"
    role: Cards, nav bars, tab pills, input fields. Always paired with backdrop-blur.
  semantic:
    success:
      fg_subtle: "oklch(0.71 0.19 149)"       # green-400
      fg_strong: "oklch(0.65 0.22 143)"       # green-500
      bg_tint:   "oklch(0.65 0.22 143 / 0.10)"
      border:    "oklch(0.65 0.22 143 / 0.20)"
      role: Identified segments, success toasts, Spotify buttons, public state badge.
    warning:
      fg: "oklch(0.83 0.18 85)"               # yellow-400
      bg_tint: "oklch(0.83 0.18 85 / 0.10)"
      border:  "oklch(0.83 0.18 85 / 0.20)"
      role: Duplicate-track chip, retrying state on waveform bars.
    destructive:
      light: "oklch(0.577 0.245 27.325)"
      dark:  "oklch(0.396 0.141 25.723)"
      fg_dark: "oklch(0.637 0.237 25.331)"
      role: Failed analyses, delete confirmations, error toasts, YouTube label color.
    info:
      fg: "oklch(0.71 0.18 240)"              # blue-400
      role: Bookmark pill/icon when active.
    favorite:
      fg: "oklch(0.83 0.18 85)"               # yellow-400 (star fill)
      bg_tint: "oklch(0.83 0.18 85 / 0.15)"
      role: Favorite toggle on dashboard rows.
  confidence_scale:
    high_≥80:   "oklch(0.71 0.19 149)"        # green
    mid_50-79:  "oklch(0.78 0.20 128)"        # lime
    low_<50:    "oklch(0.75 0.17 62)"         # orange
    unknown:    "oklch(0.65 0 0 / 0.25)"      # muted-foreground @ 25%
    retrying:   "oklch(0.83 0.18 85 / 0.70)"  # yellow
    role: Waveform bar fills; each bar inherits the color of the segment it overlaps.
  streaming_service:
    spotify:      "oklch(0.71 0.19 149)"
    apple_music:  "oklch(0.70 0.20 0)"        # pink-400
    beatport:     "oklch(0.71 0.18 240)"      # blue-400
    youtube:      "oklch(0.70 0.22 25)"       # red-400
    deezer:       "oklch(0.70 0.22 303)"      # purple-400
    role: Per-service chip colors on track rows.

typography:
  font_families:
    sans: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    mono: "'JetBrains Mono', ui-monospace, monospace"
  font_weights:
    sans: [400, 500, 600, 700]
    mono: [400, 500]
  base_font_size: "19px"   # deliberately large root — downstream rem units feel comfortable on desktop
  body_default: "text-[16px] antialiased"
  scale:
    micro:       { size: "10px",    weight: 500, role: "Tiny chips (Spotify, BPM, duplicate counter)" }
    xs:          { size: "0.75rem", weight: 400, role: "Metadata, time stamps, helper text, footer" }
    sm:          { size: "0.875rem", weight: 400-500, role: "Body copy, list items, input text" }
    base:        { size: "1rem",    weight: 400, role: "Paragraph on landing sections" }
    lg:          { size: "1.125rem", weight: 600, role: "Card titles, pricing tier names" }
    xl:          { size: "1.25rem", weight: 600, role: "Section subheaders, results header" }
    "2xl":       { size: "1.5rem",  weight: 700, tracking: "tight", role: "Analysis filename, page sub-heads" }
    "3xl":       { size: "1.875rem", weight: 700, tracking: "tight", role: "Section heroes, account-page H1" }
    "4xl":       { size: "2.25rem", weight: 700, tracking: "tight", role: "Hero on narrow screens, pricing H1" }
    "6xl":       { size: "3.75rem", weight: 700, tracking: "tight", role: "Landing hero headline (sm+)" }
  tracking:
    tight:    "-0.025em"   # all H1/H2/logo
    widest:   "0.1em"      # "RECENT" section label, stats captions
  line_height:
    headings: "1.1"
    body_relaxed: "1.625"
  special_treatments:
    gradient_text:
      description: Primary hero headlines and single accent words use a purple→violet→indigo gradient clipped to the glyph.
      light: "from #9333ea via #8b5cf6 to #6366f1"
      dark:  "from #c084fc via #a78bfa to #818cf8"
    mono_for_time:
      description: Every timestamp (00:00 — 05:30) and URL fake-bar uses JetBrains Mono at xs size in muted-foreground.
    all_caps_labels:
      description: Section micro-labels (RECENT, EXPORT) use uppercase, text-xs, medium weight, tracking-widest, muted-foreground.

spacing:
  scale_base_rem: 0.25   # follows Tailwind default — 1 unit = 4px
  common_gaps: [2, 3, 4, 5, 6, 8, 10, 12]
  container_widths:
    narrow:  "max-w-2xl"   # account, public tracklist, final CTAs
    default: "max-w-4xl"   # landing sections, pricing grid
    app:     "max-w-5xl"   # authenticated app shell
    wide:    "max-w-6xl"   # pricing page outer frame
  section_padding_y:
    landing: "py-20"       # every marketing section
    page:    "py-12"       # pricing/account pages
    app:     "py-8"        # authed app main
  horizontal_padding:
    mobile:  "px-4"
    desktop: "px-6"
  card_padding:
    default: "p-6"         # header/content/footer all get p-6 pt-0 for content
    tight:   "py-3 px-4"   # track rows, dashboard rows
    medium:  "py-4"        # summary stat card

radii:
  sm: "0.5rem"    # 8px  — small chip/badge, mini-buttons
  md: "0.625rem"  # 10px — nested small chips
  lg: "0.75rem"   # 12px — buttons, inputs, tab pills (baseline)
  xl: "1rem"      # 16px — larger buttons (size=lg), icon tiles
  "2xl": "1rem"   # 16px — cards (Tailwind rounded-2xl shorthand resolved)
  full: "9999px"  # avatar circle, "Most Popular" pill, notification dots
  default_radius_var: "0.75rem"
  role_map:
    pills:     "rounded-full"
    cards:     "rounded-2xl"
    buttons:   "rounded-xl (default) / rounded-lg (size=sm)"
    inputs:    "rounded-xl"
    chips:     "rounded-md"
    icon_tile: "rounded-xl or rounded-2xl"

shadows:
  card_lift:        "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)"
  modal:            "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)"
  toast:            "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)"
  button_default:   "0 0 20px rgb(139 92 246 / 0.3)"
  button_hover:     "0 0 30px rgb(139 92 246 / 0.5)"
  progress_fill:    "0 0 10px rgb(139 92 246 / 0.5)"
  glow_purple:      "0 0 30px oklch(0.627 0.265 303.9 / 0.15), 0 0 60px oklch(0.627 0.265 303.9 / 0.05)"
  glow_purple_dark: "0 0 30px oklch(0.627 0.265 303.9 / 0.20), 0 0 60px oklch(0.627 0.265 303.9 / 0.08)"
  glow_purple_strong: "0 0 20px oklch(0.627 0.265 303.9 / 0.30), 0 0 60px oklch(0.627 0.265 303.9 / 0.10)"
  role_map:
    button:    button_default (transitions to button_hover on :hover)
    hero_card: glow_purple (signature element of pricing "popular" tier & progress card)
    modal:     modal shadow
    toast:     toast shadow

elevation_layers:
  z_0_base:            "page background, -z-10 gradient blobs"
  z_auto_content:      "in-flow content"
  z_10_overlay_arts:   "waveform tooltips, playhead"
  z_50_nav_toast:      "sticky nav, toast container, fixed theme toggle"
  z_50_modal:          "Radix dialog overlay + content"

motion:
  durations:
    instant:    "0ms"
    fast:       "150ms"
    default:    "200ms"     # buttons, hover states, tab transitions
    medium:     "300ms"     # card hover, border-color changes
    slow:       "500ms"     # progress bar fill interpolation
    ambient:    "15s"       # gradient-shift blob loop
  easings:
    default:    "ease"
    smooth:     "cubic-bezier(0.4, 0, 0.2, 1)"
    in_out:     "ease-in-out"
  keyframes:
    gradient_shift:
      duration: "15s"
      loop: infinite
      role: Background blob drift — translate + subtle scale, creates ambient motion behind hero.
    indeterminate_progress:
      duration: "1.5s"
      loop: infinite
      role: Upload-phase progress when byte count is unknown — a 1/3-width bar sweeps L→R.
    slide_in_from_right:
      duration: "200ms"
      role: Toast enters from the right edge, bottom-right stack.
    fade_and_zoom:
      duration: "200ms"
      role: Radix dialogs — fade overlay, zoom (95→100%) content.
    spin_disc:
      short: "3s rotation"   # during active processing
      long:  "8s rotation"   # idle branding on hero
      role: The spinning vinyl disc is the app's signature motion.
    pulse_halo:
      role: Scaled purple blur behind key icons (hero disc, loader) softly pulses.
  interaction_patterns:
    button_hover: "brighten + stronger purple shadow + translate nothing (no lift)"
    card_hover:   "bg-glass-hover + border-color intensify, 300ms"
    tab_active:   "bg-primary/10 + primary foreground + border primary/20"
    drag_over:    "border-primary + bg-primary/5 + glow-purple on drop zone"
    focus_ring:   "2px ring of primary @ 50% opacity + border primary @ 30%"

iconography:
  library: "lucide-react"
  default_stroke: "2"
  sizes:
    inline_xs: "w-3 h-3"    # pencil, link2, x in toast
    inline_sm: "w-3.5 h-3.5"  # tab icons, small button glyphs
    inline_md: "w-4 h-4"    # most icons inside buttons/cards
    feature:   "w-5 h-5"    # feature cards, primary button glyph
    hero:      "w-6 h-6 to w-8 h-8"  # upload zone icon, loaders
    signature: "w-10 h-10 to w-16 h-16"  # hero Disc3, progress Disc3
  signature_icon: "Disc3 (vinyl record) — always tinted primary, frequently animated-spin"

components:
  button:
    variants:
      default:
        fill: "gradient purple→violet"
        text: white
        shadow: button_default
        hover: "brighter gradient + button_hover shadow"
      outline:
        fill: "glass-bg + backdrop-blur-sm"
        border: "1px border-border"
        hover: "bg-accent"
      secondary:
        fill: "secondary surface + backdrop-blur-sm + border"
        hover: "bg-accent"
      ghost:
        fill: transparent
        hover: "bg-accent + accent-foreground"
      destructive:
        fill: "red-600"
        hover: "red-700"
      link:
        text: primary
        decoration: "underline on hover, offset 4"
    sizes:
      default: { h: "36px", px: "16px", radius: lg, font: sm-medium }
      sm:      { h: "32px", px: "12px", radius: lg, font: xs-medium }
      lg:      { h: "44px", px: "32px", radius: xl, font: base-medium }
      icon:    { h: "36px", w: "36px", radius: lg }
    focus: "ring-2 ring-ring/50"
  card:
    surface: "glass-bg + border-glass-border + backdrop-blur-xl"
    radius: "2xl (16px)"
    transition: "all 300ms — bg + border on hover"
    hover: "bg-glass-hover + border-border"
    text: card-foreground
    subparts:
      header:      "p-6 space-y-1.5"
      title:       "font-semibold leading-none tracking-tight"
      description: "text-sm text-muted-foreground"
      content:     "p-6 pt-0"
      footer:      "p-6 pt-0 flex items-center"
    left_border_status:
      pattern: "border-l-3 + color-coded tint"
      identified:          "border-l-green-400/70"
      identified_bookmarked: "border-l-green-400 + ring-1 ring-green-500/20 + bg-green-500/[0.03]"
      retrying:            "border-l-primary"
      unknown:             "border-l-muted-foreground/10"
  input:
    radius: xl
    surface: "glass-bg + backdrop-blur-sm + border-border"
    padding: "px-4 py-2.5 or pl-9 pr-3 py-2.5 when prefixed by search icon"
    focus: "ring-2 ring-primary/50 + border-primary/30"
  dialog:
    overlay: "fixed inset-0 bg-black/60 backdrop-blur-sm"
    content: "max-w-md, rounded-2xl, border-border, bg-background, p-6, shadow-xl"
    animation: "fade + zoom (95→100%) 200ms"
    title: "text-lg font-semibold text-center"
    description: "text-sm muted-foreground text-center"
  toast:
    position: "fixed bottom-4 right-4, stacked space-y-2"
    entry: "slide-in-from-right"
    lifetime_ms: 4000
    success: "bg-green-500/10 border-green-500/30 text-green-500 + CheckCircle"
    error:   "bg-destructive/10 border-destructive/30 text-destructive + XCircle"
  nav:
    top_bar: "sticky/fixed, 56px tall (h-14), backdrop-blur-2xl, bg-background/60, border-b border-border/50"
    logo: "Disc3 primary + 'MixMatch' font-semibold tracking-tight"
  tabs:
    surface: "glass-bg + border-glass-border, rounded-xl, p-1 inline-flex"
    inactive: "text-muted-foreground, hover bg-accent"
    active: "bg-primary/10 + text-primary + border-primary/20"
  progress_bar:
    track: "h-1.5 bg-muted rounded-full overflow-hidden"
    fill:  "gradient purple→violet-400 + shadow 0 0 10px purple/0.5"
    indeterminate: "1/3-wide fill sweeping 1.5s"
  waveform:
    height: "80px (h-20)"
    bar_gap: "1px"
    max_bars: 300
    bar_radius: "rounded-sm"
    energy_overlay: "SVG smoothed line @ primary/30"
    tooltip: "280px wide, bg-popover, rounded-lg, centered above playhead"
    playhead: "1px, bg-foreground/50"
    transition_markers: "1px, bg-white/30 at identified-segment boundaries"
  chip:
    base: "rounded-md px-1.5 py-0.5 text-[10px] font-medium + bg/border @ 10-20% of hue"
    examples:
      - { kind: "BPM / genre / key", tone: "muted-foreground on muted/50 with glass-border" }
      - { kind: "Spotify affinity",  tone: "green-400 on green-500/10 with green-500/20 border" }
      - { kind: "Duplicate (xN)",    tone: "yellow-400 on yellow-500/10 with yellow-500/20 border" }
  drop_zone:
    base: "rounded-2xl border-2 border-dashed, cursor-pointer, transition-all 300ms"
    idle: "border-border + hover:border-primary/40 + hover:bg-muted/30"
    over: "border-primary + bg-primary/5 + glow-purple"
    icon_tile: "w-14 h-14 rounded-2xl bg-primary/10 center-flex + Upload primary"

backgrounds:
  ambient_blobs:
    count: 2–3 per page
    size: "300px – 600px"
    blur: "80px – 120px"
    opacity: "6-10%"
    colors: ["purple-600", "violet-500", "indigo-500"]
    position: "edges (top-left, bottom-right, mid-right)"
    motion: "animate-gradient-shift 15s with staggered animation-delay (-5s, -10s)"
    z_index: "-10 (always behind content)"
  page_frame:
    idea: "min-h-screen bg-background text-foreground overflow-hidden"
    width: "max-w-{2xl,4xl,5xl,6xl} mx-auto px-{4,6}"

accessibility:
  focus_visible: "ring-2 ring-ring/50, always visible on buttons and inputs"
  contrast: "Dark mode ~WCAG AA on primary text (foreground 95% vs background 9%). Muted text uses oklch 0.65 which stays above 3:1 for UI chrome."
  motion_reduction: "Ambient blob + spin animations should respect prefers-reduced-motion (not currently auto-disabled — future work)."
  semantic_html: "Sections wrapped in <section>, headings in correct order, buttons are real <button>."
  aria_labels: "Theme toggle exposes aria-label; Radix Dialog provides DialogTitle/DialogDescription by default."
  keyboard: "Edit-segment input supports Enter to save, Escape to cancel."

breakpoints:
  sm:  "640px"   # scales hero from 4xl → 6xl; unhides BPM/key chips
  md:  "768px"   # switches 1-col feature/pricing grids to 2/3-col
  lg:  "1024px"  # enables 3-col feature grid
  xl:  "1280px"
  strategy: "mobile-first, progressive enhancement; layouts collapse gracefully to single-column"

theming:
  storage_key: "theme"   # localStorage
  values: ["light", "dark"]
  system_fallback: "matches prefers-color-scheme when no saved value"
  toggle_pattern: "Ghost-icon button, Sun↔Moon glyphs, swaps .dark class on <html>"
  preflight_script: "Inline <head> script sets .dark before first paint to avoid FOUC"
---

# MixMatch — Visual Identity

## Intent

MixMatch is a DJ-facing tool that listens to a mix and returns a timestamped tracklist. The interface has to convey three things at once: **it's technical** (audio fingerprinting, percentages, timestamps), **it's musical** (DJs, vinyl, streaming platforms), and **it's fast** (upload, wait ~20s, get results). The visual language is built around those three signals.

The mood is **dark-first, ambient, modern club-adjacent** — not harsh, not gaming-aggressive, not enterprise-flat. Think of a late-night browser tab that still feels premium in daylight. The light theme is supported and clean but the product is designed dark; the landing page assumes dark even before the user toggles.

## Color Story

**Purple is the brand.** Every primary action — hero headlines, main CTAs, progress fills, focus rings, "identified" indicators of motion, the spinning disc — lives on a **purple → violet → indigo** gradient that runs roughly from `#9333ea` through `#8b5cf6` to `#6366f1`. On hero text and a few accent numerals the gradient is clipped into the glyph shape (`.gradient-text`), giving the product a single signature visual move that reads as distinctive without being loud.

**Green is the confirmation.** Spotify-green (`#1DB954`) marks successful track identification: a left border on identified rows, a tiny check inside a soft green disc, the "Spotify" chip, and the success toast. Because this green is also Spotify's brand color, it does double duty — it reinforces the streaming-platform connection the product is selling.

**A sliding confidence scale lives on the waveform.** Bars are colored green (≥80%), lime (50–79%), orange (<50%), and neutral gray (unknown). This is the one place the UI deliberately admits uncertainty.

**Grays are cool and slightly purple-tinted.** The dark background sits at `oklch(0.09 0.005 285)` — nearly black, but with a measurable blue-purple cast at hue 285. Surfaces step up in ~3-4% lightness increments and are almost always translucent (e.g. card = `oklch(0.12 0.005 285 / 0.6)`), letting the ambient blob backgrounds bleed through.

## Surface Model — Glass over Blobs

Every page is composed in two visual layers:

1. **A fixed z-10 backdrop of 2–3 large blurred gradient blobs** (purple, violet, indigo) sitting at the edges of the viewport, each around 300–600 px wide with 80–120 px of blur, running at ~6–10% opacity. On the landing and pricing pages these blobs drift continuously on a 15-second `gradient-shift` loop with staggered delays so they're never in sync. Inner pages (public tracklist, DJ profile) use a calmer, non-animated variant of the same motif.
2. **Glass surfaces on top.** Cards, nav bars, tab pills, inputs, and popovers all use a translucent white/black at ~3–7% opacity combined with a heavy `backdrop-blur-xl` (24 px) or `backdrop-blur-2xl` (40 px for nav). Borders are hairline and low-contrast (`oklch(1 0 0 / 0.08)` in dark mode).

The result is that content feels suspended rather than plated. Nothing sits flat against the background — everything catches a little light. The navbar does the same thing, with `bg-background/60` + `backdrop-blur-2xl`, so the hero seeps into it from above.

## Typography — Inter + JetBrains Mono

Inter carries all UI and prose, in four weights (400/500/600/700). JetBrains Mono is reserved for a single narrow purpose: **numbers that represent time**. Every `MM:SS` timestamp, every demo-URL in the product mock (`mixmatch.app/t/my-set`), and every attempt counter is mono, xs, and muted — the engineering signature of a tool that speaks to DJs in seconds and BPM.

The root font-size is deliberately set to **19px** — larger than typical — which pushes all `rem`-scaled type up a notch. On desktop this gives the landing page a calm, generous feel; body copy sits closer to 15–16 px rather than the 14 px most SaaS products default to. Hero headlines are `text-6xl` (60 px) on wide screens with `tracking-tight` and `font-bold`, and the single most common headline treatment is the purple gradient clip.

Section micro-labels (`RECENT`, `EXPORT`) use an all-caps, `text-xs`, `tracking-widest`, muted-foreground treatment — a small typographic tell that signals "this is a utility section header, not prose."

## Radii & Shape Language

- **Cards are 16 px (`rounded-2xl`)** — the most common container radius.
- **Buttons and inputs are 12 px (`rounded-xl`)**, which relates proportionally to the card radius.
- **Chips, badges, and service pills are 6 px (`rounded-md`)** — small, tight, text-hugging.
- **Pills, avatar circles, notification dots, and the "Most Popular" badge are fully rounded**.

The language is **roundish but not pill-obsessed**. Nothing is sharp-edged; nothing (except explicit pills) is fully round. Left-border accents on status rows use a 3 px vertical stroke to mirror the card radius without fighting it.

## Motion

Motion is used sparingly but consistently. Four moves define the feel:

1. **The spinning disc.** A `Disc3` vinyl icon tinted primary is the app's logomark. Idle, it rotates every 8 seconds. During active processing it speeds up to 3 seconds and sits inside a pulsing purple halo. This is the single most recognizable animation in the product.
2. **The gradient-shift blob drift.** Background blobs translate and gently scale on a 15-second loop, staggered so the scene always looks alive without calling attention to itself.
3. **Short interaction transitions (200 ms).** Buttons brighten their gradient and grow their purple shadow; cards fade from `glass-bg` to `glass-hover` and intensify their border. No lifts, no translate-on-hover — everything stays put and changes tone instead.
4. **Dialog + toast micro-animations.** Radix dialogs fade + zoom from 95 → 100%; toasts slide in from the right edge and stack at bottom-right.

Progress bars use **two modes**: a determinate purple gradient with a soft glow, or a 1/3-width indeterminate bar that sweeps left-to-right on a 1.5 s loop when byte counts aren't known (URL downloads).

## Iconography

Lucide React throughout. Most icons run at `w-4 h-4` (16 px) inside buttons and `w-3.5 h-3.5` (14 px) inside smaller pills. Feature-card icons sit in a `w-10 h-10` rounded-xl tile tinted `bg-primary/10` with the glyph itself in primary — a repeated motif that's also used for the upload drop zone (scaled up to `w-14`) and pricing-tier cards.

The `Disc3` vinyl record is the one icon that's used signaturally: in the logo, in the hero, inside the progress card, as a row marker for mix entries, and on favicons.

## Component Patterns

### Track row (the core artifact)
A glass card with a 3 px colored left-border that communicates status at a glance:
- **green-400/70** → identified
- **green-400 + ring + subtle tint** → identified and bookmarked
- **primary (violet)** → retrying
- **muted-foreground/10** → unknown section

Each row contains a mono timestamp, a circular green check (for identified), the track title, optional BPM/genre/key chips, per-service streaming pills (Spotify, Apple, Beatport, YouTube, Deezer — each tinted its platform color), and an action cluster (edit, copy-link, bookmark, upvote, downvote) that fades in on hover at 60% → 100% opacity.

### Waveform
Full-width stack of up to 300 bars, each `flex-1`, gapped at 1 px, rendered into an 80 px tall crosshair-cursor strip. Bar height encodes energy (real waveform data when available, pseudo-random fallback). Bar color encodes confidence. A smoothed SVG energy curve at 30% primary overlays the bars for "shape." Hovering reveals a 280 px tooltip floating above and a vertical playhead.

### Drop zone
A dashed rounded-2xl frame. Idle state is neutral; drag-over flips the border to primary, adds a soft tint (`bg-primary/5`), and turns on the signature purple glow. Inside sits a `w-14 h-14` rounded-xl icon tile and two lines of copy ("Drop your DJ mix here" / "or click to browse") plus an ultra-muted file-format hint.

### Pricing cards
Three cards side-by-side. The highlighted (Pro) tier pulls ahead visually by gaining a `border-primary/40`, `glow-purple` shadow, and a small gradient "Most Popular" pill floating half-off the top edge. Prices are `text-3xl` or `text-4xl` bold; period in muted-foreground with a leading slash. Feature lists use a small primary checkmark and muted body copy.

### Nav + header
A 56 px tall sticky (authed app) or fixed (landing) bar at `bg-background/60` with a strong `backdrop-blur-2xl` and a hairline bottom border. Left side: `Disc3` + "MixMatch" wordmark. Right side: theme toggle, an optional credits chip, and the user menu.

### Toast
A small rounded-lg bar in the bottom-right corner, 4-second lifetime, sliding in from the right. Success uses green fill/border at 10%/30% opacity with a CheckCircle icon; error uses the destructive color with XCircle. Manual dismiss via an `X` button at 60% opacity.

### Dialog
Centered, `max-w-md`, `rounded-2xl`, solid `bg-background` with a shadow-xl. Overlay is `bg-black/60` + `backdrop-blur-sm`. Title is centered, semibold, `text-lg`. Description is centered, `text-sm`, muted-foreground. Used for scan-mode selection, delete confirmation, and export modals.

## Theming

Dark and light modes both exist and are genuinely supported. The `dark` class on `<html>` is set by a small pre-paint script that reads `localStorage.theme` and falls back to `prefers-color-scheme: dark`. Users toggle via a ghost-icon button (Sun/Moon) in the header.

Both themes share identical semantics — every semantic token (`--primary`, `--card`, `--glass-bg`) redefines for `.dark`. Glass values are materially different: light mode uses translucent **white** (`oklch(1 0 0 / 0.7)`) over a near-white background, while dark mode uses translucent **white at 3%** over a near-black background. This preserves the glass-morphism identity in both modes rather than inverting.

## Layout Rhythm

- Authed app: `max-w-5xl` container, `px-6 py-8`, vertical rhythm of `space-y-6`.
- Public pages: `max-w-2xl` container, `py-12`, centered header block with the halo-disc motif.
- Landing: full-width sections, each `py-20`, inner content constrained to `max-w-2xl`/`4xl` based on density.
- Pricing: `max-w-6xl` outer, 3-column md+, gap-6 between cards.

## Design Principles

1. **Suspend, don't plate.** Every surface floats over ambient color. If a component feels like a printed card, it's wrong.
2. **Purple for motion, green for confirmation.** Don't swap these. A green gradient button or a purple "success" toast would feel off-brand.
3. **Mono is for seconds.** Timestamps and attempt counters use mono; everything else uses Inter.
4. **Animation is ambient.** Motion lives in the background, in the spinning disc, and in 200-ms state transitions. No micro-interactions that bounce, no parallax, no scroll-jacking.
5. **Density matches the data.** Track rows are tight (`py-3 px-4`); marketing cards are generous (`p-6`+). Let the same design system speak differently to logged-in power users and to first-time visitors.
6. **Confidence is visible, not hidden.** When the tool is uncertain (unknown segments, mid-confidence matches), the UI says so in color and typography rather than rounding up.
