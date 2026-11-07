// GPU particle systems. All motion is computed in vertex shaders from per-particle
// seeds + time uniforms, so the CPU never touches a particle after creation.
//
//  • debris  — thousands of neon fragments: spinning diamond Points + LineSegments
//              (motion-blur trails), launched ballistically then spiralled into the hole.
//  • disk    — sparks and arc dashes locked to the neon rings (same speed + direction).
//  • jets    — fast sparks racing out along the laser beams, some flung outward.
//  • dust    — near-field star dust at finite depth for real camera parallax.
import * as THREE from 'three';
import { RINGS, RINGS_GLSL } from './rings.js';

const rand = (() => { let s = 1337; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

// Shared GLSL: world transform, black-hole occlusion, soft point sprite.
const COMMON = /* glsl */ `
uniform mat3 uSys;
uniform float uTime, uDiskTime, uJetTime, uPR, uHorizon;
// Hide anything sitting behind the event horizon (the raymarcher draws the lensed image).
float occlusion(vec3 wp) {
  vec3 C = cameraPosition;
  vec3 dir = wp - C;
  float L = length(dir);
  dir /= L;
  float tc = dot(-C, dir);
  if (tc <= 0.0 || L < tc) return 1.0;
  float b = length(C + dir * tc);
  float rad = 2.6 * max(uHorizon, 0.0);
  return smoothstep(rad * 0.75, rad * 1.25, b);
}
`;

const SPRITE_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c) * 4.0;
  float a = exp(-d * 6.0) + 0.15 * exp(-d * 1.5);
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor * a * vAlpha, 1.0);
}
`;
// hard-edged spinning diamond: geometric fragments / sparks
const DIAMOND_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vRot;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float cs = cos(vRot), sn = sin(vRot);
  c = mat2(cs, -sn, sn, cs) * c;
  vec2 q = abs(c) * 2.0;
  float d = q.x * 1.6 + q.y;                     // elongated diamond
  float a = (1.0 - smoothstep(0.62, 0.8, d)) + 0.22 * exp(-dot(q, q) * 2.5);
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor * a * vAlpha, 1.0);
}
`;
const LINE_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() { gl_FragColor = vec4(vColor * vAlpha, 1.0); }
`;

function material(vertexShader, fragmentShader, uniforms) {
  return new THREE.ShaderMaterial({
    vertexShader, fragmentShader, uniforms,
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending,
  });
}

function pointsGeometry(n, fill) {
  const g = new THREE.BufferGeometry();
  const a = new Float32Array(n * 4), b = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) fill(a, b, i * 4);
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('aA', new THREE.BufferAttribute(a, 4));
  g.setAttribute('aB', new THREE.BufferAttribute(b, 4));
  return g;
}

/** Same seeds duplicated per line vertex; aEnd = 0 head / 1 tail. */
function linesGeometry(n, fill) {
  const g = new THREE.BufferGeometry();
  const a = new Float32Array(n * 8), b = new Float32Array(n * 8), end = new Float32Array(n * 2);
  const ta = [0, 0, 0, 0], tb = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    fill(ta, tb, 0);
    for (let k = 0; k < 2; k++) {
      a.set(ta, (i * 2 + k) * 4); b.set(tb, (i * 2 + k) * 4); end[i * 2 + k] = k;
    }
  }
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
  g.setAttribute('aA', new THREE.BufferAttribute(a, 4));
  g.setAttribute('aB', new THREE.BufferAttribute(b, 4));
  g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  return g;
}

// ─────────────────────────── explosion debris ───────────────────────────
const DEBRIS_FN = /* glsl */ `
uniform float uDebrisT, uCollapse, uBlast;
attribute vec4 aA; // dir.xyz, speed
attribute vec4 aB; // seed, size, hue, drag
vec3 debrisLocal(float te) {
  float k = aB.w;
  float travel = aA.w * uBlast * (1.0 - exp(-k * te)) / k;
  vec3 p = aA.xyz * travel;
  // contraction: swirl around the spin axis and fall into the centre
  float c = uCollapse;
  float ang = c * c * (3.0 + 4.0 * aB.x);
  float cs = cos(ang), sn = sin(ang);
  p.xz = mat2(cs, -sn, sn, cs) * p.xz;
  p.y *= 1.0 - 0.85 * c;                    // flatten toward the disk plane while falling in
  return p * pow(1.0 - c, 1.6);
}
vec3 debrisColor() {
  float h = aB.z;   // neon arcade palette: cyan, orange, hot pink, purple, blue, white-hot
  return h < 0.30 ? vec3(0.05, 0.85, 1.0) : (h < 0.52 ? vec3(1.0, 0.42, 0.04) : (h < 0.68 ? vec3(1.0, 0.1, 0.6)
       : (h < 0.82 ? vec3(0.55, 0.15, 1.0) : (h < 0.94 ? vec3(0.1, 0.4, 1.0) : vec3(1.0)))));
}
float debrisAlpha(float te) {
  float launch = smoothstep(0.0, 0.05, te);
  float cool = 0.25 + 0.75 * exp(-te * 0.45);
  float gone = 1.0 - smoothstep(0.82, 1.0, uCollapse);
  return launch * cool * gone;
}
`;

function createDebris(N) {
  const fill = (a, b, o) => {
    // directions: isotropic, with extra density near the future disk plane and spin axis
    let x = rand() * 2 - 1, y = rand() * 2 - 1, z = rand() * 2 - 1;
    const r = rand();
    if (r < 0.35) y *= 0.15; else if (r < 0.45) { x *= 0.15; z *= 0.15; }
    const l = Math.hypot(x, y, z) || 1;
    const speed = 3 + Math.pow(rand(), 1.7) * 26;
    a[o] = x / l; a[o + 1] = y / l; a[o + 2] = z / l; a[o + 3] = speed;
    b[o] = rand(); b[o + 1] = 0.6 + rand() * 1.8; b[o + 2] = rand(); b[o + 3] = 0.35 + rand() * 0.6;
  };
  const uniforms = { uDebrisT: { value: 0 }, uCollapse: { value: 0 }, uBlast: { value: 1 } };

  const pts = new THREE.Points(pointsGeometry(N, fill), material(/* glsl */ `
    ${COMMON}
    ${DEBRIS_FN}
    varying vec3 vColor; varying float vAlpha; varying float vRot;
    void main() {
      vec3 wp = uSys * debrisLocal(uDebrisT);
      vec4 mv = viewMatrix * vec4(wp, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = aB.y * uPR * 105.0 / -mv.z;
      vColor = debrisColor() * 1.8;
      vAlpha = debrisAlpha(uDebrisT) * occlusion(wp) * step(0.0001, uDebrisT);
      vRot = aB.x * 6.2831 + uTime * (2.0 + 6.0 * aB.w) * (aB.x > 0.5 ? 1.0 : -1.0);
    }`, DIAMOND_FRAG, uniforms));

  const NL = Math.floor(N * 0.6);
  const lines = new THREE.LineSegments(linesGeometry(NL, fill), material(/* glsl */ `
    ${COMMON}
    ${DEBRIS_FN}
    attribute float aEnd;
    varying vec3 vColor; varying float vAlpha;
    void main() {
      float lag = aEnd * (0.10 + 0.25 * uCollapse);
      float te = max(uDebrisT - lag, 0.0);
      vec3 wp = uSys * debrisLocal(te);
      gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      vColor = debrisColor() * 0.9;
      vAlpha = (1.0 - aEnd) * debrisAlpha(uDebrisT) * occlusion(wp) * step(0.0001, uDebrisT);
    }`, LINE_FRAG, uniforms));

  return { objects: [lines, pts], uniforms };
}

// ─────────────────────────── ring sparks & dashes ───────────────────────────
const DISK_FN = /* glsl */ `
${RINGS_GLSL}
uniform float uDisk, uDiskReveal, uDiskEnergy;
attribute vec4 aA; // radius, angle0, height (−1..1 of the slab), ring index
attribute vec4 aB; // seed, size, hue, speedJitter
vec3 diskLocal(float t, out float rad) {
  int ri = int(aA.w + 0.5);
  float r = aA.x;
  float ang = aA.y + RING_MOT[ri].x * aB.w * t;     // ride the ring: same speed and direction
  rad = r;
  return vec3(cos(ang) * r, aA.z * (DISK_H + 0.12), sin(ang) * r);
}
float diskAlpha(float r) {
  float reveal = smoothstep(uDiskReveal + 0.4, uDiskReveal - 0.4, r);
  return reveal * uDisk;
}
vec3 diskColor() {
  vec3 c = RING_COL[int(aA.w + 0.5)];
  return aB.z > 0.93 ? vec3(1.0) : (aB.z > 0.8 ? mix(c, vec3(1.0), 0.4) : c);
}
`;

function createDisk(N, NL) {
  const fill = (a, b, o) => {
    const ri = Math.floor(rand() * RINGS.length);
    const R = RINGS[ri];
    const edge = rand();
    // most sparks hug the ring edges (where the neon outlines are), the rest float across it
    a[o] = edge < 0.35 ? R.r0 - 0.05 + rand() * 0.12 : edge < 0.7 ? R.r1 - 0.07 + rand() * 0.12 : R.r0 + rand() * (R.r1 - R.r0);
    a[o + 1] = rand() * Math.PI * 2;
    a[o + 2] = rand() < 0.5 ? 1 : -1;
    a[o + 3] = ri;
    b[o] = rand(); b[o + 1] = 0.5 + rand() * 1.2; b[o + 2] = rand(); b[o + 3] = 0.85 + rand() * 0.45;
  };
  const uniforms = { uDisk: { value: 0 }, uDiskReveal: { value: 0 }, uDiskEnergy: { value: 1 } };
  const pts = new THREE.Points(pointsGeometry(N, fill), material(/* glsl */ `
    ${COMMON}
    ${DISK_FN}
    varying vec3 vColor; varying float vAlpha; varying float vRot;
    void main() {
      float r;
      vec3 wp = uSys * diskLocal(uDiskTime, r);
      vec4 mv = viewMatrix * vec4(wp, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = aB.y * uPR * 70.0 / -mv.z;
      float tw = 0.55 + 0.45 * sin(uTime * (3.0 + aB.x * 7.0) + aB.x * 40.0);
      vColor = diskColor() * 1.3 * uDiskEnergy;
      vAlpha = diskAlpha(r) * tw * occlusion(wp);
      vRot = uTime * (1.5 + 3.0 * aB.x) + aB.x * 9.0;
    }`, DIAMOND_FRAG, uniforms));

  const lines = new THREE.LineSegments(linesGeometry(NL, fill), material(/* glsl */ `
    ${COMMON}
    ${DISK_FN}
    attribute float aEnd;
    varying vec3 vColor; varying float vAlpha;
    void main() {
      float r;
      vec3 wp = uSys * diskLocal(uDiskTime - aEnd * 0.4, r);
      gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      vColor = RING_COL[int(aA.w + 0.5)] * 0.8 * uDiskEnergy;
      vAlpha = (1.0 - aEnd) * diskAlpha(r) * occlusion(wp) * (0.3 + 0.7 * aB.z);
    }`, LINE_FRAG, uniforms));
  return { objects: [lines, pts], uniforms };
}

// ─────────────────────────── jet streaks ───────────────────────────
function createJets(NL, NP) {
  const fill = (a, b, o) => {
    a[o] = rand(); a[o + 1] = rand() * Math.PI * 2; a[o + 2] = Math.pow(rand(), 2.0); a[o + 3] = rand() < 0.5 ? -1 : 1;
    b[o] = rand(); b[o + 1] = 0.6 + rand() * 1.4; b[o + 2] = rand(); b[o + 3] = 0.7 + rand() * 0.6;
  };
  const FN = /* glsl */ `
    uniform float uJet, uJetIntensity;
    attribute vec4 aA; // phase, angle, radialFrac, side
    attribute vec4 aB; // seed, size, hue, speed
    const float JL = 42.0;
    vec3 jetLocal(float t, out float fade) {
      float L = max(uJet * JL, 0.001);
      float y = mod(aA.x * JL + t * 22.0 * aB.w, JL);
      fade = smoothstep(1.2, 3.0, y) * (1.0 - smoothstep(L - 3.0, L, y)) * step(y, L);
      float R = 0.25 + 1.0 * aA.z;
      if (aB.z > 0.8) R += 0.09 * y * (aB.z - 0.8) * 5.0;      // sparks flung off the beam
      float ang = aA.y + y * 0.6 - t * 4.0;
      return vec3(cos(ang) * R, aA.w * y, sin(ang) * R);
    }
    vec3 jetColor() {
      vec3 c = aB.z < 0.45 ? vec3(0.1, 0.9, 1.0) : (aB.z < 0.75 ? vec3(0.1, 0.4, 1.0) : (aB.z < 0.92 ? vec3(0.6, 0.2, 1.0) : vec3(1.0, 0.45, 0.05)));
      return c * 1.4;
    }
  `;
  const uniforms = { uJet: { value: 0 }, uJetIntensity: { value: 1 } };
  const lines = new THREE.LineSegments(linesGeometry(NL, fill), material(/* glsl */ `
    ${COMMON}
    ${FN}
    attribute float aEnd;
    varying vec3 vColor; varying float vAlpha;
    void main() {
      float f;
      vec3 wp = uSys * jetLocal(uJetTime - aEnd * 0.05, f);
      gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      vColor = jetColor() * 0.8 * uJetIntensity;
      vAlpha = (1.0 - aEnd) * f * occlusion(wp);
    }`, LINE_FRAG, uniforms));
  const pts = new THREE.Points(pointsGeometry(NP, fill), material(/* glsl */ `
    ${COMMON}
    ${FN}
    varying vec3 vColor; varying float vAlpha;
    void main() {
      float f;
      vec3 wp = uSys * jetLocal(uJetTime, f);
      vec4 mv = viewMatrix * vec4(wp, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = aB.y * uPR * 50.0 / -mv.z;
      vColor = jetColor() * 0.8 * uJetIntensity;
      vAlpha = f * occlusion(wp);
    }`, SPRITE_FRAG, uniforms));
  return { objects: [lines, pts], uniforms };
}

// ─────────────────────────── near-field dust (parallax) ───────────────────────────
function createDust(N) {
  const fill = (a, b, o) => {
    // a shell between the camera and the far sky, kept away from the quasar itself
    let x, y, z;
    do { x = rand() * 2 - 1; y = rand() * 2 - 1; z = rand() * 2 - 1; } while (x * x + y * y + z * z > 1);
    const r = 45 + rand() * 120;
    const l = Math.hypot(x, y, z) || 1;
    a[o] = (x / l) * r; a[o + 1] = (y / l) * r; a[o + 2] = (z / l) * r; a[o + 3] = rand();
    b[o] = rand(); b[o + 1] = 0.6 + rand() * 1.6; b[o + 2] = rand(); b[o + 3] = rand();
  };
  const uniforms = { uStarReveal: { value: 0 } };
  const pts = new THREE.Points(pointsGeometry(N, fill), material(/* glsl */ `
    ${COMMON}
    uniform float uStarReveal;
    attribute vec4 aA; attribute vec4 aB;
    varying vec3 vColor; varying float vAlpha;
    void main() {
      vec3 wp = aA.xyz;
      vec4 mv = viewMatrix * vec4(wp, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = max(aB.y * uPR * 120.0 / -mv.z, 1.0);
      float tw = 0.55 + 0.45 * sin(uTime * (0.7 + aB.w * 4.0) + aB.x * 50.0);
      vColor = (aB.z < 0.6 ? vec3(0.7, 0.82, 1.0) : vec3(0.85, 0.75, 1.0)) * 0.9;
      vAlpha = tw * smoothstep(aA.w * 0.9, aA.w * 0.9 + 0.1, uStarReveal) * occlusion(wp);
    }`, SPRITE_FRAG, uniforms));
  return { objects: [pts], uniforms };
}

export function createParticles(scene, { scale = 1 } = {}) {
  const shared = {
    uSys: { value: new THREE.Matrix3() }, uTime: { value: 0 }, uDiskTime: { value: 0 },
    uJetTime: { value: 0 }, uPR: { value: 1 }, uHorizon: { value: 0 },
  };
  const systems = [
    createDust(Math.round(900 * scale)),
    createDebris(Math.round(9000 * scale)),
    createDisk(Math.round(3200 * scale), Math.round(320 * scale)),
    createJets(Math.round(1100 * scale), Math.round(1600 * scale)),
  ];
  const u = { ...shared };
  for (const s of systems) {
    Object.assign(u, s.uniforms);
    for (const o of s.objects) {
      Object.assign(o.material.uniforms, shared);
      o.frustumCulled = false;
      o.renderOrder = 1;
      scene.add(o);
    }
  }
  return { uniforms: u };
}
