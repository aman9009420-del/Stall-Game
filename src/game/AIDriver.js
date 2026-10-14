// Computer-controlled driver. Produces the same inputs a human would
// (throttle / brake / steer / boost), so AI cars obey the same physics.

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class AIDriver {
  /**
   * @param car    Car instance to control
   * @param track  TrackData
   * @param opts   { skill: ~0.8-1.05, rng: () => number, rubber: 0-0.1 }
   */
  constructor(car, track, { skill = 0.95, rng = Math.random, rubber = 0.05 } = {}) {
    this.car = car;
    this.track = track;
    this.baseSkill = skill;
    this.skill = skill;
    this.rubber = rubber;
    this.rng = rng;
    const sp = car.spec;
    this.profile = track.speedProfile({
      aLat: Math.round(sp.aGrip * 0.86 * 100) / 100,
      rMin: sp.rMin,
      vMax: sp.vMax,
      brake: Math.round(sp.brake * 0.55 * 100) / 100,
    });
    this.laneBias = (rng() - 0.5) * 2.4;
    this.latCmd = car.info.lateral;
    this.stuckTime = 0;
    this.wrongTime = 0;
    this.wobblePhase = rng() * 100;
    this.boostCooldown = 2 + rng() * 6;
    this.respawned = false;
  }

  /** Compute inputs. `cars` = all cars, `leaderRef` = car used for rubber-banding. */
  update(dt, cars, raceStarted, rubberRef = null) {
    const car = this.car;
    const track = this.track;
    const info = car.info;
    const inp = car.input;
    const L = track.length;
    const hw = track.config.halfWidth;
    const speed = car.speed;
    inp.analog = true;
    inp.handbrake = false;

    if (!raceStarted) {
      inp.throttle = 0;
      inp.brake = 0;
      inp.steer = 0;
      inp.boost = false;
      return;
    }

    // --- Rubber banding (subtle) -------------------------------------------
    let skill = this.baseSkill;
    if (rubberRef && rubberRef !== car) {
      const gap = car.progress - rubberRef.progress; // >0: AI ahead of the player
      skill *= 1 - clamp(gap / 260, -1, 1) * this.rubber;
    }
    this.skill = skill;

    // --- Traffic awareness -----------------------------------------------------
    let desired = track.racingLine.offset[track.indexAt(info.s + 10 + Math.max(0, speed) * 0.5)] + this.laneBias * 0.6;
    let speedCap = Infinity;
    for (const other of cars) {
      if (other === car) continue;
      let ds = other.info.s - info.s;
      if (ds > L / 2) ds -= L;
      else if (ds < -L / 2) ds += L;
      if (ds <= 0 || ds > 30) continue;
      const dLat = other.info.lateral - info.lateral;
      const closing = speed - other.speed;
      if (Math.abs(dLat) < 3.1 && closing > -2) {
        // Pass on the side with more room.
        const roomLeft = other.info.lateral + hw;
        const roomRight = hw - other.info.lateral;
        const side = roomRight > roomLeft ? 1 : -1;
        desired = other.info.lateral + side * 3.9;
        if (ds < 11 && Math.abs(dLat) < 2.3 && closing > 0) speedCap = Math.min(speedCap, other.speed - 0.5);
      }
    }
    desired = clamp(desired, -hw + 1.5, hw - 1.5);
    // Rate-limit the lateral target so lane changes are smooth.
    this.latCmd += clamp(desired - this.latCmd, -4 * dt, 4 * dt);

    // --- Steering: pure pursuit on a look-ahead point -------------------------
    const look = 7 + Math.max(4, Math.abs(speed)) * 0.42;
    const tp = track.pointAt(info.s + look, this.latCmd + Math.sin(this.wobblePhase + info.s * 0.01) * 0.3);
    const dx = tp.x - car.x;
    const dz = tp.z - car.z;
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    const localF = dx * fx + dz * fz;
    const localR = dx * -fz + dz * fx;
    const d2 = dx * dx + dz * dz;
    const v = Math.max(3, Math.abs(speed));
    const sp = car.spec;
    const omegaMax = v / (sp.rMin + (v * v) / sp.aGrip);
    let steer;
    if (localF < 0.5) steer = localR >= 0 ? 1 : -1;
    else steer = (((2 * localR) / d2) * v) / omegaMax;
    inp.steer = clamp(steer * 1.15, -1, 1);

    // --- Speed control -------------------------------------------------------
    const idx = track.indexAt(info.s + Math.max(0, speed) * 0.25);
    let target = this.profile[idx] * skill;
    if (car.surface > 0.5) target = Math.min(target, sp.vMax * 0.5);
    target = Math.min(target, speedCap);
    const err = target - speed;
    if (err > 0.5) {
      inp.throttle = 1;
      inp.brake = 0;
    } else if (err < -1.5) {
      inp.throttle = 0;
      inp.brake = clamp(-err / 7, 0.25, 1);
    } else {
      inp.throttle = 0.45;
      inp.brake = 0;
    }

    // --- Nitro on long straights ---------------------------------------------
    this.boostCooldown -= dt;
    if (inp.boost) {
      if (car.boost < 0.05 || this.profile[track.indexAt(info.s + 90)] < sp.vMax * 0.9) {
        inp.boost = false;
        this.boostCooldown = 4 + this.rng() * 6;
      }
    } else if (this.boostCooldown <= 0 && car.boost > 0.45 && speed > 30) {
      let clear = true;
      for (let k = 20; k <= 160; k += 20) {
        if (this.profile[track.indexAt(info.s + k)] < sp.vMax * 0.97) {
          clear = false;
          break;
        }
      }
      if (clear && this.rng() < 0.5) inp.boost = true;
      else this.boostCooldown = 1 + this.rng() * 2;
    }

    // --- Recovery: stuck or facing the wrong way ------------------------------
    const tangentDot = fx * info.tx + fz * info.tz;
    this.stuckTime = Math.abs(speed) < 1.5 ? this.stuckTime + dt : 0;
    this.wrongTime = tangentDot < -0.2 ? this.wrongTime + dt : 0;
    if (this.stuckTime > 2.5 || this.wrongTime > 2) {
      car.respawn();
      this.latCmd = car.info.lateral;
      this.stuckTime = 0;
      this.wrongTime = 0;
      this.respawned = true;
    }
  }
}
