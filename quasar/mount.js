// Mounts the whole quasar (GPU engine + HUD + title) into a hero element and returns a
// dispose function. This is the only entry point the React side needs — it replaces main.js
// from the standalone project. Everything here is browser-only; it is loaded lazily from an effect.
//
// Dev / review options via the page URL (same as the standalone project):
//   ?t=14        start the timeline at 14 s     ?hud=none   hide the HUD entirely
//   ?q=0.8       fixed resolution scale         ?mode=1   start in a visualization mode
//   ?paused      start paused                   ?nohud    start with the HUD hidden
import { params, telemetry, dispatch, bindKeyboard, resetBridge } from './bridge.js';
import { QuasarEngine } from './engine/QuasarEngine.js';
import { mountDomHud } from './hud/DomHud.js';
import { mountTitle } from './hud/Title.js';
import { T } from './timeline.js';
import { renderSlot } from '@/lib/scene';

const make = (tag, cls, attrs = {}) => {
  const el = document.createElement(tag);
  el.className = cls;
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
};

/**
 * @param {HTMLElement} hero   the .sq-hero element (focusable; owns the keyboard shortcuts)
 * @param {HTMLElement} stage  an empty child of the hero the canvases are created in
 * @param {HTMLElement} titleEl the decorative title element
 * @returns {() => void} dispose
 */
export function mountQuasar(hero, stage, titleEl) {
  const q = new URLSearchParams(location.search);
  const bridge = { params, telemetry, dispatch };
  const disposers = [];
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    disposers.reverse().forEach((fn) => { try { fn(); } catch (e) { console.warn('[quasar] dispose', e); } });
    stage.replaceChildren();
  };

  const title = mountTitle(titleEl, hero, bridge);
  disposers.push(() => title.dispose());

  // No WebGL2 → static poster with the title docked. Nothing else to mount.
  const probe = document.createElement('canvas').getContext('webgl2');
  if (!probe) {
    hero.dataset.state = 'fallback';
    title.show('dock');
    return dispose;
  }
  probe.getExtension('WEBGL_lose_context')?.loseContext();

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Reduced motion: skip the detonation flash sequence — open on the settled, active quasar.
  const startTime = q.has('t') ? Number(q.get('t')) || 0 : reduced ? T.ACTIVE + 1 : 0;

  resetBridge();
  if (q.has('mode')) params.set({ mode: Number(q.get('mode')) % 3 });
  if (q.has('paused')) params.set({ playing: false });

  // Layout scale for the HUD (and the scroll cue): follows the hero's size, set in JS so it works in every browser.
  const scale = () => {
    const w = hero.clientWidth || innerWidth, h = hero.clientHeight || innerHeight;
    hero.style.setProperty('--s', Math.min(1.2, Math.max(0.62, Math.min(w / 1440, h / 860))).toFixed(3));
  };
  scale();
  const scaleObserver = new ResizeObserver(scale);
  scaleObserver.observe(hero);
  disposers.push(() => scaleObserver.disconnect());

  const space = make('canvas', 'sq-space', { 'aria-hidden': 'true' });
  const hudDom = make('div', 'sq-hud-dom');
  stage.append(space, hudDom);

  const engine = new QuasarEngine(space, bridge, {
    startTime,
    calm: reduced,
    quality: q.has('q') ? Number(q.get('q')) : undefined,
    onContextLost: () => { hero.dataset.state = 'fallback'; title.show('dock'); },
  });
  disposers.push(() => engine.dispose());
  window.quasar = { ...window.quasar, engine };

  disposers.push(bindKeyboard(hero));

  if (q.get('hud') !== 'none') disposers.push(mountDomHud(hudDom, bridge));

  // The visor boots during Phase 1, before the event — unless asked to stay dark.
  if (!q.has('nohud')) {
    const id = setTimeout(() => params.set({ hudVisible: true }), startTime > 1.5 ? 50 : 1600);
    disposers.push(() => clearTimeout(id));
  }

  // Render only while the hero is on screen, the tab is visible and no other heavy scene covers
  // more of the screen (shared render slot): the raymarcher is heavy, and the intro should not run
  // its clock while nobody is looking at it.
  const slot = renderSlot(hero, { name: 'quasar', start: () => engine.start(), stop: () => engine.stop() });
  disposers.push(() => slot.release());

  hero.dataset.state = 'live';
  return dispose;
}
