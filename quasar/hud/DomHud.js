// The visor HUD: plain DOM + SVG, styled by hud.css. It reads engine state from the bridge through
// contract.js, and sends button clicks back as bridge commands. Returns a dispose function.
import { READOUTS, BUTTONS, viewModelValues } from './contract.js';
import { MODES } from '../bridge.js';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

function corner(pos) {
  return `<svg class="corner ${pos}" viewBox="0 0 64 64" aria-hidden="true">
    <path d="M2 30 V2 H30" /><path class="thin" d="M8 44 V8 H44" /><rect x="0" y="0" width="5" height="5" class="dot"/>
  </svg>`;
}

function readout(key, i) {
  const e = el('section', 'readout');
  e.dataset.key = key;
  const bars = Array.from({ length: 28 }, (_, k) => `<i style="--k:${k}"></i>`).join('');
  e.innerHTML = `
    <header><span class="idx">${String(i + 1).padStart(2, '0')}</span><span class="label"></span><span class="led"></span></header>
    <div class="value"></div>
    <div class="unit"></div>
    <div class="bar"><b></b><span class="ticks"></span></div>
    <div class="wave">${bars}</div>`;
  return e;
}

function dial(key, label) {
  const e = el('div', 'dial');
  e.dataset.key = key;
  e.innerHTML = `<svg viewBox="0 0 120 120" aria-hidden="true">
      <circle class="track" cx="60" cy="60" r="46" pathLength="100"/>
      <circle class="fill" cx="60" cy="60" r="46" pathLength="100"/>
      <g class="spin"><circle class="ring" cx="60" cy="60" r="55" pathLength="100"/></g>
    </svg><div class="dial-text"><span class="value"></span><span class="label">${label}</span></div>`;
  return e;
}

function button(key) {
  const b = el('button', 'hud-btn' + (BUTTONS[key].label?.length === 1 ? ' step' : ''));
  b.dataset.key = key;
  b.type = 'button';
  b.innerHTML = `<span></span>`;
  return b;
}

export function mountDomHud(root, { params, telemetry, dispatch }) {
  root.innerHTML = '';
  root.classList.add('dom-hud');

  const frame = el('div', 'frame');
  frame.innerHTML = corner('tl') + corner('tr') + corner('bl') + corner('br') + `<div class="grid"></div><div class="scan"></div>`;

  const top = el('div', 'topbar fade');
  top.innerHTML = `
    <div class="brand"><span class="mark"></span><div><div class="title">QSR-7 · DEEP FIELD VISOR</div><div class="sub">RELATIVISTIC OBSERVATION ARRAY</div></div></div>
    <div class="phase"><div class="phase-row"><span class="phase-index"></span><span class="phase-label"></span></div><div class="segments">${'<i></i>'.repeat(5)}<b></b></div></div>
    <div class="clock"><span class="mode"></span><span class="timecode"></span></div>
    <div class="alert">⚠ ENERGY ANOMALY DETECTED</div>`;

  const left = el('div', 'column left fade');
  const right = el('div', 'column right fade');
  READOUTS.forEach((k, i) => (i < 3 ? left : right).append(readout(k, i)));

  const reticle = el('div', 'reticle fade');
  reticle.innerHTML = `<svg viewBox="-200 -200 400 400" aria-hidden="true">
      <g class="r-outer"><circle r="186" pathLength="360"/></g>
      <g class="r-ticks">${Array.from({ length: 72 }, (_, i) => `<line y1="-176" y2="${i % 6 ? -170 : -164}" transform="rotate(${i * 5})"/>`).join('')}</g>
      <g class="r-brackets"><path d="M-120 -70 A140 140 0 0 1 -70 -120"/><path d="M70 -120 A140 140 0 0 1 120 -70"/><path d="M120 70 A140 140 0 0 1 70 120"/><path d="M-70 120 A140 140 0 0 1 -120 70"/></g>
      <g class="r-cross"><line x1="-200" x2="-150"/><line x1="150" x2="200"/><line y1="-200" y2="-150"/><line y1="150" y2="200"/></g>
    </svg><div class="r-status"></div><div class="r-range"></div>`;

  const middle = el('div', 'middle');
  middle.append(left, reticle, right);

  const deck = el('div', 'deck');
  const rot = el('div', 'dial-group');
  rot.append(dial('rotDial', 'ROTATION'), el('div', 'steps'));
  rot.lastChild.append(button('rotUp'), button('rotDown'));
  const center = el('div', 'deck-center');
  center.append(button('btnPlay'), button('btnRestart'), button('btnMode'), button('btnHud'));
  const jet = el('div', 'dial-group');
  jet.append(el('div', 'steps'), dial('jetDial', 'JET POWER'));
  jet.firstChild.append(button('jetUp'), button('jetDown'));
  deck.append(rot, center, jet);

  root.append(frame, top, middle, deck);

  root.querySelectorAll('.hud-btn').forEach((b) => {
    b.addEventListener('click', () => { b.classList.remove('ping'); void b.offsetWidth; b.classList.add('ping'); dispatch(BUTTONS[b.dataset.key].event); });
  });

  const q = (s) => root.querySelector(s);
  const waves = new Map();
  const render = () => {
    const P = params.get(), Tm = telemetry.get();
    const v = viewModelValues(P, Tm, MODES);
    root.classList.toggle('hidden', !v.hudVisible);
    root.classList.toggle('alerting', !!v['header/alert']);
    root.classList.toggle('locked', !!v['reticle/locked']);
    root.dataset.phase = v.phase;
    q('.phase-index').textContent = v['header/phaseIndex'];
    q('.phase-label').textContent = v['header/phaseLabel'];
    q('.segments b').style.width = `${(v['header/progress'] * 100).toFixed(1)}%`;
    q('.timecode').textContent = v['header/timecode'];
    q('.mode').textContent = v['header/modeLabel'];
    q('.r-status').textContent = v['reticle/status'];
    q('.r-range').textContent = v['reticle/range'];
    for (const key of READOUTS) {
      const r = root.querySelector(`.readout[data-key="${key}"]`);
      if (v[`${key}/label`] == null) continue;
      r.querySelector('.label').textContent = v[`${key}/label`];
      r.querySelector('.value').textContent = v[`${key}/value`];
      r.querySelector('.unit').textContent = v[`${key}/unit`];
      r.querySelector('.bar b').style.transform = `scaleX(${Math.max(0.005, v[`${key}/level`])})`;
      r.classList.toggle('alert', !!v[`${key}/alert`]);
      // waveform: amplitude follows the level, phase drifts
      const lvl = v[`${key}/level`];
      const ph = (waves.get(key) ?? Math.random() * 10) + 0.35;
      waves.set(key, ph);
      r.querySelectorAll('.wave i').forEach((i, k) => {
        const a = 0.12 + 0.88 * lvl * (0.55 + 0.45 * Math.sin(k * 0.55 + ph) * Math.sin(k * 0.19 - ph * 0.6));
        i.style.transform = `scaleY(${Math.max(0.06, Math.abs(a)).toFixed(3)})`;
      });
    }
    for (const d of ['rotDial', 'jetDial']) {
      const n = q(`.dial[data-key="${d}"]`);
      n.querySelector('.value').textContent = v[`${d}/value`];
      n.querySelector('.fill').style.strokeDasharray = `${(v[`${d}/level`] * 75).toFixed(2)} 100`;
    }
    for (const key in BUTTONS) {
      const b = q(`.hud-btn[data-key="${key}"]`);
      b.firstChild.textContent = v[`${key}/label`] ?? BUTTONS[key].label;
      b.classList.toggle('active', !!v[`${key}/active`]);
    }
  };
  const unsubs = [params.subscribe(render), telemetry.subscribe(render)];
  root.dataset.hud = 'dom';
  return () => {
    unsubs.forEach((u) => u());
    root.innerHTML = '';
    root.classList.remove('dom-hud');
    delete root.dataset.hud;
  };
}
