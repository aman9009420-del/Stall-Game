import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createRng } from './noise.js';

export const SUN_DIR = new THREE.Vector3(-0.52, 0.62, 0.58).normalize();
export const SKY = {
  top: new THREE.Color(0x2f6fd0),
  horizon: new THREE.Color(0xbcd6ee),
  bottom: new THREE.Color(0x56634c),
  sun: new THREE.Color(0xfff1d6),
};

function skyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: SKY.top },
      uHorizon: { value: SKY.horizon },
      uBottom: { value: SKY.bottom },
      uSunDir: { value: SUN_DIR },
      uSunColor: { value: SKY.sun },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uBottom;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.55));
        col = mix(col, uBottom, smoothstep(0.0, -0.2, h));
        float sd = max(dot(d, normalize(uSunDir)), 0.0);
        col += uSunColor * (pow(sd, 1500.0) * 8.0 + pow(sd, 80.0) * 0.35 + pow(sd, 8.0) * 0.1);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
}

export function createSky() {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMaterial());
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.name = 'sky';
  return mesh;
}

/** Image-based lighting generated from the sky gradient (glossy car paint). */
export function createEnvironment(renderer) {
  const envScene = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), skyMaterial());
  envScene.add(sky);
  // a soft bright "sun" patch so reflections have a highlight
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(4, 16, 8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.7, 3.2) }),
  );
  glow.position.copy(SUN_DIR).multiplyScalar(40);
  envScene.add(glow);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(envScene, 0.02, 0.1, 100);
  pmrem.dispose();
  return rt.texture;
}

export function createLights(scene) {
  const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x4b5a3c, 1.1);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff1dc, 2.9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const S = 70;
  sun.shadow.camera.left = -S;
  sun.shadow.camera.right = S;
  sun.shadow.camera.top = S;
  sun.shadow.camera.bottom = -S;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 400;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  scene.add(sun.target);
  return { hemi, sun, shadowSize: S };
}

/** Keep the shadow frustum centred on the action (snapped to texels to avoid shimmer). */
export function updateSunShadow(sun, target, shadowSize) {
  const texel = (shadowSize * 2) / sun.shadow.mapSize.x;
  // Snap in light space approximately by snapping world xz.
  const x = Math.round(target.x / texel) * texel;
  const z = Math.round(target.z / texel) * texel;
  sun.target.position.set(x, target.y, z);
  sun.position.set(x + SUN_DIR.x * 200, target.y + SUN_DIR.y * 200, z + SUN_DIR.z * 200);
  sun.target.updateMatrixWorld();
}

// ---------------------------------------------------------------------------
// Vegetation & props

// Low-poly on purpose: thousands of instances. Hidden caps are left open.
function pineGeometries() {
  const trunk = new THREE.CylinderGeometry(0.22, 0.34, 2.2, 5, 1, true);
  trunk.translate(0, 1.1, 0);
  const cones = [
    new THREE.ConeGeometry(2.3, 3.6, 7, 1, true).translate(0, 3.4, 0),
    new THREE.ConeGeometry(1.75, 3.0, 7, 1, true).translate(0, 5.2, 0),
    new THREE.ConeGeometry(1.15, 2.5, 7, 1, true).translate(0, 6.8, 0),
  ];
  return { trunk, foliage: mergeGeometries(cones) };
}

function broadleafGeometries() {
  const trunk = new THREE.CylinderGeometry(0.28, 0.42, 2.8, 5, 1, true);
  trunk.translate(0, 1.4, 0);
  const a = new THREE.IcosahedronGeometry(2.6, 0);
  a.scale(1, 0.85, 1);
  a.translate(0, 4.4, 0);
  const b = new THREE.IcosahedronGeometry(1.8, 0);
  b.rotateY(0.7);
  b.translate(1.3, 3.7, 0.6);
  const c = new THREE.IcosahedronGeometry(1.6, 0);
  c.rotateY(1.9);
  c.translate(-1.1, 3.9, -0.8);
  return { trunk, foliage: mergeGeometries([a, b, c]) };
}

export function createVegetation(track, sampler) {
  const group = new THREE.Group();
  group.name = 'vegetation';
  const rng = createRng(2024);
  const cfg = track.config;
  const cx = track.center.x;
  const cz = track.center.z;

  const placements = { pine: [], leaf: [], rock: [] };
  const startClear = (x, z) => {
    // keep grandstands / pit area clear
    const p = track.project(x, z, -1);
    const s = p.s > track.length / 2 ? p.s - track.length : p.s;
    return s > -150 && s < 150 && Math.abs(p.lateral) < cfg.wallOffset + 40;
  };

  let attempts = 0;
  while ((placements.pine.length + placements.leaf.length < 2600) && attempts < 40000) {
    attempts++;
    const x = cx + (rng() * 2 - 1) * 1000;
    const z = cz + (rng() * 2 - 1) * 900;
    const info = sampler.info(x, z);
    const d = info.dist;
    if (d < cfg.wallOffset + 7) continue;
    // Denser close to the circuit (great sense of speed), sparse far away.
    const keep = d < 90 ? 0.9 : d < 250 ? 0.45 : 0.12;
    if (rng() > keep) continue;
    const h = info.height;
    if (h > 85) continue;
    // slope check
    const e = 2;
    const hx = sampler.height(x + e, z) - sampler.height(x - e, z);
    const hz = sampler.height(x, z + e) - sampler.height(x, z - e);
    const slope = Math.hypot(hx, hz) / (2 * e);
    if (slope > 0.9) continue;
    if (d < 200 && startClear(x, z)) continue;
    const pine = h > 25 ? rng() < 0.85 : rng() < 0.55;
    const scale = 0.75 + rng() * 0.8;
    (pine ? placements.pine : placements.leaf).push({ x, y: h - 0.3, z, scale, rot: rng() * Math.PI * 2 });
  }

  attempts = 0;
  while (placements.rock.length < 260 && attempts < 8000) {
    attempts++;
    const x = cx + (rng() * 2 - 1) * 900;
    const z = cz + (rng() * 2 - 1) * 800;
    const info = sampler.info(x, z);
    if (info.dist < cfg.wallOffset + 6) continue;
    if (info.dist < 200 && startClear(x, z)) continue;
    placements.rock.push({ x, y: info.height - 0.2, z, scale: 0.6 + rng() * 2.2, rot: rng() * Math.PI * 2 });
  }

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();

  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const foliageMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });

  // Split instances into a coarse spatial grid so whole chunks can be
  // frustum-culled (main camera and the small shadow camera).
  const GRID = 2;
  const minX = cx - 1000;
  const minZ = cz - 900;
  const cellW = 2000 / GRID;
  const cellH = 1800 / GRID;
  const cellOf = (p) => {
    const gx = Math.min(GRID - 1, Math.max(0, Math.floor((p.x - minX) / cellW)));
    const gz = Math.min(GRID - 1, Math.max(0, Math.floor((p.z - minZ) / cellH)));
    return gz * GRID + gx;
  };

  function instanced(geo, mat, list, colorFn, castShadow = true) {
    // Assign colours up-front so they don't depend on the chunking order.
    const colors = colorFn ? list.map((p, i) => colorFn(i, new THREE.Color())) : null;
    const buckets = new Map();
    list.forEach((p, i) => {
      const k = cellOf(p);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(i);
    });
    for (const ids of buckets.values()) {
      const mesh = new THREE.InstancedMesh(geo, mat, ids.length);
      ids.forEach((id, j) => {
        const p = list[id];
        q.setFromAxisAngle(up, p.rot);
        pos.set(p.x, p.y, p.z);
        scl.set(p.scale, p.scale * (0.9 + (id % 5) * 0.06), p.scale);
        m.compose(pos, q, scl);
        mesh.setMatrixAt(j, m);
        if (colors) mesh.setColorAt(j, colors[id]);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      mesh.computeBoundingBox();
      group.add(mesh);
    }
  }

  const pine = pineGeometries();
  const leaf = broadleafGeometries();
  instanced(pine.trunk, trunkMat, placements.pine);
  instanced(pine.foliage, foliageMat, placements.pine, (i, c) =>
    c.setHSL(0.31 + rng() * 0.05, 0.45 + rng() * 0.2, 0.2 + rng() * 0.1),
  );
  instanced(leaf.trunk, trunkMat, placements.leaf);
  instanced(leaf.foliage, foliageMat, placements.leaf, (i, c) =>
    c.setHSL(0.2 + rng() * 0.12, 0.5 + rng() * 0.2, 0.28 + rng() * 0.12),
  );
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  rockGeo.scale(1.3, 0.7, 1);
  instanced(rockGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), placements.rock, (i, c) =>
    c.setHSL(0.08, 0.06, 0.42 + rng() * 0.2),
  );
  return group;
}

// ---------------------------------------------------------------------------
// Grandstands & pit building along the main straight

export function createStadium(track) {
  const group = new THREE.Group();
  group.name = 'stadium';
  const cfg = track.config;
  const rng = createRng(77);
  const concrete = new THREE.MeshStandardMaterial({ color: 0xb9b4aa, roughness: 0.9 });
  const seatMats = [0xd61f2c, 0x1d5be8, 0xf5f5f5].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }),
  );
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xe9edf2, roughness: 0.5, metalness: 0.3 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.5, metalness: 0.6 });

  const people = [];

  // Frame where +x runs along the track and +z points away from it.
  function frameAt(s, lateral, side) {
    const p = track.pointAt(s, lateral);
    const g = new THREE.Group();
    g.position.set(p.x, p.y, p.z);
    g.rotation.y = side > 0 ? p.heading - Math.PI / 2 : p.heading + Math.PI / 2;
    // On the left side flip x so it still runs with the track.
    if (side < 0) g.scale.x = -1;
    return g;
  }

  function grandstand(sCenter, length, side) {
    const g = frameAt(sCenter, side * (cfg.wallOffset + 6), side);
    const rows = 9;
    const depth = 1.25;
    const rise = 0.62;
    for (let r = 0; r < rows; r++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(length, rise * (r + 1), depth), concrete);
      step.position.set(0, (rise * (r + 1)) / 2, r * depth);
      step.castShadow = true;
      step.receiveShadow = true;
      g.add(step);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(length - 0.4, 0.18, 0.45), seatMats[r % 3]);
      seat.position.set(0, rise * (r + 1) + 0.09, r * depth + 0.2);
      g.add(seat);
      for (let x = -length / 2 + 0.6; x < length / 2 - 0.4; x += 0.75) {
        if (rng() < 0.72) {
          const v = new THREE.Vector3(x + (rng() - 0.5) * 0.2, rise * (r + 1) + 0.18, r * depth + 0.35);
          people.push({ group: g, v });
        }
      }
    }
    // back wall + roof
    const backH = rise * rows + 5;
    const back = new THREE.Mesh(new THREE.BoxGeometry(length, backH, 0.5), concrete);
    back.position.set(0, backH / 2, rows * depth + 0.2);
    back.castShadow = true;
    g.add(back);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(length + 2, 0.35, rows * depth + 3), roofMat);
    roof.position.set(0, backH + 0.1, (rows * depth) / 2 - 0.6);
    roof.rotation.x = -0.06;
    roof.castShadow = true;
    g.add(roof);
    for (let x = -length / 2; x <= length / 2 + 0.01; x += length / 4) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.35, backH, 0.35), steel);
      col.position.set(x, backH / 2, -1.6);
      col.castShadow = true;
      g.add(col);
    }
    group.add(g);
  }

  grandstand(-62, 80, 1);
  grandstand(72, 80, 1);

  // Pit building on the infield side.
  {
    const g = frameAt(10, -(cfg.wallOffset + 5), -1);
    const len = 150;
    const glass = new THREE.MeshStandardMaterial({ color: 0x1a2a3c, roughness: 0.08, metalness: 0.85 });
    const white = new THREE.MeshStandardMaterial({ color: 0xeef1f4, roughness: 0.6 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: 0.7 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(len, 4.2, 12), white);
    base.position.set(0, 2.1, 6.5);
    base.castShadow = base.receiveShadow = true;
    g.add(base);
    for (let x = -len / 2 + 5; x < len / 2 - 3; x += 8) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(6, 3.3, 0.2), dark);
      door.position.set(x, 1.75, 0.45);
      g.add(door);
    }
    const upper = new THREE.Mesh(new THREE.BoxGeometry(len - 4, 3.4, 10), glass);
    upper.position.set(0, 5.9, 7);
    upper.castShadow = true;
    g.add(upper);
    const top = new THREE.Mesh(new THREE.BoxGeometry(len, 0.6, 13), white);
    top.position.set(0, 7.9, 6.6);
    top.castShadow = true;
    g.add(top);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(len + 0.1, 0.5, 0.1), new THREE.MeshStandardMaterial({ color: 0xd61f2c, roughness: 0.6 }));
    stripe.position.set(0, 4.2, 0.45);
    g.add(stripe);
    group.add(g);
  }

  // Crowd as two instanced meshes (bodies + heads).
  if (people.length) {
    const bodyGeo = new THREE.BoxGeometry(0.46, 0.62, 0.32);
    bodyGeo.translate(0, 0.31, 0);
    const headGeo = new THREE.IcosahedronGeometry(0.16, 0);
    headGeo.translate(0, 0.78, 0);
    const bodies = new THREE.InstancedMesh(bodyGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), people.length);
    const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), people.length);
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    const shirt = [0xd61f2c, 0x1d5be8, 0xf5b301, 0xffffff, 0x16a34a, 0x111111, 0xf97316, 0x8b2fd9];
    const skin = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
    group.updateMatrixWorld(true);
    people.forEach((p, i) => {
      const w = p.v.clone();
      p.group.localToWorld(w);
      m.makeTranslation(w.x, w.y, w.z);
      bodies.setMatrixAt(i, m);
      heads.setMatrixAt(i, m);
      bodies.setColorAt(i, c.setHex(shirt[Math.floor(rng() * shirt.length)]));
      heads.setColorAt(i, c.setHex(skin[Math.floor(rng() * skin.length)]));
    });
    bodies.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = true;
    bodies.computeBoundingSphere();
    heads.computeBoundingSphere();
    group.add(bodies, heads);
    group.userData.crowd = { bodies, heads, people, base: people.map((p) => p.group.localToWorld(p.v.clone())) };
  }
  return group;
}

/** Make the crowd bounce (cheap: a handful of instance matrices per frame). */
const crowdMatrix = new THREE.Matrix4();

export function animateCrowd(stadium, time, excitement = 0.3) {
  const crowd = stadium.userData.crowd;
  if (!crowd) return;
  const m = crowdMatrix;
  const { bodies, heads, base } = crowd;
  const n = base.length;
  // update a rolling subset each frame
  const per = Math.min(n, 160);
  const start = Math.floor((time * 60 * per) % n);
  for (let k = 0; k < per; k++) {
    const i = (start + k) % n;
    const b = base[i];
    const jump = Math.max(0, Math.sin(time * (6 + (i % 7)) + i)) * 0.25 * excitement;
    m.makeTranslation(b.x, b.y + jump, b.z);
    bodies.setMatrixAt(i, m);
    heads.setMatrixAt(i, m);
  }
  bodies.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
}

export function createClouds() {
  const rng = createRng(31);
  const geos = [];
  for (let i = 0; i < 34; i++) {
    const cx = (rng() * 2 - 1) * 1700;
    const cz = (rng() * 2 - 1) * 1700;
    const cy = 260 + rng() * 160;
    const puffs = 4 + Math.floor(rng() * 5);
    const size = 22 + rng() * 26;
    for (let k = 0; k < puffs; k++) {
      const r = size * (0.55 + rng() * 0.5);
      const g = new THREE.IcosahedronGeometry(r, 1);
      g.scale(1, 0.55, 1);
      g.translate(cx + (k - puffs / 2) * size * 0.75 + rng() * 10, cy + rng() * 8, cz + (rng() - 0.5) * size);
      geos.push(g);
    }
  }
  const mesh = new THREE.Mesh(
    mergeGeometries(geos),
    new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x9aa8bb, emissiveIntensity: 0.55, flatShading: true }),
  );
  mesh.name = 'clouds';
  return mesh;
}
