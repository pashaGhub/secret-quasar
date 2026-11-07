// The tome's behaviour: closed → unlock (clasp swings, rune flares, spark burst) → opens; then page
// turns; and it can be closed again (cover swings shut, clasp re-locks) and reopened. Page turns bend the single 24-segment turn page in its vertex shader (with a curl), show
// the current spread on its front and the next spread on its back, and leave a trail of sparks.
// Pages are "spreads" (one texture each: left page u 0–0.5, right page u 0.5–1). Today there is one
// spread (page_atlas.jpg); real text can be added later as more textures (e.g. CanvasTextures).
import * as THREE from 'three';
import { ease, bump } from './idle.js';

const PAGE_W = 0.3;          // page width from the gutter (Blender W)
const PAGE_H = 0.4;

export function createBook(n, { calm, sparks, emit }) {
  const front = n('book__front'), back = n('book__back'), spine = n('book__spine'), clasp = n('book__clasp');
  const turnJoint = n('book__page_turn');
  const turnMesh = n('book__page_turn__mesh');
  const pagesL = n('book__pages_L__mesh'), pagesR = n('book__pages_R__mesh');
  const root = n('book');

  // --- page materials: L and R get their own copy so they can show different spreads mid-turn,
  // plus a crossfade (reduced-motion "turn").
  // Pages are self-lit: they ignore the scene lights (which would blow them out) and show the
  // parchment at a fixed brightness, shaded only by their own orientation (so the curl reads).
  const pageLight = { uPageBright: { value: 1 }, uPageShade: { value: 1 } };
  const SELF_LIT = /* glsl */ `
    float pageFacing = clamp(dot(normal, normalize(vec3(0.0, 0.55, 0.85))), 0.0, 1.0);
    outgoingLight = pageTex.rgb * uPageBright * mix(1.0, 0.4 + 0.6 * pageFacing, uPageShade);
    #include <opaque_fragment>`;
  const paperR = findMaterial(pagesR, 'book_paper');
  const paperL = paperR.clone();
  const spreads = [paperR.map];
  const pageMats = [paperL, paperR];
  for (const m of pageMats) {
    m.userData.u = { uMap2: { value: paperR.map }, uMix: { value: 0 } };
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, m.userData.u, pageLight);
      sh.fragmentShader = sh.fragmentShader
        .replace('void main() {', 'uniform sampler2D uMap2; uniform float uMix, uPageBright, uPageShade;\nvoid main() {')
        .replace('#include <map_fragment>', `
          vec4 pageTex = mix(texture2D(map, vMapUv), texture2D(uMap2, vMapUv), uMix);
          diffuseColor *= pageTex;`)
        .replace('#include <emissivemap_fragment>', '')
        .replace('#include <opaque_fragment>', SELF_LIT);
    };
    m.customProgramCacheKey = () => 'sm-page';
  }
  // pages_* meshes have two primitives (paper + gilt edge) → three makes them child meshes or a
  // multi-material mesh; swap only the paper material wherever it is used
  swapMaterial(pagesL, findMaterial(pagesL, 'book_paper'), paperL);

  // --- turn page: bend in the vertex shader, front = current spread, back = next spread
  const turnMat = turnMesh.material;
  turnMesh.updateMatrix();
  const tu = {
    uTurn: { value: 0 }, uCurl: { value: 0 }, uLift: { value: 0 },
    uMeshM: { value: turnMesh.matrix.clone() }, uMeshMInv: { value: turnMesh.matrix.clone().invert() },
    uBackMap: { value: spreads[0] },
  };
  turnMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, tu, pageLight);
    sh.vertexShader = sh.vertexShader
      .replace('void main() {', 'uniform float uTurn, uCurl, uLift; uniform mat4 uMeshM, uMeshMInv;\nvoid main() {')
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        {
          vec3 pj = (uMeshM * vec4(transformed, 1.0)).xyz;   // joint space: x from the gutter, z along the spine
          float s = pj.x, th = uTurn, a = uCurl;
          vec2 xy = abs(a) < 1e-4
            ? vec2(s * cos(th), s * sin(th))
            : vec2((sin(th + a * s) - sin(th)) / a, (cos(th) - cos(th + a * s)) / a);
          pj = vec3(xy.x, pj.y + xy.y + uLift * s, pj.z);
          transformed = (uMeshMInv * vec4(pj, 1.0)).xyz;
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'uniform sampler2D uBackMap; uniform float uPageBright, uPageShade;\nvoid main() {')
      .replace('#include <map_fragment>', `
        vec4 pageTex = gl_FrontFacing ? texture2D(map, vMapUv) : texture2D(uBackMap, vec2(1.0 - vMapUv.x, vMapUv.y));
        diffuseColor *= pageTex;`)
      .replace('#include <emissivemap_fragment>', '')
      .replace('#include <opaque_fragment>', SELF_LIT);
  };
  turnMat.customProgramCacheKey = () => 'sm-turn-page';
  turnMesh.castShadow = false;
  turnMesh.visible = false;
  turnMesh.frustumCulled = false;   // the bent page leaves its original bounds

  const S = {
    state: calm ? 'open' : 'closed',
    t: 0, open: calm ? 1 : 0, clasp: calm ? 1 : 0, flash: 0,
    spread: 0, turn: null, turns: 0, pendingClose: false,
  };

  const tmp = new THREE.Vector3();
  const edge = (theta, curl, z) => {
    const s = PAGE_W, a = curl;
    const x = Math.abs(a) < 1e-4 ? s * Math.cos(theta) : (Math.sin(theta + a * s) - Math.sin(theta)) / a;
    const y = Math.abs(a) < 1e-4 ? s * Math.sin(theta) : (Math.cos(theta) - Math.cos(theta + a * s)) / a;
    return turnJoint.localToWorld(tmp.set(x, y + 0.002, z));
  };

  function setOpen(u, vtilt) {
    const tilt = vtilt * u;
    front.rotation.z = Math.PI * u - tilt;
    back.rotation.z = tilt;
    spine.rotation.z = (Math.PI / 2) * u;
  }

  const openTime = (A) => (calm ? 0.35 : A.openTime);
  const closeTime = (A) => (calm ? 0.25 : Math.max(0.4, A.openTime * 0.6));
  let lastA = null;
  function startClose() {
    S.state = 'closing'; S.t = 0; S.pendingClose = false;
    emit('close-start', { duration: lastA ? closeTime(lastA) : 1.3 });
  }

  return {
    get state() { return S.state; },
    get isOpen() { return S.state === 'open'; },
    get turning() { return !!S.turn; },
    /** 0..1 how open the book is (drives light / page glow). */
    get open() { return S.open; },
    /** 0..1 extra flare (unlock, page turn). */
    get flash() { return S.flash; },

    /** Unlock and open (first view, a click on the closed tome, or the Open button). */
    requestOpen() {
      if (S.state !== 'closed') return;
      S.state = 'unlocking'; S.t = 0;
    },
    /** Close the book (animated). A page turn in progress finishes first. Returns false if not open. */
    requestClose() {
      if (S.state !== 'open') return false;
      if (S.turn) { S.pendingClose = true; return true; }
      startClose();
      return true;
    },
    /** Snap shut with no animation (lab "replay"). */
    close() {
      S.state = 'closed'; S.t = 0; S.open = 0; S.clasp = 0; S.flash = 0; S.turn = null; S.pendingClose = false;
      turnMesh.visible = false;
      for (const m of pageMats) m.userData.u.uMix.value = 0;
      emit('closed', {});
    },
    /** Turn to the next spread. Returns false if the book is closed or already turning. */
    turnPage() {
      if (S.state !== 'open' || S.turn) return false;
      const from = S.spread, to = (S.spread + 1) % spreads.length;
      S.turn = { t: 0, from, to };
      S.turns++;
      if (calm) {
        paperL.userData.u.uMap2.value = spreads[to]; paperR.userData.u.uMap2.value = spreads[to];
      } else {
        paperR.map = spreads[to]; paperR.emissiveMap = spreads[to];   // revealed under the turning page
        turnMat.map = spreads[from]; turnMat.emissiveMap = spreads[from];
        tu.uBackMap.value = spreads[to];
        turnMesh.visible = true;
      }
      emit('turn', { from, to });
      return true;
    },
    /** Add a spread (texture with left|right pages). Returns its index. */
    addSpread(tex) { spreads.push(tex); return spreads.length - 1; },

    update(dt, P) {
      const A = P.anim, vtilt = (P.book.vtilt * Math.PI) / 180;
      lastA = A;
      S.flash = Math.max(0, S.flash - dt * 1.6);
      if (S.state === 'unlocking') {
        S.t += dt;
        // reduced motion: no flare or sparks, and a short plain open
        const unlockT = calm ? 0.15 : 0.45;
        S.clasp = ease.inOutCubic(Math.min(1, S.t / (unlockT + 0.1)));
        if (!calm) S.flash = Math.max(S.flash, bump(Math.min(1, S.t / 0.6)));
        if (S.t >= unlockT) {
          root.getWorldPosition(tmp);
          if (!calm && A.sparks > 0) sparks.emit(tmp, Math.round(110 * A.sparks), { speed: 1.5, up: 0.7, lifeTime: 1.4 });
          S.state = 'opening'; S.t = 0;
          emit('open-start', { duration: openTime(A) });
        }
      } else if (S.state === 'opening') {
        S.t += dt;
        const k = Math.min(1, S.t / openTime(A));
        S.open = ease.inOutCubic(k);
        if (k >= 1) { S.state = 'open'; emit('opened', {}); }
      } else if (S.state === 'closing') {
        // cover swings shut (from wherever it is), then the clasp swings back and locks with a small flare
        S.t += dt;
        const ct = closeTime(A), lockT = calm ? 0.1 : 0.45;
        const k = Math.min(1, S.t / ct);
        S.open = Math.min(S.open, 1 - ease.inOutCubic(k));
        if (k >= 1) {
          const kl = Math.min(1, (S.t - ct) / lockT);
          S.clasp = 1 - ease.inOutCubic(kl);
          if (!calm) S.flash = Math.max(S.flash, 0.45 * bump(kl));
          if (kl >= 1) { S.state = 'closed'; S.t = 0; S.clasp = 0; emit('closed', {}); }
        }
      }
      clasp.rotation.z = -2.9 * S.clasp;
      setOpen(S.open, vtilt);

      if (S.turn) {
        const T = S.turn;
        const dur = calm ? 0.6 : A.turnTime;
        T.t += dt;
        const k = Math.min(1, T.t / dur);
        if (calm) {
          for (const m of pageMats) m.userData.u.uMix.value = ease.inOutSine(k);
        } else {
          const e = ease.inOutSine(k);
          const theta = vtilt + (Math.PI - 2 * vtilt) * e;
          const curl = (A.curl * Math.sin(Math.PI * e) * 2.2) / PAGE_W;
          tu.uTurn.value = theta; tu.uCurl.value = curl; tu.uLift.value = 0.08 * Math.sin(Math.PI * e);
          if (A.sparks > 0 && k > 0.05 && k < 0.92) {
            const z = (Math.random() - 0.5) * PAGE_H * 0.95;
            const p = edge(theta, curl, z);
            sparks.emit(p, Math.random() < 0.6 * A.sparks ? 2 : 1, { speed: 0.35, up: 0.25, spread: 0.6, lifeTime: 0.9, sizeMul: 0.8 });
          }
        }
        if (!calm) S.flash = Math.max(S.flash, 0.18 * Math.sin(Math.PI * k));
        if (k >= 1) {
          // the turned page has landed: everything now shows the new spread
          const tex = spreads[T.to];
          for (const m of pageMats) { m.map = tex; m.emissiveMap = tex; m.userData.u.uMix.value = 0; m.userData.u.uMap2.value = tex; }
          turnMesh.visible = false;
          S.spread = T.to; S.turn = null;
          emit('turned', { spread: S.spread });
          if (S.pendingClose) startClose();
        }
      }
    },
    /** World-space box around the book, for pointer picking. */
    bounds(box) {
      box.setFromObject(root);
      return box.expandByScalar(0.04);
    },
    pageMaterials: pageMats,
    /** Self-lit page brightness / orientation shading (set every frame by the engine). */
    pageLight,
  };
}

function findMaterial(obj, name) {
  let found = null;
  obj.traverse((o) => {
    if (found || !o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m.name === name) { found = m; break; }
  });
  return found;
}

function swapMaterial(obj, from, to) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    if (Array.isArray(o.material)) o.material = o.material.map((m) => (m === from ? to : m));
    else if (o.material === from) o.material = to;
  });
}
