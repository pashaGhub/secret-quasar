// Story Mode scene engine: loads scene.glb, stages it, lights it (book key light + light pool, cool
// rims, rune glow), animates it (idles, book opening, page turns, hover glance, mouse parallax) and
// renders it through the post chain. Browser-only; created by mount.js.
//
// Events (engine.on): 'open-start' {duration} · 'opened' · 'turn' {from,to} · 'turned' {spread}
//                     'hover' {book: boolean} · 'book-click'
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createRenderer, disposeRenderer, isMobile, pixelRatioCap } from '@/lib/scene';
import { createPost } from './post.js';
import { createParticles } from './particles.js';
import { createMist, createEnvironment } from './atmosphere.js';
import { stage, apply } from './layout.js';
import { createIdles, bookHover, smooth } from './idle.js';
import { createBook } from './book.js';
import { createHalo, createTorches } from './fire.js';

const DEG = Math.PI / 180;
const GLANCE_LIMIT = { yaw: 0.55, pitch: 0.28 };
const TONE = { ACES: THREE.ACESFilmicToneMapping, AgX: THREE.AgXToneMapping, Neutral: THREE.NeutralToneMapping };

export class StoryModeEngine {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} params   live params object (see ../params.js); mutate it, then call applyParams()
   * @param {{ url: string, calm?: boolean, onContextLost?: () => void }} opts
   */
  constructor(canvas, params, opts) {
    this.canvas = canvas;
    this.params = params;
    this.calm = !!opts.calm;
    this.running = false;
    this.disposed = false;
    this.time = 0;
    this.mobile = isMobile();
    this.pr = pixelRatioCap({ desktop: 1.5, mobile: 1.25 });
    this.listeners = {};

    const r = (this.renderer = createRenderer(canvas, { pixelRatio: this.pr }));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.overlay = new THREE.Scene();               // particles, drawn after depth of field
    this.camera = new THREE.PerspectiveCamera(31, 1, 0.1, 40);
    this.scene.fog = new THREE.FogExp2(0x0d0b12, 0.13);
    this.scene.background = new THREE.Color(0x0d0b12);
    this.scene.environment = createEnvironment(r);

    this.lights = this.createLights();
    this.mist = createMist(this.scene);
    this.halo = createHalo(this.scene);
    this.torches = createTorches(this.scene, { count: this.params.torches.list.length });
    this.particles = createParticles(this.overlay, {
      embers: this.mobile ? 90 : 220, dust: this.mobile ? 160 : 360, calm: this.calm,
    });
    this.post = createPost(r, this.scene, this.overlay, this.camera, { samples: this.mobile ? 0 : 4 });
    this.post.overlay.beforeRender = (depth) => this.particles.setDepth(depth);

    this.bookPos = new THREE.Vector3();
    this.camTarget = new THREE.Vector3();

    // pointer state (section-relative, -1..1), smoothed for parallax / glance
    this.pointer = { inside: false, x: 0, y: 0, sx: 0, sy: 0, hoverBook: false, hover: 0, presence: 0 };
    this.raycaster = new THREE.Raycaster();
    this.box = new THREE.Box3();
    this.glance = { wise: { x: 0, y: 0 }, avatar: { x: 0, y: 0 } };
    this.bindPointer();

    this.onContextLost = (e) => { e.preventDefault(); this.stop(); opts.onContextLost?.(); };
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();

    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    this.ready = loader.loadAsync(opts.url).then((gltf) => {
      if (this.disposed) return;
      this.root = gltf.scene;
      this.staged = stage(this.root, this.params);
      this.idles = createIdles(this.staged.n);
      this.book = createBook(this.staged.n, {
        calm: this.calm, sparks: this.particles.sparks, emit: (type, detail) => this.emit(type, detail),
      });
      this.scene.add(this.root);
      this.applyParams();
      if (this.wantOpen) this.book.requestOpen();
      this.renderFrame(0);                          // first frame right away, even before start()
    });
  }

  // ------------------------------------------------------------------ events
  on(type, fn) { (this.listeners[type] ??= new Set()).add(fn); return () => this.listeners[type]?.delete(fn); }
  emit(type, detail) { this.listeners[type]?.forEach((fn) => { try { fn(detail); } catch (e) { console.error(e); } }); }

  // ------------------------------------------------------------------ public actions
  /** Unlock + open the book (first view). Safe to call before the model has loaded. */
  openBook() { this.wantOpen = true; this.book?.requestOpen(); }
  /** Turn to the next page (click / Enter / Space). */
  turnPage() { return this.book?.turnPage() ?? false; }
  /** Lab: close the book again so the opening can be replayed. */
  resetBook() { this.book?.close(); }

  /**
   * Screen position (CSS px, relative to the canvas) of a character's anchor, e.g. 'overhead'.
   * Hook for OSRS-style overhead text. Returns null if unknown / behind the camera.
   */
  anchorScreen(character, anchor = 'overhead', out = { x: 0, y: 0 }) {
    const o = this.staged?.n(`${character}__anchor_${anchor}`);
    if (!o) return null;
    const v = o.getWorldPosition(this._av ??= new THREE.Vector3()).project(this.camera);
    if (v.z > 1) return null;
    out.x = (v.x * 0.5 + 0.5) * this.width;
    out.y = (-v.y * 0.5 + 0.5) * this.height;
    return out;
  }

  createLights() {
    const L = {};
    L.hemi = new THREE.HemisphereLight(0x2a3452, 0x160d07, 0.5);
    // the book: an omni glow for faces/upper bodies + a shadow-casting pool on the stones below
    L.book = new THREE.PointLight(0xffab5e, 2.5, 6, 1.6);
    L.pool = new THREE.SpotLight(0xffab5e, 8, 7, 58 * DEG, 0.75, 1.6);
    L.pool.castShadow = true;
    L.pool.shadow.mapSize.set(1024, 1024);
    L.pool.shadow.bias = -0.0004;
    L.pool.shadow.normalBias = 0.02;
    L.pool.shadow.camera.near = 0.2;
    L.pool.shadow.camera.far = 6;
    L.rim = new THREE.DirectionalLight(0x7d98ff, 2.2);
    L.rim.position.set(-2.5, 3.2, -4.5);
    L.fill = new THREE.DirectionalLight(0xffd2a6, 0.3);
    L.fill.position.set(2.5, 1.2, 4);
    L.circle = new THREE.PointLight(0x6f9bff, 0.9, 3.5, 1.8);
    // warm light bounced up from the lit stones onto legs and robes
    L.bounce = new THREE.PointLight(0xff9a55, 0.9, 2.6, 1.6);
    for (const l of Object.values(L)) this.scene.add(l);
    this.scene.add(L.pool.target);
    return L;
  }

  /** Push the params object into lights, fog, post, layout. Cheap; call after any change. */
  applyParams() {
    const P = this.params, L = this.lights;
    this.renderer.toneMappingExposure = P.exposure;
    this.renderer.toneMapping = TONE[P.toneMapping] ?? THREE.ACESFilmicToneMapping;
    L.hemi.intensity = P.light.hemi; L.hemi.color.set(P.light.hemiSky); L.hemi.groundColor.set(P.light.hemiGround);
    L.rim.intensity = P.light.rim; L.rim.color.set(P.light.rimColor);
    L.fill.intensity = P.light.fill; L.fill.color.set(P.light.fillColor);
    L.circle.color.set(P.light.circleColor);
    L.bounce.color.set(P.light.bounceColor);
    const T = P.torches;
    this.torches.layout(T.list, T.height, T.on);
    L.book.color.set(P.book.lightColor); L.pool.color.set(P.book.lightColor);
    L.pool.angle = P.book.poolAngle * DEG;
    this.scene.environmentIntensity = P.light.env;
    this.scene.fog.color.set(P.fog.color); this.scene.fog.density = P.fog.density;
    this.scene.background.set(P.fog.color);
    const b = this.post.bloom;
    b.strength = P.bloom.strength; b.radius = P.bloom.radius; b.threshold = P.bloom.threshold;
    const g = this.post.grade.uniforms;
    g.uVignette.value = P.grade.vignette; g.uGrain.value = this.calm ? 0 : P.grade.grain;
    g.uWarmth.value = P.grade.warmth; g.uLift.value = P.grade.lift;
    g.uLiftColor.value.set(P.fog.color).multiplyScalar(2);
    this.particles.setLook(P.particles);

    if (this.staged) {
      apply(this.staged.nodes, this.staged.n, P);
      this.idles?.reset();
      const c = P.place.circle;
      L.circle.position.set(c[0], 0.25, c[1]);
      L.bounce.position.set(c[0], 0.1, c[1]);
    }
    this.updateCamera();
  }

  updateCamera() {
    const c = this.params.camera, cam = this.camera;
    const pp = this.calm ? 0 : this.params.anim.parallax;
    const px = this.pointer.sx * pp, py = this.pointer.sy * pp;
    // mouse parallax: the camera leans a little toward the pointer, the aim point barely moves
    cam.position.set(c.x + px * 0.22, c.y - py * 0.1, c.z);
    this.camTarget.set(c.tx + px * 0.05, c.ty - py * 0.03, c.tz);
    cam.lookAt(this.camTarget);
    // keep the stage framed on narrow canvases: fixed vertical FOV, but never narrower than minHalfWidth
    const dist = cam.position.distanceTo(this.camTarget);
    const halfV = Math.tan((c.fov * DEG) / 2);
    const needV = c.minHalfWidth / dist / Math.max(cam.aspect, 0.1);
    cam.fov = (2 * Math.atan(Math.max(halfV, needV))) / DEG;
    cam.updateProjectionMatrix();
  }

  resize() {
    const c = this.canvas;
    const w = c.clientWidth || 1, h = c.clientHeight || 1;
    this.width = w; this.height = h;
    this.renderer.setPixelRatio(this.pr);
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h, this.pr);
    this.camera.aspect = w / h;
    this.updateCamera();
    if (!this.running && this.root) this.renderFrame(0);
  }

  // ------------------------------------------------------------------ pointer
  bindPointer() {
    const el = this.canvas;
    const P = this.pointer;
    this.onPointerMove = (e) => {
      const r = el.getBoundingClientRect();
      P.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      P.y = ((e.clientY - r.top) / r.height) * 2 - 1;
      P.inside = true;
      P.touch = e.pointerType === 'touch';
    };
    this.onPointerLeave = () => { P.inside = false; P.hoverBook = false; };
    this.onClick = (e) => {
      this.onPointerMove(e);
      if (this.pickBook()) { this.emit('book-click'); this.turnPage(); }
    };
    el.addEventListener('pointermove', this.onPointerMove, { passive: true });
    el.addEventListener('pointerdown', this.onPointerMove, { passive: true });
    el.addEventListener('pointerleave', this.onPointerLeave, { passive: true });
    el.addEventListener('click', this.onClick);
  }

  pickBook() {
    if (!this.book) return false;
    this.raycaster.setFromCamera({ x: this.pointer.x, y: -this.pointer.y }, this.camera);
    return this.raycaster.ray.intersectsBox(this.book.bounds(this.box));
  }

  /** Smooth pointer, hover state, cursor, and the two storytellers' glance toward the pointer. */
  updatePointer(dt) {
    const P = this.pointer, A = this.params.anim;
    const active = P.inside && !P.touch;
    P.sx = smooth(P.sx, active ? P.x : 0, dt, 2.5);
    P.sy = smooth(P.sy, active ? P.y : 0, dt, 2.5);
    P.presence = smooth(P.presence, active ? 1 : 0, dt, 3);

    const over = active && this.pickBook();
    if (over !== P.hoverBook) {
      P.hoverBook = over;
      this.canvas.style.cursor = over ? 'pointer' : '';
      this.emit('hover', { book: over });
    }
    P.hover = smooth(P.hover, P.hoverBook ? 1 : 0, dt, 6);

    // glance: where does the pointer ray cross the plane through the book (facing the camera)?
    const target = this._gt ??= new THREE.Vector3();
    this.raycaster.setFromCamera({ x: P.sx, y: -P.sy }, this.camera);
    const plane = this._gp ??= new THREE.Plane();
    plane.setFromNormalAndCoplanarPoint(this.camera.getWorldDirection(this._gn ??= new THREE.Vector3()).negate(), this.bookPos);
    const hit = this.raycaster.ray.intersectPlane(plane, target);
    const weight = (this.calm ? 0 : A.glance) * P.presence * (0.55 + 0.35 * P.hover);
    for (const [key, name] of [['wise', 'wise_old_man'], ['avatar', 'avatar']]) {
      const g = this.glance[key];
      let yaw = 0, pitch = 0;
      if (hit && weight > 0.001) {
        const root = this.staged.nodes[name];
        const neck = this.staged.n(`${name}__neck`);
        const n0 = root.worldToLocal(neck.getWorldPosition(this._gk ??= new THREE.Vector3()));
        const d = root.worldToLocal((this._gl ??= new THREE.Vector3()).copy(target)).sub(n0);
        // relative to looking at the book (their resting gaze)
        const bk = root.worldToLocal((this._gb ??= new THREE.Vector3()).copy(this.bookPos)).sub(n0);
        yaw = Math.atan2(d.x, d.z) - Math.atan2(bk.x, bk.z);
        pitch = -(Math.atan2(d.y, Math.hypot(d.x, d.z)) - Math.atan2(bk.y, Math.hypot(bk.x, bk.z)));
        yaw = THREE.MathUtils.clamp(yaw, -GLANCE_LIMIT.yaw, GLANCE_LIMIT.yaw) * weight;
        pitch = THREE.MathUtils.clamp(pitch, -GLANCE_LIMIT.pitch, GLANCE_LIMIT.pitch) * weight;
      }
      g.x = smooth(g.x, yaw, dt, 4);
      g.y = smooth(g.y, pitch, dt, 4);
    }
  }

  // ------------------------------------------------------------------ loop
  start() {
    if (this.running || this.disposed) return;
    this.running = true;
    let last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      this.renderFrame(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  renderFrame(dt) {
    if (this.disposed) return;
    this.time += dt;
    const t = this.time, P = this.params, L = this.lights, A = P.anim;
    if (this.root) {
      const nodes = this.staged.nodes, book = this.book;
      this.updatePointer(dt);
      this.updateCamera();
      this.idles.update(t, dt, { amount: this.calm ? 0 : A.idle, glance: this.glance });
      book.update(dt, P);

      // hovering book: bob + sway on top of its placement
      const base = nodes.book.userData.base;
      const hv = bookHover(t, this.calm ? 0 : A.hover);
      nodes.book.position.y = base.y + hv.y;
      nodes.book.rotation.x = base.rx + hv.rx;
      nodes.book.rotation.z = hv.rz;
      this.root.updateMatrixWorld(true);

      // light follows the book. It lights the characters and the stones (placed above and a little
      // toward the camera); the pages are self-lit and don't take this light at all (see book.js).
      nodes.book.getWorldPosition(this.bookPos);
      const open = book.open, flash = book.flash, hover = this.pointer.hover;
      const fl = this.calm ? 0 : P.book.flicker;
      const flicker = 1 + fl * (0.55 * Math.sin(t * 7.3) * Math.sin(t * 2.1 + 1.3) + 0.45 * Math.sin(t * 17.0 + Math.sin(t * 3.0)));
      const level = (0.25 + 0.75 * open) * (1 + 0.12 * hover) + 0.35 * flash;
      L.book.position.set(this.bookPos.x, this.bookPos.y + P.book.lightHeight * (0.4 + 0.6 * open), this.bookPos.z + P.book.lightForward);
      L.book.intensity = P.book.light * flicker * level;
      L.pool.position.set(this.bookPos.x, this.bookPos.y - 0.08, this.bookPos.z);
      L.pool.target.position.set(this.bookPos.x, 0, this.bookPos.z);
      L.pool.intensity = P.book.pool * flicker * (0.12 + 0.88 * open) * (1 + 0.1 * hover);
      L.bounce.intensity = P.light.bounce * flicker * (0.3 + 0.7 * open);
      const pl = book.pageLight;
      pl.uPageBright.value = P.book.pageBright * (1 + 0.35 * (flicker - 1)) * (1 + 0.1 * hover + 0.2 * flash);
      this.halo.update(t, this.bookPos, this.camera, {
        size: P.book.haloSize, intensity: P.book.halo * (0.15 + 0.85 * open) * flicker * (1 + 0.35 * hover + 0.8 * flash),
        color: P.book.haloColor, back: P.book.haloBack,
      });
      this.torches.update(t, dt, this.camera, { ...P.torches, calm: this.calm }, P.anim.sparks > 0 ? this.particles.sparks : null);
      const pulse = this.calm ? 1 : 0.85 + 0.15 * Math.sin(t * 1.6);
      this.staged.each('book_rune_glow', (m) => { m.emissiveIntensity = P.book.runeGlow * pulse * (1 + 0.4 * hover + 2.5 * flash); });
      const circ = this.calm ? 1 : 0.8 + 0.2 * Math.sin(t * 0.9 + 1.0);
      this.staged.each('set_rune_glow', (m) => { m.emissiveIntensity = P.light.circleGlow * circ * (1 + 0.6 * flash); });
      L.circle.intensity = P.light.circleLight * circ * (1 + 0.6 * flash);
    }
    const focus = P.dof.focus > 0 ? P.dof.focus : this.camera.position.distanceTo(this.bookPos);
    const d = this.post.dof.uniforms;
    d.uFocus.value = focus; d.uAperture.value = P.dof.aperture; d.uMaxBlur.value = P.dof.maxBlur; d.uRange.value = P.dof.range;
    this.mist.update(t, P.fog, this.scene.fog, this.bookPos);
    this.particles.book.copy(this.bookPos);
    this.particles.sparks.update(dt);
    const size = this.renderer.getDrawingBufferSize(this._res ??= new THREE.Vector2());
    this.particles.update(t, {
      focus, aperture: P.dof.aperture, near: this.camera.near, far: this.camera.far, res: size, pr: this.pr,
    });
    this.post.grade.uniforms.uTime.value = t;
    this.post.composer.render(dt);
  }

  dispose() {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    const el = this.canvas;
    el.removeEventListener('webglcontextlost', this.onContextLost);
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerdown', this.onPointerMove);
    el.removeEventListener('pointerleave', this.onPointerLeave);
    el.removeEventListener('click', this.onClick);
    this.resizeObserver.disconnect();
    this.listeners = {};
    this.post.dispose();
    for (const l of Object.values(this.lights)) l.shadow?.map?.dispose();
    disposeRenderer(this.renderer, this.scene, this.overlay);
  }
}
