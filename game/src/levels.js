// The three rooms of The Velvet Vault. Each level is built from rectangles
// on a 32 x 18 tile grid (tile = 40px, so the whole room fits one 1280x720
// frame): walls, shadow patches where the thief is harder to spot, brass
// vents only the thief can slip through, loot, guard patrols, cameras,
// the thief's start and the exit. Nothing here draws or steps the game;
// buildLevel() turns a definition into the grid the world and renderer use.
import { COLS, ROWS, TILE } from './config.js';

export const TILE_FLOOR = 0;
export const TILE_WALL = 1;
export const TILE_SHADOW = 2;
export const TILE_VENT = 3;

const LEVELS = [
  {
    name: 'The Velvet Gallery',
    par: 150,
    briefing: 'Lift all four pieces from the gallery, then slip out the east door. The guards walk slow loops — read their cones before you cross.',
    walls: [
      [10, 1, 1, 3], [10, 5, 1, 3],
      [21, 1, 1, 4], [21, 6, 1, 2],
      [1, 8, 4, 1], [6, 8, 19, 1], [26, 8, 5, 1],
      [10, 9, 1, 3], [10, 13, 1, 4],
      [21, 9, 1, 4], [21, 14, 1, 3],
    ],
    shadows: [[2, 1, 3, 2], [26, 2, 3, 2], [14, 10, 3, 2], [5, 14, 2, 2], [27, 14, 2, 2]],
    vents: [[15, 8, 2, 1]],
    loot: [
      { tile: [14, 2], name: 'Sunset Canvas', value: 300, locked: false },
      { tile: [27, 6], name: 'Jade Idol', value: 300, locked: false },
      { tile: [6, 10], name: 'Emerald Tiara', value: 400, locked: true },
      { tile: [17, 14], name: 'Gold Bust', value: 300, locked: false },
    ],
    guards: [
      { patrol: [[12, 3], [19, 3], [19, 6], [12, 6]], speed: 62 },
      { patrol: [[3, 10], [8, 10], [8, 15], [3, 15]], speed: 62 },
    ],
    cameras: [
      { tile: [20, 1], angle: Math.PI / 2, sweep: 0.9 },
      { tile: [22, 16], angle: -Math.PI / 2, sweep: 0.8 },
    ],
    player: [2, 2],
    exit: [29, 15],
  },
  {
    name: 'The Vault Floor',
    par: 210,
    briefing: 'Two crown pieces sit inside the vault itself, behind a locked door a camera watches. The middle floor is patrolled by three guards — spend coins to pull them away.',
    walls: [
      [8, 1, 1, 2], [8, 4, 1, 8], [8, 13, 1, 4],
      [16, 1, 1, 3], [16, 5, 1, 3],
      [16, 10, 1, 3], [16, 14, 1, 3],
      [24, 1, 1, 5], [24, 7, 1, 7], [24, 15, 1, 2],
      [17, 8, 3, 1], [21, 8, 4, 1],
      [17, 13, 8, 1],
      [17, 9, 1, 4],
    ],
    shadows: [[2, 5, 3, 2], [12, 2, 3, 2], [27, 3, 3, 2], [10, 14, 3, 2], [27, 14, 2, 2], [19, 14, 2, 2]],
    vents: [[8, 8, 1, 2]],
    loot: [
      { tile: [5, 5], name: 'Silver Chalice', value: 300, locked: false },
      { tile: [12, 14], name: 'Ruby Brooch', value: 300, locked: false },
      { tile: [19, 10], name: 'Crown of Vell', value: 800, locked: true },
      { tile: [22, 10], name: 'Sceptre of Vell', value: 800, locked: true },
      { tile: [28, 15], name: 'Pearl String', value: 400, locked: false },
    ],
    guards: [
      { patrol: [[10, 3], [14, 3], [14, 6], [10, 6]], speed: 68 },
      { patrol: [[18, 4], [22, 4], [22, 7], [18, 7]], speed: 68 },
      { patrol: [[9, 14], [15, 14], [15, 16], [9, 16]], speed: 68 },
    ],
    cameras: [
      { tile: [20, 7], angle: Math.PI / 2, sweep: 0.7 },
      { tile: [27, 1], angle: Math.PI * 0.75, sweep: 0.6 },
      { tile: [12, 16], angle: -Math.PI / 2, sweep: 0.8 },
    ],
    player: [2, 2],
    exit: [29, 2],
  },
  {
    name: 'The Rooftop Escape',
    par: 240,
    briefing: 'The roof is wide open — no walls to hide behind, only shadows and vent grates. Grab the last four pieces and reach the helipad before the patrols close in.',
    walls: [
      [8, 4, 3, 2], [20, 5, 3, 2], [12, 11, 3, 2], [24, 12, 2, 3], [5, 9, 2, 2],
    ],
    shadows: [[3, 3, 3, 2], [17, 2, 3, 2], [26, 4, 3, 2], [6, 13, 3, 2], [18, 14, 3, 2]],
    vents: [[10, 7, 4, 1], [22, 9, 4, 1]],
    loot: [
      { tile: [8, 3], name: 'Velvet Satchel', value: 400, locked: false },
      { tile: [16, 8], name: 'Star Sapphire', value: 500, locked: true },
      { tile: [23, 12], name: 'Ivory Fan', value: 400, locked: false },
      { tile: [28, 6], name: 'Moon Opal', value: 500, locked: true },
    ],
    guards: [
      { patrol: [[6, 5], [14, 5], [14, 8], [6, 8]], speed: 78 },
      { patrol: [[18, 4], [26, 4], [26, 10], [18, 10]], speed: 78 },
      { patrol: [[4, 13], [12, 13], [12, 16], [4, 16]], speed: 78 },
    ],
    cameras: [
      { tile: [15, 1], angle: Math.PI / 2, sweep: 0.9 },
      { tile: [29, 9], angle: Math.PI, sweep: 0.7 },
      { tile: [10, 16], angle: -Math.PI / 2, sweep: 0.8 },
    ],
    player: [2, 15],
    exit: [29, 2],
  },
];

export const LEVEL_COUNT = LEVELS.length;

/** Centre of a tile in pixels. */
export function tileCenter(tile) {
  return { x: (tile[0] + 0.5) * TILE, y: (tile[1] + 0.5) * TILE };
}

function paintRect(grid, rect, value) {
  const [x, y, w, h] = rect;
  for (let ty = y; ty < y + h; ty += 1) {
    for (let tx = x; tx < x + w; tx += 1) {
      if (tx >= 0 && tx < COLS && ty >= 0 && ty < ROWS) grid[ty * COLS + tx] = value;
    }
  }
}

/** Build a level definition into a grid plus entity lists. Pure data, no DOM. */
export function buildLevel(index) {
  const def = LEVELS[index % LEVELS.length];
  const grid = new Uint8Array(COLS * ROWS);
  // Border walls.
  paintRect(grid, [0, 0, COLS, 1], TILE_WALL);
  paintRect(grid, [0, ROWS - 1, COLS, 1], TILE_WALL);
  paintRect(grid, [0, 0, 1, ROWS], TILE_WALL);
  paintRect(grid, [COLS - 1, 0, 1, ROWS], TILE_WALL);
  for (const rect of def.walls) paintRect(grid, rect, TILE_WALL);
  for (const rect of def.shadows) paintRect(grid, rect, TILE_SHADOW);
  for (const rect of def.vents) paintRect(grid, rect, TILE_VENT);
  return {
    index,
    name: def.name,
    par: def.par,
    briefing: def.briefing,
    grid,
    loot: def.loot.map((item) => ({ ...item, x: (item.tile[0] + 0.5) * TILE, y: (item.tile[1] + 0.5) * TILE })),
    guards: def.guards.map((guard) => ({
      speed: guard.speed,
      patrol: guard.patrol.map((tile) => ({ x: (tile[0] + 0.5) * TILE, y: (tile[1] + 0.5) * TILE })),
    })),
    cameras: def.cameras.map((camera) => {
      const centre = tileCenter(camera.tile);
      return { x: centre.x, y: centre.y, angle: camera.angle, sweep: camera.sweep };
    }),
    playerStart: tileCenter(def.player),
    exit: tileCenter(def.exit),
  };
}

/** Tile kind at tile coordinates; outside the grid counts as wall. */
export function tileAt(level, tx, ty) {
  if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return TILE_WALL;
  return level.grid[ty * COLS + tx];
}

/** Whether a tile can be walked on. Guards are too big for the vents. */
export function isWalkable(level, tx, ty, forGuard) {
  const tile = tileAt(level, tx, ty);
  if (tile === TILE_WALL) return false;
  if (forGuard && tile === TILE_VENT) return false;
  return true;
}

/** Whether a pixel point is inside a wall tile. */
export function isWallPixel(level, x, y) {
  return tileAt(level, Math.floor(x / TILE), Math.floor(y / TILE)) === TILE_WALL;
}

/** Whether a pixel point is inside a shadow tile. */
export function isShadowPixel(level, x, y) {
  return tileAt(level, Math.floor(x / TILE), Math.floor(y / TILE)) === TILE_SHADOW;
}

/** Whether a pixel point is inside a vent tile. */
export function isVentPixel(level, x, y) {
  return tileAt(level, Math.floor(x / TILE), Math.floor(y / TILE)) === TILE_VENT;
}

/** Small flood fill over walkable tiles, used by the validator below. */
function reachableTiles(level, startTx, startTy, forGuard) {
  const seen = new Set([`${startTx},${startTy}`]);
  const queue = [[startTx, startTy]];
  while (queue.length > 0) {
    const [cx, cy] = queue.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      const key = `${nx},${ny}`;
      if (!seen.has(key) && isWalkable(level, nx, ny, forGuard)) {
        seen.add(key);
        queue.push([nx, ny]);
      }
    }
  }
  return seen;
}

/**
 * Fail-fast check every level must pass before the game starts: a walled
 * border, a walkable start and exit, every loot reachable on foot, every
 * guard patrol waypoint reachable by a guard, every camera on open floor.
 * Returns a list of problems (empty when the level is playable).
 */
export function validateLevels() {
  const problems = [];
  for (let index = 0; index < LEVELS.length; index += 1) {
    const level = buildLevel(index);
    const tag = `level ${index} (${level.name})`;
    for (let tx = 0; tx < COLS; tx += 1) {
      if (tileAt(level, tx, 0) !== TILE_WALL || tileAt(level, tx, ROWS - 1) !== TILE_WALL) {
        problems.push(`${tag}: border wall missing on row edge at x=${tx}`);
      }
    }
    const start = { tx: Math.floor(level.playerStart.x / TILE), ty: Math.floor(level.playerStart.y / TILE) };
    const exit = { tx: Math.floor(level.exit.x / TILE), ty: Math.floor(level.exit.y / TILE) };
    if (!isWalkable(level, start.tx, start.ty, false)) problems.push(`${tag}: player start is not walkable`);
    if (!isWalkable(level, exit.tx, exit.ty, false)) problems.push(`${tag}: exit is not walkable`);
    const onFoot = reachableTiles(level, start.tx, start.ty, false);
    for (const item of level.loot) {
      const tx = Math.floor(item.x / TILE);
      const ty = Math.floor(item.y / TILE);
      if (!onFoot.has(`${tx},${ty}`)) problems.push(`${tag}: loot ${item.name} is unreachable`);
    }
    if (!onFoot.has(`${exit.tx},${exit.ty}`)) problems.push(`${tag}: exit is unreachable`);
    for (const guard of level.guards) {
      const first = guard.patrol[0];
      const gx = Math.floor(first.x / TILE);
      const gy = Math.floor(first.y / TILE);
      const byGuard = reachableTiles(level, gx, gy, true);
      for (const point of guard.patrol) {
        const tx = Math.floor(point.x / TILE);
        const ty = Math.floor(point.y / TILE);
        if (!byGuard.has(`${tx},${ty}`)) problems.push(`${tag}: guard patrol point (${tx},${ty}) is unreachable`);
      }
    }
    for (const camera of level.cameras) {
      const tx = Math.floor(camera.x / TILE);
      const ty = Math.floor(camera.y / TILE);
      if (!isWalkable(level, tx, ty, false)) problems.push(`${tag}: camera at (${tx},${ty}) is not on open floor`);
    }
  }
  return problems;
}
