// Look parameters for the Story Mode scene. The /lab/story-mode page tunes these live; paste the
// "Copy params" output back here to make a look permanent. Units: metres-ish (1 = one OSRS tile),
// angles in degrees, colours as hex strings. glTF axes: +X right, +Y up, +Z toward the camera.

export const DEFAULTS = {
  camera: {
    x: 0.45,
    y: 1.3,
    z: 5,
    tx: 0.05,
    ty: 0.78,
    tz: -0.6,
    fov: 30,
    minHalfWidth: 1.6,
  },
  exposure: 1.2,
  toneMapping: "ACES",
  place: {
    wise_old_man: [-0.6, -0.12, 58],
    avatar: [0.66, -0.3, -62],
    nieve: [-1.62, -2.05, 24],
    sheep: [1.95, -3, -118],
    chicken: [1.02, 1.55, -32],
    circle: [0, -0.2, 8],
  },
  menhirs: [false, true, true, true, false],
  stonesFaceBook: true,
  book: {
    y: 1.06,
    z: -0.2,
    tilt: 26,
    vtilt: 7,
    light: 4.2,
    lightColor: "#ffab5e",
    flicker: 0.14,
    lightHeight: 0.42,
    lightForward: 0.3,
    pool: 16,
    poolAngle: 55,
    pageBright: 1.3,
    runeGlow: 3,
    halo: 0.32,
    haloSize: 1.7,
    haloColor: "#ff9d4d",
    haloBack: 0.45,
  },
  light: {
    hemi: 0.75,
    hemiSky: "#2a3452",
    hemiGround: "#160d07",
    rim: 2.6,
    rimColor: "#7d98ff",
    bounce: 0.9,
    bounceColor: "#ff9a55",
    fill: 0.32,
    fillColor: "#ffd2a6",
    env: 0.35,
    circleGlow: 1.6,
    circleColor: "#6f9bff",
    circleLight: 0.9,
  },
  fog: {
    color: "#0d0b12",
    density: 0.13,
    layers: 0.32,
    layerColor: "#3a3a52",
  },
  dof: {
    focus: 0,
    aperture: 0.95,
    maxBlur: 7,
    range: 0.35,
  },
  bloom: {
    strength: 0.9,
    radius: 0.6,
    threshold: 1.45,
  },
  grade: {
    vignette: 0.62,
    grain: 0.03,
    warmth: 0.05,
    lift: 0.012,
  },
  particles: {
    embers: 150,
    emberSize: 1,
    emberSpeed: 1,
    dust: 280,
    dustSize: 1,
  },
  torches: {
    on: true,
    intensity: 4.5,
    color: "#ff8a3c",
    flame: 0.75,
    height: 1.3,
    list: [[1.43, -4.13]],
  },
  anim: {
    idle: 1,
    parallax: 1,
    glance: 1,
    hover: 0.03,
    openTime: 2.2,
    turnTime: 1.15,
    curl: 0.9,
    sparks: 3,
  },
};

/** Deep copy with optional overrides merged in (unknown keys are ignored). */
export function makeParams(overrides) {
  const p = structuredClone(DEFAULTS);
  if (overrides) merge(p, overrides);
  return p;
}

function merge(dst, src) {
  for (const k of Object.keys(src)) {
    if (!(k in dst)) continue;
    const v = src[k];
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      typeof dst[k] === "object"
    )
      merge(dst[k], v);
    else dst[k] = structuredClone(v);
  }
  return dst;
}
