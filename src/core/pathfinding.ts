import { tileKey, type GridPoint } from './types.ts';

/** Returns true when a unit may stand on / walk through the tile. Must return false outside the map. */
export type Passable = (x: number, y: number) => boolean;

const NEIGHBOURS: readonly GridPoint[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

interface OpenNode {
  readonly point: GridPoint;
  readonly g: number;
  readonly f: number;
  readonly order: number;
}

/**
 * Four-directional A* search. Returns the tiles from `start` to `goal`
 * (both inclusive), or null when the goal cannot be reached.
 */
export function findPath(start: GridPoint, goal: GridPoint, passable: Passable): GridPoint[] | null {
  if (!passable(start.x, start.y) || !passable(goal.x, goal.y)) return null;

  const heuristic = (p: GridPoint): number => Math.abs(p.x - goal.x) + Math.abs(p.y - goal.y);
  const startKey = tileKey(start);
  const goalKey = tileKey(goal);
  const cameFrom = new Map<string, GridPoint>();
  const bestCost = new Map<string, number>([[startKey, 0]]);
  const closed = new Set<string>();
  const open: OpenNode[] = [{ point: start, g: 0, f: heuristic(start), order: 0 }];
  let insertions = 1;

  while (open.length > 0) {
    // The grids in this game are tiny (≤ 256 tiles), so a linear scan for the
    // lowest-cost node is simpler than a heap and fast enough.
    let bestIndex = 0;
    for (let i = 1; i < open.length; i++) {
      const a = open[i];
      const b = open[bestIndex];
      if (a.f < b.f || (a.f === b.f && (a.g > b.g || (a.g === b.g && a.order < b.order)))) {
        bestIndex = i;
      }
    }
    const current = open[bestIndex];
    open.splice(bestIndex, 1);
    const currentKey = tileKey(current.point);
    if (closed.has(currentKey)) continue;
    if (currentKey === goalKey) return reconstruct(cameFrom, current.point, startKey);
    closed.add(currentKey);

    for (const step of NEIGHBOURS) {
      const next = { x: current.point.x + step.x, y: current.point.y + step.y };
      const nextKey = tileKey(next);
      if (closed.has(nextKey) || !passable(next.x, next.y)) continue;
      const g = current.g + 1;
      if (g >= (bestCost.get(nextKey) ?? Infinity)) continue;
      bestCost.set(nextKey, g);
      cameFrom.set(nextKey, current.point);
      open.push({ point: next, g, f: g + heuristic(next), order: insertions++ });
    }
  }
  return null;
}

function reconstruct(cameFrom: Map<string, GridPoint>, end: GridPoint, startKey: string): GridPoint[] {
  const path = [end];
  let key = tileKey(end);
  while (key !== startKey) {
    const previous = cameFrom.get(key);
    if (!previous) break;
    path.push(previous);
    key = tileKey(previous);
  }
  return path.reverse();
}

/** Visits passable tiles reachable from `start` in breadth-first (walking distance) order. */
export function* breadthFirst(start: GridPoint, passable: Passable): Generator<GridPoint> {
  if (!passable(start.x, start.y)) return;
  const seen = new Set<string>([tileKey(start)]);
  const queue: GridPoint[] = [start];
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    yield current;
    for (const step of NEIGHBOURS) {
      const next = { x: current.x + step.x, y: current.y + step.y };
      const key = tileKey(next);
      if (seen.has(key) || !passable(next.x, next.y)) continue;
      seen.add(key);
      queue.push(next);
    }
  }
}

/**
 * Finds the passable tile closest (straight-line) to `target`, searching
 * outwards up to `maxRadius` tiles. Used when the player clicks a building.
 */
export function nearestPassable(target: GridPoint, passable: Passable, maxRadius = 8): GridPoint | null {
  let best: GridPoint | null = null;
  let bestDistance = Infinity;
  for (let dy = -maxRadius; dy <= maxRadius; dy++) {
    for (let dx = -maxRadius; dx <= maxRadius; dx++) {
      const x = target.x + dx;
      const y = target.y + dy;
      const d = dx * dx + dy * dy;
      if (d < bestDistance && passable(x, y)) {
        best = { x, y };
        bestDistance = d;
      }
    }
  }
  return best;
}
