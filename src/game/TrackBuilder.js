import * as THREE from 'three';
import {
  createAsphaltTexture,
  createCurbTexture,
  createWallTexture,
  createCheckerTexture,
  createBannerTexture,
  createAdTexture,
  createGrassTexture,
} from './textures.js';
import { Simplex2 } from './noise.js';
import { smoothstep } from './terrain.js';
import { GAME_TITLE } from './config.js';

export const WALL_HEIGHT = 1.0;
export const WALL_THICKNESS = 0.7;

/**
 * Sweep a 2D cross-section profile along the track.
 * profile: [{ lat, y, u }] - each consecutive pair becomes its own strip.
 * Winding: walk the profile "up / to the right" to get outward normals.
 */
function sweep(track, profile, { start = 0, end = 0, closed = true, vLength = 10 } = {}) {
  const n = track.count;
  const idx = [];
  if (closed) {
    for (let i = 0; i <= n; i++) idx.push(i % n);
  } else {
    let i = start;
    idx.push(i);
    while (i !== end) {
      i = (i + 1) % n;
      idx.push(i);
    }
  }
  const sv = new Float32Array(idx.length);
  let acc = closed ? 0 : track.s[start];
  for (let j = 0; j < idx.length; j++) {
    sv[j] = acc;
    acc += track.segLen[idx[j]];
  }

  const positions = [];
  const uvs = [];
  const indices = [];
  let vert = 0;
  for (let k = 0; k < profile.length - 1; k++) {
    const p0 = profile[k];
    const p1 = profile[k + 1];
    const base = vert;
    for (let j = 0; j < idx.length; j++) {
      const i = idx[j];
      const h = track.heights[i];
      for (const p of [p0, p1]) {
        positions.push(track.px[i] + track.rx[i] * p.lat, h + p.y, track.pz[i] + track.rz[i] * p.lat);
        uvs.push(p.u, sv[j] / vLength);
        vert++;
      }
    }
    for (let j = 0; j < idx.length - 1; j++) {
      const a = base + j * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Contiguous runs of `flags` (circular). Returns [[start, end], ...]. */
function runs(flags) {
  const n = flags.length;
  const out = [];
  let first = -1;
  for (let i = 0; i < n; i++) {
    if (!flags[i]) {
      first = i;
      break;
    }
  }
  if (first < 0) return [[0, n - 1, true]];
  let i = (first + 1) % n;
  let count = 0;
  while (count < n) {
    if (flags[i]) {
      const s = i;
      let e = i;
      while (flags[(e + 1) % n] && count < n) {
        e = (e + 1) % n;
        count++;
      }
      out.push([s, e]);
      i = (e + 1) % n;
      count++;
    } else {
      i = (i + 1) % n;
      count++;
    }
  }
  return out;
}

/** Build a quad lying on the road at distance range [s0, s1] and lateral range. */
function roadDecal(track, s0, s1, lat0, lat1, lift) {
  const pts = [];
  for (const [s, lat] of [
    [s0, lat0],
    [s0, lat1],
    [s1, lat0],
    [s1, lat1],
  ]) {
    const p = track.pointAt(s, lat);
    pts.push(p.x, p.y + lift, p.z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
  geo.setIndex([0, 1, 2, 1, 3, 2]);
  geo.computeVertexNormals();
  return geo;
}

export function buildTrack(track, sampler, renderer) {
  const group = new THREE.Group();
  group.name = 'track';
  const cfg = track.config;
  const hw = cfg.halfWidth;
  const cw = cfg.curbWidth;
  const W = cfg.wallOffset;

  // --- Road -------------------------------------------------------------
  const roadRepeat = track.length / Math.round(track.length / 16);
  const asphalt = createAsphaltTexture(renderer);
  const roadMat = new THREE.MeshStandardMaterial({
    map: asphalt,
    roughness: 0.88,
    metalness: 0.0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
  });
  const road = new THREE.Mesh(
    sweep(track, [
      { lat: -hw, y: 0.06, u: 0 },
      { lat: hw, y: 0.06, u: 1 },
    ], { vLength: roadRepeat }),
    roadMat,
  );
  road.receiveShadow = true;
  group.add(road);

  // --- Curbs ------------------------------------------------------------
  const curbMat = new THREE.MeshStandardMaterial({
    map: createCurbTexture(renderer),
    roughness: 0.7,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  });
  for (const [s, e] of runs(track.curb)) {
    const opts = { closed: false, start: s, end: e, vLength: 3.2 };
    const right = new THREE.Mesh(
      sweep(track, [
        { lat: hw - 0.1, y: 0.07, u: 0 },
        { lat: hw + cw, y: 0.13, u: 1 },
      ], opts),
      curbMat,
    );
    const left = new THREE.Mesh(
      sweep(track, [
        { lat: -hw - cw, y: 0.13, u: 1 },
        { lat: -hw + 0.1, y: 0.07, u: 0 },
      ], opts),
      curbMat,
    );
    right.receiveShadow = left.receiveShadow = true;
    group.add(right, left);
  }

  // --- Barriers ---------------------------------------------------------
  const wallMat = new THREE.MeshStandardMaterial({ map: createWallTexture(renderer), roughness: 0.75 });
  const H = WALL_HEIGHT;
  const T = WALL_THICKNESS;
  const wallRight = new THREE.Mesh(
    sweep(track, [
      { lat: W, y: -0.6, u: 0 },
      { lat: W, y: H, u: 0.4 },
      { lat: W + T, y: H, u: 0.6 },
      { lat: W + T, y: -0.6, u: 1 },
    ], { vLength: 6 }),
    wallMat,
  );
  const wallLeft = new THREE.Mesh(
    sweep(track, [
      { lat: -W - T, y: -0.6, u: 1 },
      { lat: -W - T, y: H, u: 0.6 },
      { lat: -W, y: H, u: 0.4 },
      { lat: -W, y: -0.6, u: 0 },
    ], { vLength: 6 }),
    wallMat,
  );
  for (const w of [wallRight, wallLeft]) {
    w.castShadow = true;
    w.receiveShadow = true;
    group.add(w);
  }

  // --- Start / finish line & grid ------------------------------------------
  const checker = new THREE.Mesh(
    roadDecal(track, -1.4, 1.4, -hw, hw, 0.075),
    new THREE.MeshStandardMaterial({
      map: createCheckerTexture(renderer, 20, 3),
      roughness: 0.8,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -6,
    }),
  );
  checker.receiveShadow = true;
  group.add(checker);

  const paintMat = new THREE.MeshStandardMaterial({
    color: 0xeeeeee,
    roughness: 0.7,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -6,
  });
  for (let k = 0; k < 8; k++) {
    const { s: sSlot, lateral: lat } = track.gridParams(k);
    const front = new THREE.Mesh(roadDecal(track, sSlot + 2.7, sSlot + 3.0, lat - 1.4, lat + 1.4, 0.075), paintMat);
    const sideA = new THREE.Mesh(roadDecal(track, sSlot + 1.2, sSlot + 3.0, lat - 1.4, lat - 1.2, 0.075), paintMat);
    const sideB = new THREE.Mesh(roadDecal(track, sSlot + 1.2, sSlot + 3.0, lat + 1.2, lat + 1.4, 0.075), paintMat);
    group.add(front, sideA, sideB);
  }

  // --- Gantry with start lights ------------------------------------------
  const gantry = buildGantry(track, renderer);
  group.add(gantry.group);

  // --- Advertising boards ---------------------------------------------------
  group.add(buildAdBoards(track, renderer));

  // --- Terrain --------------------------------------------------------------
  const terrain = buildTerrain(track, sampler, renderer);
  group.add(terrain);

  return { group, startLights: gantry.lights, terrain };
}

function buildGantry(track, renderer) {
  const group = new THREE.Group();
  const W = track.config.wallOffset;
  const start = track.pointAt(0, 0);
  const span = (W + 1.6) * 2;
  const height = 7.2;

  const steel = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.5, metalness: 0.6 });
  const pillarGeo = new THREE.BoxGeometry(1.1, height + 1.2, 1.1);
  for (const side of [-1, 1]) {
    const p = track.pointAt(0, side * (W + 1.6));
    const pillar = new THREE.Mesh(pillarGeo, steel);
    pillar.position.set(p.x, p.y + (height + 1.2) / 2 - 0.3, p.z);
    pillar.rotation.y = start.heading;
    pillar.castShadow = true;
    group.add(pillar);
  }

  const beam = new THREE.Group();
  beam.position.set(start.x, start.y + height, start.z);
  beam.rotation.y = start.heading;
  group.add(beam);

  const truss = new THREE.Mesh(new THREE.BoxGeometry(span, 1.9, 0.9), steel);
  truss.castShadow = true;
  beam.add(truss);

  const bannerTex = createBannerTexture(renderer, GAME_TITLE, 'START  ·  FINISH');
  const bannerMat = new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 0.6, emissive: 0xffffff, emissiveMap: bannerTex, emissiveIntensity: 0.25 });
  const bannerGeo = new THREE.PlaneGeometry(span - 6, 1.7);
  // Faces the approaching cars (they drive toward +z in the beam's frame).
  const front = new THREE.Mesh(bannerGeo, bannerMat);
  front.position.set(0, 0, -0.46);
  front.rotation.y = Math.PI;
  beam.add(front);
  const back = new THREE.Mesh(bannerGeo, bannerMat);
  back.position.set(0, 0, 0.46);
  beam.add(back);

  // Start lights hang below the beam.
  const lights = [];
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
  const lensGeo = new THREE.CircleGeometry(0.42, 24);
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 1.5;
    const housing = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.5), housingMat);
    housing.position.set(x, -1.6, 0);
    beam.add(housing);
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x220a0a, emissive: 0x000000, roughness: 0.3 });
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.position.set(x, -1.6, -0.26);
    lens.rotation.y = Math.PI;
    beam.add(lens);
    const lensBack = new THREE.Mesh(lensGeo, lensMat);
    lensBack.position.set(x, -1.6, 0.26);
    beam.add(lensBack);
    lights.push(lensMat);
  }
  return { group, lights };
}

function buildAdBoards(track, renderer) {
  const group = new THREE.Group();
  const designs = [
    ['TURBO', '#0b0f17', '#ffffff', '#ff3b30'],
    ['NITRO X', '#ffd60a', '#111111', '#111111'],
    ['APEX OIL', '#1d5be8', '#ffffff', '#ffd60a'],
    ['GRIP+', '#f2f2f2', '#d61f2c', '#111111'],
    ['VELOCITY', '#16a34a', '#ffffff', '#0b0f17'],
  ];
  const mats = designs.map(
    ([label, bg, fg, accent]) =>
      new THREE.MeshStandardMaterial({ map: createAdTexture(renderer, label, bg, fg, accent), roughness: 0.6 }),
  );
  const backMat = new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.8 });
  const boardGeo = new THREE.PlaneGeometry(9, 2);
  const backGeo = new THREE.BoxGeometry(9.3, 2.3, 0.2);
  const legGeo = new THREE.BoxGeometry(0.2, 2.2, 0.2);
  const W = track.config.wallOffset + 3.2;
  let design = 0;
  let side = 1;
  const step = 70;
  for (let s = 60; s < track.length - 60; s += step) {
    // keep the start straight free around the grandstands
    if (s < 140 || s > track.length - 150) continue;
    const i = track.indexAt(s);
    if (Math.abs(track.curvature[i]) > 1 / 300) continue;
    side = -side;
    const p = track.pointAt(s, side * W);
    const board = new THREE.Group();
    board.position.set(p.x, p.y + 2.3, p.z);
    // Face the track: rotate so the plane normal points to the centre-line.
    board.rotation.y = p.heading + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
    const face = new THREE.Mesh(boardGeo, mats[design % mats.length]);
    face.position.z = 0.11;
    const back = new THREE.Mesh(backGeo, backMat);
    back.castShadow = true;
    board.add(face, back);
    for (const lx of [-3.5, 3.5]) {
      const leg = new THREE.Mesh(legGeo, backMat);
      leg.position.set(lx, -2, 0);
      board.add(leg);
    }
    group.add(board);
    design++;
  }
  return group;
}

/** Axis coordinates: fine spacing over [lo, hi], growing geometrically outside. */
function axisCoords(lo, hi, step, extent) {
  const count = Math.ceil((hi - lo) / step);
  const st = (hi - lo) / count;
  const fine = [];
  for (let i = 0; i <= count; i++) fine.push(lo + i * st);
  const left = [];
  const right = [];
  let s = st;
  let x = lo;
  while (x > lo - extent) {
    s = Math.min(s * 1.13, 110);
    x -= s;
    left.push(x);
  }
  s = st;
  x = hi;
  while (x < hi + extent) {
    s = Math.min(s * 1.13, 110);
    x += s;
    right.push(x);
  }
  return [...left.reverse(), ...fine, ...right];
}

function buildTerrain(track, sampler, renderer) {
  const b = track.bounds;
  const margin = sampler.flatRadius + 40;
  const xs = axisCoords(b.minX - margin, b.maxX + margin, 4, 1300);
  const zs = axisCoords(b.minZ - margin, b.maxZ + margin, 4, 1300);
  const nx = xs.length;
  const nz = zs.length;

  const positions = new Float32Array(nx * nz * 3);
  const uvs = new Float32Array(nx * nz * 2);
  const dists = new Float32Array(nx * nz);
  const nearIdx = new Int32Array(nx * nz);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const x = xs[i];
      const z = zs[j];
      const info = sampler.info(x, z);
      positions[k * 3] = x;
      positions[k * 3 + 1] = info.height;
      positions[k * 3 + 2] = z;
      uvs[k * 2] = x / 9;
      uvs[k * 2 + 1] = z / 9;
      dists[k] = info.dist;
      nearIdx[k] = info.index;
    }
  }
  const indices = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let p = 0;
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      const b2 = a + 1;
      const c = a + nx;
      const d = c + 1;
      indices[p++] = a;
      indices[p++] = c;
      indices[p++] = b2;
      indices[p++] = b2;
      indices[p++] = c;
      indices[p++] = d;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeVertexNormals();

  // Vertex colours.
  const normals = geo.getAttribute('normal');
  const colors = new Float32Array(nx * nz * 3);
  const noise = new Simplex2(99);
  const grassA = new THREE.Color(0x3f7a24);
  const grassB = new THREE.Color(0x6a9a35);
  const dry = new THREE.Color(0xa29a55);
  const runoff = new THREE.Color(0x5c9c34);
  const gravel = new THREE.Color(0xcdb88c);
  const rock = new THREE.Color(0x7a7166);
  const snow = new THREE.Color(0xf3f6fa);
  const c = new THREE.Color();
  const cfg = track.config;
  for (let k = 0; k < nx * nz; k++) {
    const x = positions[k * 3];
    const h = positions[k * 3 + 1];
    const z = positions[k * 3 + 2];
    const ny = normals.getY(k);
    const d = dists[k];
    const n1 = 0.5 + 0.5 * noise.fbm(x * 0.012, z * 0.012, 3);
    c.copy(grassA).lerp(grassB, n1);
    const dryness = smoothstep(0.25, 0.75, 0.5 + 0.5 * noise.noise(x * 0.0035 + 7, z * 0.0035 - 3));
    c.lerp(dry, dryness * 0.45);

    if (d < sampler.flatRadius + 2 && nearIdx[k] >= 0) {
      const i = nearIdx[k];
      const lat = (x - track.px[i]) * track.rx[i] + (z - track.pz[i]) * track.rz[i];
      const curv = track.curvature[i];
      c.lerp(runoff, 0.55);
      const outside = lat * curv > 0;
      const absLat = Math.abs(lat);
      if (outside && Math.abs(curv) > 1 / 75 && absLat > cfg.halfWidth + cfg.curbWidth + 1 && absLat < cfg.wallOffset + 1) {
        c.copy(gravel);
      }
    }
    const rockAmt = Math.min(1, smoothstep(30, 75, h) + smoothstep(0.85, 0.55, ny) * smoothstep(12, 30, h));
    c.lerp(rock, rockAmt);
    const snowAmt = smoothstep(105, 150, h) * smoothstep(0.55, 0.8, ny);
    c.lerp(snow, snowAmt);
    colors[k * 3] = c.r;
    colors[k * 3 + 1] = c.g;
    colors[k * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: createGrassTexture(renderer) });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}
