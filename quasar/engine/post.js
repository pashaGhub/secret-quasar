// Post-processing: HDR bloom → tone mapping → "visor glass" (aberration, vignette,
// faint scanlines, grain, detonation flash, and a short glitch / RGB split on major bursts).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const VisorShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uFlash: { value: 0 },
    uGlitch: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime, uFlash, uGlitch; uniform vec2 uRes;
    varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      vec2 c = vUv - 0.5;
      float r2 = dot(c * vec2(uRes.x / uRes.y, 1.0), c * vec2(uRes.x / uRes.y, 1.0));
      vec2 ab = c * (0.0016 + 0.0035 * r2);
      // glitch: a few horizontal bands slip sideways, channels split apart
      vec2 split = vec2(0.0);
      if (uGlitch > 0.001) {
        float fr = floor(uTime * 24.0);
        float band = floor(uv.y * 26.0);
        float hb = h(vec2(band, fr));
        float on = step(1.0 - 0.45 * uGlitch, hb);
        uv.x += (h(vec2(fr, band + 3.0)) - 0.5) * 0.07 * uGlitch * on;
        split = vec2(0.006 + 0.01 * on, 0.0) * uGlitch;
      }
      vec3 col = vec3(texture2D(tDiffuse, uv + ab + split).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - ab - split).b);
      col *= mix(1.0, 0.42, smoothstep(0.15, 1.1, r2));                   // visor vignette
      col *= 0.985 + (0.015 + 0.06 * uGlitch) * sin(gl_FragCoord.y * 1.6 + uTime * 3.0); // scan structure
      col += (h(gl_FragCoord.xy + fract(uTime * 7.0) * 100.0) - 0.5) * 0.018; // sensor grain
      col += uFlash * vec3(0.72, 0.86, 1.0) * (1.0 - 0.4 * r2);               // detonation flash
      // faint curved glass reflection, top-left
      float g = smoothstep(0.9, 0.0, length((vUv - vec2(0.12, 0.95)) * vec2(1.0, 2.2)));
      col += vec3(0.03, 0.06, 0.09) * g * g;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export function createPost(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.5, 0.0, 0.88);
  // neon: weight the tight mips, starve the wide ones so the glow hugs the shapes and the
  // black core stays black (radius 0 → these factors are used as-is)
  bloom.compositeMaterial.uniforms.bloomFactors.value = [1.0, 0.62, 0.22, 0.05, 0.0];
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const visor = new ShaderPass(VisorShader);
  composer.addPass(visor);
  return {
    composer, bloom, visor,
    setSize(w, h, pr) {
      composer.setPixelRatio(pr);
      composer.setSize(w, h);
      visor.uniforms.uRes.value.set(w, h);
    },
  };
}
