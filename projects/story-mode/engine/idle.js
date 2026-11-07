// Code-driven idles for the five characters and the hovering book. Everything is an offset on top of
// the resting pose from layout.js, so the idle strength can be scaled (lab) or switched off (reduced
// motion). Joint axes (glTF, character facing +Z): rotation.x > 0 tips forward/down, rotation.y turns
// toward the character's left (+X), rotation.z rolls.

/** Smooth pseudo-noise in about [-1, 1]: a few incommensurate sines. */
const wave = (t, s) => (Math.sin(t * 0.73 + s) * 0.5 + Math.sin(t * 1.37 + s * 2.1) * 0.3 + Math.sin(t * 2.91 + s * 3.7) * 0.2);
const smooth = (cur, target, dt, speed) => cur + (target - cur) * (1 - Math.exp(-dt * speed));
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const bump = (k) => (k <= 0 || k >= 1 ? 0 : Math.sin(k * Math.PI));

/** A value that wanders to a new random target every few seconds (looking around). */
class Wander {
  constructor(range, minHold, maxHold, speed, seed = 1) {
    this.range = range; this.minHold = minHold; this.maxHold = maxHold; this.speed = speed;
    this.value = 0; this.target = 0; this.timer = seed % 2;
  }
  update(dt, rnd) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.target = (rnd() * 2 - 1) * this.range;
      this.timer = this.minHold + rnd() * (this.maxHold - this.minHold);
    }
    this.value = smooth(this.value, this.target, dt, this.speed);
    return this.value;
  }
}

export function createIdles(n) {
  const names = [
    'avatar', 'avatar__torso_base', 'avatar__neck', 'avatar__shoulder_L', 'avatar__shoulder_R', 'avatar__elbow_L', 'avatar__elbow_R',
    'wise_old_man', 'wise_old_man__torso_base', 'wise_old_man__neck', 'wise_old_man__shoulder_L', 'wise_old_man__shoulder_R',
    'wise_old_man__elbow_R', 'wise_old_man__crown',
    'nieve', 'nieve__torso_base', 'nieve__neck', 'nieve__cape', 'nieve__shoulder_L', 'nieve__elbow_L',
    'chicken__body', 'chicken__neck', 'chicken__wing_L', 'chicken__wing_R',
    'sheep__body', 'sheep__neck',
  ];
  const J = {}, base = {};
  for (const k of names) {
    const o = n(k);
    if (!o) continue;
    J[k] = o;
    base[k] = o.rotation.clone();
  }
  // roots keep their placement rotation.y (layout), we only own x/z on them
  const set = (k, x = 0, y = 0, z = 0) => {
    const o = J[k], b = base[k];
    if (!o) return;
    if (!k.includes('__')) { o.rotation.x = x; o.rotation.z = z; return; }
    o.rotation.set(b.x + x, b.y + y, b.z + z);
  };

  let seed = 12345;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const look = {
    wise: new Wander(0.18, 2.5, 5, 2.2, 1), wiseP: new Wander(0.06, 3, 6, 2, 2),
    avatar: new Wander(0.22, 2.2, 4.5, 2.5, 3), avatarP: new Wander(0.08, 2.5, 5, 2, 4),
    nieve: new Wander(0.35, 3, 7, 1.4, 5),
    chicken: new Wander(0.6, 0.6, 1.6, 7, 6),
    sheep: new Wander(0.35, 1.5, 3, 2, 7),
  };
  // chicken: pecking bursts; sheep: grazing with occasional head lifts
  const chick = { mode: 'look', timer: 1.5, pecks: 0, k: 0, flap: 0, flapT: 4 };
  const sheep = { up: 0, upTarget: 0, timer: 5 };
  const nod = { k: 1, timer: 3 };

  /** Resting pose again (reduced motion / idle switched off). */
  function reset() {
    for (const k of Object.keys(J)) set(k);
  }

  /**
   * @param {number} t   seconds
   * @param {number} dt
   * @param {{ amount: number, glance: { wise: {x: number, y: number}, avatar: {x: number, y: number} } }} o
   */
  function update(t, dt, { amount, glance }) {
    const a = amount;
    const breathe = (s, period = 4.2) => Math.sin((t / period) * Math.PI * 2 + s);

    // --- Wise Old Man: storyteller. Breathes, gestures with the raised hand, looks at the book / you.
    {
      const b = breathe(0.4);
      const gesture = wave(t * 0.8, 1.1);
      const emph = bump(((t + 1.3) % 6.5) / 1.1);           // a small emphasis beat every ~6.5 s
      const ly = look.wise.update(dt, rnd), lp = look.wiseP.update(dt, rnd);
      set('wise_old_man__torso_base', a * (0.012 * b + 0.02 * emph), 0, a * 0.008 * wave(t * 0.3, 2));
      set('wise_old_man__neck', a * (-0.006 * b + lp + 0.06 * emph) + glance.wise.y, a * ly + glance.wise.x, 0);
      set('wise_old_man__shoulder_R', a * (0.06 * gesture - 0.08 * emph), 0, a * 0.03 * wave(t * 0.6, 4));
      set('wise_old_man__elbow_R', a * (0.1 * wave(t * 0.9, 5) - 0.12 * emph));
      set('wise_old_man__shoulder_L', a * 0.02 * b, 0, a * -0.015 * b);
      set('wise_old_man__crown', 0, 0, a * 0.03 * emph);
      set('wise_old_man', 0, 0, a * 0.006 * wave(t * 0.35, 9));
    }
    // --- Player avatar: listening. Breathes, small nods, shifts weight.
    {
      const b = breathe(1.7, 3.8);
      nod.timer -= dt;
      if (nod.timer <= 0) { nod.k = 0; nod.timer = 3 + rnd() * 4; }
      nod.k = Math.min(1, nod.k + dt / 0.9);
      const nodV = bump(nod.k) * 0.09;
      const ly = look.avatar.update(dt, rnd), lp = look.avatarP.update(dt, rnd);
      set('avatar__torso_base', a * 0.012 * b, 0, a * 0.01 * wave(t * 0.25, 3));
      set('avatar__neck', a * (nodV + lp - 0.006 * b) + glance.avatar.y, a * ly + glance.avatar.x, 0);
      set('avatar__shoulder_L', a * 0.03 * wave(t * 0.5, 1), 0, a * -0.012 * b);
      set('avatar__shoulder_R', a * 0.03 * wave(t * 0.5, 2), 0, a * 0.012 * b);
      set('avatar__elbow_L', a * -0.04 * (0.5 + 0.5 * wave(t * 0.4, 6)));
      set('avatar__elbow_R', a * -0.04 * (0.5 + 0.5 * wave(t * 0.4, 7)));
      set('avatar', 0, 0, a * 0.008 * wave(t * 0.3, 5));
    }
    // --- Nieve: on guard in the background. Slow breathing, cape in the wind, scanning the dark.
    {
      const b = breathe(2.9, 4.8);
      set('nieve__torso_base', a * 0.01 * b);
      set('nieve__neck', a * 0.03 * wave(t * 0.4, 1), a * look.nieve.update(dt, rnd));
      set('nieve__cape', a * (0.07 + 0.06 * wave(t * 1.1, 2) + 0.03 * Math.sin(t * 4.3)), 0, a * 0.04 * wave(t * 0.9, 3));
      set('nieve__shoulder_L', a * 0.02 * b);
      set('nieve__elbow_L', a * 0.03 * wave(t * 0.5, 4));
    }
    // --- Chicken: look around, then a burst of pecks; now and then a wing flap.
    {
      chick.timer -= dt;
      if (chick.mode === 'look' && chick.timer <= 0) { chick.mode = 'peck'; chick.pecks = 2 + Math.floor(rnd() * 3); chick.k = 0; }
      let peck = 0;
      if (chick.mode === 'peck') {
        chick.k += dt / 0.32;
        peck = bump(chick.k % 1);
        if (chick.k >= chick.pecks) { chick.mode = 'look'; chick.timer = 1.2 + rnd() * 2.5; }
      }
      const ly = chick.mode === 'look' ? look.chicken.update(dt, rnd) : smooth(look.chicken.value, 0, dt, 8);
      if (chick.mode !== 'look') look.chicken.value = ly;
      chick.flapT -= dt;
      if (chick.flapT <= 0) { chick.flap = 1; chick.flapT = 5 + rnd() * 6; }
      chick.flap = Math.max(0, chick.flap - dt / 0.7);
      const flap = chick.flap > 0 ? Math.abs(Math.sin((1 - chick.flap) * Math.PI * 4)) * 0.9 : 0;
      set('chicken__neck', a * 0.95 * peck, a * ly, 0);
      set('chicken__body', a * (0.18 * peck + 0.02 * Math.sin(t * 3)), 0, 0);
      set('chicken__wing_L', 0, 0, a * flap);
      set('chicken__wing_R', 0, 0, -a * flap);
    }
    // --- Sheep: grazing (chewing), lifting its head to look around every so often.
    {
      sheep.timer -= dt;
      if (sheep.timer <= 0) {
        sheep.upTarget = sheep.upTarget > 0.5 ? 0 : 1;
        sheep.timer = sheep.upTarget ? 2.5 + rnd() * 2 : 6 + rnd() * 6;
      }
      sheep.up = smooth(sheep.up, sheep.upTarget, dt, 2.2);
      const chew = (1 - sheep.up) * 0.035 * Math.sin(t * 7.5);
      set('sheep__neck', a * (-0.72 * sheep.up + chew), a * sheep.up * look.sheep.update(dt, rnd), 0);
      set('sheep__body', a * 0.012 * breathe(0.5, 3.4));
    }
  }

  return { update, reset };
}

/** Book bob / sway while it hovers. Returns offsets the engine adds to the book's placement. */
export function bookHover(t, amp) {
  return {
    y: amp * Math.sin(t * 1.15) + amp * 0.3 * Math.sin(t * 2.7 + 1),
    rx: 0.018 * Math.sin(t * 0.9 + 0.4) * (amp / 0.03),
    rz: 0.022 * Math.sin(t * 0.7) * (amp / 0.03),
  };
}

export { clamp01, smooth, bump };
export const ease = {
  inOutCubic: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  inOutSine: (k) => -(Math.cos(Math.PI * k) - 1) / 2,
  outBack: (k) => { const c = 1.4; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); },
};
