import { isoDepth } from '../core/iso.ts';
import type { Vec2 } from '../core/types.ts';

/** Render layers. Sorted world objects live between SORTED_BASE and OVERLAY. */
export const DEPTH = {
  ground: 0,
  decals: 2,
  shadows: 3,
  sortedBase: 10,
  effects: 900,
  overlay: 1000,
  overlayText: 1001,
  weather: 1100,
} as const;

/** Depth for an object standing at `world`; larger x + y is nearer the viewer. */
export function sortedDepth(world: Vec2, bias = 0): number {
  return DEPTH.sortedBase + isoDepth(world) * 10 + bias;
}
