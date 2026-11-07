// Cinematic timeline. Pure function of simulation time (seconds) → envelopes.
// All phase timing lives here so the sequence can be retimed in one place.

export const T = {
  CORE: 4.6, // Phase 2 — energy core appears (after a suspenseful pause)
  DETONATE: 6.4, // core detonates
  TRANSFORM: 10.2, // Phase 3 — explosion contracts into a black hole
  ACTIVATE: 13.6, // Phase 4 — disk spins up, jets emerge
  ACTIVE: 18.5, // Phase 5 — steady state, forever
  RESTART_AT: 3.0, // restart jumps here (a breath of deep space, then the blast)
};

export const PHASES = ['DEEP SPACE', 'EXPLOSION', 'TRANSFORMATION', 'QUASAR ACTIVATION', 'ACTIVE QUASAR'];

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const expo = (x) => (x <= 0 ? 0 : 1 - Math.exp(-x));

export function phaseAt(t) {
  if (t < T.CORE) return 0;
  if (t < T.TRANSFORM) return 1;
  if (t < T.ACTIVATE) return 2;
  if (t < T.ACTIVE) return 3;
  return 4;
}

export function phaseProgress(t) {
  const edges = [0, T.CORE, T.TRANSFORM, T.ACTIVATE, T.ACTIVE, T.ACTIVE + 1];
  const p = phaseAt(t);
  return p === 4 ? 1 : clamp01((t - edges[p]) / (edges[p + 1] - edges[p]));
}

/**
 * @param {number} t simulation time
 * @param {number} k explosion intensity multiplier
 */
export function envelopes(t, k = 1) {
  const te = t - T.DETONATE; // time since detonation
  // Phase 1 — stars fade in one by one (per-star thresholds in the shader).
  const starReveal = smooth(0.2, 4.2, t);

  // Phase 2a — the core: appears small, swells and brightens, flickering with tension.
  const pre = smooth(T.CORE, T.DETONATE, t);
  let coreR = 0.04 + 0.42 * pre * pre;
  let coreGlow = 0.0;
  if (t >= T.CORE && te < 0) {
    const flicker = 0.85 + 0.15 * Math.sin(t * 37.0) * Math.sin(t * 11.3);
    coreGlow = (0.5 + 3.0 * pre * pre) * flicker;
  }
  // Phase 2b — detonation: the core balloons and fades as the blast leaves it.
  let flash = 0, shockR = 0, shockA = 0;
  if (te >= 0) {
    coreR = 0.46 + 3.2 * expo(te * 2.2);
    coreGlow = (4.0 * Math.exp(-te * 3.4) + 0.45 * Math.exp(-te * 0.8)) * k;
    flash = Math.exp(-te * 6.0) * 0.9 * Math.min(k, 1.4) * smooth(0, 0.05, te);
    shockR = 26.0 * expo(te * 0.55 * (0.7 + 0.3 * k));
    shockA = smooth(0, 0.08, te) * Math.exp(-te * 0.55) * (1 - smooth(T.TRANSFORM - 1.2, T.TRANSFORM + 1.0, t));
  }

  // Phase 3 — contraction: debris spirals back, a collapsing shell, the horizon forms.
  const collapse = smooth(T.TRANSFORM - 0.6, T.ACTIVATE + 0.4, t);
  const collapseGlow = Math.sin(Math.PI * clamp01((t - T.TRANSFORM + 0.6) / (T.ACTIVATE - T.TRANSFORM + 1.0)));
  const horizon = smooth(T.TRANSFORM + 0.4, T.ACTIVATE + 0.6, t);

  // Phase 4 — activation: the disk lights from the inside out, jets punch out.
  const disk = smooth(T.ACTIVATE - 0.8, T.ACTIVE - 0.5, t);
  const diskReveal = 1.6 + 14.0 * smooth(T.ACTIVATE - 0.5, T.ACTIVE + 0.5, t);
  const spin = 0.15 + 0.85 * smooth(T.ACTIVATE - 0.5, T.ACTIVE + 1.5, t);
  const jet = smooth(T.ACTIVATE + 1.4, T.ACTIVE + 1.0, t);

  return {
    starReveal, coreR, coreGlow, flash, shockR, shockA,
    collapse, collapseGlow: Math.max(0, collapseGlow) * (te > 0 ? 1 : 0), horizon,
    disk, diskReveal, spin, jet,
    debrisT: Math.max(0, te),
  };
}

/**
 * Neon style: once the quasar is active it fires a short energy burst every BURST_PERIOD
 * seconds (expanding rings, laser streaks, glitch). Layered on top of the sequence above
 * without changing any of its timing.
 */
export const BURST_PERIOD = 7.0;
export function burstAt(t, k = 1) {
  const since = t - (T.ACTIVE + 1.5);
  if (since < 0) return { burstR: 0, burstA: 0, glitch: 0 };
  const u = since % BURST_PERIOD;
  const burstA = smooth(0, 0.06, u) * Math.exp(-u * 1.5) * Math.min(1.4, 0.4 + 0.6 * k);
  const burstR = 3.0 + 30.0 * expo(u * 1.1);
  const glitch = u < 0.45 ? Math.exp(-u * 7.0) : 0;
  return { burstR, burstA, glitch };
}

/** Glitch / RGB split strength for the detonation (major burst). */
export function detonationGlitch(t) {
  const te = t - T.DETONATE;
  return te >= 0 && te < 0.9 ? Math.exp(-te * 4.5) : 0;
}
