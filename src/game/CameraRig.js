import * as THREE from 'three';

export const CAMERA_MODES = [
  { name: 'Chase', dist: 6.6, height: 2.2, lookAhead: 3.2, lookHeight: 1.1, fov: 64 },
  { name: 'Far chase', dist: 9.4, height: 3.3, lookAhead: 4, lookHeight: 1.25, fov: 62 },
  { name: 'Hood', hood: true, fov: 72 },
];

const desiredPos = new THREE.Vector3();
const desiredLook = new THREE.Vector3();

function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.mode = 0;
    // Output camera state.
    this.pos = new THREE.Vector3(0, 10, 0);
    this.look = new THREE.Vector3();
    // Chase-camera state (kept separately so we can blend from cinematics).
    this.chasePos = new THREE.Vector3();
    this.chaseLook = new THREE.Vector3();
    this.yaw = 0;
    this.shake = 0;
    this.fov = 64;
    this.orbitAngle = 0;
    this.blend = 1; // 0 = cinematic shot, 1 = chase camera
    this.cinePos = new THREE.Vector3();
    this.cineLook = new THREE.Vector3();
  }

  setMode(i) {
    const n = CAMERA_MODES.length;
    this.mode = ((i % n) + n) % n;
  }

  addShake(amount) {
    this.shake = Math.min(1.2, this.shake + amount);
  }

  /** Jump the chase state directly behind the car. */
  snap(car) {
    this.yaw = car.heading;
    this._chaseTargets(car, 0, this.chasePos, this.chaseLook, false);
  }

  /** Start a blend from the current output camera towards the chase camera. */
  beginBlendFromCurrent() {
    this.cinePos.copy(this.pos);
    this.cineLook.copy(this.look);
    this.blend = 0;
  }

  _chaseTargets(car, dt, outPos, outLook, smooth) {
    const m = CAMERA_MODES[this.mode];
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    if (m.hood) {
      const cp = Math.cos(car.pitch);
      const sp = Math.sin(car.pitch);
      outPos.set(car.x + fx * 0.55, car.y + 1.4 + sp * 0.55, car.z + fz * 0.55);
      outLook.set(car.x + fx * 30 * cp, car.y + 1.1 + sp * 30, car.z + fz * 30 * cp);
      this.yaw = car.heading;
      return;
    }
    // Lean towards the direction of travel when sliding so drifts read well.
    let targetYaw = car.heading;
    const speed = Math.hypot(car.vx, car.vz);
    if (speed > 6 && car.speed > 0) {
      targetYaw = lerpAngle(car.heading, Math.atan2(car.vx, car.vz), 0.35);
    }
    this.yaw = smooth ? lerpAngle(this.yaw, targetYaw, 1 - Math.exp(-5.5 * dt)) : targetYaw;
    const yx = Math.sin(this.yaw);
    const yz = Math.cos(this.yaw);
    const pull = Math.min(1, Math.abs(car.speed) / 70) * 0.9;
    outPos.set(car.x - yx * (m.dist + pull), car.y + m.height, car.z - yz * (m.dist + pull));
    outLook.set(car.x + fx * m.lookAhead, car.y + m.lookHeight, car.z + fz * m.lookAhead);
  }

  /** Chase update. opts: { boost, offroad, groundHeight(x, z) } */
  updateChase(dt, car, opts = {}) {
    const m = CAMERA_MODES[this.mode];
    this._chaseTargets(car, dt, desiredPos, desiredLook, true);
    if (m.hood) {
      this.chasePos.copy(desiredPos);
      this.chaseLook.copy(desiredLook);
    } else {
      this.chasePos.lerp(desiredPos, 1 - Math.exp(-14 * dt));
      this.chaseLook.lerp(desiredLook, 1 - Math.exp(-20 * dt));
    }
    if (this.blend < 1) {
      const t = this.blend * this.blend * (3 - 2 * this.blend);
      this.pos.copy(this.cinePos).lerp(this.chasePos, t);
      this.look.copy(this.cineLook).lerp(this.chaseLook, t);
    } else {
      this.pos.copy(this.chasePos);
      this.look.copy(this.chaseLook);
    }
    const kmh = Math.abs(car.speed) * 3.6;
    const fov = m.fov + Math.min(14, kmh * 0.05) + (opts.boost ? 7 : 0);
    this._apply(dt, fov, opts);
  }

  /** Orbit around a point (menu / finish). */
  updateOrbit(dt, target, { radius = 9, height = 2.6, speed = 0.18, lookHeight = 0.8, fov = 50 } = {}, opts = {}) {
    this.orbitAngle += dt * speed;
    desiredPos.set(
      target.x + Math.sin(this.orbitAngle) * radius,
      target.y + height,
      target.z + Math.cos(this.orbitAngle) * radius,
    );
    desiredLook.set(target.x, target.y + lookHeight, target.z);
    this.pos.lerp(desiredPos, 1 - Math.exp(-3 * dt));
    this.look.lerp(desiredLook, 1 - Math.exp(-6 * dt));
    this._apply(dt, fov, opts);
  }

  /** Place the output camera explicitly (start of a cinematic). */
  setShot(pos, look) {
    this.pos.copy(pos);
    this.look.copy(look);
  }

  _apply(dt, fov, opts) {
    const cam = this.camera;
    cam.position.copy(this.pos);
    if (this.shake > 0.001 || opts.offroad) {
      const s = this.shake * 0.35 + (opts.offroad || 0) * 0.05;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
      cam.position.z += (Math.random() - 0.5) * s;
    }
    this.shake *= Math.exp(-5 * dt);
    if (opts.groundHeight) {
      const g = opts.groundHeight(cam.position.x, cam.position.z) + 0.6;
      if (cam.position.y < g) cam.position.y = g;
    }
    cam.lookAt(this.look);

    // Keep a sensible horizontal field of view on portrait / narrow screens.
    let vfov = fov;
    if (cam.aspect < 1.35) {
      const h = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * 1.35);
      vfov = Math.min(100, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(h / 2) / cam.aspect)));
    }
    this.fov += (vfov - this.fov) * (1 - Math.exp(-4 * dt));
    if (Math.abs(cam.fov - this.fov) > 0.01) {
      cam.fov = this.fov;
      cam.updateProjectionMatrix();
    }
  }
}
