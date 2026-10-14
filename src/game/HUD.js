// Heads-up display: DOM text + two small canvases (speedometer, minimap).

export function formatTime(t) {
  if (!Number.isFinite(t) || t <= 0) return '-:--.--';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
}

export function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][n % 10] || 'th';
}

export function hexColor(c) {
  return `#${c.toString(16).padStart(6, '0')}`;
}

function setupCanvas(canvas, cssW, cssH) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return g;
}

class Speedo {
  constructor(canvas) {
    this.canvas = canvas;
    this.size = 0;
    this.resize();
  }

  resize() {
    const size = this.canvas.clientWidth || 210;
    if (size === this.size) return;
    this.size = size;
    this.g = setupCanvas(this.canvas, size, size);
  }

  draw(kmh, rpm, gear, boost, boosting) {
    const g = this.g;
    const S = this.size;
    const cx = S / 2;
    const cy = S / 2;
    const R = S * 0.44;
    const maxKmh = 320;
    const a0 = Math.PI * 0.75;
    const sweep = Math.PI * 1.5;
    g.clearRect(0, 0, S, S);

    // backdrop
    g.beginPath();
    g.arc(cx, cy, R + S * 0.045, 0, Math.PI * 2);
    g.fillStyle = 'rgba(8, 12, 20, 0.66)';
    g.fill();

    // speed track + arc (outer)
    const frac = Math.min(1, kmh / maxKmh);
    g.lineCap = 'butt';
    g.lineWidth = S * 0.035;
    g.beginPath();
    g.arc(cx, cy, R, a0, a0 + sweep);
    g.strokeStyle = 'rgba(255,255,255,0.09)';
    g.stroke();
    if (frac > 0.002) {
      const grad = g.createLinearGradient(cx - R, cy + R, cx + R, cy - R);
      grad.addColorStop(0, boosting ? '#5ac8fa' : '#ffd60a');
      grad.addColorStop(1, boosting ? '#bf5af2' : '#ff3b30');
      g.beginPath();
      g.arc(cx, cy, R, a0, a0 + sweep * frac);
      g.strokeStyle = grad;
      g.stroke();
    }

    // ticks + labels
    g.font = `600 ${Math.round(S * 0.056)}px "Rajdhani", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let v = 0; v <= maxKmh; v += 20) {
      const a = a0 + (v / maxKmh) * sweep;
      const major = v % 40 === 0;
      const r1 = R * (major ? 0.8 : 0.85);
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      g.lineTo(cx + Math.cos(a) * R * 0.91, cy + Math.sin(a) * R * 0.91);
      g.lineWidth = major ? 2 : 1;
      g.strokeStyle = v >= 280 ? 'rgba(255,90,80,0.95)' : 'rgba(255,255,255,0.7)';
      g.stroke();
      if (major) {
        g.fillStyle = 'rgba(255,255,255,0.72)';
        g.fillText(String(v), cx + Math.cos(a) * R * 0.68, cy + Math.sin(a) * R * 0.68);
      }
    }

    // rpm ring (inner, thin)
    const rpmFrac = Math.min(1, rpm / 8000);
    const rr = R * 0.52;
    g.lineWidth = S * 0.018;
    g.beginPath();
    g.arc(cx, cy, rr, a0, a0 + sweep);
    g.strokeStyle = 'rgba(255,255,255,0.08)';
    g.stroke();
    g.beginPath();
    g.arc(cx, cy, rr, a0 + sweep * (7000 / 8000), a0 + sweep);
    g.strokeStyle = 'rgba(255,59,48,0.35)';
    g.stroke();
    g.beginPath();
    g.arc(cx, cy, rr, a0, a0 + sweep * rpmFrac);
    g.strokeStyle = rpm > 7000 ? '#ff453a' : 'rgba(235,240,255,0.85)';
    g.stroke();

    // needle (outer pointer only, keeps the readout clear)
    const an = a0 + sweep * frac;
    g.beginPath();
    g.moveTo(cx + Math.cos(an) * R * 0.6, cy + Math.sin(an) * R * 0.6);
    g.lineTo(cx + Math.cos(an) * R * 1.03, cy + Math.sin(an) * R * 1.03);
    g.lineWidth = 3.5;
    g.lineCap = 'round';
    g.strokeStyle = '#ffffff';
    g.stroke();

    // digital readout
    g.fillStyle = '#ffffff';
    g.font = `${Math.round(S * 0.17)}px "Russo One", sans-serif`;
    g.fillText(String(Math.round(kmh)), cx, cy - S * 0.01);
    g.font = `700 ${Math.round(S * 0.05)}px "Rajdhani", sans-serif`;
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.fillText('KM/H', cx, cy + S * 0.095);
    // gear
    g.font = `${Math.round(S * 0.085)}px "Russo One", sans-serif`;
    g.fillStyle = '#ffd60a';
    g.fillText(gear === 0 ? 'R' : String(gear), cx, cy + S * 0.3);

    // nitro bar
    const bw = S * 0.46;
    const bh = S * 0.035;
    const bx = cx - bw / 2;
    const by = cy + S * 0.39;
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(bx, by, bw, bh);
    g.fillStyle = boosting ? '#bf5af2' : boost > 0.99 ? '#5ac8fa' : '#3a8dde';
    g.fillRect(bx, by, bw * boost, bh);
    g.font = `700 ${Math.round(S * 0.042)}px "Rajdhani", sans-serif`;
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.textAlign = 'left';
    g.fillText('NITRO', bx, by - S * 0.028);
    g.textAlign = 'center';
  }
}

class Minimap {
  constructor(canvas, track) {
    this.canvas = canvas;
    this.track = track;
    this.size = 0;
    this.resize();
  }

  resize() {
    const size = this.canvas.clientWidth || 180;
    if (size === this.size) return;
    this.size = size;
    this.g = setupCanvas(this.canvas, size, size);
    const t = this.track;
    const b = t.bounds;
    const pad = 12;
    const w = b.maxX - b.minX;
    const h = b.maxZ - b.minZ;
    this.scale = (size - pad * 2) / Math.max(w, h);
    this.ox = pad + (size - pad * 2 - w * this.scale) / 2 - b.minX * this.scale;
    this.oy = pad + (size - pad * 2 - h * this.scale) / 2 - b.minZ * this.scale;
    // Pre-render the track outline.
    const off = document.createElement('canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    off.width = off.height = Math.round(size * dpr);
    const g = off.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.beginPath();
    g.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
    g.fillStyle = 'rgba(8,12,20,0.55)';
    g.fill();
    const path = () => {
      g.beginPath();
      for (let i = 0; i <= t.count; i++) {
        const k = i % t.count;
        const x = this.ox + t.px[k] * this.scale;
        const y = this.oy + t.pz[k] * this.scale;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
    };
    g.lineJoin = 'round';
    path();
    g.lineWidth = 7;
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.stroke();
    path();
    g.lineWidth = 4;
    g.strokeStyle = 'rgba(235,240,248,0.9)';
    g.stroke();
    // start line
    const sx = this.ox + t.px[0] * this.scale;
    const sy = this.oy + t.pz[0] * this.scale;
    g.save();
    g.translate(sx, sy);
    g.rotate(Math.atan2(t.tz[0], t.tx[0]));
    g.fillStyle = '#ff3b30';
    g.fillRect(-1.5, -6, 3, 12);
    g.restore();
    this.base = off;
  }

  draw(cars, player) {
    const g = this.g;
    const S = this.size;
    g.clearRect(0, 0, S, S);
    g.drawImage(this.base, 0, 0, S, S);
    for (const car of cars) {
      if (car === player) continue;
      g.beginPath();
      g.arc(this.ox + car.x * this.scale, this.oy + car.z * this.scale, 3.6, 0, Math.PI * 2);
      g.fillStyle = car.cssColor;
      g.fill();
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(0,0,0,0.7)';
      g.stroke();
    }
    // Player as an arrow.
    const x = this.ox + player.x * this.scale;
    const y = this.oy + player.z * this.scale;
    const a = Math.atan2(Math.cos(player.heading), Math.sin(player.heading));
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.beginPath();
    g.moveTo(7, 0);
    g.lineTo(-5, -5);
    g.lineTo(-2, 0);
    g.lineTo(-5, 5);
    g.closePath();
    g.fillStyle = '#ffd60a';
    g.fill();
    g.lineWidth = 1.5;
    g.strokeStyle = '#111';
    g.stroke();
    g.restore();
  }
}

export class HUD {
  constructor(track) {
    const $ = (id) => document.getElementById(id);
    this.root = $('hud');
    this.posEl = $('hud-pos');
    this.posSuf = $('hud-pos-suf');
    this.posOf = $('hud-pos-of');
    this.lapEl = $('hud-lap');
    this.lapsEl = $('hud-laps');
    this.timeEl = $('hud-time');
    this.lapTimeEl = $('hud-laptime');
    this.bestEl = $('hud-best');
    this.standingsEl = $('hud-standings');
    this.centerEl = $('hud-center');
    this.toastEl = $('hud-toast');
    this.wrongEl = $('hud-wrongway');
    this.speedo = new Speedo($('speedo'));
    this.minimap = new Minimap($('minimap'), track);
    this._memo = {};
    this._standTimer = 0;
    this._centerTimer = 0;
    this._toastTimer = 0;
    window.addEventListener('resize', () => {
      this.speedo.resize();
      this.minimap.resize();
    });
  }

  show(v) {
    this.root.classList.toggle('hidden', !v);
    if (v) {
      this.speedo.resize();
      this.minimap.resize();
    }
  }

  _set(key, el, text) {
    if (this._memo[key] !== text) {
      this._memo[key] = text;
      el.textContent = text;
    }
  }

  reset() {
    this._memo = {};
    this.centerEl.className = '';
    this.centerEl.textContent = '';
    this.toastEl.className = '';
    this.wrongEl.classList.remove('show');
    this.standingsEl.innerHTML = '';
  }

  /** Big centred message with a pop animation. */
  flash(text, cls = '', duration = 1.2) {
    const el = this.centerEl;
    el.className = '';
    void el.offsetWidth; // restart CSS animation
    el.textContent = text;
    el.className = `show ${cls}`;
    this._centerTimer = duration;
  }

  toast(html, duration = 2.6) {
    const el = this.toastEl;
    el.className = '';
    void el.offsetWidth;
    el.innerHTML = html;
    el.className = 'show';
    this._toastTimer = duration;
  }

  update(dt, { player, race, laps }) {
    if (this._centerTimer > 0) {
      this._centerTimer -= dt;
      if (this._centerTimer <= 0) this.centerEl.className = '';
    }
    if (this._toastTimer > 0) {
      this._toastTimer -= dt;
      if (this._toastTimer <= 0) this.toastEl.className = '';
    }
    const n = race.cars.length;
    this._set('pos', this.posEl, String(player.position));
    this._set('suf', this.posSuf, ordinal(player.position));
    this._set('of', this.posOf, `/${n}`);
    this._set('lap', this.lapEl, String(Math.min(laps, Math.max(1, player.lap + 1))));
    this._set('laps', this.lapsEl, String(laps));
    const t = race.started ? (player.finished ? player.finishTime : race.time) : 0;
    this._set('time', this.timeEl, formatTime(t || 0.0001).replace('-:--.--', '0:00.00'));
    const lapT = race.started && !player.finished ? race.time - player.lapStart : 0;
    this._set('laptime', this.lapTimeEl, race.started && !player.finished ? formatTime(Math.max(0.0001, lapT)) : '-:--.--');
    this._set('best', this.bestEl, formatTime(player.bestLap));

    const wrong = player.wrongWay > 1.2 && !player.finished;
    if (this._memo.wrong !== wrong) {
      this._memo.wrong = wrong;
      this.wrongEl.classList.toggle('show', wrong);
    }

    this._standTimer -= dt;
    if (this._standTimer <= 0) {
      this._standTimer = 0.25;
      this._drawStandings(race, player);
    }

    this.speedo.draw(Math.abs(player.speed) * 3.6, player.rpm, player.gear, player.boost, player.boosting);
    this.minimap.draw(race.cars, player);
  }

  _drawStandings(race, player) {
    const rows = race.standings.map((car) => {
      let gap = '';
      if (car !== player && !car.finished && !player.finished) {
        const d = car.progress - player.progress;
        const secs = d / Math.max(20, Math.abs(player.speed) || 30);
        gap = Math.abs(secs) < 0.05 ? '0.0' : `${secs > 0 ? '+' : '−'}${Math.abs(secs).toFixed(1)}`;
      } else if (car.finished) {
        gap = 'FIN';
      }
      return `<li class="${car === player ? 'me' : ''}"><span class="p">${car.position}</span><i style="background:${car.cssColor}"></i><span class="n">${car.name}</span><span class="g">${gap}</span></li>`;
    });
    const html = rows.join('');
    if (html !== this._memo.stand) {
      this._memo.stand = html;
      this.standingsEl.innerHTML = html;
    }
  }
}
