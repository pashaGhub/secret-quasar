// Static staging of scene.glb: who stands where, resting poses, shadows and material tweaks.
// Animation (Phase 4) layers on top of the poses set here.
import * as THREE from 'three';

const DEG = Math.PI / 180;
export const CHARACTERS = ['avatar', 'wise_old_man', 'nieve', 'chicken', 'sheep'];

/** Resting pose per joint: [x, y, z] radians, applied on top of the glTF rest pose. */
export const POSE = {
  wise_old_man__shoulder_R: [-1.08, 0, 0.2],   // storyteller: right hand raised toward the book
  wise_old_man__elbow_R: [-0.5, 0, 0],
  wise_old_man__neck: [0.14, -0.1, 0],
  avatar__neck: [0.08, 0.12, 0],
  avatar__shoulder_L: [0, 0, -0.06],
  avatar__shoulder_R: [0, 0, 0.06],
  nieve__torso_base: [0, 0, -0.04],            // leaning on the spear
  nieve__neck: [0.05, 0.25, 0],
  sheep__neck: [0.84, 0, 0],                   // grazing
  chicken__neck: [0.25, 0, 0],
};

export function stage(root, params) {
  const n = (name) => root.getObjectByName(name);
  const nodes = {};
  for (const name of [...CHARACTERS, 'book', 'circle', 'ground']) nodes[name] = n(name);

  for (const [joint, r] of Object.entries(POSE)) n(joint)?.rotation.set(r[0], r[1], r[2]);

  const mats = {};
  root.traverse((o) => {
    if (!o.isMesh) return;
    const top = topLevel(o, root);
    o.castShadow = CHARACTERS.includes(top) || o.name.includes('menhir');
    o.receiveShadow = top === 'ground' || top === 'circle';
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      (mats[m.name] ??= new Set()).add(m);
      tweak(m);
    }
  });
  // the turn page lies exactly on the right page until a turn starts (Phase 4)
  const turn = n('book__page_turn__mesh');
  if (turn) turn.visible = false;

  // characters stand on the stone dais when they're inside the circle (it's ~6 cm tall)
  nodes.floor = makeFloor(n('circle__dais__mesh'));
  nodes.feet = Object.fromEntries(CHARACTERS.map((c) => [c, footprint(nodes[c])]));

  apply(nodes, n, params);
  // name → every material instance with that name (GLTFLoader may make variants of one material)
  const each = (name, fn) => mats[name]?.forEach(fn);
  return { nodes, mats, each, n };
}

/** Lowest vertices of a character (its soles), in the character's own space, as [x, z] pairs. */
function footprint(root) {
  if (!root) return [];
  root.updateWorldMatrix(true, true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const m = new THREE.Matrix4(), v = new THREE.Vector3(), pts = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    m.multiplyMatrices(toRoot, o.matrixWorld);
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      if (v.y < 0.02) pts.push([v.x, v.z]);
    }
  });
  return pts;
}

/** Height of the dais top under a world (x, z), or null off the dais. Triangles kept in dais space. */
function makeFloor(mesh) {
  if (!mesh) return null;
  const pos = mesh.geometry.attributes.position, idx = mesh.geometry.index;
  const V = (i) => new THREE.Vector3().fromBufferAttribute(pos, i);
  const tris = [];
  const count = idx ? idx.count : pos.count;
  for (let i = 0; i < count; i += 3) {
    const t = [0, 1, 2].map((k) => V(idx ? idx.getX(i + k) : i + k));
    if (new THREE.Triangle(...t).getNormal(new THREE.Vector3()).y > 0.5) tris.push(t);   // upward faces only
  }
  const inv = new THREE.Matrix4(), p = new THREE.Vector3();
  return {
    begin() { mesh.updateWorldMatrix(true, false); inv.copy(mesh.matrixWorld).invert(); },
    /** world point → highest upward face below it, back in world y */
    at(x, z) {
      p.set(x, 10, z).applyMatrix4(inv);
      let best = null;
      for (const [a, b, c] of tris) {
        const d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
        if (Math.abs(d) < 1e-12) continue;
        const l1 = ((b.z - c.z) * (p.x - c.x) + (c.x - b.x) * (p.z - c.z)) / d;
        const l2 = ((c.z - a.z) * (p.x - c.x) + (a.x - c.x) * (p.z - c.z)) / d;
        const l3 = 1 - l1 - l2;
        if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
        const y = l1 * a.y + l2 * b.y + l3 * c.y;
        if (best === null || y > best) best = y;
      }
      if (best === null) return null;
      p.y = best;
      return p.applyMatrix4(mesh.matrixWorld).y;
    },
  };
}

/** Material response tweaks (keep the OSRS colours). */
function tweak(m) {
  m.envMapIntensity = 1;
  switch (m.name) {
    case 'book_metal': m.metalness = 0.7; m.roughness = 0.42; break;
    case 'book_leather': m.roughness = 0.7; break;
    case 'book_paper':
    case 'book_page_turn':
      m.emissiveMap = m.map;                    // the pages give off their own light
      m.emissive = new THREE.Color('#ffb46e');
      break;
    case 'book_rune_glow': m.emissive = new THREE.Color('#ff9a3c'); break;
    case 'set_rune_glow': m.emissive = new THREE.Color('#6f9bff'); break;
  }
}

/** Re-applies the tunable placement (called whenever lab params change). */
export function apply(nodes, n, params) {
  for (const [name, [x, z, ry]] of Object.entries(params.place)) {
    const o = nodes[name];
    if (!o) continue;
    o.position.set(x, 0, z);
    o.rotation.y = ry * DEG;
  }
  // stand on the dais: lift each character to the highest dais point under any of its soles
  if (nodes.floor && nodes.feet) {
    nodes.floor.begin();
    const v = new THREE.Vector3();
    for (const c of CHARACTERS) {
      const o = nodes[c];
      if (!o) continue;
      o.updateMatrix();
      let y = 0;
      for (const [fx, fz] of nodes.feet[c]) {
        v.set(fx, 0, fz).applyMatrix4(o.matrix);
        const h = nodes.floor.at(v.x, v.z);
        if (h !== null && h > y) y = h;
      }
      o.position.y = y;
    }
  }
  const b = params.book;
  nodes.book.position.set(0, b.y, b.z);
  faceStones(nodes, n, params);
  nodes.book.rotation.set(b.tilt * DEG, 0, 0);
  nodes.book.userData.base = { y: b.y, rx: b.tilt * DEG };   // the hover bob is added on top (engine)
}

/**
 * Standing stones: show/hide, and turn each one about its own vertical axis so its rune (on the
 * stone's local +Z face) looks at the book. The modelled lean is kept; only the yaw changes.
 */
const FACE = new THREE.Vector3(0, 0, 1);
function faceStones(nodes, n, params) {
  const circle = nodes.circle;
  circle?.updateWorldMatrix(true, false);
  const target = new THREE.Vector3(), here = new THREE.Vector3(), f = new THREE.Vector3();
  const spin = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  // the book in circle space (the circle itself is moved/rotated by the layout params)
  nodes.book.getWorldPosition(target);
  if (circle) circle.worldToLocal(target);
  params.menhirs.forEach((on, i) => {
    const m = n(`circle__menhir_${i + 1}`);
    if (!m) return;
    m.visible = on;
    m.userData.baseQ ??= m.quaternion.clone();
    m.quaternion.copy(m.userData.baseQ);
    if (params.stonesFaceBook === false) return;
    here.copy(m.position);
    f.copy(FACE).applyQuaternion(m.quaternion);
    const now = Math.atan2(f.x, f.z), want = Math.atan2(target.x - here.x, target.z - here.z);
    m.quaternion.premultiply(spin.setFromAxisAngle(up, want - now));
  });
}

function topLevel(o, root) {
  let p = o;
  while (p.parent && p.parent !== root) p = p.parent;
  return p.name;
}
