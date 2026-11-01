import type Phaser from 'phaser';
import { DEPTH } from './depth.ts';

interface Drop {
  x: number;
  y: number;
  length: number;
  speed: number;
}

const WIND = -0.22;

/** Light, restrained rain streaks over the visible area. */
export class Rain {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly drops: Drop[] = [];
  private readonly area: Phaser.Geom.Rectangle;

  constructor(scene: Phaser.Scene, area: Phaser.Geom.Rectangle, count = 170) {
    this.area = area;
    this.graphics = scene.add.graphics().setDepth(DEPTH.weather);
    for (let i = 0; i < count; i++) {
      this.drops.push({
        x: area.x + Math.random() * area.width,
        y: area.y + Math.random() * area.height,
        length: 14 + Math.random() * 22,
        speed: 900 + Math.random() * 500,
      });
    }
  }

  update(dt: number): void {
    const { area } = this;
    const g = this.graphics;
    g.clear();
    g.lineStyle(1.2, 0xa8c8ff, 0.14);
    g.beginPath();
    for (const drop of this.drops) {
      drop.y += drop.speed * dt;
      drop.x += drop.speed * WIND * dt;
      if (drop.y > area.bottom) {
        drop.y = area.y - drop.length;
        drop.x = area.x + Math.random() * area.width;
      }
      if (drop.x < area.x) drop.x += area.width;
      g.moveTo(drop.x, drop.y);
      g.lineTo(drop.x - drop.length * WIND, drop.y - drop.length);
    }
    g.strokePath();
  }
}
