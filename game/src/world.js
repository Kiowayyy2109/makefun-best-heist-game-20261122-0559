// The Velvet Vault — the simulation. Pure logic, no DOM and no canvas, so
// Node can import it for the logic tests. One fixed step (1/60 s) moves the
// thief, patrols the guards, sweeps the cameras, and grows or shrinks the
// alarm. Everything the renderer draws comes from the state this file owns.
import {
  ALARM_CONTACT_BUMP, ALARM_DECAY, ALARM_MAX, ALARM_PER_ALERTED_GUARD,
  ALARM_PER_CAMERA, ALARM_PER_SUSPICIOUS_GUARD, CAMERA_CONE_HALF,
  CAMERA_RANGE, CAMERA_SWEEP_SPEED, COIN_ATTRACT_RADIUS, COIN_START,
  COIN_THROW_RANGE, GUARD_CHASE_SPEED, GUARD_CONE_HALF, GUARD_CONE_RANGE,
  GUARD_INVESTIGATE_SPEED, GUARD_PAUSE, GUARD_RADIUS, LOCKPICK_SECONDS,
  LOOT_PICKUP_RADIUS, PLAYER_NOISE_RADIUS, PLAYER_RADIUS, PLAYER_RUN,
  PLAYER_SNEAK, PLAYER_WALK, RUN_SUSPICION_MULT, SHADOW_RANGE_MULT,
  SHADOW_SUSPICION_MULT, SMOKE_DURATION, SMOKE_RADIUS, SMOKE_START,
  SNEAK_SUSPICION_MULT, STEP, SUSPICION_ALERT, SUSPICION_DECAY,
  SUSPICION_FAR_RATE, SUSPICION_NEAR_RATE, SUSPICION_WARN,
  TIME_BONUS_PER_SECOND, TILE, EXIT_TRIGGER_RADIUS,
} from './config.js';
import { buildLevel, isShadowPixel, isWallPixel, LEVEL_COUNT } from './levels.js';
import { findPath } from './pathfind.js';

export const EVENT_NONE = 0;
export const EVENT_LOOT = 1;
export const EVENT_COIN = 2;
export const EVENT_SMOKE = 4;
export const EVENT_CAUGHT = 8;
export const EVENT_LEVEL_CLEAR = 16;
export const EVENT_WIN = 32;
export const EVENT_SPOTTED = 64;
export const EVENT_LOCKPICK_DONE = 128;

const TWO_PI = Math.PI * 2;

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TWO_PI;
  while (d < -Math.PI) d += TWO_PI;
  return d;
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/** Line of sight: sample the segment; a wall tile or a smoke cloud blocks it. */
export function canSee(state, x1, y1, x2, y2) {
  const level = state.level;
  const steps = Math.ceil(dist(x1, y1, x2, y2) / 6);
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    if (isWallPixel(level, x, y)) return false;
    for (const smoke of state.smokes) {
      if (smoke.ttl > 0 && dist(x, y, smoke.x, smoke.y) < smoke.r) return false;
    }
  }
  return true;
}

/** Is the thief inside a watcher's cone (range + angle + line of sight)? */
function inCone(state, wx, wy, angle, range, half, tx, ty) {
  const d = dist(wx, wy, tx, ty);
  if (d > range) return false;
  if (d > 4 && Math.abs(angleDiff(Math.atan2(ty - wy, tx - wx), angle)) > half) return false;
  return canSee(state, wx, wy, tx, ty);
}

/** Slide a circle through the walls, axis by axis. Returns the new position. */
function moveCircle(level, x, y, dx, dy, radius) {
  let nx = x + dx;
  if (dx !== 0) {
    const top = Math.floor((y - radius + 0.01) / TILE);
    const bottom = Math.floor((y + radius - 0.01) / TILE);
    const edge = dx > 0 ? Math.floor((nx + radius) / TILE) : Math.floor((nx - radius) / TILE);
    for (let ty = top; ty <= bottom; ty += 1) {
      if (isWallPixel(level, edge * TILE + TILE / 2, ty * TILE + TILE / 2)) {
        nx = dx > 0 ? edge * TILE - radius - 0.01 : (edge + 1) * TILE + radius + 0.01;
        break;
      }
    }
  }
  let ny = y + dy;
  if (dy !== 0) {
    const left = Math.floor((nx - radius + 0.01) / TILE);
    const right = Math.floor((nx + radius - 0.01) / TILE);
    const edge = dy > 0 ? Math.floor((ny + radius) / TILE) : Math.floor((ny - radius) / TILE);
    for (let tx = left; tx <= right; tx += 1) {
      if (isWallPixel(level, tx * TILE + TILE / 2, edge * TILE + TILE / 2)) {
        ny = dy > 0 ? edge * TILE - radius - 0.01 : (edge + 1) * TILE + radius + 0.01;
        break;
      }
    }
  }
  return { x: nx, y: ny };
}

function guardSeesPlayer(state, guard) {
  const player = state.player;
  const inShadow = isShadowPixel(state.level, player.x, player.y);
  const range = GUARD_CONE_RANGE * (inShadow ? SHADOW_RANGE_MULT : 1);
  return inCone(state, guard.x, guard.y, guard.angle, range, GUARD_CONE_HALF, player.x, player.y);
}

function cameraSeesPlayer(state, camera) {
  const player = state.player;
  const inShadow = isShadowPixel(state.level, player.x, player.y);
  const range = CAMERA_RANGE * (inShadow ? SHADOW_RANGE_MULT : 1);
  return inCone(state, camera.x, camera.y, camera.angle, range, CAMERA_CONE_HALF, player.x, player.y);
}

/** Is a tile centre inside any guard or camera cone right now? */
export function tileWatched(state, tx, ty) {
  const x = (tx + 0.5) * TILE;
  const y = (ty + 0.5) * TILE;
  for (const guard of state.guards) {
    const d = dist(guard.x, guard.y, x, y);
    if (d <= GUARD_CONE_RANGE && Math.abs(angleDiff(Math.atan2(y - guard.y, x - guard.x), guard.angle)) <= GUARD_CONE_HALF) {
      if (canSee(state, guard.x, guard.y, x, y)) return true;
    }
  }
  for (const camera of state.cameras) {
    const d = dist(camera.x, camera.y, x, y);
    if (d <= CAMERA_RANGE && Math.abs(angleDiff(Math.atan2(y - camera.y, x - camera.x), camera.angle)) <= CAMERA_CONE_HALF) {
      if (canSee(state, camera.x, camera.y, x, y)) return true;
    }
  }
  return false;
}

export function createWorld(random) {
  const world = {
    random,
    state: null,
    levelIndex: 0,
    totalScore: 0,
    totalTime: 0,
    levelsCleared: 0,
  };

  function resetLevel(index) {
    const level = buildLevel(index);
    const loot = level.loot.map((item) => ({
      ...item,
      value: Math.round((item.value * random.range(0.95, 1.05)) / 5) * 5,
      taken: false,
      sparkle: random.range(0, TWO_PI),
    }));
    const guards = level.guards.map((def, id) => ({
      id,
      x: def.patrol[0].x,
      y: def.patrol[0].y,
      angle: 0,
      speed: def.speed * random.range(0.94, 1.06),
      patrol: def.patrol,
      waypoint: 1,
      pauseLeft: 0,
      suspicion: 0,
      mode: 'patrol',
      target: null,
      path: null,
      pathIndex: 0,
      repathIn: 0,
      lookLeft: 0,
      lastSeen: null,
      unseenFor: 0,
      contactIn: 0,
    }));
    const cameras = level.cameras.map((def) => ({
      ...def,
      baseAngle: def.angle,
      speed: CAMERA_SWEEP_SPEED * random.range(0.85, 1.15),
      phase: random.range(0, TWO_PI),
      seeing: false,
    }));
    world.levelIndex = index;
    world.state = {
      level,
      phase: 'playing',
      time: 0,
      alarm: 0,
      alarmPeak: 0,
      score: 0,
      player: {
        x: level.playerStart.x,
        y: level.playerStart.y,
        angle: -Math.PI / 2,
        moving: false,
        sneaking: false,
        running: false,
        inShadow: false,
      },
      guards,
      cameras,
      loot,
      coins: [],
      smokes: [],
      coinCount: COIN_START,
      smokeCount: SMOKE_START,
      lockpick: null,
      exitOpen: false,
      hint: '',
      flash: '',
      flashLeft: 0,
    };
  }

  function setFlash(state, text, seconds) {
    state.flash = text;
    state.flashLeft = seconds;
  }

  function nearestLoot(state) {
    let best = null;
    let bestD = Infinity;
    for (const item of state.loot) {
      if (item.taken) continue;
      const d = dist(state.player.x, state.player.y, item.x, item.y);
      if (d < bestD) {
        bestD = d;
        best = item;
      }
    }
    return best === null ? null : { item: best, distance: bestD };
  }

  function takeLoot(state, item) {
    item.taken = true;
    state.score += item.value;
    state.coinCount += 1;
    if (item.locked) state.smokeCount += 1;
    setFlash(state, `+${item.value} — ${item.name}`, 1.6);
    if (state.loot.every((entry) => entry.taken)) {
      state.exitOpen = true;
      setFlash(state, 'EXIT OPEN — run for the door!', 2.5);
    }
    return EVENT_LOOT;
  }

  function stepGuard(state, guard, dt) {
    const player = state.player;
    if (guard.contactIn > 0) guard.contactIn -= dt;
    const sees = guardSeesPlayer(state, guard);
    if (sees) {
      guard.lastSeen = { x: player.x, y: player.y };
      guard.unseenFor = 0;
      const d = dist(guard.x, guard.y, player.x, player.y);
      let rate = d < 90 ? SUSPICION_NEAR_RATE : SUSPICION_FAR_RATE;
      if (player.sneaking) rate *= SNEAK_SUSPICION_MULT;
      if (player.running) rate *= RUN_SUSPICION_MULT;
      if (player.inShadow) rate *= SHADOW_SUSPICION_MULT;
      guard.suspicion = clamp(guard.suspicion + rate * dt, 0, 1);
    } else {
      guard.unseenFor += dt;
      guard.suspicion = clamp(guard.suspicion - SUSPICION_DECAY * dt, 0, 1);
      if (player.running && dist(guard.x, guard.y, player.x, player.y) < PLAYER_NOISE_RADIUS) {
        guard.suspicion = clamp(guard.suspicion + 0.15 * dt, 0, 1);
        guard.lastSeen = { x: player.x, y: player.y };
      }
    }

    if (guard.suspicion >= SUSPICION_ALERT && guard.mode !== 'chase') {
      guard.mode = 'chase';
      guard.path = null;
      guard.repathIn = 0;
    } else if (guard.mode === 'chase' && guard.suspicion < SUSPICION_ALERT && guard.unseenFor > 2.5) {
      guard.mode = 'investigate';
      guard.target = guard.lastSeen;
      guard.suspicion = Math.max(guard.suspicion, 0.6);
    } else if (guard.mode === 'patrol' && guard.suspicion >= SUSPICION_WARN) {
      guard.mode = 'investigate';
      guard.target = guard.lastSeen;
    } else if (guard.mode === 'investigate' && guard.suspicion < 0.3 && guard.lookLeft <= 0) {
      guard.mode = 'patrol';
      guard.target = null;
      guard.path = null;
    }

    let speed = 0;
    let tx = guard.x;
    let ty = guard.y;
    if (guard.mode === 'patrol') {
      const goal = guard.patrol[guard.waypoint];
      if (guard.pauseLeft > 0) {
        guard.pauseLeft -= dt;
      } else if (dist(guard.x, guard.y, goal.x, goal.y) < 4) {
        guard.waypoint = (guard.waypoint + 1) % guard.patrol.length;
        guard.pauseLeft = GUARD_PAUSE;
      } else {
        speed = guard.speed;
        tx = goal.x;
        ty = goal.y;
      }
    } else if (guard.mode === 'investigate' && guard.target) {
      if (dist(guard.x, guard.y, guard.target.x, guard.target.y) < 6) {
        if (guard.lookLeft <= 0) guard.lookLeft = 2.5;
        guard.lookLeft -= dt;
        guard.angle += dt * 1.4; // scan the room while looking around
      } else {
        speed = GUARD_INVESTIGATE_SPEED;
        tx = guard.target.x;
        ty = guard.target.y;
      }
    } else if (guard.mode === 'chase') {
      guard.repathIn -= dt;
      const ptx = Math.floor(player.x / TILE);
      const pty = Math.floor(player.y / TILE);
      if (!guard.path || guard.repathIn <= 0) {
        guard.path = findPath(state.level, Math.floor(guard.x / TILE), Math.floor(guard.y / TILE), ptx, pty, true);
        guard.pathIndex = 0;
        guard.repathIn = 0.4;
      }
      const next = guard.path && guard.path[guard.pathIndex];
      if (next) {
        if (dist(guard.x, guard.y, next.x, next.y) < 6) guard.pathIndex += 1;
        else {
          speed = GUARD_CHASE_SPEED;
          tx = next.x;
          ty = next.y;
        }
      } else {
        speed = GUARD_CHASE_SPEED;
        tx = player.x;
        ty = player.y;
      }
    }

    if (speed > 0) {
      const dx = tx - guard.x;
      const dy = ty - guard.y;
      const d = Math.hypot(dx, dy);
      const stepLen = Math.min(speed * dt, d);
      const moved = moveCircle(state.level, guard.x, guard.y, (dx / d) * stepLen, (dy / d) * stepLen, GUARD_RADIUS);
      guard.x = moved.x;
      guard.y = moved.y;
      const want = Math.atan2(dy, dx);
      guard.angle += angleDiff(want, guard.angle) * Math.min(1, dt * 8);
    }

    // Bumping into a guard is the one unfair-looking moment, so it is loud
    // but survivable: a big alarm spike and the guard on your tail.
    if (guard.contactIn <= 0 && dist(guard.x, guard.y, player.x, player.y) < GUARD_RADIUS + PLAYER_RADIUS + 3) {
      guard.contactIn = 1;
      guard.suspicion = 1;
      guard.mode = 'chase';
      state.alarm = clamp(state.alarm + ALARM_CONTACT_BUMP, 0, ALARM_MAX);
      setFlash(state, 'SPOTTED — point blank!', 1.5);
      return EVENT_SPOTTED;
    }
    return EVENT_NONE;
  }

  function step(state, input, dt) {
    if (state.phase !== 'playing') return EVENT_NONE;
    let events = EVENT_NONE;
    state.time += dt;
    if (state.flashLeft > 0) state.flashLeft -= dt;

    // --- the thief ---
    const player = state.player;
    let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0) + (input.moveX || 0);
    let my = (input.down ? 1 : 0) - (input.up ? 1 : 0) + (input.moveY || 0);
    const mag = Math.hypot(mx, my);
    if (mag > 1) {
      mx /= mag;
      my /= mag;
    }
    player.sneaking = !!input.sneak;
    player.running = !!input.run && !player.sneaking;
    const speed = player.sneaking ? PLAYER_SNEAK : player.running ? PLAYER_RUN : PLAYER_WALK;
    const moved = moveCircle(state.level, player.x, player.y, mx * speed * dt, my * speed * dt, PLAYER_RADIUS);
    const actuallyMoved = dist(player.x, player.y, moved.x, moved.y);
    player.x = moved.x;
    player.y = moved.y;
    player.moving = actuallyMoved > 0.01;
    if (player.moving) player.angle = Math.atan2(my, mx);
    player.inShadow = isShadowPixel(state.level, player.x, player.y);

    // --- tools ---
    if (input.coin && state.coinCount > 0) {
      state.coinCount -= 1;
      const fx = Math.cos(player.angle);
      const fy = Math.sin(player.angle);
      let cx = player.x + fx * COIN_THROW_RANGE;
      let cy = player.y + fy * COIN_THROW_RANGE;
      // Slide the landing spot back until it is on open floor.
      for (let i = 0; i < 10 && isWallPixel(state.level, cx, cy); i += 1) {
        cx -= fx * 12;
        cy -= fy * 12;
      }
      state.coins.push({ x: cx, y: cy, ttl: 6 });
      for (const guard of state.guards) {
        if (guard.mode !== 'chase' && dist(guard.x, guard.y, cx, cy) < COIN_ATTRACT_RADIUS) {
          guard.mode = 'investigate';
          guard.target = { x: cx, y: cy };
          guard.suspicion = Math.max(guard.suspicion, 0.6);
          guard.lookLeft = 0;
        }
      }
      events |= EVENT_COIN;
    }
    if (input.smoke && state.smokeCount > 0) {
      state.smokeCount -= 1;
      state.smokes.push({ x: player.x, y: player.y, r: SMOKE_RADIUS, ttl: SMOKE_DURATION });
      events |= EVENT_SMOKE;
    }
    for (const smoke of state.smokes) smoke.ttl -= dt;
    state.smokes = state.smokes.filter((smoke) => smoke.ttl > 0);
    for (const coin of state.coins) coin.ttl -= dt;
    state.coins = state.coins.filter((coin) => coin.ttl > 0);

    // --- loot ---
    const near = nearestLoot(state);
    if (near && near.distance < LOOT_PICKUP_RADIUS) {
      const item = near.item;
      if (item.locked) {
        if (input.interact) {
          if (!state.lockpick || state.lockpick.item !== item) state.lockpick = { item, progress: 0 };
          state.lockpick.progress += dt;
          if (state.lockpick.progress >= LOCKPICK_SECONDS) {
            state.lockpick = null;
            events |= takeLoot(state, item) | EVENT_LOCKPICK_DONE;
          }
        } else {
          state.lockpick = null;
        }
      } else if (input.interactPressed) {
        events |= takeLoot(state, item);
      }
    } else {
      state.lockpick = null;
    }

    // --- guards and cameras ---
    let seenByGuard = false;
    let alertedGuards = 0;
    let suspiciousGuards = 0;
    for (const guard of state.guards) {
      events |= stepGuard(state, guard, dt);
      if (guard.mode === 'chase') alertedGuards += 1;
      else if (guard.mode === 'investigate') suspiciousGuards += 1;
      if (guard.suspicion >= SUSPICION_WARN) seenByGuard = true;
    }
    let seenByCamera = false;
    for (const camera of state.cameras) {
      // The sweep is a sine around the base angle, so cones keep moving
      // even while the thief stands still.
      camera.angle = camera.baseAngle + Math.sin(state.time * camera.speed + camera.phase) * camera.sweep;
      camera.seeing = cameraSeesPlayer(state, camera);
      if (camera.seeing) seenByCamera = true;
    }

    // --- the alarm ---
    let alarmRate = 0;
    alarmRate += alertedGuards * ALARM_PER_ALERTED_GUARD;
    alarmRate += (seenByCamera ? 1 : 0) * ALARM_PER_CAMERA;
    alarmRate += suspiciousGuards * ALARM_PER_SUSPICIOUS_GUARD;
    if (alarmRate > 0) state.alarm = clamp(state.alarm + alarmRate * dt, 0, ALARM_MAX);
    else state.alarm = clamp(state.alarm - ALARM_DECAY * dt, 0, ALARM_MAX);
    state.alarmPeak = Math.max(state.alarmPeak, state.alarm);
    if (state.alarm >= ALARM_MAX) {
      state.phase = 'caught';
      return events | EVENT_CAUGHT;
    }

    // --- the exit ---
    if (state.exitOpen && dist(player.x, player.y, state.level.exit.x, state.level.exit.y) < EXIT_TRIGGER_RADIUS) {
      const bonus = Math.max(0, Math.round(state.level.par - state.time)) * TIME_BONUS_PER_SECOND;
      state.score += bonus;
      world.totalScore += state.score;
      world.totalTime += state.time;
      world.levelsCleared += 1;
      if (world.levelIndex + 1 >= LEVEL_COUNT) {
        state.phase = 'won';
        return events | EVENT_WIN;
      }
      state.phase = 'levelClear';
      return events | EVENT_LEVEL_CLEAR;
    }

    // --- hint line for the HUD ---
    if (state.exitOpen) state.hint = 'Exit is open — run for the door!';
    else if (near && near.distance < LOOT_PICKUP_RADIUS) {
      state.hint = near.item.locked ? 'Hold E — crack the safe' : 'Press E — grab the loot';
    } else if (seenByGuard) state.hint = 'You are being watched — break line of sight!';
    else if (state.alarm > 40) state.hint = 'Alarm is high — stay out of the cones!';
    else if (player.inShadow) state.hint = 'Hidden in shadow — cones can barely see you';
    else state.hint = 'WASD move · Shift sneak · Q coin · F smoke';
    return events;
  }

  /** Title-screen attract mode: cameras sweep and guards patrol, but nobody
   *  watches the thief and the alarm stays asleep. */
  function attract(state, dt) {
    state.time += dt;
    for (const camera of state.cameras) {
      camera.angle = camera.baseAngle + Math.sin(state.time * camera.speed + camera.phase) * camera.sweep;
      camera.seeing = false;
    }
    for (const guard of state.guards) {
      const goal = guard.patrol[guard.waypoint];
      if (guard.pauseLeft > 0) {
        guard.pauseLeft -= dt;
        continue;
      }
      if (dist(guard.x, guard.y, goal.x, goal.y) < 4) {
        guard.waypoint = (guard.waypoint + 1) % guard.patrol.length;
        guard.pauseLeft = GUARD_PAUSE;
        continue;
      }
      const dx = goal.x - guard.x;
      const dy = goal.y - guard.y;
      const d = Math.hypot(dx, dy);
      const stepLen = Math.min(guard.speed * dt, d);
      const moved = moveCircle(state.level, guard.x, guard.y, (dx / d) * stepLen, (dy / d) * stepLen, GUARD_RADIUS);
      guard.x = moved.x;
      guard.y = moved.y;
      guard.angle += angleDiff(Math.atan2(dy, dx), guard.angle) * Math.min(1, dt * 8);
    }
  }

  return {
    world,
    resetLevel,
    step,
    attract,
  };
}
