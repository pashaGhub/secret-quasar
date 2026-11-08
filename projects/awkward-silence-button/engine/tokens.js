// The seven category tokens from icons.glb, as neon signs: dark glossy bodies whose edges, walls and
// holes glow in the category colour (fresnel rim → emissive, so bloom picks it up). Dim hues (violet,
// blue, pink) are lifted so every token glows about as strongly as cyan and yellow.
// icons.glb stores no normals; they are rebuilt here with a crease angle (see the plan, Phase 1).
import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

export const CATEGORY_KEYS = ['personal', 'romantic', 'philosophical', 'culture', 'common', 'food', 'travelAndAdventure'];

function neonMaterial() {
  const u = { uRim: { value: new THREE.Color() }, uPow: { value: 2 } };
  const m = new THREE.MeshPhysicalMaterial({ roughness: 0.32, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.15 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'uniform vec3 uRim; uniform float uPow;\nvoid main() {')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += uRim * pow(1.0 - abs(dot(normal, normalize(vViewPosition))), uPow);`,
      );
  };
  m.customProgramCacheKey = () => 'asb-neon-token';
  m.userData.u = u;
  return m;
}

/**
 * @param {THREE.Object3D} gltfScene  the loaded icons.glb scene
 * @returns {{ group: THREE.Group, items: {key: string, node: THREE.Object3D, mesh: THREE.Mesh, mat: THREE.Material, base: THREE.Vector3, phase: number}[],
 *   apply(params: object, camera: THREE.Camera): void, update(t: number, params: object): void }}
 */
export function createTokens(gltfScene) {
  const group = new THREE.Group();
  group.name = 'asb_tokens';
  const items = [];
  CATEGORY_KEYS.forEach((key, i) => {
    const node = gltfScene.getObjectByName(key);
    if (!node) throw new Error(`icons.glb: missing node "${key}"`);
    let mesh = null;
    node.traverse((o) => { if (o.isMesh) mesh = o; });
    const raw = mesh.geometry;
    mesh.geometry = toCreasedNormals(raw, THREE.MathUtils.degToRad(35));
    raw.dispose();
    mesh.userData.crease = 35;
    mesh.material.dispose();
    const mat = neonMaterial();
    mesh.material = mat;
    // pivot: the engine moves `holder`; the glb node keeps its own transform underneath
    const holder = new THREE.Group();
    holder.name = `asb_token_${key}`;
    holder.add(node);
    node.position.set(0, 0, 0);
    group.add(holder);
    items.push({
      key, node: holder, mesh, mat, base: new THREE.Vector3(), quat: new THREE.Quaternion(), phase: i * 0.9,
      // dynamic state, driven by press.js: kick offset + spin (springs), reveal blend, pop scale, glow
      off: new THREE.Vector3(), offV: new THREE.Vector3(), spin: 0, spinV: 0,
      reveal: 0, pop: 0, wobble: 0, glow: 1, flare: 0,
    });
  });

  const tmp = new THREE.Object3D();
  const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qr = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  return {
    group,
    items,
    /** Layout + materials from params (call on params change and on camera change). */
    apply(P) {
      const T = P.tokens;
      items.forEach((it, i) => {
        // crease angle is geometry: rebuild only when it changes
        if (it.mesh.userData.crease !== T.crease) {
          const g = it.mesh.geometry;
          it.mesh.geometry = toCreasedNormals(g, THREE.MathUtils.degToRad(T.crease));
          g.dispose();
          it.mesh.userData.crease = T.crease;
        }
        // colour: lift dim hues so every token glows about equally (linear luminance)
        const c = new THREE.Color(P.colors[it.key]);
        const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
        const eq = THREE.MathUtils.clamp(Math.pow(0.65 / Math.max(lum, 1e-3), 0.75), 1, 2.6);
        it.mat.color.set(T.body);
        it.mat.emissive.copy(c);
        it.mat.emissiveIntensity = T.faceGlow * eq;
        it.rim = c.clone().multiplyScalar(T.rim * eq);
        it.mat.userData.u.uRim.value.copy(it.rim);
        it.mat.userData.u.uPow.value = T.rimPow;

        // ring around the button, starting at the back, going counter-clockwise seen from above
        const a = Math.PI / 2 + (i / items.length) * Math.PI * 2;
        it.u = a / (Math.PI * 2); // ring position 0..1 (for the chasing comet)
        it.base.set(Math.cos(a) * T.radius, T.height + T.jitter * Math.sin(i * 1.7), -Math.sin(a) * T.radius * T.depth);
        // face a point above the camera side, then roll a little (alternating) — like stickers on the app
        tmp.position.copy(it.base);
        tmp.lookAt(P.camera.x * 0.3, T.face, P.camera.z + 1.4);
        tmp.rotateZ((i % 2 ? 1 : -1) * T.tilt);
        it.quat.copy(tmp.quaternion);
      });
    },
    /** The ring comet (head 0..1) passing a token's angle brightens its edges for a moment. */
    setChase(head, P) {
      const k = P.tokens.chase;
      for (const it of items) {
        const d = (((head - (it.u ?? 0)) % 1) + 1) % 1; // how far the comet is past this token
        it.flare = k * Math.exp(-d / 0.07);
      }
    },
    /**
     * Pose every token: ring place + idle (the app's `icon-idle`: slow bob + ±1.5° rock, 3.5 s, out of
     * phase) + kick offset/spin + pointer lean, blended toward the reveal pose by `it.reveal`.
     * @param {number} t  time (s)
     * @param {object} P  effective params
     * @param {{ lean: {x: number, y: number}, revealPos: THREE.Vector3, revealQuat: THREE.Quaternion, energy: number }} s
     */
    update(t, P, s) {
      const k = P.anim.idle;
      const lean = P.press.lean;
      for (const it of items) {
        const w = (t / 3.5) * Math.PI * 2 + it.phase;
        pos.copy(it.base).add(it.off);
        pos.y += Math.sin(w) * 0.06 * k;
        // ring orientation: base → idle rock → spin (world Y) → lean toward the pointer
        qr.copy(it.quat).multiply(qa.setFromAxisAngle(Z, THREE.MathUtils.degToRad(1.5) * Math.sin(w * 0.5 + 1.3) * k));
        qr.premultiply(qa.setFromAxisAngle(Y, it.spin + s.lean.x * lean));
        qr.premultiply(qa.setFromAxisAngle(X, -s.lean.y * lean * 0.6));
        if (it.reveal > 0) {
          const r = Math.min(1, it.reveal);
          pos.lerp(s.revealPos, r);
          qb.copy(s.revealQuat).multiply(qa.setFromAxisAngle(Z, it.wobble));
          qr.slerp(qb, r);
        }
        it.node.position.copy(pos);
        it.node.quaternion.copy(qr);
        it.node.scale.setScalar(P.tokens.scale * (1 + (P.press.revealScale - 1) * it.pop));
        if (it.rim) it.mat.userData.u.uRim.value.copy(it.rim).multiplyScalar((1 + it.flare) * it.glow * s.energy);
      }
    },
  };
}
