// Lap counting, timing, standings. Rendering independent.

export class Race {
  constructor(track, cars, laps) {
    this.track = track;
    this.cars = cars;
    this.laps = laps;
    this.time = 0;
    this.started = false;
    this.finishOrder = [];
    this.events = [];
    this.standings = cars.slice();
    for (const car of cars) this.resetCar(car);
  }

  resetCar(car) {
    car.lap = -1; // laps completed (-1 = still behind the line on the grid)
    car.maxLap = -1;
    car.lastS = car.info.s;
    car.progress = -this.track.length + car.info.s;
    car.finished = false;
    car.finishTime = 0;
    car.lapStart = 0;
    car.lapTimes = [];
    car.bestLap = Infinity;
    car.position = 0;
    car.wrongWay = 0;
    if (car.progress > 0) car.progress -= this.track.length;
  }

  start() {
    this.started = true;
    this.time = 0;
    for (const car of this.cars) car.lapStart = 0;
  }

  /** Call after physics. Pushes {type, car, ...} events into this.events. */
  update(dt) {
    if (this.started) this.time += dt;
    const L = this.track.length;
    for (const car of this.cars) {
      const s = car.info.s;
      if (car.lastS > L * 0.75 && s < L * 0.25) car.lap++;
      else if (car.lastS < L * 0.25 && s > L * 0.75) car.lap--;
      car.lastS = s;
      car.progress = car.lap * L + s;

      if (car.lap > car.maxLap) {
        car.maxLap = car.lap;
        if (car.lap >= 1 && this.started && !car.finished) {
          const lapTime = this.time - car.lapStart;
          car.lapStart = this.time;
          car.lapTimes.push(lapTime);
          const best = lapTime < car.bestLap;
          if (best) car.bestLap = lapTime;
          this.events.push({ type: 'lap', car, lap: car.lap, lapTime, best });
          if (car.lap >= this.laps) {
            car.finished = true;
            car.finishTime = this.time;
            this.finishOrder.push(car);
            this.events.push({ type: 'finish', car, position: this.finishOrder.length });
          }
        }
      }

      // Wrong-way detection (used for the player's HUD warning).
      const dot = Math.sin(car.heading) * car.info.tx + Math.cos(car.heading) * car.info.tz;
      const movingBack = car.vx * car.info.tx + car.vz * car.info.tz < -2;
      if ((dot < -0.35 && Math.abs(car.speed) > 2) || movingBack) car.wrongWay += dt;
      else car.wrongWay = 0;
    }

    this.standings = this.cars.slice().sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progress - a.progress;
    });
    this.standings.forEach((car, i) => (car.position = i + 1));
  }

  /** Total race distance for a car (metres), clamped at race end. */
  distanceRemaining(car) {
    return Math.max(0, this.laps * this.track.length - car.progress);
  }

  /** Final classification. Unfinished cars get an estimated time. */
  results() {
    return this.standings.map((car) => {
      let time = car.finishTime;
      let estimated = false;
      if (!car.finished) {
        const covered = Math.max(1, car.progress);
        const avg = covered / Math.max(1, this.time);
        time = this.time + this.distanceRemaining(car) / Math.max(5, avg);
        estimated = true;
      }
      return { car, time, estimated, bestLap: car.bestLap };
    }).sort((a, b) => a.time - b.time);
  }
}
