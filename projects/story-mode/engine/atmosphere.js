// Atmosphere: drifting ground-mist layers (flat noise cards just above the ground, so they never
// cut through it), two far fog curtains, and a small dark-warm environment map so the brass and
// leather pick up some sheen without lighting the scene flat.
import * as THREE from 'three';

const NOISE = /* glsl */ `
  float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
`;

export function createMist(scene) {
  const uniforms = {
    uTime: { value: 0 }, uOpacity: { value: 0.3 }, uColor: { value: new THREE.Color('#3a3a52') },
    uWarm: { value: new THREE.Color('#ffab5e') }, uBook: { value: new THREE.Vector3(0, 1, 0) },
    fogColor: { value: new THREE.Color() }, fogDensity: { value: 0.1 },
  };
  const mat = (seed, curtain) => new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uSeed: { value: seed }, uCurtain: { value: curtain ? 1 : 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vWorld; varying float vDepth;
      void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz;
        vec4 mv = viewMatrix * w; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uOpacity, uSeed, uCurtain, fogDensity; uniform vec3 uColor, uWarm, uBook, fogColor;
      varying vec2 vUv; varying vec3 vWorld; varying float vDepth;
      ${NOISE}
      void main(){
        vec2 p = vWorld.xz * 0.55 + vec2(uTime * 0.035, uTime * 0.012) + uSeed * 7.0;
        if (uCurtain > 0.5) p = vec2(vWorld.x * 0.35 + uTime * 0.02, vWorld.y * 0.9) + uSeed * 5.0;
        float n = fbm(p) * 0.7 + fbm(p * 2.7 - uTime * 0.02) * 0.45;
        float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x) * smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
        float a = smoothstep(0.35, 0.95, n) * edge * uOpacity;
        a *= smoothstep(0.25, 1.4, vDepth);                       // never in the lens
        // keep the stage itself clear: mist gathers around the edges and in the background
        if (uCurtain < 0.5) a *= mix(0.15, 1.0, smoothstep(0.9, 2.3, distance(vWorld.xz, uBook.xz)));
        float glow = exp(-pow(distance(vWorld, uBook) * 0.75, 2.0));
        vec3 col = uColor + uWarm * glow * 0.35;
        float f = 1.0 - exp(-pow(fogDensity * vDepth, 2.0));
        gl_FragColor = vec4(mix(col, fogColor, f * 0.6) * a, a);
      }`,
    transparent: true, depthWrite: false, premultipliedAlpha: true, blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const group = new THREE.Group();
  group.name = 'mist';
  const layers = [[0.03, 0], [0.09, 1], [0.17, 2], [0.28, 3]];
  const mats = [];
  for (const [y, s] of layers) {
    const m = mat(s, false); mats.push(m);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(14, 11), m);
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(0, y, -1.5);
    mesh.renderOrder = 10 + s;
    group.add(mesh);
  }
  for (const [z, w, hgt, s] of [[-3.6, 12, 3.2, 4], [-5.2, 16, 4.5, 5]]) {
    const m = mat(s, true); mats.push(m);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), m);
    mesh.position.set(0, hgt * 0.42, z);
    mesh.renderOrder = 5;
    group.add(mesh);
  }
  scene.add(group);
  return {
    group,
    update(t, look, fog, book) {
      for (const m of mats) {
        const u = m.uniforms;
        u.uTime.value = t; u.uOpacity.value = look.layers; u.uColor.value.set(look.layerColor);
        u.fogColor.value.copy(fog.color); u.fogDensity.value = fog.density; u.uBook.value.copy(book);
      }
    },
  };
}

/** Tiny PMREM environment: dark violet sky, warm low glow (the book), cool rim from behind. */
export function createEnvironment(renderer) {
  const s = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vP; void main(){
      vec3 top = vec3(0.03, 0.035, 0.07), hor = vec3(0.09, 0.06, 0.06), bot = vec3(0.02, 0.012, 0.01);
      vec3 c = vP.y > 0.0 ? mix(hor, top, pow(vP.y, 0.6)) : mix(hor, bot, pow(-vP.y, 0.5));
      gl_FragColor = vec4(c, 1.0); }`,
  }));
  s.add(sky);
  const blob = (color, pos, r) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 8), new THREE.MeshBasicMaterial({ color }));
    m.position.copy(pos); s.add(m);
  };
  blob(new THREE.Color(3.0, 1.6, 0.7), new THREE.Vector3(0, 0.5, 3), 1.2);    // warm, in front (book side)
  blob(new THREE.Color(0.5, 0.7, 1.6), new THREE.Vector3(-3, 3, -5), 1.5);   // cool rim
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(s, 0.04).texture;
  pmrem.dispose();
  s.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  return tex;
}
