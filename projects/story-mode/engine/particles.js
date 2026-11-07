// Embers (rising sparks, warm, additive, HDR so they bloom) and dust motes (slow drift, lit by the
// book). Both are GPU-animated point sprites, depth-tested by hand against the scene depth texture
// and grown into soft bokeh discs when out of focus — they are drawn after the DoF pass.
import * as THREE from 'three';

const COMMON = /* glsl */ `
  uniform float uTime, uPR, uFocus, uAperture, uSize;
  uniform vec2 uRes;
  varying float vAlpha; varying vec3 vColor; varying float vViewZ; varying float vSoft;
  float hash(float n){ return fract(sin(n) * 43758.5453); }
  void finish(vec3 pos, float size, float alpha, vec3 color) {
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    float z = -mv.z;
    float px = size * uSize * (uRes.y / 900.0) * (3.0 / max(z, 0.1));   // uRes = drawing-buffer px
    float coc = abs(z - uFocus) / max(z, 0.05) * uAperture * 18.0 * uPR;
    float grown = max(px, coc);
    vAlpha = alpha * clamp((px * px) / (grown * grown), 0.04, 1.0);   // same energy, bigger disc
    vSoft = clamp(coc / max(grown, 1.0), 0.0, 1.0);
    gl_PointSize = clamp(grown, 1.0, 64.0);
    vColor = color; vViewZ = z;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D tDepth; uniform float uNear, uFar, uHasDepth; uniform vec2 uRes;
  varying float vAlpha; varying vec3 vColor; varying float vViewZ; varying float vSoft;
  float viewDepth(float d) { return (uNear * uFar) / ((uFar - uNear) * d - uFar) * -1.0; }
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c) * 2.0;
    float core = mix(exp(-r * r * 4.5), smoothstep(1.0, 0.75, r), vSoft);
    float a = vAlpha * core;
    if (uHasDepth > 0.5) {
      float scene = viewDepth(texture2D(tDepth, gl_FragCoord.xy / uRes).r);
      a *= smoothstep(0.0, 0.12, scene - vViewZ);            // soft occlusion by geometry
    }
    if (a < 0.002) discard;
    gl_FragColor = vec4(vColor * a, a);
  }
`;

function material(vertexMain, extraUniforms, blending) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uPR: { value: 1 }, uRes: { value: new THREE.Vector2(1, 1) },
      uFocus: { value: 3 }, uAperture: { value: 1 }, uSize: { value: 1 },
      tDepth: { value: null }, uNear: { value: 0.1 }, uFar: { value: 50 }, uHasDepth: { value: 0 },
      ...extraUniforms,
    },
    vertexShader: COMMON + vertexMain,
    fragmentShader: FRAG,
    transparent: true, depthTest: false, depthWrite: false,
    blending,
  });
}

function seeds(count, dims = 4) {
  const a = new Float32Array(count * dims);
  for (let i = 0; i < a.length; i++) a[i] = Math.random();
  return a;
}

/**
 * Sparks: a small CPU-simulated pool for bursts (book unlock) and trails (page turns).
 * @param {THREE.Scene} overlay
 */
export function createSparks(overlay, max = 360) {
  const pos = new Float32Array(max * 3), vel = new Float32Array(max * 3);
  const life = new Float32Array(max), size = new Float32Array(max), heat = new Float32Array(max), rate = new Float32Array(max);
  const g = new THREE.BufferGeometry();
  const aPos = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const aLife = new THREE.BufferAttribute(life, 1).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', aPos);
  g.setAttribute('aLife', aLife);
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aHeat', new THREE.BufferAttribute(heat, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = material(/* glsl */ `
    attribute float aLife; attribute float aSize; attribute float aHeat;
    void main() {
      float k = aLife;
      vec3 col = mix(vec3(1.4, 0.38, 0.08), vec3(4.2, 2.7, 1.25), clamp(aHeat * k * 1.3, 0.0, 1.0));
      finish(position, aSize, k > 0.0 ? smoothstep(0.0, 0.35, k) : 0.0, col);
    }`, {}, THREE.AdditiveBlending);
  const points = new THREE.Points(g, mat);
  points.frustumCulled = false;
  overlay.add(points);
  let next = 0, alive = 0;

  return {
    material: mat,
    /** Emit `count` sparks at `origin`. */
    emit(origin, count, { speed = 1.2, up = 0.8, spread = 1, lifeTime = 1.2, sizeMul = 1, dir = null } = {}) {
      for (let c = 0; c < count; c++) {
        const i = next; next = (next + 1) % max;
        const th = Math.random() * Math.PI * 2, ph = Math.acos(1 - 2 * Math.random());
        const sp = speed * (0.35 + Math.random() * 0.65);
        let vx = Math.sin(ph) * Math.cos(th) * spread, vy = Math.abs(Math.cos(ph)) * 0.6 + up, vz = Math.sin(ph) * Math.sin(th) * spread;
        if (dir) { vx = vx * 0.35 + dir.x; vy = vy * 0.35 + dir.y; vz = vz * 0.35 + dir.z; }
        pos[i * 3] = origin.x; pos[i * 3 + 1] = origin.y; pos[i * 3 + 2] = origin.z;
        vel[i * 3] = vx * sp; vel[i * 3 + 1] = vy * sp; vel[i * 3 + 2] = vz * sp;
        life[i] = 1; rate[i] = 1 / (lifeTime * (0.6 + Math.random() * 0.8));
        size[i] = (1.2 + Math.random() * 2.2) * sizeMul; heat[i] = 0.6 + Math.random() * 0.4;
      }
      alive = max;
      g.attributes.aSize.needsUpdate = true; g.attributes.aHeat.needsUpdate = true;
    },
    update(dt) {
      if (!alive) return;
      let any = 0;
      const drag = Math.exp(-dt * 1.8);
      for (let i = 0; i < max; i++) {
        if (life[i] <= 0) continue;
        any++;
        life[i] = Math.max(0, life[i] - dt * rate[i]);
        vel[i * 3 + 1] -= 0.75 * dt;
        vel[i * 3] *= drag; vel[i * 3 + 1] *= drag; vel[i * 3 + 2] *= drag;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      }
      alive = any;
      aPos.needsUpdate = true; aLife.needsUpdate = true;
    },
  };
}

/**
 * @param {THREE.Scene} overlay  scene drawn by the post chain's overlay pass
 * @param {{ embers: number, dust: number, calm: boolean }} opts
 */
export function createParticles(overlay, { embers = 150, dust = 280, calm = false } = {}) {
  const book = new THREE.Vector3(0, 1, 0);

  // ---------------- embers
  const eg = new THREE.BufferGeometry();
  eg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(embers * 3), 3));
  eg.setAttribute('aSeed', new THREE.BufferAttribute(seeds(embers), 4));
  const emberMat = material(/* glsl */ `
    attribute vec4 aSeed;
    uniform vec3 uBook; uniform float uSpeed, uCalm;
    void main() {
      float id = aSeed.x * 97.0;
      float life = 5.0 + aSeed.y * 6.0;
      float t = uTime * uSpeed * mix(1.0, 0.25, uCalm) + aSeed.z * life;
      float k = mod(t, life) / life;                       // 0 → 1 over one rise
      float cycle = floor(t / life);
      // half rise from the book, the rest from anywhere across the stage (all depth layers)
      float fromBook = step(0.45, hash(id + cycle * 1.7));
      float ang = hash(id + cycle * 3.1) * 6.2831;
      float rad = mix(0.15 + hash(id * 1.3 + cycle) * 0.35, 0.4 + hash(id * 2.1 + cycle) * 2.6, fromBook);
      vec3 start = vec3(cos(ang) * rad, mix(uBook.y - 0.05, 0.05, fromBook), sin(ang) * rad * 1.3 - 0.4 * fromBook);
      start.xz += uBook.xz * (1.0 - fromBook);
      float rise = mix(0.9, 1.7, aSeed.w) * k;
      vec3 p = start + vec3(sin(t * 0.9 + id) * 0.18 * k, rise, cos(t * 0.7 + id * 1.7) * 0.12 * k);
      float flick = 0.6 + 0.4 * sin(uTime * (7.0 + aSeed.w * 9.0) + id);
      float alpha = smoothstep(0.0, 0.08, k) * (1.0 - smoothstep(0.55, 1.0, k)) * flick;
      vec3 col = mix(vec3(2.4, 0.8, 0.16), vec3(1.1, 0.22, 0.05), k);    // hot orange → dull red (HDR)
      finish(p, 2.2 + aSeed.w * 2.0, alpha, col);
    }`, { uBook: { value: book }, uSpeed: { value: 1 }, uCalm: { value: calm ? 1 : 0 } }, THREE.AdditiveBlending);
  const emberPoints = new THREE.Points(eg, emberMat);
  emberPoints.frustumCulled = false;

  // ---------------- dust motes
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(dust * 3), 3));
  dg.setAttribute('aSeed', new THREE.BufferAttribute(seeds(dust), 4));
  const dustMat = material(/* glsl */ `
    attribute vec4 aSeed;
    uniform vec3 uBook; uniform float uCalm;
    void main() {
      float id = aSeed.x * 131.0;
      vec3 base = vec3(aSeed.x * 3.6 - 1.8, 0.1 + aSeed.y * 2.3, aSeed.z * 3.2 - 2.2);
      float s = uTime * mix(0.12, 0.03, uCalm);
      vec3 p = base + vec3(sin(s * 1.3 + id) * 0.22, sin(s * 0.9 + id * 1.7) * 0.15, cos(s * 1.1 + id * 0.6) * 0.22);
      float d = distance(p, uBook);
      float lit = 0.08 + 1.6 * exp(-d * d * 1.4);              // motes catch the book light
      float tw = 0.7 + 0.3 * sin(uTime * (1.0 + aSeed.w * 2.0) + id);
      finish(p, 0.9 + aSeed.w * 1.1, 0.55 * tw, vec3(1.0, 0.82, 0.6) * lit);
    }`, { uBook: { value: book }, uCalm: { value: calm ? 1 : 0 } }, THREE.AdditiveBlending);
  const dustPoints = new THREE.Points(dg, dustMat);
  dustPoints.frustumCulled = false;

  overlay.add(emberPoints, dustPoints);
  const sparks = createSparks(overlay);
  const mats = [emberMat, dustMat, sparks.material];

  return {
    book,
    sparks,
    update(time, { focus, aperture, near, far, res, pr }) {
      for (const m of mats) {
        const u = m.uniforms;
        u.uTime.value = time; u.uFocus.value = focus; u.uAperture.value = aperture;
        u.uNear.value = near; u.uFar.value = far; u.uRes.value.copy(res); u.uPR.value = pr;
      }
    },
    /** Called by the post chain right before the particles are drawn. */
    setDepth(depthTexture) {
      for (const m of mats) {
        m.uniforms.tDepth.value = depthTexture ?? null;
        m.uniforms.uHasDepth.value = depthTexture ? 1 : 0;
      }
    },
    setLook({ embers: ne, dust: nd, emberSize, dustSize, emberSpeed }) {
      eg.setDrawRange(0, Math.min(embers, Math.round(ne)));
      dg.setDrawRange(0, Math.min(dust, Math.round(nd)));
      emberMat.uniforms.uSize.value = emberSize;
      emberMat.uniforms.uSpeed.value = emberSpeed;
      dustMat.uniforms.uSize.value = dustSize;
    },
    max: { embers, dust },
  };
}
