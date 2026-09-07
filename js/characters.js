const SKINS = [0xffe0bd, 0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const SHIRTS = [0x1d4ed8, 0xb91c1c, 0x166534, 0x7c3aed, 0xc2410c, 0x0f766e, 0x334155, 0xbe185d, 0xf59e0b, 0x075985];
const PANTS = [0x1e293b, 0x44403c, 0x1e3a5f, 0x3f3f46, 0x292524];

function box(THREE, w, h, d, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function sph(THREE, r, mat, wSeg = 10, hSeg = 8) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, wSeg, hSeg), mat);
  m.castShadow = true;
  return m;
}
function cyl(THREE, r, h, mat, seg = 8) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
  m.castShadow = true;
  return m;
}

export function createPerson(THREE, rng, type = 'regular') {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: SKINS[(rng() * SKINS.length) | 0], roughness: 0.7 });
  const shirtC = SHIRTS[(rng() * SHIRTS.length) | 0];
  const shirt = new THREE.MeshStandardMaterial({ color: shirtC, roughness: 0.65 });
  const pants = new THREE.MeshStandardMaterial({ color: PANTS[(rng() * PANTS.length) | 0], roughness: 0.75 });
  const hairC = [0x1c1917, 0x292524, 0x44403c, 0x0c0a09, 0x78350f][(rng() * 5) | 0];
  const hair = new THREE.MeshStandardMaterial({ color: hairC, roughness: 0.9 });

  const kid = type === 'kid';
  const scale = kid ? 0.72 : (type === 'auntie' ? 0.95 : 1);
  const torsoH = kid ? 0.42 : 0.55;

  const torso = box(THREE, 0.38, torsoH, 0.22, shirt);
  torso.position.y = kid ? 0.72 : 0.95;
  g.add(torso);

  const hip = box(THREE, 0.36, 0.18, 0.2, pants);
  hip.position.y = kid ? 0.48 : 0.64;
  g.add(hip);

  const head = sph(THREE, kid ? 0.16 : 0.18, skin, 12, 10);
  head.position.y = kid ? 1.08 : 1.38;
  g.add(head);

  const hairMesh = sph(THREE, kid ? 0.165 : 0.185, hair, 10, 8);
  hairMesh.position.y = head.position.y + 0.04;
  hairMesh.scale.set(1.02, 0.7, 1.05);
  g.add(hairMesh);

  if (type === 'auntie' || rng() > 0.7) {
    const bun = sph(THREE, 0.08, hair, 8, 6);
    bun.position.set(0, head.position.y + 0.12, -0.05);
    g.add(bun);
  }
  if (type === 'office') {
    const bag = box(THREE, 0.12, 0.16, 0.05, new THREE.MeshStandardMaterial({ color: 0x44403c }));
    bag.position.set(0.28, 0.85, 0);
    g.add(bag);
  }
  if (type === 'critic') {
    const glasses = box(THREE, 0.22, 0.04, 0.12, new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.6 }));
    glasses.position.set(0, head.position.y + 0.02, 0.14);
    g.add(glasses);
    const scarf = box(THREE, 0.2, 0.28, 0.06, new THREE.MeshStandardMaterial({ color: 0x7f1d1d }));
    scarf.position.set(0, 1.12, 0.12);
    g.add(scarf);
  }
  if (type === 'star') {
    const shades = box(THREE, 0.24, 0.06, 0.12, new THREE.MeshStandardMaterial({ color: 0x0a0a0a, metalness: 0.8 }));
    shades.position.set(0, head.position.y + 0.02, 0.14);
    g.add(shades);
    const phone = box(THREE, 0.06, 0.12, 0.02, new THREE.MeshStandardMaterial({ color: 0x111827, emissive: 0x38bdf8, emissiveIntensity: 0.4 }));
    phone.position.set(0.28, 1.05, 0.12);
    g.add(phone);
  }
  if (type === 'tourist') {
    const cam = box(THREE, 0.1, 0.07, 0.05, new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.4 }));
    cam.position.set(0.22, 0.95, 0.14);
    g.add(cam);
    const hat = cyl(THREE, 0.2, 0.06, new THREE.MeshStandardMaterial({ color: 0xf5e6c4 }), 10);
    hat.position.y = head.position.y + 0.16;
    g.add(hat);
  }

  const leftArm = box(THREE, 0.1, 0.42, 0.1, shirt);
  leftArm.position.set(-0.26, torso.position.y, 0);
  leftArm.geometry.translate(0, -0.16, 0);
  g.add(leftArm);
  const rightArm = box(THREE, 0.1, 0.42, 0.1, shirt);
  rightArm.position.set(0.26, torso.position.y, 0);
  rightArm.geometry.translate(0, -0.16, 0);
  g.add(rightArm);

  const leftLeg = box(THREE, 0.12, 0.5, 0.12, pants);
  leftLeg.position.set(-0.1, 0.5, 0);
  leftLeg.geometry.translate(0, -0.25, 0);
  g.add(leftLeg);
  const rightLeg = box(THREE, 0.12, 0.5, 0.12, pants);
  rightLeg.position.set(0.1, 0.5, 0);
  rightLeg.geometry.translate(0, -0.25, 0);
  g.add(rightLeg);

  const shoeM = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.5 });
  const ls = box(THREE, 0.13, 0.06, 0.2, shoeM);
  ls.position.set(-0.1, 0.03, 0.03);
  g.add(ls);
  const rs = box(THREE, 0.13, 0.06, 0.2, shoeM);
  rs.position.set(0.1, 0.03, 0.03);
  g.add(rs);

  g.scale.setScalar(scale);
  g.userData = {
    leftArm, rightArm, leftLeg, rightLeg, head, type, baseY: 0, shirtC,
  };
  g.castShadow = true;
  return g;
}

export function animatePerson(person, t, moving, dt) {
  const u = person.userData;
  if (!u.leftLeg) return;
  const spd = moving ? 8 : 0;
  const swing = moving ? Math.sin(t * spd) : Math.sin(t * 2) * 0.04;
  u.leftLeg.rotation.x = swing * (moving ? 0.7 : 0.08);
  u.rightLeg.rotation.x = -swing * (moving ? 0.7 : 0.08);
  u.leftArm.rotation.x = -swing * (moving ? 0.55 : 0.1);
  u.rightArm.rotation.x = swing * (moving ? 0.55 : 0.1);
  if (moving) {
    person.position.y = u.baseY + Math.abs(Math.sin(t * spd)) * 0.035;
  } else {
    person.position.y = u.baseY;
    u.head.rotation.y = Math.sin(t * 0.8) * 0.15;
  }
}

export function createCat(THREE) {
  const g = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x292524 });
  const body = sph(THREE, 0.18, fur, 10, 8);
  body.scale.set(1.4, 0.9, 0.9);
  body.position.y = 0.18;
  g.add(body);
  const head = sph(THREE, 0.12, fur, 10, 8);
  head.position.set(0.2, 0.26, 0);
  g.add(head);
  const earL = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.1, 6), fur);
  earL.position.set(0.16, 0.38, 0.06);
  g.add(earL);
  const earR = earL.clone();
  earR.position.set(0.16, 0.38, -0.06);
  g.add(earR);
  const tail = cyl(THREE, 0.03, 0.28, fur, 6);
  tail.position.set(-0.22, 0.26, 0);
  tail.rotation.z = 0.8;
  g.add(tail);
  const eye = sph(THREE, 0.018, dark, 6, 4);
  const e1 = eye.clone(); e1.position.set(0.28, 0.28, 0.05); g.add(e1);
  const e2 = eye.clone(); e2.position.set(0.28, 0.28, -0.05); g.add(e2);
  g.userData.tail = tail;
  return g;
}

export function createDog(THREE) {
  const g = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.85 });
  const body = sph(THREE, 0.2, fur, 10, 8);
  body.scale.set(1.5, 0.85, 0.8);
  body.position.y = 0.28;
  g.add(body);
  const head = sph(THREE, 0.13, fur, 8, 6);
  head.position.set(0.28, 0.34, 0);
  g.add(head);
  const snout = sph(THREE, 0.07, new THREE.MeshStandardMaterial({ color: 0x44403c }), 6, 4);
  snout.position.set(0.38, 0.3, 0);
  g.add(snout);
  for (const x of [-0.12, 0.05]) {
    for (const z of [-0.1, 0.1]) {
      const leg = cyl(THREE, 0.035, 0.22, fur, 6);
      leg.position.set(x, 0.11, z);
      g.add(leg);
    }
  }
  const tail = cyl(THREE, 0.025, 0.18, fur, 5);
  tail.position.set(-0.28, 0.36, 0);
  tail.rotation.z = -0.6;
  g.add(tail);
  g.userData.tail = tail;
  return g;
}

export function makeFood(THREE, recipeId, mats) {
  const g = new THREE.Group();
  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.14, 0.03, 16),
    mats.white
  );
  plate.position.y = 0.02;
  g.add(plate);

  const add = (mesh, y = 0.08) => { mesh.position.y = y; mesh.castShadow = true; g.add(mesh); };

  if (recipeId === 'chai') {
    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.045, 0.14, 12),
      mats.glass
    );
    add(glass, 0.1);
    const liq = new THREE.Mesh(
      new THREE.CylinderGeometry(0.048, 0.04, 0.1, 12),
      mats.liquidBrown
    );
    add(liq, 0.08);
  } else if (recipeId === 'samosa' || recipeId === 'pakora') {
    const col = recipeId === 'samosa' ? 0xd4a017 : 0xb45309;
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.14, 5), new THREE.MeshStandardMaterial({ color: col, roughness: 0.7 }));
      s.rotation.z = 0.5;
      s.position.set(-0.06 + i * 0.06, 0.08, (i - 1) * 0.04);
      g.add(s);
    }
  } else if (recipeId === 'vadaPav') {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf5d08a }));
    bun.scale.set(1.2, 0.7, 1);
    add(bun, 0.1);
  } else if (recipeId === 'paniPuri') {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshStandardMaterial({ color: 0xe8c468 }));
      p.position.set(Math.cos(a) * 0.08, 0.07, Math.sin(a) * 0.08);
      g.add(p);
    }
  } else if (recipeId === 'jalebi') {
    const tor = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.022, 8, 16), new THREE.MeshStandardMaterial({ color: 0xf59e0b }));
    add(tor, 0.07);
  } else if (recipeId === 'lassi' || recipeId === 'falooda' || recipeId === 'kulfi') {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.14, 12), mats.glass);
    add(cup, 0.1);
    const col = recipeId === 'falooda' ? 0xf9a8d4 : 0xfef9c3;
    const liq = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.042, 0.1, 12), new THREE.MeshStandardMaterial({ color: col }));
    add(liq, 0.09);
  } else if (recipeId === 'dosa') {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.015, 16), new THREE.MeshStandardMaterial({ color: 0xeab308 }));
    d.scale.set(1, 1, 0.7);
    add(d, 0.05);
  } else if (recipeId === 'biryani' || recipeId === 'pavBhaji' || recipeId === 'thali' || recipeId === 'maggi' || recipeId === 'momos') {
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mats.steel);
    bowl.rotation.x = Math.PI;
    add(bowl, 0.12);
    const col = recipeId === 'biryani' ? 0xea580c : recipeId === 'maggi' ? 0xf97316 : 0xca8a04;
    const food = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 6), new THREE.MeshStandardMaterial({ color: col }));
    food.scale.set(1, 0.45, 1);
    add(food, 0.1);
  } else if (recipeId === 'roll') {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.2, 10), new THREE.MeshStandardMaterial({ color: 0xd97706 }));
    r.rotation.z = Math.PI / 2;
    add(r, 0.08);
  } else if (recipeId === 'corn') {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.16, 10), new THREE.MeshStandardMaterial({ color: 0xfacc15 }));
    c.rotation.z = 0.5;
    add(c, 0.1);
  } else {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf59e0b }));
    add(s, 0.1);
  }
  g.userData.recipeId = recipeId;
  return g;
}
