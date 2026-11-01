import Phaser from 'phaser';
import type { Vec2 } from '../core/types.ts';
import { DEPTH } from './depth.ts';
import { fillPoly, strokePoly } from './graphics.ts';

/** Ground ellipse ratio of the isometric projection. */
const ISO = 0.5;

interface TimedEffect {
  age: number;
  readonly life: number;
  readonly layer: 'decal' | 'fx';
  readonly draw: (g: Phaser.GameObjects.Graphics, t: number) => void;
}

/**
 * Short-lived visual feedback: shots, impacts, order markers. Effects run on
 * real time so feedback still animates while the simulation is paused.
 */
export class Effects {
  /** Ground-level layer (below units): order markers, rings, paths. */
  readonly decal: Phaser.GameObjects.Graphics;
  /** Additive layer above the city: tracers, sparks, target reticles. */
  readonly fx: Phaser.GameObjects.Graphics;
  /** Layer for health bars and tags. */
  readonly overlay: Phaser.GameObjects.Graphics;
  private effects: TimedEffect[] = [];

  constructor(scene: Phaser.Scene) {
    this.decal = scene.add.graphics().setDepth(DEPTH.decals);
    this.fx = scene.add.graphics().setDepth(DEPTH.effects).setBlendMode(Phaser.BlendModes.ADD);
    this.overlay = scene.add.graphics().setDepth(DEPTH.overlay);
  }

  /** Clears all layers and redraws the active effects. Call once per frame before other decal drawing. */
  update(dt: number): void {
    this.decal.clear();
    this.fx.clear();
    this.overlay.clear();
    for (const effect of this.effects) effect.age += dt;
    this.effects = this.effects.filter((effect) => effect.age < effect.life);
    for (const effect of this.effects) {
      effect.draw(effect.layer === 'decal' ? this.decal : this.fx, Math.max(0, effect.age / effect.life));
    }
  }

  private add(life: number, layer: TimedEffect['layer'], draw: TimedEffect['draw'], delay = 0): void {
    this.effects.push({ age: -delay, life, layer, draw: (g, t) => (t >= 0 ? draw(g, t) : undefined) });
  }

  shot(from: Vec2, to: Vec2, color: number): void {
    const jitter = { x: (Math.random() - 0.5) * 10, y: (Math.random() - 0.5) * 12 };
    const end = { x: to.x + jitter.x, y: to.y + jitter.y };
    this.add(0.14, 'fx', (g, t) => {
      const alpha = 1 - t;
      g.lineStyle(7, color, 0.18 * alpha);
      g.lineBetween(from.x, from.y, end.x, end.y);
      g.lineStyle(2.2, color, 0.85 * alpha);
      g.lineBetween(from.x, from.y, end.x, end.y);
      g.lineStyle(1, 0xffffff, 0.9 * alpha);
      g.lineBetween(from.x + (end.x - from.x) * t * 0.6, from.y + (end.y - from.y) * t * 0.6, end.x, end.y);
    });
    // Muzzle flash.
    this.add(0.07, 'fx', (g, t) => {
      g.fillStyle(color, 0.35 * (1 - t));
      g.fillCircle(from.x, from.y, 11);
      g.fillStyle(0xffffff, 0.9 * (1 - t));
      g.fillCircle(from.x, from.y, 4);
    });
    // Impact sparks.
    const sparks = Array.from({ length: 5 }, () => ({
      angle: Math.random() * Math.PI * 2,
      speed: 40 + Math.random() * 60,
    }));
    this.add(0.22, 'fx', (g, t) => {
      g.fillStyle(0xffffff, 0.6 * (1 - t));
      g.fillCircle(end.x, end.y, 5 * (1 - t) + 1);
      g.lineStyle(1.5, color, 1 - t);
      for (const spark of sparks) {
        const r0 = spark.speed * t * 0.4;
        const r1 = spark.speed * t * 0.4 + 6;
        g.lineBetween(
          end.x + Math.cos(spark.angle) * r0,
          end.y + Math.sin(spark.angle) * r0,
          end.x + Math.cos(spark.angle) * r1,
          end.y + Math.sin(spark.angle) * r1,
        );
      }
    });
  }

  /** Expanding diamond where a move order lands. */
  moveMarker(at: Vec2, color: number, delay = 0): void {
    this.add(
      0.55,
      'decal',
      (g, t) => {
        const size = 18 + t * 26;
        const alpha = 1 - t;
        g.lineStyle(2.5, color, alpha);
        strokePoly(g, diamond(at, size), true);
        g.lineStyle(1, color, alpha * 0.6);
        strokePoly(g, diamond(at, size * 0.55), true);
        g.fillStyle(color, 0.25 * alpha);
        fillPoly(g, diamond(at, 10));
      },
      delay,
    );
  }

  /** Red cross for a rejected order. */
  invalidMarker(at: Vec2, color: number): void {
    this.add(0.6, 'decal', (g, t) => {
      const s = 14;
      const alpha = 1 - t * t;
      g.lineStyle(3, color, alpha);
      g.lineBetween(at.x - s, at.y - s * ISO, at.x + s, at.y + s * ISO);
      g.lineBetween(at.x - s, at.y + s * ISO, at.x + s, at.y - s * ISO);
    });
  }

  /** Brackets that snap onto an attack target. */
  attackMarker(at: Vec2, color: number): void {
    this.add(0.45, 'fx', (g, t) => {
      const size = 40 - t * 14;
      drawBrackets(g, at, size, color, 1 - t);
    });
  }

  deathBurst(at: Vec2, color: number): void {
    this.add(0.6, 'fx', (g, t) => {
      g.lineStyle(3, color, 1 - t);
      g.strokeEllipse(at.x, at.y, 20 + t * 90, (20 + t * 90) * ISO);
      g.fillStyle(color, 0.25 * (1 - t));
      g.fillCircle(at.x, at.y - 40, 16 * (1 - t) + 4);
    });
  }

  /** Persistent per-frame helpers used by the scene. */
  ring(at: Vec2, radius: number, color: number, alpha: number, rotation: number, segments = 4): void {
    const g = this.decal;
    const gap = 0.35;
    g.lineStyle(3, color, alpha);
    for (let i = 0; i < segments; i++) {
      const start = rotation + (i / segments) * Math.PI * 2;
      const end = start + (Math.PI * 2) / segments - gap;
      const points: Vec2[] = [];
      for (let a = start; a <= end + 1e-6; a += (end - start) / 10) {
        points.push({ x: at.x + Math.cos(a) * radius, y: at.y + Math.sin(a) * radius * ISO });
      }
      strokePoly(g, points, false);
    }
    g.lineStyle(1, color, alpha * 0.4);
    g.strokeEllipse(at.x, at.y, radius * 1.5, radius * 1.5 * ISO);
  }

  targetBrackets(at: Vec2, color: number, alpha: number, time: number): void {
    drawBrackets(this.fx, at, 30 + Math.sin(time * 6) * 3, color, alpha);
  }
}

function diamond(at: Vec2, size: number): Vec2[] {
  return [
    { x: at.x, y: at.y - size * ISO },
    { x: at.x + size, y: at.y },
    { x: at.x, y: at.y + size * ISO },
    { x: at.x - size, y: at.y },
  ];
}

function drawBrackets(g: Phaser.GameObjects.Graphics, at: Vec2, size: number, color: number, alpha: number): void {
  const arm = size * 0.4;
  g.lineStyle(2.5, color, alpha);
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) {
    const cx = at.x + sx * size * 0.75;
    const cy = at.y + sy * size;
    g.lineBetween(cx, cy, cx - sx * arm, cy);
    g.lineBetween(cx, cy, cx, cy - sy * arm);
  }
}
