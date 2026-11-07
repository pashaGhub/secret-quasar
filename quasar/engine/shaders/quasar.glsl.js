// Full-screen raymarcher — NEON ARCADE style.
// Camera rays are still bent around the black hole (Schwarzschild-style geodesic
// approximation), but what they hit is now stylised geometry instead of gas:
//   • a stack of thick, segmented neon rings (shared table in ../rings.js), each spinning
//     at its own speed and direction, with energy pulses racing along them;
//   • two solid laser-beam jets with a white-hot core, a hard-edged neon tube and pulse collars;
//   • a razor-sharp neon photon ring around a pure black shadow;
//   • arcade blasts: dashed shockwave circles, radial laser streaks, periodic energy bursts.
// Ring and jet hits are solved analytically per march segment, so their edges stay sharp
// at any step size. Everything lives in the quasar's local frame (disk = XZ, spin = +Y);
// uSys rotates it into the world, which is how the whole system is tilted as one body.
import { NOISE_GLSL } from './noise.glsl.js';
import { RINGS_GLSL } from '../rings.js';

export const QUASAR_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export const QUASAR_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform mat4 uCamWorld;
uniform mat4 uProjInv;
uniform vec3 uCamPos;
uniform mat3 uSys;      // local -> world
uniform mat3 uSysInv;   // world -> local
uniform float uPixelAngle;

uniform float uTime;
uniform float uDiskTime;
uniform float uJetTime;

uniform float uStarReveal;
uniform float uHorizon;
uniform float uDisk;
uniform float uDiskReveal;
uniform float uDiskEnergy;
uniform float uFlux;
uniform float uJet;
uniform float uJetIntensity;
uniform float uCoreR;
uniform float uCoreGlow;
uniform float uShockR;
uniform float uShockA;
uniform float uCollapse;
uniform float uCollapseGlow;
uniform float uBurstR;  // periodic active-phase energy burst: radius
uniform float uBurstA;  //                                     amplitude
uniform vec3 uModeW;    // weights: optical, spectral, gravimetric
uniform float uSteps;   // quality: max march steps

${NOISE_GLSL}
${RINGS_GLSL}

const float JET_LEN = 42.0;
const float TAU = 6.2831853;

// screen-space angle of a world direction around the view axis (for dashes and streaks)
float screenAngle(vec3 d) {
  return atan(dot(d, vec3(uCamWorld[1])), dot(d, vec3(uCamWorld[0])));
}
float erfa(float x) { return sign(x) * sqrt(1.0 - exp(-1.2732 * x * x)); }
float dashes(float a, float n, float duty, float ph) { return step(duty, fract(a / TAU * n + ph)); }

// ── distant stars, sampled from the bent ray direction (so they are lensed) ──
vec3 starLayer(vec3 d, float sc, float density, float bright, float seed) {
  vec3 g = d * sc;
  vec3 id = floor(g);
  vec3 f = fract(g) - 0.5;
  float h = hash13(id + seed);
  if (h < density) return vec3(0.0);
  vec3 o = (vec3(hash13(id + 1.3 + seed), hash13(id + 2.7 + seed), hash13(id + 5.1 + seed)) - 0.5) * 0.6;
  float dist = length(f - o);
  float size0 = 0.05 + 0.10 * hash13(id + 9.1 + seed);
  float pix = uPixelAngle * sc * 0.9;
  float size = max(size0, pix);
  float b = smoothstep(size, 0.0, dist);
  b = b * b * min(1.0, (size0 * size0) / (size * size) * 2.5);
  float appear = hash13(id + 3.3 + seed);
  float vis = smoothstep(appear * 0.9, appear * 0.9 + 0.1, uStarReveal);
  float sp = 0.6 + 5.0 * hash13(id + 4.4 + seed);
  float tw = 0.62 + 0.38 * sin(uTime * sp + 6.2831 * hash13(id + 7.7 + seed));
  float hue = hash13(id + 8.8 + seed);
  vec3 tint = hue < 0.5 ? vec3(0.55, 0.85, 1.0) : (hue < 0.8 ? vec3(0.95, 0.95, 1.0) : vec3(0.85, 0.45, 1.0));
  return tint * b * vis * tw * bright * (0.4 + 1.2 * hash13(id + 6.6 + seed));
}

vec3 background(vec3 dWorld, vec3 dLocal) {
  // clean black sky, only crisp stars (no nebular haze) for maximum neon contrast
  vec3 c = starLayer(dWorld, 70.0, 0.82, 2.4, 0.0)
         + starLayer(dWorld, 150.0, 0.88, 1.2, 31.0)
         + starLayer(dWorld, 320.0, 0.92, 0.7, 77.0);
  // Gravimetric mode: a coordinate grid on the sky, drawn from the bent ray (lensing made visible).
  if (uModeW.z > 0.001) {
    float lat = asin(clamp(dLocal.y, -1.0, 1.0));
    float lon = atan(dLocal.z, dLocal.x);
    vec2 gq = vec2(lon, lat) * vec2(12.0, 12.0) / 3.14159;
    float px = uPixelAngle * 12.0 / 3.14159 * 0.9;
    vec2 gw = vec2(px / max(cos(lat), 0.15), px);
    vec2 fd = 0.5 - abs(fract(gq) - 0.5);
    vec2 gl = 1.0 - smoothstep(gw * 0.5, gw * 1.5, fd);
    float line = max(gl.x, gl.y) * (0.35 + 0.65 * smoothstep(0.9, 0.2, abs(dLocal.y)));
    c += vec3(0.10, 0.75, 1.0) * line * 0.16 * uModeW.z;
  }
  return c;
}

// ── neon rings ──────────────────────────────────────────────────────────────
int ringAt(float rho, float fw) {
  for (int i = 0; i < RING_N; i++) {
    if (rho > RING_GEO[i].x - fw && rho < RING_GEO[i].y + fw) return i;
  }
  return -1;
}

vec3 ringColor(int ri, float rho) {
  vec3 rc = RING_COL[ri];
  if (uModeW.y > 0.001) {           // spectral: hard false-colour ramp by radius
    float h = (rho - RING_MIN) / (RING_MAX - RING_MIN);
    vec3 sp = 0.5 + 0.5 * cos(TAU * (vec3(0.0, 0.33, 0.67) + h * 0.9 + 0.55));
    rc = mix(rc, sp, uModeW.y);
  }
  return rc;
}

// comet-shaped energy pulses running around a ring (2 per ring)
float ringPulse(float phi, float rho, float pv, float ri) {
  float s = 0.0;
  for (int k = 0; k < 2; k++) {
    float pp = pv * uDiskTime + float(k) * 3.14159 + ri * 1.7;
    float a = mod(phi - pp + 3.14159, TAU) - 3.14159;   // (-pi, pi]
    float ahead = a * rho * sign(pv);
    s += ahead > 0.0 ? exp(-ahead * ahead / 0.05) : exp(ahead / 1.4);
  }
  return s;
}

// ring geometry only (cheap): coverage of the slab at local point q, plus what shading needs
float ringGeom(vec3 q, float fw, out int ri, out float rho, out float phi, out float sd, out float idm) {
  ri = -1; phi = 0.0; sd = 0.0; idm = 0.0;
  rho = length(q.xz);
  if (rho < RING_MIN - fw || rho > RING_MAX + fw || abs(q.y) > DISK_H) return 0.0;
  ri = ringAt(rho, fw);
  if (ri < 0) return 0.0;
  vec4 g = RING_GEO[ri];
  vec4 mo = RING_MOT[ri];
  float hw = 0.5 * (g.y - g.x), rm = 0.5 * (g.x + g.y);
  phi = atan(q.z, q.x);
  float n = mo.y, duty = mo.z;
  float u = (phi - mo.x * uDiskTime) / TAU * n + g.z * abs(rho - rm) / hw;   // chevron skew
  float id = floor(u);
  float f = u - id;
  idm = mod(id, n);
  float arc = TAU * rho / n;
  float dIn = f <= duty ? min(f, duty - f) * arc : -min(f - duty, 1.0 - f) * arc;
  float dR = min(rho - g.x, g.y - rho);
  sd = min(dIn, dR);
  float present = step(0.13, hash13(vec3(idm, float(ri) * 7.0, 3.0)));     // knocked-out segments
  float cover = smoothstep(-fw, fw, sd) * present;
  // light up inside-out during activation
  return cover * smoothstep(uDiskReveal + 0.4, uDiskReveal - 0.4, rho) * uDisk;
}

// neon shading of a ring hit: dim saturated fill, hot pulsing outline, travelling pulses,
// occasional segment blow-outs, and a power-on front during activation
vec3 ringShade(int ri, float rho, float phi, float sd, float idm, float fw) {
  float fri = float(ri);
  vec3 rc = ringColor(ri, rho);
  float ew = 0.07 + fw;
  float edge = 1.0 - smoothstep(0.0, ew, sd);
  float beat = 0.78 + 0.22 * sin(uTime * 4.2 + fri * 1.7);                  // pulsating outline
  float pulse = ringPulse(phi, rho, RING_MOT[ri].w, fri);
  float fk = floor(uTime * 1.7);
  float boom = step(0.972, hash13(vec3(idm, fri, fk))) * exp(-fract(uTime * 1.7) * 3.5);
  float front = exp(-pow((rho - uDiskReveal) / 0.6, 2.0)) * step(uDiskReveal, RING_MAX + 1.0);

  vec3 e = rc * (0.20 + 0.08 * uFlux)
         + mix(rc, vec3(1.0), 0.12) * edge * 1.5 * beat
         + mix(rc, vec3(1.0), 0.4) * pulse * 1.6
         + vec3(1.0, 0.55, 0.15) * boom * 3.5
         + mix(rc, vec3(1.0), 0.45) * front * 1.1;
  if (uModeW.z > 0.001) {                                                   // gravimetric: wireframe + isotherms
    float iso = 1.0 - smoothstep(0.03, 0.03 + fw, abs(fract(rho * 0.5) - 0.5));
    e = mix(e, e * 0.3 + vec3(0.15, 0.85, 1.0) * (iso * 1.6 + edge * 0.7), uModeW.z);
  }
  return e * uDiskEnergy;
}

// thin rails + pulses on the mid-plane, visible through the segment gaps
vec3 railSample(vec3 q, float fw) {
  float rho = length(q.xz);
  int ri = ringAt(rho, fw);
  if (ri < 0) return vec3(0.0);
  vec4 g = RING_GEO[ri];
  float rm = 0.5 * (g.x + g.y);
  float lw = 0.03;
  float l = (1.0 - smoothstep(lw, lw + fw, abs(rho - g.x - 0.04)))
          + (1.0 - smoothstep(lw, lw + fw, abs(g.y - 0.04 - rho)))
          + (1.0 - smoothstep(lw * 1.4, lw * 1.4 + fw, abs(rho - rm))) * 1.4;
  float phi = atan(q.z, q.x);
  float pulse = ringPulse(phi, rho, RING_MOT[ri].w, float(ri));
  float reveal = smoothstep(uDiskReveal + 0.4, uDiskReveal - 0.4, rho) * uDisk;
  vec3 rc = ringColor(ri, rho);
  return (rc * 0.55 + mix(rc, vec3(1.0), 0.4) * pulse * 2.2) * l * reveal * uDiskEnergy;
}

// Does this straight march segment cross the ring slab |y| < DISK_H over the ring radii?
// Returns the entry/exit params (t0, t1), or t1 <= t0 for a miss. Cheap: runs every step.
vec2 slabHit(vec3 p, vec3 vn, float len) {
  float t0, t1;
  if (abs(vn.y) < 1e-5) {
    if (abs(p.y) >= DISK_H) return vec2(0.0, -1.0);
    t0 = 0.0; t1 = len;
  } else {
    float ta = (DISK_H - p.y) / vn.y, tb = (-DISK_H - p.y) / vn.y;
    t0 = max(min(ta, tb), 0.0); t1 = min(max(ta, tb), len);
  }
  if (t1 <= t0) return vec2(0.0, -1.0);
  vec3 qa = p + vn * t0, qb = p + vn * t1;
  vec2 dxz = qb.xz - qa.xz;
  float tcl = clamp(-dot(qa.xz, dxz) / max(dot(dxz, dxz), 1e-6), 0.0, 1.0);
  float rmin = min(min(length(qa.xz), length(qb.xz)), length(qa.xz + dxz * tcl));
  if (rmin > RING_MAX + 0.2 || max(length(qa.xz), length(qb.xz)) < RING_MIN - 0.2) return vec2(0.0, -1.0);
  return vec2(t0, t1);
}

// Shade one recorded slab crossing (runs after the march, front to back).
void diskSegment(vec3 p, vec3 vn, float t0, float t1, float travel, inout vec3 col, inout float trans) {
  float tm = abs(vn.y) > 1e-5 ? -p.y / vn.y : -1.0;   // mid-plane crossing
  bool railDone = !(tm >= t0 && tm <= t1);
  float ds = max(0.07, (t1 - t0) / 15.0);
  float t = t0 + 1e-4;
  float tPrev = -1.0;
  int ri; float rho, phi, sd, idm;
  for (int j = 0; j < 16; j++) {
    if (t > t1) break;
    if (!railDone && t >= tm) {
      col += trans * railSample(p + vn * tm, uPixelAngle * (travel + tm));
      railDone = true;
    }
    float cv = ringGeom(p + vn * t, uPixelAngle * (travel + t), ri, rho, phi, sd, idm);
    if (cv > 0.5 && tPrev >= 0.0) {
      // stepped from a gap into a segment: bisect to the exact wall so side faces stay crisp
      float lo = tPrev, hi = t;
      for (int k = 0; k < 4; k++) {
        float mid = 0.5 * (lo + hi);
        int r2; float a2, b2, c2, d2;
        if (ringGeom(p + vn * mid, uPixelAngle * (travel + mid), r2, a2, b2, c2, d2) > 0.5) hi = mid; else lo = mid;
      }
      t = hi;
      cv = ringGeom(p + vn * t, uPixelAngle * (travel + t), ri, rho, phi, sd, idm);
    }
    tPrev = cv > 0.5 ? -1.0 : t;
    if (cv > 0.0) {
      float a = 1.0 - exp(-60.0 * cv * ds);
      col += trans * ringShade(ri, rho, phi, sd, idm, uPixelAngle * (travel + t)) * a;
      trans *= 1.0 - a;
      if (trans < 0.02) return;
    }
    t += ds;
  }
  if (!railDone) col += trans * railSample(p + vn * tm, uPixelAngle * (travel + tm));
}

// ── laser-beam jets along ±Y, solved analytically per straight segment ─────
float chord(float d2, float R, float tc, float bb, float len) {
  if (d2 >= R * R) return 0.0;
  float h = sqrt((R * R - d2) / bb);
  return max(min(tc + h, len) - max(tc - h, 0.0), 0.0);
}

void jetStep(vec3 p, vec3 vn, float len, inout vec3 col, inout float trans) {
  vec2 a = p.xz, b = vn.xz;
  float bb = max(dot(b, b), 0.0025);
  float tc = -dot(a, b) / bb;                     // closest approach to the axis (unclamped)
  vec2 cxz = a + b * tc;
  float d2 = dot(cxz, cxz);
  if (d2 > 2.6) return;
  float sg = 0.9;                                  // outer glow sigma
  float sa = sg / sqrt(bb);
  float span = 0.5 * (erfa((len - tc) / sa) - erfa(-tc / sa));
  if (span < 1e-3 && (tc < -1.0 || tc > len + 1.0)) return;
  float tcl = clamp(tc, 0.0, len);
  float y = p.y + vn.y * tcl;
  float ay = abs(y), s = sign(y);
  float L = uJet * JET_LEN;
  if (ay < 1.1 || ay > L + 2.0) return;

  float band = pow(max(0.0, cos(TAU * (ay * 0.15 - uJetTime * 1.35))), 14.0);   // pulse collars
  float cyc = uJetTime * 0.12 + (s > 0.0 ? 0.0 : 0.47);
  float yo = fract(cyc) * (L + 14.0) - 4.0;
  float orange = exp(-pow((ay - yo) / 2.0, 2.0)) * step(0.45, hash13(vec3(floor(cyc), s, 1.0)));
  float lenF = (1.0 - smoothstep(L - 2.5, L, ay)) * smoothstep(1.3, 2.2, ay);
  float ign = smoothstep(2.4, 4.2, ay);              // tube + glow ignite outside the shadow
  float tip = exp(-pow((ay - L) / 1.2, 2.0)) * (1.0 - uJet) * step(0.02, uJet);
  float flick = 0.93 + 0.07 * sin(uTime * 47.0 + ay * 0.7);
  float I = uJetIntensity * flick;

  float Rc = 0.17 + 0.06 * band + 0.08 * orange;
  float Rs = 0.60 + 0.28 * band + 0.30 * orange + 0.004 * ay;
  vec3 cCore = mix(vec3(0.80, 0.98, 1.0), vec3(1.0, 0.86, 0.62), orange);
  vec3 cTube = mix(vec3(0.02, 0.45, 1.0), vec3(0.10, 0.95, 1.0), band);
  cTube = mix(cTube, vec3(1.0, 0.40, 0.04), orange);
  vec3 cGlow = mix(vec3(0.42, 0.12, 1.0), vec3(0.08, 0.32, 1.0), 0.5 + 0.5 * sin(ay * 0.25 - uJetTime * 2.0));
  if (uModeW.y > 0.001) { cTube = mix(cTube, vec3(1.0, 0.2, 0.75), uModeW.y * 0.7); cGlow = mix(cGlow, vec3(0.9, 0.1, 0.6), uModeW.y * 0.6); }

  float G = min(exp(-d2 / (sg * sg)) * sg * 1.7725 / sqrt(bb) * span, 6.0);
  col += trans * (cGlow * 0.07 * lenF * ign + cTube * tip * 0.4) * G * I;

  float cs = chord(d2, Rs, tc, bb, len);
  float as = (1.0 - exp(-3.5 * cs)) * lenF * (0.15 + 0.85 * ign);
  col += trans * cTube * (1.25 + 1.6 * band + 1.4 * orange) * as * I;
  trans *= 1.0 - 0.25 * as * min(I, 1.0);

  float cc = chord(d2, Rc, tc, bb, len);
  float ac = (1.0 - exp(-30.0 * cc)) * lenF;
  col += trans * cCore * 3.2 * ac * I * (0.35 + 0.65 * ign);
  trans *= 1.0 - ac * min(I, 1.0);
}

// ── arcade blasts: analytic volumes along the straight camera ray ─────────
// radial laser streaks shooting out from the centre (screen-space angle bins)
vec3 streaks(float ang, float b, float R, float seed, float px) {
  float N = 60.0;
  float x = ang / TAU * N + seed;
  float id = floor(x);
  float h1 = hash13(vec3(id, seed, 1.0)), h2 = hash13(vec3(id, seed, 2.0));
  if (h1 < 0.42) return vec3(0.0);
  float dist = abs(fract(x) - 0.5) * TAU / N * b;
  float wid = 0.04 + 0.06 * h2;
  float line = 1.0 - smoothstep(wid, wid + px, dist);
  float rA = R * (0.2 + 0.35 * h2), rB = R * (0.7 + 0.6 * h1);
  float along = smoothstep(rA, rA + 0.4, b) * (1.0 - smoothstep(rB - 0.3, rB, b));
  float head = 0.25 + 1.4 * smoothstep(rA, rB, b);
  vec3 c = h2 < 0.34 ? vec3(1.0, 0.45, 0.05) : (h2 < 0.67 ? vec3(0.1, 0.9, 1.0) : vec3(1.0, 0.15, 0.65));
  return c * line * along * head;
}

// thin starburst rays of constant world width
float spikes(float ang, float b, float N, float wid, float px) {
  float dist = abs(fract(ang / TAU * N) - 0.5) * TAU / N * b;
  return 1.0 - smoothstep(wid, wid + px, dist);
}

// a dashed neon circle in a plane through the centre
vec3 planeRing(vec3 pl, vec3 vl, vec3 N, float Rr, float wr, vec3 c, float nd, float ph) {
  float dn = dot(vl, N);
  if (abs(dn) < 1e-3) return vec3(0.0);
  float t = -dot(pl, N) / dn;
  if (t <= 0.0) return vec3(0.0);
  vec3 q = pl + vl * t;
  float r = length(q);
  float ring = exp(-pow((r - Rr) / wr, 2.0));
  vec3 bx = normalize(cross(N, abs(N.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  float a = atan(dot(q, cross(N, bx)), dot(q, bx));
  float dash = 0.25 + 0.75 * step(0.32, fract(a / TAU * nd + ph));
  float graze = smoothstep(0.06, 0.3, abs(dn));
  return c * ring * dash * graze / max(abs(dn), 0.45);
}

vec3 explosion(vec3 p0, vec3 v0) {
  vec3 c = vec3(0.0);
  float tca = -dot(p0, v0);
  if (tca <= 0.0) return c;
  vec3 cx = cross(p0, v0);
  float b2 = dot(cx, cx);
  float b = sqrt(b2);
  vec3 hit = p0 + v0 * tca;
  float ang = screenAngle(hit);
  float px = uPixelAngle * tca;

  // energy core: white-hot centre, solid cyan orb, hot-pink rim, starburst spikes
  if (uCoreGlow > 0.0) {
    float R = uCoreR;
    float centre = exp(-b2 / (R * R * 0.12));
    float solid = 1.0 - smoothstep(R * 0.9, R, b);
    float rim = exp(-pow((b - R) / (0.04 + 0.05 * R), 2.0));
    float halo = exp(-b / (R * 0.9));
    float sp = spikes(ang + uTime * 0.4, b, 8.0, 0.025 + 0.02 * R, px)
             + 0.6 * spikes(-ang + uTime * 0.25 + 0.2, b, 12.0, 0.018 + 0.012 * R, px);
    sp *= exp(-b / (R * 1.8)) * smoothstep(R * 0.6, R * 1.0, b);
    float fill = 1.0 - smoothstep(0.6, 1.6, R);            // solid orb → hollow ring as it expands
    c += (vec3(1.0) * centre * 2.4
        + vec3(0.08, 0.72, 1.0) * solid * 0.85 * fill
        + vec3(1.0, 0.18, 0.72) * rim * 2.6
        + vec3(0.30, 0.25, 1.0) * halo * 0.12 * (0.3 + 0.7 * fill)
        + vec3(0.65, 0.92, 1.0) * sp * 1.5) * uCoreGlow;
  }
  // detonation: dashed shockwave circles, oblique plane rings, radial laser streaks
  if (uShockA > 0.001) {
    float w1 = 0.12 + uShockR * 0.01;
    float s1 = exp(-pow((b - uShockR) / w1, 2.0)) + 0.25 * exp(-pow((b - uShockR * 0.95) / (w1 * 3.0), 2.0));
    float s2 = exp(-pow((b - uShockR * 0.66) / (w1 * 0.8), 2.0));
    float d1 = 0.25 + 0.75 * dashes(ang, 28.0, 0.3, uShockR * 0.04);
    float d2 = 0.25 + 0.75 * dashes(ang, 18.0, 0.4, -uShockR * 0.05);
    c += s1 * vec3(0.12, 0.85, 1.0) * d1 * uShockA * 1.6;
    c += s2 * vec3(1.0, 0.42, 0.05) * d2 * uShockA * 1.4;
    vec3 pl = uSysInv * p0, vl = uSysInv * v0;
    float wr = 0.16 + uShockR * 0.012;
    c += planeRing(pl, vl, vec3(0.0, 1.0, 0.0), uShockR * 1.12, wr, vec3(0.1, 0.9, 1.0), 24.0, uShockR * 0.03) * uShockA * 0.9;
    c += planeRing(pl, vl, normalize(vec3(0.0, 0.62, 0.78)), uShockR * 0.82, wr, vec3(1.0, 0.12, 0.62), 16.0, 0.0) * uShockA * 0.8;
    c += planeRing(pl, vl, normalize(vec3(0.7, 0.55, -0.45)), uShockR * 0.7, wr, vec3(0.6, 0.18, 1.0), 12.0, 0.3) * uShockA * 0.8;
    c += streaks(ang, b, uShockR * 1.05, 0.0, px) * uShockA * uShockA * 1.6;
  }
  // phase 3: a dashed, spinning shell collapsing into the forming horizon
  if (uCollapseGlow > 0.001) {
    float Rc = mix(6.0, 1.05, uCollapse);
    float sc = exp(-pow((b - Rc) / (0.1 + 0.03 * Rc), 2.0)) * 2.2;
    float dsh = 0.25 + 0.75 * dashes(ang + uTime * 2.2, 20.0, 0.35, 0.0);
    c += sc * mix(vec3(0.62, 0.18, 1.0), vec3(0.1, 0.9, 1.0), uCollapse) * dsh * uCollapseGlow * 0.2;
    c += vec3(0.4, 0.75, 1.0) * exp(-b2 / (Rc * Rc * 0.15)) * uCollapseGlow * (1.0 - uHorizon) * 0.6;
  }
  return c;
}

// periodic active-phase burst: twin dashed rings in the disk plane + a spray of streaks
vec3 burst(vec3 p0, vec3 v0) {
  if (uBurstA < 0.002) return vec3(0.0);
  vec3 pl = uSysInv * p0, vl = uSysInv * v0;
  vec3 N = vec3(0.0, 1.0, 0.0);
  float wr = 0.14 + uBurstR * 0.01;
  vec3 c = planeRing(pl, vl, N, uBurstR, wr, vec3(1.0, 0.45, 0.06), 30.0, uBurstR * 0.02) * 1.1
         + planeRing(pl, vl, N, uBurstR * 0.84, wr * 0.8, vec3(0.1, 0.9, 1.0), 40.0, -uBurstR * 0.03) * 0.8;
  float tca = -dot(p0, v0);
  if (tca > 0.0) {
    vec3 cx = cross(p0, v0);
    float b = length(cx);
    c += streaks(screenAngle(p0 + v0 * tca), b, uBurstR * 0.8, floor(uTime / 7.0) * 3.1 + 11.0, uPixelAngle * tca) * uBurstA;
  }
  return c * uBurstA;
}

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec4 vp = uProjInv * vec4(ndc, 1.0, 1.0);
  vp /= vp.w;
  vec3 rd = normalize((uCamWorld * vec4(vp.xyz, 0.0)).xyz);
  vec3 ro = uCamPos;

  vec3 col = vec3(0.0);
  float trans = 1.0;

  // march in the quasar's local frame
  vec3 p = uSysInv * ro;
  vec3 v = uSysInv * rd;
  float rh = max(uHorizon, 0.0);
  float RB = 75.0;
  float bb = dot(p, v);
  float cc = dot(p, p) - RB * RB;
  float disc = bb * bb - cc;
  bool captured = false;
  bool media = uDisk > 0.001 || uJet > 0.001 || rh > 0.001;
  float minR = 1e9;
  // The march stays lean: it only bends the ray, adds the (analytic) jets, and records where
  // the ray crosses the ring slab. Rings are shaded afterwards and composited front to back
  // with the jet light gathered between crossings ("bins") and the sky behind.
  vec3 bins[4];
  bins[0] = vec3(0.0); bins[1] = vec3(0.0); bins[2] = vec3(0.0); bins[3] = vec3(0.0);
  vec3 cP[3]; vec3 cV[3]; vec3 cT[3];   // crossing: start point, direction, (t0, t1, travel)
  int nc = 0;

  if (disc > 0.0 && media) {
    float travel = max(0.0, -bb - sqrt(disc));
    p += v * travel;
    vec3 hv = cross(p, v);
    float h2 = dot(hv, hv);
    for (int i = 0; i < 260; i++) {
      if (float(i) >= uSteps) break;
      float r = length(p);
      minR = min(minR, r);
      if (rh > 0.001 && r < rh) { captured = true; break; }
      if (r > RB + 1.0 && dot(p, v) > 0.0) break;

      // step size only needs to resolve the bending now: ring and jet hits are exact per segment
      float dt = 0.10 * r;
      if (rh > 0.001) dt = min(dt, max(r - rh, 0.02) * 0.5 + 0.02);
      dt = clamp(dt, 0.02, 3.0);

      // bend the ray: d²x/dλ² = -1.5 h² x rs / r⁵ (semi-implicit: the segment uses the new v)
      v += (-1.5 * h2 * p * rh / pow(r, 5.0)) * dt;
      float sp = length(v);
      vec3 vn = v / sp;
      float len = dt * sp;
      if (uJet > 0.001) {
        vec3 jc = vec3(0.0);
        jetStep(p, vn, len, jc, trans);
        bins[nc] += jc;
      }
      if (uDisk > 0.001 && nc < 3) {
        vec2 iv = slabHit(p, vn, len);
        if (iv.y > iv.x) { cP[nc] = p; cV[nc] = vn; cT[nc] = vec3(iv, travel); nc++; }
      }
      if (trans < 0.02) break;
      p += v * dt;
      travel += len;
    }
  }

  vec3 tail = vec3(0.0);
  if (!captured) {
    vec3 vl = normalize(v);
    tail += background(normalize(uSys * vl), vl);
    // razor-sharp neon photon ring hugging the shadow + a dashed counter-rotating outer ring
    if (rh > 0.001 && minR < 1e8) {
      float x = max(minR - 1.5 * rh, 0.0) / rh;
      float a = screenAngle(rd);
      float rim = exp(-x / 0.16) + 0.3 * exp(-x / 0.5);
      float outer = exp(-pow((x - 1.1) / 0.07, 2.0)) * (0.2 + 0.8 * dashes(a, 40.0, 0.45, -uTime * 0.15));
      float beat = 0.85 + 0.15 * sin(uTime * 3.0) + 0.8 * uBurstA;
      tail += (vec3(0.55, 0.95, 1.0) * rim * 1.7 + vec3(1.0, 0.12, 0.65) * outer * 0.9) * beat * rh;
    }
  }
  bins[nc] += trans * tail;
  // composite: jet light / ring crossings / sky, front to back
  float tDisk = 1.0;
  for (int k = 0; k < 4; k++) {
    if (k > nc) break;
    col += tDisk * bins[k];
    if (k < nc && tDisk > 0.02) diskSegment(cP[k], cV[k], cT[k].x, cT[k].y, cT[k].z, col, tDisk);
  }
  trans *= tDisk;
  // the explosion happens before the horizon exists, so straight rays are accurate enough
  col += explosion(ro, rd) * (captured ? 0.25 : 1.0);
  if (!captured) col += burst(ro, rd) * (0.4 + 0.6 * trans);

  // spectral mode: push everything through a false-colour ramp keyed on luminance
  if (uModeW.y > 0.001) {
    float l = dot(col, vec3(0.3, 0.5, 0.2));
    vec3 ramp = mix(vec3(0.0), vec3(0.9, 0.15, 0.85), smoothstep(0.0, 0.4, l));
    ramp = mix(ramp, vec3(0.2, 0.9, 1.0), smoothstep(0.4, 1.4, l));
    ramp = mix(ramp, vec3(1.0), smoothstep(1.4, 4.0, l));
    col = mix(col, ramp * (0.6 + 0.6 * l), uModeW.y * 0.5);
  }
  gl_FragColor = vec4(col, 1.0);
}
`;
