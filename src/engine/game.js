// Core loop: fixed 60Hz update, render to a low-res canvas that is scaled up
// with nearest-neighbour filtering.
import { Input } from './input.js';
import { W, H } from './gfx.js';
import { unlockAudio } from './audio.js';

export class Scene {
  constructor(game) { this.game = game; }
  enter() {}
  exit() {}
  /** @param {number} dt seconds @param {Input} input */
  update(dt, input) {}
  draw(ctx) {}
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    canvas.width = W;
    canvas.height = H;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.input = new Input(window);
    this.scene = null;
    this.time = 0; // seconds since start
    this.step = 1 / 60;
    this.acc = 0;
    this.last = performance.now();
    this.frameStart = this.last; // performance.now() at the start of the current update
    window.addEventListener('keydown', unlockAudio, { once: false });
    window.addEventListener('pointerdown', unlockAudio);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    // Largest integer scale that fits, falling back to fractional on tiny screens
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    const scale = s >= 1 ? Math.floor(s) : s;
    this.canvas.style.width = `${W * scale}px`;
    this.canvas.style.height = `${H * scale}px`;
  }

  setScene(scene) {
    if (this.scene) this.scene.exit();
    this.scene = scene;
    scene.enter();
  }

  /** Current time in ms, comparable with input press timestamps. */
  now() { return performance.now(); }

  start() {
    const tick = (t) => {
      let frame = (t - this.last) / 1000;
      this.last = t;
      if (frame > 0.25) frame = 0.25; // tab was hidden
      this.acc += frame;
      while (this.acc >= this.step) {
        this.frameStart = performance.now();
        this.input.beginFrame();
        this.time += this.step;
        this.scene?.update(this.step, this.input);
        this.acc -= this.step;
      }
      this.ctx.imageSmoothingEnabled = false;
      this.scene?.draw(this.ctx);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}
