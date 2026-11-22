// Breadth-first paths over the tile grid. The autopilot (shots.js) and the
// chasing guards both steer with this: it returns a list of pixel waypoints
// from a start tile to a goal tile, or null when no route exists. An optional
// extraCost callback lets a caller price tiles — the autopilot charges extra
// for tiles inside a vision cone, so it routes around danger when it can.
import { COLS, ROWS, TILE } from './config.js';
import { isWalkable } from './levels.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * Find a path from tile (sx, sy) to tile (gx, gy). Waypoints are pixel
 * centres, start tile excluded, goal tile included. `forGuard` keeps guards
 * out of the vents. `extraCost(tx, ty)` adds a penalty (BFS with a small
 * bucketed Dijkstra: costs are integers, so a simple queue still works when
 * the penalty is applied by re-queuing — here we run Dijkstra over the grid
 * with a plain array priority queue, cheap at 32x18).
 */
export function findPath(level, sx, sy, gx, gy, forGuard, extraCost) {
  if (!isWalkable(level, sx, sy, forGuard)) return null;
  if (!isWalkable(level, gx, gy, forGuard)) return null;
  if (sx === gx && sy === gy) return [];
  const size = COLS * ROWS;
  const cost = new Float64Array(size).fill(Infinity);
  const prev = new Int32Array(size).fill(-1);
  const start = sy * COLS + sx;
  const goal = gy * COLS + gx;
  cost[start] = 0;
  // Tiny open list: linear scan is fine on a 576-cell grid.
  const open = [start];
  while (open.length > 0) {
    let bestIndex = 0;
    for (let i = 1; i < open.length; i += 1) {
      if (cost[open[i]] < cost[open[bestIndex]]) bestIndex = i;
    }
    const current = open.splice(bestIndex, 1)[0];
    if (current === goal) break;
    const cx = current % COLS;
    const cy = Math.floor(current / COLS);
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!isWalkable(level, nx, ny, forGuard)) continue;
      const penalty = extraCost ? extraCost(nx, ny) : 0;
      const nextCost = cost[current] + 1 + penalty;
      const next = ny * COLS + nx;
      if (nextCost < cost[next]) {
        cost[next] = nextCost;
        prev[next] = current;
        open.push(next);
      }
    }
  }
  if (!Number.isFinite(cost[goal])) return null;
  const tiles = [];
  let node = goal;
  while (node !== start && node !== -1) {
    tiles.push({ tx: node % COLS, ty: Math.floor(node / COLS) });
    node = prev[node];
  }
  tiles.reverse();
  return tiles.map((tile) => ({ x: (tile.tx + 0.5) * TILE, y: (tile.ty + 0.5) * TILE }));
}
