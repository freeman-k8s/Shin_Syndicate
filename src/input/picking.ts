import { worldToScreen } from '../core/iso.ts';
import type { Vec2 } from '../core/types.ts';
import { isAlive, type Faction, type Unit } from '../core/units.ts';

/**
 * Screen-space hit boxes, in world pixels (before camera zoom), relative to
 * the unit's ground point. They cover the body and the health tag above it.
 */
const BODY_HALF_WIDTH = 26;
const BODY_TOP = -112;
const BODY_BOTTOM = 14;
const BODY_CENTRE = -40;

/**
 * Returns the living unit of `faction` under the given screen point, or
 * undefined. When several overlap, the one whose body centre is nearest wins.
 */
export function pickUnit(units: readonly Unit[], point: Vec2, faction: Faction): Unit | undefined {
  let best: Unit | undefined;
  let bestDistance = Infinity;
  for (const unit of units) {
    if (unit.faction !== faction || !isAlive(unit)) continue;
    const ground = worldToScreen(unit);
    const dx = point.x - ground.x;
    const dy = point.y - ground.y;
    if (Math.abs(dx) > BODY_HALF_WIDTH || dy < BODY_TOP || dy > BODY_BOTTOM) continue;
    const d = Math.hypot(dx, dy - BODY_CENTRE);
    if (d < bestDistance) {
      best = unit;
      bestDistance = d;
    }
  }
  return best;
}
