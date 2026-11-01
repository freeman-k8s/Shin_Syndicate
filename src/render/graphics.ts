import type Phaser from 'phaser';
import type { Vec2 } from '../core/types.ts';

/** Strokes a polyline (or closed polygon) given as plain points. */
export function strokePoly(g: Phaser.GameObjects.Graphics, points: readonly Vec2[], close: boolean): void {
  if (points.length < 2) return;
  g.beginPath();
  g.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
  if (close) g.closePath();
  g.strokePath();
}

/** Fills a polygon given as plain points. */
export function fillPoly(g: Phaser.GameObjects.Graphics, points: readonly Vec2[]): void {
  if (points.length < 3) return;
  g.beginPath();
  g.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
  g.closePath();
  g.fillPath();
}
