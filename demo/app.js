/* ============================================================
   MixMatch — AI Audio Forensics Lab (demo)
   Standalone interactions + Three.js (WebGPU/TSL) backdrop.
   Throwaway concept: no real backend calls.
   ============================================================ */

/* ----------------------------------------------------------------
   1. Content (kept here so the markup stays clean / easy to tweak)
   ---------------------------------------------------------------- */
const TIMELINE = [
  { time: '00:00 → 05:30', track: 'Dorisburg — Irrbloss', status: 'identified', conf: 0.97 },
  { time: '05:30 → 11:15', track: 'Hatikvah — Unforgettable', status: 'identified', conf: 0.93 },
  { time: '11:15 → 16:40', track: 'DJ Hell — The Angst (Henrik Schwarz Remix)', status: 'identified', conf: 0.9 },
  { time: '16:40 → 22:10', track: 'Unknown section', status: 'unknown', conf: 0 },
  { time: '22:10 → 28:00', track: 'Âme — Rej', status: 'identified', conf: 0.95 },
];

const FEATURES = [
  {
    icon: '🎚️',
    title: 'Audio fingerprinting',
    desc: 'ACRCloud-powered recognition. Fast mode scans the highlights, Detailed goes segment by segment.',
  },
  {
    icon: '🔗',
    title: 'URL scanning',
    desc: 'Paste a SoundCloud or Mixcloud link and we download and scan it for you.',
  },
  {
    icon: '🟢',
    title: 'Spotify playlists',
    desc: 'One click turns your tracklist into a Spotify playlist in your own account.',
  },
  {
    icon: '📤',
    title: 'Multi-format export',
    desc: 'Export for Mixcloud, SoundCloud, YouTube timestamps, or plain text. Copy and post.',
  },
  {
    icon: '🔉',
    title: 'Streaming links',
    desc: 'Spotify, YouTube, and Deezer links with inline players for every identified track.',
  },
  {
    icon: '🔖',
    title: 'Shareable pages',
    desc: 'Generate a public tracklist page with a custom URL. Clean layout, embedded players.',
  },
];

const PRICING = [
  {
    name: 'Free',
    price: '$0',
    per: 'forever',
    features: ['5 scans per month', '2 scans per day', 'Fast mode', 'Text export', 'Public share pages'],
    cta: 'Get started',
    featured: false,
  },
  {
    name: 'Pro',
    price: '$9.99',
    per: '/ month',
    features: ['30 scans per month', 'Fast + Detailed modes', 'All export formats', 'Spotify playlists', 'Streaming links'],
    cta: 'Start free trial',
    featured: true,
  },
  {
    name: 'Studio',
    price: '$29.99',
    per: '/ month',
    features: ['Unlimited scans', 'Everything in Pro', 'URL scanning', 'DJ profile page', 'Custom profile URL'],
    cta: 'Contact us',
    featured: false,
  },
];

/* ----------------------------------------------------------------
   2. Inject content
   ---------------------------------------------------------------- */
function injectTimeline() {
  const el = document.getElementById('timeline');
  el.innerHTML = TIMELINE.map(
    (t) => `
    <div class="tl-row ${t.status}" data-reveal-row>
      <span class="tl-time mono">${t.time}</span>
      <span class="tl-track">${t.track}</span>
      ${
        t.status === 'identified'
          ? `<span class="tl-conf"><span class="conf-bar"><i class="conf-fill" data-conf="${t.conf}"></i></span>${Math.round(
              t.conf * 100,
            )}%</span>`
          : `<span class="tl-conf">—</span>`
      }
    </div>`,
  ).join('');
}

function injectFeatures() {
  document.getElementById('features-grid').innerHTML = FEATURES.map(
    (f) => `
    <article class="feature" data-reveal>
      <div class="feature-icon">${f.icon}</div>
      <h3>${f.title}</h3>
      <p>${f.desc}</p>
    </article>`,
  ).join('');
}

function injectPricing() {
  document.getElementById('pricing-grid').innerHTML = PRICING.map(
    (p) => `
    <div class="price ${p.featured ? 'featured' : ''}" data-reveal>
      ${p.featured ? '<span class="price-tag">Most popular</span>' : ''}
      <h3>${p.name}</h3>
      <div class="price-amount"><span class="num">${p.price}</span> <span class="per">${p.per}</span></div>
      <ul>${p.features.map((f) => `<li>${f}</li>`).join('')}</ul>
      <a href="#top" class="btn ${p.featured ? 'btn-primary' : 'btn-ghost'}">${p.cta}</a>
    </div>`,
  ).join('');
}

/* ----------------------------------------------------------------
   3. Theme toggle (3D stays dark; UI chrome flips)
   ---------------------------------------------------------------- */
const THEME_KEY = 'mm-demo-theme';
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'dark';
  document.documentElement.dataset.theme = saved;
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem(THEME_KEY, next);
  });
}

/* ----------------------------------------------------------------
   4. Tabs + dropzone + fake analyze flow
   ---------------------------------------------------------------- */
function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.tab-panel');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => {
        t.classList.toggle('is-active', t === tab);
        t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
      });
      panels.forEach((p) => p.classList.toggle('is-active', p.dataset.panel === tab.dataset.tab));
    });
  });

  const dz = document.getElementById('dropzone');
  ['dragenter', 'dragover'].forEach((e) =>
    dz.addEventListener(e, (ev) => {
      ev.preventDefault();
      dz.classList.add('is-over');
    }),
  );
  ['dragleave', 'drop'].forEach((e) =>
    dz.addEventListener(e, (ev) => {
      ev.preventDefault();
      dz.classList.remove('is-over');
      if (e === 'drop') runAnalyze();
    }),
  );
  dz.addEventListener('click', runAnalyze);
}

let analyzing = false;
function initAnalyze() {
  document.getElementById('analyze-btn').addEventListener('click', runAnalyze);
}

const STATUS_LINES = [
  '> decoding audio stream…',
  '> extracting fingerprints · 128 segments',
  '> matching against catalog…',
  '> 4 / 5 segments identified · 80% coverage',
];

function runAnalyze() {
  if (analyzing) return;
  analyzing = true;
  const btn = document.getElementById('analyze-btn');
  const label = btn.querySelector('.analyze-label');
  const status = document.getElementById('analyzer-status');
  label.textContent = 'Analyzing…';
  btn.style.opacity = '0.7';
  status.classList.add('is-open');
  status.textContent = '';

  // boost the 3D scene
  scene3d?.pulse();

  let i = 0;
  const tick = () => {
    if (i < STATUS_LINES.length) {
      status.textContent += (i ? '\n' : '') + STATUS_LINES[i];
      status.scrollTop = status.scrollHeight;
      i += 1;
      setTimeout(tick, 620);
    } else {
      label.textContent = 'Analyze the mix';
      btn.style.opacity = '1';
      analyzing = false;
      revealTimeline();
      document.getElementById('accuracy').scrollIntoView({ behavior: 'smooth' });
      showToast('Demo preview — connect the real app to scan an actual mix.');
    }
  };
  setTimeout(tick, 350);
}

/* ----------------------------------------------------------------
   5. Reveal on scroll + timeline stagger
   ---------------------------------------------------------------- */
function initReveal() {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('is-visible');
          io.unobserve(en.target);
          if (en.target.id === 'accuracy') revealTimeline();
        }
      });
    },
    { threshold: 0.12 },
  );
  document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
  const acc = document.getElementById('accuracy');
  if (acc) io.observe(acc);
}

let timelineShown = false;
function revealTimeline() {
  if (timelineShown) return;
  timelineShown = true;
  const rows = document.querySelectorAll('[data-reveal-row]');
  rows.forEach((row, idx) => {
    setTimeout(() => {
      row.classList.add('show');
      const fill = row.querySelector('.conf-fill');
      if (fill) fill.style.width = `${Number(fill.dataset.conf) * 100}%`;
    }, idx * 220);
  });
}

/* ----------------------------------------------------------------
   6. Toast
   ---------------------------------------------------------------- */
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3600);
}

/* ----------------------------------------------------------------
   7. Nav shrink on scroll
   ---------------------------------------------------------------- */
function initNav() {
  const nav = document.getElementById('nav');
  addEventListener('scroll', () => nav.style.setProperty('box-shadow', scrollY > 20 ? 'var(--shadow)' : 'none'), {
    passive: true,
  });
}

/* ----------------------------------------------------------------
   8. Three.js — WebGPU + TSL backdrop ("audio forensics lab")
      Degrades to WebGL2 automatically; if it can't start at all,
      the CSS gradient (#lab-fallback) carries the hero.
   ---------------------------------------------------------------- */
let scene3d = null;

async function init3D() {
  const canvas = document.getElementById('lab-canvas');
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; // respect users

  let THREE, tsl;
  try {
    THREE = await import('three');
    tsl = await import('three/tsl');
  } catch (e) {
    console.warn('[lab] three.js failed to load, using CSS backdrop.', e);
    return;
  }

  const { color, mix, uv, smoothstep, uniform } = tsl;

  let renderer;
  try {
    renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    await renderer.init();
  } catch (e) {
    console.warn('[lab] renderer init failed, using CSS backdrop.', e);
    return;
  }

  const sizes = { w: innerWidth, h: innerHeight };
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(sizes.w, sizes.h);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05050c, 0.018);

  const camera = new THREE.PerspectiveCamera(55, sizes.w / sizes.h, 0.1, 200);
  camera.position.set(0, 1.5, 16);

  const COL_A = 0x22d3ee; // cyan
  const COL_B = 0xa855f7; // violet
  const uGlow = uniform(1.0);

  /* --- Waveform wall: instanced bars in a shallow arc --- */
  const COUNT = 120;
  const barGeo = new THREE.BoxGeometry(0.14, 1, 0.14);
  const barMat = new THREE.MeshBasicNodeMaterial({ transparent: true });
  // TSL: vertical cyan→violet gradient, brightness driven by uGlow
  barMat.colorNode = mix(color(COL_A), color(COL_B), uv().y).mul(uGlow);
  barMat.opacityNode = uv().y.mul(0.6).add(0.35);
  const bars = new THREE.InstancedMesh(barGeo, barMat, COUNT);
  scene.add(bars);

  const barData = [];
  for (let i = 0; i < COUNT; i++) {
    const t = i / (COUNT - 1);
    const x = (t - 0.5) * 30;
    const z = -Math.pow((t - 0.5) * 2, 2) * 6 - 2; // gentle arc away from camera
    barData.push({ x, z, phase: Math.random() * Math.PI * 2, freq: 0.6 + Math.random() * 1.4 });
  }

  /* --- Audio particles --- */
  const P = 700;
  const pPos = new Float32Array(P * 3);
  for (let i = 0; i < P; i++) {
    pPos[i * 3] = (Math.random() - 0.5) * 46;
    pPos[i * 3 + 1] = (Math.random() - 0.5) * 26;
    pPos[i * 3 + 2] = (Math.random() - 0.5) * 24 - 4;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const d = uv().sub(0.5).length();
  pMat.opacityNode = smoothstep(0.5, 0.05, d).mul(0.7);
  pMat.colorNode = mix(color(COL_A), color(COL_B), uv().x);
  pMat.size = 0.16;
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  /* --- Neural connections between nearby particles --- */
  const linePts = [];
  for (let i = 0; i < 90; i++) {
    const a = (Math.floor(Math.random() * P)) * 3;
    const b = (Math.floor(Math.random() * P)) * 3;
    const dx = pPos[a] - pPos[b];
    const dy = pPos[a + 1] - pPos[b + 1];
    const dz = pPos[a + 2] - pPos[b + 2];
    if (dx * dx + dy * dy + dz * dz < 60) {
      linePts.push(pPos[a], pPos[a + 1], pPos[a + 2], pPos[b], pPos[b + 1], pPos[b + 2]);
    }
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePts), 3));
  const lineMat = new THREE.LineBasicMaterial({ color: COL_A, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  scene.add(lines);

  /* --- Pointer parallax --- */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener(
    'pointermove',
    (e) => {
      pointer.tx = (e.clientX / innerWidth - 0.5) * 2;
      pointer.ty = (e.clientY / innerHeight - 0.5) * 2;
    },
    { passive: true },
  );

  /* --- Animation --- */
  const dummy = new THREE.Object3D();
  let glowTarget = 1;
  const start = performance.now();

  function frame() {
    const time = (performance.now() - start) / 1000;

    // waveform bars
    for (let i = 0; i < COUNT; i++) {
      const b = barData[i];
      const h =
        1.2 +
        Math.sin(time * b.freq + b.phase) * 2.4 +
        Math.sin(time * 2.3 + b.x * 0.4) * 1.1 +
        (glowTarget > 1 ? Math.sin(time * 9 + i) * 1.6 : 0);
      const height = Math.max(0.3, h);
      dummy.position.set(b.x, height / 2 - 3.5, b.z);
      dummy.scale.set(1, height, 1);
      dummy.updateMatrix();
      bars.setMatrixAt(i, dummy.matrix);
    }
    bars.instanceMatrix.needsUpdate = true;

    // ease glow back to rest
    uGlow.value += (glowTarget - uGlow.value) * 0.05;
    if (glowTarget > 1 && time > 0) glowTarget += (1 - glowTarget) * 0.01;

    // drifting particles + neural pulse
    particles.rotation.y = time * 0.02;
    particles.position.y = Math.sin(time * 0.3) * 0.6;
    lines.rotation.y = time * 0.02;
    lineMat.opacity = 0.08 + (Math.sin(time * 1.5) * 0.5 + 0.5) * 0.12 * uGlow.value;

    // camera parallax
    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;
    camera.position.x = pointer.x * 2.2;
    camera.position.y = 1.5 - pointer.y * 1.2;
    camera.lookAt(0, 0, -3);

    renderer.renderAsync(scene, camera);
  }
  renderer.setAnimationLoop(frame);

  addEventListener('resize', () => {
    sizes.w = innerWidth;
    sizes.h = innerHeight;
    camera.aspect = sizes.w / sizes.h;
    camera.updateProjectionMatrix();
    renderer.setSize(sizes.w, sizes.h);
  });

  scene3d = {
    pulse() {
      glowTarget = 3.2; // brighten + spike the waveform; eases back automatically
    },
  };
}

/* ----------------------------------------------------------------
   9. Boot
   ---------------------------------------------------------------- */
injectTimeline();
injectFeatures();
injectPricing();
initTheme();
initTabs();
initAnalyze();
initReveal();
initNav();
init3D();
