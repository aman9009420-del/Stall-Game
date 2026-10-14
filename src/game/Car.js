import { BOOST } from './config.js';
import { wrapAngle } from './TrackData.js';

// Arcade car physics on the XZ plane. Height & tilt come from the track.
// This module has no rendering dependencies (it is also used in Node tests).

export const HALF_LEN = 2.25;
export const HALF_WID = 0.98;
const CAPSULE_R = 0.98;
const CAPSULE_HALF = HALF_LEN - CAPSULE_R;
const GEAR_TOPS = [0, 0.17, 0.32, 0.47, 0.62, 0.79, 1.04];
const IDLE_RPM = 950;
const MAX_RPM = 7600;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const approach = (v, target, step) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));

export class Car {
  constructor(track, spec, { name = 'Car', isPlayer = false, model = null, color = 0xffffff, stripe = 0xffffff } = {}) {
    this.track = track;
    this.spec = spec;
    this.name = name;
    this.isPlayer = isPlayer;
    this.model = model;
    this.color = color;
    this.stripe = stripe;
    this.input = { throttle: 0, brake: 0, steer: 0, handbrake: false, boost: false, analog: false };
    this.info = {};
    this.placeAt(0, 0);
  }

  /** Put the car on the track at distance s / lateral offset, at rest. */
  placeAt(s, lateral) {
    const p = this.track.pointAt(s, lateral);
    this.x = p.x;
    this.z = p.z;
    this.y = p.y;
    this.heading = p.heading;
    this.vx = 0;
    this.vz = 0;
    this.yawRate = 0;
    this.steer = 0;
    this.speed = 0;
    this.lateralSpeed = 0;
    this.drift = 0;
    this.surface = 0;
    this.onCurb = false;
    this.boosting = false;
    this.braking = false;
    this.boost = BOOST.start;
    this.slip = 0;
    this.pitch = 0;
    this.roll = 0;
    this.visPitch = 0;
    this.visRoll = 0;
    this.rpm = IDLE_RPM;
    this.gear = 1;
    this.impact = 0;
    this.scrape = 0;
    this._prevSpeed = 0;
    this._accelSmooth = 0;
    this.track.project(this.x, this.z, -1, this.info);
    this.trackIndex = this.info.index;
  }

  /** Respawn on the centre-line at the current track position (keeps race state). */
  respawn() {
    const s = this.info.s;
    const keep = { boost: this.boost };
    this.placeAt(s, Math.max(-3, Math.min(3, this.info.lateral * 0.3)));
    this.boost = keep.boost;
  }

  get forwardX() {
    return Math.sin(this.heading);
  }

  get forwardZ() {
    return Math.cos(this.heading);
  }

  step(dt, canDrive) {
    const sp = this.spec;
    const inp = this.input;
    const track = this.track;
    const cfg = track.config;
    const info = this.info;

    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    const rx = -fz;
    const rz = fx;
    let vF = this.vx * fx + this.vz * fz;
    let vL = this.vx * rx + this.vz * rz;

    // --- Surface --------------------------------------------------------
    const absLat = Math.abs(info.lateral);
    const offTarget = absLat > cfg.halfWidth + cfg.curbWidth * 0.6 ? 1 : 0;
    this.surface += (offTarget - this.surface) * Math.min(1, dt * 8);
    this.onCurb = !offTarget && absLat > cfg.halfWidth - 0.5 && track.curb[info.index] === 1;

    // --- Steering ---------------------------------------------------------
    const steerTarget = clamp(inp.steer, -1, 1);
    const returning = Math.abs(steerTarget) < Math.abs(this.steer) || steerTarget * this.steer < 0;
    const steerRate = inp.analog ? 9 : returning ? 7 : 3.4;
    this.steer = approach(this.steer, steerTarget, steerRate * dt);

    const throttle = canDrive ? clamp(inp.throttle, 0, 1) : 0;
    const brake = canDrive ? clamp(inp.brake, 0, 1) : 0;
    const handbrake = canDrive && inp.handbrake;

    // --- Nitro ------------------------------------------------------------
    this.boosting = !!(inp.boost && canDrive && this.boost > 0.005 && vF > 2);
    if (this.boosting) this.boost = Math.max(0, this.boost - BOOST.drain * dt);
    else if (canDrive) this.boost = Math.min(1, this.boost + BOOST.regen * dt);

    // --- Longitudinal -----------------------------------------------------
    const vMaxEff = sp.vMax * (1 - 0.45 * this.surface) * (this.boosting ? 1 + BOOST.speedBonus : 1);
    let a = 0;
    this.braking = false;
    if (throttle > 0) {
      if (vF > -1) {
        const r = clamp(vF / vMaxEff, 0, 1);
        a += throttle * sp.accel * (1 - r * r);
      } else {
        a += throttle * sp.brake;
        this.braking = true;
      }
    }
    if (brake > 0) {
      if (vF > 1) {
        a -= brake * sp.brake;
        this.braking = true;
      } else if (vF > -14) {
        a -= brake * sp.accel * 0.55;
      }
    }
    if (this.boosting) a += BOOST.accel * Math.max(0, 1 - vF / vMaxEff);
    if (vF > vMaxEff) a -= (vF - vMaxEff) * 1.5;
    // gravity along the slope
    const along = fx * info.tx + fz * info.tz;
    a -= 9.81 * info.slope * along;
    vF += a * dt;

    let resist = 0.25 + 0.00032 * vF * vF * (1 + this.surface) + this.surface * 3.2;
    if (throttle < 0.05) resist += 1.3; // engine braking
    if (handbrake) resist += 4.5;
    const dec = resist * dt;
    if (vF > 0) vF = Math.max(0, vF - dec);
    else vF = Math.min(0, vF + dec);

    // --- Lateral grip / drifting -----------------------------------------
    const speedAbs = Math.abs(vF);
    if (handbrake && speedAbs > 9) this.drift = Math.min(1, this.drift + dt * 5);
    else {
      const holding = Math.abs(this.steer) > 0.35 && speedAbs > 14 && Math.abs(vL) > 2;
      this.drift = Math.max(0, this.drift - dt * (holding ? 1.0 : 2.8));
    }
    let grip = sp.grip * (1 - 0.4 * this.surface);
    grip += (sp.driftGrip - grip) * this.drift;
    const vLBefore = Math.abs(vL);
    vL *= Math.exp(-grip * dt);
    // Arcade: while drifting, part of the sideways momentum turns into forward speed.
    if (this.drift > 0.05 && vF > 0) vF += (vLBefore - Math.abs(vL)) * 0.4 * this.drift;

    // --- Yaw --------------------------------------------------------------
    const aGrip = sp.aGrip * (1 - 0.3 * this.surface);
    const omegaMax = speedAbs / (sp.rMin + (speedAbs * speedAbs) / aGrip);
    const dir = vF >= 0 ? 1 : -1;
    const yawTarget = -this.steer * omegaMax * dir * (1 + 0.85 * this.drift);
    const resp = sp.yawResp * (1 - 0.45 * this.drift);
    this.yawRate += (yawTarget - this.yawRate) * (1 - Math.exp(-resp * dt));
    this.heading = wrapAngle(this.heading + this.yawRate * dt);

    // Compose velocity in the pre-rotation frame (velocity lags heading = slip).
    this.vx = fx * vF + rx * vL;
    this.vz = fz * vF + rz * vL;
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    // --- Track projection & barriers -------------------------------------
    track.project(this.x, this.z, this.trackIndex, info);
    this.trackIndex = info.index;
    this._collideWalls(info, cfg);

    // --- Derived state ------------------------------------------------------
    const nfx = Math.sin(this.heading);
    const nfz = Math.cos(this.heading);
    this.speed = this.vx * nfx + this.vz * nfz;
    this.lateralSpeed = this.vx * -nfz + this.vz * nfx;
    this.y = info.height;
    const along2 = nfx * info.tx + nfz * info.tz;
    const side2 = -nfz * info.tx + nfx * info.tz;
    this.pitch = Math.atan(info.slope * along2);
    this.roll = Math.atan(info.slope * side2);

    // Drifting charges nitro.
    const slide = Math.abs(this.lateralSpeed);
    if (canDrive && this.drift > 0.3 && slide > 2 && speedAbs > 12) {
      this.boost = Math.min(1, this.boost + slide * BOOST.driftGain * dt);
    }
    this.slip = clamp((slide - 2.4) / 6, 0, 1);
    if (this.braking && speedAbs > 18 && brake > 0.6) this.slip = Math.max(this.slip, 0.35);

    // Cosmetic body motion.
    const latAcc = this.speed * this.yawRate;
    this.visRoll += (clamp(latAcc * 0.0065, -0.075, 0.075) - this.visRoll) * Math.min(1, dt * 6);
    const longAcc = (this.speed - this._prevSpeed) / dt;
    this._prevSpeed = this.speed;
    this._accelSmooth += (longAcc - this._accelSmooth) * Math.min(1, dt * 6);
    this.visPitch += (clamp(-this._accelSmooth * 0.0045, -0.05, 0.05) - this.visPitch) * Math.min(1, dt * 5);

    this._updateEngine(dt, canDrive);
  }

  _collideWalls(info, cfg) {
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    const fr = Math.abs(fx * info.rx + fz * info.rz);
    const ext = HALF_LEN * fr + HALF_WID * Math.sqrt(Math.max(0, 1 - fr * fr));
    const limit = cfg.wallOffset - ext;
    let pen = 0;
    let nx = 0;
    let nz = 0;
    if (info.lateral > limit) {
      pen = info.lateral - limit;
      nx = -info.rx;
      nz = -info.rz;
    } else if (info.lateral < -limit) {
      pen = -limit - info.lateral;
      nx = info.rx;
      nz = info.rz;
    }
    if (pen <= 0) return;

    this.x += nx * pen;
    this.z += nz * pen;
    const vn = this.vx * nx + this.vz * nz;
    if (vn < 0) {
      const impact = -vn;
      this.vx -= 1.3 * vn * nx;
      this.vz -= 1.3 * vn * nz;
      const vn2 = this.vx * nx + this.vz * nz;
      const tvx = this.vx - vn2 * nx;
      const tvz = this.vz - vn2 * nz;
      const tfac = Math.max(0.6, 1 - impact * 0.025);
      this.vx = vn2 * nx + tvx * tfac;
      this.vz = vn2 * nz + tvz * tfac;
      // Glancing blows straighten the car along the barrier.
      const trackHeading = Math.atan2(info.tx, info.tz);
      let target = trackHeading;
      if (Math.abs(wrapAngle(this.heading - trackHeading)) > Math.PI / 2) target = trackHeading + Math.PI;
      const diff = wrapAngle(target - this.heading);
      this.heading = wrapAngle(this.heading + diff * Math.min(0.45, impact * 0.05));
      this.yawRate *= 0.5;
      this.impact = Math.max(this.impact, impact);
    }
    this.scrape = Math.max(this.scrape, Math.hypot(this.vx, this.vz));
    this.track.project(this.x, this.z, this.trackIndex, info);
    this.trackIndex = info.index;
  }

  _updateEngine(dt, canDrive) {
    const v = Math.abs(this.speed);
    const vMax = this.spec.vMax;
    let g = this.gear < 1 ? 1 : this.gear;
    while (g < 6 && v > GEAR_TOPS[g] * vMax) g++;
    while (g > 1 && v < GEAR_TOPS[g - 1] * vMax * 0.9) g--;
    this.gear = this.speed < -0.5 ? 0 : g;
    let target;
    if (!canDrive) {
      target = IDLE_RPM + this.input.throttle * (MAX_RPM - 1200 - IDLE_RPM);
    } else {
      const top = GEAR_TOPS[g] * vMax;
      target = Math.max(IDLE_RPM, (MAX_RPM * v) / top);
      if (this.speed < -0.5) target = IDLE_RPM + (MAX_RPM - IDLE_RPM) * (v / 14) * 0.7;
      // wheelspin-ish flare when launching
      if (this.input.throttle > 0.5 && v < 6) target = Math.max(target, 3800 + v * 300);
      if (this.boosting) target = Math.min(MAX_RPM * 1.05, target + 500);
    }
    this.rpm += (target - this.rpm) * Math.min(1, dt * 14);
  }
}

// ---------------------------------------------------------------------------
// Car vs car collisions (capsule vs capsule, equal masses)

const seg = { ax: 0, az: 0, bx: 0, bz: 0 };

function closestSegSeg(p1x, p1z, q1x, q1z, p2x, p2z, q2x, q2z) {
  const d1x = q1x - p1x;
  const d1z = q1z - p1z;
  const d2x = q2x - p2x;
  const d2z = q2z - p2z;
  const rx = p1x - p2x;
  const rz = p1z - p2z;
  const a = d1x * d1x + d1z * d1z;
  const e = d2x * d2x + d2z * d2z;
  const f = d2x * rx + d2z * rz;
  const c = d1x * rx + d1z * rz;
  const b = d1x * d2x + d1z * d2z;
  const denom = a * e - b * b;
  let s = denom > 1e-8 ? clamp((b * f - c * e) / denom, 0, 1) : 0;
  let t = (b * s + f) / e;
  if (t < 0) {
    t = 0;
    s = clamp(-c / a, 0, 1);
  } else if (t > 1) {
    t = 1;
    s = clamp((b - c) / a, 0, 1);
  }
  seg.ax = p1x + d1x * s;
  seg.az = p1z + d1z * s;
  seg.bx = p2x + d2x * t;
  seg.bz = p2z + d2z * t;
  return seg;
}

/** Resolve a collision between two cars. Returns the impact speed (0 if none). */
export function collideCars(A, B) {
  const dx0 = A.x - B.x;
  const dz0 = A.z - B.z;
  if (dx0 * dx0 + dz0 * dz0 > 36) return 0;
  const afx = Math.sin(A.heading) * CAPSULE_HALF;
  const afz = Math.cos(A.heading) * CAPSULE_HALF;
  const bfx = Math.sin(B.heading) * CAPSULE_HALF;
  const bfz = Math.cos(B.heading) * CAPSULE_HALF;
  const r = closestSegSeg(A.x - afx, A.z - afz, A.x + afx, A.z + afz, B.x - bfx, B.z - bfz, B.x + bfx, B.z + bfz);
  let nx = r.ax - r.bx;
  let nz = r.az - r.bz;
  const dist = Math.hypot(nx, nz);
  const minDist = CAPSULE_R * 2;
  if (dist >= minDist) return 0;
  if (dist > 1e-5) {
    nx /= dist;
    nz /= dist;
  } else {
    const l = Math.hypot(dx0, dz0) || 1;
    nx = dx0 / l;
    nz = dz0 / l;
  }
  const pen = minDist - dist;
  A.x += nx * pen * 0.5;
  A.z += nz * pen * 0.5;
  B.x -= nx * pen * 0.5;
  B.z -= nz * pen * 0.5;

  const rvx = A.vx - B.vx;
  const rvz = A.vz - B.vz;
  const vn = rvx * nx + rvz * nz;
  if (vn >= 0) return 0;
  const e = 0.3;
  const j = (-(1 + e) * vn) / 2;
  A.vx += j * nx;
  A.vz += j * nz;
  B.vx -= j * nx;
  B.vz -= j * nz;

  // A little spin from off-centre hits.
  const cx = (r.ax + r.bx) * 0.5;
  const cz = (r.az + r.bz) * 0.5;
  const torque = (ox, oz, jx, jz) => oz * jx - ox * jz;
  const k = 0.32;
  A.yawRate += clamp(torque(cx - A.x, cz - A.z, j * nx, j * nz) * k, -2, 2);
  B.yawRate += clamp(torque(cx - B.x, cz - B.z, -j * nx, -j * nz) * k, -2, 2);
  const impact = -vn;
  A.impact = Math.max(A.impact, impact);
  B.impact = Math.max(B.impact, impact);
  return impact;
}
