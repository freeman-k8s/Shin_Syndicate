import assert from 'node:assert/strict';
import { test } from 'node:test';
import { screenToWorld, tileCenter, TILE_HEIGHT, TILE_WIDTH, worldToScreen, worldToTile } from '../src/core/iso.ts';

test('tile corners project onto the expected diamond', () => {
  assert.deepEqual(worldToScreen({ x: 0, y: 0 }), { x: 0, y: 0 });
  assert.deepEqual(worldToScreen({ x: 1, y: 0 }), { x: TILE_WIDTH / 2, y: TILE_HEIGHT / 2 });
  assert.deepEqual(worldToScreen({ x: 0, y: 1 }), { x: -TILE_WIDTH / 2, y: TILE_HEIGHT / 2 });
  assert.deepEqual(worldToScreen({ x: 1, y: 1 }), { x: 0, y: TILE_HEIGHT });
});

test('screenToWorld inverts worldToScreen', () => {
  for (const point of [
    { x: 0.5, y: 0.5 },
    { x: 7.25, y: 3.75 },
    { x: 15.9, y: 0.1 },
    { x: -2, y: 11 },
  ]) {
    const back = screenToWorld(worldToScreen(point));
    assert.ok(Math.abs(back.x - point.x) < 1e-9, `x for ${JSON.stringify(point)}`);
    assert.ok(Math.abs(back.y - point.y) < 1e-9, `y for ${JSON.stringify(point)}`);
  }
});

test('a click anywhere inside a tile diamond resolves to that tile', () => {
  const tile = { x: 6, y: 9 };
  const centre = worldToScreen(tileCenter(tile));
  const inset = 4; // stay just inside the diamond edges
  const samples = [
    centre,
    { x: centre.x, y: centre.y - TILE_HEIGHT / 2 + inset }, // near top vertex
    { x: centre.x + TILE_WIDTH / 2 - 2 * inset, y: centre.y }, // near right vertex
    { x: centre.x, y: centre.y + TILE_HEIGHT / 2 - inset }, // near bottom vertex
    { x: centre.x - TILE_WIDTH / 2 + 2 * inset, y: centre.y }, // near left vertex
  ];
  for (const screen of samples) {
    assert.deepEqual(worldToTile(screenToWorld(screen)), tile, `screen ${JSON.stringify(screen)}`);
  }
  // Just outside the right vertex belongs to the neighbouring tile.
  const outside = { x: centre.x + TILE_WIDTH / 2 + inset, y: centre.y };
  assert.notDeepEqual(worldToTile(screenToWorld(outside)), tile);
});
