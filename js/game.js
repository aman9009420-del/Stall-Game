import {
  SAVE_KEY, INGREDIENTS, RECIPES, UPGRADES, DECOR, STAFF, ACHIEVEMENTS,
  CUSTOMER_NAMES, CUSTOMER_TYPES, t, setLang, getLang, recipeName, defaultState,
  stockCap, cookTime, sellPrice, maxQueue, maxBurners, spawnMult, pickCustomerType,
} from './config.js';
import { buildWorld, updateWorldFX } from './world.js';
import { createPerson, animatePerson, makeFood } from './characters.js';
import { AudioEngine } from './audio.js';

const $ = (id) => document.getElementById(id);
const DAY_LEN = 145;

export function createGame({ THREE, OrbitControls }) {
  const canvas = $('c');
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x0b1020, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.12, 160);
  camera.position.set(5.2, 3.8, 7.6);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1.15, 0.35);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = Math.PI / 2 - 0.04;
  controls.minDistance = 2.4;
  controls.maxDistance = 20;
  controls.autoRotateSpeed = 0.55;

  let state = loadSave() || defaultState();
  setLang(state.lang);
  applyQuality(state.settings.quality);

  const world = buildWorld(THREE, state.settings.quality);
  applyVisuals();

  const audio = new AudioEngine();
  audio.sfx = state.settings.sfx;
  audio.musicOn = state.settings.music;

  const clock = new THREE.Clock();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const keys = Object.create(null);

  let mode = 'menu';
  let prevMode = 'menu';
  let shopTab = 'recipes';
  let hour = 19.2;
  let dayTime = 0;
  let weather = 'clear';
  let dayActive = false;
  let customers = [];
  let burners = [];
  let readyFood = [];
  let prep = [];
  let comboTimer = 0;
  let spawnAcc = 2.2;
  let staffAcc = 0;
  let cleanAcc = 0;
  let saveAcc = 0;
  let hudAcc = 0;
  let tAbs = 0;
  let cid = 1;
  let dayStats = emptyDay();
  let hoverMesh = null;
  let hoverScale = 1;
  let downInfo = null;
  let confirmCb = null;
  let bubbles = new Map();
  let raf = 0;

  resize();
  refreshI18n();
  bindUI();
  loop();

  requestAnimationFrame(() => {
    renderer.render(world.scene, camera);
    $('loader').classList.add('hidden');
    $('menu').classList.remove('hidden');
    controls.autoRotate = true;
    updateContinueBtn();
  });

  function applyQuality(q) {
    const dpr = Math.min(window.devicePixelRatio || 1, q === 'high' ? 2 : q === 'low' ? 1 : 1.5);
    renderer.setPixelRatio(dpr);
    renderer.shadowMap.enabled = q !== 'low';
    renderer.setSize(innerWidth, innerHeight, false);
  }

  function applyVisuals() {
    world.setUpgradeVisuals(state);
    for (const id of Object.keys(state.decor)) world.setDecor(id, state.decor[id]);
    const n = maxBurners(state);
    if (world.parts.burners) {
      world.parts.burners.forEach((b, i) => {
        const on = i < n;
        b.ring.visible = on;
        b.cap.visible = on;
        if (!on) {
          b.flame.visible = false;
          b.pot.visible = false;
        }
      });
    }
  }

  function emptyDay() {
    return { served: 0, angry: 0, earned: 0, tips: 0, wages: 0, perfect: 0 };
  }

  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const base = defaultState();
      return deepMerge(base, parsed);
    } catch {
      return null;
    }
  }

  function deepMerge(base, extra) {
    if (!extra || typeof extra !== 'object') return base;
    const out = Array.isArray(base) ? [...base] : { ...base };
    for (const k of Object.keys(extra)) {
      if (extra[k] && typeof extra[k] === 'object' && !Array.isArray(extra[k]) && base[k] && typeof base[k] === 'object') {
        out[k] = deepMerge(base[k], extra[k]);
      } else {
        out[k] = extra[k];
      }
    }
    return out;
  }

  function save() {
    try {
      state.lang = getLang();
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch { /* quota / private mode */ }
  }

  function updateContinueBtn() {
    const has = !!localStorage.getItem(SAVE_KEY);
    $('btn-continue').style.display = has ? '' : 'none';
  }

  function refreshI18n() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const val = t(key);
      if (val) el.textContent = val;
    });
    $('btn-pause').textContent = '❚❚';
    $('btn-sfx').textContent = state.settings.sfx ? t('on') : t('off');
    $('btn-music').textContent = state.settings.music ? t('on') : t('off');
    renderHud(true);
    if (!$('modal-shop').classList.contains('hidden')) renderShop();
  }

  function toast(msg, kind = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.textContent = msg;
    $('toasts').appendChild(el);
    setTimeout(() => { el.remove(); }, 2300);
  }

  function floatText(pos, text, bad) {
    const el = document.createElement('div');
    el.className = 'float-txt' + (bad ? ' bad' : '');
    el.textContent = text;
    const v = pos.clone().project(camera);
    el.style.left = ((v.x * 0.5 + 0.5) * innerWidth) + 'px';
    el.style.top = ((-v.y * 0.5 + 0.5) * innerHeight) + 'px';
    $('world-ui').appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  function show(id, on) {
    const el = $(id);
    if (!el) return;
    el.classList.toggle('hidden', !on);
  }

  function closeModals() {
    ['modal-pause', 'modal-shop', 'modal-summary', 'modal-how', 'modal-settings', 'modal-tutorial', 'modal-confirm'].forEach((id) => show(id, false));
  }

  function bindUI() {
    $('btn-play').onclick = () => { bootAudio(); startPlay('go'); };
    $('btn-continue').onclick = () => { bootAudio(); startPlay('go'); };
    $('btn-showcase').onclick = () => { bootAudio(); enterShowcase(); };
    $('btn-how').onclick = () => { prevMode = 'menu'; openHow(); };
    $('btn-settings').onclick = () => { prevMode = 'menu'; openSettings(); };
    $('btn-how-close').onclick = () => {
      show('modal-how', false);
      if (prevMode === 'menu') show('menu', true);
      else if (prevMode === 'pause') show('modal-pause', true);
    };
    $('btn-set-close').onclick = () => {
      show('modal-settings', false);
      if (prevMode === 'menu') show('menu', true);
      else if (prevMode === 'pause') show('modal-pause', true);
    };
    $('btn-pause').onclick = () => pauseGame();
    $('btn-resume').onclick = () => resumeGame();
    $('btn-pause-shop').onclick = () => openShop();
    $('btn-pause-how').onclick = () => { prevMode = 'pause'; show('modal-pause', false); openHow(); };
    $('btn-pause-set').onclick = () => { prevMode = 'pause'; show('modal-pause', false); openSettings(); };
    $('btn-quit-menu').onclick = () => quitToMenu();
    $('btn-shop-open').onclick = () => openShop();
    $('btn-shop-close').onclick = () => closeShop();
    $('btn-restock').onclick = () => restockAll();
    $('btn-serve').onclick = () => tryServeAny(false);
    $('btn-close-day').onclick = () => endDay();
    $('btn-next-day').onclick = () => startPlay('next');
    $('btn-summary-shop').onclick = () => { show('modal-summary', false); openShop(); };
    $('btn-tut-ok').onclick = () => { state.seenTutorial = true; save(); show('modal-tutorial', false); mode = 'play'; };
    $('btn-en').onclick = () => { setLang('en'); state.lang = 'en'; save(); refreshI18n(); audio.click(); };
    $('btn-hi').onclick = () => { setLang('hi'); state.lang = 'hi'; save(); refreshI18n(); audio.click(); };
    $('btn-sfx').onclick = () => {
      state.settings.sfx = !state.settings.sfx;
      audio.setSfx(state.settings.sfx);
      save(); refreshI18n();
    };
    $('btn-music').onclick = () => {
      state.settings.music = !state.settings.music;
      audio.setMusic(state.settings.music);
      save(); refreshI18n();
    };
    $('btn-fs').onclick = () => toggleFs();
    $('btn-reset').onclick = () => {
      confirmCb = () => {
        localStorage.removeItem(SAVE_KEY);
        state = defaultState();
        setLang('en');
        applyVisuals();
        refreshI18n();
        toast(t('saved'));
        updateContinueBtn();
      };
      $('confirm-text').textContent = t('resetConfirm');
      show('modal-confirm', true);
    };
    $('confirm-yes').onclick = () => { show('modal-confirm', false); if (confirmCb) confirmCb(); confirmCb = null; };
    $('confirm-no').onclick = () => { show('modal-confirm', false); confirmCb = null; };

    document.querySelectorAll('#modal-shop .tab').forEach((tab) => {
      tab.onclick = () => {
        shopTab = tab.getAttribute('data-tab');
        document.querySelectorAll('#modal-shop .tab').forEach((x) => x.classList.toggle('on', x === tab));
        renderShop();
        audio.click();
      };
    });
    document.querySelectorAll('[data-q]').forEach((b) => {
      b.onclick = () => {
        state.settings.quality = b.getAttribute('data-q');
        applyQuality(state.settings.quality);
        save();
        audio.click();
      };
    });

    canvas.addEventListener('pointerdown', (e) => {
      downInfo = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    canvas.addEventListener('pointerup', (e) => {
      if (!downInfo) return;
      const dx = e.clientX - downInfo.x;
      const dy = e.clientY - downInfo.y;
      const dt = performance.now() - downInfo.t;
      downInfo = null;
      if (dx * dx + dy * dy < 36 && dt < 500) onClick(e);
    });
    canvas.addEventListener('pointermove', (e) => onHover(e));

    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && mode === 'play') pauseGame();
    });
  }

  function bootAudio() {
    audio.ensure();
    audio.startAmbient();
    if (state.settings.music) audio.startMusic();
  }

  function resize() {
    const w = innerWidth;
    const h = innerHeight;
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function toggleFs() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  function camHome() {
    camera.position.set(5.2, 3.8, 7.6);
    controls.target.set(0, 1.15, 0.35);
  }

  function startPlay(kind) {
    closeModals();
    show('menu', false);
    show('photo-hint', false);
    show('hud', true);
    controls.autoRotate = false;
    camHome();
    mode = 'play';
    if (!dayActive) beginDay(kind === 'next');
    else world.updateTimeOfDay(hour, weather);
    if (!state.seenTutorial) {
      mode = 'tutorial';
      show('modal-tutorial', true);
    }
    renderHud(true);
    audio.bell();
  }

  function beginDay(advance) {
    clearRuntime();
    if (advance) state.day += 1;
    weather = rollWeather(state.day);
    hour = 8;
    dayTime = 0;
    dayActive = true;
    dayStats = emptyDay();
    state.combo = 0;
    spawnAcc = 1.6;
    unlockByDay();
    if (state.upgrades.restock) {
      for (const id of Object.keys(INGREDIENTS)) {
        const cap = stockCap(state, id);
        const add = Math.round(cap * 0.22 * state.upgrades.restock);
        state.stock[id] = Math.min(cap, (state.stock[id] || 0) + add);
      }
    }
    if (state.money <= 0 && (state.stock.tea || 0) < 3) {
      state.stock.tea = Math.max(state.stock.tea, 6);
      state.stock.milk = Math.max(state.stock.milk, 6);
      state.stock.spice = Math.max(state.stock.spice, 8);
    }
    applyVisuals();
    world.updateTimeOfDay(hour, weather);
    toast(`${t('newDay')} ${state.day} · ${weatherLabel()}`, 'good');
    grant('week', state.day >= 7);
    grant('month', state.day >= 30);
    save();
    renderHud(true);
  }

  function weatherLabel() {
    if (weather === 'rain') return t('weatherRain');
    if (weather === 'festive') return t('weatherFestive');
    return t('weatherClear');
  }

  function rollWeather(day) {
    const r = Math.random();
    if (day >= 5 && r < 0.14) return 'festive';
    if (r < 0.22) return 'rain';
    return 'clear';
  }

  function unlockByDay() {
    for (const rec of Object.values(RECIPES)) {
      if (rec.shop === 0 && rec.unlockDay <= state.day && !state.recipesUnlocked.includes(rec.id)) {
        state.recipesUnlocked.push(rec.id);
        toast(`${recipeName(rec.id)} ★`, 'good');
      }
    }
    grant('cookbook', Object.keys(RECIPES).every((id) => state.recipesUnlocked.includes(id)));
  }

  function clearRuntime() {
    customers.forEach((c) => world.scene.remove(c.mesh));
    customers = [];
    readyFood.forEach((f) => world.stall.remove(f.mesh));
    readyFood = [];
    burners = [];
    prep = [];
    if (world.parts.burners) {
      world.parts.burners.forEach((b) => {
        b.flame.visible = false;
        b.pot.visible = false;
      });
    }
    audio.setSizzle(false);
    bubbles.forEach((el) => el.remove());
    bubbles.clear();
  }

  function pauseGame() {
    if (mode !== 'play') return;
    mode = 'pause';
    show('modal-pause', true);
    audio.click();
  }

  function resumeGame() {
    closeModals();
    show('hud', true);
    mode = 'play';
  }

  function quitToMenu() {
    closeModals();
    show('hud', false);
    show('menu', true);
    mode = 'menu';
    controls.autoRotate = true;
    save();
    updateContinueBtn();
  }

  function enterShowcase() {
    closeModals();
    show('menu', false);
    show('hud', false);
    show('photo-hint', true);
    mode = 'showcase';
    controls.autoRotate = true;
    camHome();
  }

  function openHow() {
    show('menu', mode === 'menu' ? true : $('menu').classList.contains('hidden') ? false : true);
    if (mode !== 'menu') show('menu', false);
    show('modal-how', true);
  }

  function openSettings() {
    if (mode !== 'menu') show('menu', false);
    show('modal-settings', true);
  }

  function openShop() {
    if (mode === 'play') mode = 'shop';
    show('modal-pause', false);
    show('modal-summary', false);
    show('modal-shop', true);
    renderShop();
    audio.click();
  }

  function closeShop() {
    show('modal-shop', false);
    if (dayActive && mode === 'shop') {
      mode = 'play';
      show('hud', true);
    } else if (!dayActive) {
      show('modal-summary', true);
    } else if (mode === 'pause') show('modal-pause', true);
  }

  function onKey(e) {
    keys[e.code] = true;
    if (e.code === 'Escape') {
      if (!$('modal-confirm').classList.contains('hidden')) { show('modal-confirm', false); return; }
      if (mode === 'showcase') { show('photo-hint', false); quitToMenu(); return; }
      if (mode === 'shop') { closeShop(); return; }
      if (!$('modal-how').classList.contains('hidden') || !$('modal-settings').classList.contains('hidden')) {
        closeModals();
        if (prevMode === 'menu') show('menu', true);
        else if (dayActive) show('modal-pause', true);
        return;
      }
      if (mode === 'play') pauseGame();
      else if (mode === 'pause') resumeGame();
      return;
    }
    if (mode !== 'play') return;
    if (e.code === 'Space') { e.preventDefault(); tryServeAny(false); }
    if (e.code === 'KeyC') camHome();
    if (e.code === 'KeyF') toggleFs();
    const digit = e.code.startsWith('Digit') ? Number(e.code.slice(5)) : (e.code.startsWith('Numpad') ? Number(e.code.slice(6)) : 0);
    if (digit >= 1 && digit <= 9) {
      const list = unlockedRecipes();
      const rec = list[digit - 1];
      if (rec) startCook(rec.id, false);
    }
  }

  function unlockedRecipes() {
    return state.recipesUnlocked.map((id) => RECIPES[id]).filter(Boolean);
  }

  function simOn() { return mode === 'play'; }

  function loop() {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, clock.getDelta());
    tAbs += dt;
    controls.autoRotate = mode === 'menu' || mode === 'showcase';
    panCamera(dt);
    controls.update();

    const cookingOn = burners.some((b) => b.busy && !b.done);
    updateWorldFX(world, dt, tAbs, cookingOn, weather);
    world.updateTimeOfDay(hour, weather);

    if (simOn()) tickSim(dt);

    saveAcc += dt;
    if (saveAcc > 12) { saveAcc = 0; save(); }
    hudAcc += dt;
    if (hudAcc > 0.2) { hudAcc = 0; renderHud(false); updateBubbles(); }

    renderer.render(world.scene, camera);
  }

  function panCamera(dt) {
    if (mode !== 'play' && mode !== 'showcase') return;
    const speed = (keys.ShiftLeft ? 10 : 5.5) * dt;
    if (!(keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD || keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight)) return;
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    if (fwd.lengthSq() < 0.0001) fwd.set(0, 0, -1);
    fwd.normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const mv = new THREE.Vector3();
    if (keys.KeyW || keys.ArrowUp) mv.add(fwd);
    if (keys.KeyS || keys.ArrowDown) mv.sub(fwd);
    if (keys.KeyD || keys.ArrowRight) mv.add(right);
    if (keys.KeyA || keys.ArrowLeft) mv.sub(right);
    if (mv.lengthSq() === 0) return;
    mv.normalize().multiplyScalar(speed);
    camera.position.add(mv);
    controls.target.add(mv);
    if (camera.position.y < 1.15) camera.position.y = 1.15;
  }

  function tickSim(dt) {
    dayTime += dt;
    hour = 8 + (dayTime / DAY_LEN) * 14;
    if (dayTime >= DAY_LEN) { endDay(); return; }

    comboTimer -= dt;
    if (comboTimer <= 0) state.combo = 0;

    spawnAcc -= dt;
    const lined = customers.filter((c) => c.phase === 'enter' || c.phase === 'wait').length;
    if (spawnAcc <= 0 && lined < maxQueue(state)) {
      spawnCustomer();
      const mult = spawnMult(state, hour, weather);
      spawnAcc = Math.max(1.05, (4.4 / Math.max(0.35, mult)) * (0.65 + Math.random() * 0.7));
    }

    updateCooking(dt);
    updateCustomers(dt);
    staffTick(dt);
  }

  function staffTick(dt) {
    staffAcc += dt;
    if (staffAcc < 0.9) return;
    staffAcc = 0;
    if (state.staff.cook) {
      const wait = customers.find((c) => c.phase === 'wait' && !hasReady(c.order) && !isCooking(c.order));
      if (wait) startCook(wait.order, true);
    }
    if (state.staff.server) tryServeAny(true);
    if (state.staff.cleaner) {
      cleanAcc += 0.9;
      if (cleanAcc > 16) { cleanAcc = 0; addRep(1); }
    }
  }

  function spawnCustomer() {
    const rng = Math.random;
    const type = pickCustomerType(state, rng);
    const spec = CUSTOMER_TYPES[type] || CUSTOMER_TYPES.regular;
    const options = unlockedRecipes();
    if (!options.length) return;
    let order = options[(rng() * options.length) | 0].id;
    if (type === 'critic' && options.length > 2) order = options[options.length - 1].id;
    const mesh = createPerson(THREE, rng, type);
    const sp = world.spawnPoints[(rng() * world.spawnPoints.length) | 0];
    mesh.position.set(sp.x, 0, sp.z);
    mesh.userData.baseY = 0;
    mesh.userData.customerId = cid;
    const hit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.38, 1.7, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    hit.position.y = 0.85;
    mesh.add(hit);
    world.scene.add(mesh);
    const patience = spec.patience * (state.upgrades.speaker ? 1.12 : 1) * (0.9 + rng() * 0.2);
    const c = {
      id: cid++,
      mesh,
      type,
      name: CUSTOMER_NAMES[(rng() * CUSTOMER_NAMES.length) | 0],
      order,
      patience,
      maxPatience: patience,
      phase: 'enter',
      slot: linedIndex(),
      speed: 1.55 * spec.speed,
      spec,
      happy: false,
    };
    customers.push(c);
    if (type === 'critic' || type === 'star') toast(`${t('special')}: ${c.name}`, 'good');
    audio.whoosh();
  }

  function linedIndex() {
    const used = customers.filter((c) => c.phase !== 'leave').map((c) => c.slot);
    const max = maxQueue(state);
    for (let i = 0; i < max; i++) if (!used.includes(i)) return i;
    return Math.max(0, max - 1);
  }

  function updateCustomers(dt) {
    const active = customers.filter((c) => c.phase !== 'leave');
    active.sort((a, b) => a.slot - b.slot);
    active.forEach((c, i) => { c.slot = i; });

    const gone = [];
    for (const c of customers) {
      const moving = c.phase === 'enter' || c.phase === 'leave';
      animatePerson(c.mesh, tAbs + c.id, moving, dt);
      if (c.phase === 'leave') {
        const ex = c.mesh.position.x > 0 ? 18 : -18;
        if (stepTo(c.mesh, ex, 8.5, c.speed * 1.15, dt)) gone.push(c);
        continue;
      }
      const slot = world.queueSlots[Math.min(c.slot, world.queueSlots.length - 1)];
      const arrived = stepTo(c.mesh, slot.x, slot.z, c.speed, dt);
      if (c.phase === 'enter' && arrived) c.phase = 'wait';
      if (c.phase === 'wait') {
        c.patience -= dt;
        c.mesh.lookAt(0, 1.2, 0.2);
        if (c.patience <= 0) leaveCustomer(c, false);
      }
    }
    gone.forEach(removeCustomer);
  }

  function stepTo(mesh, x, z, speed, dt) {
    const dx = x - mesh.position.x;
    const dz = z - mesh.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.1) return true;
    const step = Math.min(dist, speed * dt);
    mesh.position.x += (dx / dist) * step;
    mesh.position.z += (dz / dist) * step;
    mesh.rotation.y = Math.atan2(dx, dz);
    return false;
  }

  function leaveCustomer(c, happy) {
    if (c.phase === 'leave') return;
    c.phase = 'leave';
    c.happy = happy;
    const bub = bubbles.get(c.id);
    if (bub) { bub.remove(); bubbles.delete(c.id); }
    if (!happy) {
      state.combo = 0;
      addRep(c.type === 'critic' ? -8 : -3);
      dayStats.angry += 1;
      state.stats.angry += 1;
      toast(`${c.name} — ${t('angryLeave')}`, 'bad');
      audio.fail();
      if (c.type === 'critic') toast(t('criticNo'), 'bad');
    }
  }

  function removeCustomer(c) {
    world.scene.remove(c.mesh);
    customers = customers.filter((x) => x.id !== c.id);
    const bub = bubbles.get(c.id);
    if (bub) { bub.remove(); bubbles.delete(c.id); }
  }

  function isCooking(id) { return burners.some((b) => b.recipeId === id && b.busy); }
  function hasReady(id) {
    return readyFood.some((f) => f.recipeId === id) || burners.some((b) => b.done && b.recipeId === id);
  }

  function startCook(recipeId, silent) {
    const rec = RECIPES[recipeId];
    if (!rec) return false;
    if (!state.recipesUnlocked.includes(recipeId)) return false;
    const n = maxBurners(state);
    const free = [];
    for (let i = 0; i < n; i++) if (!burners.find((b) => b.index === i && b.busy)) free.push(i);
    if (!free.length) {
      if (!silent) toast(t('noBurner'), 'bad');
      return false;
    }
    for (const ing of rec.ingredients) {
      if ((state.stock[ing] || 0) <= 0) {
        if (!silent) toast(`${t('needStock')}: ${INGREDIENTS[ing].emoji}`, 'bad');
        return false;
      }
    }
    rec.ingredients.forEach((ing) => { state.stock[ing] -= 1; });
    const index = free[0];
    const dur = cookTime(state, rec);
    burners.push({ index, recipeId, t: 0, dur, busy: true, done: false });
    const bm = world.parts.burners[index];
    if (bm) { bm.flame.visible = true; bm.pot.visible = true; }
    audio.sizzleBurst();
    audio.setSizzle(true);
    if (!silent) audio.click();
    renderHud(true);
    return true;
  }

  function updateCooking(dt) {
    let any = false;
    for (const b of burners) {
      if (!b.busy) continue;
      any = true;
      if (b.done) continue;
      b.t += dt;
      if (b.t >= b.dur) {
        b.done = true;
        finishCook(b);
      }
    }
    if (!any) audio.setSizzle(false);
    burners = burners.filter((b) => b.busy);
  }

  function finishCook(b) {
    const bm = world.parts.burners[b.index];
    if (bm) { bm.flame.visible = false; bm.pot.visible = false; }
    const slotIdx = world.readySlots.findIndex((_, i) => !readyFood.some((f) => f.slot === i));
    const slot = world.readySlots[slotIdx >= 0 ? slotIdx : 0];
    const food = makeFood(THREE, b.recipeId, world.mats);
    food.position.set(slot.x, slot.y + 0.06, slot.z);
    world.stall.add(food);
    readyFood.push({ recipeId: b.recipeId, mesh: food, slot: slotIdx >= 0 ? slotIdx : 0 });
    b.busy = false;
    audio.pop();
  }

  function takeReady(recipeId) {
    const i = readyFood.findIndex((f) => f.recipeId === recipeId);
    if (i < 0) return false;
    const f = readyFood.splice(i, 1)[0];
    world.stall.remove(f.mesh);
    return true;
  }

  function tryServeAny(silent) {
    const waiters = customers.filter((c) => c.phase === 'wait').sort((a, b) => a.slot - b.slot);
    for (const c of waiters) {
      if (hasReady(c.order)) return serveCustomer(c);
    }
    if (!silent) toast(t('hintServe'));
    return false;
  }

  function serveCustomer(c) {
    if (!takeReady(c.order)) return false;
    const rec = RECIPES[c.order];
    const price = sellPrice(state, rec);
    const speed = Math.max(0, c.patience / c.maxPatience);
    const perfect = speed > 0.7;
    const comboBonus = 1 + Math.min(8, state.combo) * 0.06;
    const seat = state.upgrades.seating ? 1.18 : 1;
    const speaker = state.upgrades.speaker ? 1.08 : 1;
    const tip = Math.round(price * 0.12 * speed * comboBonus * seat * speaker * c.spec.tip * c.spec.pay);
    const pay = Math.round(price * c.spec.pay) + tip;
    state.money += pay;
    state.stats.earned += pay;
    state.stats.tips += tip;
    state.stats.served += 1;
    dayStats.served += 1;
    dayStats.earned += pay;
    dayStats.tips += tip;
    if (perfect) {
      dayStats.perfect += 1;
      state.stats.perfect += 1;
      audio.perfect();
      toast(t('perfect'), 'good');
    } else audio.success();
    audio.coin();
    state.combo += 1;
    comboTimer = 8;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;
    addRep(perfect ? 3 : 1 + (c.type === 'tourist' ? 1 : 0));
    if (c.type === 'critic') {
      if (speed > 0.4) {
        addRep(10);
        state.stats.criticsWon += 1;
        toast(t('criticYes'), 'good');
        grant('critic', true);
      } else {
        addRep(-6);
        toast(t('criticNo'), 'bad');
      }
    }
    if (c.type === 'star') addRep(4);
    const pos = c.mesh.position.clone();
    pos.y = 1.6;
    floatText(pos, `+₹${pay}`, false);
    if (state.combo >= 2) {
      const pop = $('combo-pop');
      pop.textContent = `COMBO x${state.combo}`;
      pop.classList.add('show');
      setTimeout(() => pop.classList.remove('show'), 700);
    }
    grant('firstServe', true);
    grant('tenServes', state.stats.served >= 10);
    grant('hundred', state.stats.served >= 100);
    grant('rich', state.money >= 1000);
    grant('combo5', state.combo >= 5);
    grant('combo10', state.combo >= 10);
    grant('tycoon', state.money >= 100000);
    grant('festival', weather === 'festive' && dayStats.served >= 8);
    leaveCustomer(c, true);
    renderHud(true);
    return true;
  }

  function addRep(n) {
    const floor = state.upgrades.generator ? 25 : 0;
    state.reputation = Math.max(floor, Math.min(100, Math.round(state.reputation + n)));
  }

  function grant(id, ok) {
    if (!ok || state.achievements[id]) return;
    state.achievements[id] = true;
    toast(`★ ${t('ach_' + id)}`, 'good');
    audio.bell();
  }

  function endDay() {
    if (!dayActive) return;
    dayActive = false;
    mode = 'summary';
    customers.filter((c) => c.phase !== 'leave').forEach((c) => leaveCustomer(c, false));
    let wages = 0;
    for (const id of Object.keys(STAFF)) if (state.staff[id]) wages += STAFF[id].wage;
    dayStats.wages = wages;
    state.money = Math.max(0, state.money - wages);
    const profit = dayStats.earned - wages;
    if (profit > state.stats.bestDay) state.stats.bestDay = profit;
    if (dayStats.angry === 0 && dayStats.served >= 6) grant('perfectDay', true);
    if (weather === 'rain' && profit > 0) grant('rainProfit', true);
    audio.setSizzle(false);
    save();
    show('hud', false);
    closeModals();
    renderSummary();
    show('modal-summary', true);
  }

  function renderSummary() {
    $('summary-weather').textContent = `${t('day')} ${state.day} · ${weatherLabel()}`;
    const profit = dayStats.earned - dayStats.wages;
    $('summary-grid').innerHTML = [
      [t('served'), dayStats.served],
      [t('earned'), `₹${dayStats.earned}`],
      [t('tips'), `₹${dayStats.tips}`],
      [t('angry'), dayStats.angry],
      [t('wages'), `₹${dayStats.wages}`],
      [t('profit'), `₹${profit}`],
    ].map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
  }

  function restockAll() {
    let cost = 0;
    const plan = {};
    for (const id of Object.keys(INGREDIENTS)) {
      const cap = stockCap(state, id);
      const need = Math.max(0, cap - (state.stock[id] || 0));
      plan[id] = need;
      cost += need * INGREDIENTS[id].cost;
    }
    if (cost <= 0) { toast(t('owned')); return; }
    if (state.money < cost) { toast(`₹${cost}`, 'bad'); audio.fail(); return; }
    state.money -= cost;
    state.stats.spent += cost;
    for (const id of Object.keys(plan)) state.stock[id] += plan[id];
    audio.coin();
    toast(`₹${cost}`, 'good');
    save();
    renderHud(true);
    renderShop();
  }

  function pick(ev) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const objs = world.interactables.map((i) => i.mesh).concat(customers.map((c) => c.mesh));
    const hits = raycaster.intersectObjects(objs, true);
    if (!hits.length) return null;
    let obj = hits[0].object;
    while (obj) {
      if (obj.userData.interact) return { kind: 'obj', data: obj.userData.interact, mesh: obj };
      if (obj.userData.customerId) return { kind: 'cust', id: obj.userData.customerId, mesh: obj };
      obj = obj.parent;
    }
    return null;
  }

  function onHover(ev) {
    if (mode !== 'play' && mode !== 'showcase') {
      canvas.style.cursor = 'grab';
      return;
    }
    const hit = pick(ev);
    if (hoverMesh && hoverMesh !== (hit && hit.mesh)) {
      hoverMesh.scale.setScalar(hoverScale);
      hoverMesh = null;
    }
    if (hit && hit.mesh) {
      canvas.style.cursor = 'pointer';
      if (hoverMesh !== hit.mesh) {
        hoverMesh = hit.mesh;
        hoverScale = hit.mesh.scale.x || 1;
        hit.mesh.scale.setScalar(hoverScale * 1.08);
      }
    } else canvas.style.cursor = 'grab';
  }

  function onClick(ev) {
    if (mode === 'showcase' || mode === 'menu') return;
    if (mode !== 'play') return;
    const hit = pick(ev);
    if (!hit) return;
    if (hit.kind === 'cust') {
      const c = customers.find((x) => x.id === hit.id);
      if (c && c.phase === 'wait') {
        if (hasReady(c.order)) serveCustomer(c);
        else toast(`${c.name}: ${RECIPES[c.order].emoji} ${recipeName(c.order)}`);
      }
      return;
    }
    const it = hit.data;
    if (!it) return;
    if (it.type === 'ingredient') {
      prep.push(it.ingredient);
      if (prep.length > 6) prep.shift();
      audio.pop();
      toast(INGREDIENTS[it.ingredient].emoji + ' ' + it.ingredient);
      return;
    }
    if (it.type === 'burner') {
      if (prep.length) {
        const rec = matchPrep(prep);
        prep = [];
        if (rec) startCook(rec.id, false);
        else { toast(t('needStock'), 'bad'); audio.fail(); }
      } else if (world.parts.burners[it.index] && it.index < maxBurners(state)) {
        const waiting = customers.find((c) => c.phase === 'wait');
        if (waiting) startCook(waiting.order, false);
      }
      return;
    }
    if (it.type === 'bell') { audio.bell(); tryServeAny(false); }
  }

  function matchPrep(list) {
    const need = [...list].sort().join('|');
    for (const rec of Object.values(RECIPES)) {
      if (!state.recipesUnlocked.includes(rec.id)) continue;
      if ([...rec.ingredients].sort().join('|') === need) return rec;
    }
    return null;
  }

  function renderHud(full) {
    if ($('hud').classList.contains('hidden') && !full) return;
    $('hud-day').textContent = String(state.day);
    $('hud-money').textContent = `₹${state.money}`;
    $('hud-rep').textContent = String(state.reputation);
    $('hud-repbar').style.width = `${state.reputation}%`;
    $('hud-combo').textContent = String(state.combo);
    const hh = Math.min(22, Math.floor(hour));
    const mm = Math.floor((hour % 1) * 60);
    const open = dayActive && hour < 22;
    $('hud-clock').textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · ${open ? t('open') : t('closed')} · ${weatherLabel()}`;
    $('hud-clockbar').style.width = `${Math.min(100, (dayTime / DAY_LEN) * 100)}%`;

    if (full) {
      renderStock();
      renderRecipes();
    }
    renderOrders();
    renderBurners();
  }

  function renderStock() {
    const box = $('stock-list');
    box.innerHTML = Object.values(INGREDIENTS).map((ing) => {
      const n = state.stock[ing.id] || 0;
      const cap = stockCap(state, ing.id);
      const low = n <= 4 ? ' low' : '';
      return `<div class="stock-row${low}"><span>${ing.emoji}</span><span>${ing.id}</span><span class="n">${n}/${cap}</span></div>`;
    }).join('');
  }

  function renderRecipes() {
    const list = unlockedRecipes();
    $('recipe-bar').innerHTML = list.map((rec, i) => {
      const ok = rec.ingredients.every((id) => (state.stock[id] || 0) > 0);
      return `<button class="recipe${ok ? '' : ' busy'}" data-rec="${rec.id}">
        <div class="em">${rec.emoji}</div>
        <div class="nm">${recipeName(rec.id)}</div>
        <div class="pr">₹${sellPrice(state, rec)}</div>
        <div class="key">${i < 9 ? i + 1 : ''}</div>
      </button>`;
    }).join('');
    $('recipe-bar').querySelectorAll('.recipe').forEach((btn) => {
      btn.onclick = () => startCook(btn.getAttribute('data-rec'), false);
    });
  }

  function renderOrders() {
    const wait = customers.filter((c) => c.phase === 'wait' || c.phase === 'enter');
    const box = $('order-list');
    if (!wait.length) {
      box.innerHTML = `<div class="muted">${t('emptyQueue')}</div>`;
      return;
    }
    box.innerHTML = wait.map((c) => {
      const rec = RECIPES[c.order];
      const p = Math.max(0, c.patience / c.maxPatience);
      const cls = p < 0.3 ? 'low' : p < 0.6 ? 'mid' : '';
      return `<div class="order-card" data-cid="${c.id}">
        <div class="order-top">${rec.emoji} <b>${recipeName(c.order)}</b>
          <span style="margin-left:auto;font-size:11px;color:#d6c2a4">${c.name}${c.type === 'critic' ? ' ★' : ''}</span>
        </div>
        <div class="pat ${cls}"><i style="width:${p * 100}%"></i></div>
      </div>`;
    }).join('');
    box.querySelectorAll('.order-card').forEach((el) => {
      el.onclick = () => {
        const c = customers.find((x) => x.id === Number(el.getAttribute('data-cid')));
        if (c && c.phase === 'wait') {
          if (hasReady(c.order)) serveCustomer(c);
          else startCook(c.order, false);
        }
      };
    });
  }

  function renderBurners() {
    const n = maxBurners(state);
    const wrap = $('burners-ui');
    let html = '';
    for (let i = 0; i < n; i++) {
      const b = burners.find((x) => x.index === i && x.busy);
      const w = b ? Math.min(100, (b.t / b.dur) * 100) : 0;
      html += `<div class="burn"><i style="width:${w}%"></i></div>`;
    }
    wrap.innerHTML = html;
  }

  function updateBubbles() {
    const layer = $('world-ui');
    const live = new Set();
    for (const c of customers) {
      if (c.phase !== 'wait' && c.phase !== 'enter') continue;
      live.add(c.id);
      let el = bubbles.get(c.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'bubble';
        layer.appendChild(el);
        bubbles.set(c.id, el);
      }
      const rec = RECIPES[c.order];
      el.innerHTML = `${rec.emoji} ${recipeName(c.order)}<span class="sub">${c.name}</span>`;
      const pos = c.mesh.position.clone();
      pos.y = 1.85;
      const v = pos.project(camera);
      if (v.z > 1) { el.style.display = 'none'; continue; }
      el.style.display = 'block';
      el.style.left = ((v.x * 0.5 + 0.5) * innerWidth) + 'px';
      el.style.top = ((-v.y * 0.5 + 0.5) * innerHeight - 8) + 'px';
    }
    for (const [id, el] of bubbles) {
      if (!live.has(id)) { el.remove(); bubbles.delete(id); }
    }
  }

  function renderShop() {
    const body = $('shop-body');
    if (shopTab === 'recipes') {
      body.innerHTML = Object.values(RECIPES).map((rec) => {
        const have = state.recipesUnlocked.includes(rec.id);
        const locked = rec.unlockDay > state.day && rec.shop > 0;
        const cost = rec.shop;
        const can = !have && cost > 0 && rec.unlockDay <= state.day && state.money >= cost;
        return itemCard(rec.emoji + ' ' + recipeName(rec.id),
          rec.ingredients.map((i) => INGREDIENTS[i].emoji).join(' ') + ` · ₹${sellPrice(state, rec)}`,
          have ? t('owned') : (cost ? `₹${cost}` : t('free')),
          have || !cost || locked, can ? () => buyRecipe(rec) : null,
          have ? t('owned') : locked ? t('locked') : t('buy'));
      }).join('');
    } else if (shopTab === 'upgrades') {
      body.innerHTML = Object.values(UPGRADES).map((up) => {
        const lv = state.upgrades[up.id] || 0;
        const maxed = lv >= up.max;
        const cost = maxed ? 0 : up.costs[Math.min(lv, up.costs.length - 1)];
        const can = !maxed && state.money >= cost;
        return itemCard(`${t('up' + cap(up.id))} · ${t('level')} ${lv}/${up.max}`,
          t('desc_' + up.id),
          maxed ? t('maxed') : `₹${cost}`,
          maxed, can ? () => buyUpgrade(up) : null,
          maxed ? t('maxed') : t('buy'));
      }).join('');
    } else if (shopTab === 'decor') {
      body.innerHTML = Object.values(DECOR).map((d) => {
        const have = !!state.decor[d.id];
        const can = !have && state.money >= d.cost;
        return itemCard(t('dc' + cap(d.id)), t('decor'), have ? t('owned') : `₹${d.cost}`,
          have, can ? () => buyDecor(d) : null, have ? t('owned') : t('buy'));
      }).join('');
    } else if (shopTab === 'staff') {
      body.innerHTML = Object.values(STAFF).map((s) => {
        const have = !!state.staff[s.id];
        const can = !have && state.money >= s.hire;
        return itemCard(t('staff' + cap(s.id)), `${t('desc_' + s.id)} · ${t('wage')} ₹${s.wage}`,
          have ? t('hired') : `₹${s.hire}`,
          have, can ? () => hireStaff(s) : null, have ? t('hired') : t('buy'));
      }).join('');
    } else {
      body.innerHTML = Object.values(ACHIEVEMENTS).map((a) => {
        const have = !!state.achievements[a.id];
        return `<div class="shop-item" style="opacity:${have ? 1 : 0.45}"><h4>★ ${t('ach_' + a.id)}</h4><p>${have ? '✓' : '…'}</p></div>`;
      }).join('');
    }
    body.querySelectorAll('[data-act]').forEach((btn) => {
      btn.onclick = () => {
        const fn = shopActions[btn.getAttribute('data-act')];
        if (fn) fn();
      };
    });
  }

  const shopActions = {};
  let actN = 0;
  function itemCard(title, desc, price, disabled, action, label) {
    const id = 'a' + (++actN);
    if (action) shopActions[id] = action;
    return `<div class="shop-item"><h4>${title}</h4><p>${desc}</p>
      <div class="price">${price}</div>
      <button class="btn small ${action ? 'gold' : 'ghost'}" data-act="${id}" ${action ? '' : 'disabled'}>${label}</button>
    </div>`;
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function buyRecipe(rec) {
    if (state.money < rec.shop) return;
    state.money -= rec.shop;
    state.stats.spent += rec.shop;
    if (!state.recipesUnlocked.includes(rec.id)) state.recipesUnlocked.push(rec.id);
    audio.coin();
    grant('cookbook', Object.keys(RECIPES).every((id) => state.recipesUnlocked.includes(id)));
    save(); renderShop(); renderHud(true);
  }
  function buyUpgrade(up) {
    const lv = state.upgrades[up.id] || 0;
    if (lv >= up.max) return;
    const cost = up.costs[Math.min(lv, up.costs.length - 1)];
    if (state.money < cost) return;
    state.money -= cost;
    state.stats.spent += cost;
    state.upgrades[up.id] = lv + 1;
    applyVisuals();
    audio.coin();
    grant('upgrade', true);
    save(); renderShop(); renderHud(true);
  }
  function buyDecor(d) {
    if (state.decor[d.id] || state.money < d.cost) return;
    state.money -= d.cost;
    state.stats.spent += d.cost;
    state.decor[d.id] = true;
    world.setDecor(d.id, true);
    addRep(2);
    audio.coin();
    save(); renderShop(); renderHud(true);
  }
  function hireStaff(s) {
    if (state.staff[s.id] || state.money < s.hire) return;
    state.money -= s.hire;
    state.stats.spent += s.hire;
    state.staff[s.id] = 1;
    audio.coin();
    grant('hired', true);
    save(); renderShop(); renderHud(true);
  }

  return {
    getState: () => state,
    save,
  };
}
