// SOLMAR — input: keyboard state plus mouse-drag orbit and click-to-shoot.
// All keys are read by name; the game never assumes a layout beyond WASD/arrows.

import { KEYS } from './settings.js';

export function createInput(canvas) {
  const down = new Set();
  const pressed = new Set(); // keys hit since the last frame was consumed
  let orbitDX = 0; // accumulated horizontal mouse drag, consumed by the camera
  let orbitDY = 0;
  let clicked = false; // mouse click since last frame
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function codeOf(e) {
    return e.code;
  }

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    down.add(codeOf(e));
    pressed.add(codeOf(e));
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(codeOf(e))) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => down.delete(codeOf(e)));
  window.addEventListener('blur', () => {
    down.clear();
    dragging = false;
  });

  canvas.addEventListener('mousedown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    clicked = true;
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    orbitDX += e.clientX - lastX;
    orbitDY += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
  });

  return {
    isDown(...codes) {
      return codes.some((c) => down.has(c));
    },
    wasPressed(...codes) {
      return codes.some((c) => pressed.has(c));
    },
    axis(keys) {
      // returns -1, 0 or 1 for a [negative, positive] key pair
      const neg = this.isDown(...keys[0]);
      const pos = this.isDown(...keys[1]);
      return (pos ? 1 : 0) - (neg ? 1 : 0);
    },
    forwardAxis() {
      return this.axis([KEYS.back, KEYS.forward]);
    },
    steerAxis() {
      return this.axis([KEYS.left, KEYS.right]);
    },
    get running() {
      return this.isDown(...KEYS.run);
    },
    takeOrbit() {
      const d = { dx: orbitDX, dy: orbitDY };
      orbitDX = 0;
      orbitDY = 0;
      return d;
    },
    takeClick() {
      const c = clicked;
      clicked = false;
      return c;
    },
    endFrame() {
      pressed.clear();
    },
  };
}
