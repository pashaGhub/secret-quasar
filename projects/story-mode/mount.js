// Single entry point for the Story Mode scene (loaded lazily from a React effect).
// Waits until the scene is about one screen away, then creates the canvas inside `stage` and loads
// the model; renders only while it holds the shared render slot (on screen, tab visible, and covering
// more of the screen than any other heavy scene, e.g. the quasar hero); opens the book the first time
// the scene is well in view; wires keyboard (Enter / Space on the focused section → turn page) and
// returns dispose().
//
// No WebGL2, a lost context or a failed load → data-state="fallback" (the poster image shows).
//
//   section  the focusable element that owns the scene. Gets data-state = idle | loading | live | fallback
//            and data-book = closed | opening | open | closing, and receives DOM events:
//            storymode:open-start {duration} · storymode:opened · storymode:close-start {duration} ·
//            storymode:closed · storymode:turn · storymode:turned · storymode:hover {book}
//   stage    an empty child the canvas is created in
//   opts.lab mount the lil-gui tuning panel (/lab/story-mode only)
import { hasWebGL2, lazyStart, reducedMotion, renderSlot } from '@/lib/scene';
import { StoryModeEngine } from './engine/StoryModeEngine.js';
import { createOverhead } from './overhead.js';
import { makeParams } from './params.js';

export const SCENE_URL = '/projects/story-mode/scene.glb';
const EVENTS = ['open-start', 'opened', 'close-start', 'closed', 'turn', 'turned', 'hover', 'book-click'];

/**
 * @param {HTMLElement} section
 * @param {HTMLElement} stage
 * @param {{ lab?: boolean, params?: object, eager?: boolean }} [opts]  eager: boot now (the lab does)
 * @returns {(() => void) & { engine?: StoryModeEngine, open?: () => void, close?: () => boolean,
 *   say?: (character: string, text: string, ms?: number) => () => void }}
 */
export function mountStoryMode(section, stage, opts = {}) {
  const disposers = [];
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    disposers.reverse().forEach((fn) => { try { fn(); } catch (e) { console.warn('[story-mode] dispose', e); } });
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
  section.dataset.book = motion.value ? 'open' : 'closed';

  // open the book the first time at least half the scene is on screen (even if that happens
  // before the engine has booted — the request is kept and applied once it exists)
  let engine = null, wantOpen = false;
  const firstView = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    firstView.disconnect();
    wantOpen = true;
    engine?.openBook();
  }, { threshold: 0.5 });
  firstView.observe(section);
  disposers.push(() => firstView.disconnect());

  dispose.open = () => { wantOpen = true; engine?.openBook(); };
  dispose.close = () => { wantOpen = false; return engine?.closeBook() ?? false; };

  const boot = () => {
    if (disposed) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'sm-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    stage.append(canvas);

    section.dataset.state = 'loading';
    engine = new StoryModeEngine(canvas, params, {
      url: SCENE_URL,
      calm: motion.value,
      onContextLost: () => { section.dataset.state = 'fallback'; },
    });
    disposers.push(() => engine.dispose());
    dispose.engine = engine;
    if (wantOpen) engine.openBook();

    engine.ready
      .then(() => { if (!disposed) section.dataset.state = 'live'; })
      .catch((err) => {
        console.error('[story-mode] failed to load the scene', err);
        if (!disposed) section.dataset.state = 'fallback';
      });

    // engine events → data-book + DOM events on the section (bubbling, so the page section can listen).
    // The title reveal is CSS keyed on data-book; it is timed by --sm-open on the page section.
    const host = section.closest('.sm-section') ?? section;
    for (const type of EVENTS) {
      disposers.push(engine.on(type, (detail) => {
        if (type === 'open-start') {
          if (detail?.duration) host.style.setProperty('--sm-open', `${detail.duration}s`);
          section.dataset.book = 'opening';
        }
        if (type === 'opened') section.dataset.book = 'open';
        if (type === 'close-start') {
          if (detail?.duration) host.style.setProperty('--sm-close', `${detail.duration}s`);
          section.dataset.book = 'closing';
        }
        if (type === 'closed') section.dataset.book = 'closed';
        section.dispatchEvent(new CustomEvent(`storymode:${type}`, { detail, bubbles: true }));
      }));
    }
    disposers.push(() => { host.style.removeProperty('--sm-open'); host.style.removeProperty('--sm-close'); });

    // render only while this scene holds the shared render slot
    const slot = renderSlot(section, { name: 'story-mode', start: () => engine.start(), stop: () => engine.stop() });
    disposers.push(() => slot.release());

    // keyboard: only while the section itself is focused (never on window)
    const onKey = (e) => {
      if (e.target !== section || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();             // Space would scroll the page
        engine.turnPage();
      }
    };
    section.addEventListener('keydown', onKey);
    disposers.push(() => section.removeEventListener('keydown', onKey));

    // overhead text hook (for voiced dialogue later)
    const overhead = createOverhead(section, engine);
    disposers.push(() => overhead.dispose());
    dispose.say = overhead.say;

    if (opts.lab) {
      let lab;
      import('./lab.js').then(({ attachLab }) => {
        if (!disposed) lab = attachLab(engine, params, section, { say: overhead.say });
      });
      disposers.push(() => lab?.dispose());
    }
  };
  if (opts.eager) boot();
  else disposers.push(lazyStart(section, boot, '100% 0px'));

  return dispose;
}
