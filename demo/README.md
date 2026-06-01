# MixMatch — Redesign demo (AI Audio Forensics Lab)

A **standalone, throwaway** concept of a redesigned landing page. No build step, no backend — just `index.html`, `styles.css`, `app.js`. The copy and meaning match the real site (still Beta, no YouTube as a scan input, SoundCloud / Mixcloud / upload), with a Three.js (WebGPU + TSL) "audio lab" backdrop and a light / dark toggle.

This is a sandbox to agree on the look **before** porting anything into the real React app.

## Run it

WebGPU needs a secure context, so serve it over `localhost` (don't just double-click the file):

```bash
# from the repo root
cd demo
python3 -m http.server 8080
# then open http://localhost:8080
```

or

```bash
npx serve demo
```

Opening `index.html` via `file://` usually still works but may fall back to WebGL2 (or, if 3D can't start at all, a CSS gradient backdrop — the page stays usable either way).

## What's in it

- **3D backdrop** (`app.js` → `init3D`): instanced waveform wall, drifting audio particles, neural-style connections, pointer parallax, and a glow "pulse" when you hit **Analyze**. Built on `WebGPURenderer` + TSL nodes, auto-falls back to WebGL2.
- **Theme**: the 3D scene stays dark in both modes; the UI chrome (text, cards, nav, sections) flips light / dark. Toggle is top-right; choice is saved to `localStorage` under `mm-demo-theme`.
- **Fake "Analyze" flow**: the upload dropzone / URL field + Analyze button run a scripted "decoding → fingerprinting → matching" status and reveal the example tracklist. It's a demo — no audio is sent anywhere.

## Notes / knobs

- three.js is pinned to `0.170.0` via the importmap in `index.html`. TSL's API moves between versions, so bump deliberately.
- Tune the scene in `init3D`: `COUNT` (waveform bars), `P` (particles), `COL_A` / `COL_B` (cyan / violet), camera position.
- Everything is concept-only. Once the look is approved, we port the structure + theming into `packages/web`.
