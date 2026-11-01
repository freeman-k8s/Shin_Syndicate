import type Phaser from 'phaser';
import { fillPoly, strokePoly } from '../render/graphics.ts';
import type { ScreenRect } from '../session.ts';

export const FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
export const MONO = '"Cascadia Mono", Consolas, "DejaVu Sans Mono", monospace';

export interface TextOptions {
  readonly bold?: boolean;
  readonly mono?: boolean;
  readonly spacing?: number;
  readonly origin?: readonly [number, number];
}

export function hudText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: string,
  size: number,
  color: string,
  options: TextOptions = {},
): Phaser.GameObjects.Text {
  const text = scene.add.text(x, y, value, {
    fontFamily: options.mono ? MONO : FONT,
    fontSize: `${size}px`,
    fontStyle: options.bold ? 'bold' : 'normal',
    color,
  });
  if (options.spacing) text.setLetterSpacing(options.spacing);
  if (options.origin) text.setOrigin(options.origin[0], options.origin[1]);
  return text;
}

/** Dark translucent panel with a clipped corner and an accent tab. */
export function drawPanel(g: Phaser.GameObjects.Graphics, rect: ScreenRect, accent: number, cutRight = true): void {
  const { x, y, width: w, height: h } = rect;
  const cut = 16;
  const points = cutRight
    ? [
        { x, y },
        { x: x + w - cut, y },
        { x: x + w, y: y + cut },
        { x: x + w, y: y + h },
        { x: x + cut, y: y + h },
        { x, y: y + h - cut },
      ]
    : [
        { x: x + cut, y },
        { x: x + w, y },
        { x: x + w, y: y + h - cut },
        { x: x + w - cut, y: y + h },
        { x, y: y + h },
        { x, y: y + cut },
      ];
  g.fillStyle(0x070d15, 0.84);
  fillPoly(g, points);
  g.lineStyle(1.5, 0x1f4250, 0.95);
  strokePoly(g, points, true);
  g.lineStyle(3, accent, 0.95);
  g.lineBetween(cutRight ? x : x + w - 90, y, cutRight ? x + 90 : x + w, y);
}
