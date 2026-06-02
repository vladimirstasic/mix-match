import { useEffect, useRef } from 'react';

export const WaveformBackdrop = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.innerWidth < 640) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const THREE = await import('three');
      if (cancelled) return;

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setClearColor(0x000000, 0);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
      camera.position.set(0, 0.4, 22);

      const WIN_LO = new THREE.Color(0x1fe048);
      const WIN_MID = new THREE.Color(0xffd21e);
      const WIN_HI = new THREE.Color(0xff3b2f);
      const PALE = new THREE.Color(0x7fdca0);
      const DEEP = new THREE.Color(0x0f7a3a);

      const isDark = () => document.documentElement.classList.contains('dark');
      let dark3d = isDark();

      const W = 17;
      const baseY = -1.0;
      const BARS = 200;
      const MAXH = 3.0;
      const env = (t: number) =>
        (0.45 + 0.55 * Math.sin(t * 9.0) ** 2) * (1 - 0.74 * Math.exp(-Math.pow((t - 0.69) / 0.07, 2)));

      const barMat = new THREE.MeshBasicMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const wave = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.1, 1), barMat, BARS);
      wave.frustumCulled = false;
      const wdummy = new THREE.Object3D();
      for (let i = 0; i < BARS; i++) wave.setColorAt(i, WIN_LO);
      scene.add(wave);

      const applyTheme = () => {
        dark3d = isDark();
        wave.material.blending = dark3d ? THREE.AdditiveBlending : THREE.NormalBlending;
        wave.material.opacity = dark3d ? 0.8 : 0.5;
        wave.material.needsUpdate = true;
      };
      applyTheme();

      const themeObserver = new MutationObserver(applyTheme);
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

      const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
      const onPointer = (e: PointerEvent) => {
        ptr.tx = (e.clientX / window.innerWidth - 0.5) * 2;
        ptr.ty = (e.clientY / window.innerHeight - 0.5) * 2;
      };
      window.addEventListener('pointermove', onPointer, { passive: true });

      const t0 = performance.now();
      const c = new THREE.Color();
      const heights = new Float32Array(BARS);

      const frame = () => {
        const time = (performance.now() - t0) / 1000;
        ptr.x += (ptr.tx - ptr.x) * 0.06;
        ptr.y += (ptr.ty - ptr.y) * 0.06;
        const cursorX = ptr.x * W;

        for (let i = 0; i < BARS; i++) {
          const u = i / (BARS - 1);
          const x = -W + u * 2 * W;
          const dyn = env(u);
          const detail = 0.5 + 0.5 * Math.sin(u * 22 + time * 0.91);
          const swell = 0.5 + 0.5 * Math.sin(u * 6 - time * 0.52);
          const amp = dyn * (0.4 + 0.4 * detail + 0.2 * swell);
          const cd = x - cursorX;
          const lift = Math.exp(-(cd * cd) / 9);
          const target = 0.3 + amp * MAXH + lift * 2.2;
          heights[i] += (target - heights[i]) * 0.1;
          const h = heights[i];
          wdummy.position.set(x, baseY, 0);
          wdummy.scale.set(1, h, 1);
          wdummy.updateMatrix();
          wave.setMatrixAt(i, wdummy.matrix);

          const near = 1 - Math.min(1, Math.abs(x - cursorX) / 0.7);
          const hNorm = Math.min(1, (h - 0.3) / MAXH);
          if (dark3d) {
            const ampN = Math.min(1, hNorm + lift * 0.3);
            if (ampN < 0.5) c.copy(WIN_LO).lerp(WIN_MID, ampN * 2);
            else c.copy(WIN_MID).lerp(WIN_HI, (ampN - 0.5) * 2);
            c.multiplyScalar(0.85 + near * 0.4);
          } else {
            const f = Math.min(1, 0.3 + hNorm * 0.5 + 0.1 + near * 0.4 + lift * 0.5);
            c.copy(PALE).lerp(DEEP, f);
          }
          wave.setColorAt(i, c);
        }
        wave.instanceMatrix.needsUpdate = true;
        if (wave.instanceColor) wave.instanceColor.needsUpdate = true;

        camera.position.x = ptr.x * 1.4;
        camera.position.y = 0.4 - ptr.y * 0.8;
        camera.lookAt(0, baseY, 0);
        renderer.render(scene, camera);
      };
      renderer.setAnimationLoop(frame);

      const onResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };
      window.addEventListener('resize', onResize);

      cleanup = () => {
        renderer.setAnimationLoop(null);
        window.removeEventListener('pointermove', onPointer);
        window.removeEventListener('resize', onResize);
        themeObserver.disconnect();
        wave.geometry.dispose();
        barMat.dispose();
        renderer.dispose();
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className="waveform-backdrop" />;
};
