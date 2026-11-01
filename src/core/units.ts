import { tileCenter } from './iso.ts';
import type { GridPoint, Vec2 } from './types.ts';

export type Faction = 'agent' | 'guard';

export interface Weapon {
  readonly name: string;
  /** Maximum firing distance in tiles. */
  readonly range: number;
  readonly damage: number;
  /** Seconds between shots. */
  readonly cooldown: number;
}

export type Order =
  | { readonly kind: 'idle' }
  | { readonly kind: 'move'; readonly destination: GridPoint }
  | { readonly kind: 'attack'; readonly targetId: number };

export const IDLE: Order = { kind: 'idle' };

export interface UnitSpec {
  readonly name: string;
  readonly faction: Faction;
  readonly tile: GridPoint;
  readonly maxHp: number;
  /** Movement speed in tiles per second. */
  readonly speed: number;
  readonly weapon: Weapon;
  /** Distance in tiles at which the unit notices hostiles. */
  readonly sightRange: number;
  /** Delay in seconds before the first shot after spotting a hostile. */
  readonly reactionTime: number;
}

export interface Unit {
  readonly id: number;
  readonly name: string;
  readonly faction: Faction;
  readonly maxHp: number;
  readonly speed: number;
  readonly weapon: Weapon;
  readonly sightRange: number;
  readonly reactionTime: number;
  x: number;
  y: number;
  hp: number;
  /** Seconds until the weapon can fire again. */
  cooldown: number;
  /** Remaining tile waypoints; the unit walks towards path[0]. */
  path: GridPoint[];
  order: Order;
  /** The unit currently being shot at (or tracked), if any. */
  targetId: number | null;
  /** Normalised direction the unit is looking in, in world space. */
  facing: Vec2;
  /** True while a guard has a hostile in view. */
  alerted: boolean;
  /** Seconds until an attacking unit re-plans its approach. */
  repathTimer: number;
}

export function createUnit(id: number, spec: UnitSpec): Unit {
  const position = tileCenter(spec.tile);
  return {
    id,
    name: spec.name,
    faction: spec.faction,
    maxHp: spec.maxHp,
    speed: spec.speed,
    weapon: spec.weapon,
    sightRange: spec.sightRange,
    reactionTime: spec.reactionTime,
    x: position.x,
    y: position.y,
    hp: spec.maxHp,
    cooldown: 0,
    path: [],
    order: IDLE,
    targetId: null,
    facing: spec.faction === 'agent' ? { x: -Math.SQRT1_2, y: -Math.SQRT1_2 } : { x: Math.SQRT1_2, y: Math.SQRT1_2 },
    alerted: false,
    repathTimer: 0,
  };
}

export function isAlive(unit: Unit): boolean {
  return unit.hp > 0;
}

export function isMoving(unit: Unit): boolean {
  return unit.path.length > 0;
}
