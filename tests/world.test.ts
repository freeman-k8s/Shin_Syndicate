import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildCityMap, isWalkable, type CityLayout } from '../src/core/cityMap.ts';
import { worldToTile } from '../src/core/iso.ts';
import { createMissionWorld } from '../src/core/scenario.ts';
import type { UnitSpec, Weapon } from '../src/core/units.ts';
import { World } from '../src/core/world.ts';

const RIFLE: Weapon = { name: 'test rifle', range: 4, damage: 25, cooldown: 0.5 };

function agent(x: number, y: number, overrides: Partial<UnitSpec> = {}): UnitSpec {
  return { name: 'A', faction: 'agent', tile: { x, y }, maxHp: 100, speed: 2, weapon: RIFLE, sightRange: 4, reactionTime: 0, ...overrides };
}

function guard(x: number, y: number, overrides: Partial<UnitSpec> = {}): UnitSpec {
  return { name: 'G', faction: 'guard', tile: { x, y }, maxHp: 100, speed: 0, weapon: RIFLE, sightRange: 5, reactionTime: 0, ...overrides };
}

function makeWorld(rows: string[], specs: UnitSpec[]): World {
  const layout: CityLayout = { rows, buildingLevels: { H: 2 }, ground: () => 'sidewalk' };
  return new World(buildCityMap(layout), specs);
}

function run(world: World, seconds: number, step = 1 / 60): void {
  for (let t = 0; t < seconds; t += step) world.update(step);
}

test('a moving agent walks around a building and never enters it', () => {
  const world = makeWorld(
    ['..........', '....H.....', '....H.....', '....H.....', '..........'],
    [agent(2, 2), guard(9, 4, { sightRange: 0.1 })],
  );
  const [mover] = world.units;
  const [assignment] = world.commandMove([mover.id], { x: 7, y: 2 });
  assert.deepEqual(assignment.destination, { x: 7, y: 2 });
  for (let i = 0; i < 600; i++) {
    world.update(1 / 60);
    const tile = worldToTile(mover);
    assert.ok(isWalkable(world.map, tile.x, tile.y), `entered blocked tile ${tile.x},${tile.y}`);
  }
  assert.deepEqual(worldToTile(mover), { x: 7, y: 2 });
  assert.equal(mover.order.kind, 'idle');
});

test('movement speed does not depend on the frame rate', () => {
  const rows = ['............', '............'];
  const fast = makeWorld(rows, [agent(0, 0), guard(11, 1, { sightRange: 0.1 })]);
  const slow = makeWorld(rows, [agent(0, 0), guard(11, 1, { sightRange: 0.1 })]);
  fast.commandMove([1], { x: 10, y: 0 });
  slow.commandMove([1], { x: 10, y: 0 });
  for (let i = 0; i < 120; i++) fast.update(1 / 120);
  for (let i = 0; i < 20; i++) slow.update(1 / 20);
  assert.ok(Math.abs(fast.units[0].x - slow.units[0].x) < 1e-9);
  assert.ok(Math.abs(fast.units[0].x - 2.5) < 1e-9); // 0.5 + 2 tiles/s × 1 s
});

test('a new order can be given while an agent is already moving', () => {
  const world = makeWorld(['..........', '..........', '..........'], [agent(0, 1), guard(9, 2, { sightRange: 0.1 })]);
  world.commandMove([1], { x: 9, y: 1 });
  run(world, 1.25);
  world.commandMove([1], { x: 0, y: 1 });
  run(world, 4);
  assert.deepEqual(worldToTile(world.units[0]), { x: 0, y: 1 });
});

test('several agents receive different nearby destinations', () => {
  const world = makeWorld(['..........', '..........', '..........', '..........'], [
    agent(0, 0),
    agent(0, 1),
    guard(9, 3, { sightRange: 0.1 }),
  ]);
  const assignments = world.commandMove([1, 2], { x: 6, y: 1 });
  assert.equal(assignments.length, 2);
  const [a, b] = assignments.map((entry) => entry.destination);
  assert.ok(a && b);
  assert.notDeepEqual(a, b);
  for (const destination of [a, b]) {
    assert.ok(Math.abs(destination.x - 6) + Math.abs(destination.y - 1) <= 1);
  }
});

test('an unreachable destination is reported instead of crashing', () => {
  // A ring of barriers encloses tile (3, 2).
  const world = makeWorld(['..........', '..bbb.....', '..b.b.....', '..bbb.....', '..........'], [
    agent(0, 0),
    guard(9, 4, { sightRange: 0.1 }),
  ]);
  const [assignment] = world.commandMove([1], { x: 3, y: 2 });
  assert.equal(assignment.destination, null);
  assert.doesNotThrow(() => run(world, 1));
  assert.deepEqual(worldToTile(world.units[0]), { x: 0, y: 0 });
});

test('an attack order makes the agent close in and kill the guard', () => {
  const world = makeWorld(['..............', '..............', '..............'], [
    agent(0, 1),
    guard(12, 1, { weapon: { ...RIFLE, damage: 1 } }),
  ]);
  const [attacker, target] = world.units;
  assert.deepEqual(world.commandAttack([attacker.id], target.id), [attacker.id]);
  run(world, 10);
  assert.equal(target.hp, 0);
  assert.ok(attacker.x > 4, 'agent should have advanced towards the guard');
  assert.equal(world.status, 'victory');
  const events = world.drainEvents();
  assert.ok(events.some((event) => event.type === 'shot' && event.shooterId === attacker.id));
  assert.ok(events.some((event) => event.type === 'death' && event.unitId === target.id));
  assert.equal(attacker.order.kind, 'idle', 'attack order is released once the target is dead');
  assert.equal(attacker.targetId, null);
});

test('guards shoot visible agents in range but not through buildings', () => {
  const hidden = makeWorld(['.....', '..H..', '.....'], [agent(0, 1), guard(4, 1)]);
  run(hidden, 3);
  assert.equal(hidden.units[0].hp, 100);

  const exposed = makeWorld(['.....', '.....', '.....'], [agent(0, 1), guard(4, 1)]);
  run(exposed, 3);
  assert.ok(exposed.units[0].hp < 100);
});

test('the squad is lost when every agent dies, and dead units stay still', () => {
  const world = makeWorld(['.......', '.......'], [
    agent(0, 0, { maxHp: 20, weapon: { ...RIFLE, damage: 0 } }),
    guard(3, 0, { weapon: { ...RIFLE, damage: 50 } }),
  ]);
  world.commandMove([1], { x: 6, y: 1 });
  run(world, 2);
  const [victim] = world.units;
  assert.equal(victim.hp, 0);
  assert.equal(world.status, 'defeat');
  const before = { x: victim.x, y: victim.y };
  world.commandMove([1], { x: 0, y: 1 });
  run(world, 1);
  assert.deepEqual({ x: victim.x, y: victim.y }, before);
});

test('the mission map starts in a playable state', () => {
  const world = createMissionWorld();
  assert.equal(world.map.width, 16);
  assert.equal(world.map.height, 16);
  assert.equal(world.living('agent').length, 2);
  assert.equal(world.living('guard').length, 2);
  for (const unit of world.units) {
    const tile = worldToTile(unit);
    assert.ok(isWalkable(world.map, tile.x, tile.y), `${unit.name} starts on a blocked tile`);
  }
  // Nobody is in a fire-fight at the start.
  run(world, 2);
  assert.ok(world.units.every((unit) => unit.hp === unit.maxHp));
});
