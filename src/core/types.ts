/** A continuous position in logical world space, measured in tiles. */
export interface Vec2 {
  x: number;
  y: number;
}

/** An integer tile coordinate on the logical grid. */
export interface GridPoint {
  readonly x: number;
  readonly y: number;
}

export function tileKey(p: GridPoint): string {
  return `${p.x},${p.y}`;
}

export function samePoint(a: GridPoint, b: GridPoint): boolean {
  return a.x === b.x && a.y === b.y;
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
