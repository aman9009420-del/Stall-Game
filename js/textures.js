export function canvasTex(THREE, w, h, draw, repeatX = 1, repeatY = 1) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

function noise(ctx, w, h, a = 18) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * a;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

export function makeTextures(THREE) {
  const wood = canvasTex(THREE, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#6b3f22';
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 7) {
      ctx.strokeStyle = `rgba(40,18,8,${0.18 + Math.random() * 0.25})`;
      ctx.lineWidth = 2 + Math.random() * 3;
      ctx.beginPath();
      ctx.moveTo(x + Math.random() * 4, 0);
      ctx.bezierCurveTo(x + 6, h * 0.3, x - 4, h * 0.6, x + 3, h);
      ctx.stroke();
    }
    noise(ctx, w, h, 14);
  }, 2, 2);

  const woodDark = canvasTex(THREE, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#3a2214';
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 9) {
      ctx.strokeStyle = `rgba(20,10,4,${0.25 + Math.random() * 0.3})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + Math.sin(x) * 4, h);
      ctx.stroke();
    }
    noise(ctx, w, h, 12);
  }, 1, 1);

  const teak = canvasTex(THREE, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#8a4f28';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 5) {
      ctx.fillStyle = `rgba(60,25,10,${0.08 + Math.random() * 0.12})`;
      ctx.fillRect(0, y, w, 3);
    }
    noise(ctx, w, h, 10);
  }, 1, 1);

  const stripe = canvasTex(THREE, 256, 256, (ctx, w, h) => {
    const cols = ['#c81e1e', '#f5e6c4', '#c81e1e', '#e0b025', '#c81e1e', '#f5e6c4'];
    const bw = w / cols.length;
    cols.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.fillRect(i * bw, 0, bw + 1, h);
    });
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    for (let y = 0; y < h; y += 16) ctx.fillRect(0, y, w, 2);
  }, 2, 1);

  const stripeBlue = canvasTex(THREE, 256, 256, (ctx, w, h) => {
    const cols = ['#1e3a5f', '#f5e6c4', '#b45309', '#1e3a5f', '#f5e6c4'];
    const bw = w / cols.length;
    cols.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.fillRect(i * bw, 0, bw + 1, h);
    });
  }, 2, 1);

  const metal = canvasTex(THREE, 128, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#d7dde4');
    g.addColorStop(0.5, '#8e9aa8');
    g.addColorStop(1, '#c5ccd4');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) {
      ctx.fillStyle = `rgba(255,255,255,${0.04 + (y % 6) * 0.01})`;
      ctx.fillRect(0, y, w, 1);
    }
  });

  const rust = canvasTex(THREE, 128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#5a4638';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(${90 + Math.random() * 80},${40 + Math.random() * 30},20,0.35)`;
      ctx.beginPath();
      ctx.arc(Math.random() * w, Math.random() * h, 4 + Math.random() * 12, 0, 7);
      ctx.fill();
    }
  });

  const cobble = canvasTex(THREE, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#2a261f';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const ox = (y % 2) * 16;
        const px = x * 32 + ox;
        const py = y * 32;
        ctx.fillStyle = `rgb(${70 + Math.random() * 35},${62 + Math.random() * 25},${50 + Math.random() * 18})`;
        roundRect(ctx, px + 2, py + 2, 28, 28, 5);
        ctx.fill();
      }
    }
  }, 8, 8);

  const asphalt = canvasTex(THREE, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#2c2c30';
    ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, 22);
    ctx.strokeStyle = 'rgba(220,200,80,0.55)';
    ctx.setLineDash([18, 14]);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, 0);
    ctx.lineTo(w * 0.5, h);
    ctx.stroke();
    ctx.setLineDash([]);
  }, 1, 6);

  const brick = canvasTex(THREE, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#3b2a24';
    ctx.fillRect(0, 0, w, h);
    const bw = 32, bh = 16;
    for (let y = 0; y < h / bh; y++) {
      for (let x = 0; x < w / bw + 1; x++) {
        const ox = (y % 2) * (bw / 2);
        ctx.fillStyle = `rgb(${90 + Math.random() * 40},${42 + Math.random() * 20},${32 + Math.random() * 14})`;
        ctx.fillRect(x * bw + ox + 1, y * bh + 1, bw - 2, bh - 2);
      }
    }
  }, 2, 3);

  const crate = canvasTex(THREE, 128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#9a6a32';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#5a3818';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.beginPath();
    ctx.moveTo(10, 10);
    ctx.lineTo(w - 10, h - 10);
    ctx.moveTo(w - 10, 10);
    ctx.lineTo(10, h - 10);
    ctx.stroke();
  });

  const chalk = canvasTex(THREE, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#24312a';
    ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, 16);
    ctx.fillStyle = '#e7e0c8';
    ctx.font = 'bold 22px serif';
    ctx.fillText('MENU', 88, 36);
    ctx.font = '16px serif';
    const lines = ['Chai  18', 'Samosa  22', 'Vada Pav  32', 'Pani Puri  28', 'Pav Bhaji  48', 'Lassi  30'];
    lines.forEach((ln, i) => ctx.fillText(ln, 28, 70 + i * 28));
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.strokeRect(12, 12, w - 24, h - 24);
  });

  const sign = canvasTex(THREE, 512, 192, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#8b1e2d');
    g.addColorStop(1, '#4a0d16');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#e0b025';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.strokeStyle = '#f6e6c8';
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 18, w - 36, h - 36);
    ctx.fillStyle = '#f6e27a';
    ctx.font = 'bold 72px serif';
    ctx.textAlign = 'center';
    ctx.fillText('STALLWALA', w / 2, 100);
    ctx.fillStyle = '#f5e6c4';
    ctx.font = '28px serif';
    ctx.fillText('STREET  ·  FIRE  ·  SPICE', w / 2, 148);
  });

  const neon = canvasTex(THREE, 512, 160, (ctx, w, h) => {
    ctx.fillStyle = '#07060c';
    ctx.fillRect(0, 0, w, h);
    ctx.shadowColor = '#ff4d6d';
    ctx.shadowBlur = 22;
    ctx.fillStyle = '#ff8fa3';
    ctx.font = 'bold 78px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STALLWALA', w / 2, 100);
    ctx.shadowBlur = 0;
  });

  const fabric = canvasTex(THREE, 128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#6b1d2a';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(255,220,140,0.15)' : 'rgba(0,0,0,0.08)';
      ctx.fillRect(0, i * 10, w, 5);
    }
  });

  const rangoli = canvasTex(THREE, 256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.translate(w / 2, h / 2);
    const cols = ['#dc2626', '#f59e0b', '#22c55e', '#3b82f6', '#f5e6c4', '#a21caf'];
    for (let r = 5; r >= 1; r--) {
      ctx.strokeStyle = cols[r % cols.length];
      ctx.lineWidth = 6;
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const rad = r * 18 + ((i % 2) * 10);
        const x = Math.cos(a) * rad;
        const y = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, 7);
    ctx.fill();
  });

  const windowNight = canvasTex(THREE, 64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#1a1520';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = Math.random() > 0.3 ? '#f4d19a' : '#2a2030';
    ctx.fillRect(8, 8, w - 16, h - 16);
    ctx.strokeStyle = '#3a2a22';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(w / 2, 8);
    ctx.lineTo(w / 2, h - 8);
    ctx.moveTo(8, h / 2);
    ctx.lineTo(w - 8, h / 2);
    ctx.stroke();
  }, 3, 4);

  const grass = canvasTex(THREE, 128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#1f3b1d';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 200; i++) {
      ctx.strokeStyle = `rgba(${20 + Math.random() * 40},${80 + Math.random() * 70},20,0.5)`;
      const x = Math.random() * w;
      const y = Math.random() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 1, y - 6);
      ctx.stroke();
    }
  }, 8, 8);

  return {
    wood, woodDark, teak, stripe, stripeBlue, metal, rust, cobble, asphalt,
    brick, crate, chalk, sign, neon, fabric, rangoli, windowNight, grass,
  };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function makeMaterials(THREE, tex) {
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...extra });
  return {
    wood: std(0xffffff, { map: tex.wood, roughness: 0.82 }),
    woodDark: std(0xffffff, { map: tex.woodDark, roughness: 0.86 }),
    teak: std(0xffffff, { map: tex.teak, roughness: 0.78 }),
    stripe: std(0xffffff, { map: tex.stripe, roughness: 0.9, side: THREE.DoubleSide }),
    stripeBlue: std(0xffffff, { map: tex.stripeBlue, roughness: 0.9, side: THREE.DoubleSide }),
    metal: std(0xffffff, { map: tex.metal, metalness: 0.85, roughness: 0.32 }),
    rust: std(0xffffff, { map: tex.rust, metalness: 0.4, roughness: 0.7 }),
    cobble: std(0xffffff, { map: tex.cobble, roughness: 0.95 }),
    asphalt: std(0xffffff, { map: tex.asphalt, roughness: 0.92 }),
    brick: std(0xffffff, { map: tex.brick, roughness: 0.9 }),
    crate: std(0xffffff, { map: tex.crate, roughness: 0.8 }),
    chalk: std(0xffffff, { map: tex.chalk, roughness: 1 }),
    sign: std(0xffffff, { map: tex.sign, roughness: 0.55, metalness: 0.1 }),
    neon: new THREE.MeshStandardMaterial({
      map: tex.neon, emissive: 0xff3355, emissiveIntensity: 0.85, roughness: 0.4,
    }),
    fabric: std(0xffffff, { map: tex.fabric, roughness: 0.95 }),
    grass: std(0xffffff, { map: tex.grass, roughness: 1 }),
    black: std(0x111111, { roughness: 0.6, metalness: 0.3 }),
    steel: std(0xb9c2cc, { metalness: 0.8, roughness: 0.28 }),
    brass: std(0xc9a227, { metalness: 0.7, roughness: 0.35 }),
    copper: std(0xb87333, { metalness: 0.65, roughness: 0.4 }),
    clay: std(0xa16207, { roughness: 0.9 }),
    cream: std(0xf6e6c8, { roughness: 0.7 }),
    red: std(0x9f1239, { roughness: 0.55 }),
    green: std(0x3f6212, { roughness: 0.7 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x99ddff, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.2, side: THREE.DoubleSide,
    }),
    liquidBrown: std(0x4a2a14, { roughness: 0.35, metalness: 0.05 }),
    emissiveAmber: new THREE.MeshStandardMaterial({
      color: 0xffcc66, emissive: 0xffaa33, emissiveIntensity: 1.2, roughness: 0.4,
    }),
    emissiveFlame: new THREE.MeshStandardMaterial({
      color: 0xff6622, emissive: 0xff4400, emissiveIntensity: 2, roughness: 0.5, transparent: true, opacity: 0.85,
    }),
    white: std(0xf8fafc),
    plasticRed: std(0xdc2626, { roughness: 0.45 }),
    plasticBlue: std(0x1d4ed8, { roughness: 0.45 }),
    gold: std(0xeab308, { metalness: 0.7, roughness: 0.3 }),
    marble: std(0xe7e5e4, { roughness: 0.35, metalness: 0.05 }),
  };
}

export function labelSprite(THREE, text, color = '#f6e6c8', bg = 'rgba(20,10,12,0.78)') {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.roundRect ? ctx.roundRect(8, 8, 240, 48, 10) : ctx.fillRect(8, 8, 240, 48);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(0.9, 0.22, 1);
  return spr;
}
