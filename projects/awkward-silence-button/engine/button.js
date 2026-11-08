// The big red button, arcade-neon style, built in code: a dark metal lathed plinth with a shallow
// well, a glossy domed cap lit from inside (red inner glow) that says PRESS in Orbitron (the site's
// display face) glowing white, a pink neon ring around the well and a thin cyan ring at the foot.
// A bright comet chases around both rings (arcade marquee): a shader on the ring, one uniform per frame.
// Axis = +Y (it sits on the floor); the label reads upright to a camera in front (+Z) looking down.
// Units: the cap radius is 1 (category tokens are ~1 unit across).
//
// createButton(opts) → { group, cap, ready, apply(look), setPress(p), setGlow(g), setChase(head), dispose }
//   ready      resolves once the label is drawn with the real font (a fallback face is drawn first,
//              so the button never shows blank)
//   apply      live look values from params.button (lab): { red, inner, label, ringPink, ringCyan, … }
//   setPress   0 = up, 1 = fully pressed (cap sinks + squashes). The spring lives in the engine.
//   setGlow    multiplier on all the button's glow (breathe pulse / press flash)
//   setChase   comet head position around the ring, 0..1 (same angle convention as the token ring:
//              0 = +X, increasing counter-clockwise seen from above); the cyan comet runs opposite
import * as THREE from 'three';

const DEFAULTS = {
  label: 'PRESS',
  fontFamily: 'ASB Display',
  fontUrl: '/quasar/fonts/Orbitron-Variable.ttf', // shared with the hero (already cached when you scroll here)
  fontWeights: '400 900', // variable font
  fontWeight: 800,
  labelWidth: 1.3, // label width in units (cap diameter is 2)
  labelOffset: 0.1, // toward the camera (+Z), so the label looks centred from a 3/4 view of the dome
  texSize: 1024,
  segments: 96,
  travel: 0.11, // how far the cap sinks when pressed
};

// Live look (params.button) — defaults here so the module also works on its own.
const LOOK = {
  red: '#e8102e',
  inner: 0.35, // red glow from inside the cap
  innerColor: '#ff1030',
  label: 0.7, // white label glow
  ringPink: 1.1, // steady ring glow
  ringPinkColor: '#ff3fae',
  ringCyan: 0.8,
  ringCyanColor: '#40f2ff',
  chase: 2.6, // comet brightness on top of the steady glow (0 = off)
  chaseTail: 0.1, // comet tail length (fraction of the ring)
  plinth: '#0b0b12',
};

const CAP_R = 1;

// Neon ring with a chasing comet. TorusGeometry's uv.x runs once around the ring (0..1 from +X), and the
// ring is laid flat with rotation.x = −90°, so uv.x matches the token ring angle / 2π.
const RING_VERT = /* glsl */ `
  varying float vU;
  void main() { vU = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const RING_FRAG = /* glsl */ `
  varying float vU;
  uniform vec3 uColor; uniform float uBase, uPeak, uHead, uTail, uDir;
  void main() {
    float d = fract(uDir * (uHead - vU));             // 0 at the comet head, growing along its tail
    float ahead = 1.0 - d;                             // a very short soft front edge
    float comet = exp(-d / uTail) * smoothstep(0.0, 0.012, ahead);
    gl_FragColor = vec4(uColor * (uBase + uPeak * comet), 1.0);
  }`;
function ringMaterial(dir) {
  return new THREE.ShaderMaterial({
    vertexShader: RING_VERT,
    fragmentShader: RING_FRAG,
    uniforms: {
      uColor: { value: new THREE.Color() }, uBase: { value: 1 }, uPeak: { value: 0 },
      uHead: { value: 0 }, uTail: { value: 0.1 }, uDir: { value: dir },
    },
  });
}

// --- profiles (r, y), bottom → top -----------------------------------------------------------------

function plinthProfile() {
  const p = [];
  const R = 1.36, H = 0.24, well = 1.07; // outer radius, height, well radius
  p.push([0.0, 0.0], [R - 0.08, 0.0]);
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI;
    p.push([R - 0.08 + Math.sin(a) * 0.08, H * 0.5 - Math.cos(a) * H * 0.5]);
  }
  p.push([R - 0.2, H + 0.005], [well + 0.07, H], [well + 0.02, H - 0.02], [well, H - 0.07], [well, 0.06], [0, 0.06]);
  return p.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y));
}

function capProfile() {
  const p = [];
  const y0 = 0.02, wall = 0.3, shoulder = 0.13, dome = 0.2; // skirt bottom, wall top, shoulder radius, dome rise
  p.push([0, y0], [CAP_R - 0.02, y0], [CAP_R, y0 + 0.02], [CAP_R, wall]);
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * (Math.PI / 2);
    p.push([CAP_R - shoulder + Math.cos(a) * shoulder, wall + Math.sin(a) * shoulder]);
  }
  const rTop = CAP_R - shoulder, yTop = wall + shoulder;
  for (let i = 1; i <= 16; i++) {
    const t = i / 16;
    p.push([rTop * (1 - t), yTop + dome * Math.sin((t * Math.PI) / 2)]);
  }
  return p.map(([r, y]) => new THREE.Vector2(r, y));
}

// Planar (top-down) UVs so the label sits flat on the dome: u ← x, v ← −z (canvas top = far side).
function planarUV(geo, radius) {
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = 0.5 + pos.getX(i) / (2 * radius);
    uv[i * 2 + 1] = 0.5 - pos.getZ(i) / (2 * radius);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// --- label textures: colour (red + white text) and mask (white text on black: emboss + glow) -----

function drawLabel(colorCanvas, maskCanvas, o, red, family) {
  const S = colorCanvas.width;
  const target = (o.labelWidth / (2 * CAP_R)) * S;
  const dy = (o.labelOffset / (2 * CAP_R)) * S; // canvas down = +Z
  for (const [canvas, bg, ink] of [[colorCanvas, red, '#ffffff'], [maskCanvas, '#000000', '#ffffff']]) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, S, S);
    let px = S * 0.2;
    const setFont = () => {
      ctx.font = `${o.fontWeight} ${px}px ${family}`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${px * 0.2}px`;
    };
    // trailing tracking after the last letter is not ink: leave it out of the width and the centring
    const inkWidth = () => ctx.measureText(o.label).width - ('letterSpacing' in ctx ? px * 0.2 : 0);
    setFont();
    px *= target / inkWidth();
    setFont();
    ctx.fillStyle = ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(o.label, (S - inkWidth()) / 2, S / 2 + dy + px * 0.04);
  }
}

export function createButton(options = {}) {
  const o = { ...DEFAULTS, ...options };
  const look = { ...LOOK, ...options.look };
  const group = new THREE.Group();
  group.name = 'asb_button';

  // plinth: dark metal
  const plinthGeo = new THREE.LatheGeometry(plinthProfile(), o.segments);
  const plinthMat = new THREE.MeshPhysicalMaterial({
    color: look.plinth,
    roughness: 0.25,
    metalness: 0.85,
    clearcoat: 0.4,
    clearcoatRoughness: 0.3,
  });
  const plinth = new THREE.Mesh(plinthGeo, plinthMat);
  plinth.name = 'asb_button_plinth';
  group.add(plinth);

  // neon rings: pink around the well, thin cyan at the foot (unlit, HDR colour → bloom)
  const ringPinkMat = ringMaterial(1);
  const ringPinkGeo = new THREE.TorusGeometry(1.2, 0.025, 12, 128);
  const ringPink = new THREE.Mesh(ringPinkGeo, ringPinkMat);
  ringPink.rotation.x = -Math.PI / 2;
  ringPink.position.y = 0.245;
  ringPink.name = 'asb_button_ring_pink';
  const ringCyanMat = ringMaterial(-1);
  const ringCyanGeo = new THREE.TorusGeometry(1.37, 0.012, 8, 128);
  const ringCyan = new THREE.Mesh(ringCyanGeo, ringCyanMat);
  ringCyan.rotation.x = -Math.PI / 2;
  ringCyan.position.y = 0.03;
  ringCyan.name = 'asb_button_ring_cyan';
  group.add(ringPink, ringCyan);

  // cap (+ label)
  const colorCanvas = document.createElement('canvas');
  const maskCanvas = document.createElement('canvas');
  colorCanvas.width = colorCanvas.height = maskCanvas.width = maskCanvas.height = o.texSize;
  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const mask = new THREE.CanvasTexture(maskCanvas);
  mask.anisotropy = 4;
  let family = `"${o.fontFamily}", system-ui, sans-serif`;
  const redraw = () => {
    drawLabel(colorCanvas, maskCanvas, o, look.red, family);
    map.needsUpdate = mask.needsUpdate = true;
  };
  redraw();

  const capGeo = new THREE.LatheGeometry(capProfile(), o.segments);
  planarUV(capGeo, CAP_R);
  const inner = { value: new THREE.Color() };
  const capMat = new THREE.MeshPhysicalMaterial({
    map,
    roughness: 0.18,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    bumpMap: mask,
    bumpScale: 3,
    emissive: new THREE.Color('#ffffff'),
    emissiveMap: mask, // only the label glows white
  });
  // + a soft inner glow, stronger where the dome faces the camera (reads as light inside the cap)
  capMat.onBeforeCompile = (sh) => {
    sh.uniforms.uInner = inner;
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'uniform vec3 uInner;\nvoid main() {')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += uInner * (0.6 + 0.4 * abs(dot(normal, normalize(vViewPosition))));`,
      );
  };
  capMat.customProgramCacheKey = () => 'asb-cap';
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.name = 'asb_button_cap';
  const capPivot = new THREE.Group();
  capPivot.position.y = 0.06;
  capPivot.add(cap);
  group.add(capPivot);

  let glow = 1;
  const apply = (next = {}) => {
    const redChanged = next.red && next.red !== look.red;
    Object.assign(look, next);
    plinthMat.color.set(look.plinth);
    for (const [m, color, base] of [[ringPinkMat, look.ringPinkColor, look.ringPink], [ringCyanMat, look.ringCyanColor, look.ringCyan]]) {
      const u = m.uniforms;
      u.uColor.value.set(color);
      u.uBase.value = base * glow;
      u.uPeak.value = look.chase * base * glow;
      u.uTail.value = look.chaseTail;
    }
    inner.value.set(look.innerColor).multiplyScalar(look.inner * glow);
    capMat.emissiveIntensity = look.label * glow;
    if (redChanged) redraw();
  };
  apply();

  // font: load (optionally from a URL), then redraw the label with it
  const ready = (async () => {
    if (typeof document === 'undefined' || !document.fonts) return;
    try {
      if (o.fontUrl) {
        const face = new FontFace(o.fontFamily, `url(${o.fontUrl})`, { weight: o.fontWeights });
        document.fonts.add(await face.load());
      }
      const spec = `${o.fontWeight} 100px "${o.fontFamily}"`;
      await document.fonts.load(spec);
      if (document.fonts.check(spec)) {
        family = `"${o.fontFamily}"`;
        redraw();
      }
    } catch {
      // keep the fallback label
    }
  })();

  return {
    group,
    cap: capPivot,
    ready,
    apply,
    setPress(p) {
      const k = THREE.MathUtils.clamp(p, 0, 1.2);
      capPivot.position.y = 0.06 - o.travel * k;
      capPivot.scale.set(1 + 0.035 * k, 1 - 0.14 * k, 1 + 0.035 * k);
    },
    setGlow(g) {
      glow = g;
      apply();
    },
    setChase(head) {
      ringPinkMat.uniforms.uHead.value = head;
      ringCyanMat.uniforms.uHead.value = -head; // the cyan comet runs the other way
    },
    dispose() {
      for (const x of [plinthGeo, plinthMat, ringPinkGeo, ringPinkMat, ringCyanGeo, ringCyanMat, capGeo, capMat, map, mask]) x.dispose();
      group.removeFromParent();
    },
  };
}
