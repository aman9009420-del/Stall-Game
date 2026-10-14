import * as THREE from 'three';
import { TrackData } from './TrackData.js';
import { createTerrainSampler } from './terrain.js';
import { buildTrack } from './TrackBuilder.js';
import {
  SKY,
  createSky,
  createEnvironment,
  createLights,
  updateSunShadow,
  createVegetation,
  createStadium,
  animateCrowd,
  createClouds,
} from './Scenery.js';
import { CarModel } from './CarModel.js';
import { Car, collideCars } from './Car.js';
import { AIDriver } from './AIDriver.js';
import { Race } from './Race.js';
import { Input } from './Input.js';
import { CameraRig, CAMERA_MODES } from './CameraRig.js';
import { AudioEngine } from './AudioEngine.js';
import { Effects } from './Effects.js';
import { HUD, formatTime, ordinal, hexColor } from './HUD.js';
import { UI } from './UI.js';
import {
  CAR_TYPES,
  AI_COLORS,
  AI_NAMES,
  DIFFICULTY,
  DEFAULT_SETTINGS,
  LAP_OPTIONS,
  OPPONENT_OPTIONS,
} from './config.js';
import { createRng } from './noise.js';
import { loadSave, writeSave } from './storage.js';
import { staticBatch } from './batch.js';

const PHYSICS_DT = 1 / 120;
const INTRO_TIME = 3.4;
const COUNTDOWN_TIME = 3;
const RESULTS_DELAY = 3.5;

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const smooth01 = (t) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function colorDistance(a, b) {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  return Math.hypot(ca.r - cb.r, ca.g - cb.g, ca.b - cb.b);
}

function sanitizeSettings(s) {
  const out = { ...DEFAULT_SETTINGS, ...s };
  if (!(out.car >= 0 && out.car < CAR_TYPES.length)) out.car = 0;
  if (!LAP_OPTIONS.includes(out.laps)) out.laps = DEFAULT_SETTINGS.laps;
  if (!OPPONENT_OPTIONS.includes(out.opponents)) out.opponents = DEFAULT_SETTINGS.opponents;
  if (!DIFFICULTY[out.difficulty]) out.difficulty = DEFAULT_SETTINGS.difficulty;
  out.muted = !!out.muted;
  out.camera = Number.isInteger(out.camera) ? out.camera : 0;
  return out;
}

export class Game {
  constructor(container) {
    this.container = container;
    this.save = loadSave();
    this.settings = sanitizeSettings(this.save.settings || {});
    this.state = 'loading';
    this.paused = false;
    this.time = 0;
    this.stateTime = 0;
    this.accumulator = 0;
    this.cars = [];
    this.drivers = new Map();
    this.player = null;
    this.race = null;
    this.autopilot = null;
    this.countdownStep = -1;
    this.resultsShown = false;
    this.newRecord = false;
    this.needsRender = true;
    this.perfTime = 0;
    this.perfFrames = 0;
  }

  // ---------------------------------------------------------------- Setup

  async init() {
    this.ui = new UI(this);
    this.ui.setLoadingText('Starting engines…');
    await nextFrame();

    // Make sure the display fonts are ready before painting banners.
    if (document.fonts && document.fonts.load) {
      await Promise.race([
        Promise.all([document.fonts.load('40px "Russo One"'), document.fonts.load('600 20px "Rajdhani"')]),
        new Promise((r) => setTimeout(r, 2500)),
      ]).catch(() => {});
    }

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (err) {
      this.ui.setLoadingText('WebGL is not available in this browser. Please try a different browser or device.');
      throw err;
    }
    this.renderer = renderer;
    const touch = document.body.classList.contains('touch-device');
    this.maxPixelRatio = Math.min(window.devicePixelRatio || 1, touch ? 1.5 : 2);
    this.pixelRatio = this.maxPixelRatio;
    renderer.setPixelRatio(this.pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    this.container.appendChild(renderer.domElement);

    const scene = (this.scene = new THREE.Scene());
    scene.background = SKY.horizon.clone();
    scene.fog = new THREE.FogExp2(SKY.horizon.clone(), 0.00055);
    scene.environment = createEnvironment(renderer);
    scene.environmentIntensity = 0.85;

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.3, 4000);
    this.sky = createSky();
    scene.add(this.sky);
    this.lights = createLights(scene);

    this.ui.setLoadingText('Building the circuit…');
    await nextFrame();
    this.track = new TrackData();
    this.sampler = createTerrainSampler(this.track);
    const built = buildTrack(this.track, this.sampler, renderer);
    staticBatch(built.group);
    scene.add(built.group);
    this.startLights = built.startLights;

    this.ui.setLoadingText('Planting trees…');
    await nextFrame();
    scene.add(createVegetation(this.track, this.sampler));
    this.stadium = createStadium(this.track);
    staticBatch(this.stadium);
    scene.add(this.stadium);
    this.clouds = createClouds();
    scene.add(this.clouds);

    this.effects = new Effects(scene);
    this.input = new Input();
    this.input.bindTouch(document.getElementById('touch'));
    this.rig = new CameraRig(this.camera);
    this.rig.setMode(this.settings.camera);
    this.audio = new AudioEngine();
    this.audio.muted = this.settings.muted;
    this.hud = new HUD(this.track);

    window.addEventListener('resize', () => this.onResize());
    // Some browsers keep the AudioContext suspended until a direct gesture.
    const unlock = () => {
      if (this.audio.ctx && !this.paused) this.audio.resume();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.isRaceActive() && !this.paused) this.setPaused(true);
    });

    this.ui.setLoadingText('Warming up tyres…');
    await nextFrame();
    this.setupCars();
    this.enterMenu();
    this.onResize();
    this.rig.updateOrbit(1, this.player.model.group.position, this._menuOrbit());
    renderer.compile(scene, this.camera);

    this.last = performance.now();
    renderer.setAnimationLoop((t) => this.frame(t));
    this.ui.hideLoading();
  }

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this._applyViewOffset();
    this.camera.updateProjectionMatrix();
    this.needsRender = true;
  }

  _applyViewOffset() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // In the menu, shift the scene right so the car isn't hidden by the panel.
    if (this.state === 'menu' && w > 900) this.camera.setViewOffset(w, h, -w * 0.17, 0, w, h);
    else this.camera.clearViewOffset();
  }

  setState(s) {
    this.state = s;
    this.stateTime = 0;
    this._applyViewOffset();
    this.camera.updateProjectionMatrix();
  }

  isRaceActive() {
    return this.state === 'intro' || this.state === 'countdown' || this.state === 'racing' || this.state === 'finished';
  }

  // ------------------------------------------------------------ Cars & race

  setupCars() {
    for (const car of this.cars) {
      this.scene.remove(car.model.group);
      car.model.dispose();
    }
    this.cars = [];
    this.drivers.clear();
    this.autopilot = null;

    const rng = createRng((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    const n = this.settings.opponents + 1;
    const playerSpec = CAR_TYPES[this.settings.car];
    const diff = DIFFICULTY[this.settings.difficulty];

    const skills = [];
    for (let k = 0; k < n - 1; k++) skills.push(diff.skill[0] + (diff.skill[1] - diff.skill[0]) * rng());
    skills.sort((a, b) => b - a);
    const palette = shuffle(
      AI_COLORS.filter((c) => colorDistance(c.color, playerSpec.color) > 0.35),
      rng,
    );
    const names = shuffle(AI_NAMES.slice(), rng);

    for (let k = 0; k < n - 1; k++) {
      const spec = CAR_TYPES[Math.floor(rng() * CAR_TYPES.length)];
      const col = palette[k % palette.length];
      const car = this._makeCar(spec, names[k % names.length], col.color, col.stripe, false);
      const g = this.track.gridParams(k);
      car.placeAt(g.s, g.lateral);
      this.drivers.set(car, new AIDriver(car, this.track, { skill: skills[k], rng, rubber: diff.rubber }));
    }
    const player = this._makeCar(playerSpec, 'You', playerSpec.color, playerSpec.stripe, true);
    const g = this.track.gridParams(n - 1);
    player.placeAt(g.s, g.lateral);
    this.player = player;

    this.race = new Race(this.track, this.cars, this.settings.laps);
    this.race.update(0);
    this.effects.clear();
    for (const car of this.cars) this.syncCar(car, 0);
  }

  _makeCar(spec, name, color, stripe, isPlayer) {
    const model = new CarModel({ color, stripe });
    const car = new Car(this.track, spec, { name, isPlayer, model, color, stripe });
    car.cssColor = hexColor(color);
    this.scene.add(model.group);
    this.cars.push(car);
    return car;
  }

  enterMenu() {
    this.paused = false;
    this.resultsShown = false;
    this.setupCars();
    this.setState('menu');
    this.setStartLights('off');
    this.hud.show(false);
    this.ui.showPause(false);
    this.ui.showResults(false);
    this.ui.showMenu(true);
    this.input.capture = false;
    if (this.audio.ready) {
      this.audio.resume();
      this.audio.silence();
    }
    this.rig.orbitAngle = this.player.heading + 2.2;
    this.needsRender = true;
  }

  startRace() {
    if (this.state !== 'menu' && !this.resultsShown && !this.paused) return;
    this.audio.init();
    this.audio.setMuted(this.settings.muted);
    this.audio.resume();
    this.paused = false;
    this.resultsShown = false;
    this.newRecord = false;
    this.setupCars();
    this.ui.showMenu(false);
    this.ui.showPause(false);
    this.ui.showResults(false);
    this.hud.reset();
    this.hud.show(true);
    this.setStartLights('off');
    this.countdownStep = -1;
    this.input.capture = true;
    this.setState('intro');
    this.rig.snap(this.player);
    this._introShot(0);
    this.rig.blend = 0;
  }

  restartRace() {
    if (!this.isRaceActive()) return;
    this.paused = false;
    this.resultsShown = true; // allow startRace's guard to pass
    this.startRace();
  }

  setPaused(v) {
    if (v === this.paused) return;
    if (v && !this.isRaceActive()) return;
    this.paused = v;
    this.ui.showPause(v);
    this.input.capture = !v;
    if (v) this.audio.pause();
    else {
      this.audio.resume();
      this.last = performance.now();
    }
    this.needsRender = true;
  }

  toggleMute() {
    this.settings.muted = !this.settings.muted;
    this.audio.setMuted(this.settings.muted);
    this.persistSettings();
    this.ui.refreshMute();
    if (this.isRaceActive() && this.hud) this.hud.toast(this.settings.muted ? 'Sound off' : 'Sound on', 1.2);
  }

  updateSetting(key, value) {
    this.settings[key] = value;
    this.persistSettings();
    if (this.state !== 'menu') return;
    if (key === 'car') {
      const spec = CAR_TYPES[value];
      const p = this.player;
      p.spec = spec;
      p.color = spec.color;
      p.cssColor = hexColor(spec.color);
      p.model.setColors(spec.color, spec.stripe);
    } else if (key === 'opponents') {
      this.setupCars();
    }
  }

  persistSettings() {
    this.save.settings = { ...this.settings };
    writeSave(this.save);
  }

  bestLapFor(carId) {
    const b = this.save.bestLaps && this.save.bestLaps[carId];
    return Number.isFinite(b) ? b : Infinity;
  }

  setStartLights(mode) {
    const red = new THREE.Color(1, 0.06, 0.03);
    const green = new THREE.Color(0.1, 1, 0.25);
    this.startLights.forEach((mat, i) => {
      if (mode === 'go') {
        mat.emissive.copy(green);
        mat.emissiveIntensity = 4;
        mat.color.setHex(0x0a2a10);
      } else if (typeof mode === 'number' && i < mode) {
        mat.emissive.copy(red);
        mat.emissiveIntensity = 4;
        mat.color.setHex(0x2a0505);
      } else {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 1;
        mat.color.setHex(0x220a0a);
      }
    });
  }

  // ----------------------------------------------------------------- Loop

  frame(now) {
    const raw = (now - this.last) / 1000;
    this.last = now;
    const dt = Math.min(0.1, Math.max(0, raw));
    this.handleActions();
    if (!this.paused) {
      this.update(dt);
      this.needsRender = true;
    }
    if (this.needsRender) {
      this.renderer.render(this.scene, this.camera);
      this.needsRender = false;
    }
    this._adaptResolution(raw);
  }

  handleActions() {
    for (const a of this.input.consumeActions()) {
      switch (a) {
        case 'pause':
          if (this.isRaceActive() && !this.resultsShown) this.setPaused(!this.paused);
          break;
        case 'camera':
          if (this.isRaceActive() && !this.paused) {
            this.rig.setMode(this.rig.mode + 1);
            this.settings.camera = this.rig.mode;
            this.persistSettings();
            this.hud.toast(`Camera: <b>${CAMERA_MODES[this.rig.mode].name}</b>`, 1.3);
          }
          break;
        case 'reset':
          if (this.state === 'racing' && !this.paused) this.player.respawn();
          break;
        case 'mute':
          this.toggleMute();
          break;
        case 'confirm':
        case 'pad-a':
          if (this.state === 'menu') this.startRace();
          else if (this.paused && a === 'confirm') this.setPaused(false);
          else if (this.resultsShown) this.restartRace();
          break;
        default:
          break;
      }
    }
  }

  update(dt) {
    this.time += dt;
    this.stateTime += dt;
    const st = this.state;
    const player = this.player;
    const driving = st === 'racing' || st === 'finished';

    // --- Inputs -----------------------------------------------------------
    const pin = this.input.poll();
    const pi = player.input;
    if (st === 'racing') {
      Object.assign(pi, pin);
    } else if (st === 'intro' || st === 'countdown') {
      pi.throttle = pin.throttle;
      pi.brake = 0;
      pi.steer = 0;
      pi.handbrake = false;
      pi.boost = false;
    } else if (st === 'finished' && this.autopilot) {
      this.autopilot.update(dt, this.cars, true, null);
    } else {
      pi.throttle = pi.brake = pi.steer = 0;
      pi.handbrake = pi.boost = false;
    }
    for (const [, drv] of this.drivers) drv.update(dt, this.cars, driving, player);

    // --- Physics (fixed step) ------------------------------------------------
    this.accumulator = Math.min(this.accumulator + dt, 0.2);
    const cars = this.cars;
    while (this.accumulator >= PHYSICS_DT) {
      for (const car of cars) car.step(PHYSICS_DT, driving);
      for (let i = 0; i < cars.length; i++) {
        for (let j = i + 1; j < cars.length; j++) collideCars(cars[i], cars[j]);
      }
      for (const car of cars) {
        this.track.project(car.x, car.z, car.trackIndex, car.info);
        car.trackIndex = car.info.index;
      }
      this.race.update(PHYSICS_DT);
      this.accumulator -= PHYSICS_DT;
    }
    for (const e of this.race.events) this.onRaceEvent(e);
    this.race.events.length = 0;

    // --- Visual sync & effects -------------------------------------------------
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      this.syncCar(car, dt);
      this.effects.car(car, i, dt);
    }
    if (player.impact > 3) {
      this.audio.impact(player.impact);
      this.rig.addShake(Math.min(1, player.impact / 14));
      if (player.impact > 7) this.effects.burst(player.x, player.y + 0.6, player.z, player.impact);
    }
    for (const car of cars) {
      car.impact = 0;
      car.scrape = 0;
    }
    this.effects.update(dt);

    // --- State machine & camera -----------------------------------------------
    this._updateState(dt);
    this._updateCamera(dt);

    // --- World ------------------------------------------------------------------
    updateSunShadow(this.lights.sun, tmpFocus.set(player.x, player.y, player.z), this.lights.shadowSize);
    this.sky.position.copy(this.camera.position);
    this.clouds.rotation.y += dt * 0.0015;
    const excitement = st === 'countdown' || st === 'finished' ? 0.9 : 0.35;
    animateCrowd(this.stadium, this.time, excitement);
    this.effects.setViewport(this.renderer.domElement.height, this.camera.fov);

    // --- HUD & audio ----------------------------------------------------------------
    if (st !== 'menu') this.hud.update(dt, { player, race: this.race, laps: this.race.laps });
    this._updateAudio();
  }

  _updateState() {
    const st = this.state;
    if (st === 'intro') {
      if (this.stateTime >= INTRO_TIME) {
        this.setState('countdown');
        this.countdownStep = -1;
      }
    } else if (st === 'countdown') {
      const step = Math.floor(this.stateTime);
      if (step !== this.countdownStep && step < 3) {
        this.countdownStep = step;
        this.setStartLights(step + 1);
        this.hud.flash(String(3 - step), 'red', 0.95);
        this.audio.beep(440, 0.22, 0.22);
      }
      if (this.stateTime >= COUNTDOWN_TIME) {
        this.setState('racing');
        this.race.start();
        this.setStartLights('go');
        this.hud.flash('GO!', 'go', 1.0);
        this.audio.beep(880, 0.55, 0.28);
        this.lightsOffAt = 5;
      }
    } else if (st === 'racing') {
      if (this.lightsOffAt && this.stateTime > this.lightsOffAt) {
        this.setStartLights('off');
        this.lightsOffAt = 0;
      }
    } else if (st === 'finished') {
      if (!this.resultsShown && this.stateTime > RESULTS_DELAY) {
        this.resultsShown = true;
        this.input.capture = false;
        this.hud.show(false);
        this.ui.showResults(true, {
          rows: this.race.results(),
          player: this.player,
          laps: this.race.laps,
          newRecord: this.newRecord,
        });
      }
    }
  }

  _introShot(t) {
    const p = this.player;
    const e = smooth01(t);
    const a = p.heading + 0.5 + (Math.PI - 0.5) * e;
    const r = 26 - 16 * e;
    const h = 11 - 7 * e;
    tmpA.set(p.x + Math.sin(a) * r, p.y + h, p.z + Math.cos(a) * r);
    tmpB.set(p.x, p.y + 0.9, p.z);
    this.rig.cinePos.copy(tmpA);
    this.rig.cineLook.copy(tmpB);
  }

  _menuOrbit() {
    const narrow = window.innerWidth <= 760;
    return { radius: narrow ? 8.5 : 7.4, height: narrow ? 3.2 : 2.1, speed: 0.22, lookHeight: narrow ? 0.2 : 0.75, fov: narrow ? 58 : 46 };
  }

  _updateCamera(dt) {
    const st = this.state;
    const p = this.player;
    const ground = (x, z) => this.sampler.height(x, z);
    if (st === 'menu') {
      this.rig.updateOrbit(dt, p.model.group.position, this._menuOrbit(), { groundHeight: ground });
      return;
    }
    if (st === 'finished') {
      this.rig.updateOrbit(dt, p.model.group.position, { radius: 10, height: 3.4, speed: 0.3, lookHeight: 0.9, fov: 55 }, { groundHeight: ground });
      return;
    }
    if (st === 'intro') {
      const t = this.stateTime / INTRO_TIME;
      this._introShot(Math.min(1, t * 1.15));
      this.rig.blend = smooth01((t - 0.55) / 0.45);
    } else {
      this.rig.blend = 1;
    }
    this.rig.updateChase(dt, p, {
      boost: p.boosting,
      offroad: p.surface > 0.5 && Math.abs(p.speed) > 5 ? Math.min(1, Math.abs(p.speed) / 30) : 0,
      groundHeight: ground,
    });
  }

  syncCar(car, dt) {
    const m = car.model;
    m.group.position.set(car.x, car.y, car.z);
    m.group.rotation.set(-car.pitch, car.heading, -car.roll, 'YXZ');
    m.update(dt, {
      steer: car.steer,
      wheelSpeed: car.speed,
      roll: car.visRoll,
      pitch: car.visPitch,
      braking: car.braking,
      boost: car.boosting,
      time: this.time,
    });
  }

  onRaceEvent(e) {
    const p = this.player;
    if (e.type === 'lap' && e.car === p) {
      const left = this.race.laps - e.lap;
      let html = `LAP ${e.lap} · <b>${formatTime(e.lapTime)}</b>`;
      if (e.best && e.lap > 1) html += ' <span class="best">FASTEST LAP</span>';
      this.recordLap(e.lapTime);
      if (this.newRecordThisLap) html += ' <span class="best">NEW RECORD</span>';
      this.hud.toast(html, 3);
      if (left === 1) this.hud.flash('FINAL LAP', 'gold small', 1.8);
    } else if (e.type === 'finish') {
      if (e.car === p) this._playerFinished(e.position);
      else if (e.position === 1 && !p.finished) this.hud.toast(`<b>${e.car.name}</b> takes the chequered flag!`, 2.5);
    }
  }

  recordLap(t) {
    this.newRecordThisLap = false;
    const id = this.player.spec.id;
    if (!this.save.bestLaps) this.save.bestLaps = {};
    const prev = this.save.bestLaps[id];
    if (!Number.isFinite(prev) || t < prev) {
      this.save.bestLaps[id] = t;
      writeSave(this.save);
      if (Number.isFinite(prev)) this.newRecordThisLap = true;
      this.newRecord = true;
    }
  }

  _playerFinished(position) {
    this.setState('finished');
    const p = this.player;
    this.hud.flash(position === 1 ? 'YOU WIN!' : `${position}${ordinal(position)} PLACE`, 'gold', 3.2);
    this.audio.fanfare(position <= 3);
    this.autopilot = new AIDriver(p, this.track, { skill: 0.8, rng: Math.random, rubber: 0 });
    this.rig.orbitAngle = p.heading + Math.PI * 0.75;
    this.save.races = (this.save.races || 0) + 1;
    if (position === 1) this.save.wins = (this.save.wins || 0) + 1;
    writeSave(this.save);
  }

  _updateAudio() {
    if (!this.audio.ready) return;
    const p = this.player;
    const active = this.isRaceActive() && !this.resultsShown;
    if (!active) {
      this.audio.silence();
      return;
    }
    let oppDist = 999;
    let oppRpm = 3000;
    for (const car of this.cars) {
      if (car === p) continue;
      const d = Math.hypot(car.x - p.x, car.z - p.z);
      if (d < oppDist) {
        oppDist = d;
        oppRpm = car.rpm;
      }
    }
    this.audio.update({
      rpm: p.rpm,
      throttle: p.input.throttle,
      speed: p.speed,
      slip: p.slip,
      offroad: p.surface,
      curb: p.onCurb,
      boost: p.boosting,
      oppDist,
      oppRpm,
      active: true,
    });
  }

  /** Lower the render resolution if the device struggles. */
  _adaptResolution(raw) {
    if (document.hidden || raw > 0.25 || this.paused || this.state === 'loading') return;
    this.perfTime += raw;
    this.perfFrames++;
    if (this.perfTime < 3) return;
    const avg = this.perfTime / this.perfFrames;
    this.perfTime = 0;
    this.perfFrames = 0;
    if (avg > 1 / 38 && this.pixelRatio > 0.75) {
      this.pixelRatio = Math.max(0.75, this.pixelRatio - 0.25);
      this.renderer.setPixelRatio(this.pixelRatio);
      this.onResize();
    }
  }
}

const tmpFocus = new THREE.Vector3();
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
