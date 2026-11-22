// Staged scenes for the entry screenshots. Each shot plays the real rules
// forward from a fresh world with a seeded random, steered by a small
// autopilot (cone-aware BFS to the nearest loot, wait out a sweeping cone,
// hold E on safes), so the frame is what a real game looks like and the
// same seed always gives the same frame. No state is placed by hand:
// the alarm in the cover shot is earned by shadowing a camera cone, the
// chase in the action shot by standing on a guard's patrol path, and the
// getaway by actually stealing every piece in room 3.
import { STEP, TILE, LOOT_PICKUP_RADIUS } from './config.js';
import { tileWatched } from './world.js';
import { findPath } from './pathfind.js';
import { SCREEN_PLAY } from './render.js';

function nearestUntakenLoot(state) {
  let best = null;
  let bestD = Infinity;
  for (const item of state.loot) {
    if (item.taken) continue;
    const d = Math.hypot(state.player.x - item.x, state.player.y - item.y);
    if (d < bestD) {
      bestD = d;
      best = item;
    }
  }
  return best;
}

const ZERO_INPUT = { up: false, down: false, left: false, right: false, sneak: false, run: false, interact: false, interactPressed: false, coin: false, smoke: false, moveX: 0, moveY: 0 };

/**
 * One autopilot step. Returns the input object for this fixed step.
 * `goal` is a tile {tx, ty} to walk to. The pilot re-plans every 30 steps,
 * waits when the next tile is watched, and gives up waiting after a while
 * and walks through — a thief who waits forever never steals anything.
 * A brave pilot walks straight into cones on purpose (for staged shots).
 */
function makePilot(state, brave) {
  let path = null;
  let pathIndex = 0;
  let replanIn = 0;
  let waitLeft = 0;
  let lastGoal = null;
  return function pilot(goal, interactTarget) {
    const player = state.player;
    const ptx = Math.floor(player.x / TILE);
    const pty = Math.floor(player.y / TILE);
    if (!lastGoal || lastGoal.tx !== goal.tx || lastGoal.ty !== goal.ty) {
      path = null;
      lastGoal = goal;
    }
    replanIn -= 1;
    if (!path || replanIn <= 0) {
      path = findPath(state.level, ptx, pty, goal.tx, goal.ty, false, brave ? null : (tx, ty) => (tileWatched(state, tx, ty) ? 10 : 0));
      pathIndex = 0;
      replanIn = 30;
    }
    const input = { ...ZERO_INPUT };
    // Handle the loot right under our nose first.
    if (interactTarget) {
      const d = Math.hypot(player.x - interactTarget.x, player.y - interactTarget.y);
      if (d < LOOT_PICKUP_RADIUS) {
        if (interactTarget.locked) {
          input.interact = true;
          return input; // stand still and crack the safe
        }
        input.interactPressed = true;
        return input;
      }
    }
    if (!path || path.length === 0) return input;
    const next = path[Math.min(pathIndex, path.length - 1)];
    if (Math.hypot(player.x - next.x, player.y - next.y) < 6) {
      pathIndex += 1;
      return input;
    }
    if (!brave) {
      const ntx = Math.floor(next.x / TILE);
      const nty = Math.floor(next.y / TILE);
      if (tileWatched(state, ntx, nty)) {
        if (waitLeft <= 0) waitLeft = 150; // wait up to 2.5 s for the cone to pass
        waitLeft -= 1;
        if (waitLeft > 0) return input; // hold position
      } else {
        waitLeft = 0;
      }
    }
    const dx = next.x - player.x;
    const dy = next.y - player.y;
    const d = Math.hypot(dx, dy);
    input.moveX = dx / d;
    input.moveY = dy / d;
    return input;
  };
}

function tileOf(x, y) {
  return { tx: Math.floor(x / TILE), ty: Math.floor(y / TILE) };
}

function drive(w, maxSeconds, stopWhen) {
  const state = w.world.state;
  const pilot = makePilot(state, false);
  let steps = 0;
  const maxSteps = Math.floor(maxSeconds / STEP);
  while (steps < maxSteps && state.phase === 'playing') {
    const loot = nearestUntakenLoot(state);
    let goal;
    if (loot) goal = tileOf(loot.x, loot.y);
    else goal = tileOf(state.level.exit.x, state.level.exit.y);
    const input = pilot(goal, loot);
    w.step(state, input, STEP);
    steps += 1;
    if (stopWhen && stopWhen(state, steps)) break;
  }
  return { screen: SCREEN_PLAY, best: w.world.totalScore + state.score };
}

/**
 * Stage a named scene and return the screen to draw over it.
 * cover   — room 1, one piece stolen, alarm climbing inside a camera cone.
 * action  — room 2, spotted on a patrol path: a guard chasing, alarm high.
 * getaway — room 3, every piece stolen, exit open, thief nearly out.
 */
export function stageShot(name, w) {
  if (name === 'action') {
    w.resetLevel(1);
    const state = w.world.state;
    const pilot = makePilot(state, false);
    let steps = 0;
    let guardIndex = 0;
    let standLeft = 0;
    let baitIdle = 0;
    // First steal one piece, so the score and the loot counter are real.
    while (steps < 60 / STEP && state.phase === 'playing') {
      const loot = nearestUntakenLoot(state);
      if (state.loot.filter((item) => item.taken).length >= 1) break;
      w.step(state, pilot(tileOf(loot.x, loot.y), loot), STEP);
      steps += 1;
    }
    // Then stand on the next patrol waypoint of a guard: the guard walks
    // straight into the thief, head-on, and the alarm has nowhere to go.
    while (steps < 150 / STEP && state.phase === 'playing') {
      const guard = state.guards[guardIndex % state.guards.length];
      if (guard.mode === 'chase' || state.alarm >= 45) break;
      const waypoint = guard.patrol[guard.waypoint];
      const d = Math.hypot(state.player.x - waypoint.x, state.player.y - waypoint.y);
      let input;
      if (d < 12) {
        if (standLeft <= 0) standLeft = 600; // up to 10 s standing on the path
        standLeft -= 1;
        baitIdle += 1;
        input = { ...ZERO_INPUT };
        if (baitIdle > 600) {
          // This guard never came — try the next one's path.
          guardIndex += 1;
          baitIdle = 0;
          standLeft = 0;
        }
      } else {
        input = pilot(tileOf(waypoint.x, waypoint.y), null);
      }
      w.step(state, input, STEP);
      steps += 1;
    }
    return { screen: SCREEN_PLAY, best: w.world.totalScore + state.score };
  }

  if (name === 'getaway') {
    w.resetLevel(2);
    return drive(w, 170, (state) => {
      if (!state.exitOpen) return false;
      return Math.hypot(state.player.x - state.level.exit.x, state.player.y - state.level.exit.y) < 115;
    });
  }

  // Default: cover — room 1.
  w.resetLevel(0);
  const state = w.world.state;
  const pilot = makePilot(state, false);
  const brave = makePilot(state, true);
  let steps = 0;
  let phase = 'loot';
  let trackLeft = 0;
  while (steps < 40 / STEP && state.phase === 'playing') {
    let input;
    if (phase === 'loot') {
      const loot = nearestUntakenLoot(state);
      if (state.loot.filter((item) => item.taken).length >= 1) {
        phase = 'cone';
      } else {
        input = pilot(tileOf(loot.x, loot.y), loot);
      }
    }
    if (phase === 'cone') {
      // Shadow the first camera's cone: keep walking to the point 90px out
      // along its current angle, so the lens never loses the thief and the
      // alarm climbs steadily instead of flickering with the sweep. Only
      // the time actually spent on the thief's tail counts toward the stop.
      const camera = state.cameras[0];
      const bx = camera.x + Math.cos(camera.angle) * 90;
      const by = camera.y + Math.sin(camera.angle) * 90;
      const nearTarget = Math.hypot(state.player.x - bx, state.player.y - by) < 40;
      if (nearTarget) {
        if (trackLeft <= 0) trackLeft = 480; // up to 8 s shadowing the cone
        trackLeft -= 1;
      }
      input = brave(tileOf(bx, by), null);
      if (state.alarm >= 22) break;
      if (nearTarget && trackLeft <= 0) break;
    }
    w.step(state, input, STEP);
    steps += 1;
  }
  return { screen: SCREEN_PLAY, best: w.world.totalScore + state.score };
}
