// lil-gui tuning panel for /lab/awkward-silence-button (development only). Edits the live params
// object; "Copy params" puts the current look on the clipboard as JSON for ./params.js.
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DEFAULTS, merge } from './params.js';

const STORE = 'asb-lab-params-v3'; // bump when defaults change a lot (old lab edits are dropped)

export function attachLab(engine, params) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved) merge(params, saved);
  } catch { /* storage unavailable — start from defaults */ }

  const gui = new GUI({ title: 'Awkward Silence Button lab', width: 300 });
  gui.domElement.style.zIndex = '50';
  const changed = () => {
    engine.applyParams();
    try { localStorage.setItem(STORE, JSON.stringify(params)); } catch { /* ignore */ }
  };

  const cam = gui.addFolder('Camera');
  for (const k of ['x', 'y', 'z']) cam.add(params.camera, k, -10, 12, 0.01);
  for (const k of ['tx', 'ty', 'tz']) cam.add(params.camera, k, -4, 4, 0.01);
  cam.add(params.camera, 'fov', 15, 60, 0.5);
  cam.add(params.camera, 'minHalfWidth', 1, 6, 0.01).name('min half width');
  const ui = { orbit: false, paused: false };
  let controls;
  cam.add(ui, 'orbit').name('free camera (drag)').onChange((on) => {
    if (on) {
      controls = new OrbitControls(engine.camera, engine.canvas);
      controls.target.set(params.camera.tx, params.camera.ty, params.camera.tz);
      controls.addEventListener('change', () => {
        const p = engine.camera.position, t = controls.target;
        Object.assign(params.camera, { x: r2(p.x), y: r2(p.y), z: r2(p.z), tx: r2(t.x), ty: r2(t.y), tz: r2(t.z) });
        gui.controllersRecursive().forEach((c) => c.updateDisplay());
        changed();
      });
    } else { controls?.dispose(); controls = undefined; }
  });

  const nar = gui.addFolder('Narrow frame (phones)').close();
  nar.add(params.narrow, 'aspect', 0.5, 1.6, 0.01).name('below aspect');
  for (const k of ['y', 'z']) nar.add(params.narrow.camera, k, -10, 12, 0.01).name(`camera ${k}`);
  nar.add(params.narrow.camera, 'ty', -4, 4, 0.01).name('camera ty');
  nar.add(params.narrow.camera, 'fov', 15, 60, 0.5).name('camera fov');
  nar.add(params.narrow.camera, 'minHalfWidth', 1, 6, 0.01).name('min half width');
  nar.add(params.narrow.tokens, 'radius', 1.5, 4.5, 0.01).name('ring radius');
  nar.add(params.narrow.tokens, 'depth', 0.2, 1.5, 0.01).name('ring depth');
  nar.add(params.narrow.tokens, 'scale', 0.3, 1.4, 0.01).name('token scale');
  nar.add(params.narrow.tokens, 'face', -1, 8, 0.01).name('aim height');
  nar.add(params.narrow.press, 'revealY', 0, 5, 0.01).name('reveal height');
  nar.add(params.narrow.press, 'revealZ', -2, 3, 0.01).name('reveal z');
  nar.add(params.narrow.press, 'revealScale', 1, 3, 0.01).name('reveal scale');

  gui.add(params, 'exposure', 0.2, 3, 0.01);
  gui.add(params, 'toneMapping', ['ACES', 'AgX', 'Neutral']).name('tone mapping');

  const col = gui.addFolder('Category colours').close();
  for (const k of Object.keys(params.colors)) col.addColor(params.colors, k);

  const tok = gui.addFolder('Tokens');
  tok.add(params.tokens, 'radius', 1.5, 4.5, 0.01).name('ring radius');
  tok.add(params.tokens, 'depth', 0.2, 1.2, 0.01).name('ring depth (ellipse)');
  tok.add(params.tokens, 'height', 0, 2, 0.01);
  tok.add(params.tokens, 'jitter', 0, 0.6, 0.01).name('height variation');
  tok.add(params.tokens, 'scale', 0.3, 1.2, 0.01);
  tok.add(params.tokens, 'tilt', 0, 0.5, 0.005).name('alternating roll');
  tok.add(params.tokens, 'face', -1, 6, 0.01).name('aim height');
  tok.addColor(params.tokens, 'body').name('body colour');
  tok.add(params.tokens, 'faceGlow', 0, 1.5, 0.01).name('face glow');
  tok.add(params.tokens, 'rim', 0, 8, 0.05).name('edge glow');
  tok.add(params.tokens, 'rimPow', 0.5, 6, 0.05).name('edge sharpness');
  tok.add(params.tokens, 'crease', 10, 80, 1).name('crease angle');
  tok.add(params.tokens, 'chase', 0, 3, 0.01).name('flare as comet passes');

  const btn = gui.addFolder('Button');
  btn.add(params.button, 'scale', 0.5, 1.6, 0.01);
  btn.addColor(params.button, 'red').name('cap red');
  btn.add(params.button, 'inner', 0, 2, 0.01).name('inner glow');
  btn.addColor(params.button, 'innerColor').name('inner glow colour');
  btn.add(params.button, 'label', 0, 5, 0.05).name('label glow');
  btn.add(params.button, 'ringPink', 0, 8, 0.05).name('pink ring');
  btn.addColor(params.button, 'ringPinkColor').name('pink ring colour');
  btn.add(params.button, 'ringCyan', 0, 8, 0.05).name('cyan ring');
  btn.addColor(params.button, 'ringCyanColor').name('cyan ring colour');
  btn.addColor(params.button, 'plinth').name('plinth colour');
  btn.add(params.button, 'chase', 0, 8, 0.05).name('ring comet');
  btn.add(params.button, 'chaseTail', 0.01, 0.5, 0.005).name('comet tail');
  btn.add(params.button, 'chaseSpeed', 0, 1.5, 0.01).name('comet speed (turns/s)');

  const floor = gui.addFolder('Floor').close();
  floor.addColor(params.floor, 'color');
  floor.add(params.floor, 'metal', 0, 1, 0.01);
  floor.add(params.floor, 'rough', 0, 1, 0.01);
  floor.add(params.floor, 'grid', 0, 2, 0.01).name('grid strength');
  floor.add(params.floor, 'cell', 0.2, 2, 0.01).name('grid cell');
  floor.addColor(params.floor, 'gridNear').name('grid near');
  floor.addColor(params.floor, 'gridFar').name('grid far');
  floor.add(params.floor, 'fade', 3, 20, 0.1).name('grid fade distance');
  floor.add(params.floor, 'pool', 0, 2, 0.01).name('light pool');
  floor.addColor(params.floor, 'poolColor').name('pool colour');
  floor.add(params.floor, 'poolSize', 0.5, 6, 0.01).name('pool size');

  const light = gui.addFolder('Lights').close();
  light.add(params.light, 'key', 0, 4, 0.01);
  light.addColor(params.light, 'keyColor').name('key colour');
  light.add(params.light, 'pink', 0, 20, 0.1).name('pink fill');
  light.addColor(params.light, 'pinkColor').name('pink colour');
  light.add(params.light, 'cyan', 0, 20, 0.1).name('cyan fill');
  light.addColor(params.light, 'cyanColor').name('cyan colour');
  light.add(params.light, 'env', 0, 1, 0.01).name('environment');
  light.add(params.light, 'chase', 0, 20, 0.1).name('comet light');
  light.addColor(params.light, 'chaseColor').name('comet light colour');
  light.add(params.light, 'chaseRadius', 0.5, 4, 0.01).name('comet light radius');
  light.add(params.light, 'chaseHeight', 0, 3, 0.01).name('comet light height');
  light.add(params.light, 'chaseHideBehind', 0, 1, 0.01).name('hide light behind button');

  const fog = gui.addFolder('Fog').close();
  fog.addColor(params.fog, 'color').name('fog / background');
  fog.add(params.fog, 'near', 0, 20, 0.1);
  fog.add(params.fog, 'far', 1, 40, 0.1);

  const post = gui.addFolder('Post');
  post.add(params.bloom, 'strength', 0, 3, 0.01).name('bloom');
  post.add(params.bloom, 'radius', 0, 1, 0.01).name('bloom radius');
  post.add(params.bloom, 'threshold', 0, 3, 0.01).name('bloom threshold');
  post.add(params.grade, 'vignette', 0, 1, 0.01);
  post.add(params.grade, 'grain', 0, 0.15, 0.001);

  const pr = gui.addFolder('Press');
  pr.add(params.press, 'auto').name('auto-press');
  pr.add(params.press, 'intervalMin', 2, 20, 0.1).name('auto every (min s)');
  pr.add(params.press, 'intervalMax', 2, 20, 0.1).name('auto every (max s)');
  pr.add(params.press, 'capHold', 0, 0.5, 0.01).name('cap hold');
  pr.add(params.press, 'capSpring', 20, 600, 1).name('cap spring');
  pr.add(params.press, 'capDamping', 1, 40, 0.1).name('cap damping');
  pr.add(params.press, 'flash', 0, 3, 0.01);
  pr.add(params.press, 'burst', 0, 10, 0.1).name('comet burst');
  pr.add(params.press, 'quiet', 0.3, 1, 0.01).name('silence glow level');
  pr.add(params.press, 'wave', 0, 4, 0.01).name('shockwave');
  pr.add(params.press, 'waveSpeed', 1, 20, 0.1).name('wave speed');
  pr.add(params.press, 'waveLife', 0.2, 3, 0.01).name('wave life');
  pr.add(params.press, 'waveWidth', 0.05, 1, 0.01).name('wave width');
  pr.addColor(params.press, 'waveColor').name('wave colour');
  pr.add(params.press, 'kick', 0, 10, 0.05);
  pr.add(params.press, 'kickUp', 0, 6, 0.05).name('kick up');
  pr.add(params.press, 'spin', 0, 30, 0.1);
  pr.add(params.press, 'spring', 5, 120, 0.5).name('token spring');
  pr.add(params.press, 'damping', 0.5, 20, 0.1).name('token damping');
  pr.add(params.press, 'revealAt', 0, 1, 0.01).name('reveal starts');
  pr.add(params.press, 'popTime', 0.2, 2, 0.01).name('pop time');
  pr.add(params.press, 'hold', 0, 6, 0.05).name('reveal hold');
  pr.add(params.press, 'returnTime', 0.2, 3, 0.01).name('return time');
  pr.add(params.press, 'revealY', 0, 5, 0.01).name('reveal height');
  pr.add(params.press, 'revealZ', -2, 3, 0.01).name('reveal z');
  pr.add(params.press, 'revealScale', 1, 3, 0.01).name('reveal scale');
  pr.add(params.press, 'revealGlow', 0, 5, 0.05).name('reveal glow');
  pr.add(params.press, 'dimOthers', 0, 1, 0.01).name('dim others');
  pr.add(params.press, 'lean', 0, 1, 0.01).name('pointer lean');
  pr.add(params.press, 'parallax', 0, 1.5, 0.01).name('camera parallax');
  pr.add(params.press, 'hoverLift', 0, 0.3, 0.005).name('hover lift');

  const anim = gui.addFolder('Animation');
  anim.add(params.anim, 'idle', 0, 3, 0.01).name('token idle');
  anim.add(params.anim, 'breathe', 0, 3, 0.01).name('button breathe');

  gui.onChange(changed);

  const actions = {
    press: () => engine.press(),
    copy: async () => {
      const json = JSON.stringify(params, null, 2);
      console.log('[asb] params\n' + json);
      try { await navigator.clipboard.writeText(json); flash('Copied to clipboard'); } catch { flash('Logged to console'); }
    },
    reset: () => {
      merge(params, structuredClone(DEFAULTS));
      try { localStorage.removeItem(STORE); } catch { /* ignore */ }
      engine.applyParams();
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    },
  };
  gui.add(actions, 'press').name('▶ Press');
  gui.add(ui, 'paused').name('pause').onChange((p) => (p ? engine.stop() : engine.start()));
  const quality = { resolution: 'auto' };
  gui.add(quality, 'resolution', ['auto', '0.75', '1', '1.25', '1.5', '2']).name('render resolution')
    .onChange((v) => {
      Object.assign(engine, { holdUntil: 0, holdFor: undefined, lastStep: null });
      if (v === 'auto') engine.setPixelRatio(engine.maxPR);
      else engine.setPixelRatio(Number(v), { fixed: true });
    });
  gui.add(actions, 'copy').name('Copy params (JSON)');
  gui.add(actions, 'reset').name('Reset to defaults');

  // fps readout (over the scene; renders only while the engine renders)
  const fps = document.createElement('div');
  fps.style.cssText = 'position:absolute;left:8px;top:8px;z-index:5;font:11px ui-monospace,monospace;color:#9fdcff;background:#0008;padding:2px 6px;border-radius:3px;pointer-events:none';
  engine.canvas.parentElement?.append(fps);
  let raf, lastText = 0;
  const tick = (now) => {
    raf = requestAnimationFrame(tick);
    if (now - lastText < 250) return; // 4×/s: a per-frame text update costs layout + paint itself
    lastText = now;
    const st = engine.stats;
    fps.textContent = engine.raf
      ? `${st.fps} fps · ${st.pr.toFixed(2)}× res${engine.fixedQuality ? ' (fixed)' : now / 1000 < (engine.holdUntil ?? 0) ? ' (held: not pixel-bound)' : ''}${engine.calm ? ' · calm' : ''}`
      : 'paused';
  };
  raf = requestAnimationFrame(tick);

  function flash(msg) {
    const old = gui.title();
    gui.title(msg);
    setTimeout(() => gui.title(old === msg ? 'Awkward Silence Button lab' : old), 1400);
  }

  engine.applyParams();
  window.asbLab = { engine, params, gui }; // console access for tuning / capture scripts
  return {
    gui,
    dispose() { cancelAnimationFrame(raf); fps.remove(); controls?.dispose(); gui.destroy(); delete window.asbLab; },
  };
}

const r2 = (v) => Math.round(v * 100) / 100;
