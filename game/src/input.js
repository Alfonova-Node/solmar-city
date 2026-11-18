// Keyboard and mouse input. WASD / arrows move, Shift runs, E enters and
// exits cars, F punches, G fires the pistol, Space is the handbrake, Enter
// confirms on menus, Esc / P pauses. Mouse drag orbits the camera, the wheel
// zooms. Actions are edge-triggered and consumed once per frame.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_FIRE = 16;

const KEYMAP = {
  Enter: ACTION_CONFIRM,
  Space: ACTION_CONFIRM,
  Escape: ACTION_PAUSE,
  KeyP: ACTION_PAUSE,
  KeyE: ACTION_ENTER,
  KeyF: ACTION_PUNCH,
  KeyG: ACTION_FIRE,
};

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let dragDx = 0;
  let dragDy = 0;
  let wheel = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    const action = KEYMAP[event.code];
    if (action) {
      actions |= action;
      if (event.code === 'Space') event.preventDefault();
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onMouseDown(event) {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
  }

  function onMouseMove(event) {
    if (!dragging) return;
    dragDx += event.clientX - lastX;
    dragDy += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  }

  function onMouseUp() {
    dragging = false;
  }

  function onWheel(event) {
    wheel += event.deltaY;
    event.preventDefault();
  }

  function onBlur() {
    keys.clear();
    dragging = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('blur', onBlur);

  // Movement axes, -1..1: forward is W / Up, right is D / Right.
  function move() {
    const f =
      (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) -
      (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    const r =
      (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) -
      (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    return { forward: f, right: r };
  }

  function run() {
    return keys.has('ShiftLeft') || keys.has('ShiftRight');
  }

  function handbrake() {
    return keys.has('Space');
  }

  function takeActions() {
    const taken = actions;
    actions = 0;
    return taken;
  }

  function takeDrag() {
    const taken = { dx: dragDx, dy: dragDy, wheel };
    dragDx = 0;
    dragDy = 0;
    wheel = 0;
    return taken;
  }

  return { move, run, handbrake, takeActions, takeDrag };
}
