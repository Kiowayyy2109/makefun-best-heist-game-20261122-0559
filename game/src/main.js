// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens:
// title, play, paused, level clear, caught and won.
//
// ?seed=N fixes the room variation. ?shot=cover|action|getaway (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot. window.__heist exposes the
// live state so a headless browser can play-test the game.
import { BEST_KEY, STEP, TILE } from './config.js';
import { createRandom } from './random.js';
import { validateLevels } from './levels.js';
import { createWorld, tileWatched, EVENT_CAUGHT, EVENT_COIN, EVENT_LEVEL_CLEAR, EVENT_LOCKPICK_DONE, EVENT_LOOT, EVENT_SMOKE, EVENT_SPOTTED, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_CAUGHT, SCREEN_LEVEL_CLEAR, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WON, screenToWorld } from './render.js';
import { stageShot } from './shots.js';
import { findPath } from './pathfind.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const levelProblems = validateLevels();
if (levelProblems.length > 0) console.error('Unplayable level:', levelProblems.join(' | '));
const w = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best haul then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, w);
  const state = w.world.state;
  window.__shotInfo = {
    shot: name,
    screen: scene.screen,
    phase: state.phase,
    alarm: Math.round(state.alarm * 10) / 10,
    lootTaken: state.loot.filter((item) => item.taken).length,
    lootTotal: state.loot.length,
    exitOpen: state.exitOpen,
    guardModes: state.guards.map((guard) => guard.mode),
    player: { x: Math.round(state.player.x), y: Math.round(state.player.y) },
    score: state.score,
  };
  const ui = uiFor();
  let painted = 0;
  function paint() {
    renderer.draw(w.world.state, scene.screen, ui);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function uiFor() {
  const state = w.world.state;
  return {
    levelIndex: w.world.levelIndex,
    levelName: state ? state.level.name : '',
    briefing: state ? state.level.briefing : '',
    totalScore: w.world.totalScore,
    totalTime: w.world.totalTime,
    best: readBest(),
    muted: audio.muted,
  };
}

function runGame() {
  const input = createInput(canvas, screenToWorld);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let clickPath = null;
  let clickIndex = 0;
  let stepSoundIn = 0;
  let alarmBeeping = false;

  w.resetLevel(0);

  function announce(message) {
    status.textContent = message;
  }

  function startRun() {
    w.world.totalScore = 0;
    w.world.totalTime = 0;
    w.world.levelsCleared = 0;
    w.resetLevel(0);
    screen = SCREEN_PLAY;
    clickPath = null;
    announce('Playing. Steal everything, then reach the exit.');
  }

  function retryRoom() {
    w.resetLevel(w.world.levelIndex);
    screen = SCREEN_PLAY;
    clickPath = null;
    announce('Playing. Steal everything, then reach the exit.');
  }

  function nextRoom() {
    w.resetLevel(w.world.levelIndex + 1);
    screen = SCREEN_PLAY;
    clickPath = null;
    announce(`Playing. ${w.world.state.level.name}.`);
  }

  function finishRun() {
    if (w.world.totalScore > best) {
      best = w.world.totalScore;
      saveBest(best);
    }
  }

  function handleEvents(events) {
    if (events & EVENT_LOOT) audio.pickup();
    if (events & EVENT_COIN) audio.coin();
    if (events & EVENT_SMOKE) audio.smoke();
    if (events & EVENT_LOCKPICK_DONE) audio.lockpickTick();
    if (events & EVENT_SPOTTED) {
      audio.spotted();
      announce('Spotted! Break line of sight!');
    }
    if (events & EVENT_LEVEL_CLEAR) {
      audio.levelClear();
      screen = SCREEN_LEVEL_CLEAR;
      announce(`Room cleared. Haul $${w.world.state.score}. Press Enter for the next room.`);
    }
    if (events & EVENT_CAUGHT) {
      audio.caught();
      audio.stopAlarm();
      alarmBeeping = false;
      finishRun();
      screen = SCREEN_CAUGHT;
      announce('Caught! The alarm hit 100 percent. Press R to try again.');
    }
    if (events & EVENT_WIN) {
      audio.win();
      audio.stopAlarm();
      alarmBeeping = false;
      finishRun();
      screen = SCREEN_WON;
      announce(`The vault is yours. Total haul $${w.world.totalScore}. Press R to run it back.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_RESTART) {
      audio.unlock();
      if (screen === SCREEN_TITLE) startRun();
      else if (screen === SCREEN_WON) startRun();
      else retryRoom();
      return;
    }
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE) startRun();
      else if (screen === SCREEN_LEVEL_CLEAR) nextRoom();
      else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function step() {
    const state = w.world.state;
    if (screen === SCREEN_TITLE) {
      w.attract(state, STEP);
      return;
    }
    const keys = input.read();
    // Click-to-move: follow the path unless the keys take over.
    const target = input.takeClickTarget();
    if (target) {
      // Click-to-move routes around the cones where it can, like a thief
      // who looks before crossing — the same cost the autopilot uses.
      const path = findPath(state.level,
        Math.floor(state.player.x / TILE), Math.floor(state.player.y / TILE),
        Math.floor(target.x / TILE), Math.floor(target.y / TILE), false,
        (tx, ty) => (tileWatched(state, tx, ty) ? 10 : 0));
      clickPath = path;
      clickIndex = 0;
    }
    if (keys.up || keys.down || keys.left || keys.right) clickPath = null;
    if (clickPath && clickIndex < clickPath.length) {
      const next = clickPath[clickIndex];
      if (Math.hypot(state.player.x - next.x, state.player.y - next.y) < 6) {
        clickIndex += 1;
      } else {
        const dx = next.x - state.player.x;
        const dy = next.y - state.player.y;
        const d = Math.hypot(dx, dy);
        keys.moveX = dx / d;
        keys.moveY = dy / d;
      }
    }
    const events = w.step(state, keys, STEP);
    if (state.player.moving && state.player.sneaking) {
      stepSoundIn -= STEP;
      if (stepSoundIn <= 0) {
        audio.step();
        stepSoundIn = 0.35;
      }
    }
    if (state.alarm >= 40 && !alarmBeeping) {
      audio.startAlarm();
      alarmBeeping = true;
    } else if (state.alarm < 30 && alarmBeeping) {
      audio.stopAlarm();
      alarmBeeping = false;
    }
    if (alarmBeeping) audio.setAlarmInterval(900 - state.alarm * 6);
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(w.world.state, screen, uiFor());
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });
  window.addEventListener('blur', () => input.clear());
  canvas.addEventListener('pointerdown', () => audio.unlock());

  // A handle for headless play-tests: read the live state from the page.
  window.__heist = {
    get state() {
      return w.world.state;
    },
    get screen() {
      return screen;
    },
    get totalScore() {
      return w.world.totalScore;
    },
    version: 1,
  };

  announce('The Velvet Vault. Press Enter to begin the heist.');
  requestAnimationFrame(frame);
}

if (shot) {
  w.resetLevel(0);
  runShot(shot);
} else {
  runGame();
}
