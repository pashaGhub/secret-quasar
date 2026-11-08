// Awkward Silence Button scene engine. Owns the renderer, scene, camera, lights, post chain, the press
// choreography (press.js), pointer input on the canvas and the render loop. The loop runs only between
// start() and stop() (mount.js drives those from the shared render slot), so idles, the comet and the
// auto-press timer all pause off screen / in a hidden tab.
// Resolution adapts to hold ~60 fps (adaptQuality). Calm mode (reduced motion) has no idle motion, so the
// loop only renders while something changes (a press, hover) and otherwise leaves the last frame up.
// A lost context is final: the engine stops for good and mount shows the poster.
//
// Events (engine.on): 'press' {category} · 'revealed' {category} · 'settled' {category}
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createRenderer, disposeRenderer, isMobile, pixelRatioCap } from '@/lib/scene';
import { createButton } from './button.js';
import { createTokens } from './tokens.js';
import { createStage } from './stage.js';
import { createPost } from './post.js';
import { createPress } from './press.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const TONE = { ACES: THREE.ACESFilmicToneMapping, AgX: THREE.AgXToneMapping, Neutral: THREE.NeutralToneMapping };

export class AsbEngine {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} params   live params object (see ../params.js); mutate it, then call applyParams()
   * @param {{ url: string, calm?: boolean, onContextLost?: () => void }} opts
   */
  constructor(canvas, params, opts) {
    this.canvas = canvas;
    this.params = params;
    this.calm = !!opts.calm;
    this.listeners = {};
    this.raf = 0;
    this.lost = false;
    this.disposed = false;
    this.time = 0;
    this.lastT = 0;
    this.head = 0.25; // comet position (turns)
    this.autoOn = false; // mount enables it the first time the section is well in view
    this.nextAuto = Infinity;
    this.pointer = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();

    const mobile = (this.mobile = isMobile());
    // resolution: starts at the DPR cap and adapts to hold ~60 fps (see adaptQuality)
    this.maxPR = pixelRatioCap({ desktop: 1.5, mobile: 1.25 });
    this.minPR = Math.min(this.maxPR, 0.8); // below this the thin neon lines break up
    this.pr = this.maxPR;
    this.fixedQuality = false;
    this.frameTimes = [];
    this.lastQualityChange = 0;
    this.dirty = 0; // calm mode: frames still to render after a change
    /** Measured render rate and current resolution scale (the lab shows these). */
    this.stats = { fps: 0, pr: this.pr };
    const r = (this.renderer = createRenderer(canvas, { antialias: false, pixelRatio: this.pr }));
    r.toneMapping = THREE.ACESFilmicToneMapping;

    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color('#000000');
    scene.fog = new THREE.Fog('#000000', 7, 16);
    const pm = new THREE.PMREMGenerator(r);
    const room = new RoomEnvironment();
    scene.environment = pm.fromScene(room, 0.04).texture;
    room.dispose();
    pm.dispose();

    this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
    this.target = new THREE.Vector3();

    // lights: a cool key from above, pink and cyan neon fills from either side
    this.lights = {
      key: new THREE.DirectionalLight(),
      pink: new THREE.PointLight('#ff3fae', 6, 9, 1.6),
      cyan: new THREE.PointLight('#40f2ff', 6, 9, 1.6),
      chase: new THREE.PointLight('#ff3fae', 5, 4.5, 1.8), // follows the ring comet (moving it is free)
    };
    this.lights.key.position.set(-3, 6, 4);
    this.lights.pink.position.set(3.2, 2.6, 0.4); // high and level with the button, so they light the
    this.lights.cyan.position.set(-3.2, 2.6, 0.4); // tokens without hot spots on the floor near the camera
    scene.add(...Object.values(this.lights));

    this.stage = createStage();
    scene.add(this.stage.group);
    this.button = createButton();
    scene.add(this.button.group);

    // phones: no MSAA, bloom mips at 60 % resolution (the glow is soft anyway)
    this.post = createPost(r, scene, this.camera, { samples: mobile ? 0 : 4, bloomScale: mobile ? 0.6 : 1 });
    this.pressFx = createPress(this);

    // pointer: hover / click the button; mouse movement leans the tokens and nudges the camera
    // (mouse only — no lean or parallax on touch)
    this.onPointerMove = (e) => {
      const over = this.hitButton(e);
      this.pressFx.state.hoverTarget = over ? 1 : 0;
      canvas.style.cursor = over ? 'pointer' : '';
      this.wake();
      if (e.pointerType === 'mouse') {
        this.pressFx.state.leanTarget.x = this.pointer.x;
        this.pressFx.state.leanTarget.y = this.pointer.y;
      }
    };
    this.onPointerLeave = () => {
      Object.assign(this.pressFx.state, { hoverTarget: 0, leanTarget: { x: 0, y: 0 } });
      canvas.style.cursor = '';
      this.wake();
    };
    this.onClick = (e) => { if (this.hitButton(e)) this.press(); };
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    canvas.addEventListener('click', this.onClick);

    this.onContextLost = (e) => { e.preventDefault(); this.lost = true; this.stop(); opts.onContextLost?.(); };
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);

    this.applyParams();
    this.resize();

    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    this.ready = Promise.all([loader.loadAsync(opts.url), this.button.ready]).then(([gltf]) => {
      if (this.disposed) return;
      this.tokens = createTokens(gltf.scene);
      scene.add(this.tokens.group);
      this.applyParams();
      this.renderFrame(0); // first frame right away, even before start()
    });
  }

  on(type, fn) { (this.listeners[type] ??= new Set()).add(fn); return () => this.listeners[type]?.delete(fn); }
  emit(type, detail) { this.listeners[type]?.forEach((fn) => { try { fn(detail); } catch (e) { console.error(e); } }); }

  /** Is the pointer event over the button? (also stores the pointer in NDC) */
  hitButton(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.intersectObject(this.button.group, true).length > 0;
  }

  /** Press now (click / tap / keyboard / auto). Resets the auto-press timer. Returns the category. */
  press() {
    if (!this.tokens || this.lost || this.disposed) return null;
    const category = this.pressFx.press();
    this.scheduleAuto();
    this.wake();
    if (!this.raf) this.renderFrame(this.time); // keep the frame in sync if paused (lab)
    return category;
  }

  scheduleAuto() {
    const X = this.params.press;
    this.nextAuto = this.time + X.intervalMin + Math.random() * Math.max(0, X.intervalMax - X.intervalMin);
  }

  /** Turn on the auto-press timer (mount calls this on first view). */
  enableAuto() {
    if (this.autoOn) return;
    this.autoOn = true;
    this.scheduleAuto();
  }

  /** Push every look value from params into the scene. */
  applyParams() {
    const P = this.params;
    const r = this.renderer;
    r.toneMappingExposure = P.exposure;
    r.toneMapping = TONE[P.toneMapping] ?? THREE.ACESFilmicToneMapping;
    this.scene.environmentIntensity = P.light.env;
    this.scene.fog.color.set(P.fog.color);
    this.scene.fog.near = P.fog.near;
    this.scene.fog.far = P.fog.far;
    this.scene.background.set(P.fog.color);
    const L = this.lights;
    L.key.intensity = P.light.key;
    L.key.color.set(P.light.keyColor);
    L.pink.intensity = P.light.pink;
    L.pink.color.set(P.light.pinkColor);
    L.cyan.intensity = P.light.cyan;
    L.cyan.color.set(P.light.cyanColor);
    L.chase.intensity = P.light.chase;
    L.chase.color.set(P.light.chaseColor);

    this.stage.apply(P);
    this.button.apply(P.button);
    this.button.group.scale.setScalar(P.button.scale);
    this.post.apply(P);
    this.layout();
    this.wake();
    if (!this.raf) this.renderFrame(this.time);
  }

  /** Calm mode renders on demand: keep rendering for a while after any change. */
  wake(frames = 90) { this.dirty = Math.max(this.dirty, frames); }

  /** Calm mode: does anything still move? (a press until it has settled, hover easing, pending wake) */
  busy() {
    if (!this.calm) return true;
    const S = this.pressFx.state, X = this.eff.press;
    const pressing = S.t < X.revealAt + X.popTime + X.hold + X.returnTime + 0.3;
    return pressing || Math.abs(S.hover - S.hoverTarget) > 0.002 || this.dirty > 0;
  }

  /** Params for the current frame shape: on narrow canvases the `narrow` overrides replace camera/tokens. */
  effective() {
    const P = this.params;
    if (this.camera.aspect >= P.narrow.aspect) return P;
    return {
      ...P,
      camera: { ...P.camera, ...P.narrow.camera },
      tokens: { ...P.tokens, ...P.narrow.tokens },
      press: { ...P.press, ...P.narrow.press },
    };
  }

  /** Camera + token layout for the current frame shape. */
  layout() {
    this.eff = this.effective();
    this.frame();
    this.tokens?.apply(this.eff);
  }

  /** Camera from params, keeping the stage framed on narrow canvases (never narrower than minHalfWidth). */
  frame() {
    const c = this.eff.camera, cam = this.camera;
    cam.position.set(c.x, c.y, c.z);
    this.target.set(c.tx, c.ty, c.tz);
    const dist = cam.position.distanceTo(this.target);
    const needV = c.minHalfWidth / dist / Math.max(cam.aspect, 0.1);
    cam.fov = Math.max(c.fov, THREE.MathUtils.radToDeg(2 * Math.atan(needV)));
    cam.lookAt(this.target);
    cam.updateProjectionMatrix();
  }

  resize() {
    if (this.disposed) return;
    const w = Math.max(1, this.canvas.clientWidth), h = Math.max(1, this.canvas.clientHeight);
    this.renderer.setPixelRatio(this.pr);
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h, this.pr);
    this.camera.aspect = w / h;
    this.layout();
    this.wake();
    if (!this.raf) this.renderFrame(this.time);
  }

  renderFrame(t) {
    if (this.lost || this.disposed) return;
    const P = this.eff;
    const dt = Math.min(0.1, Math.max(0, t - this.lastT));
    this.lastT = t;

    // auto-press (never in calm mode)
    if (this.autoOn && !this.calm && P.press.auto && this.tokens && this.time >= this.nextAuto) this.press();

    const fx = this.pressFx;
    fx.update(dt, P);
    const S = fx.state;

    // the app's `breathe`: 1 → 1.03 over 2 s, glow following (none in calm mode)
    const b = this.calm ? 0 : ((1 - Math.cos((t / 2) * Math.PI * 2)) / 2) * P.anim.breathe;
    this.button.setPress(fx.cap);
    this.button.cap.scale.multiplyScalar(1 + 0.03 * b);
    this.button.group.position.y = S.lift;
    this.button.setGlow((1 + 0.25 * b) * (0.7 + 0.3 * S.energy) + S.flash + 0.35 * S.hover);
    this.stage.setPool((1 + 0.3 * b) * S.energy + 0.6 * S.flash, P);
    this.stage.setWave(S.wave.r, S.wave.k, P);
    this.post.setBloomBoost(1 + 0.15 * S.flash);

    // comet: speeds up after a press (burst); parked at the front in calm mode
    if (this.calm) this.head = 0.25;
    else this.head += dt * P.button.chaseSpeed * (1 + S.burst);
    this.chase(this.head, P);

    // camera parallax (mouse only; lean is 0 on touch)
    this.frame();
    if (!this.calm) {
      const k = P.press.parallax;
      this.camera.position.x += S.lean.x * k;
      this.camera.position.y += S.lean.y * k * 0.5;
      this.camera.lookAt(this.target);
    }

    this.tokens?.update(this.calm ? 0 : t, this.calm ? { ...P, anim: { ...P.anim, idle: 0 } } : P,
      { lean: this.calm ? { x: 0, y: 0 } : S.lean, revealPos: S.revealPos, revealQuat: S.revealQuat, energy: S.energy });
    this.post.render(t);
  }

  /** Comet around the button rings + the light that follows it + the token it passes. head: turns. */
  chase(head, P) {
    const h = head - Math.floor(head);
    this.button.setChase(h);
    this.tokens?.setChase(h, P);
    const a = h * Math.PI * 2, L = P.light;
    const lp = this.lights.chase.position;
    lp.set(Math.cos(a) * L.chaseRadius, L.chaseHeight, -Math.sin(a) * L.chaseRadius * P.tokens.depth);
    // Fade the light out while it is behind the button as seen from the camera: from there it only
    // puts a hot rim highlight on the back of the cap, which reads as a glitch, not as light.
    const cam = this.camera.position;
    const fx = this.target.x - cam.x, fz = this.target.z - cam.z;
    const fl = Math.hypot(fx, fz) || 1;
    const along = (lp.x * fx + lp.z * fz) / fl;       // + = beyond the button, away from the camera
    const side = Math.abs(lp.x * fz - lp.z * fx) / fl; // sideways from the camera → button line
    const behind = smooth(0.0, 1.0, along) * (1 - smooth(1.6, 2.6, side));
    this.lights.chase.intensity = L.chase * (1 - L.chaseHideBehind * behind);
  }

  start() {
    if (this.raf || this.lost || this.disposed) return;
    let last = performance.now();
    this.lastQualityChange = last / 1000; // let the first frames (shader warm-up) pass
    this.wake();
    let frames = 0, since = last;
    const loop = (now) => {
      const raw = (now - last) / 1000;
      this.time += Math.min(0.1, raw);
      last = now;
      if (this.busy()) {
        this.renderFrame(this.time);
        if (this.dirty > 0) this.dirty--;
        this.adaptQuality(raw, now / 1000);
        frames++;
      } else {
        this.frameTimes.length = 0; // idle gaps must not count as slow frames
      }
      if (now - since > 500) { this.stats.fps = Math.round((frames * 1000) / (now - since)); frames = 0; since = now; }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.frameTimes.length = 0; // a pause must not skew the frame-time average
  }

  /**
   * Adaptive resolution: holds ~60 fps by trading pixels, between minPR and the DPR cap, with
   * hysteresis (judged over ~45 frames, at most one step every 2.5 s). Same rule as Story Mode, plus a
   * check that a step down actually helped: when the frame time doesn't improve the scene isn't limited by
   * pixels (a slow CPU, e.g. DevTools throttling) — the step is undone and the resolution held (20 s, doubling
   * on each failed step, at most 2 min) instead of sinking to the floor and blurring for nothing.
   */
  adaptQuality(dt, now) {
    if (this.fixedQuality) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 45 || now - this.lastQualityChange < 2.5) return;
    const sorted = this.frameTimes.slice().sort((a, b) => a - b);
    this.frameTimes.length = 0;
    const typical = sorted[Math.floor(sorted.length * 0.5)]; // median: one hitch doesn't count
    const step = this.lastStep;
    this.lastStep = null;
    if (step && typical > step.before * 0.92) { // the last step down didn't buy ≥ 8 %: undo, then hold
      this.holdFor = Math.min(120, (this.holdFor ?? 10) * 2);
      this.holdUntil = now + this.holdFor;
      this.setPixelRatio(step.from);
      this.lastQualityChange = now;
      return;
    }
    let pr = this.pr;
    if (typical > 1 / 48 && now >= (this.holdUntil ?? 0)) pr = Math.max(this.minPR, pr * 0.85);
    else if (typical < 1 / 57 && pr < this.maxPR) pr = Math.min(this.maxPR, pr * 1.1);
    if (Math.abs(pr - this.pr) > 0.02) {
      if (pr < this.pr) this.lastStep = { from: this.pr, before: typical };
      this.setPixelRatio(pr);
      this.lastQualityChange = now;
    }
  }

  /** Render resolution scale (CSS px → drawing-buffer px). A fixed value turns adaptation off (lab). */
  setPixelRatio(pr, { fixed = false } = {}) {
    this.fixedQuality = fixed;
    this.pr = pr;
    this.stats.pr = pr;
    this.resize();
  }

  dispose() {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    this.canvas.removeEventListener('click', this.onClick);
    this.resizeObserver.disconnect();
    this.button.dispose();
    this.post.dispose();
    disposeRenderer(this.renderer, this.scene);
    this.listeners = {};
  }
}
