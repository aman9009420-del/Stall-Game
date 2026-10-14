import * as THREE from 'three';
import { baseHeight } from './terrain.js';

// Pure track maths (no rendering). Usable both in the browser and in Node.
//
// Conventions
//  * Y is up, the circuit lies on the XZ plane.
//  * A heading angle `h` corresponds to the forward vector (sin h, cos h).
//  * "Right" of a forward vector (fx, fz) is (-fz, fx); a positive lateral
//    offset means "to the right of the centre-line" when driving forward.
//  * Positive curvature = the track turns left.

export const DEFAULT_TRACK_CONFIG = {
  halfWidth: 7.5, // half of the asphalt width (m)
  curbWidth: 1.3, // rumble strips just outside the asphalt (m)
  wallOffset: 15, // centre-line -> inner face of the barriers (m)
  spacing: 2, // centre-line sample spacing (m)
};

// Control points of the circuit (x, z) in metres. The start/finish line sits
// at the first point, in the middle of the main straight.
export const CONTROL_POINTS = [
  [0, 218],
  [150, 212],
  [245, 190],
  [285, 120],
  [265, 50],
  [300, -20],
  [325, -120],
  [290, -195],
  [225, -175],
  [205, -95],
  [140, -55],
  [60, -105],
  [-30, -165],
  [-130, -195],
  [-260, -195],
  [-325, -125],
  [-310, -10],
  [-250, 42],
  [-212, 100],
  [-232, 158],
  [-196, 204],
  [-120, 217],
];

const TAU = Math.PI * 2;

export function wrapAngle(a) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

export class TrackData {
  constructor(config = {}, controlPoints = CONTROL_POINTS) {
    this.config = { ...DEFAULT_TRACK_CONFIG, ...config };
    const { spacing } = this.config;

    const curve = new THREE.CatmullRomCurve3(
      controlPoints.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      true,
      'centripetal',
    );
    curve.arcLengthDivisions = 10000;
    this.curve = curve;

    const n = Math.max(32, Math.round(curve.getLength() / spacing));
    const spaced = curve.getSpacedPoints(n); // n + 1 points, last == first
    this.count = n;

    const px = (this.px = new Float32Array(n));
    const pz = (this.pz = new Float32Array(n));
    for (let i = 0; i < n; i++) {
      px[i] = spaced[i].x;
      pz[i] = spaced[i].z;
    }

    // Segment lengths & cumulative distance.
    this.segLen = new Float32Array(n);
    this.s = new Float32Array(n);
    let total = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const len = Math.hypot(px[j] - px[i], pz[j] - pz[i]);
      this.segLen[i] = len;
      this.s[i] = total;
      total += len;
    }
    this.length = total;
    this.ds = total / n;

    // Tangents / right vectors / headings.
    this.tx = new Float32Array(n);
    this.tz = new Float32Array(n);
    this.rx = new Float32Array(n);
    this.rz = new Float32Array(n);
    this.heading = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = (i - 1 + n) % n;
      const b = (i + 1) % n;
      let dx = px[b] - px[a];
      let dz = pz[b] - pz[a];
      const l = Math.hypot(dx, dz) || 1;
      dx /= l;
      dz /= l;
      this.tx[i] = dx;
      this.tz[i] = dz;
      this.rx[i] = -dz;
      this.rz[i] = dx;
      this.heading[i] = Math.atan2(dx, dz);
    }

    // Signed curvature of the centre-line (smoothed a little).
    this.curvature = this._curvatureOf(px, pz, 3);

    // Road height: base terrain along the centre-line, heavily smoothed.
    let h = new Float32Array(n);
    for (let i = 0; i < n; i++) h[i] = baseHeight(px[i], pz[i]);
    h = smoothCircular(h, 12, 3);
    this.heights = h;
    this.slopes = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a = (i - 1 + n) % n;
      this.slopes[i] = (h[j] - h[a]) / (this.segLen[i] + this.segLen[a]);
    }

    // Curbs where the track bends noticeably.
    const curbRaw = new Uint8Array(n);
    for (let i = 0; i < n; i++) curbRaw[i] = Math.abs(this.curvature[i]) > 1 / 95 ? 1 : 0;
    this.curb = new Uint8Array(n);
    const dil = 7;
    for (let i = 0; i < n; i++) {
      if (!curbRaw[i]) continue;
      for (let k = -dil; k <= dil; k++) this.curb[(i + k + n) % n] = 1;
    }

    // Bounding box.
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < n; i++) {
      minX = Math.min(minX, px[i]);
      maxX = Math.max(maxX, px[i]);
      minZ = Math.min(minZ, pz[i]);
      maxZ = Math.max(maxZ, pz[i]);
    }
    this.bounds = { minX, maxX, minZ, maxZ };
    this.center = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };

    this._buildSpatialHash();
    this._coarseStep = 6;

    this.racingLine = this._computeRacingLine(2.0);
    this._profiles = new Map();
  }

  // ---------------------------------------------------------------------------
  // Geometry helpers

  _curvatureOf(xs, zs, stencil) {
    const n = this.count;
    const k = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = (i - stencil + n) % n;
      const b = (i + stencil) % n;
      const c = i;
      const h1 = Math.atan2(xs[c] - xs[a], zs[c] - zs[a]);
      const h2 = Math.atan2(xs[b] - xs[c], zs[b] - zs[c]);
      const d1 = Math.hypot(xs[c] - xs[a], zs[c] - zs[a]);
      const d2 = Math.hypot(xs[b] - xs[c], zs[b] - zs[c]);
      k[i] = wrapAngle(h2 - h1) / (0.5 * (d1 + d2) || 1);
    }
    return smoothCircular(k, 3, 2);
  }

  _buildSpatialHash() {
    const cell = (this._cell = 32);
    this._hash = new Map();
    for (let i = 0; i < this.count; i++) {
      const key = this._key(Math.floor(this.px[i] / cell), Math.floor(this.pz[i] / cell));
      let arr = this._hash.get(key);
      if (!arr) this._hash.set(key, (arr = []));
      arr.push(i);
    }
  }

  _key(cx, cz) {
    return (cx + 4096) * 8192 + (cz + 4096);
  }

  /** Nearest centre-line sample within maxDist. index = -1 if none. */
  nearestSample(x, z, maxDist = 60) {
    const cell = this._cell;
    const r = Math.ceil(maxDist / cell);
    const cx = Math.floor(x / cell);
    const cz = Math.floor(z / cell);
    let best = -1;
    let bestD = maxDist * maxDist;
    for (let ix = cx - r; ix <= cx + r; ix++) {
      for (let iz = cz - r; iz <= cz + r; iz++) {
        const arr = this._hash.get(this._key(ix, iz));
        if (!arr) continue;
        for (let k = 0; k < arr.length; k++) {
          const i = arr[k];
          const dx = this.px[i] - x;
          const dz = this.pz[i] - z;
          const d = dx * dx + dz * dz;
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
      }
    }
    return { index: best, dist: best >= 0 ? Math.sqrt(bestD) : Infinity };
  }

  /** Approximate distance to the track (fine for far-away terrain shaping). */
  coarseDistance(x, z) {
    let best = Infinity;
    const step = this._coarseStep;
    for (let i = 0; i < this.count; i += step) {
      const dx = this.px[i] - x;
      const dz = this.pz[i] - z;
      const d = dx * dx + dz * dz;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }

  /**
   * Project a world position onto the centre-line.
   * `hint` = previous sample index to search around (or -1 for global search).
   * Writes into and returns `out`.
   */
  project(x, z, hint = -1, out = {}) {
    const n = this.count;
    const px = this.px;
    const pz = this.pz;
    let best = 0;
    let bestD = Infinity;
    if (hint < 0) {
      for (let i = 0; i < n; i++) {
        const dx = px[i] - x;
        const dz = pz[i] - z;
        const d = dx * dx + dz * dz;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    } else {
      const W = 24;
      for (let k = -W; k <= W; k++) {
        const i = (((hint + k) % n) + n) % n;
        const dx = px[i] - x;
        const dz = pz[i] - z;
        const d = dx * dx + dz * dz;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    }

    // Refine on the two adjacent segments.
    const prev = (best - 1 + n) % n;
    const r1 = projectOnSegment(x, z, px[best], pz[best], px[(best + 1) % n], pz[(best + 1) % n]);
    const r0 = projectOnSegment(x, z, px[prev], pz[prev], px[best], pz[best]);
    let a;
    let u;
    if (r0.d2 < r1.d2) {
      a = prev;
      u = r0.u;
    } else {
      a = best;
      u = r1.u;
    }
    const b = (a + 1) % n;

    const qx = px[a] + (px[b] - px[a]) * u;
    const qz = pz[a] + (pz[b] - pz[a]) * u;
    let tx = this.tx[a] + (this.tx[b] - this.tx[a]) * u;
    let tz = this.tz[a] + (this.tz[b] - this.tz[a]) * u;
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl;
    tz /= tl;
    const rx = -tz;
    const rz = tx;

    let s = this.s[a] + this.segLen[a] * u;
    if (s >= this.length) s -= this.length;

    out.index = u < 0.5 ? a : b;
    out.seg = a;
    out.u = u;
    out.s = s;
    out.lateral = (x - qx) * rx + (z - qz) * rz;
    out.cx = qx;
    out.cz = qz;
    out.tx = tx;
    out.tz = tz;
    out.rx = rx;
    out.rz = rz;
    out.height = this.heights[a] + (this.heights[b] - this.heights[a]) * u;
    out.slope = (this.heights[b] - this.heights[a]) / (this.segLen[a] || 1);
    out.curvature = this.curvature[a] + (this.curvature[b] - this.curvature[a]) * u;
    return out;
  }

  /** Index of the sample at (or just before) distance s along the track. */
  indexAt(s) {
    s = ((s % this.length) + this.length) % this.length;
    let i = Math.floor(s / this.ds);
    i = Math.min(this.count - 1, Math.max(0, i));
    // Correct for slight non-uniform spacing.
    while (i > 0 && this.s[i] > s) i--;
    while (i < this.count - 1 && this.s[i + 1] <= s) i++;
    return i;
  }

  /** World transform of a point at distance s and lateral offset. */
  pointAt(s, lateral = 0, out = {}) {
    s = ((s % this.length) + this.length) % this.length;
    const a = this.indexAt(s);
    const b = (a + 1) % this.count;
    const u = Math.min(1, Math.max(0, (s - this.s[a]) / (this.segLen[a] || 1)));
    let tx = this.tx[a] + (this.tx[b] - this.tx[a]) * u;
    let tz = this.tz[a] + (this.tz[b] - this.tz[a]) * u;
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl;
    tz /= tl;
    const cx = this.px[a] + (this.px[b] - this.px[a]) * u;
    const cz = this.pz[a] + (this.pz[b] - this.pz[a]) * u;
    out.x = cx - tz * lateral;
    out.z = cz + tx * lateral;
    out.y = this.heights[a] + (this.heights[b] - this.heights[a]) * u;
    out.heading = Math.atan2(tx, tz);
    out.index = a;
    out.tx = tx;
    out.tz = tz;
    return out;
  }

  /** Distance / lateral offset of starting grid slot k (0 = pole position). */
  gridParams(k) {
    return { s: this.length - (13 + k * 8), lateral: (k % 2 === 0 ? -1 : 1) * 3.4 };
  }

  /** World transform of starting grid slot k. */
  gridSlot(k) {
    const { s, lateral } = this.gridParams(k);
    return this.pointAt(s, lateral);
  }

  // ---------------------------------------------------------------------------
  // Racing line & speed profiles (used by the AI)

  _computeRacingLine(margin) {
    const n = this.count;
    const px = this.px;
    const pz = this.pz;
    const rx = this.rx;
    const rz = this.rz;
    const maxOff = this.config.halfWidth - margin;
    let off = new Float32Array(n);
    let tmp = new Float32Array(n);
    const passes = [
      [28, 120],
      [16, 120],
      [8, 120],
      [4, 80],
    ];
    for (const [k, iters] of passes) {
      for (let it = 0; it < iters; it++) {
        for (let i = 0; i < n; i++) {
          const a = (i - k + n) % n;
          const b = (i + k) % n;
          const mx = 0.5 * (px[a] + rx[a] * off[a] + px[b] + rx[b] * off[b]);
          const mz = 0.5 * (pz[a] + rz[a] * off[a] + pz[b] + rz[b] * off[b]);
          const target = (mx - px[i]) * rx[i] + (mz - pz[i]) * rz[i];
          let v = off[i] + (target - off[i]) * 0.6;
          if (v > maxOff) v = maxOff;
          else if (v < -maxOff) v = -maxOff;
          tmp[i] = v;
        }
        const t = off;
        off = tmp;
        tmp = t;
      }
    }
    off = smoothCircular(off, 4, 2);

    const lx = new Float32Array(n);
    const lz = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      lx[i] = px[i] + rx[i] * off[i];
      lz[i] = pz[i] + rz[i] * off[i];
    }
    const curvature = this._curvatureOf(lx, lz, 4);
    return { offset: off, x: lx, z: lz, curvature };
  }

  /**
   * Target speed for each sample given car handling parameters.
   * aLat: lateral grip (m/s^2), rMin: min turning radius (m), vMax (m/s),
   * brake: deceleration the AI plans with (m/s^2).
   */
  speedProfile({ aLat, rMin, vMax, brake }) {
    const key = `${aLat}|${rMin}|${vMax}|${brake}`;
    const cached = this._profiles.get(key);
    if (cached) return cached;
    const n = this.count;
    const k = this.racingLine.curvature;
    const v = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const c = Math.abs(k[i]);
      let vi = vMax;
      if (c > 1e-6) vi = Math.min(vMax, Math.sqrt(aLat * Math.max(0.5, 1 / c - rMin)));
      v[i] = vi;
    }
    // Backward pass so the AI brakes before corners (twice round the loop).
    for (let pass = 0; pass < 2; pass++) {
      for (let i = n - 1; i >= 0; i--) {
        const j = (i + 1) % n;
        const lim = Math.sqrt(v[j] * v[j] + 2 * brake * this.segLen[i]);
        if (v[i] > lim) v[i] = lim;
      }
    }
    this._profiles.set(key, v);
    return v;
  }
}

function projectOnSegment(x, z, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz || 1;
  let u = ((x - ax) * dx + (z - az) * dz) / l2;
  if (u < 0) u = 0;
  else if (u > 1) u = 1;
  const qx = ax + dx * u - x;
  const qz = az + dz * u - z;
  return { u, d2: qx * qx + qz * qz };
}

/** Circular moving-average smoothing. */
export function smoothCircular(arr, radius, passes = 1) {
  const n = arr.length;
  let src = Float32Array.from(arr);
  let dst = new Float32Array(n);
  const w = 2 * radius + 1;
  for (let p = 0; p < passes; p++) {
    let sum = 0;
    for (let k = -radius; k <= radius; k++) sum += src[(k + n) % n];
    for (let i = 0; i < n; i++) {
      dst[i] = sum / w;
      sum += src[(i + radius + 1) % n] - src[(i - radius + n) % n];
    }
    const t = src;
    src = dst;
    dst = t;
  }
  return src;
}
