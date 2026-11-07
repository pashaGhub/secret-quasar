// Neon ring layout — one table shared by the raymarched disk and the orbiting particles,
// so sparks ride exactly on the segments they belong to.
//
//   r0/r1  inner/outer radius (base horizon radius = 1; the formed horizon is drawn
//          HORIZON_SCALE × larger, so its shadow reaches ~3.25 — just inside ring 0)
//   w      angular speed in rad per disk-second (sign = direction of rotation)
//   n      segments around the ring, duty = lit fraction of each segment period
//   skew   chevron bend of the segment ends (0 = straight cut)
//   pulse  angular speed of the energy pulses running along the ring
export const RINGS = [
  { r0: 3.75, r1: 4.30, c: [0.10, 0.92, 1.00], w: 1.30, n: 18, duty: 0.78, skew: 0.0, pulse: -2.6 }, // electric cyan
  { r0: 4.65, r1: 5.40, c: [1.00, 0.10, 0.62], w: -0.85, n: 14, duty: 0.70, skew: 0.45, pulse: 1.9 }, // hot pink
  { r0: 5.75, r1: 6.65, c: [0.06, 0.48, 1.00], w: 0.58, n: 10, duty: 0.82, skew: 0.0, pulse: -1.5 }, // bright blue
  { r0: 7.00, r1: 7.42, c: [1.00, 0.42, 0.04], w: -0.42, n: 30, duty: 0.56, skew: 0.0, pulse: 1.2 }, // vivid orange
  { r0: 7.78, r1: 8.95, c: [0.58, 0.14, 1.00], w: 0.30, n: 11, duty: 0.70, skew: 0.3, pulse: -1.0 }, // neon purple
  { r0: 9.30, r1: 9.68, c: [1.00, 0.05, 0.12], w: -0.36, n: 40, duty: 0.50, skew: 0.0, pulse: 0.9 }, // laser red
  { r0: 10.02, r1: 10.72, c: [0.05, 0.78, 1.00], w: 0.19, n: 7, duty: 0.84, skew: 0.0, pulse: -0.7 }, // outer cyan
];

export const DISK_H = 0.22; // half-thickness of every ring slab

const f = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x));
const v3 = (a) => `vec3(${a.map(f).join(', ')})`;
const v4 = (a) => `vec4(${a.map(f).join(', ')})`;
const N = RINGS.length;

export const RINGS_GLSL = /* glsl */ `
#define RING_N ${N}
const float DISK_H = ${f(DISK_H)};
const float RING_MIN = ${f(RINGS[0].r0)};
const float RING_MAX = ${f(RINGS[N - 1].r1)};
// geo: r0, r1, skew, unused   mot: w, n, duty, pulse
const vec4 RING_GEO[${N}] = vec4[${N}](${RINGS.map((r) => v4([r.r0, r.r1, r.skew, 0])).join(', ')});
const vec4 RING_MOT[${N}] = vec4[${N}](${RINGS.map((r) => v4([r.w, r.n, r.duty, r.pulse])).join(', ')});
const vec3 RING_COL[${N}] = vec3[${N}](${RINGS.map((r) => v3(r.c)).join(', ')});
`;

// The formed event horizon is drawn this much larger than the timeline's unit horizon,
// giving a big, clearly readable black core inside the innermost ring.
export const HORIZON_SCALE = 1.25;
