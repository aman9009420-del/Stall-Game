import * as THREE from 'three';
import { createSoftDotTexture } from './textures.js';

/** GPU point particles with per-particle size / colour / alpha. */
export class ParticleSystem {
  constructor(max, { additive = false } = {}) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.alpha0 = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.gravity = new Float32Array(max);
    this.next = 0;
    this.alive = 0;

    const geo = new THREE.BufferGeometry();
    const attr = (arr, n) => {
      const a = new THREE.BufferAttribute(arr, n);
      a.setUsage(THREE.DynamicDrawUsage);
      return a;
    };
    this.posAttr = attr(this.pos, 3);
    this.colAttr = attr(this.col, 3);
    this.sizeAttr = attr(this.size, 1);
    this.alphaAttr = attr(this.alpha, 1);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('aColor', this.colAttr);
    geo.setAttribute('aSize', this.sizeAttr);
    geo.setAttribute('aAlpha', this.alphaAttr);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: createSoftDotTexture() },
        uScale: { value: 400 },
      },
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute float aAlpha;
        attribute vec3 aColor;
        uniform float uScale;
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aAlpha > 0.0 ? aSize * uScale / max(0.1, -mv.z) : 0.0;
          vAlpha = aAlpha;
          vColor = aColor;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          float a = texture2D(uMap, gl_PointCoord).a * vAlpha;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor, a);
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  emit(x, y, z, vx, vy, vz, o) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    const i3 = i * 3;
    this.pos[i3] = x;
    this.pos[i3 + 1] = y;
    this.pos[i3 + 2] = z;
    this.vel[i3] = vx;
    this.vel[i3 + 1] = vy;
    this.vel[i3 + 2] = vz;
    this.col[i3] = o.r;
    this.col[i3 + 1] = o.g;
    this.col[i3 + 2] = o.b;
    this.size[i] = o.size;
    this.life[i] = o.life;
    this.maxLife[i] = o.life;
    this.grow[i] = o.grow || 0;
    this.alpha0[i] = o.alpha;
    this.alpha[i] = o.alpha;
    this.drag[i] = o.drag || 0;
    this.gravity[i] = o.gravity || 0;
  }

  update(dt) {
    let alive = 0;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      alive++;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      const i3 = i * 3;
      const damp = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i3] *= damp;
      this.vel[i3 + 1] = this.vel[i3 + 1] * damp - this.gravity[i] * dt;
      this.vel[i3 + 2] *= damp;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      this.size[i] += this.grow[i] * dt;
      const age = 1 - this.life[i] / this.maxLife[i];
      this.alpha[i] = this.alpha0[i] * Math.min(1, age * 8) * (1 - age);
    }
    this.alive = alive;
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
  }

  clear() {
    this.life.fill(0);
    this.alpha.fill(0);
  }
}

/** Ring buffer of skid-mark quads laid on the road. */
export class SkidMarks {
  constructor(maxSegments = 2400) {
    this.max = maxSegments;
    this.positions = new Float32Array(maxSegments * 4 * 3);
    this.colors = new Float32Array(maxSegments * 4 * 4);
    const idx = new Uint32Array(maxSegments * 6);
    for (let i = 0; i < maxSegments; i++) {
      const v = i * 4;
      idx.set([v, v + 2, v + 1, v + 1, v + 2, v + 3], i * 6);
    }
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.positions, 3);
    this.colAttr = new THREE.BufferAttribute(this.colors, 4);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.colAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('color', this.colAttr);
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -8,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.next = 0;
    this.trails = new Map();
    this.dirty = false;
  }

  /** Extend the trail `key` to (x, y, z). dir = unit travel direction. */
  add(key, x, y, z, dirX, dirZ, width, intensity) {
    const hx = -dirZ * width * 0.5;
    const hz = dirX * width * 0.5;
    const cur = { lx: x - hx, lz: z - hz, rx: x + hx, rz: z + hz, y, x, z, a: intensity };
    const last = this.trails.get(key);
    if (last) {
      const d = Math.hypot(x - last.x, z - last.z);
      if (d < 0.35) return; // wait until we moved a bit
      if (d < 5) {
        const i = this.next;
        this.next = (this.next + 1) % this.max;
        const p = this.positions;
        const o = i * 12;
        p[o] = last.lx;
        p[o + 1] = last.y;
        p[o + 2] = last.lz;
        p[o + 3] = last.rx;
        p[o + 4] = last.y;
        p[o + 5] = last.rz;
        p[o + 6] = cur.lx;
        p[o + 7] = cur.y;
        p[o + 8] = cur.lz;
        p[o + 9] = cur.rx;
        p[o + 10] = cur.y;
        p[o + 11] = cur.rz;
        const c = this.colors;
        const co = i * 16;
        for (let k = 0; k < 4; k++) {
          c[co + k * 4] = 0.05;
          c[co + k * 4 + 1] = 0.05;
          c[co + k * 4 + 2] = 0.05;
          c[co + k * 4 + 3] = (k < 2 ? last.a : cur.a) * 0.55;
        }
        this.dirty = true;
      }
    }
    this.trails.set(key, cur);
  }

  end(key) {
    this.trails.delete(key);
  }

  update() {
    if (!this.dirty) return;
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.dirty = false;
  }

  clear() {
    this.positions.fill(0);
    this.colors.fill(0);
    this.trails.clear();
    this.dirty = true;
  }
}

/** All car-related effects. */
export class Effects {
  constructor(scene) {
    this.smoke = new ParticleSystem(700);
    this.sparks = new ParticleSystem(300, { additive: true });
    this.skids = new SkidMarks();
    scene.add(this.skids.mesh, this.smoke.points, this.sparks.points);
    this._acc = new Map();
  }

  setViewport(heightPx, fovDeg) {
    const s = heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
    this.smoke.material.uniforms.uScale.value = s;
    this.sparks.material.uniforms.uScale.value = s;
  }

  clear() {
    this.smoke.clear();
    this.sparks.clear();
    this.skids.clear();
  }

  /** Emit smoke / dust / skid marks / sparks for one car. */
  car(car, key, dt) {
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    const rx = -fz;
    const rz = fx;
    const speed = Math.hypot(car.vx, car.vz);
    const dirX = speed > 0.1 ? car.vx / speed : fx;
    const dirZ = speed > 0.1 ? car.vz / speed : fz;
    const offroad = car.surface > 0.5;

    let acc = this._acc.get(key) || 0;
    for (const side of [-1, 1]) {
      const wx = car.x - fx * 1.38 + rx * side * 0.84;
      const wz = car.z - fz * 1.38 + rz * side * 0.84;
      const wkey = `${key}${side}`;
      if (car.slip > 0.2 && !offroad && speed > 3) {
        this.skids.add(wkey, wx, car.y + 0.085, wz, dirX, dirZ, 0.3, Math.min(1, car.slip * 1.4));
      } else {
        this.skids.end(wkey);
      }
    }

    // Smoke when sliding on tarmac, dust when off-road.
    let rate = 0;
    let color = null;
    if (!offroad && car.slip > 0.2 && speed > 3) {
      rate = 30 * car.slip;
      color = { r: 0.82, g: 0.82, b: 0.84 };
    } else if (offroad && speed > 6) {
      rate = Math.min(26, speed * 0.8);
      color = { r: 0.55, g: 0.47, b: 0.33 };
    }
    if (rate > 0) {
      acc += rate * dt;
      while (acc >= 1) {
        acc -= 1;
        const side = Math.random() < 0.5 ? -1 : 1;
        const wx = car.x - fx * 1.5 + rx * side * 0.84;
        const wz = car.z - fz * 1.5 + rz * side * 0.84;
        this.smoke.emit(
          wx + (Math.random() - 0.5) * 0.4,
          car.y + 0.35,
          wz + (Math.random() - 0.5) * 0.4,
          car.vx * 0.25 + (Math.random() - 0.5) * 1.5,
          0.6 + Math.random() * 0.9,
          car.vz * 0.25 + (Math.random() - 0.5) * 1.5,
          {
            ...color,
            size: offroad ? 1.0 : 1.3,
            grow: offroad ? 2.4 : 3.2,
            life: offroad ? 1.0 : 1.7,
            alpha: offroad ? 0.4 : 0.32,
            drag: 1.6,
          },
        );
      }
    } else {
      acc = 0;
    }
    this._acc.set(key, acc);

    // Sparks when scraping a barrier.
    if (car.scrape > 4) {
      const n = Math.min(6, Math.floor(car.scrape / 6) + 1);
      const side = car.info.lateral > 0 ? 1 : -1;
      for (let i = 0; i < n; i++) {
        const along = (Math.random() - 0.5) * 3;
        this.sparks.emit(
          car.x + fx * along + rx * side * 0.95,
          car.y + 0.4 + Math.random() * 0.3,
          car.z + fz * along + rz * side * 0.95,
          car.vx * 0.5 + (Math.random() - 0.5) * 6,
          2 + Math.random() * 4,
          car.vz * 0.5 + (Math.random() - 0.5) * 6,
          { r: 1, g: 0.62, b: 0.22, size: 0.22, life: 0.35 + Math.random() * 0.25, alpha: 1, gravity: 14, drag: 1 },
        );
      }
    }
  }

  /** Burst of sparks at a collision point. */
  burst(x, y, z, strength) {
    const n = Math.min(40, Math.floor(strength * 2));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 3 + Math.random() * 7;
      this.sparks.emit(x, y, z, Math.cos(a) * sp, 2 + Math.random() * 5, Math.sin(a) * sp, {
        r: 1,
        g: 0.7,
        b: 0.3,
        size: 0.25,
        life: 0.3 + Math.random() * 0.4,
        alpha: 1,
        gravity: 14,
        drag: 1.2,
      });
    }
  }

  update(dt) {
    this.smoke.update(dt);
    this.sparks.update(dt);
    this.skids.update();
  }
}
