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

  apply(nodes, n, params);
  // name → every material instance with that name (GLTFLoader may make variants of one material)
  const each = (name, fn) => mats[name]?.forEach(fn);
  return { nodes, mats, each, n };
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
  params.menhirs.forEach((on, i) => { const m = n(`circle__menhir_${i + 1}`); if (m) m.visible = on; });
  const b = params.book;
  nodes.book.position.set(0, b.y, b.z);
  nodes.book.rotation.set(b.tilt * DEG, 0, 0);
  nodes.book.userData.base = { y: b.y, rx: b.tilt * DEG };   // the hover bob is added on top (engine)
}

function topLevel(o, root) {
  let p = o;
  while (p.parent && p.parent !== root) p = p.parent;
  return p.name;
}
