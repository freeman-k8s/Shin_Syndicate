import assert from 'node:assert/strict';
import { test } from 'node:test';
import { breadthFirst, findPath, nearestPassable, type Passable } from '../src/core/pathfinding.ts';
import type { GridPoint } from '../src/core/types.ts';

/** '#' is blocked, anything else is open. */
function grid(rows: string[]): Passable {
  return (x, y) => y >= 0 && y < rows.length && x >= 0 && x < rows[y].length && rows[y][x] !== '#';
}

function assertContiguous(path: GridPoint[], passable: Passable): void {
  for (let i = 0; i < path.length; i++) {
    assert.ok(passable(path[i].x, path[i].y), `step ${i} is blocked`);
    if (i > 0) {
      const manhattan = Math.abs(path[i].x - path[i - 1].x) + Math.abs(path[i].y - path[i - 1].y);
      assert.equal(manhattan, 1, `step ${i} is not a four-direction move`);
    }
  }
}

test('finds a straight path on open ground', () => {
  const passable = grid(['.....', '.....', '.....']);
  const path = findPath({ x: 0, y: 1 }, { x: 4, y: 1 }, passable);
  assert.ok(path);
  assert.equal(path.length, 5);
  assert.deepEqual(path[0], { x: 0, y: 1 });
  assert.deepEqual(path.at(-1), { x: 4, y: 1 });
});

test('walks around a wall using the shortest route', () => {
  const passable = grid([
    '.....',
    '.###.',
    '.#...',
    '.#.#.',
    '.....',
  ]);
  const path = findPath({ x: 2, y: 2 }, { x: 0, y: 2 }, passable);
  assert.ok(path);
  assertContiguous(path, passable);
  assert.equal(path.length - 1, 6); // (2,2)→(2,3)→(2,4)→(1,4)→(0,4)→(0,3)→(0,2)
});

test('returns null for an enclosed goal and for blocked goals', () => {
  const passable = grid([
    '.....',
    '.###.',
    '.#.#.',
    '.###.',
    '.....',
  ]);
  assert.equal(findPath({ x: 0, y: 0 }, { x: 2, y: 2 }, passable), null);
  assert.equal(findPath({ x: 0, y: 0 }, { x: 1, y: 1 }, passable), null);
  assert.equal(findPath({ x: 0, y: 0 }, { x: 9, y: 9 }, passable), null);
});

test('start equal to goal yields a single-tile path', () => {
  const passable = grid(['...']);
  assert.deepEqual(findPath({ x: 1, y: 0 }, { x: 1, y: 0 }, passable), [{ x: 1, y: 0 }]);
});

test('breadthFirst visits reachable tiles nearest-first', () => {
  const passable = grid(['...', '.#.', '...']);
  const order = [...breadthFirst({ x: 0, y: 0 }, passable)];
  assert.equal(order.length, 8);
  assert.deepEqual(order[0], { x: 0, y: 0 });
  const steps = order.map((p) => Math.abs(p.x) + Math.abs(p.y));
  assert.deepEqual(
    steps.slice(0, 3).every((d) => d <= 1),
    true,
  );
});

test('nearestPassable finds the closest open tile next to a building', () => {
  const passable = grid(['.....', '.###.', '.###.', '.###.', '.....']);
  const nearest = nearestPassable({ x: 2, y: 2 }, passable);
  assert.ok(nearest);
  assert.equal(Math.abs(nearest.x - 2) + Math.abs(nearest.y - 2), 2);
});
