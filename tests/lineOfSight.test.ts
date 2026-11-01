import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasLineOfSight, type Opaque } from '../src/core/lineOfSight.ts';

function walls(rows: string[]): Opaque {
  return (x, y) => rows[y]?.[x] === '#';
}

const centre = (x: number, y: number) => ({ x: x + 0.5, y: y + 0.5 });

test('clear line across open ground', () => {
  const opaque = walls(['......', '......', '......']);
  assert.equal(hasLineOfSight(centre(0, 0), centre(5, 2), opaque), true);
});

test('a wall between shooter and target blocks the shot', () => {
  const opaque = walls(['......', '..#...', '......']);
  assert.equal(hasLineOfSight(centre(0, 1), centre(5, 1), opaque), false);
  assert.equal(hasLineOfSight(centre(5, 1), centre(0, 1), opaque), false);
});

test('walls beside the line do not block it', () => {
  const opaque = walls(['..#...', '......', '..#...']);
  assert.equal(hasLineOfSight(centre(0, 1), centre(5, 1), opaque), true);
});

test('a perfect diagonal cannot slip between two touching corners', () => {
  const opaque = walls(['....', '..#.', '.#..', '....']);
  assert.equal(hasLineOfSight(centre(0, 3), centre(3, 0), opaque), false);
});

test('shooter and target tiles themselves are ignored', () => {
  const opaque = walls(['#....#']);
  assert.equal(hasLineOfSight(centre(0, 0), centre(5, 0), opaque), true);
});
