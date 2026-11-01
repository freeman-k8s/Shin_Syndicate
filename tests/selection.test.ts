import assert from 'node:assert/strict';
import { test } from 'node:test';
import { worldToScreen } from '../src/core/iso.ts';
import { createMissionWorld } from '../src/core/scenario.ts';
import { pickUnit } from '../src/input/picking.ts';
import { Selection } from '../src/input/selection.ts';

test('plain clicks replace the selection, shift-clicks toggle', () => {
  const selection = new Selection();
  selection.selectOnly(1);
  selection.toggle(2);
  assert.deepEqual(selection.list().sort(), [1, 2]);
  selection.toggle(1);
  assert.deepEqual(selection.list(), [2]);
  selection.selectOnly(1);
  assert.deepEqual(selection.list(), [1]);
});

test('dead agents are pruned from the selection', () => {
  const world = createMissionWorld();
  const selection = new Selection();
  selection.selectOnly(1);
  selection.toggle(2);
  world.units[0].hp = 0;
  selection.prune(world.units);
  assert.deepEqual(selection.list(), [2]);
});

test('picking finds the unit under the cursor and respects faction', () => {
  const world = createMissionWorld();
  const [first] = world.units;
  const ground = worldToScreen(first);
  const torso = { x: ground.x + 3, y: ground.y - 40 };
  assert.equal(pickUnit(world.units, torso, 'agent')?.id, first.id);
  assert.equal(pickUnit(world.units, torso, 'guard'), undefined);
  assert.equal(pickUnit(world.units, { x: ground.x + 200, y: ground.y }, 'agent'), undefined);
});
