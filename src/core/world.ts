import { blocksSight, isWalkable, type CityMap } from './cityMap.ts';
import { tileCenter, worldToTile } from './iso.ts';
import { hasLineOfSight } from './lineOfSight.ts';
import { breadthFirst, findPath, nearestPassable } from './pathfinding.ts';
import { distance, samePoint, tileKey, type GridPoint, type Vec2 } from './types.ts';
import { createUnit, IDLE, isAlive, type Faction, type Unit, type UnitSpec } from './units.ts';

export type GameStatus = 'playing' | 'victory' | 'defeat';

export type WorldEvent =
  | { readonly type: 'shot'; readonly shooterId: number; readonly targetId: number; readonly damage: number }
  | { readonly type: 'death'; readonly unitId: number }
  | { readonly type: 'alert'; readonly unitId: number }
  | { readonly type: 'status'; readonly status: GameStatus };

export interface MoveAssignment {
  readonly unitId: number;
  /** The tile the unit is heading for, or null when it cannot get there. */
  readonly destination: GridPoint | null;
}

/** Attackers stop slightly inside their maximum range so small movements do not break contact. */
const RANGE_MARGIN = 0.35;
const REPATH_INTERVAL = 0.5;

/**
 * The complete game state and rules. It knows nothing about rendering or
 * input devices: scenes feed it commands and a time step, then read the state
 * and the queued events back.
 */
export class World {
  readonly map: CityMap;
  readonly units: readonly Unit[];
  status: GameStatus = 'playing';
  elapsed = 0;
  private events: WorldEvent[] = [];

  constructor(map: CityMap, specs: readonly UnitSpec[]) {
    this.map = map;
    this.units = specs.map((spec, index) => createUnit(index + 1, spec));
  }

  readonly isWalkable = (x: number, y: number): boolean => isWalkable(this.map, x, y);
  readonly isOpaque = (x: number, y: number): boolean => blocksSight(this.map, x, y);

  getUnit(id: number): Unit | undefined {
    return this.units.find((unit) => unit.id === id);
  }

  living(faction: Faction): Unit[] {
    return this.units.filter((unit) => unit.faction === faction && isAlive(unit));
  }

  canSee(from: Vec2, to: Vec2): boolean {
    return hasLineOfSight(from, to, this.isOpaque);
  }

  /** True when `shooter` could hit `target` right now (range and line of sight). */
  canFireAt(shooter: Unit, target: Unit): boolean {
    return (
      isAlive(shooter) &&
      isAlive(target) &&
      distance(shooter, target) <= shooter.weapon.range &&
      this.canSee(shooter, target)
    );
  }

  drainEvents(): WorldEvent[] {
    const drained = this.events;
    this.events = [];
    return drained;
  }

  // -------------------------------------------------------------------------
  // Commands
  // -------------------------------------------------------------------------

  /**
   * Orders agents to move to `target`. Several agents are spread over nearby
   * free tiles instead of stacking on the same one.
   */
  commandMove(unitIds: readonly number[], target: GridPoint): MoveAssignment[] {
    const movers = this.commandableAgents(unitIds);
    if (movers.length === 0) return [];

    const anchor = this.isWalkable(target.x, target.y) ? target : nearestPassable(target, this.isWalkable);
    if (!anchor) return movers.map((unit) => ({ unitId: unit.id, destination: null }));

    const reserved = this.reservedTiles(movers);
    const slots: GridPoint[] = [];
    for (const tile of breadthFirst(anchor, this.isWalkable)) {
      if (!reserved.has(tileKey(tile))) slots.push(tile);
      if (slots.length === movers.length) break;
    }

    // Nearest agents claim the nearest slots first.
    const ordered = [...movers].sort((a, b) => distance(a, tileCenter(anchor)) - distance(b, tileCenter(anchor)));
    const assignments: MoveAssignment[] = [];
    for (const unit of ordered) {
      let bestIndex = -1;
      for (let i = 0; i < slots.length; i++) {
        if (bestIndex < 0 || distance(unit, tileCenter(slots[i])) < distance(unit, tileCenter(slots[bestIndex]))) {
          bestIndex = i;
        }
      }
      const slot = bestIndex >= 0 ? slots.splice(bestIndex, 1)[0] : undefined;
      const path = slot ? this.pathFor(unit, slot) : null;
      if (!slot || !path) {
        assignments.push({ unitId: unit.id, destination: null });
        continue;
      }
      unit.order = { kind: 'move', destination: slot };
      unit.path = path;
      unit.targetId = null;
      assignments.push({ unitId: unit.id, destination: slot });
    }
    return assignments;
  }

  /** Orders agents to attack a guard: they close in until they can fire, then shoot automatically. */
  commandAttack(unitIds: readonly number[], targetId: number): number[] {
    const target = this.getUnit(targetId);
    if (!target || !isAlive(target) || target.faction !== 'guard') return [];
    const attackers = this.commandableAgents(unitIds);
    const reserved = this.reservedTiles(attackers);
    for (const unit of attackers) {
      unit.order = { kind: 'attack', targetId };
      unit.targetId = targetId;
      this.planApproach(unit, target, reserved);
    }
    return attackers.map((unit) => unit.id);
  }

  // -------------------------------------------------------------------------
  // Simulation
  // -------------------------------------------------------------------------

  /** Advances the simulation by `dt` seconds. */
  update(dt: number): void {
    if (this.status !== 'playing' || dt <= 0) return;
    this.elapsed += dt;

    for (const unit of this.units) {
      if (!isAlive(unit)) continue;
      if (unit.faction === 'agent') this.updateAgent(unit, dt);
      else this.updateGuard(unit);
      this.move(unit, dt);
      this.fire(unit, dt);
    }

    if (this.living('guard').length === 0) this.setStatus('victory');
    else if (this.living('agent').length === 0) this.setStatus('defeat');
  }

  private updateAgent(unit: Unit, dt: number): void {
    const order = unit.order;
    if (order.kind === 'move') {
      unit.targetId = null;
      if (unit.path.length === 0) unit.order = IDLE;
      return;
    }

    if (order.kind === 'attack') {
      const target = this.getUnit(order.targetId);
      if (!target || !isAlive(target)) {
        unit.order = IDLE;
        unit.targetId = null;
        unit.path = [];
      } else {
        unit.targetId = target.id;
        unit.repathTimer -= dt;
        if (unit.path.length === 0 && !this.canFireAt(unit, target) && unit.repathTimer <= 0) {
          this.planApproach(unit, target, this.reservedTiles([unit]));
        }
        return;
      }
    }

    // Idle agents defend themselves against guards they can already hit.
    const current = unit.targetId === null ? undefined : this.getUnit(unit.targetId);
    if (!current || !this.canFireAt(unit, current)) {
      unit.targetId = this.closest(this.living('guard').filter((guard) => this.canFireAt(unit, guard)), unit)?.id ?? null;
    }
  }

  private updateGuard(guard: Unit): void {
    const visible = this.living('agent').filter(
      (agent) => distance(guard, agent) <= guard.sightRange && this.canSee(guard, agent),
    );
    const inRange = visible.filter((agent) => distance(guard, agent) <= guard.weapon.range);
    const current = guard.targetId === null ? undefined : this.getUnit(guard.targetId);
    const keepCurrent = current !== undefined && inRange.includes(current);
    const target = keepCurrent ? current : (this.closest(inRange, guard) ?? this.closest(visible, guard));

    if (target && !guard.alerted) {
      guard.alerted = true;
      guard.cooldown = Math.max(guard.cooldown, guard.reactionTime);
      this.events.push({ type: 'alert', unitId: guard.id });
    } else if (!target) {
      guard.alerted = false;
    }
    guard.targetId = target?.id ?? null;
  }

  /** Frame-rate independent movement along the current path. */
  private move(unit: Unit, dt: number): void {
    let budget = unit.speed * dt;
    while (budget > 0 && unit.path.length > 0) {
      const waypoint = tileCenter(unit.path[0]);
      const dx = waypoint.x - unit.x;
      const dy = waypoint.y - unit.y;
      const gap = Math.hypot(dx, dy);
      if (gap > 1e-9) unit.facing = { x: dx / gap, y: dy / gap };
      if (gap <= budget) {
        unit.x = waypoint.x;
        unit.y = waypoint.y;
        budget -= gap;
        unit.path.shift();
      } else {
        unit.x += (dx / gap) * budget;
        unit.y += (dy / gap) * budget;
        budget = 0;
      }
    }
  }

  private fire(unit: Unit, dt: number): void {
    const target = unit.targetId === null ? undefined : this.getUnit(unit.targetId);
    const canFire = target !== undefined && unit.order.kind !== 'move' && this.canFireAt(unit, target);
    if (target && isAlive(target) && (canFire || unit.path.length === 0)) {
      const dx = target.x - unit.x;
      const dy = target.y - unit.y;
      const length = Math.hypot(dx, dy);
      if (length > 1e-9) unit.facing = { x: dx / length, y: dy / length };
    }

    unit.cooldown -= dt;
    if (!target || !canFire) {
      unit.cooldown = Math.max(0, unit.cooldown);
      return;
    }
    if (unit.cooldown > 0) return;

    unit.cooldown = Math.max(0, unit.cooldown + unit.weapon.cooldown);
    const damage = Math.min(target.hp, unit.weapon.damage);
    target.hp -= damage;
    this.events.push({ type: 'shot', shooterId: unit.id, targetId: target.id, damage });
    if (target.hp <= 0) this.kill(target);
  }

  private kill(unit: Unit): void {
    unit.hp = 0;
    unit.path = [];
    unit.order = IDLE;
    unit.targetId = null;
    unit.alerted = false;
    // Anyone still hunting the dead unit stands down immediately.
    for (const other of this.units) {
      if (other.order.kind === 'attack' && other.order.targetId === unit.id) {
        other.order = IDLE;
        other.path = [];
      }
      if (other.targetId === unit.id) other.targetId = null;
    }
    this.events.push({ type: 'death', unitId: unit.id });
  }

  private setStatus(status: GameStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.events.push({ type: 'status', status });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private commandableAgents(unitIds: readonly number[]): Unit[] {
    if (this.status !== 'playing') return [];
    return unitIds
      .map((id) => this.getUnit(id))
      .filter((unit): unit is Unit => unit !== undefined && unit.faction === 'agent' && isAlive(unit));
  }

  /** Tiles that other living agents occupy or are heading to. */
  private reservedTiles(excluded: readonly Unit[]): Set<string> {
    const reserved = new Set<string>();
    for (const agent of this.living('agent')) {
      if (excluded.includes(agent)) continue;
      const tile = agent.path.at(-1) ?? worldToTile(agent);
      reserved.add(tileKey(tile));
    }
    return reserved;
  }

  /**
   * Picks the nearest (by walking distance) free tile from which the unit can
   * hit the target, and starts walking there. Claims the tile in `reserved`.
   */
  private planApproach(unit: Unit, target: Unit, reserved: Set<string>): void {
    unit.repathTimer = REPATH_INTERVAL;
    const start = worldToTile(unit);
    const range = unit.weapon.range - RANGE_MARGIN;
    for (const tile of breadthFirst(start, this.isWalkable)) {
      if (reserved.has(tileKey(tile))) continue;
      const centre = tileCenter(tile);
      if (distance(centre, target) <= range && this.canSee(centre, target)) {
        reserved.add(tileKey(tile));
        unit.path = this.pathFor(unit, tile) ?? [];
        return;
      }
    }
    unit.path = [];
  }

  /**
   * A* path from the unit's current position to `goal`. When the unit is
   * already part-way towards the second waypoint, the first one is dropped so
   * that a new order does not make it step backwards.
   */
  private pathFor(unit: Unit, goal: GridPoint): GridPoint[] | null {
    const path = findPath(worldToTile(unit), goal, this.isWalkable);
    if (!path) return null;
    if (path.length >= 2) {
      const next = tileCenter(path[1]);
      const aligned = Math.abs(next.x - unit.x) < 1e-6 || Math.abs(next.y - unit.y) < 1e-6;
      if (aligned && distance(unit, next) < 1) path.shift();
    }
    if (path.length === 1 && samePoint(path[0], worldToTile(unit)) && distance(unit, tileCenter(path[0])) < 1e-6) {
      return [];
    }
    return path;
  }

  private closest(candidates: readonly Unit[], from: Unit): Unit | undefined {
    let best: Unit | undefined;
    for (const candidate of candidates) {
      if (!best || distance(from, candidate) < distance(from, best)) best = candidate;
    }
    return best;
  }
}
