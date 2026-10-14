import { Simplex2 } from './noise.js';

// Terrain height model.
//
// The race corridor (asphalt + run-off up to the barriers) is always flat
// across its width and follows a smoothed "road height" along the track.
// Away from the circuit the natural terrain takes over: gentle meadows close
// to the track, and a ring of big snowy mountains far away.

const simplex = new Simplex2(1337);
const simplex2 = new Simplex2(4242);

/** Low frequency rolling hills - the road itself follows this (smoothed). */
export function baseHeight(x, z) {
  return (
    5.5 * Math.sin(x * 0.0085 + 0.6) * Math.cos(z * 0.0105 - 0.4) +
    3.2 * Math.sin((x - z) * 0.006 + 1.3) +
    1.5 * simplex.noise(x * 0.004, z * 0.004)
  );
}

function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Natural terrain (ignores the road flattening). `dist` = distance to track. */
export function naturalHeight(x, z, dist) {
  let h = baseHeight(x, z);
  // Small meadow bumps start a bit away from the track.
  const near = smoothstep(25, 90, dist);
  if (near > 0) {
    h += near * (4 * simplex2.fbm(x * 0.012, z * 0.012, 3) + 2.5);
  }
  // Mountains ring the whole valley.
  const far = smoothstep(170, 520, dist);
  if (far > 0) {
    const ridge = simplex.ridged(x * 0.0021 + 3.1, z * 0.0021 - 1.7, 5);
    const lump = 0.5 + 0.5 * simplex2.fbm(x * 0.0013, z * 0.0013, 3);
    h += far * (ridge * 210 * (0.45 + 0.75 * lump) + far * 25);
  }
  return h;
}

export { smoothstep };

/**
 * Builds a full height sampler for the world given a TrackData instance.
 * Returns { height(x, z), info(x, z) } where info also reports distance to
 * the track (used for colouring and scenery placement).
 */
export function createTerrainSampler(track) {
  const flatRadius = track.config.wallOffset + 7;
  const blendWidth = 26;
  const out = { dist: 0, index: 0, height: 0 };

  function info(x, z) {
    const near = track.nearestSample(x, z, flatRadius + blendWidth + 4);
    let dist;
    if (near.index >= 0) {
      dist = near.dist;
    } else {
      dist = Math.max(flatRadius + blendWidth + 4, track.coarseDistance(x, z));
    }
    const natural = naturalHeight(x, z, dist);
    let h = natural;
    if (near.index >= 0) {
      const road = track.heights[near.index] - 0.04;
      const w = smoothstep(flatRadius, flatRadius + blendWidth, dist);
      h = road + (natural - road) * w;
    }
    out.dist = dist;
    out.index = near.index;
    out.height = h;
    return out;
  }

  return {
    flatRadius,
    info,
    height(x, z) {
      return info(x, z).height;
    },
  };
}
