# MixMatch /lab — redesign demo (track-recognition instrument)

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

## The idea — the 3D *means* something

The hero is an **oscilloscope trace of a mix**. A **playhead sweeps across it**, "scanning"; as it passes each segment the **recognition log fills row by row** and the **HUD counts coverage** (POS / SEG / COV). It runs once automatically on load, and re-runs on **RUN ANALYSIS** / dropzone / URL. So the animation shows exactly what the product does — it isn't decoration.

- Scan logic (`scanLoop` / `startScan` in `app.js`) is independent of 3D, so the HUD + log animate even with no WebGPU/WebGL.
- 3D (`init3D`) renders the trace + playhead with `WebGPURenderer`, auto-falls back to WebGL2; one TSL node drives a subtle background glow.

## Identity

Oscilloscope: near-black + a single **amber signal** colour (`--signal`), grid + scanlines, mono readouts, hairline panels with corner brackets. The 3D "screen" stays dark in both themes; the UI chrome flips light / dark (saved to `localStorage` `mm-demo-theme`). No purple gradients, no glass cards.

## Knobs

- three.js pinned to `0.170.0` in the importmap (TSL API moves between versions — bump deliberately).
- Tune in `app.js`: `SCAN_SECS`, `REVEAL_AT`, waveform shape in `init3D` (`N`, `env`, the sine layers), `AMBER`/`BRIGHT`.
- Accent colour lives in `--signal` (light + dark) in `styles.css`.

Concept only. Once the look is approved we port the structure + theming into `packages/web`.
