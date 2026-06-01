/* ============================================================
   MixMatch /lab — track recognition instrument (demo)
   Two screens: a marketing LANDING and the APP CONSOLE where
   scanning actually happens (Upload → Scanning → Results).
   The oscilloscope playhead follows real scan progress; the same
   scan engine drives the live HUD, progress and recognition log.
   ============================================================ */

/* ---------- Content ---------- */
const TIMELINE = [
  { time: '00:00 → 05:30', track: 'Dorisburg — Irrbloss', status: 'identified', conf: 0.97 },
  { time: '05:30 → 11:15', track: 'Hatikvah — Unforgettable', status: 'identified', conf: 0.93 },
  { time: '11:15 → 16:40', track: 'DJ Hell — The Angst (Henrik Schwarz Remix)', status: 'identified', conf: 0.9 },
  { time: '16:40 → 22:10', track: 'Unknown section', status: 'unknown', conf: 0 },
  { time: '22:10 → 28:00', track: 'Âme — Rej', status: 'identified', conf: 0.95 },
];
const REVEAL_AT = [0.196, 0.402, 0.595, 0.79, 1.0]; // normalized end of each segment
const SET_SECONDS = 28 * 60;
const TOTAL_CHUNKS = 128;

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
const RECENT = [
  { name: 'warehouse-set.mp3', stat: '4/5', date: 'YESTERDAY · 28:00' },
  { name: 'boiler-room-rip', stat: '11/12', date: '3 DAYS AGO · 61:20' },
  { name: 'sunset-b2b.wav', stat: '7/9', date: 'LAST WEEK · 44:10' },
];

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const fmt = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
function rowHTML(t) {
  return `<div class="row ${t.status}">
    <span class="r-time mono">${t.time}</span>
    <span class="r-track">${t.track}</span>
    ${t.status === 'identified'
      ? `<span class="r-conf"><span class="cbar"><i class="cfill" style="width:${Math.round(t.conf * 100)}%"></i></span>${Math.round(t.conf * 100)}%</span>`
      : `<span class="r-conf">no match</span>`}
  </div>`;
}

/* ---------- inject ---------- */
function injectStatic() {
  $('#timeline').innerHTML = TIMELINE.map((t) => `<div class="row ${t.status} show">
      <span class="r-time mono">${t.time}</span>
      <span class="r-track">${t.track}</span>
      ${t.status === 'identified'
        ? `<span class="r-conf"><span class="cbar"><i class="cfill" style="width:${Math.round(t.conf * 100)}%"></i></span>${Math.round(t.conf * 100)}%</span>`
        : `<span class="r-conf">no match</span>`}
    </div>`).join('');
  $('#features-grid').innerHTML = FEATURES.map(
    (f) => `<article class="cell feature" data-reveal><span class="fkey mono">${f.key}</span><h3>${f.title}</h3><p>${f.desc}</p></article>`,
  ).join('');
  $('#pricing-grid').innerHTML = PRICING.map(
    (p) => `<div class="price ${p.featured ? 'featured' : ''}" data-reveal>${p.featured ? '<span class="ptag">POPULAR</span>' : ''}
      <h3>${p.name}</h3><div class="pamt"><span class="num">${p.price}</span> <span class="per">${p.per}</span></div>
      <ul>${p.features.map((f) => `<li>${f}</li>`).join('')}</ul>
      <button class="btn" data-enter-app>${p.cta}</button></div>`,
  ).join('');
  $('#recent-list').innerHTML = RECENT.map(
    (r) => `<li data-enter-results><span class="rl-name">${r.name}</span><span class="rl-stat">${r.stat}</span><span class="rl-date mono">${r.date}</span></li>`,
  ).join('');
}

/* ---------- theme (shared by landing + app toggles) ---------- */
const THEME_KEY = 'mm-demo-theme';
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  $$('#theme-label, .theme-label2').forEach((el) => (el.textContent = t.toUpperCase()));
  localStorage.setItem(THEME_KEY, t);
}
function initTheme() {
  setTheme(localStorage.getItem(THEME_KEY) || 'dark');
  $$('#theme-toggle, [data-theme-toggle]').forEach((b) =>
    b.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark')),
  );
}

/* ---------- router ---------- */
const app = { view: 'home', mode: 'fast' };
function enterApp(autorun) {
  $('#screen-landing').hidden = true;
  $('#screen-app').hidden = false;
  scrollTo(0, 0);
  setView('home');
  if (autorun) setTimeout(runScan, 350);
}
function exitApp() {
  $('#screen-app').hidden = true;
  $('#screen-landing').hidden = false;
  scan.mode = 'idle';
  app.view = 'home';
}
function setView(v) {
  app.view = v;
  $$('.app-view').forEach((el) => (el.hidden = el.dataset.view !== v));
  $('#app-route').textContent =
    v === 'home' ? 'CONSOLE / NEW SCAN' : v === 'scan' ? 'CONSOLE / SCANNING' : 'CONSOLE / RESULT';
}

/* ---------- app inputs ---------- */
function initInputs() {
  $$('.seg').forEach((tab) =>
    tab.addEventListener('click', () => {
      $$('.seg').forEach((t) => { t.classList.toggle('is-active', t === tab); t.setAttribute('aria-selected', t === tab); });
      $$('.tab-panel').forEach((p) => p.classList.toggle('is-active', p.dataset.panel === tab.dataset.tab));
    }),
  );
  $$('.mode').forEach((m) =>
    m.addEventListener('click', () => {
      app.mode = m.dataset.mode;
      $$('.mode').forEach((x) => x.classList.toggle('is-active', x === m));
    }),
  );
  const dz = $('#dropzone');
  ['dragenter', 'dragover'].forEach((e) => dz.addEventListener(e, (ev) => { ev.preventDefault(); dz.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((e) => dz.addEventListener(e, (ev) => { ev.preventDefault(); dz.classList.remove('is-over'); if (e === 'drop') runScan(); }));
  dz.addEventListener('click', runScan);
  $('#analyze-btn').addEventListener('click', runScan);
  $('#newscan-btn').addEventListener('click', () => setView('home'));

  $$('[data-enter-app]').forEach((b) => b.addEventListener('click', () => enterApp(b.hasAttribute('data-autorun'))));
  $$('[data-exit-app]').forEach((b) => b.addEventListener('click', exitApp));
  // recent scans jump straight to a finished result
  document.addEventListener('click', (e) => {
    const li = e.target.closest('[data-enter-results]');
    if (li) { fillResults(); setView('results'); }
  });
}

/* ---------- scan engine (drives app HUD + log; 3D reads it) ---------- */
const scan = { mode: 'idle', t: 0, last: performance.now(), secs: 4 };
let found = 0;

function runScan() {
  setView('scan');
  scan.mode = 'scan';
  scan.t = 0;
  scan.secs = app.mode === 'detailed' ? 6.5 : 4;
  found = 0;
  $('#live-log').innerHTML = '';
  $('#s-found').textContent = '0';
  $('#s-cov').textContent = '0%';
  $('#s-track').textContent = 'initializing engine…';
}

function currentSegment(t) {
  for (let i = 0; i < REVEAL_AT.length; i++) if (t < REVEAL_AT[i]) return i;
  return REVEAL_AT.length - 1;
}

function tickScan() {
  if (scan.mode !== 'scan') return;
  const chunk = Math.min(TOTAL_CHUNKS, Math.round(scan.t * TOTAL_CHUNKS));
  const pct = Math.round(scan.t * 100);
  $('#s-pct').textContent = `${pct}%`;
  $('#s-bar').style.width = `${pct}%`;
  $('#s-seg').textContent = `${String(chunk).padStart(3, '0')} / ${TOTAL_CHUNKS}`;
  const rem = Math.ceil((1 - scan.t) * scan.secs);
  $('#s-eta').textContent = `${rem}s`;
  const seg = TIMELINE[currentSegment(scan.t)];
  $('#s-track').textContent = seg.status === 'identified' ? `matching · ${seg.track}` : 'no catalog match in this segment';

  // reveal rows into the live log as the playhead crosses each segment end
  REVEAL_AT.forEach((p, i) => {
    if (scan.t >= p && !$(`#live-log [data-i='${i}']`)) {
      const html = rowHTML(TIMELINE[i]).replace('<div class="row', `<div data-i="${i}" class="row show`);
      $('#live-log').insertAdjacentHTML('beforeend', html);
      if (TIMELINE[i].status === 'identified') found += 1;
      $('#s-found').textContent = String(found);
      $('#s-cov').textContent = `${Math.round((found / TIMELINE.length) * 100)}%`;
    }
  });

  if (scan.t >= 1) {
    scan.mode = 'done';
    $('#s-state').textContent = 'DONE';
    setTimeout(() => { fillResults(); setView('results'); showToast('Demo — connect the real backend to scan an actual mix.'); }, 600);
  }
}

function fillResults() {
  $('#results-log').innerHTML = TIMELINE.map((t) => rowHTML(t).replace('class="row', 'class="row show')).join('');
  const id = TIMELINE.filter((t) => t.status === 'identified').length;
  const cov = Math.round((id / TIMELINE.length) * 100);
  $('#r-meta').textContent = `${id} / ${TIMELINE.length} identified · ${cov}% coverage · ${app.mode}`;
  $('#r-cov').textContent = `${id} / ${TIMELINE.length} · ${cov}%`;
}

/* ---------- master loop (advances scan + the 3D playhead value) ---------- */
const head = { t: 0, scanning: false };
function loop(now) {
  const dt = Math.min(0.05, (now - scan.last) / 1000);
  scan.last = now;
  if (scan.mode === 'scan') scan.t = Math.min(1, scan.t + dt / scan.secs);
  tickScan();

  if (app.view === 'scan' && scan.mode !== 'idle') {
    head.t = scan.t;
    head.scanning = true;
  } else {
    head.t = (now / 7000) % 1; // calm monitor sweep on the landing
    head.scanning = false;
  }
  requestAnimationFrame(loop);
}

/* ---------- reveal-on-scroll + toast ---------- */
function initReveal() {
  const io = new IntersectionObserver(
    (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); } }),
    { threshold: 0.12 },
  );
  $$('[data-reveal]').forEach((el) => io.observe(el));
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
  try { THREE = await import('three'); tsl = await import('three/tsl'); }
  catch (e) { console.warn('[lab] three load failed', e); return; }
  let renderer;
  try { renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: true }); await renderer.init(); }
  catch (e) { console.warn('[lab] renderer init failed', e); return; }

  const sizes = { w: innerWidth, h: innerHeight };
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(sizes.w, sizes.h);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, sizes.w / sizes.h, 0.1, 100);
  camera.position.set(0, 0.4, 22);

  const AMBER = new THREE.Color(0xffb000);
  const BRIGHT = new THREE.Color(0xffe2a0);

  try {
    const { color, uv, smoothstep } = tsl;
    const gm = new THREE.MeshBasicNodeMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    gm.colorNode = color(0xffb000).mul(smoothstep(0.55, 0.0, uv().sub(0.5).length())).mul(0.13);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(60, 34), gm);
    glow.position.z = -6;
    scene.add(glow);
  } catch (e) { console.warn('[lab] TSL glow skipped', e); }

  const N = 420, W = 17, baseY = -1.0;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) pos[i * 3] = -W + (i / (N - 1)) * 2 * W;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const trace = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending }));
  scene.add(trace);

  const env = (t) => (0.55 + 0.45 * Math.sin(t * 15.7)) * (1 - 0.72 * Math.exp(-Math.pow((t - 0.69) / 0.07, 2)));

  const phGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, baseY - 4, 0), new THREE.Vector3(0, baseY + 4, 0)]);
  const playhead = new THREE.Line(phGeo, new THREE.LineBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.0 }));
  scene.add(playhead);

  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', (e) => { ptr.tx = (e.clientX / innerWidth - 0.5) * 2; ptr.ty = (e.clientY / innerHeight - 0.5) * 2; }, { passive: true });

  const t0 = performance.now();
  const c = new THREE.Color();
  function frame() {
    const time = (performance.now() - t0) / 1000;
    const headX = -W + head.t * 2 * W;
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      const x = pos[i * 3];
      const e = env(u);
      pos[i * 3 + 1] = baseY + e * (Math.sin(u * 38 + time * 3) * 1.25 + Math.sin(u * 14 - time * 1.7) * 0.75 + Math.sin(u * 92 + time * 6) * 0.32);
      const scanned = head.scanning && x <= headX;
      const near = 1 - Math.min(1, Math.abs(x - headX) / 0.55);
      let base = head.scanning ? (scanned ? 1 : 0.2) : 0.34 + 0.1 * Math.sin(time * 2 + u * 9);
      c.copy(AMBER).lerp(BRIGHT, Math.max(near, scanned ? 0.2 : 0));
      const k = base + (head.scanning ? near * 0.9 : 0);
      col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    playhead.position.x = headX;
    playhead.material.opacity = head.scanning ? (scan.mode === 'done' ? 0.3 : 0.85) : 0;

    ptr.x += (ptr.tx - ptr.x) * 0.05; ptr.y += (ptr.ty - ptr.y) * 0.05;
    camera.position.x = ptr.x * 1.4; camera.position.y = 0.4 - ptr.y * 0.8;
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

/* ---------- boot ---------- */
injectStatic();
initTheme();
initInputs();
initReveal();
requestAnimationFrame(loop);
init3D();
