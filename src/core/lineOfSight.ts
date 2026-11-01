import type { Vec2 } from './types.ts';

/** Returns true when the tile stops bullets and blocks vision. */
export type Opaque = (x: number, y: number) => boolean;

/**
 * Grid ray cast (Amanatides & Woo traversal) from `from` to `to`.
 * Every tile the segment touches between the two end tiles is tested; the end
 * tiles themselves are ignored because they hold the shooter and the target.
 * When the segment passes exactly through a tile corner, both tiles that share
 * the corner are tested so that shots cannot slip between two buildings.
 */
export function hasLineOfSight(from: Vec2, to: Vec2, opaque: Opaque): boolean {
  let x = Math.floor(from.x);
  let y = Math.floor(from.y);
  const endX = Math.floor(to.x);
  const endY = Math.floor(to.y);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy);
  const tDeltaX = stepX === 0 ? Infinity : Math.abs(1 / dx);
  const tDeltaY = stepY === 0 ? Infinity : Math.abs(1 / dy);
  let tMaxX = stepX > 0 ? (x + 1 - from.x) / dx : stepX < 0 ? (from.x - x) / -dx : Infinity;
  let tMaxY = stepY > 0 ? (y + 1 - from.y) / dy : stepY < 0 ? (from.y - y) / -dy : Infinity;
  const maxSteps = Math.abs(endX - x) + Math.abs(endY - y);

  for (let i = 0; i < maxSteps; i++) {
    if (x === endX && y === endY) return true;
    if (Math.abs(tMaxX - tMaxY) < 1e-9) {
      if (opaque(x + stepX, y) || opaque(x, y + stepY)) return false;
      x += stepX;
      y += stepY;
      tMaxX += tDeltaX;
      tMaxY += tDeltaY;
      i++; // a diagonal step covers two unit steps of the Manhattan budget
    } else if (tMaxX < tMaxY) {
      x += stepX;
      tMaxX += tDeltaX;
    } else {
      y += stepY;
      tMaxY += tDeltaY;
    }
    if (x === endX && y === endY) return true;
    if (opaque(x, y)) return false;
  }
  return true;
}
