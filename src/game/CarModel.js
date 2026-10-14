import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Procedural low-poly sports car. The car faces +Z, origin on the ground at
// the centre of the wheelbase. Geometry is shared between all cars.

export const CAR_DIMENSIONS = {
  length: 4.5,
  width: 1.95,
  wheelRadius: 0.36,
  wheelBase: 2.76,
  track: 0.84,
};

const WHEEL_R = CAR_DIMENSIONS.wheelRadius;
const AXLE_Z = CAR_DIMENSIONS.wheelBase / 2;

let shared = null;

function bodyShape() {
  const s = new THREE.Shape();
  const archR = 0.47;
  const archY = WHEEL_R;
  s.moveTo(2.08, 0.22);
  s.lineTo(2.25, 0.33);
  s.lineTo(2.28, 0.5);
  s.lineTo(2.16, 0.64);
  s.lineTo(1.62, 0.76);
  s.lineTo(0.78, 0.86);
  s.lineTo(-1.05, 0.9);
  s.lineTo(-1.92, 0.9);
  s.lineTo(-2.24, 0.87);
  s.lineTo(-2.28, 0.6);
  s.lineTo(-2.2, 0.3);
  s.lineTo(-2.0, 0.22);
  // rear arch
  s.lineTo(-AXLE_Z - archR, 0.22);
  s.lineTo(-AXLE_Z - archR, archY);
  s.absarc(-AXLE_Z, archY, archR, Math.PI, 0, true);
  s.lineTo(-AXLE_Z + archR, 0.22);
  // front arch
  s.lineTo(AXLE_Z - archR, 0.22);
  s.lineTo(AXLE_Z - archR, archY);
  s.absarc(AXLE_Z, archY, archR, Math.PI, 0, true);
  s.lineTo(AXLE_Z + archR, 0.22);
  s.lineTo(2.08, 0.22);
  return s;
}

function cabinShape() {
  const s = new THREE.Shape();
  s.moveTo(0.78, 0.83);
  s.lineTo(-0.02, 1.25);
  s.lineTo(-0.78, 1.27);
  s.lineTo(-1.58, 0.88);
  s.lineTo(-1.5, 0.82);
  s.lineTo(0.7, 0.8);
  s.lineTo(0.78, 0.83);
  return s;
}

/** Extrude a side profile across the car width (centred on x = 0). */
function extrudeSide(shape, width, bevelThickness, bevelSize, curveSegments = 10) {
  const depth = width - bevelThickness * 2;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness,
    bevelSize,
    bevelSegments: 3,
    curveSegments,
  });
  geo.rotateY(-Math.PI / 2);
  geo.translate(depth / 2, 0, 0);
  geo.computeVertexNormals();
  return geo;
}

function buildShared() {
  const body = extrudeSide(bodyShape(), 1.92, 0.08, 0.06);
  const stripeBase = extrudeSide(bodyShape(), 0.24, 0.02, 0.06);
  stripeBase.scale(1, 1.02, 1.008);
  const stripes = mergeGeometries([
    stripeBase.clone().translate(-0.21, 0, 0),
    stripeBase.clone().translate(0.21, 0, 0),
  ]);
  const cabin = extrudeSide(cabinShape(), 1.5, 0.06, 0.05);
  const roof = new THREE.BoxGeometry(1.32, 0.05, 0.86);
  roof.translate(0, 1.32, -0.4);
  const roofStripe = mergeGeometries([
    new THREE.BoxGeometry(0.2, 0.02, 0.86).translate(-0.21, 1.355, -0.4),
    new THREE.BoxGeometry(0.2, 0.02, 0.86).translate(0.21, 1.355, -0.4),
  ]);

  // Spoiler wing + struts.
  const wing = new THREE.BoxGeometry(1.86, 0.06, 0.42);
  wing.rotateX(0.08);
  wing.translate(0, 1.18, -2.02);
  const endplates = mergeGeometries([
    new THREE.BoxGeometry(0.04, 0.22, 0.46).translate(-0.93, 1.13, -2.02),
    new THREE.BoxGeometry(0.04, 0.22, 0.46).translate(0.93, 1.13, -2.02),
  ]);
  const struts = mergeGeometries([
    new THREE.BoxGeometry(0.06, 0.3, 0.16).translate(-0.58, 1.02, -1.98),
    new THREE.BoxGeometry(0.06, 0.3, 0.16).translate(0.58, 1.02, -1.98),
  ]);

  // Trim: grille, diffuser, mirrors, side skirts.
  const trim = mergeGeometries([
    new THREE.BoxGeometry(1.1, 0.16, 0.08).translate(0, 0.4, 2.33),
    new THREE.BoxGeometry(1.5, 0.12, 0.3).translate(0, 0.25, -2.16),
    new THREE.BoxGeometry(0.2, 0.1, 0.14).translate(-1.0, 0.97, 0.52),
    new THREE.BoxGeometry(0.2, 0.1, 0.14).translate(1.0, 0.97, 0.52),
    new THREE.BoxGeometry(0.06, 0.08, 1.7).translate(-0.99, 0.27, 0),
    new THREE.BoxGeometry(0.06, 0.08, 1.7).translate(0.99, 0.27, 0),
    endplates,
    struts,
  ]);

  const headlights = mergeGeometries([
    new THREE.BoxGeometry(0.46, 0.09, 0.2).rotateX(-0.45).translate(-0.6, 0.63, 2.12),
    new THREE.BoxGeometry(0.46, 0.09, 0.2).rotateX(-0.45).translate(0.6, 0.63, 2.12),
  ]);
  const taillights = mergeGeometries([
    new THREE.BoxGeometry(0.54, 0.1, 0.06).translate(-0.6, 0.76, -2.325),
    new THREE.BoxGeometry(0.54, 0.1, 0.06).translate(0.6, 0.76, -2.325),
  ]);
  const exhaust = mergeGeometries([
    new THREE.CylinderGeometry(0.065, 0.065, 0.22, 10).rotateX(Math.PI / 2).translate(-0.36, 0.28, -2.28),
    new THREE.CylinderGeometry(0.065, 0.065, 0.22, 10).rotateX(Math.PI / 2).translate(0.36, 0.28, -2.28),
  ]);

  // Wheels (axis along x).
  const tire = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.3, 22, 1);
  tire.rotateZ(Math.PI / 2);
  const rimParts = [new THREE.CylinderGeometry(0.235, 0.235, 0.31, 14).rotateZ(Math.PI / 2)];
  for (let k = 0; k < 5; k++) {
    for (const side of [-1, 1]) {
      const spoke = new THREE.BoxGeometry(0.03, 0.42, 0.07);
      spoke.rotateX((k / 5) * Math.PI);
      spoke.translate(side * 0.16, 0, 0);
      rimParts.push(spoke);
    }
  }
  const rim = mergeGeometries(rimParts);
  const hub = new THREE.CylinderGeometry(0.06, 0.06, 0.34, 8).rotateZ(Math.PI / 2);

  // Blob shadow.
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const g = shadowCanvas.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 10, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.75)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  const blob = new THREE.PlaneGeometry(2.6, 5.4);
  blob.rotateX(-Math.PI / 2);

  const flame = new THREE.ConeGeometry(0.1, 0.75, 10, 1, true);
  flame.rotateX(-Math.PI / 2);
  flame.translate(0, 0, -0.375);

  // Merge parts that share a material (fewer draw calls per car).
  const flat = (geo) => (geo.index ? geo.toNonIndexed() : geo);
  const paint = mergeGeometries([body, roof, wing].map(flat));
  const stripeAll = mergeGeometries([stripes, roofStripe].map(flat));
  const wheelRim = mergeGeometries([rim, hub]);

  return {
    paint,
    stripes: stripeAll,
    cabin,
    trim,
    headlights,
    taillights,
    exhaust,
    tire,
    rim: wheelRim,
    blob,
    flame,
    materials: {
      glass: new THREE.MeshPhysicalMaterial({
        color: 0x0a121c,
        metalness: 0.3,
        roughness: 0.05,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
      }),
      trim: new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.55, metalness: 0.3 }),
      chrome: new THREE.MeshStandardMaterial({ color: 0xd8dde3, roughness: 0.18, metalness: 1 }),
      tire: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.92 }),
      rim: new THREE.MeshStandardMaterial({ color: 0xc9ced6, roughness: 0.25, metalness: 0.95 }),
      headlight: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xfff4d6,
        emissiveIntensity: 1.6,
        roughness: 0.2,
      }),
      shadow: new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -8,
      }),
      flame: new THREE.MeshBasicMaterial({
        color: 0x7fd4ff,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    },
  };
}

export class CarModel {
  constructor({ color = 0xd61f2c, stripe = 0xffffff } = {}) {
    if (!shared) shared = buildShared();
    const S = shared;
    const M = S.materials;

    this.paint = new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.55,
      roughness: 0.32,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
    });
    this.stripePaint = new THREE.MeshPhysicalMaterial({
      color: stripe,
      metalness: 0.3,
      roughness: 0.35,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    });
    this.tailMat = new THREE.MeshStandardMaterial({
      color: 0x3a0505,
      emissive: 0xff1a12,
      emissiveIntensity: 0.6,
      roughness: 0.3,
    });

    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);

    const add = (geo, mat, parent = this.body, cast = true) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = cast;
      mesh.receiveShadow = false;
      parent.add(mesh);
      return mesh;
    };
    add(S.paint, this.paint);
    add(S.stripes, this.stripePaint, this.body, false);
    add(S.cabin, M.glass);
    add(S.trim, M.trim);
    add(S.headlights, M.headlight, this.body, false);
    add(S.taillights, this.tailMat, this.body, false);
    add(S.exhaust, M.chrome, this.body, false);

    // Wheels: pivot (steering) -> spin -> meshes.
    this.wheels = [];
    for (const [x, z] of [
      [-CAR_DIMENSIONS.track, AXLE_Z],
      [CAR_DIMENSIONS.track, AXLE_Z],
      [-CAR_DIMENSIONS.track, -AXLE_Z],
      [CAR_DIMENSIONS.track, -AXLE_Z],
    ]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, WHEEL_R, z);
      const spin = new THREE.Group();
      pivot.add(spin);
      add(S.tire, M.tire, spin);
      add(S.rim, M.rim, spin, false);
      this.group.add(pivot);
      this.wheels.push({ pivot, spin, front: z > 0 });
    }

    const blob = new THREE.Mesh(S.blob, M.shadow);
    blob.position.y = 0.03;
    blob.renderOrder = 1;
    this.group.add(blob);

    this.flames = [];
    for (const x of [-0.36, 0.36]) {
      const f = new THREE.Mesh(S.flame, M.flame);
      f.position.set(x, 0.28, -2.38);
      f.visible = false;
      this.body.add(f);
      this.flames.push(f);
    }

    this._wheelAngle = 0;
  }

  setColors(color, stripe) {
    this.paint.color.setHex(color);
    this.stripePaint.color.setHex(stripe);
  }

  /**
   * steer: [-1, 1] (positive = right), wheelSpeed: m/s, roll/pitch: radians,
   * braking: bool, boost: bool.
   */
  update(dt, { steer = 0, wheelSpeed = 0, roll = 0, pitch = 0, braking = false, boost = false, time = 0 }) {
    this._wheelAngle += (wheelSpeed / WHEEL_R) * dt;
    const steerAngle = -steer * 0.5;
    for (const w of this.wheels) {
      w.spin.rotation.x = this._wheelAngle;
      if (w.front) w.pivot.rotation.y = steerAngle;
    }
    this.body.rotation.set(pitch, 0, roll);
    this.body.position.y = 0.0;
    this.tailMat.emissiveIntensity = braking ? 3.2 : 0.6;
    for (let i = 0; i < this.flames.length; i++) {
      const f = this.flames[i];
      f.visible = boost;
      if (boost) {
        const flick = 0.75 + 0.5 * Math.abs(Math.sin(time * 47 + i * 1.7)) + Math.random() * 0.2;
        f.scale.set(1, 1, flick);
      }
    }
  }

  dispose() {
    this.paint.dispose();
    this.stripePaint.dispose();
    this.tailMat.dispose();
  }
}
