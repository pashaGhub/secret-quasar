// Press choreography (concept A, "The Press"), stepped once per frame by the engine:
//   0 s     cap springs down (held capHold), button flash, comet burst, shockwave leaves the button
//   wave    each token is kicked outward + up and spun as the wave reaches it, then springs back
//   revealAt the chosen token pops up above the button (the app's icon-pop easing: overshoot + wobble),
//           turns to the camera and glows; the others dim a little
//   hold    …stays there, then returns to its place in the ring → 'settled'
// Between presses the scene sinks to a slightly dimmer "silence" level; a press is the release.
// Calm (prefers-reduced-motion): no wave, kick, spin, pop or flash — a short cap dip and the chosen
// token's glow crossfades up in place, then back.
import * as THREE from 'three';
import { CATEGORY_KEYS } from './tokens.js';

/** CSS cubic-bezier(x1, y1, x2, y2) as a function of t (Newton on x, then y). */
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (u) => ((ax * u + bx) * u + cx) * u, sy = (u) => ((ay * u + by) * u + cy) * u;
  const dx = (u) => (3 * ax * u + 2 * bx) * u + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let u = x;
    for (let i = 0; i < 6; i++) { const e = sx(u) - x; const d = dx(u); if (Math.abs(e) < 1e-5 || !d) break; u -= e / d; }
    return sy(u);
  };
}
const iconPop = bezier(0.34, 1.56, 0.64, 1); // the app's --animate-icon-pop easing
const easeInOut = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x) => Math.min(1, Math.max(0, x));

export function createPress(engine) {
  const st = {
    t: Infinity, // time since the current press (Infinity = none yet)
    chosen: -1,
    last: -1,
    kicked: new Set(),
    revealedSent: false,
    settledSent: true,
    cap: 0, capV: 0, // cap spring (0 up, 1 pressed)
    hover: 0, // 0..1 smoothed
    hoverTarget: 0,
    lift: 0,
    energy: 1, // overall glow level (silence ↔ release)
    flash: 0,
    burst: 0,
    wave: { r: 0, k: 0 },
    revealPos: new THREE.Vector3(),
    revealQuat: new THREE.Quaternion(),
    lean: { x: 0, y: 0 }, leanTarget: { x: 0, y: 0 },
  };
  const tmp = new THREE.Object3D();

  function pick() {
    let i;
    do i = Math.floor(Math.random() * CATEGORY_KEYS.length); while (i === st.last && CATEGORY_KEYS.length > 1);
    return i;
  }

  return {
    state: st,
    /** Start a press now. Returns the chosen category key. */
    press() {
      const items = engine.tokens?.items;
      if (!items) return null;
      // a press while a reveal is still up: snap that token home first
      if (st.chosen >= 0) {
        const old = items[st.chosen];
        old.reveal = old.pop = old.wobble = 0;
        if (!st.settledSent) engine.emit('settled', { category: CATEGORY_KEYS[st.chosen], interrupted: true });
      }
      st.chosen = pick();
      st.last = st.chosen;
      st.t = 0;
      st.kicked.clear();
      st.revealedSent = false;
      st.settledSent = false;
      const category = CATEGORY_KEYS[st.chosen];
      engine.emit('press', { category });
      return category;
    },

    /** Advance by dt (s). P = effective params. */
    update(dt, P) {
      const X = P.press;
      const items = engine.tokens?.items ?? [];
      const calm = engine.calm;
      st.t += dt;
      const t = st.t;

      // --- cap: held down for capHold, then a bouncy spring back (calm: a short linear dip) -------
      if (calm) {
        st.cap = t < 0.12 ? t / 0.12 : clamp01(1 - (t - 0.12) / 0.25);
      } else {
        const target = t < X.capHold ? 1 : 0;
        for (let s = 0, n = 2; s < n; s++) { // two substeps: a stiff spring at 30 fps stays stable
          const h = dt / n;
          st.capV += (X.capSpring * (target - st.cap) - X.capDamping * st.capV) * h;
          st.cap += st.capV * h;
        }
      }

      // --- hover lift / glow -------------------------------------------------------------------
      st.hover += (st.hoverTarget - st.hover) * (1 - Math.exp(-dt * 12));
      st.lift = st.hover * X.hoverLift;

      // --- pointer lean (smoothed) -------------------------------------------------------------
      const kL = 1 - Math.exp(-dt * 4);
      st.lean.x += (st.leanTarget.x - st.lean.x) * kL;
      st.lean.y += (st.leanTarget.y - st.lean.y) * kL;

      // --- energy: silence ↔ release, plus the press flash and comet burst ------------------------
      const sinceRelease = Math.max(0, t - X.revealAt - X.popTime - X.hold);
      const release = Number.isFinite(t) ? Math.exp(-sinceRelease / 2.5) : 0;
      // (calm: no silence beat — it is a slow fade that would keep the on-demand loop rendering)
      const target = calm ? 1 : X.quiet + (1 - X.quiet) * release;
      st.energy += (target - st.energy) * (1 - Math.exp(-dt * 3));
      st.flash = calm || !Number.isFinite(t) ? 0 : X.flash * Math.exp(-t / 0.45);
      st.burst = calm || !Number.isFinite(t) ? 0 : X.burst * Math.exp(-t / 0.7);

      // --- shockwave: radius grows from the button; tokens are kicked as it reaches them -----------
      const tw = t - 0.06;
      st.wave.r = 1.3 + X.waveSpeed * Math.max(0, tw);
      st.wave.k = calm || tw < 0 ? 0 : X.wave * clamp01(1 - tw / X.waveLife) ** 1.5;

      // --- reveal pose: above the button, facing the camera ---------------------------------------
      st.revealPos.set(0, X.revealY, X.revealZ);
      tmp.position.copy(st.revealPos);
      tmp.lookAt(engine.camera.position);
      st.revealQuat.copy(tmp.quaternion);

      const tr = t - X.revealAt;
      const revealAmt = st.chosen < 0 ? 0 : tr < 0 ? 0 : tr < X.popTime + X.hold ? 1 : 1 - easeInOut((tr - X.popTime - X.hold) / X.returnTime);
      items.forEach((it, i) => {
        // springs (kick offset + spin) always run, so an interrupted kick still settles
        for (let s = 0, n = 2; s < n; s++) {
          const h = dt / n;
          it.offV.addScaledVector(it.off, -X.spring * h).multiplyScalar(Math.max(0, 1 - X.damping * h));
          it.off.addScaledVector(it.offV, h);
          it.spinV += (-X.spring * it.spin - X.damping * it.spinV) * h;
          it.spin += it.spinV * h;
        }
        if (i === st.chosen) {
          if (!st.revealedSent && tr >= X.popTime) {
            st.revealedSent = true;
            engine.emit('revealed', { category: CATEGORY_KEYS[i] });
          }
          const done = tr >= X.popTime + X.hold + X.returnTime;
          if (!st.settledSent && done) {
            st.settledSent = true;
            engine.emit('settled', { category: CATEGORY_KEYS[i] });
          }
          if (done) { it.reveal = it.pop = it.wobble = 0; it.glow = 1; return; }
          // reveal: position/orientation blend (eased), pop scale with the app's overshoot, wobble
          if (calm) {
            it.reveal = 0;
            it.pop = 0;
            it.glow = 1 + X.revealGlow * (tr < 0 ? 0 : tr < 0.3 ? tr / 0.3 : revealAmt);
            return;
          }
          if (tr < 0) { it.reveal = it.pop = it.wobble = 0; it.glow = 1; return; }
          const pe = iconPop(clamp01(tr / X.popTime));
          if (tr < X.popTime + X.hold) {
            it.reveal = easeInOut(clamp01(tr / (X.popTime * 0.7)));
            it.pop = pe;
            it.wobble = THREE.MathUtils.degToRad(14) * Math.sin(tr * 9) * Math.exp(-tr * 3.2);
          } else {
            it.reveal = revealAmt;
            it.pop = revealAmt;
            it.wobble = 0;
          }
          it.glow = 1 + X.revealGlow * Math.min(1, it.pop);
        } else {
          it.glow = 1 - X.dimOthers * revealAmt;
          if (calm || st.kicked.has(i) || !Number.isFinite(t)) return;
          // kick as the wave passes this token (horizontal distance from the button)
          const d = Math.hypot(it.base.x, it.base.z);
          if (st.wave.r >= d) {
            st.kicked.add(i);
            const out = new THREE.Vector3(it.base.x, 0, it.base.z).normalize();
            it.offV.addScaledVector(out, X.kick).add(new THREE.Vector3(0, X.kickUp, 0));
            it.spinV += (i % 2 ? 1 : -1) * X.spin * (0.7 + 0.6 * Math.random());
          }
        }
      });
    },

    /** Cap press amount for the button (0..1+). */
    get cap() { return st.cap; },
  };
}
