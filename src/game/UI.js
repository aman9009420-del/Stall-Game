import { CAR_TYPES, DIFFICULTY, LAP_OPTIONS, OPPONENT_OPTIONS, carStats } from './config.js';
import { formatTime, ordinal, hexColor } from './HUD.js';

// Menu / pause / results screens.

export class UI {
  constructor(game) {
    this.game = game;
    const $ = (id) => document.getElementById(id);
    this.$ = $;
    this.menu = $('menu');
    this.pause = $('pause');
    this.results = $('results');
    this.loading = $('loading');

    $('car-prev').addEventListener('click', () => this.changeCar(-1));
    $('car-next').addEventListener('click', () => this.changeCar(1));
    $('start-btn').addEventListener('click', () => game.startRace());
    $('resume-btn').addEventListener('click', () => game.setPaused(false));
    $('restart-btn').addEventListener('click', () => game.restartRace());
    $('quit-btn').addEventListener('click', () => game.enterMenu());
    $('again-btn').addEventListener('click', () => game.restartRace());
    $('menu-btn').addEventListener('click', () => game.enterMenu());
    $('mute-btn').addEventListener('click', (e) => {
      e.currentTarget.blur();
      game.toggleMute();
    });

    const options = {
      laps: LAP_OPTIONS.map((v) => [v, String(v)]),
      opponents: OPPONENT_OPTIONS.map((v) => [v, String(v)]),
      difficulty: Object.entries(DIFFICULTY).map(([k, d]) => [k, d.label]),
    };
    document.querySelectorAll('.seg[data-setting]').forEach((seg) => {
      const key = seg.dataset.setting;
      for (const [value, label] of options[key]) {
        const b = document.createElement('button');
        b.textContent = label;
        b.dataset.value = String(value);
        b.addEventListener('click', () => {
          game.updateSetting(key, value);
          this.refreshMenu();
        });
        seg.appendChild(b);
      }
    });

    // Keyboard navigation on the menu: left / right switches car.
    window.addEventListener('keydown', (e) => {
      if (this.menu.classList.contains('hidden')) return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.changeCar(-1);
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.changeCar(1);
    });
  }

  changeCar(dir) {
    const n = CAR_TYPES.length;
    const next = (this.game.settings.car + dir + n) % n;
    this.game.updateSetting('car', next);
    this.refreshMenu();
  }

  refreshMenu() {
    const s = this.game.settings;
    const spec = CAR_TYPES[s.car];
    const $ = this.$;
    $('car-name').textContent = spec.name;
    $('car-tagline').textContent = spec.tagline;
    $('car-swatch').style.background = hexColor(spec.color);
    const st = carStats(spec);
    $('stat-speed').style.width = `${Math.round(st.speed * 100)}%`;
    $('stat-accel').style.width = `${Math.round(st.accel * 100)}%`;
    $('stat-handling').style.width = `${Math.round(st.handling * 100)}%`;
    document.querySelectorAll('.seg[data-setting]').forEach((seg) => {
      const val = String(s[seg.dataset.setting]);
      seg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.value === val));
    });
    const best = this.game.bestLapFor(spec.id);
    $('menu-record').innerHTML = `Best lap with ${spec.name}: <b>${formatTime(best)}</b>`;
    this.refreshMute();
  }

  refreshMute() {
    this.$('mute-btn').classList.toggle('muted', !!this.game.settings.muted);
  }

  showMenu(v) {
    this.menu.classList.toggle('hidden', !v);
    if (v) this.refreshMenu();
  }

  showPause(v) {
    this.pause.classList.toggle('hidden', !v);
    if (v) this.$('resume-btn').focus({ preventScroll: true });
  }

  showResults(v, data = null) {
    this.results.classList.toggle('hidden', !v);
    if (!v || !data) return;
    const { rows, player, laps, newRecord } = data;
    const me = rows.findIndex((r) => r.car === player) + 1;
    const $ = this.$;
    $('results-title').textContent = me === 1 ? 'VICTORY!' : me <= 3 ? 'PODIUM FINISH!' : 'RACE RESULTS';
    const best = player.bestLap;
    $('results-sub').innerHTML =
      `You finished <b>${me}${ordinal(me)}</b> of ${rows.length} · ${laps} lap${laps > 1 ? 's' : ''}` +
      (Number.isFinite(best) ? ` · best lap <b>${formatTime(best)}</b>` : '') +
      (newRecord ? ' · <b>NEW RECORD!</b>' : '');
    $('results-body').innerHTML = rows
      .map((r, i) => {
        const car = r.car;
        const time = r.estimated ? `<span class="est">~${formatTime(r.time)}</span>` : formatTime(r.time);
        return `<tr class="${car === player ? 'me' : ''}">
          <td class="pos">${i + 1}</td>
          <td><span class="dot" style="background:${car.cssColor}"></span>${car.name}</td>
          <td>${car.spec.name}</td>
          <td>${time}</td>
          <td>${formatTime(r.bestLap)}</td>
        </tr>`;
      })
      .join('');
    setTimeout(() => $('again-btn').focus({ preventScroll: true }), 50);
  }

  setLoadingText(t) {
    this.$('loading-text').textContent = t;
  }

  hideLoading() {
    this.loading.classList.add('fade');
    setTimeout(() => this.loading.classList.add('hidden'), 600);
  }
}
