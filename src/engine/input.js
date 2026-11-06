// Keyboard + gamepad input mapped to abstract actions.
// Edge-triggered presses carry a precise timestamp (performance.now() ms)
// because rhythm and timing events judge presses to the millisecond rather
// than to the nearest frame.

export const ACTIONS = ['left', 'right', 'up', 'down', 'a', 'b', 'start'];

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'a', KeyZ: 'a', KeyJ: 'a',
  KeyX: 'b', Escape: 'b', Backspace: 'b', KeyK: 'b',
  Enter: 'start', NumpadEnter: 'start',
};

const PAD_BUTTONS = { 0: 'a', 1: 'b', 9: 'start', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };

export class Input {
  constructor(target = window) {
    this.held = new Set();
    this.queue = []; // [{action, t}] presses since last frame
    this.pressed = new Map(); // action -> timestamp, for this frame
    this.released = new Set();
    this.relQueue = [];
    this.text = []; // typed characters this frame (for name entry)
    this.textQueue = [];
    this.padPrev = new Set();
    this.anyKey = false;

    target.addEventListener('keydown', (e) => {
      const act = KEYMAP[e.code];
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) this.textQueue.push(e.key);
      if (e.code === 'Backspace') this.textQueue.push('\b');
      if (!act) return;
      e.preventDefault();
      if (e.repeat) return;
      this.press(act, e.timeStamp || performance.now());
    });
    target.addEventListener('keyup', (e) => {
      const act = KEYMAP[e.code];
      if (!act) return;
      e.preventDefault();
      this.release(act);
    });
    target.addEventListener('blur', () => { for (const a of [...this.held]) this.release(a); });
  }

  press(act, t = performance.now()) {
    if (this.held.has(act)) return;
    this.held.add(act);
    this.queue.push({ action: act, t });
  }

  release(act) {
    if (!this.held.has(act)) return;
    this.held.delete(act);
    this.relQueue.push(act);
  }

  pollGamepads() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const now = new Set();
    for (const p of pads) {
      if (!p) continue;
      for (const [i, act] of Object.entries(PAD_BUTTONS)) if (p.buttons[i]?.pressed) now.add(act);
      const [ax, ay] = p.axes;
      if (ax < -0.5) now.add('left');
      if (ax > 0.5) now.add('right');
      if (ay < -0.5) now.add('up');
      if (ay > 0.5) now.add('down');
    }
    for (const a of now) if (!this.padPrev.has(a)) this.press(a);
    for (const a of this.padPrev) if (!now.has(a)) this.release(a);
    this.padPrev = now;
  }

  /** Call once per update tick, before game logic reads input. */
  beginFrame() {
    this.pollGamepads();
    this.pressed.clear();
    this.events = this.queue; // ordered presses with timestamps
    for (const { action, t } of this.queue) if (!this.pressed.has(action)) this.pressed.set(action, t);
    this.queue = [];
    this.released = new Set(this.relQueue);
    this.relQueue = [];
    this.text = this.textQueue;
    this.textQueue = [];
  }

  isDown(a) { return this.held.has(a); }
  wasPressed(a) { return this.pressed.has(a); }
  pressTime(a) { return this.pressed.get(a); }
  wasReleased(a) { return this.released.has(a); }
  /** Confirm = A or START. */
  confirm() { return this.wasPressed('a') || this.wasPressed('start'); }
}
