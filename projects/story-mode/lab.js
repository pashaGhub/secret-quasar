// lil-gui tuning panel for /lab/story-mode (development only). Edits the live params object;
// "Copy params" puts the current look on the clipboard as JSON for ../params.js.
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DEFAULTS } from './params.js';

const STORE = 'story-mode-lab-params-v2';   // bump when defaults change a lot (old lab edits are dropped)

export function attachLab(engine, params, section, hooks = {}) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved) assign(params, saved);
  } catch { /* storage unavailable — start from defaults */ }

  const gui = new GUI({ title: 'Story Mode lab', width: 300 });
  gui.domElement.style.zIndex = '50';
  const changed = () => {
    engine.applyParams();
    try { localStorage.setItem(STORE, JSON.stringify(params)); } catch { /* ignore */ }
  };

  const cam = gui.addFolder('Camera');
  for (const k of ['x', 'y', 'z']) cam.add(params.camera, k, -6, 8, 0.01);
  for (const k of ['tx', 'ty', 'tz']) cam.add(params.camera, k, -4, 4, 0.01);
  cam.add(params.camera, 'fov', 15, 60, 0.5);
  cam.add(params.camera, 'minHalfWidth', 0.5, 3, 0.01).name('min half width');
  const ui = { orbit: false, paused: false };
  let controls;
  cam.add(ui, 'orbit').name('free camera (drag)').onChange((on) => {
    if (on) {
      controls = new OrbitControls(engine.camera, engine.canvas);
      controls.target.set(params.camera.tx, params.camera.ty, params.camera.tz);
      controls.enableDamping = false;
      controls.addEventListener('change', () => {
        const p = engine.camera.position, t = controls.target;
        Object.assign(params.camera, { x: r2(p.x), y: r2(p.y), z: r2(p.z), tx: r2(t.x), ty: r2(t.y), tz: r2(t.z) });
        gui.controllersRecursive().forEach((c) => c.updateDisplay());
        changed();
      });
    } else { controls?.dispose(); controls = undefined; }
  });

  gui.add(params, 'exposure', 0.2, 3, 0.01);
  gui.add(params, 'toneMapping', ['ACES', 'AgX', 'Neutral']).name('tone mapping');

  const book = gui.addFolder('Book');
  book.add(params.book, 'y', 0.6, 1.6, 0.01).name('height');
  book.add(params.book, 'z', -1.5, 1, 0.01);
  book.add(params.book, 'tilt', -10, 60, 0.5);
  book.add(params.book, 'vtilt', 0, 20, 0.5).name('open V');
  book.add(params.book, 'light', 0, 10, 0.05).name('glow light');
  book.add(params.book, 'pool', 0, 30, 0.1).name('light pool');
  book.add(params.book, 'poolAngle', 20, 85, 1).name('pool angle');
  book.addColor(params.book, 'lightColor').name('light colour');
  book.add(params.book, 'lightHeight', 0, 0.8, 0.01).name('light height');
  book.add(params.book, 'lightForward', -0.5, 1, 0.01).name('light toward camera');
  book.add(params.book, 'flicker', 0, 0.5, 0.01);
  book.add(params.book, 'pageBright', 0.3, 2, 0.01).name('page brightness');
  book.add(params.book, 'halo', 0, 2, 0.01).name('halo');
  book.add(params.book, 'haloSize', 0.3, 4, 0.01).name('halo size');
  book.add(params.book, 'haloBack', 0, 1.5, 0.01).name('halo behind book');
  book.addColor(params.book, 'haloColor').name('halo colour');
  book.add(params.book, 'runeGlow', 0, 12, 0.05).name('rune glow');

  const light = gui.addFolder('Lights');
  light.add(params.light, 'hemi', 0, 3, 0.01).name('ambient');
  light.addColor(params.light, 'hemiSky').name('ambient sky');
  light.addColor(params.light, 'hemiGround').name('ambient ground');
  light.add(params.light, 'rim', 0, 8, 0.05);
  light.addColor(params.light, 'rimColor').name('rim colour');
  light.add(params.light, 'bounce', 0, 5, 0.01).name('stone bounce');
  light.addColor(params.light, 'bounceColor').name('bounce colour');
  light.add(params.light, 'fill', 0, 3, 0.01);
  light.addColor(params.light, 'fillColor').name('fill colour');
  light.add(params.light, 'env', 0, 2, 0.01).name('environment');
  light.add(params.light, 'circleGlow', 0, 8, 0.05).name('circle runes');
  light.add(params.light, 'circleLight', 0, 5, 0.05).name('circle light');
  light.addColor(params.light, 'circleColor').name('circle colour');

  const fog = gui.addFolder('Fog');
  fog.addColor(params.fog, 'color');
  fog.add(params.fog, 'density', 0, 0.5, 0.005);
  fog.add(params.fog, 'layers', 0, 1, 0.01).name('mist layers');
  fog.addColor(params.fog, 'layerColor').name('mist colour');

  const post = gui.addFolder('Post');
  post.add(params.dof, 'focus', 0, 8, 0.01).name('DoF focus (0 = book)');
  post.add(params.dof, 'aperture', 0, 4, 0.01).name('DoF aperture');
  post.add(params.dof, 'maxBlur', 0, 16, 0.1).name('DoF max blur');
  post.add(params.dof, 'range', 0, 2, 0.01).name('DoF sharp range');
  post.add(params.bloom, 'strength', 0, 3, 0.01).name('bloom');
  post.add(params.bloom, 'radius', 0, 1, 0.01).name('bloom radius');
  post.add(params.bloom, 'threshold', 0, 3, 0.01).name('bloom threshold');
  post.add(params.grade, 'vignette', 0, 1, 0.01);
  post.add(params.grade, 'grain', 0, 0.15, 0.001);
  post.add(params.grade, 'warmth', -0.3, 0.3, 0.005);
  post.add(params.grade, 'lift', 0, 0.06, 0.001).name('shadow lift');

  const torch = gui.addFolder('Torches');
  torch.add(params.torches, 'on').name('show torches');
  torch.add(params.torches, 'intensity', 0, 12, 0.05).name('light');
  torch.addColor(params.torches, 'color').name('light colour');
  torch.add(params.torches, 'flame', 0, 3, 0.01).name('flame brightness');
  torch.add(params.torches, 'height', 0.6, 2.2, 0.01);
  params.torches.list.forEach((pos, i) => {
    const o = { x: pos[0], z: pos[1] };
    const sync = () => { params.torches.list[i] = [o.x, o.z]; changed(); };
    torch.add(o, 'x', -4, 4, 0.01).name(`torch ${i + 1} x`).onChange(sync);
    torch.add(o, 'z', -5, 3, 0.01).name(`torch ${i + 1} z`).onChange(sync);
  });

  const parts = gui.addFolder('Particles');
  parts.add(params.particles, 'embers', 0, engine.particles.max.embers, 1);
  parts.add(params.particles, 'emberSize', 0.2, 4, 0.01).name('ember size');
  parts.add(params.particles, 'emberSpeed', 0, 3, 0.01).name('ember speed');
  parts.add(params.particles, 'dust', 0, engine.particles.max.dust, 1);
  parts.add(params.particles, 'dustSize', 0.2, 4, 0.01).name('dust size');

  const anim = gui.addFolder('Animation');
  anim.add(params.anim, 'idle', 0, 3, 0.01).name('idle strength');
  anim.add(params.anim, 'parallax', 0, 3, 0.01).name('mouse parallax');
  anim.add(params.anim, 'glance', 0, 2, 0.01).name('glance at cursor');
  anim.add(params.anim, 'hover', 0, 0.12, 0.001).name('book bob');
  anim.add(params.anim, 'openTime', 0.5, 6, 0.05).name('open time (s)');
  anim.add(params.anim, 'turnTime', 0.4, 4, 0.05).name('page turn (s)');
  anim.add(params.anim, 'curl', 0, 2.5, 0.01).name('page curl');
  anim.add(params.anim, 'sparks', 0, 3, 0.01).name('sparks');
  const lines = ['Gather round, adventurer.', 'Every quest is a story…', '…and every story deserves a voice.'];
  let line = 0;
  const animActions = {
    replay: () => { engine.resetBook(); setTimeout(() => engine.openBook(), 500); },
    turn: () => engine.turnPage(),
    say: () => hooks.say?.('wise_old_man', lines[line++ % lines.length], 2600),
  };
  anim.add(animActions, 'replay').name('▶ Replay book opening');
  anim.add(animActions, 'turn').name('▶ Turn page');
  anim.add(animActions, 'say').name('▶ Test overhead text');

  const place = gui.addFolder('Layout').close();
  for (const name of Object.keys(params.place)) {
    const f = place.addFolder(name).close();
    const v = params.place[name];
    const o = { x: v[0], z: v[1], rot: v[2] };
    const sync = () => { params.place[name] = [o.x, o.z, o.rot]; changed(); };
    f.add(o, 'x', -5, 5, 0.01).onChange(sync);
    f.add(o, 'z', -6, 3, 0.01).onChange(sync);
    f.add(o, 'rot', -180, 180, 1).onChange(sync);
  }
  const mh = { ...Object.fromEntries(params.menhirs.map((on, i) => [`stone ${i + 1}`, on])) };
  Object.keys(mh).forEach((k, i) => place.add(mh, k).onChange((on) => { params.menhirs[i] = on; changed(); }));

  gui.onChange(changed);

  const actions = {
    copy: async () => {
      const json = JSON.stringify(params, null, 2);
      console.log('[story-mode] params\n' + json);
      try { await navigator.clipboard.writeText(json); flash('Copied to clipboard'); } catch { flash('Logged to console'); }
    },
    reset: () => {
      assign(params, structuredClone(DEFAULTS));
      try { localStorage.removeItem(STORE); } catch { /* ignore */ }
      engine.applyParams();
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    },
  };
  ui.paused = false;
  gui.add(ui, 'paused').name('pause').onChange((p) => (p ? engine.stop() : engine.start()));
  gui.add(actions, 'copy').name('Copy params (JSON)');
  gui.add(actions, 'reset').name('Reset to defaults');

  // fps readout
  const fps = document.createElement('div');
  fps.className = 'sm-lab-fps';
  fps.style.cssText = 'position:absolute;left:8px;top:8px;z-index:5;font:11px ui-monospace,monospace;color:#cfc3ff;background:#0008;padding:2px 6px;border-radius:3px;pointer-events:none';
  section.append(fps);
  let frames = 0, last = performance.now(), raf;
  const tick = (now) => {
    frames++;
    if (now - last > 500) { fps.textContent = `${Math.round((frames * 1000) / (now - last))} fps`; frames = 0; last = now; }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  function flash(msg) {
    const old = gui.title(); gui.title(msg);
    setTimeout(() => gui.title(old === msg ? 'Story Mode lab' : old), 1400);
  }

  engine.applyParams();
  window.storyModeLab = { engine, params, gui, say: hooks.say };   // console access for tuning / capture scripts
  return {
    gui,
    dispose() { cancelAnimationFrame(raf); fps.remove(); controls?.dispose(); gui.destroy(); delete window.storyModeLab; },
  };
}

const r2 = (v) => Math.round(v * 100) / 100;

function assign(dst, src) {
  for (const k of Object.keys(src)) {
    if (!(k in dst)) continue;
    const v = src[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof dst[k] === 'object') assign(dst[k], v);
    else dst[k] = v;
  }
}
