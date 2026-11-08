// Single entry point for the Awkward Silence Button scene (loaded lazily from a React effect).
// Waits until the scene is about one screen away, then creates the canvas inside `stage` and loads
// icons.glb; renders only while it holds the shared render slot; plays the first press the first time
// the scene is at least half on screen and then auto-presses every 6–8 s while it renders (never with
// reduced motion); Enter / Space on the focused section presses; returns dispose().
//
// No WebGL2, a lost context or a failed load → data-state="fallback".
//
//   section  the focusable element that owns the scene. Gets data-state = idle | loading | live | fallback
//            and data-press = idle | pressing | revealed, and receives DOM events (bubbling):
//            asb:press {category} · asb:revealed {category} · asb:settled {category}
//   stage    an empty child the canvas is created in
//   opts.lab mount the lil-gui tuning panel (/lab/awkward-silence-button only)
import { hasWebGL2, lazyStart, reducedMotion, renderSlot } from '@/lib/scene';
import { AsbEngine } from './engine/AsbEngine.js';
import { makeParams } from './params.js';

export const ICONS_URL = '/projects/awkward-silence-button/icons.glb';

/**
 * @param {HTMLElement} section
 * @param {HTMLElement} stage
 * @param {{ lab?: boolean, params?: object, eager?: boolean }} [opts]  eager: boot now (the lab does)
 * @returns {(() => void) & { engine?: AsbEngine, press?: () => string | null }}
 */
export function mountAsb(section, stage, opts = {}) {
  const disposers = [];
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    disposers.reverse().forEach((fn) => { try { fn(); } catch (e) { console.warn('[asb] dispose', e); } });
    stage.replaceChildren();
  };

  if (!hasWebGL2()) {
    section.dataset.state = 'fallback';
    return dispose;
  }

  const motion = reducedMotion();
  disposers.push(() => motion.dispose());
  const params = opts.params ?? makeParams();
  section.dataset.state = 'idle';
  section.dataset.press = 'idle';

  // first press the first time at least half the scene is on screen (kept if the engine isn't ready yet)
  let engine = null, wantFirst = false, firstDone = false;
  const first = () => {
    if (firstDone || !wantFirst || !engine?.tokens) return;
    firstDone = true;
    engine.press();
    if (!motion.value) engine.enableAuto();
  };
  const firstView = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    firstView.disconnect();
    wantFirst = true;
    first();
  }, { threshold: 0.5 });
  firstView.observe(section);
  disposers.push(() => firstView.disconnect());

  const boot = () => {
    if (disposed) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'asb-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    stage.append(canvas);

    section.dataset.state = 'loading';
    engine = new AsbEngine(canvas, params, {
      url: ICONS_URL,
      calm: motion.value,
      onContextLost: () => { section.dataset.state = 'fallback'; },
    });
    const eng = engine;
    disposers.push(() => eng.dispose());
    dispose.engine = engine;
    dispose.press = () => engine.press();

    engine.ready
      .then(() => {
        if (disposed) return;
        section.dataset.state = 'live';
        first();
      })
      .catch((err) => {
        console.error('[asb] failed to load the scene', err);
        if (!disposed) section.dataset.state = 'fallback';
      });

    // engine events → data-press + DOM events on the section (bubbling, so the page section can listen)
    const STATE = { press: 'pressing', revealed: 'revealed', settled: 'idle' };
    for (const type of Object.keys(STATE)) {
      disposers.push(engine.on(type, (detail) => {
        section.dataset.press = STATE[type];
        section.dispatchEvent(new CustomEvent(`asb:${type}`, { detail, bubbles: true }));
      }));
    }

    // keyboard: only while the section itself is focused (never on window)
    const onKey = (e) => {
      if (e.target !== section || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); // Space would scroll the page
        engine.press();
      }
    };
    section.addEventListener('keydown', onKey);
    disposers.push(() => section.removeEventListener('keydown', onKey));

    const slot = renderSlot(section, { name: 'awkward-silence-button', start: () => engine.start(), stop: () => engine.stop() });
    disposers.push(() => slot.release());

    if (opts.lab) {
      let lab;
      import('./lab.js').then(({ attachLab }) => {
        if (!disposed) lab = attachLab(engine, params);
      });
      disposers.push(() => lab?.dispose());
    }
  };
  if (opts.eager) boot();
  else disposers.push(lazyStart(section, boot, '100% 0px'));

  return dispose;
}
