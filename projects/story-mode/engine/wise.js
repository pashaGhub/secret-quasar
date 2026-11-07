// The Wise Old Man's little acts, layered on his idle:
//  • "thinking": the raised hand comes to his chin and smooths the beard down a couple of times
//    while he glances up-and-away, then goes back to gesturing at the book;
//  • "crown": the crown slips sideways as the book opens (and now and then at random); he notices,
//    reaches up and pushes it back.
// The right arm is driven by a two-bone IK (shoulder → elbow → wrist) toward targets placed relative
// to his own mouth / crown anchors, and blended with the idle pose by a weight.
import * as THREE from 'three';

const inOut = (k) => -(Math.cos(Math.PI * Math.min(1, Math.max(0, k))) - 1) / 2;

/** Sequential phases: [{ name, d }] → { name, k (0..1 inside phase), done } at time t. */
function phaseAt(phases, t) {
  let acc = 0;
  for (const p of phases) {
    if (t < acc + p.d) return { name: p.name, k: (t - acc) / p.d, done: false };
    acc += p.d;
  }
  return { name: 'end', k: 1, done: true };
}

const BEARD = [
  { name: 'reach', d: 0.9 }, { name: 'stroke', d: 1.5 }, { name: 'stroke', d: 1.5 },
  { name: 'hold', d: 0.6 }, { name: 'back', d: 0.95 },
];
const CROWN = [
  { name: 'slip', d: 0.7 }, { name: 'notice', d: 0.55 }, { name: 'reach', d: 0.7 },
  { name: 'push', d: 0.55 }, { name: 'back', d: 0.85 },
];

export function createWiseActions(n, rnd) {
  const root = n('wise_old_man');
  const sh = n('wise_old_man__shoulder_R'), el = n('wise_old_man__elbow_R'), wr = n('wise_old_man__wrist_R');
  const crown = n('wise_old_man__crown'), mouth = n('wise_old_man__anchor_mouth');
  if (!root || !sh || !el || !wr || !crown || !mouth) return null;
  const crownBase = crown.position.clone();

  const S = { kind: null, t: 0, nextBeard: 4 + rnd() * 3, nextCrown: 13 + rnd() * 6, slip: 0, cue: null };
  const v = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3(), e: new THREE.Vector3() };
  const q = { a: new THREE.Quaternion(), b: new THREE.Quaternion(), c: new THREE.Quaternion(), idleS: new THREE.Quaternion(), idleE: new THREE.Quaternion() };
  const target = new THREE.Vector3();
  const pole = new THREE.Vector3();

  /** Point in the character's own frame (x = his left, y up, z forward) → world. */
  const local = (out, x, y, z) => root.localToWorld(out.set(x, y, z));
  const anchorLocal = (obj, out) => root.worldToLocal(obj.getWorldPosition(out));

  function rotateWorld(obj, rot) {
    // obj.world = rot * obj.world  →  obj.local = parentWorld⁻¹ * rot * obj.world
    obj.getWorldQuaternion(q.a);
    q.a.premultiply(rot);
    obj.parent.getWorldQuaternion(q.b).invert();
    obj.quaternion.copy(q.b.multiply(q.a));
    obj.updateMatrixWorld(true);
  }

  /** Two-bone IK: put the wrist on `goal` (world), elbow bending toward `poleDir` (world). */
  function solve(goal, poleDir) {
    const s = sh.getWorldPosition(v.a), e = el.getWorldPosition(v.b), w = wr.getWorldPosition(v.c);
    const la = s.distanceTo(e), lb = e.distanceTo(w);
    const toT = v.d.copy(goal).sub(s);
    const d = THREE.MathUtils.clamp(toT.length(), Math.abs(la - lb) + 1e-3, la + lb - 1e-3);
    const dir = toT.normalize();
    const bend = v.e.copy(poleDir).addScaledVector(dir, -poleDir.dot(dir)).normalize();
    const cosA = (la * la + d * d - lb * lb) / (2 * la * d);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    // upper arm: current direction → desired direction
    const want = new THREE.Vector3().copy(dir).multiplyScalar(cosA).addScaledVector(bend, sinA);
    const cur = new THREE.Vector3().copy(e).sub(s).normalize();
    rotateWorld(sh, q.c.setFromUnitVectors(cur, want));
    // forearm: from the (moved) elbow toward the reachable goal
    const e2 = el.getWorldPosition(new THREE.Vector3()), w2 = wr.getWorldPosition(new THREE.Vector3());
    const reach = new THREE.Vector3().copy(s).addScaledVector(dir, d);
    const cur2 = w2.sub(e2).normalize(), want2 = reach.sub(e2).normalize();
    rotateWorld(el, q.c.setFromUnitVectors(cur2, want2));
  }

  function start(kind) {
    if (S.kind) return false;
    S.kind = kind; S.t = 0;
    return true;
  }

  /**
   * Run after the idle has posed the arm for this frame.
   * @returns {{ neckPitch: number, neckYaw: number, busy: number }}  busy = how much the head is his own (beard act only)
   */
  function update(dt, amount) {
    const out = { neckPitch: 0, neckYaw: 0, busy: 0 };
    if (amount <= 0) { crown.position.copy(crownBase); S.kind = null; S.cue = null; return out; }

    // a cued act (e.g. the crown slip as the book opens) starts after its delay, once he is free
    if (S.cue) {
      S.cue.delay -= dt;
      if (S.cue.delay <= 0 && !S.kind) {
        start(S.cue.kind);
        if (S.cue.kind === 'crown') { S.nextCrown = 16 + rnd() * 10; S.nextBeard = Math.max(S.nextBeard, 5); }
        S.cue = null;
      } else if (S.cue.delay < -4) S.cue = null; // he was busy for too long: skip it
    }

    if (!S.kind) {
      S.nextBeard -= dt; S.nextCrown -= dt;
      if (S.nextCrown <= 0) { start('crown'); S.nextCrown = 16 + rnd() * 10; S.nextBeard = Math.max(S.nextBeard, 5); }
      else if (S.nextBeard <= 0) { start('beard'); S.nextBeard = 7 + rnd() * 6; }
    }

    let weight = 0;
    root.updateWorldMatrix(true, true);
    const mouthL = anchorLocal(mouth, v.a).clone();
    const crownL = anchorLocal(crown, v.b).clone();

    if (S.kind === 'beard') {
      S.t += dt;
      const p = phaseAt(BEARD, S.t);
      // along his right side of the beard, so the forearm comes in from the side and doesn't hide it
      const top = new THREE.Vector3(mouthL.x - 0.065, mouthL.y - 0.02, mouthL.z + 0.055);
      const low = new THREE.Vector3(mouthL.x - 0.05, mouthL.y - 0.16, mouthL.z + 0.07);
      let pt = top;
      if (p.name === 'reach') { weight = inOut(p.k); pt = top; }
      else if (p.name === 'stroke') {
        weight = 1;
        // down along the beard (slow, pressing), then lift and come back up a little in front
        const down = p.k < 0.62 ? inOut(p.k / 0.62) : 1 - inOut((p.k - 0.62) / 0.38);
        pt = top.clone().lerp(low, down);
        if (p.k >= 0.62) pt.z += 0.03 * Math.sin(Math.PI * (p.k - 0.62) / 0.38);
      } else if (p.name === 'hold') { weight = 1; pt = top.clone().lerp(low, 0.25); }
      else if (p.name === 'back') { weight = 1 - inOut(p.k); pt = top.clone().lerp(low, 0.25); }
      // thinking: eyes up and away while stroking
      const think = p.done ? 0 : p.name === 'reach' ? inOut(p.k) : p.name === 'back' ? 1 - inOut(p.k) : 1;
      out.neckPitch = -0.1 * think; out.neckYaw = -0.22 * think;
      target.copy(pt);
      if (p.done) S.kind = null;
    } else if (S.kind === 'crown') {
      S.t += dt;
      const p = phaseAt(CROWN, S.t);
      const side = new THREE.Vector3(crownL.x - 0.075, crownL.y + 0.035, crownL.z + 0.01);
      const pushed = new THREE.Vector3(crownL.x - 0.05, crownL.y + 0.05, crownL.z + 0.005);
      let pt = side;
      // the crown just slides; the head stays on its normal idle (no reaction)
      if (p.name === 'slip') S.slip = inOut(p.k);
      else if (p.name === 'notice') S.slip = 1;
      else if (p.name === 'reach') { S.slip = 1; weight = inOut(p.k); }
      else if (p.name === 'push') { weight = 1; S.slip = 1 - inOut(p.k); pt = side.clone().lerp(pushed, inOut(p.k)); }
      else if (p.name === 'back') { weight = 1 - inOut(p.k); pt = pushed; S.slip = 0; }
      target.copy(pt);
      if (p.done) { S.kind = null; S.slip = 0; }
    }

    // crown: slips toward his right (−X), rolling and dropping a touch
    crown.rotation.z += 0.4 * S.slip * amount;
    crown.position.set(crownBase.x - 0.026 * S.slip * amount, crownBase.y - 0.012 * S.slip * amount, crownBase.z);

    weight *= amount;
    if (weight > 0.001) {
      q.idleS.copy(sh.quaternion); q.idleE.copy(el.quaternion);
      local(target, target.x, target.y, target.z);
      // elbow out to his right and down
      local(pole, -1, -1.1, 0.1).sub(root.getWorldPosition(v.c)).normalize();
      solve(target, pole);
      sh.quaternion.copy(q.idleS.slerp(sh.quaternion, weight));
      el.quaternion.copy(q.idleE.slerp(el.quaternion, weight));
    }
    out.busy = S.kind === 'beard' ? weight : 0;
    return out;
  }

  return { update, trigger: (kind) => start(kind), cue: (kind, delay = 0) => { S.cue = { kind, delay }; }, get busy() { return !!S.kind; } };
}
