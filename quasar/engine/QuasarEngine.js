// GPU visualization engine. Owns the WebGL2 canvas, the camera, the raymarched quasar,
// the particle systems and post-processing. It reads shared params from the bridge each
// frame and publishes telemetry back. It knows nothing about the HUD.
import * as THREE from 'three';
import { QUASAR_VERT, QUASAR_FRAG } from './shaders/quasar.glsl.js';
import { createParticles } from './particles.js';
import { createPost } from './post.js';
import { envelopes, phaseAt, phaseProgress, PHASES, T, burstAt, detonationGlitch, BURST_PERIOD } from '../timeline.js';
import { buildTelemetry } from './telemetry.js';
import { HORIZON_SCALE } from './rings.js';

const DEG = Math.PI / 180;

export class QuasarEngine {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ params: any, telemetry: any }} bridge
   * @param {{ inclination?: number, roll?: number, quality?: number, startTime?: number, calm?: boolean, onContextLost?: () => void }} opts
   */
  constructor(canvas, bridge, opts = {}) {
    this.bridge = bridge;
    this.canvas = canvas;
    this.calm = !!opts.calm; // reduced motion: no screen flash, no glitch / RGB split
    this.disposed = false;
    this.running = false;
    this.inclination = opts.inclination ?? 30; // degrees — disk seen 30° above its plane
    this.roll = opts.roll ?? -21; // degrees — tilt of the spin axis on screen
    this.simTime = opts.startTime ?? 0;
    this.diskTime = 0;
    this.jetTime = 0;
    this.modeW = new THREE.Vector3(1, 0, 0);
    this.pointer = new THREE.Vector2();
    this.pointerSmooth = new THREE.Vector2();
    this.lastRestart = bridge.params.get().restartToken;
    this.telemetryClock = 0;

    const mobile = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;
    this.maxPR = Math.min(devicePixelRatio || 1, mobile ? 1.0 : 1.5);
    this.pr = opts.quality ?? (mobile ? 0.7 : Math.min(this.maxPR, 1.0));
    this.fixedQuality = opts.quality != null;
    this.steps = mobile ? 110 : 170;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.toneMapping = THREE.NeutralToneMapping; // keeps neon hues saturated (ACES bleaches them)
    this.renderer.toneMappingExposure = 1.0;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 1000);

    // quasar orientation: one rotation shared by horizon, disk, jets and particles
    this.sys = new THREE.Matrix3();
    this.sysInv = new THREE.Matrix3();
    this.updateOrientation();

    this.uniforms = {
      uCamWorld: { value: new THREE.Matrix4() }, uProjInv: { value: new THREE.Matrix4() },
      uCamPos: { value: new THREE.Vector3() }, uSys: { value: this.sys }, uSysInv: { value: this.sysInv },
      uPixelAngle: { value: 0.001 }, uTime: { value: 0 }, uDiskTime: { value: 0 }, uJetTime: { value: 0 },
      uStarReveal: { value: 0 }, uHorizon: { value: 0 }, uDisk: { value: 0 }, uDiskReveal: { value: 0 },
      uDiskEnergy: { value: 1 }, uFlux: { value: 0 }, uJet: { value: 0 }, uJetIntensity: { value: 1 },
      uCoreR: { value: 0 }, uCoreGlow: { value: 0 }, uShockR: { value: 0 }, uShockA: { value: 0 },
      uCollapse: { value: 0 }, uCollapseGlow: { value: 0 }, uBurstR: { value: 0 }, uBurstA: { value: 0 },
      uModeW: { value: this.modeW },
      uSteps: { value: this.steps },
    };
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ vertexShader: QUASAR_VERT, fragmentShader: QUASAR_FRAG, uniforms: this.uniforms, depthTest: false, depthWrite: false }),
    );
    quad.frustumCulled = false;
    quad.renderOrder = -1;
    this.scene.add(quad);

    this.particles = createParticles(this.scene, { scale: mobile ? 0.5 : 1 });
    this.particles.uniforms.uSys.value = this.sys;

    this.post = createPost(this.renderer, this.scene, this.camera);

    this.onPointer = (e) => {
      this.pointer.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
    };
    addEventListener('pointermove', this.onPointer, { passive: true });
    this.onContextLost = (e) => { e.preventDefault(); this.lost = true; this.stop(); opts.onContextLost?.(); };
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();

    this.frameTimes = [];
    this.lastQualityChange = 0;
  }

  updateOrientation() {
    // Local frame: disk = XZ plane, spin axis = +Y. Tip the axis toward the camera so we see
    // the disk from `inclination` degrees above its plane, then roll it on screen.
    const m = new THREE.Matrix4()
      .makeRotationZ(this.roll * DEG)
      .multiply(new THREE.Matrix4().makeRotationX(this.inclination * DEG));
    this.sys.setFromMatrix4(m);
    this.sysInv.copy(this.sys).transpose();
  }

  resize() {
    const c = this.renderer.domElement;
    const w = c.clientWidth || innerWidth, h = c.clientHeight || innerHeight;
    this.width = w; this.height = h;
    this.renderer.setPixelRatio(this.pr);
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h, this.pr);
    this.camera.aspect = w / h;
    // keep the disk framed on any aspect: fix the vertical FOV on landscape, the horizontal on portrait
    const baseV = 38 * DEG;
    const minHalfW = Math.tan(baseV / 2) * 1.3;
    const halfV = this.camera.aspect >= 1.5 ? Math.tan(baseV / 2) : Math.max(Math.tan(baseV / 2), minHalfW / this.camera.aspect);
    this.camera.fov = (2 * Math.atan(halfV)) / DEG;
    this.camera.updateProjectionMatrix();
    this.particles.uniforms.uPR.value = this.pr * (h / 900);
    this.uniforms.uPixelAngle.value = (2 * halfV) / (h * this.pr);
  }

  /** Adaptive resolution: trade pixels for frame rate, with hysteresis. */
  adaptQuality(dt, now) {
    if (this.fixedQuality) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 45 || now - this.lastQualityChange < 2.5) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    let pr = this.pr;
    if (avg > 1 / 40) pr = Math.max(0.45, pr * 0.82);
    else if (avg < 1 / 58 && pr < this.maxPR) pr = Math.min(this.maxPR, pr * 1.12);
    if (Math.abs(pr - this.pr) > 0.02) { this.pr = pr; this.lastQualityChange = now; this.resize(); }
  }

  /** Start (or resume) the render loop. Safe to call repeatedly. */
  start() {
    if (this.running || this.disposed || this.lost) return;
    this.running = true;
    let last = performance.now();
    const loop = (nowMs) => {
      if (!this.running) return;
      const dt = Math.min(0.1, (nowMs - last) / 1000);
      last = nowMs;
      this.update(dt, nowMs / 1000);
      this.post.composer.render(dt);
      this.adaptQuality(dt, nowMs / 1000);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** Pause rendering (hero scrolled away / tab hidden). The simulation clock freezes with it. */
  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.frameTimes.length = 0; // don't let the pause skew the adaptive-quality average
  }

  /** Release the GL context and every listener. The engine can't be restarted afterwards. */
  dispose() {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    removeEventListener('pointermove', this.onPointer);
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.resizeObserver.disconnect();
    this.scene.traverse((o) => {
      o.geometry?.dispose?.();
      const m = o.material;
      if (m) (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose?.());
    });
    this.post.composer.dispose();
    this.post.composer.renderTarget1?.dispose?.();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  update(dt, now) {
    const P = this.bridge.params.get();
    if (P.restartToken !== this.lastRestart) {
      this.lastRestart = P.restartToken;
      this.simTime = T.RESTART_AT; this.diskTime = 0; this.jetTime = 0;
    }
    const sdt = P.playing ? dt : 0;
    this.simTime += sdt;
    const t = this.simTime;
    const E = envelopes(t, P.explosionIntensity);
    this.env = E;

    // integrated clocks so speed changes never make the disk/jets jump
    this.diskTime += sdt * E.spin * P.rotationSpeed;
    this.jetTime += sdt * (0.4 + 0.6 * P.jetIntensity);

    // energy fluctuation: layered slow noise
    const flux = Math.sin(t * 0.7) * 0.5 + Math.sin(t * 1.9 + 1.3) * 0.3 + Math.sin(t * 4.3) * 0.2;

    // visualization mode cross-fade
    const target = [0, 1, 2].map((i) => (P.mode === i ? 1 : 0));
    const k = 1 - Math.exp(-dt * 4);
    this.modeW.set(
      this.modeW.x + (target[0] - this.modeW.x) * k,
      this.modeW.y + (target[1] - this.modeW.y) * k,
      this.modeW.z + (target[2] - this.modeW.z) * k,
    );

    this.updateCamera(t, now, dt, E);

    const U = this.uniforms;
    U.uCamWorld.value.copy(this.camera.matrixWorld);
    U.uProjInv.value.copy(this.camera.projectionMatrixInverse);
    U.uCamPos.value.copy(this.camera.position);
    U.uTime.value = t;
    U.uDiskTime.value = this.diskTime;
    U.uJetTime.value = this.jetTime;
    U.uStarReveal.value = E.starReveal;
    U.uHorizon.value = E.horizon * HORIZON_SCALE;
    U.uDisk.value = E.disk;
    U.uDiskReveal.value = E.diskReveal;
    U.uDiskEnergy.value = P.diskEnergy;
    U.uFlux.value = flux;
    U.uJet.value = E.jet;
    U.uJetIntensity.value = P.jetIntensity * (0.9 + 0.1 * Math.sin(t * 3.1));
    U.uCoreR.value = E.coreR;
    U.uCoreGlow.value = E.coreGlow;
    U.uShockR.value = E.shockR;
    U.uShockA.value = E.shockA * P.explosionIntensity;
    U.uCollapse.value = E.collapse;
    U.uCollapseGlow.value = E.collapseGlow;
    const B = burstAt(t, P.explosionIntensity);
    U.uBurstR.value = B.burstR;
    U.uBurstA.value = B.burstA;

    const pu = this.particles.uniforms;
    pu.uTime.value = t; pu.uDiskTime.value = this.diskTime; pu.uJetTime.value = this.jetTime;
    pu.uHorizon.value = E.horizon * HORIZON_SCALE;
    pu.uDebrisT.value = E.debrisT; pu.uCollapse.value = E.collapse; pu.uBlast.value = 0.6 + 0.4 * P.explosionIntensity;
    pu.uDisk.value = E.disk; pu.uDiskReveal.value = E.diskReveal; pu.uDiskEnergy.value = P.diskEnergy;
    pu.uJet.value = E.jet; pu.uJetIntensity.value = P.jetIntensity;
    pu.uStarReveal.value = E.starReveal;

    // exposure & bloom breathe with the event
    this.post.bloom.strength = 0.85 + 0.9 * E.flash + 0.25 * B.burstA + 0.12 * E.disk * (0.5 + 0.5 * flux);
    this.renderer.toneMappingExposure = 1.0 + 0.6 * E.flash + 0.1 * B.burstA;
    this.post.visor.uniforms.uTime.value = now;
    this.post.visor.uniforms.uFlash.value = this.calm ? 0 : E.flash * 0.35;
    // glitch / RGB split only on the major bursts (detonation + periodic energy bursts)
    this.post.visor.uniforms.uGlitch.value = this.calm ? 0 : Math.max(detonationGlitch(t) * Math.min(P.explosionIntensity, 1.3), B.glitch * 0.7);

    // telemetry (~10 Hz)
    this.telemetryClock += dt;
    if (this.telemetryClock > 0.1) {
      this.telemetryClock = 0;
      // burstCount ticks once per energy burst — lets overlays (the title) glitch in sync
      const since = t - (T.ACTIVE + 1.5);
      const burstCount = since < 0 ? 0 : 1 + Math.floor(since / BURST_PERIOD);
      this.bridge.telemetry.set({ ...buildTelemetry(t, E, P, flux, phaseAt(t), phaseProgress(t), PHASES), burstCount });
    }
  }

  updateCamera(t, now, dt, E) {
    // slow cinematic drift + slight pointer parallax + a jolt on detonation
    this.pointerSmooth.lerp(this.pointer, 1 - Math.exp(-dt * 1.5));
    const yaw = 0.10 * Math.sin(now * 0.031) + 0.05 * this.pointerSmooth.x;
    const pitch = 0.05 * Math.sin(now * 0.043 + 1.0) - 0.03 * this.pointerSmooth.y;
    const intro = 1 - E.starReveal; // drift in from slightly farther during Phase 1
    const dist = 32.5 + 1.0 * Math.sin(now * 0.05) + 6 * intro * intro; // closer: quasar fills ~2/3 of the view
    const te = E.debrisT;
    const shake = te > 0 ? 0.12 * Math.exp(-te * 3.0) : 0;
    this.camera.position.set(
      dist * Math.sin(yaw) * Math.cos(pitch) + shake * Math.sin(now * 61),
      dist * Math.sin(pitch) + shake * Math.sin(now * 53 + 1),
      dist * Math.cos(yaw) * Math.cos(pitch),
    );
    this.camera.lookAt(0, 0, 0);
    this.camera.rotateZ(0.02 * Math.sin(now * 0.027));
    this.camera.updateMatrixWorld();
  }
}
