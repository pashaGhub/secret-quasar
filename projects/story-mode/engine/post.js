// Post chain: scene (HDR + depth) → depth of field → particles (depth-tested by hand, after DoF so
// they carry their own bokeh) → bloom (half res) → tone mapping / sRGB → grade (vignette, warmth, grain).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const DEPTH_GLSL = /* glsl */ `
  uniform float uNear, uFar;
  float viewDepth(float d) {               // perspective depth buffer → positive view distance
    return (uNear * uFar) / ((uFar - uNear) * d - uFar) * -1.0;
  }
`;

/** Gather depth of field driven by the scene depth texture. */
class DofPass extends Pass {
  constructor(camera) {
    super();
    this.camera = camera;
    this.uniforms = {
      tColor: { value: null }, tDepth: { value: null },
      uNear: { value: camera.near }, uFar: { value: camera.far },
      uFocus: { value: 3 }, uAperture: { value: 1 }, uMaxBlur: { value: 6 }, uRange: { value: 0.3 },
      uTexel: { value: new THREE.Vector2() }, uPR: { value: 1 },
    };
    this.quad = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tColor, tDepth; uniform float uFocus, uAperture, uMaxBlur, uRange, uPR; uniform vec2 uTexel;
        varying vec2 vUv;
        ${DEPTH_GLSL}
        float coc(float z) {                // circle of confusion radius in drawing-buffer pixels
          float d = max(0.0, abs(z - uFocus) - uRange);
          return clamp(d / max(z, 0.05) * uAperture * 18.0, 0.0, uMaxBlur) * uPR;
        }
        void main() {
          float zc = viewDepth(texture2D(tDepth, vUv).r);
          float cc = coc(zc);
          vec4 base = texture2D(tColor, vUv);
          if (uMaxBlur < 0.5) { gl_FragColor = base; return; }
          vec3 acc = base.rgb; float wsum = 1.0;
          const int N = 28;
          float maxR = uMaxBlur * uPR;
          for (int i = 0; i < N; i++) {
            float fi = float(i) + 0.5;
            float r = sqrt(fi / float(N)) * maxR;
            float a = fi * 2.39996;
            vec2 uv = vUv + vec2(cos(a), sin(a)) * r * uTexel;
            float zt = viewDepth(texture2D(tDepth, uv).r);
            float ct = coc(zt);
            // nearer taps may spill over us by their own blur; farther ones only within our blur
            float reach = zt < zc ? ct : min(ct, cc);
            float w = smoothstep(r - 1.0, r + 0.5, reach);
            acc += texture2D(tColor, uv).rgb * w; wsum += w;
          }
          gl_FragColor = vec4(acc / wsum, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    }));
  }
  setSize(w, h) { this.uniforms.uTexel.value.set(1 / w, 1 / h); }
  render(renderer, writeBuffer, readBuffer) {
    this.uniforms.tColor.value = readBuffer.texture;
    this.uniforms.tDepth.value = readBuffer.depthTexture;
    this.uniforms.uNear.value = this.camera.near;
    this.uniforms.uFar.value = this.camera.far;
    this.sceneDepth = readBuffer.depthTexture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
  dispose() { this.quad.dispose(); this.quad.material.dispose(); }
}

/** Draws a second scene (particles) on top of the current buffer without clearing. */
class OverlayPass extends Pass {
  constructor(scene, camera, dof) {
    super();
    this.scene = scene; this.camera = camera; this.dof = dof;
    this.needsSwap = false;
  }
  render(renderer, writeBuffer, readBuffer) {
    const auto = renderer.autoClear;
    renderer.autoClear = false;
    this.beforeRender?.(this.dof.sceneDepth);
    renderer.setRenderTarget(readBuffer);
    renderer.render(this.scene, this.camera);
    renderer.autoClear = auto;
  }
}

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
    uVignette: { value: 0.6 }, uGrain: { value: 0.03 }, uWarmth: { value: 0.05 }, uLift: { value: 0.01 },
    uLiftColor: { value: new THREE.Color('#1a1426') },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime, uVignette, uGrain, uWarmth, uLift; uniform vec2 uRes; uniform vec3 uLiftColor;
    varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      // warm highlights, cool-violet shadows
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col *= mix(vec3(1.0 - uWarmth * 0.6, 1.0 - uWarmth * 0.2, 1.0 + uWarmth), vec3(1.0 + uWarmth, 1.0, 1.0 - uWarmth), smoothstep(0.05, 0.6, l));
      col += uLiftColor * uLift * 10.0 * (1.0 - l);
      vec2 c = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
      float r = length(c) / length(vec2(uRes.x / uRes.y, 1.0) * 0.5);
      col *= mix(1.0, 1.0 - uVignette, smoothstep(0.35, 1.05, r));
      col += (h(gl_FragCoord.xy + fract(uTime * 7.3) * 91.0) - 0.5) * uGrain;
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};

export function createPost(renderer, scene, overlayScene, camera, { samples = 4 } = {}) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples });
  rt.depthTexture = new THREE.DepthTexture(size.x, size.y);
  rt.depthTexture.type = THREE.UnsignedIntType;
  const composer = new EffectComposer(renderer, rt);
  // The composer clones `rt` for its second buffer, and a cloned DepthTexture shares the same GPU
  // texture (same Source). The particles sample the scene depth while drawing into the other buffer,
  // so each buffer needs its own depth texture — otherwise that's a feedback loop / stale depth.
  composer.renderTarget2.depthTexture = new THREE.DepthTexture(size.x, size.y);
  composer.renderTarget2.depthTexture.type = THREE.UnsignedIntType;
  const renderPass = new RenderPass(scene, camera);
  const dof = new DofPass(camera);
  const overlay = new OverlayPass(overlayScene, camera, dof);
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.8, 0.5, 0.9);
  const output = new OutputPass();
  const grade = new FullScreenQuadPass(GradeShader);
  composer.addPass(renderPass);
  composer.addPass(dof);
  composer.addPass(overlay);
  composer.addPass(bloom);
  composer.addPass(output);
  composer.addPass(grade);
  return {
    composer, dof, bloom, grade, overlay,
    setSize(w, h, pr) {
      composer.setPixelRatio(pr);
      composer.setSize(w, h);
      dof.uniforms.uPR.value = pr;
      grade.uniforms.uRes.value.set(w, h);
    },
    dispose() {
      dof.dispose(); grade.dispose(); bloom.dispose(); output.dispose?.();
      rt.depthTexture?.dispose();
      composer.renderTarget1.depthTexture?.dispose();
      composer.renderTarget2.depthTexture?.dispose();
      composer.dispose();
    },
  };
}

class FullScreenQuadPass extends Pass {
  constructor(shader) {
    super();
    this.uniforms = THREE.UniformsUtils.clone(shader.uniforms);
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: shader.vertexShader, fragmentShader: shader.fragmentShader,
      depthTest: false, depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.material);
  }
  render(renderer, writeBuffer, readBuffer) {
    this.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
  dispose() { this.material.dispose(); this.quad.dispose(); }
}
