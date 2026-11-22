// Keyboard + mouse for The Velvet Vault. The game reads a plain input
// object every fixed step: held directions, sneak/run, and edge-triggered
// actions (interact pressed this step, coin thrown, smoke dropped, confirm,
// pause, restart, mute). Click-to-move sets a tile target the world follows
// until a key is pressed. Nothing here knows about the world or the canvas
// beyond converting a click into tile coordinates.
import { COLS, ROWS, TILE, VIEW_W, VIEW_H } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;

const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ShiftLeft: 'sneak', ShiftRight: 'sneak',
  Space: 'run',
  KeyE: 'interact',
  KeyQ: 'coin',
  KeyF: 'smoke',
  Enter: 'confirm', NumpadEnter: 'confirm',
  KeyP: 'pause', Escape: 'pause',
  KeyR: 'restart',
  KeyM: 'mute',
};

/**
 * Attach listeners to the window/canvas. Returns the live input object plus
 * takeActions() (edge-triggered actions since the last call) and a click
 * target in world pixels, or null.
 */
export function createInput(canvas, toWorld) {
  const held = new Set();
  const pressed = new Set();
  let clickTarget = null;

  function onKeyDown(event) {
    const name = KEYMAP[event.code];
    if (!name) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    if (!event.repeat) pressed.add(name);
    held.add(name);
    if (name === 'up' || name === 'down' || name === 'left' || name === 'right') clickTarget = null;
  }

  function onKeyUp(event) {
    const name = KEYMAP[event.code];
    if (name) held.delete(name);
  }

  function onClick(event) {
    const rect = canvas.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * VIEW_W;
    const py = ((event.clientY - rect.top) / rect.height) * VIEW_H;
    const world = toWorld ? toWorld(px, py) : { x: px, y: py };
    const tx = Math.floor(world.x / TILE);
    const ty = Math.floor(world.y / TILE);
    if (tx >= 0 && tx < COLS && ty >= 0 && ty < ROWS) clickTarget = { x: world.x, y: world.y };
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** Held movement + modifiers, as the world step reads them. Edge flags
     *  (interact, coin, smoke) are consumed by this call: each fixed step
     *  sees a press exactly once. */
    read() {
      const snapshot = {
        up: held.has('up'),
        down: held.has('down'),
        left: held.has('left'),
        right: held.has('right'),
        sneak: held.has('sneak'),
        run: held.has('run'),
        interact: held.has('interact'),
        interactPressed: pressed.has('interact'),
        coin: pressed.has('coin'),
        smoke: pressed.has('smoke'),
        moveX: 0,
        moveY: 0,
      };
      pressed.delete('interact');
      pressed.delete('coin');
      pressed.delete('smoke');
      return snapshot;
    },
    /** Edge-triggered actions since the last call. Only the screen actions
     *  are cleared here — the gameplay edges belong to read(). */
    takeActions() {
      let actions = 0;
      if (pressed.has('confirm')) actions |= ACTION_CONFIRM;
      if (pressed.has('pause')) actions |= ACTION_PAUSE;
      if (pressed.has('restart')) actions |= ACTION_RESTART;
      if (pressed.has('mute')) actions |= ACTION_MUTE;
      pressed.delete('confirm');
      pressed.delete('pause');
      pressed.delete('restart');
      pressed.delete('mute');
      return actions;
    },
    /** Click-to-move target in world pixels, or null. */
    takeClickTarget() {
      const target = clickTarget;
      clickTarget = null;
      return target;
    },
    /** Forget held keys (used when the tab loses focus mid-game). */
    clear() {
      held.clear();
      pressed.clear();
      clickTarget = null;
    },
  };
}
