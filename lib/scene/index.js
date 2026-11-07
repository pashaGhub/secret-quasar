// Shared, browser-only helpers for the site's WebGL sections (portfolio pattern).
// Every project scene mounts through these so they behave the same way: capped pixel ratio,
// lazy start, pause when off screen or in a hidden tab, reduced-motion awareness and a clean
// dispose that really frees the GPU context.
import * as THREE from 'three';

/** True on phones / small touch screens. */
export function isMobile() {
  return matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;
}

/** Device-pixel-ratio cap: crisp enough on laptops without paying for 3× phones. */
export function pixelRatioCap({ desktop = 1.5, mobile = 1.25 } = {}) {
  return Math.min(devicePixelRatio || 1, isMobile() ? mobile : desktop);
}

/** WebGL2 available? (probes with a throwaway context and releases it immediately) */
export function hasWebGL2() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * Live `prefers-reduced-motion` flag.
 * @param {(reduced: boolean) => void} [onChange]
 * @returns {{ readonly value: boolean, dispose(): void }}
 */
export function reducedMotion(onChange) {
  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  const handler = () => onChange?.(mq.matches);
  mq.addEventListener('change', handler);
  return {
    get value() { return mq.matches; },
    dispose() { mq.removeEventListener('change', handler); },
  };
}

/**
 * Creates a WebGLRenderer with the site defaults (sRGB output, capped DPR).
 * @param {HTMLCanvasElement} canvas
 * @param {{ antialias?: boolean, alpha?: boolean, pixelRatio?: number }} [opts]
 */
export function createRenderer(canvas, opts = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: opts.antialias ?? false,
    alpha: opts.alpha ?? false,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(opts.pixelRatio ?? pixelRatioCap());
  return renderer;
}

/**
 * Frees everything a scene holds on the GPU, then the renderer and its context.
 * Safe to call with partially-built state.
 */
export function disposeRenderer(renderer, ...roots) {
  const textures = new Set();
  for (const root of roots) {
    root?.traverse?.((o) => {
      o.geometry?.dispose?.();
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of mats) {
        for (const k in m) if (m[k]?.isTexture) textures.add(m[k]);
        if (m.uniforms) for (const k in m.uniforms) if (m.uniforms[k]?.value?.isTexture) textures.add(m.uniforms[k].value);
        m.dispose?.();
      }
    });
    if (root?.environment?.isTexture) textures.add(root.environment);
    if (root?.background?.isTexture) textures.add(root.background);
  }
  textures.forEach((t) => t.dispose());
  if (renderer) {
    renderer.renderLists?.dispose?.();
    renderer.dispose();
    renderer.forceContextLoss();
  }
}

/**
 * Runs `onActive` / `onInactive` as the element enters/leaves the viewport or the tab is hidden.
 * `margin` lets heavy scenes warm up slightly before they scroll in.
 * @returns {() => void} dispose
 */
export function observeActivity(el, { onActive, onInactive, margin = '0px', threshold = 0.01 }) {
  let inView = false;
  let active = false;
  const apply = () => {
    const next = inView && !document.hidden;
    if (next === active) return;
    active = next;
    (active ? onActive : onInactive)?.();
  };
  const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; apply(); }, { rootMargin: margin, threshold });
  io.observe(el);
  document.addEventListener('visibilitychange', apply);
  return () => { io.disconnect(); document.removeEventListener('visibilitychange', apply); };
}

/**
 * Calls `start` once, when the element comes within `margin` of the viewport (default ≈ one screen).
 * @returns {() => void} cancel
 */
export function lazyStart(el, start, margin = '100% 0px') {
  let done = false;
  const io = new IntersectionObserver(([e]) => {
    if (done || !e.isIntersecting) return;
    done = true;
    io.disconnect();
    start();
  }, { rootMargin: margin });
  io.observe(el);
  return () => { done = true; io.disconnect(); };
}

/**
 * Only one heavy scene renders at a time (the quasar hero vs. a project scene, and any later ones).
 *
 * Each scene joins with `renderSlot(el, { start, stop })`. The slot watches how much of the
 * *viewport* each element covers (not how much of the element is visible, so a full-screen hero and
 * a smaller project frame compare fairly) and runs only the scene covering the most screen; every
 * other scene is stopped and keeps showing its last frame. Nothing runs while the tab is hidden.
 * `margin` warms a scene up slightly before it scrolls in (it only wins once it is actually visible
 * or nothing else is).
 *
 * @param {Element} el
 * @param {{ start: () => void, stop: () => void, name?: string }} handlers
 * @returns {{ release(): void, readonly active: boolean }}
 */
const slots = new Set();
let slotsActive = null;
function arbitrate() {
  let best = null;
  if (!document.hidden) {
    for (const s of slots) if (s.share > 0 && (!best || s.share > best.share + 0.001)) best = s;
  }
  if (best === slotsActive) return;
  slotsActive?.stop();
  slotsActive = best;
  best?.start();
}
const onSlotVisibility = () => arbitrate();
const THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20);

export function renderSlot(el, { start, stop, name = '' }) {
  const me = { name, share: 0, start, stop };
  const io = new IntersectionObserver(([e]) => {
    const vh = e.rootBounds?.height || innerHeight;
    me.share = e.isIntersecting ? e.intersectionRect.height / vh : 0;
    arbitrate();
  }, { threshold: THRESHOLDS });
  io.observe(el);
  if (!slots.size) document.addEventListener('visibilitychange', onSlotVisibility);
  slots.add(me);
  return {
    get active() { return slotsActive === me; },
    release() {
      io.disconnect();
      slots.delete(me);
      if (slotsActive === me) { slotsActive = null; me.stop(); }
      if (!slots.size) document.removeEventListener('visibilitychange', onSlotVisibility);
      arbitrate();
    },
  };
}
