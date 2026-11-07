// Warm light sources that don't wash out the book: a soft halo *behind* the tome (the "glowing
// book" feel without covering the pages) and standing torches with flickering firelight.
import * as THREE from 'three';

const NOISE = /* glsl */ `
  float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.1; a *= 0.5; } return s; }
`;

/** Soft additive glow card, kept facing the camera, placed a little behind the book. */
export function createHalo(scene) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#ff9d4d') }, uIntensity: { value: 0.5 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uIntensity, uTime; varying vec2 vUv;
      ${NOISE}
      void main(){
        vec2 c = (vUv - 0.5) * vec2(1.0, 1.25);
        float r = length(c) * 2.0;
        float g = exp(-r * r * 3.2) * 0.9 + exp(-r * r * 12.0) * 0.5;
        g *= 0.85 + 0.15 * fbm(c * 3.0 + vec2(0.0, -uTime * 0.25));
        gl_FragColor = vec4(uColor * g * uIntensity, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  mesh.name = 'book_halo';
  mesh.renderOrder = 20;
  scene.add(mesh);
  const toCam = new THREE.Vector3();
  return {
    mesh,
    update(t, bookPos, camera, { size, intensity, color, back }) {
      mat.uniforms.uTime.value = t;
      mat.uniforms.uIntensity.value = intensity;
      mat.uniforms.uColor.value.set(color);
      toCam.copy(camera.position).sub(bookPos).normalize();
      mesh.position.copy(bookPos).addScaledVector(toCam, -back);
      mesh.position.y += size * 0.08;
      mesh.quaternion.copy(camera.quaternion);
      mesh.scale.setScalar(size);
      mesh.visible = intensity > 0.001;
    },
  };
}

/** Standing torches: wooden pole, iron basket, animated flame card, flickering point light. */
export function createTorches(scene, { count = 2 } = {}) {
  const flameMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uIntensity: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float aSeed; varying vec2 vUv; varying float vSeed;
      void main(){ vUv = uv; vSeed = aSeed; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uIntensity; varying vec2 vUv; varying float vSeed;
      ${NOISE}
      void main(){
        vec2 uv = vUv;
        float t = uTime * 1.6 + vSeed * 10.0;
        float n = fbm(vec2(uv.x * 3.0, uv.y * 2.2 - t * 1.8)) ;
        uv.x += (n - 0.5) * 0.35 * uv.y;                                   // licking, wider at the top
        float w = mix(0.42, 0.06, pow(uv.y, 0.9));                          // teardrop
        float body = smoothstep(w, w * 0.25, abs(uv.x - 0.5)) * smoothstep(0.0, 0.12, uv.y);
        body *= smoothstep(1.0, 0.45 + 0.25 * n, uv.y + n * 0.25);
        float core = body * smoothstep(0.65, 0.15, uv.y) * smoothstep(w * 0.55, 0.0, abs(uv.x - 0.5));
        vec3 col = mix(vec3(1.1, 0.24, 0.04), vec3(2.0, 0.95, 0.28), body) + vec3(0.9, 0.75, 0.45) * core;
        gl_FragColor = vec4(col * body * uIntensity, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
  });
  const wood = new THREE.MeshStandardMaterial({ color: 0x3a2414, roughness: 0.9, flatShading: true });
  const iron = new THREE.MeshStandardMaterial({ color: 0x2b2a2e, roughness: 0.55, metalness: 0.6, flatShading: true, side: THREE.DoubleSide });
  const coal = new THREE.MeshStandardMaterial({ color: 0x220b04, emissive: new THREE.Color('#ff5a14'), emissiveIntensity: 2.2, flatShading: true });

  const poleGeo = new THREE.CylinderGeometry(0.022, 0.032, 1, 6);
  const basketGeo = new THREE.CylinderGeometry(0.085, 0.045, 0.12, 6, 1, true);
  const ringGeo = new THREE.TorusGeometry(0.086, 0.008, 4, 6);
  const coalGeo = new THREE.IcosahedronGeometry(0.06, 0);
  const flameGeo = new THREE.PlaneGeometry(0.24, 0.46).translate(0, 0.21, 0);

  const torches = [];
  for (let i = 0; i < count; i++) {
    const g = new THREE.Group(); g.name = `torch_${i + 1}`;
    const pole = new THREE.Mesh(poleGeo, wood); pole.castShadow = true;
    const basket = new THREE.Mesh(basketGeo, iron); basket.castShadow = true;
    const ring = new THREE.Mesh(ringGeo, iron); ring.rotation.x = Math.PI / 2;
    const coals = new THREE.Mesh(coalGeo, coal); coals.scale.set(1, 0.55, 1);
    const fg = flameGeo.clone();
    fg.setAttribute('aSeed', new THREE.Float32BufferAttribute(new Array(4).fill(Math.random()), 1));
    const flame = new THREE.Mesh(fg, flameMat); flame.renderOrder = 15;
    const flame2 = new THREE.Mesh(fg.clone(), flameMat); flame2.renderOrder = 15;
    flame2.geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(new Array(4).fill(Math.random() + 1), 1));
    const light = new THREE.PointLight(0xff8a3c, 3, 5, 1.7);
    g.add(pole, basket, ring, coals, flame, flame2, light);
    scene.add(g);
    torches.push({ g, pole, basket, ring, coals, flame, flame2, light, seed: Math.random() * 10, sparkT: 0 });
  }

  const tmp = new THREE.Vector3();
  return {
    torches,
    /** Place from params: list of [x, z], shared height. */
    layout(list, height, visible) {
      torches.forEach((T, i) => {
        const p = list[i];
        T.g.visible = visible && !!p;
        if (!p) return;
        T.g.position.set(p[0], 0, p[1]);
        T.pole.scale.y = height; T.pole.position.y = height / 2;
        T.basket.position.y = height + 0.04;
        T.ring.position.y = height + 0.1;
        T.coals.position.y = height + 0.07;
        T.flame.position.y = height + 0.06;
        T.flame2.position.y = height + 0.06;
        T.light.position.y = height + 0.28;
      });
    },
    update(t, dt, camera, { intensity, color, flame, calm }, sparks) {
      flameMat.uniforms.uTime.value = calm ? t * 0.3 : t;
      flameMat.uniforms.uIntensity.value = flame;
      for (const T of torches) {
        if (!T.g.visible) continue;
        // cylindrical billboard: two crossed cards turned toward the camera
        T.g.getWorldPosition(tmp);
        const yaw = Math.atan2(camera.position.x - tmp.x, camera.position.z - tmp.z);
        T.flame.rotation.y = yaw; T.flame2.rotation.y = yaw + 0.6;
        const s = T.seed;
        const fl = calm ? 1 : 1 + 0.22 * Math.sin(t * 9.1 + s) * Math.sin(t * 3.3 + s * 2) + 0.12 * Math.sin(t * 23.0 + s);
        T.light.intensity = intensity * fl;
        T.light.color.set(color);
        T.flame.scale.set(1, 0.92 + 0.12 * fl, 1); T.flame2.scale.set(0.8, 0.8 + 0.1 * fl, 0.8);
        if (!calm && sparks) {
          T.sparkT -= dt;
          if (T.sparkT <= 0) {
            T.sparkT = 0.12 + Math.random() * 0.35;
            T.flame.getWorldPosition(tmp); tmp.y += 0.22;
            sparks.emit(tmp, 1, { speed: 0.45, up: 1.0, spread: 0.35, lifeTime: 1.3, sizeMul: 0.7 });
          }
        }
      }
    },
  };
}
