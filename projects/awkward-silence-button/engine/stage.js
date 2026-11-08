// The stage: a dark metallic floor, a neon grid that fades into the dark (cyan near → violet far,
// like the hero's HUD lines) and a pink light pool under the button. The grid and pool are additive
// shader planes, so they cost one draw each and need no lights. A press sends a shockwave ring out
// across the grid (lines flare + a soft band), driven by two uniforms.
import * as THREE from 'three';

const GRID_FRAG = /* glsl */ `
  varying vec2 vP;
  uniform vec3 uNear, uFar, uWaveColor; uniform float uCell, uFade, uStrength, uWaveR, uWaveK, uWaveW;
  void main() {
    vec2 g = vP / uCell;
    vec2 f = abs(fract(g - 0.5) - 0.5) / fwidth(g);          // antialiased lines, 1px wide at any distance
    float line = 1.0 - min(min(f.x, f.y), 1.0);
    float d = length(vP * vec2(1.0, 1.3));
    float fade = smoothstep(uFade, 1.5, d);
    vec3 col = mix(uNear, uFar, smoothstep(1.5, uFade * 0.66, d));
    float wd = (length(vP) - uWaveR) / uWaveW;
    float band = exp(-wd * wd) * uWaveK;                     // shockwave ring
    vec3 c = col * 1.4 * line * fade * uStrength;
    c += uWaveColor * band * (0.35 + 2.2 * line) * smoothstep(uFade * 1.3, 1.0, length(vP));
    gl_FragColor = vec4(c, 1.0);
  }`;

const POOL_FRAG = /* glsl */ `
  varying vec2 vP;
  uniform vec3 uColor; uniform float uSize, uStrength;
  void main() {
    float d = length(vP) / uSize;
    float a = exp(-d * d * 3.0);
    gl_FragColor = vec4(uColor * a * uStrength, 1.0);
  }`;

const VERT = /* glsl */ `
  varying vec2 vP;
  void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export function createStage() {
  const group = new THREE.Group();
  group.name = 'asb_stage';

  const floorMat = new THREE.MeshStandardMaterial();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), floorMat);
  floor.rotation.x = -Math.PI / 2;

  const additive = (frag, uniforms) => new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: frag,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const gridU = {
    uNear: { value: new THREE.Color() }, uFar: { value: new THREE.Color() },
    uCell: { value: 0.6 }, uFade: { value: 9 }, uStrength: { value: 0.55 },
    uWaveColor: { value: new THREE.Color('#ff6ad5') }, uWaveR: { value: 0 }, uWaveK: { value: 0 }, uWaveW: { value: 0.22 },
  };
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), additive(GRID_FRAG, gridU));
  grid.rotation.x = -Math.PI / 2;
  grid.position.y = 0.003;

  const poolU = { uColor: { value: new THREE.Color() }, uSize: { value: 2.6 }, uStrength: { value: 0.5 } };
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), additive(POOL_FRAG, poolU));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.006;

  group.add(floor, grid, pool);

  return {
    group,
    apply(P) {
      const F = P.floor;
      floorMat.color.set(F.color);
      floorMat.metalness = F.metal;
      floorMat.roughness = F.rough;
      gridU.uNear.value.set(F.gridNear);
      gridU.uFar.value.set(F.gridFar);
      gridU.uCell.value = F.cell;
      gridU.uFade.value = F.fade;
      gridU.uStrength.value = F.grid;
      poolU.uColor.value.set(F.poolColor);
      poolU.uSize.value = F.poolSize;
      poolU.uStrength.value = F.pool;
    },
    /** Shockwave: radius (units) and strength (0 = none). */
    setWave(r, k, P) {
      gridU.uWaveR.value = r;
      gridU.uWaveK.value = k;
      gridU.uWaveW.value = P.press.waveWidth;
      gridU.uWaveColor.value.set(P.press.waveColor);
    },
    /** Pool brightness multiplier (the button's breathe / press flash). */
    setPool(k, P) { poolU.uStrength.value = P.floor.pool * k; },
  };
}
