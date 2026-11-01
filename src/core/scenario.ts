import { createCityMap } from './cityMap.ts';
import type { UnitSpec, Weapon } from './units.ts';
import { World } from './world.ts';

/** Mission data: who starts where, and with which weapons. */

export const AGENT_SMG: Weapon = { name: 'KX-9 Smartgun', range: 5.5, damage: 14, cooldown: 0.5 };
export const GUARD_CARBINE: Weapon = { name: 'Halcyon Carbine', range: 5.5, damage: 9, cooldown: 0.6 };

export const MISSION_SPECS: readonly UnitSpec[] = [
  {
    name: 'KESTREL',
    faction: 'agent',
    tile: { x: 9, y: 13 },
    maxHp: 100,
    speed: 3,
    weapon: AGENT_SMG,
    sightRange: 5.5,
    reactionTime: 0,
  },
  {
    name: 'VANTA',
    faction: 'agent',
    tile: { x: 11, y: 13 },
    maxHp: 100,
    speed: 3,
    weapon: AGENT_SMG,
    sightRange: 5.5,
    reactionTime: 0,
  },
  {
    name: 'GATE WARDEN',
    faction: 'guard',
    tile: { x: 11, y: 5 },
    maxHp: 120,
    speed: 0,
    weapon: GUARD_CARBINE,
    sightRange: 6.5,
    reactionTime: 0.45,
  },
  {
    name: 'STREET WARDEN',
    faction: 'guard',
    tile: { x: 4, y: 6 },
    maxHp: 120,
    speed: 0,
    weapon: GUARD_CARBINE,
    sightRange: 6.5,
    reactionTime: 0.45,
  },
];

export function createMissionWorld(): World {
  return new World(createCityMap(), MISSION_SPECS);
}
