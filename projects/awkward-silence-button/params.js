// Look parameters for the Awkward Silence Button scene (arcade neon). The /lab/awkward-silence-button
// page tunes these live; paste its "Copy params" output back here to make a look permanent.
// Units: the button cap radius is 1, a category token is ~1 across before `tokens.scale`.
// Axes: +X right, +Y up, +Z toward the camera. Colours are hex strings.

export const DEFAULTS = {
  camera: {
    x: 0,
    y: 3.3,
    z: 7.6,
    tx: 0,
    ty: 0.85,
    tz: 0,
    fov: 28,
    minHalfWidth: 3.75, // never frame narrower than this (half width at the target) — keeps the ring on phones
  },
  // Narrow frames (phones: scene above copy, ~1 : 1.05). Below `aspect` these values replace the ones
  // above, so the ring fills a square frame instead of a thin band.
  narrow: {
    aspect: 1.1,
    camera: { y: 5.6, z: 6.3, ty: 0.75, fov: 32, minHalfWidth: 3.3 },
    tokens: { radius: 2.55, depth: 1.05, scale: 0.92, face: 4 },
    press: { revealY: 3.0, revealZ: 0.5, revealScale: 1.35 },
  },
  exposure: 1,
  toneMapping: 'ACES',
  // The app's dark-theme category hues, pushed to full saturation for neon.
  colors: {
    personal: '#a66bff',
    romantic: '#ff4f86',
    philosophical: '#2ff5dc',
    culture: '#ffc72e',
    common: '#3f8cff',
    food: '#ff8a1f',
    travelAndAdventure: '#45ff8a',
  },
  tokens: {
    radius: 2.95, // ring radius (x)
    depth: 0.75, // ring squash in z (ellipse)
    height: 0.95,
    jitter: 0.18, // height variation around the ring
    scale: 0.88,
    tilt: 0.12, // alternating roll (rad)
    face: 2.2, // how high above the floor they look (aim point y)
    chase: 0.9, // extra edge glow as the ring's comet passes a token's angle
    body: '#0a0a12', // dark sign body
    faceGlow: 0.2, // faint fill on the front face
    rim: 3.2, // edge (fresnel) glow
    rimPow: 2.1,
    crease: 35, // normal crease angle (deg)
  },
  button: {
    scale: 1,
    red: '#e8102e',
    inner: 0.35,
    innerColor: '#ff1030',
    label: 0.7, // white label glow
    ringPink: 1.1, // steady ring glow
    ringPinkColor: '#ff3fae',
    ringCyan: 0.8,
    ringCyanColor: '#40f2ff',
    chase: 3.4, // comet running around the rings, on top of the steady glow (0 = off)
    chaseTail: 0.14, // comet tail (fraction of the ring)
    chaseSpeed: 0.22, // turns per second
    plinth: '#0b0b12',
  },
  floor: {
    color: '#030308',
    metal: 0.35,
    rough: 0.6,
    grid: 0.55, // grid line strength
    cell: 0.6, // grid cell size
    gridNear: '#40f2ff',
    gridFar: '#a04dff',
    fade: 9, // grid fades out by this distance
    pool: 0.55, // pink light pool under the button
    poolColor: '#ff3fae',
    poolSize: 2.6,
  },
  light: {
    key: 0.5,
    keyColor: '#9fdcff',
    pink: 6,
    pinkColor: '#ff3fae',
    cyan: 6,
    cyanColor: '#40f2ff',
    env: 0.12,
    chase: 2.8, // a pink point light that follows the comet around the token ring (0 = off)
    chaseColor: '#ff3fae',
    chaseRadius: 2.3,
    chaseHeight: 1.1,
    chaseHideBehind: 1, // fade the light while it's behind the button (1 = fully out)
  },
  fog: {
    color: '#000000',
    near: 7,
    far: 16,
  },
  bloom: {
    strength: 0.9,
    radius: 0.55,
    threshold: 0.7,
  },
  grade: {
    vignette: 0.45,
    grain: 0.025,
  },
  // The press (concept A). Times in seconds, distances in units.
  press: {
    auto: true,
    intervalMin: 6, // auto-press every 6–8 s while on screen (timer pauses off screen)
    intervalMax: 8,
    capHold: 0.12, // cap held down before it springs back
    capSpring: 260,
    capDamping: 14, // < 2·√spring → a little bounce
    flash: 0.7, // button glow flash on press
    burst: 3, // comet speed-up on press (× speed)
    quiet: 0.78, // glow level during the silence between presses (1 = no dip)
    wave: 1.4, // shockwave strength
    waveSpeed: 7, // units/s
    waveLife: 1.2,
    waveWidth: 0.22,
    waveColor: '#ff6ad5',
    kick: 2.3, // outward kick velocity when the wave reaches a token
    kickUp: 1.8,
    spin: 9, // rad/s
    spring: 34, // token spring back to its ring place
    damping: 5,
    revealAt: 0.18, // the chosen token starts its pop
    popTime: 0.7, // the app's icon-pop (0.7 s, overshoot)
    hold: 2.4, // stays up, facing the camera
    returnTime: 0.9,
    revealY: 2.35, // reveal position above the button
    revealZ: 0.6,
    revealScale: 1.6,
    revealGlow: 1.4, // extra edge glow on the chosen token
    dimOthers: 0.22, // the others dim while it is up
    lean: 0.22, // tokens lean toward the mouse (rad)
    parallax: 0.3, // camera follows the mouse a little
    hoverLift: 0.05,
  },
  anim: {
    idle: 1, // token bob / rock (the app's icon-idle)
    breathe: 1, // button pulse + glow (the app's breathe)
  },
};

/** Deep copy with optional overrides merged in (unknown keys are ignored). */
export function makeParams(overrides) {
  const p = structuredClone(DEFAULTS);
  if (overrides) merge(p, overrides);
  return p;
}

export function merge(dst, src) {
  for (const k of Object.keys(src)) {
    if (!(k in dst)) continue;
    const v = src[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && dst[k] && typeof dst[k] === 'object') merge(dst[k], v);
    else if (typeof v === typeof dst[k]) dst[k] = v;
  }
}
