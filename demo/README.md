# MixMatch /studio — redesign demo (track-recognition instrument)

A **standalone, throwaway** concept of a redesigned landing page. No build step, no backend — `index.html`, `styles.css`, `app.js`. Copy and meaning match the real site (still Beta, no YouTube as a scan input, SoundCloud / Mixcloud / upload), with an **oscilloscope / instrument** visual identity and a light / dark toggle.

This is a sandbox to agree on the look **before** porting anything into the real React app.

## Run it

WebGPU needs a secure context, so serve over `localhost` (don't just double-click the file):

```bash
cd demo
python3 -m http.server 8080
# then open http://localhost:8080
```

or `npx serve demo`. Over `file://` it usually still works but may fall back to WebGL2 — or, if 3D can't start at all, a CSS gradient backdrop carries the hero. The page is usable either way.

## The idea — design + function in one place

Two screens, like the real product:

- **Landing** (`#screen-landing`): the marketing page. Its hero shows a calm oscilloscope *monitor* (preview) — it does **not** pretend to scan.
- **App console** (`#screen-app`): where scanning actually happens. **Get started / Run a scan** opens it. Flow: **Upload** (file/URL + Fast/Detailed mode + recent scans) → **Scanning** → **Results**.

The **Scanning** state is the meaningful 3D: the oscilloscope playhead follows real progress — `chunksProcessed / 128`, % complete, ETA, the track currently being matched — and the **recognition log fills row by row** as segments are identified, then it lands on **Results** (full log + confidence + export / share / Spotify). This mirrors the real `ProgressBar` → `Timeline` flow in `packages/web`.

- The scan engine (`runScan` / `tickScan` / master `loop` in `app.js`) drives the HUD, progress and log; the 3D just reads `head.t`. So it still works with no WebGPU/WebGL.
- 3D (`init3D`) renders the trace + playhead with `WebGPURenderer` (auto WebGL2 fallback); one TSL node drives a subtle background glow.

## Identity

Oscilloscope: near-black + a single **amber signal** colour (`--signal`), grid + scanlines, mono readouts, hairline panels with corner brackets. The 3D "screen" stays dark in both themes; the UI chrome flips light / dark (saved to `localStorage` `mm-demo-theme`). No purple gradients, no glass cards.

## Knobs

- three.js pinned to `0.170.0` in the importmap (TSL API moves between versions — bump deliberately).
- Tune in `app.js`: `SCAN_SECS`, `REVEAL_AT`, waveform shape in `init3D` (`N`, `env`, the sine layers), `AMBER`/`BRIGHT`.
- Accent colour lives in `--signal` (light + dark) in `styles.css`.

Concept only. Once the look is approved we port the structure + theming into `packages/web`.
