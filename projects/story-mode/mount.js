// Single entry point for the Story Mode scene (loaded lazily from a React effect).
// Creates the canvas inside `stage`, starts/stops rendering with visibility, opens the book the first
// time the scene is well in view, wires keyboard (Enter / Space on the focused section → turn page)
// and returns dispose().
//
//   section  the focusable element that owns the scene. Gets data-state = loading | live | fallback
//            and data-book = closed | opening | open, and receives DOM events:
//            storymode:open-start {duration} · storymode:opened · storymode:turn · storymode:turned · storymode:hover {book}
//   stage    an empty child the canvas is created in
//   opts.lab mount the lil-gui tuning panel (/lab/story-mode only)
import { hasWebGL2, observeActivity, reducedMotion } from '@/lib/scene';
import { StoryModeEngine } from './engine/StoryModeEngine.js';
import { createOverhead } from './overhead.js';
import { makeParams } from './params.js';

export const SCENE_URL = '/projects/story-mode/scene.glb';
const EVENTS = ['open-start', 'opened', 'turn', 'turned', 'hover', 'book-click'];

/**
 * @param {HTMLElement} section
 * @param {HTMLElement} stage
 * @param {{ lab?: boolean, params?: object }} [opts]
 * @returns {(() => void) & { engine?: StoryModeEngine, say?: (character: string, text: string, ms?: number) => () => void }}
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

  const canvas = document.createElement('canvas');
  canvas.className = 'sm-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  stage.append(canvas);

  section.dataset.state = 'loading';
  section.dataset.book = motion.value ? 'open' : 'closed';
  const engine = new StoryModeEngine(canvas, params, {
    url: SCENE_URL,
    calm: motion.value,
    onContextLost: () => { section.dataset.state = 'fallback'; },
  });
  disposers.push(() => engine.dispose());
  dispose.engine = engine;

  engine.ready
    .then(() => { if (!disposed) section.dataset.state = 'live'; })
    .catch((err) => {
      console.error('[story-mode] failed to load the scene', err);
      if (!disposed) section.dataset.state = 'fallback';
    });

  // engine events → DOM events on the section (the title reveal in the section listens to these)
  for (const type of EVENTS) {
    disposers.push(engine.on(type, (detail) => {
      if (type === 'open-start') section.dataset.book = 'opening';
      if (type === 'opened') section.dataset.book = 'open';
      section.dispatchEvent(new CustomEvent(`storymode:${type}`, { detail }));
    }));
  }

  // render only while visible; open the book the first time at least half the scene is on screen
  disposers.push(observeActivity(section, { onActive: () => engine.start(), onInactive: () => engine.stop() }));
  const firstView = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    firstView.disconnect();
    engine.openBook();
  }, { threshold: 0.5 });
  firstView.observe(section);
  disposers.push(() => firstView.disconnect());

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

  return dispose;
}
