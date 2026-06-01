/* ============================================================
   MixMatch /lab — track recognition instrument (demo)
   The 3D is MEANINGFUL: an oscilloscope trace of the mix that a
   playhead sweeps across; as it scans, the recognition log fills
   and the HUD counts coverage. Scan logic is independent of 3D,
   so the instrument still "works" if WebGPU/WebGL can't start.
   ============================================================ */

/* ---------- Content ---------- */
const TIMELINE = [
  { time: '00:00 → 05:30', track: 'Dorisburg — Irrbloss', status: 'identified', conf: 0.97 },
  { time: '05:30 → 11:15', track: 'Hatikvah — Unforgettable', status: 'identified', conf: 0.93 },
  { time: '11:15 → 16:40', track: 'DJ Hell — The Angst (Henrik Schwarz Remix)', status: 'identified', conf: 0.9 },
  { time: '16:40 → 22:10', track: 'Unknown section', status: 'unknown', conf: 0 },
  { time: '22:10 → 28:00', track: 'Âme — Rej', status: 'identified', conf: 0.95 },
];
// normalized end-of-segment positions (fraction of the set) -> when the playhead reveals each row
const REVEAL_AT = [0.196, 0.402, 0.595, 0.79, 1.0];
const SET_SECONDS = 28 * 60;
const SCAN_SECS = 5.5;

const FEATURES = [
  { key: 'F.01', title: 'Audio fingerprinting', desc: 'ACRCloud recognition. Fast scans the highlights, Detailed goes segment by segment.' },
  { key: 'F.02', title: 'URL scanning', desc: 'Paste a SoundCloud or Mixcloud link and the engine downloads and scans it.' },
  { key: 'F.03', title: 'Spotify playlists', desc: 'One command turns a tracklist into a Spotify playlist in your own account.' },
  { key: 'F.04', title: 'Multi-format export', desc: 'Export for Mixcloud, SoundCloud, YouTube timestamps, or plain text.' },
  { key: 'F.05', title: 'Streaming links', desc: 'Spotify, YouTube, and Deezer links with inline players per identified track.' },
  { key: 'F.06', title: 'Shareable pages', desc: 'Public tracklist page on a custom URL. Clean layout, embedded players.' },
];

const PRICING = [
  { name: 'FREE', price: '$0', per: 'forever', featured: false, cta: 'GET STARTED', features: ['5 scans / month', '2 scans / day', 'Fast mode', 'Text export', 'Public share pages'] },
  { name: 'PRO', price: '$9.99', per: '/ mo', featured: true, cta: 'START TRIAL', features: ['30 scans / month', 'Fast + Detailed', 'All export formats', 'Spotify playlists', 'Streaming links'] },
  { name: 'STUDIO', price: '$29.99', per: '/ mo', featured: false, cta: 'CONTACT', features: ['Unlimited scans', 'Everything in Pro', 'URL scanning', 'DJ profile page', 'Custom URL'] },
];

/* ---------- Inject ---------- */
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

function injectTimeline() {
  $('#timeline').innerHTML = TIMELINE.map(
    (t) => `
    <div class="row ${t.status}" data-row>
      <span class="r-time mono">${t.time}</span>
      <span class="r-track">${t.track}</span>
      ${t.status === 'identified'
        ? `<span class="r-conf"><span class="cbar"><i class="cfill" data-conf="${t.conf}"></i></span>${Math.round(t.conf * 100)}%</span>`
        : `<span class="r-conf">no match</span>`}
    </div>`,
  ).join('');
}
function injectFeatures() {
  $('#features-grid').innerHTML = FEATURES.map(
    (f) => `<article class="cell feature" data-reveal><span class="fkey mono">${f.key}</span><h3>${f.title}</h3><p>${f.desc}</p></article>`,
  ).join('');
}
function injectPricing() {
  $('#pricing-grid').innerHTML = PRICING.map(
    (p) => `
    <div class="price ${p.featured ? 'featured' : ''}" data-reveal>
      ${p.featured ? '<span class="ptag">POPULAR</span>' : ''}
      <h3>${p.name}</h3>
      <div class="pamt"><span class="num">${p.price}</span> <span class="per">${p.per}</span></div>
      <ul>${p.features.map((f) => `<li>${f}</li>`).join('')}</ul>
      <a href="#top" class="btn">${p.cta}</a>
    </div>`,
  ).join('');
}

/* ---------- Theme ---------- */
const THEME_KEY = 'mm-demo-theme';
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'dark';
  apply(saved);
  $('#theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    apply(next);
    localStorage.setItem(THEME_KEY, next);
  });
  function apply(t) {
    document.documentElement.dataset.theme = t;
    $('#theme-label').textContent = t.toUpperCase();
  }
}

/* ---------- Tabs + inputs ---------- */
function initInputs() {
  const tabs = $$('.seg');
  tabs.forEach((tab) =>
    tab.addEventListener('click', () => {
      tabs.forEach((t) => {
        t.classList.toggle('is-active', t === tab);
        t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
      });
      $$('.tab-panel').forEach((p) => p.classList.toggle('is-active', p.dataset.panel === tab.dataset.tab));
    }),
  );
  const dz = $('#dropzone');
  ['dragenter', 'dragover'].forEach((e) => dz.addEventListener(e, (ev) => { ev.preventDefault(); dz.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((e) => dz.addEventListener(e, (ev) => { ev.preventDefault(); dz.classList.remove('is-over'); if (e === 'drop') startScan(); }));
  dz.addEventListener('click', startScan);
  $('#analyze-btn').addEventListener('click', startScan);
}

/* ---------- Scan engine (drives HUD + log; 3D reads it) ---------- */
const scan = { mode: 'idle', t: 0, last: performance.now() };
let revealed = 0;
let identified = 0;

const STATUS_LINES = [
  '> decoding audio stream',
  '> extracting fingerprints · 128 segments',
  '> matching against catalog',
  '> 4 / 5 segments identified · 80% coverage',
];

function startScan() {
  // reset
  scan.mode = 'scan';
  scan.t = 0;
  revealed = 0;
  identified = 0;
  $$('[data-row]').forEach((r) => {
    r.classList.remove('show');
    const f = r.querySelector('.cfill');
    if (f) f.style.width = '0';
  });
  setCoverage();
  // readout
  const btn = $('#analyze-btn');
  btn.querySelector('.analyze-label').textContent = 'SCANNING…';
  const out = $('#analyzer-status');
  out.classList.add('is-open');
  out.textContent = '';
  let i = 0;
  const type = () => {
    if (scan.mode !== 'scan' && scan.mode !== 'done') return;
    if (i < STATUS_LINES.length) {
      out.textContent += (i ? '\n' : '') + STATUS_LINES[i];
      i += 1;
      setTimeout(type, (SCAN_SECS * 1000) / STATUS_LINES.length);
    }
  };
  setTimeout(type, 250);
}

function revealRow(i) {
  const row = $$('[data-row]')[i];
  if (!row || row.classList.contains('show')) return;
  row.classList.add('show');
  const fill = row.querySelector('.cfill');
  if (fill) fill.style.width = `${Number(fill.dataset.conf) * 100}%`;
  revealed += 1;
  if (TIMELINE[i].status === 'identified') identified += 1;
  setCoverage();
}
function setCoverage() {
  const cov = Math.round((identified / TIMELINE.length) * 100);
  $('#hud-seg').textContent = `${identified}/${TIMELINE.length}`;
  $('#hud-cov').textContent = `${cov}%`;
  $('#coverage-label').textContent = `${identified} / ${TIMELINE.length} · ${cov}%`;
}
function fmt(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function scanLoop(now) {
  const dt = Math.min(0.05, (now - scan.last) / 1000);
  scan.last = now;
  if (scan.mode === 'scan') {
    scan.t = Math.min(1, scan.t + dt / SCAN_SECS);
    $('#hud-time').textContent = fmt(scan.t * SET_SECONDS);
    $('#hud-state').textContent = 'SCANNING';
    REVEAL_AT.forEach((p, i) => { if (scan.t >= p) revealRow(i); });
    if (scan.t >= 1) {
      scan.mode = 'done';
      $('#hud-state').textContent = 'DONE';
      $('#analyze-btn').querySelector('.analyze-label').textContent = 'RUN ANALYSIS';
      showToast('Demo preview — connect the real app to scan an actual mix.');
    }
  }
  requestAnimationFrame(scanLoop);
}

/* ---------- Reveal on scroll + toast + bar ---------- */
function initReveal() {
  const io = new IntersectionObserver(
    (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); if (e.target.id === 'accuracy' && scan.mode === 'idle') startScan(); } }),
    { threshold: 0.12 },
  );
  $$('[data-reveal]').forEach((el) => io.observe(el));
  const acc = $('#accuracy');
  if (acc) io.observe(acc);
}
let toastTimer;
function showToast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3800);
}

/* ---------- 3D oscilloscope (WebGPU + TSL; degrades gracefully) ---------- */
async function init3D() {
  const canvas = $('#lab-canvas');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let THREE, tsl;
  try {
    THREE = await import('three');
    tsl = await import('three/tsl');
  } catch (e) {
    console.warn('[lab] three.js load failed; CSS backdrop only.', e);
    return;
  }
  let renderer;
  try {
    renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: true });
    await renderer.init();
  } catch (e) {
    console.warn('[lab] renderer init failed; CSS backdrop only.', e);
    return;
  }

  const sizes = { w: innerWidth, h: innerHeight };
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(sizes.w, sizes.h);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, sizes.w / sizes.h, 0.1, 100);
  camera.position.set(0, 0.4, 22);

  const AMBER = new THREE.Color(0xffb000);
  const BRIGHT = new THREE.Color(0xffe2a0);

  // --- subtle TSL background glow (the one explicit TSL touch) ---
  try {
    const { color, uv, smoothstep } = tsl;
    const glowMat = new THREE.MeshBasicNodeMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const dist = uv().sub(0.5).length();
    glowMat.colorNode = color(0xffb000).mul(smoothstep(0.55, 0.0, dist)).mul(0.14);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(60, 34), glowMat);
    glow.position.z = -6;
    scene.add(glow);
  } catch (e) {
    console.warn('[lab] TSL glow skipped', e);
  }

  // --- oscilloscope trace (vertex-coloured line) ---
  const N = 420;
  const W = 17; // half-width
  const baseY = -1.2;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) pos[i * 3] = -W + (i / (N - 1)) * 2 * W;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending });
  const trace = new THREE.Line(geo, mat);
  scene.add(trace);
  // faint after-glow copy
  const glow2 = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffb000, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending }));
  glow2.position.y = -0.06;
  scene.add(glow2);

  // amplitude envelope: louder in tracks, quiet in the "unknown" middle
  const env = (t) => {
    const dip = 1 - 0.75 * Math.exp(-Math.pow((t - 0.69) / 0.08, 2)); // quiet around the unknown section
    return (0.5 + 0.5 * Math.sin(t * 6.28 * 2.5)) * 0.4 + 0.5 * dip;
  };

  // --- playhead ---
  const phGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, baseY - 4, 0), new THREE.Vector3(0, baseY + 4, 0)]);
  const playhead = new THREE.Line(phGeo, new THREE.LineBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.9 }));
  scene.add(playhead);

  // --- pointer parallax ---
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', (e) => { ptr.tx = (e.clientX / innerWidth - 0.5) * 2; ptr.ty = (e.clientY / innerHeight - 0.5) * 2; }, { passive: true });

  const t0 = performance.now();
  const c = new THREE.Color();

  function frame() {
    const time = (performance.now() - t0) / 1000;
    const headT = scan.mode === 'idle' ? 0 : scan.t;
    const headX = -W + headT * 2 * W;

    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      const x = pos[i * 3];
      const e = env(u);
      // live waveform: layered sines + fast detail, scrolling
      const y =
        baseY +
        e *
          (Math.sin(u * 38 + time * 3) * 1.3 +
            Math.sin(u * 14 - time * 1.7) * 0.8 +
            Math.sin(u * 90 + time * 6) * 0.35);
      pos[i * 3 + 1] = y;

      // colour: scanned = bright amber, ahead = dim, crest at the playhead
      const scanned = x <= headX;
      const near = 1 - Math.min(1, Math.abs(x - headX) / 0.6);
      let base = scanned ? 1 : 0.22;
      if (scan.mode === 'idle') base = 0.32 + 0.12 * Math.sin(time * 2 + u * 10);
      c.copy(scanned && near < 0.001 ? AMBER : AMBER).lerp(BRIGHT, Math.max(near, scanned ? 0.15 : 0));
      col[i * 3] = c.r * (base + near * 0.8);
      col[i * 3 + 1] = c.g * (base + near * 0.8);
      col[i * 3 + 2] = c.b * (base + near * 0.8);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;

    playhead.position.x = headX;
    playhead.material.opacity = scan.mode === 'scan' ? 0.9 : scan.mode === 'done' ? 0.35 : 0.0;

    ptr.x += (ptr.tx - ptr.x) * 0.05;
    ptr.y += (ptr.ty - ptr.y) * 0.05;
    camera.position.x = ptr.x * 1.4;
    camera.position.y = 0.4 - ptr.y * 0.8;
    camera.lookAt(0, baseY, 0);

    renderer.renderAsync(scene, camera);
  }
  renderer.setAnimationLoop(frame);

  addEventListener('resize', () => {
    sizes.w = innerWidth; sizes.h = innerHeight;
    camera.aspect = sizes.w / sizes.h; camera.updateProjectionMatrix();
    renderer.setSize(sizes.w, sizes.h);
  });
}

/* ---------- Boot ---------- */
injectTimeline();
injectFeatures();
injectPricing();
initTheme();
initInputs();
initReveal();
setCoverage();
requestAnimationFrame(scanLoop);
init3D();
// first impression: auto-run one scan so the instrument shows what it does
setTimeout(() => { if (scan.mode === 'idle') startScan(); }, 1500);
