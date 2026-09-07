import { makeTextures, makeMaterials } from './textures.js';
import { INGREDIENTS } from './config.js';
import { createPerson, createCat, createDog } from './characters.js';

function mesh(geo, mat, x, y, z, parent, shadow = true) {
  const m = new THREERef.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = shadow;
  parent.add(m);
  return m;
}

let THREERef = null;

function box(THREE, w, h, d, mat, x, y, z, parent, shadow = true) {
  return mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent, shadow);
}
function cyl(THREE, rt, rb, h, seg, mat, x, y, z, parent, shadow = true) {
  return mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, parent, shadow);
}
function sph(THREE, r, seg, mat, x, y, z, parent, shadow = true) {
  return mesh(new THREE.SphereGeometry(r, seg, Math.max(6, (seg / 2) | 0)), mat, x, y, z, parent, shadow);
}

function rngFn(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function buildWorld(THREE, quality = 'med') {
  THREERef = THREE;
  const textures = makeTextures(THREE);
  const mats = makeMaterials(THREE, textures);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1020);
  scene.fog = new THREE.FogExp2(0x0b1020, 0.018);

  const root = new THREE.Group();
  scene.add(root);

  const lights = setupLights(THREE, scene, quality);
  const ground = buildGround(THREE, mats, root);
  const stall = buildStall(THREE, mats, textures, root);
  const interactables = stall.interactables;
  const env = buildEnvironment(THREE, mats, textures, root, quality);
  const particles = buildParticles(THREE, scene, quality);
  const animals = buildAnimals(THREE, root);
  const extras = {
    seating: env.seating,
    neonSign: stall.parts.neonSign,
    fairy: stall.parts.fairy,
    toran: stall.parts.toran,
    rangoli: stall.parts.rangoli,
    plants: stall.parts.plants,
    posters: stall.parts.posters,
    carpet: stall.parts.carpet,
    extraLanterns: stall.parts.extraLanterns,
    paintTrim: stall.parts.paintTrim,
    radio: stall.parts.radio,
    speaker: stall.parts.speaker,
    awningUpgrade: stall.parts.awningUpgrade,
    generator: stall.parts.generator,
    fridge: stall.parts.fridge,
  };

  applyDecorVisibility(extras, {});

  const world = {
    scene,
    textures,
    mats,
    stall: stall.group,
    parts: stall.parts,
    interactables,
    queueSlots: stall.queueSlots,
    readySlots: stall.readySlots,
    burnerSlots: stall.burnerSlots,
    spawnPoints: [
      { x: -16, z: 7.5 },
      { x: 16, z: 7.2 },
      { x: -14, z: 9 },
      { x: 15, z: 8.5 },
    ],
    lights,
    env: { ...env, ...particles, extras, animals },
    backgroundPeople: env.crowd,
    setDecor(id, on) {
      const map = {
        fairy: extras.fairy,
        toran: extras.toran,
        rangoli: extras.rangoli,
        plants: extras.plants,
        posters: extras.posters,
        carpet: extras.carpet,
        lantern: extras.extraLanterns,
        paint: extras.paintTrim,
        radio: extras.radio,
      };
      if (map[id]) map[id].visible = !!on;
    },
    setUpgradeVisuals(state) {
      extras.neonSign.visible = state.upgrades.neon > 0;
      extras.speaker.visible = state.upgrades.speaker > 0;
      extras.awningUpgrade.visible = state.upgrades.awning > 0;
      extras.generator.visible = state.upgrades.generator > 0;
      extras.fridge.visible = state.upgrades.fridge > 0;
      extras.seating.visible = state.upgrades.seating > 0;
      stall.parts.burner2.visible = state.upgrades.burner >= 1;
      stall.parts.burner3.visible = state.upgrades.burner >= 2;
      stall.parts.burner4.visible = state.upgrades.burner >= 3;
      if (state.decor.paint) {
        stall.parts.frontPanel.material = mats.red;
      }
    },
    updateTimeOfDay(hour, weather) {
      updateSky(scene, lights, env, particles, hour, weather);
    },
  };
  return world;
}

function applyDecorVisibility(extras, decor) {
  extras.fairy.visible = !!decor.fairy;
  extras.toran.visible = !!decor.toran;
  extras.rangoli.visible = !!decor.rangoli;
  extras.plants.visible = !!decor.plants;
  extras.posters.visible = !!decor.posters;
  extras.carpet.visible = !!decor.carpet;
  extras.extraLanterns.visible = !!decor.lantern;
  extras.paintTrim.visible = !!decor.paint;
  extras.radio.visible = !!decor.radio;
  extras.neonSign.visible = false;
  extras.speaker.visible = false;
  extras.awningUpgrade.visible = false;
  extras.generator.visible = false;
  extras.fridge.visible = false;
  extras.seating.visible = false;
}

function setupLights(THREE, scene, quality) {
  const hemi = new THREE.HemisphereLight(0x6b7cb0, 0x2a1810, 0.55);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe6c2, 0.65);
  sun.position.set(-8, 14, 6);
  sun.castShadow = quality !== 'low';
  sun.shadow.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 40;
  sun.shadow.camera.left = -16;
  sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 16;
  sun.shadow.camera.bottom = -16;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x8899cc, 0.15);
  fill.position.set(10, 6, -8);
  scene.add(fill);

  const lanterns = [];
  const makePoint = (x, y, z, color, intensity, dist) => {
    const p = new THREE.PointLight(color, intensity, dist, 2);
    p.position.set(x, y, z);
    scene.add(p);
    lanterns.push(p);
    return p;
  };
  makePoint(-1.6, 2.15, 0.4, 0xffbb66, 1.1, 8);
  makePoint(1.6, 2.15, 0.4, 0xffbb66, 1.0, 8);
  const stove = makePoint(0.9, 1.15, -0.15, 0xff6622, 0.4, 4);
  makePoint(-6, 3.2, 6, 0xffd9a0, 0.7, 12);
  makePoint(7, 3.2, 7, 0xffd9a0, 0.55, 11);

  const ambient = new THREE.AmbientLight(0x1a1528, 0.25);
  scene.add(ambient);

  return { hemi, sun, fill, lanterns, stove, ambient };
}

function buildGround(THREE, mats, root) {
  const g = new THREE.Group();
  const cobble = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), mats.cobble);
  cobble.rotation.x = -Math.PI / 2;
  cobble.receiveShadow = true;
  g.add(cobble);

  const road = new THREE.Mesh(new THREE.PlaneGeometry(50, 7.2), mats.asphalt);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.01, 8.2);
  road.receiveShadow = true;
  g.add(road);

  const curb1 = box(THREE, 50, 0.12, 0.25, mats.cream, 0, 0.06, 4.55, g, false);
  const curb2 = box(THREE, 50, 0.12, 0.25, mats.cream, 0, 0.06, 11.85, g, false);

  const grassL = new THREE.Mesh(new THREE.PlaneGeometry(60, 10), mats.grass);
  grassL.rotation.x = -Math.PI / 2;
  grassL.position.set(0, 0.005, -16);
  g.add(grassL);

  root.add(g);
  return g;
}

function buildStall(THREE, mats, textures, root) {
  const group = new THREE.Group();
  group.position.set(0, 0, 0);
  const parts = {};
  const interactables = [];

  const platform = box(THREE, 6.2, 0.16, 3.6, mats.woodDark, 0, 0.08, -0.15, group);
  const legs = [[-2.8, 1.5], [2.8, 1.5], [-2.8, -1.6], [2.8, -1.6]];
  for (const [x, z] of [[-2.7, -1.5], [2.7, -1.5], [-2.7, 1.4], [2.7, 1.4]]) {
    cyl(THREE, 0.07, 0.09, 0.18, 8, mats.metal, x, 0.09, z, group);
  }

  const posts = [
    [-2.7, -1.45], [2.7, -1.45], [-2.7, 1.35], [2.7, 1.35],
  ];
  posts.forEach(([x, z]) => {
    cyl(THREE, 0.08, 0.09, 2.35, 8, mats.teak, x, 1.25, z, group);
    cyl(THREE, 0.11, 0.11, 0.08, 8, mats.brass, x, 2.4, z, group);
  });

  const beamF = box(THREE, 5.6, 0.1, 0.1, mats.wood, 0, 2.38, 1.35, group);
  const beamB = box(THREE, 5.6, 0.1, 0.1, mats.wood, 0, 2.38, -1.45, group);
  const beamL = box(THREE, 0.1, 0.1, 2.9, mats.wood, -2.7, 2.38, -0.05, group);
  const beamR = box(THREE, 0.1, 0.1, 2.9, mats.wood, 2.7, 2.38, -0.05, group);

  const awning = box(THREE, 6.05, 0.05, 3.5, mats.stripe, 0, 2.52, -0.05, group);
  awning.rotation.x = -0.12;
  parts.awning = awning;

  const valance = box(THREE, 6.0, 0.28, 0.04, mats.stripe, 0, 2.28, 1.62, group);
  const valL = box(THREE, 0.04, 0.28, 3.2, mats.stripe, -2.95, 2.28, -0.05, group);
  const valR = box(THREE, 0.04, 0.28, 3.2, mats.stripe, 2.95, 2.28, -0.05, group);

  const awningUpgrade = box(THREE, 6.4, 0.04, 4.0, mats.stripeBlue, 0, 2.62, 0.15, group);
  awningUpgrade.rotation.x = -0.1;
  parts.awningUpgrade = awningUpgrade;

  const fairy = new THREE.Group();
  for (let i = 0; i < 14; i++) {
    const col = [0xff6b6b, 0xffd93d, 0x6bcb77, 0x4d96ff, 0xff8fab][i % 5];
    const bulb = sph(THREE, 0.04, 6, new THREE.MeshStandardMaterial({
      color: col, emissive: col, emissiveIntensity: 1.4,
    }), -2.6 + i * 0.4, 2.18, 1.62, fairy, false);
  }
  group.add(fairy);
  parts.fairy = fairy;

  const back = box(THREE, 5.8, 1.7, 0.1, mats.wood, 0, 1.05, -1.55, group);
  parts.frontPanel = box(THREE, 5.9, 0.85, 0.12, mats.woodDark, 0, 0.55, 1.42, group);
  const stripeTrim = box(THREE, 5.92, 0.1, 0.13, mats.gold, 0, 0.95, 1.43, group);
  const paintTrim = box(THREE, 5.95, 0.18, 0.14, mats.red, 0, 0.28, 1.44, group);
  parts.paintTrim = paintTrim;

  const counter = box(THREE, 5.9, 0.08, 0.85, mats.steel, 0, 1.02, 1.05, group);
  const counterInner = box(THREE, 5.6, 0.06, 1.6, mats.teak, 0, 1.0, 0.15, group);

  const backShelf = box(THREE, 5.4, 0.06, 0.4, mats.wood, 0, 1.55, -1.32, group);
  const backShelf2 = box(THREE, 5.4, 0.06, 0.4, mats.wood, 0, 1.95, -1.32, group);

  for (let i = 0; i < 8; i++) {
    const jarCol = [0xb91c1c, 0xca8a04, 0x166534, 0x1d4ed8, 0x9f1239, 0xf5e6c4, 0x7c2d12, 0x365314][i];
    cyl(THREE, 0.09, 0.1, 0.18, 8, new THREE.MeshStandardMaterial({ color: jarCol, roughness: 0.4, metalness: 0.1 }),
      -2.2 + i * 0.62, 1.7, -1.32, group);
    cyl(THREE, 0.07, 0.07, 0.04, 8, mats.metal, -2.2 + i * 0.62, 1.8, -1.32, group);
  }

  const chalkboard = box(THREE, 1.15, 0.85, 0.05, mats.chalk, -1.85, 1.55, 1.48, group);
  chalkboard.rotation.x = -0.05;

  const sign = box(THREE, 2.4, 0.7, 0.06, mats.sign, 0.15, 2.85, 0.2, group);
  parts.sign = sign;
  const signBar = box(THREE, 0.05, 0.4, 0.05, mats.metal, -1.0, 2.55, 0.2, group);
  box(THREE, 0.05, 0.4, 0.05, mats.metal, 1.3, 2.55, 0.2, group);

  const neonSign = box(THREE, 2.5, 0.55, 0.06, mats.neon, 0.15, 3.15, 0.15, group);
  parts.neonSign = neonSign;

  const stoveBase = box(THREE, 1.35, 0.7, 0.7, mats.black, 0.85, 1.38, -0.2, group);
  const stoveTop = box(THREE, 1.38, 0.04, 0.72, mats.steel, 0.85, 1.74, -0.2, group);

  const burnerSlots = [];
  const burnerMeshes = [];
  const burnerPositions = [
    [0.5, 1.78, -0.05],
    [1.2, 1.78, -0.05],
    [0.5, 1.78, -0.38],
    [1.2, 1.78, -0.38],
  ];
  burnerPositions.forEach((p, i) => {
    const ring = cyl(THREE, 0.16, 0.16, 0.03, 16, mats.rust, p[0], p[1], p[2], group);
    const cap = cyl(THREE, 0.12, 0.12, 0.02, 12, mats.black, p[0], p[1] + 0.02, p[2], group);
    const flame = sph(THREE, 0.07, 8, mats.emissiveFlame, p[0], p[1] + 0.08, p[2], group, false);
    flame.visible = false;
    const pot = cyl(THREE, 0.13, 0.11, 0.12, 12, mats.steel, p[0], p[1] + 0.1, p[2], group);
    pot.visible = false;
    const b = { ring, cap, flame, pot, index: i, pos: p };
    burnerMeshes.push(b);
    burnerSlots.push({ x: p[0], y: p[1], z: p[2], world: true });
    interactables.push({ id: 'burner_' + i, type: 'burner', index: i, mesh: ring });
    if (i === 1) parts.burner2 = ring.parent && cap;
  });
  parts.burners = burnerMeshes;
  parts.burner2 = burnerMeshes[1].ring;
  parts.burner3 = burnerMeshes[2].ring;
  parts.burner4 = burnerMeshes[3].ring;
  burnerMeshes[1].ring.visible = true;
  burnerMeshes[2].ring.visible = false;
  burnerMeshes[3].ring.visible = false;
  burnerMeshes[2].cap.visible = false;
  burnerMeshes[3].cap.visible = false;
  burnerMeshes[2].pot.visible = false;
  burnerMeshes[3].pot.visible = false;

  const gas = cyl(THREE, 0.16, 0.16, 0.55, 12, mats.plasticRed, 1.7, 0.5, -1.1, group);
  cyl(THREE, 0.08, 0.08, 0.08, 8, mats.metal, 1.7, 0.8, -1.1, group);

  const hood = box(THREE, 1.5, 0.06, 0.8, mats.metal, 0.85, 2.15, -0.2, group);
  box(THREE, 0.08, 0.35, 0.08, mats.metal, 0.3, 2.0, -0.5, group);
  box(THREE, 0.08, 0.35, 0.08, mats.metal, 1.4, 2.0, -0.5, group);

  const ingredientIds = Object.keys(INGREDIENTS);
  const ingGroup = new THREE.Group();
  group.add(ingGroup);
  ingredientIds.forEach((id, i) => {
    const col = INGREDIENTS[id].color;
    const row = i < 8 ? 0 : 1;
    const colI = i % 8;
    const x = -2.45 + colI * 0.32;
    const z = 0.55 - row * 0.38;
    const y = 1.12;
    const jar = cyl(THREE, 0.1, 0.11, 0.16, 10,
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.45, metalness: 0.08 }),
      x, y, z, ingGroup);
    const lid = cyl(THREE, 0.08, 0.08, 0.03, 8, mats.metal, x, y + 0.1, z, ingGroup);
    jar.userData.ingredient = id;
    interactables.push({ id: 'ing_' + id, type: 'ingredient', ingredient: id, mesh: jar });
  });

  const readySlots = [
    { x: -1.6, y: 1.08, z: 0.95 },
    { x: -0.9, y: 1.08, z: 0.95 },
    { x: -0.2, y: 1.08, z: 0.95 },
    { x: 1.85, y: 1.08, z: 0.85 },
  ];
  readySlots.forEach((s, i) => {
    const pad = cyl(THREE, 0.16, 0.16, 0.02, 12, mats.cream, s.x, s.y, s.z, group, false);
    interactables.push({ id: 'ready_' + i, type: 'ready', index: i, mesh: pad });
  });

  const bell = cyl(THREE, 0.08, 0.1, 0.08, 12, mats.brass, 2.35, 1.1, 1.15, group);
  sph(THREE, 0.03, 8, mats.brass, 2.35, 1.16, 1.15, group, false);
  interactables.push({ id: 'bell', type: 'bell', mesh: bell });

  const crate1 = box(THREE, 0.55, 0.35, 0.4, mats.crate, -2.55, 0.4, 1.0, group);
  for (let i = 0; i < 6; i++) {
    sph(THREE, 0.07, 6, new THREE.MeshStandardMaterial({ color: 0xc4a35a }), -2.7 + (i % 3) * 0.12, 0.62, 0.92 + ((i / 3) | 0) * 0.12, group);
  }
  const crate2 = box(THREE, 0.5, 0.3, 0.38, mats.crate, -2.0, 0.38, 1.05, group);
  for (let i = 0; i < 5; i++) {
    sph(THREE, 0.06, 6, new THREE.MeshStandardMaterial({ color: 0xb91c1c }), -2.14 + (i % 3) * 0.11, 0.58, 1.0 + ((i / 3) | 0) * 0.1, group);
  }

  const onionBunch = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const o = sph(THREE, 0.06, 6, new THREE.MeshStandardMaterial({ color: 0xa16207 }), (i % 3) * 0.08 - 0.08, -i * 0.02, ((i / 3) | 0) * 0.07, onionBunch);
  }
  onionBunch.position.set(2.4, 1.85, -1.2);
  group.add(onionBunch);

  const kettle = sph(THREE, 0.12, 10, mats.copper, -0.35, 1.18, 0.15, group);
  cyl(THREE, 0.04, 0.04, 0.08, 8, mats.copper, -0.35, 1.3, 0.15, group);
  const spout = cyl(THREE, 0.02, 0.025, 0.12, 6, mats.copper, -0.22, 1.2, 0.15, group);
  spout.rotation.z = -0.9;

  const board = box(THREE, 0.45, 0.03, 0.28, mats.wood, -0.9, 1.08, 0.2, group);
  const knife = box(THREE, 0.28, 0.015, 0.04, mats.steel, -0.8, 1.11, 0.18, group);
  box(THREE, 0.08, 0.02, 0.035, mats.woodDark, -0.98, 1.11, 0.18, group);

  const plates = cyl(THREE, 0.14, 0.14, 0.08, 16, mats.white, 2.15, 1.1, 0.35, group);

  const cash = box(THREE, 0.35, 0.16, 0.22, mats.black, 2.4, 1.14, 0.55, group);
  box(THREE, 0.3, 0.04, 0.18, mats.gold, 2.4, 1.24, 0.55, group);

  const radio = box(THREE, 0.28, 0.16, 0.14, mats.woodDark, -2.5, 1.7, -1.15, group);
  cyl(THREE, 0.03, 0.03, 0.12, 8, mats.metal, -2.5, 1.86, -1.15, group);
  parts.radio = radio;

  const speaker = box(THREE, 0.18, 0.28, 0.16, mats.black, 2.55, 1.55, -1.2, group);
  cyl(THREE, 0.07, 0.07, 0.02, 12, mats.metal, 2.55, 1.55, -1.11, group);
  parts.speaker = speaker;

  const fridge = box(THREE, 0.55, 1.1, 0.5, mats.steel, 2.55, 0.7, -0.55, group);
  box(THREE, 0.48, 0.5, 0.02, mats.plasticBlue, 2.28, 0.9, -0.55, group);
  parts.fridge = fridge;

  const generator = box(THREE, 0.45, 0.35, 0.3, mats.plasticRed, -2.7, 0.35, -0.9, group);
  cyl(THREE, 0.06, 0.06, 0.12, 8, mats.black, -2.7, 0.58, -0.9, group);
  parts.generator = generator;

  const lanternGroup = new THREE.Group();
  const lanternAt = (x, z) => {
    const body = cyl(THREE, 0.08, 0.1, 0.22, 8, mats.emissiveAmber, x, 2.05, z, lanternGroup, false);
    cyl(THREE, 0.09, 0.09, 0.03, 8, mats.brass, x, 2.18, z, lanternGroup, false);
    cyl(THREE, 0.09, 0.09, 0.03, 8, mats.brass, x, 1.93, z, lanternGroup, false);
  };
  lanternAt(-1.6, 1.2);
  lanternAt(1.6, 1.2);
  group.add(lanternGroup);

  const extraLanterns = new THREE.Group();
  lanternAt.call = null;
  [[-2.2, 0.2], [2.2, 0.2], [0, 1.4]].forEach(([x, z]) => {
    cyl(THREE, 0.07, 0.09, 0.2, 8, mats.gold, x, 2.0, z, extraLanterns, false);
    sph(THREE, 0.06, 8, mats.emissiveAmber, x, 2.0, z, extraLanterns, false);
  });
  group.add(extraLanterns);
  parts.extraLanterns = extraLanterns;

  const toran = new THREE.Group();
  for (let i = 0; i < 16; i++) {
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 6, 4),
      new THREE.MeshStandardMaterial({ color: i % 2 ? 0xf59e0b : 0x16a34a, roughness: 0.8 })
    );
    leaf.position.set(-2.4 + i * 0.32, 2.32 + Math.sin(i) * 0.05, 1.55);
    toran.add(leaf);
  }
  group.add(toran);
  parts.toran = toran;

  const rangoli = new THREE.Mesh(
    new THREE.CircleGeometry(0.85, 24),
    new THREE.MeshStandardMaterial({ map: textures.rangoli, transparent: true, roughness: 1, metalness: 0 })
  );
  rangoli.rotation.x = -Math.PI / 2;
  rangoli.position.set(0, 0.175, 2.35);
  group.add(rangoli);
  parts.rangoli = rangoli;

  const plants = new THREE.Group();
  const potPlant = (x, z) => {
    cyl(THREE, 0.1, 0.12, 0.16, 8, mats.clay, x, 0.25, z, plants);
    sph(THREE, 0.16, 8, mats.green, x, 0.48, z, plants, false);
    sph(THREE, 0.1, 6, new THREE.MeshStandardMaterial({ color: 0x4d7c0f }), x + 0.08, 0.55, z, plants, false);
  };
  potPlant(-3.15, 1.3);
  potPlant(3.15, 1.3);
  potPlant(-3.1, -1.3);
  group.add(plants);
  parts.plants = plants;

  const posters = new THREE.Group();
  const p1 = box(THREE, 0.5, 0.7, 0.02, mats.red, -2.4, 1.5, -1.48, posters, false);
  const p2 = box(THREE, 0.4, 0.55, 0.02, mats.plasticBlue, 2.3, 1.45, -1.48, posters, false);
  group.add(posters);
  parts.posters = posters;

  const carpet = box(THREE, 2.2, 0.02, 1.1, mats.fabric, 0, 0.17, 2.1, group, false);
  parts.carpet = carpet;

  const fan = new THREE.Group();
  fan.position.set(0, 2.35, 0);
  const hub = cyl(THREE, 0.08, 0.08, 0.05, 10, mats.metal, 0, 0, 0, fan, false);
  for (let i = 0; i < 3; i++) {
    const blade = box(THREE, 0.7, 0.02, 0.12, mats.cream, 0.35, 0, 0, fan, false);
    blade.rotation.y = (i / 3) * Math.PI * 2;
    blade.position.set(Math.cos((i / 3) * Math.PI * 2) * 0.35, 0, Math.sin((i / 3) * Math.PI * 2) * 0.35);
  }
  group.add(fan);
  parts.fan = fan;

  const stool = cyl(THREE, 0.16, 0.18, 0.08, 10, mats.red, -3.3, 0.55, 0.4, group);
  cyl(THREE, 0.04, 0.04, 0.5, 6, mats.metal, -3.3, 0.28, 0.4, group);

  const matFront = box(THREE, 1.6, 0.03, 0.5, mats.green, 0.2, 0.175, 1.85, group, false);

  const queueSlots = [];
  const nSlots = 6;
  for (let i = 0; i < nSlots; i++) {
    queueSlots.push({ x: -1.6 + i * 0.7, y: 0, z: 2.55 });
  }

  root.add(group);
  parts.group = group;

  interactables.forEach((it) => {
    it.mesh.userData.interact = it;
  });

  return { group, parts, interactables, queueSlots, readySlots, burnerSlots };
}

function buildEnvironment(THREE, mats, textures, root, quality) {
  const env = new THREE.Group();
  const rng = rngFn(42);

  for (let i = 0; i < 8; i++) {
    const x = -18 + i * 5.2;
    if (Math.abs(x) < 5) continue;
    const h = 4 + rng() * 5;
    const w = 3.2 + rng() * 1.8;
    const d = 3 + rng() * 1.4;
    const bmat = rng() > 0.5 ? mats.brick : mats.woodDark;
    const b = box(THREE, w, h, d, bmat, x, h / 2, -8 - rng() * 3, env);
    for (let wy = 0; wy < 3; wy++) {
      for (let wx = 0; wx < 2; wx++) {
        const lit = rng() > 0.35;
        const win = box(THREE, 0.45, 0.55, 0.05,
          lit ? mats.emissiveAmber : mats.black,
          x - 0.6 + wx * 1.1, 1.4 + wy * 1.2, -8 - rng() * 0.01 + d / 2 + 0.02,
          env, false);
      }
    }
  }

  const stallColors = [mats.stripe, mats.stripeBlue, mats.fabric, mats.red];
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? -1 : 1;
    const x = side * (7 + (i % 3) * 4.2);
    const z = -2.5 - (i % 3) * 0.4;
    const g = new THREE.Group();
    box(THREE, 2.6, 0.1, 1.8, mats.woodDark, 0, 0.9, 0, g);
    box(THREE, 2.6, 0.8, 0.1, mats.wood, 0, 0.5, 0.85, g);
    const aw = box(THREE, 2.8, 0.04, 2.0, stallColors[i % stallColors.length], 0, 1.85, 0, g);
    aw.rotation.x = -0.15;
    cyl(THREE, 0.05, 0.05, 1.8, 6, mats.teak, -1.2, 1.0, 0.8, g);
    cyl(THREE, 0.05, 0.05, 1.8, 6, mats.teak, 1.2, 1.0, 0.8, g);
    g.position.set(x, 0, z);
    env.add(g);
  }

  for (let i = 0; i < 5; i++) {
    const x = -12 + i * 6;
    const pole = cyl(THREE, 0.06, 0.08, 3.4, 8, mats.metal, x, 1.7, 6.4, env);
    const arm = box(THREE, 0.8, 0.05, 0.05, mats.metal, x + 0.35, 3.3, 6.4, env, false);
    const lamp = sph(THREE, 0.12, 8, mats.emissiveAmber, x + 0.7, 3.15, 6.4, env, false);
  }

  for (let i = 0; i < 10; i++) {
    const x = -20 + i * 4.4 + rng();
    const z = -12 - rng() * 6;
    tree(THREE, mats, env, x, z, 1.1 + rng() * 0.5);
  }
  tree(THREE, mats, env, -6.5, 3.2, 0.9);
  tree(THREE, mats, env, 8.5, 3.6, 1.0);

  const bike = new THREE.Group();
  const wheel = (x) => {
    const w = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 6, 12), mats.black);
    w.position.set(x, 0.28, 0);
    bike.add(w);
  };
  wheel(-0.4); wheel(0.4);
  box(THREE, 0.85, 0.05, 0.05, mats.rust, 0, 0.45, 0, bike, false);
  bike.position.set(4.4, 0, 3.4);
  bike.rotation.y = 0.4;
  env.add(bike);

  const barrel = cyl(THREE, 0.28, 0.3, 0.7, 10, mats.rust, 4.8, 0.35, 1.2, env);
  const barrel2 = cyl(THREE, 0.25, 0.26, 0.55, 10, mats.rust, -4.6, 0.28, 1.4, env);

  const seating = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    box(THREE, 0.55, 0.08, 0.55, mats.wood, -4.2, 0.45, 2.4 + i * 0.85, seating);
    box(THREE, 0.08, 0.4, 0.08, mats.metal, -4.4, 0.22, 2.25 + i * 0.85, seating);
    box(THREE, 0.08, 0.4, 0.08, mats.metal, -4.0, 0.22, 2.55 + i * 0.85, seating);
  }
  box(THREE, 2.2, 0.08, 0.7, mats.teak, -4.2, 0.72, 3.3, seating);
  env.add(seating);

  const crowd = [];
  const nCrowd = quality === 'low' ? 4 : quality === 'high' ? 10 : 7;
  for (let i = 0; i < nCrowd; i++) {
    const p = createPerson(THREE, rng, 'regular');
    p.position.set(-14 + rng() * 28, 0, 9.5 + rng() * 3);
    p.rotation.y = rng() * Math.PI * 2;
    p.userData.baseY = 0;
    p.userData.wander = {
      ox: p.position.x,
      oz: p.position.z,
      a: rng() * Math.PI * 2,
      spd: 0.4 + rng() * 0.5,
    };
    env.add(p);
    crowd.push(p);
  }

  const starsGeo = new THREE.BufferGeometry();
  const sn = quality === 'high' ? 500 : 280;
  const spos = new Float32Array(sn * 3);
  for (let i = 0; i < sn; i++) {
    const theta = rng() * Math.PI * 2;
    const phi = rng() * Math.PI * 0.42;
    const r = 70;
    spos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    spos[i * 3 + 1] = 12 + r * Math.cos(phi);
    spos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  starsGeo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
  const stars = new THREE.Points(starsGeo, new THREE.PointsMaterial({
    color: 0xfff4d6, size: 0.35, sizeAttenuation: true, transparent: true, opacity: 0.9,
  }));
  env.add(stars);

  const sunMesh = sph(THREE, 1.6, 16, new THREE.MeshBasicMaterial({ color: 0xffe08a }), -20, 18, -10, env, false);
  const moonMesh = sph(THREE, 1.3, 12, new THREE.MeshBasicMaterial({ color: 0xe2e8f0 }), 18, 16, -12, env, false);

  const stringLights = new THREE.Group();
  for (let i = 0; i < 18; i++) {
    const col = [0xff6b6b, 0xffd93d, 0x6bcb77, 0x4d96ff][i % 4];
    sph(THREE, 0.05, 6, new THREE.MeshStandardMaterial({
      color: col, emissive: col, emissiveIntensity: 1.6,
    }), -8 + i * 0.95, 3.6 + Math.sin(i * 0.7) * 0.25, 5.2, stringLights, false);
  }
  env.add(stringLights);

  root.add(env);
  return { group: env, seating, crowd, stars, sunMesh, moonMesh, stringLights };
}

function tree(THREE, mats, parent, x, z, s) {
  const g = new THREE.Group();
  cyl(THREE, 0.12 * s, 0.16 * s, 1.2 * s, 6, mats.woodDark, 0, 0.6 * s, 0, g);
  sph(THREE, 0.7 * s, 8, mats.green, 0, 1.5 * s, 0, g, false);
  sph(THREE, 0.5 * s, 7, new THREE.MeshStandardMaterial({ color: 0x3f6212 }), 0.35 * s, 1.4 * s, 0.1, g, false);
  sph(THREE, 0.45 * s, 7, new THREE.MeshStandardMaterial({ color: 0x4d7c0f }), -0.3 * s, 1.55 * s, -0.1, g, false);
  g.position.set(x, 0, z);
  parent.add(g);
  return g;
}

function buildAnimals(THREE, root) {
  const cat = createCat(THREE);
  cat.position.set(-3.4, 0, 1.1);
  cat.rotation.y = 0.6;
  root.add(cat);
  const dog = createDog(THREE);
  dog.position.set(6, 0, 7);
  root.add(dog);
  return { cat, dog };
}

function buildParticles(THREE, scene, quality) {
  const rainCount = quality === 'high' ? 900 : quality === 'low' ? 250 : 550;
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(rainCount * 3);
  for (let i = 0; i < rainCount; i++) {
    rainPos[i * 3] = (Math.random() - 0.5) * 36;
    rainPos[i * 3 + 1] = Math.random() * 16;
    rainPos[i * 3 + 2] = (Math.random() - 0.5) * 28;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({
    color: 0xa8d4ff, size: 0.08, transparent: true, opacity: 0.55, depthWrite: false,
  }));
  rain.visible = false;
  scene.add(rain);

  const steamCount = 80;
  const steamGeo = new THREE.BufferGeometry();
  const steamPos = new Float32Array(steamCount * 3);
  const steamVel = [];
  for (let i = 0; i < steamCount; i++) {
    steamPos[i * 3] = 0.85 + (Math.random() - 0.5) * 0.5;
    steamPos[i * 3 + 1] = 1.85 + Math.random() * 0.6;
    steamPos[i * 3 + 2] = -0.2 + (Math.random() - 0.5) * 0.3;
    steamVel.push(0.15 + Math.random() * 0.2);
  }
  steamGeo.setAttribute('position', new THREE.BufferAttribute(steamPos, 3));
  const steam = new THREE.Points(steamGeo, new THREE.PointsMaterial({
    color: 0xf8fafc, size: 0.08, transparent: true, opacity: 0.25, depthWrite: false,
  }));
  scene.add(steam);

  const sparkCount = 40;
  const sparkGeo = new THREE.BufferGeometry();
  const sparkPos = new Float32Array(sparkCount * 3);
  for (let i = 0; i < sparkCount; i++) {
    sparkPos[i * 3] = 0.85;
    sparkPos[i * 3 + 1] = 1.8;
    sparkPos[i * 3 + 2] = -0.2;
  }
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({
    color: 0xffaa33, size: 0.06, transparent: true, opacity: 0.8, depthWrite: false,
  }));
  sparks.visible = false;
  scene.add(sparks);

  return {
    rain, rainPos, rainCount,
    steam, steamPos, steamVel, steamCount,
    sparks, sparkPos, sparkCount,
  };
}

function lerpColor(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = (ar + (br - ar) * t) | 0;
  const g = (ag + (bg - ag) * t) | 0;
  const bl = (ab + (bb - ab) * t) | 0;
  return (r << 16) | (g << 8) | bl;
}

function updateSky(scene, lights, env, particles, hour, weather) {
  const h = ((hour % 24) + 24) % 24;
  let sky, fog, hemiSky, hemiGnd, sunI, sunC, amb;
  if (h >= 6 && h < 8) {
    const t = (h - 6) / 2;
    sky = lerpColor(0x1a1030, 0xff9966, t);
    fog = lerpColor(0x1a1030, 0xe8a070, t);
    sunI = 0.4 + t * 0.7;
    sunC = 0xffbb88;
    hemiSky = 0xffc8a0;
    hemiGnd = 0x4a3020;
    amb = 0.3;
  } else if (h >= 8 && h < 17) {
    const t = h < 12 ? (h - 8) / 4 : 1;
    sky = lerpColor(0x7ec8e3, 0x4ea4d9, Math.min(1, t));
    fog = 0xa8c8d8;
    sunI = 1.15;
    sunC = 0xfff2d0;
    hemiSky = 0xcfe8ff;
    hemiGnd = 0x6a5a40;
    amb = 0.45;
  } else if (h >= 17 && h < 19.5) {
    const t = (h - 17) / 2.5;
    sky = lerpColor(0xff7a45, 0x1a1038, t);
    fog = lerpColor(0xcc6a40, 0x140c28, t);
    sunI = 0.7 - t * 0.4;
    sunC = 0xff8844;
    hemiSky = lerpColor(0xffb080, 0x3a2a70, t);
    hemiGnd = 0x3a2018;
    amb = 0.28;
  } else {
    sky = weather === 'festive' ? 0x14081c : 0x0b1020;
    fog = 0x0b1020;
    sunI = 0.12;
    sunC = 0x8899cc;
    hemiSky = 0x4a3a80;
    hemiGnd = 0x1a100c;
    amb = 0.18;
  }
  if (weather === 'rain') {
    sky = lerpColor(sky, 0x2a3344, 0.45);
    fog = lerpColor(fog, 0x2a3344, 0.4);
    sunI *= 0.55;
  }
  scene.background.setHex(sky);
  scene.fog.color.setHex(fog);
  lights.hemi.color.setHex(typeof hemiSky === 'number' ? hemiSky : 0x6b7cb0);
  lights.hemi.groundColor.setHex(typeof hemiGnd === 'number' ? hemiGnd : 0x2a1810);
  lights.sun.intensity = sunI;
  lights.sun.color.setHex(sunC);
  lights.ambient.intensity = amb;

  const sunAng = ((h - 6) / 12) * Math.PI;
  lights.sun.position.set(Math.cos(sunAng) * 18, Math.sin(sunAng) * 16 + 2, 8);
  if (env.sunMesh) {
    env.sunMesh.position.copy(lights.sun.position).multiplyScalar(1.6);
    env.sunMesh.visible = h > 5.5 && h < 19;
  }
  if (env.moonMesh) {
    env.moonMesh.visible = h < 6.5 || h > 18;
    env.moonMesh.position.set(-lights.sun.position.x * 0.8, 14, -10);
  }
  if (env.stars) {
    env.stars.material.opacity = (h < 6 || h > 19) ? 0.9 : 0.0;
    env.stars.visible = h < 7 || h > 18;
  }
  const nightBoost = (h < 6 || h > 18) ? 1 : 0.25;
  lights.lanterns.forEach((p, i) => {
    if (i === 2) return;
    p.intensity = (weather === 'festive' ? 1.4 : 1) * nightBoost * (i < 2 ? 1.1 : 0.7);
  });
  particles.rain.visible = weather === 'rain';
}

export function updateWorldFX(world, dt, t, cookingOn, weather) {
  const fan = world.parts.fan;
  if (fan) fan.rotation.y += dt * 4.5;

  const p = world.env;
  if (p.steam && p.steamPos) {
    const arr = p.steamPos;
    for (let i = 0; i < p.steamCount; i++) {
      arr[i * 3 + 1] += p.steamVel[i] * dt * (cookingOn ? 1.4 : 0.5);
      arr[i * 3] += Math.sin(t * 2 + i) * 0.01;
      if (arr[i * 3 + 1] > 3.2) {
        arr[i * 3] = 0.85 + (Math.random() - 0.5) * 0.5;
        arr[i * 3 + 1] = 1.85;
        arr[i * 3 + 2] = -0.2 + (Math.random() - 0.5) * 0.3;
      }
    }
    p.steam.geometry.attributes.position.needsUpdate = true;
    p.steam.material.opacity = cookingOn ? 0.35 : 0.12;
  }
  if (p.rain && p.rain.visible && p.rainPos) {
    const arr = p.rainPos;
    for (let i = 0; i < p.rainCount; i++) {
      arr[i * 3 + 1] -= dt * 12;
      arr[i * 3] += dt * 1.5;
      if (arr[i * 3 + 1] < 0) {
        arr[i * 3 + 1] = 12 + Math.random() * 4;
        arr[i * 3] = (Math.random() - 0.5) * 36;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 28;
      }
    }
    p.rain.geometry.attributes.position.needsUpdate = true;
  }
  if (p.sparks) {
    p.sparks.visible = cookingOn;
    if (cookingOn && p.sparkPos) {
      const arr = p.sparkPos;
      for (let i = 0; i < p.sparkCount; i++) {
        arr[i * 3 + 1] += dt * (1 + (i % 5) * 0.4);
        arr[i * 3] += Math.sin(t * 12 + i) * dt * 0.3;
        if (arr[i * 3 + 1] > 2.4) {
          arr[i * 3] = 0.7 + Math.random() * 0.6;
          arr[i * 3 + 1] = 1.78;
          arr[i * 3 + 2] = -0.05 - Math.random() * 0.3;
        }
      }
      p.sparks.geometry.attributes.position.needsUpdate = true;
    }
  }
  if (world.parts.burners) {
    world.parts.burners.forEach((b) => {
      if (b.flame.visible) {
        const s = 0.85 + Math.sin(t * 18 + b.index) * 0.18;
        b.flame.scale.set(s, 1.1 + Math.sin(t * 22) * 0.25, s);
      }
    });
  }
  const cat = world.env.animals && world.env.animals.cat;
  if (cat && cat.userData.tail) cat.userData.tail.rotation.z = 0.8 + Math.sin(t * 2) * 0.25;
  const dog = world.env.animals && world.env.animals.dog;
  if (dog) {
    dog.position.x = 6 + Math.sin(t * 0.15) * 8;
    dog.position.z = 7.2 + Math.cos(t * 0.15) * 1.2;
    dog.rotation.y = Math.sin(t * 0.15) > 0 ? Math.PI : 0;
    if (dog.userData.tail) dog.userData.tail.rotation.z = -0.6 + Math.sin(t * 8) * 0.4;
  }
  (world.backgroundPeople || []).forEach((ppl, i) => {
    const w = ppl.userData.wander;
    if (!w) return;
    w.a += dt * 0.3 * (i % 2 ? 1 : -1);
    ppl.position.x = w.ox + Math.sin(w.a) * 2.5;
    ppl.position.z = w.oz + Math.cos(w.a) * 1.2;
    ppl.rotation.y = w.a + Math.PI / 2;
    ppl.userData.leftLeg && (ppl.userData.leftLeg.rotation.x = Math.sin(t * 6 + i) * 0.5);
    ppl.userData.rightLeg && (ppl.userData.rightLeg.rotation.x = -Math.sin(t * 6 + i) * 0.5);
  });
}
