// Post chain: scene (HDR, optional MSAA) → bloom (half res) → tone mapping / sRGB → grade
// (vignette + film grain). The neon look lives on bloom: rims, rings, grid and label are HDR emissive.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uVignette: { value: 0.45 }, uGrain: { value: 0.025 }, uTime: { value: 0 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uVignette, uGrain, uTime; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 q = vUv - 0.5;
      c.rgb *= 1.0 - uVignette * smoothstep(0.25, 0.85, length(q * vec2(1.1, 1.0)));
      c.rgb += (hash(vUv * 1024.0 + fract(uTime) * 97.0) - 0.5) * uGrain;
      gl_FragColor = c;
    }`,
};

/** bloomScale < 1 runs the bloom mip chain at a lower resolution (phones). */
export function createPost(renderer, scene, camera, { samples = 4, bloomScale = 1 } = {}) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.9, 0.55, 0.7);
  if (bloomScale !== 1) {
    const setSize = bloom.setSize.bind(bloom);
    bloom.setSize = (w, h) => setSize(Math.max(1, Math.round(w * bloomScale)), Math.max(1, Math.round(h * bloomScale)));
  }
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  let strength = 0.9, boost = 1;
  return {
    composer,
    /** Momentary bloom multiplier (press flash). */
    setBloomBoost(k) {
      boost = k;
      bloom.strength = strength * boost;
    },
    apply(P) {
      strength = P.bloom.strength;
      bloom.strength = strength * boost;
      bloom.radius = P.bloom.radius;
      bloom.threshold = P.bloom.threshold;
      grade.uniforms.uVignette.value = P.grade.vignette;
      grade.uniforms.uGrain.value = P.grade.grain;
    },
    setSize(w, h, pr) {
      composer.setPixelRatio(pr);
      composer.setSize(w, h);
    },
    render(t) {
      grade.uniforms.uTime.value = t;
      composer.render();
    },
    dispose() {
      bloom.dispose();
      grade.material.dispose();
      composer.dispose();
      target.dispose();
    },
  };
}
