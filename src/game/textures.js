import * as THREE from 'three';
import { createRng } from './noise.js';

// All textures are painted procedurally onto canvases at start-up, so the
// game ships without any image assets.

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function finish(canvas, renderer, { repeatU = false, repeatV = true, srgb = true } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = repeatU ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repeatV ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** Asphalt with painted edge lines. u = across the road, v = along it. */
export function createAsphaltTexture(renderer) {
  const W = 512;
  const H = 1024;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  const d = img.data;
  const rng = createRng(11);

  // Column streaks (tyre wear) - constant along v so they tile.
  const streak = new Float32Array(W);
  let acc = 0;
  for (let x = 0; x < W; x++) {
    acc = acc * 0.92 + (rng() - 0.5) * 3.2;
    streak[x] = acc;
  }
  // Darker rubbered-in bands where cars usually drive.
  const band = (u) => {
    const a = Math.exp(-Math.pow((u - 0.33) / 0.09, 2));
    const b = Math.exp(-Math.pow((u - 0.67) / 0.09, 2));
    return (a + b) * -7;
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      let v = 62 + streak[x] + band(x / W) + (rng() - 0.5) * 22;
      if (rng() < 0.012) v += 30 * rng(); // aggregate stones
      const b = Math.max(0, Math.min(255, v));
      d[i] = b;
      d[i + 1] = b;
      d[i + 2] = b + 3;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);

  // A few soft patches (repairs / oil) - drawn wrapped so the texture tiles.
  for (let k = 0; k < 14; k++) {
    const x = rng() * W;
    const y = rng() * H;
    const r = 20 + rng() * 60;
    const dark = rng() < 0.6;
    for (const oy of [-H, 0, H]) {
      const grad = g.createRadialGradient(x, y + oy, 0, x, y + oy, r);
      grad.addColorStop(0, dark ? 'rgba(0,0,0,0.13)' : 'rgba(255,255,255,0.05)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(x - r, y + oy - r, r * 2, r * 2);
    }
  }

  // Edge lines.
  g.fillStyle = 'rgba(236,236,236,0.95)';
  const lw = Math.round(W * 0.022);
  const inset = Math.round(W * 0.018);
  g.fillRect(inset, 0, lw, H);
  g.fillRect(W - inset - lw, 0, lw, H);
  return finish(c, renderer);
}

/** Red / white rumble strip. */
export function createCurbTexture(renderer) {
  const c = makeCanvas(64, 128);
  const g = c.getContext('2d');
  g.fillStyle = '#d42a2a';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#f2f2f2';
  g.fillRect(0, 64, 64, 64);
  // subtle shading toward the outer edge
  const grad = g.createLinearGradient(0, 0, 64, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.18)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 128);
  return finish(c, renderer, { repeatU: false, repeatV: true });
}

/** Barrier blocks: alternating red / white panels with a dark base. */
export function createWallTexture(renderer) {
  const c = makeCanvas(128, 256);
  const g = c.getContext('2d');
  // u = across profile (0 bottom of inner face ... 1 outer face), v = along track
  g.fillStyle = '#e8e8e8';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#c91f1f';
  g.fillRect(0, 128, 128, 128);
  // block seams
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(0, 0, 128, 3);
  g.fillRect(0, 128, 128, 3);
  // dark kick plate at the bottom of the inner face
  // (inner face spans u 0..0.4 = y -0.6..1.0, so 26px ~ 0.2 m above the road)
  g.fillStyle = '#2a2a2a';
  g.fillRect(0, 0, 26, 256);
  // top cap (u 0.4..0.6) a bit darker
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(51, 0, 26, 256);
  return finish(c, renderer, { repeatU: false, repeatV: true });
}

/** Checkered start / finish line. */
export function createCheckerTexture(renderer, cols = 16, rows = 3) {
  const s = 32;
  const c = makeCanvas(cols * s, rows * s);
  const g = c.getContext('2d');
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      g.fillStyle = (x + y) % 2 === 0 ? '#f4f4f4' : '#141414';
      g.fillRect(x * s, y * s, s, s);
    }
  }
  return finish(c, renderer, { repeatU: false, repeatV: false });
}

/** Gantry banner with the game title. */
export function createBannerTexture(renderer, text, sub = '') {
  const W = 1024;
  const H = 160;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#1c2433');
  grad.addColorStop(1, '#0b0f17');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  // checkered ends
  const s = 20;
  for (let y = 0; y < H / s; y++) {
    for (let x = 0; x < 4; x++) {
      g.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : '#111111';
      g.fillRect(x * s, y * s, s, s);
      g.fillRect(W - (x + 1) * s, y * s, s, s);
    }
  }
  g.fillStyle = '#ff3b30';
  g.fillRect(90, 12, W - 180, 6);
  g.fillRect(90, H - 18, W - 180, 6);
  g.font = 'italic 900 86px "Russo One", "Arial Black", Impact, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#ffffff';
  g.shadowColor = 'rgba(255,59,48,0.8)';
  g.shadowBlur = 18;
  g.fillText(text, W / 2, sub ? H / 2 - 10 : H / 2 + 4);
  if (sub) {
    g.shadowBlur = 0;
    g.font = 'bold 26px "Russo One", Arial, sans-serif';
    g.fillStyle = '#ffd60a';
    g.fillText(sub, W / 2, H / 2 + 44);
  }
  return finish(c, renderer, { repeatU: false, repeatV: false });
}

/** Advertising board artwork. */
export function createAdTexture(renderer, label, bg, fg, accent) {
  const W = 512;
  const H = 128;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.fillStyle = accent;
  g.beginPath();
  g.moveTo(0, H);
  g.lineTo(90, 0);
  g.lineTo(130, 0);
  g.lineTo(40, H);
  g.fill();
  g.beginPath();
  g.moveTo(W, 0);
  g.lineTo(W - 90, H);
  g.lineTo(W - 130, H);
  g.lineTo(W - 40, 0);
  g.fill();
  g.font = 'italic 900 70px "Russo One", "Arial Black", Impact, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = fg;
  g.fillText(label, W / 2, H / 2 + 4);
  return finish(c, renderer, { repeatU: false, repeatV: false });
}

/** Near-white grass detail, multiplied with the terrain vertex colours. */
export function createGrassTexture(renderer) {
  const S = 256;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const d = img.data;
  const rng = createRng(5);
  for (let i = 0; i < S * S; i++) {
    const v = 205 + rng() * 50;
    d[i * 4] = v - 6;
    d[i * 4 + 1] = v;
    d[i * 4 + 2] = v - 10;
    d[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // Little blades / clumps, wrapped so the texture tiles.
  for (let k = 0; k < 900; k++) {
    const x = rng() * S;
    const y = rng() * S;
    const len = 2 + rng() * 5;
    const shade = rng() < 0.5 ? 'rgba(40,70,20,0.22)' : 'rgba(255,255,230,0.18)';
    g.strokeStyle = shade;
    g.lineWidth = 1;
    for (const ox of [-S, 0, S]) {
      for (const oy of [-S, 0, S]) {
        g.beginPath();
        g.moveTo(x + ox, y + oy);
        g.lineTo(x + ox + (rng() - 0.5) * 2, y + oy - len);
        g.stroke();
      }
    }
  }
  const tex = finish(c, renderer, { repeatU: true, repeatV: true });
  return tex;
}

/** Soft round sprite used for smoke and sparks. */
export function createSoftDotTexture() {
  const S = 64;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
