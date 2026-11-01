import type { GridPoint, Vec2 } from './types.ts';

/**
 * Isometric (2:1 dimetric) projection helpers.
 *
 * Logical world space is a square grid measured in tiles: tile (tx, ty) covers
 * [tx, tx + 1) × [ty, ty + 1) and its centre is (tx + 0.5, ty + 0.5).
 * Screen space is measured in pixels before any camera transform: world (0, 0)
 * is the top corner of tile (0, 0), +x runs down-right and +y runs down-left.
 */
export const TILE_WIDTH = 128;
export const TILE_HEIGHT = 64;

const HALF_W = TILE_WIDTH / 2;
const HALF_H = TILE_HEIGHT / 2;

export function worldToScreen(world: Vec2): Vec2 {
  return {
    x: (world.x - world.y) * HALF_W,
    y: (world.x + world.y) * HALF_H,
  };
}

export function screenToWorld(screen: Vec2): Vec2 {
  const a = screen.x / HALF_W; // = x - y
  const b = screen.y / HALF_H; // = x + y
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

export function worldToTile(world: Vec2): GridPoint {
  return { x: Math.floor(world.x), y: Math.floor(world.y) };
}

export function tileCenter(tile: GridPoint): Vec2 {
  return { x: tile.x + 0.5, y: tile.y + 0.5 };
}

/**
 * Painter's-algorithm sort key: anything with a larger x + y is closer to the
 * viewer and must be drawn later.
 */
export function isoDepth(world: Vec2): number {
  return world.x + world.y;
}
