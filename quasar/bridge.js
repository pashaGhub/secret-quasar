// ─────────────────────────────────────────────────────────────────────────────
// Bridge — the single communication layer between the GPU engine and the HUD.
//
//   HUD (DomHud.js)  ── dispatch(command) ──▶  params  ──▶  Engine
//   Engine  ── telemetry.set(...) ──▶  HUD
//
// Neither side imports the other. Both only know this module.
// ─────────────────────────────────────────────────────────────────────────────

/** Tiny observable store. `set` merges, `subscribe` fires with (state, changedKeys). */
function createStore(initial) {
  let state = { ...initial };
  const subs = new Set();
  return {
    get: () => state,
    set(patch) {
      const changed = [];
      for (const k in patch) if (state[k] !== patch[k]) changed.push(k);
      if (!changed.length) return;
      state = { ...state, ...patch };
      subs.forEach((fn) => fn(state, changed));
    },
    subscribe(fn) {
      subs.add(fn);
      fn(state, Object.keys(state));
      return () => subs.delete(fn);
    },
  };
}

export const MODES = ['OPTICAL', 'SPECTRAL', 'GRAVIMETRIC'];

export const LIMITS = {
  rotationSpeed: [0, 2.5],
  jetIntensity: [0, 2.5],
  diskEnergy: [0.2, 2.0],
  explosionIntensity: [0.3, 2.0],
};

const DEFAULT_PARAMS = {
  rotationSpeed: 1.0, // disk angular velocity multiplier
  jetIntensity: 1.0, // relativistic jet brightness / flow speed
  diskEnergy: 1.0, // accretion disk luminosity / temperature
  explosionIntensity: 1.0, // blast brightness, shock speed, debris speed
  playing: true,
  hudVisible: false, // HUD boots in during Phase 1 (set by mount.js)
  mode: 0, // index into MODES
  restartToken: 0, // incremented to request an explosion restart
};

/** Shared parameters. The engine reads these every frame. */
export const params = createStore(DEFAULT_PARAMS);

/** Back to factory settings — called on every (re)mount so a remount never inherits old state. */
export function resetBridge() {
  params.set({ ...DEFAULT_PARAMS, restartToken: params.get().restartToken });
}

/** Telemetry published by the engine (~10 Hz). Values are display-ready strings + 0..1 levels. */
export const telemetry = createStore({
  phase: 0, // 0..4 (Deep Space, Explosion, Transformation, Activation, Active)
  phaseLabel: 'DEEP SPACE',
  phaseProgress: 0,
  timecode: 'T+00:00.0',
  alert: false,
  locked: false,
  readouts: {},
  burstCount: 0, // increments on each periodic energy burst
});

const clamp = (v, [a, b]) => Math.min(b, Math.max(a, v));
const STEP = 0.25;

/** Every user-facing action goes through here, whichever HUD fired it. */
export function dispatch(command) {
  const p = params.get();
  switch (command) {
    case 'togglePlay': return params.set({ playing: !p.playing });
    case 'restart': return params.set({ restartToken: p.restartToken + 1, playing: true });
    case 'toggleHud': return params.set({ hudVisible: !p.hudVisible });
    case 'cycleMode': return params.set({ mode: (p.mode + 1) % MODES.length });
    case 'rotUp': return params.set({ rotationSpeed: clamp(p.rotationSpeed + STEP, LIMITS.rotationSpeed) });
    case 'rotDown': return params.set({ rotationSpeed: clamp(p.rotationSpeed - STEP, LIMITS.rotationSpeed) });
    case 'jetUp': return params.set({ jetIntensity: clamp(p.jetIntensity + STEP, LIMITS.jetIntensity) });
    case 'jetDown': return params.set({ jetIntensity: clamp(p.jetIntensity - STEP, LIMITS.jetIntensity) });
    case 'energyUp': return params.set({ diskEnergy: clamp(p.diskEnergy + 0.2, LIMITS.diskEnergy) });
    case 'energyDown': return params.set({ diskEnergy: clamp(p.diskEnergy - 0.2, LIMITS.diskEnergy) });
    default: console.warn('[bridge] unknown command', command);
  }
}

/**
 * Keyboard shortcuts. On a scrolling page these must NOT be global (Space and the arrow keys
 * scroll the page), so they are bound to the hero element and only fire while it has focus.
 * Returns an unbind function.
 */
export function bindKeyboard(target) {
  const map = {
    ' ': 'togglePlay', r: 'restart', h: 'toggleHud', m: 'cycleMode',
    ArrowUp: 'rotUp', ArrowDown: 'rotDown', ArrowRight: 'jetUp', ArrowLeft: 'jetDown',
    ']': 'energyUp', '[': 'energyDown',
  };
  const onKey = (e) => {
    if (e.target !== target) return; // let focused buttons keep their own Space/Enter behaviour
    const cmd = map[e.key] ?? map[e.key.toLowerCase?.()];
    if (!cmd || e.metaKey || e.ctrlKey || e.altKey) return;
    e.preventDefault();
    dispatch(cmd);
  };
  target.addEventListener('keydown', onKey);
  return () => target.removeEventListener('keydown', onKey);
}

// Expose for debugging / external control (e.g. from DevTools or an embedding page).
if (typeof window !== 'undefined') window.quasar = { params, telemetry, dispatch };
