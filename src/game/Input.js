// Keyboard, gamepad and touch input merged into a single driving input.

const DRIVE_KEYS = {
  throttle: ['KeyW', 'ArrowUp'],
  brake: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  handbrake: ['Space'],
  boost: ['ShiftLeft', 'ShiftRight', 'KeyN'],
};

const ACTION_KEYS = {
  KeyC: 'camera',
  KeyR: 'reset',
  Escape: 'pause',
  KeyP: 'pause',
  KeyM: 'mute',
  Enter: 'confirm',
};

const CAPTURED = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
]);

export class Input {
  constructor() {
    this.down = new Set();
    this.actions = [];
    this.capture = false; // prevent page scrolling while racing
    this.touch = { throttle: false, brake: false, left: false, right: false, handbrake: false, boost: false };
    this.prevPad = [];
    this.lastDevice = 'keyboard';

    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (this.capture && CAPTURED.has(e.code)) e.preventDefault();
      if (!e.repeat && ACTION_KEYS[e.code]) this.actions.push(ACTION_KEYS[e.code]);
      this.down.add(e.code);
      this.lastDevice = 'keyboard';
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.down.clear();
      for (const k in this.touch) this.touch[k] = false;
    });
  }

  key(name) {
    const codes = DRIVE_KEYS[name];
    for (let i = 0; i < codes.length; i++) if (this.down.has(codes[i])) return true;
    return false;
  }

  /** Wire up on-screen buttons: elements with data-control / data-action. */
  bindTouch(root) {
    const controls = root.querySelectorAll('[data-control]');
    controls.forEach((el) => {
      const name = el.dataset.control;
      const pointers = new Set();
      const set = () => {
        this.touch[name] = pointers.size > 0;
        el.classList.toggle('active', pointers.size > 0);
      };
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        pointers.add(e.pointerId);
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        this.lastDevice = 'touch';
        set();
      });
      const release = (e) => {
        pointers.delete(e.pointerId);
        set();
      };
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('lostpointercapture', release);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    });
    root.querySelectorAll('[data-action]').forEach((el) => {
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.actions.push(el.dataset.action);
      });
    });
  }

  _pad() {
    if (!navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }

  /** Returns the merged driving input. Also queues gamepad button actions. */
  poll() {
    let throttle = this.key('throttle') || this.touch.throttle ? 1 : 0;
    let brake = this.key('brake') || this.touch.brake ? 1 : 0;
    let steer = (this.key('right') || this.touch.right ? 1 : 0) - (this.key('left') || this.touch.left ? 1 : 0);
    let handbrake = this.key('handbrake') || this.touch.handbrake;
    let boost = this.key('boost') || this.touch.boost;
    let analog = false;

    const pad = this._pad();
    if (pad) {
      const b = (i) => (pad.buttons[i] ? pad.buttons[i].value || (pad.buttons[i].pressed ? 1 : 0) : 0);
      const pressed = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
      let ax = pad.axes[0] || 0;
      if (Math.abs(ax) < 0.12) ax = 0;
      else ax = Math.sign(ax) * ((Math.abs(ax) - 0.12) / 0.88);
      const rt = b(7);
      const lt = b(6);
      const dpad = (pressed(15) ? 1 : 0) - (pressed(14) ? 1 : 0);
      if (ax !== 0 || rt > 0.05 || lt > 0.05 || pressed(0) || pressed(2) || dpad !== 0) this.lastDevice = 'gamepad';
      if (ax !== 0) {
        steer = ax;
        analog = true;
      } else if (dpad !== 0) steer = dpad;
      throttle = Math.max(throttle, rt, pressed(12) ? 1 : 0);
      brake = Math.max(brake, lt, pressed(13) ? 1 : 0);
      handbrake = handbrake || pressed(0) || pressed(5);
      boost = boost || pressed(2) || pressed(1) || pressed(4);
      const edges = [
        [3, 'camera'],
        [9, 'pause'],
        [8, 'reset'],
      ];
      for (const [i, action] of edges) {
        const now = pressed(i);
        if (now && !this.prevPad[i]) this.actions.push(action);
        this.prevPad[i] = now;
      }
      // A on menus = confirm
      const a = pressed(0);
      if (a && !this.prevPad[0]) this.actions.push('pad-a');
      this.prevPad[0] = a;
    }
    return { throttle, brake, steer, handbrake, boost, analog };
  }

  consumeActions() {
    const a = this.actions;
    this.actions = [];
    return a;
  }
}
