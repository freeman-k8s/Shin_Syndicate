import Phaser from 'phaser';
import { worldToScreen } from '../core/iso.ts';
import type { Vec2 } from '../core/types.ts';
import { isAlive, isMoving, type Unit } from '../core/units.ts';
import { DEPTH, sortedDepth } from './depth.ts';
import { AGENT_ACCENTS, GUARD_ACCENT, healthColor, HEX, lerpColor } from './palette.ts';
import { AGENT_TEXTURES, CHARACTER_ORIGIN, GUARD_TEXTURE, MUZZLE_OFFSET } from './textures/characters.ts';

const BAR_WIDTH = 50;
const BAR_HEIGHT = 6;
const TAG_SIZE = 16;
const HEAD_CLEARANCE = 118;
const FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';

/** Visual representation of one unit: sprite, shadow, health tag and selection ring. */
export class UnitView {
  readonly unit: Unit;
  readonly accent: number;
  /** Squad number shown on the tag (1, 2) for agents; 0 for guards. */
  readonly callsign: number;
  private readonly body: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly tag: Phaser.GameObjects.Text;
  private flashTimer = 0;
  private walkPhase = 0;
  private deathTimer = -1;
  private fallDirection = 1;

  constructor(scene: Phaser.Scene, unit: Unit, callsign: number) {
    this.unit = unit;
    this.callsign = callsign;
    const isAgent = unit.faction === 'agent';
    this.accent = isAgent ? AGENT_ACCENTS[(callsign - 1) % AGENT_ACCENTS.length].hex : GUARD_ACCENT.hex;
    const texture = isAgent ? AGENT_TEXTURES[(callsign - 1) % AGENT_TEXTURES.length] : GUARD_TEXTURE;
    this.shadow = scene.add.image(0, 0, 'fx-shadow').setDepth(DEPTH.shadows).setScale(0.62);
    this.body = scene.add.image(0, 0, texture).setOrigin(CHARACTER_ORIGIN.x, CHARACTER_ORIGIN.y);
    this.tag = scene.add
      .text(0, 0, isAgent ? String(callsign) : '!', {
        fontFamily: FONT,
        fontSize: '13px',
        fontStyle: 'bold',
        color: isAgent ? '#05070d' : '#ffffff',
      })
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH.overlayText);
    this.update(0);
  }

  /** Ground point in world pixels. */
  get ground(): Vec2 {
    return worldToScreen(this.unit);
  }

  /** Where bullets hit this unit, in world pixels. */
  get chest(): Vec2 {
    const g = this.ground;
    return { x: g.x, y: g.y - 54 };
  }

  get muzzle(): Vec2 {
    const g = this.ground;
    const offset = MUZZLE_OFFSET[this.unit.faction];
    return { x: g.x + (this.body.flipX ? -offset.x : offset.x), y: g.y + offset.y };
  }

  flash(): void {
    this.flashTimer = 0.08;
  }

  update(dt: number): void {
    const unit = this.unit;
    const g = this.ground;
    this.shadow.setPosition(g.x, g.y + 2);
    this.body.setDepth(sortedDepth(unit, 1));

    if (!isAlive(unit)) {
      this.updateDeath(dt, g);
      return;
    }

    // Face left or right on screen.
    const screenDx = unit.facing.x - unit.facing.y;
    if (Math.abs(screenDx) > 0.05) this.body.setFlipX(screenDx < 0);

    // A light walking bob; frame-rate independent.
    if (isMoving(unit)) this.walkPhase += dt * unit.speed * 4.2;
    else this.walkPhase = 0;
    const bob = Math.abs(Math.sin(this.walkPhase)) * 3;
    this.body.setPosition(g.x, g.y - bob);
    this.body.setRotation(isMoving(unit) ? Math.sin(this.walkPhase * 2) * 0.025 : 0);

    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      this.body.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    } else {
      this.body.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    }

    const showTag = unit.faction === 'agent' || unit.alerted;
    this.tag.setVisible(showTag);
    this.tag.setPosition(g.x - BAR_WIDTH / 2 - TAG_SIZE / 2 + 4, g.y - HEAD_CLEARANCE);
  }

  private updateDeath(dt: number, g: Vec2): void {
    if (this.deathTimer < 0) {
      this.deathTimer = 0;
      this.fallDirection = this.body.flipX ? 1 : -1;
      this.tag.setVisible(false);
      this.body.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    }
    this.deathTimer += dt;
    const t = Math.min(1, this.deathTimer / 0.35);
    const eased = 1 - (1 - t) * (1 - t);
    this.body.setPosition(g.x, g.y);
    this.body.setRotation(this.fallDirection * eased * (Math.PI / 2) * 0.92);
    this.body.setTint(lerpColor(0xffffff, 0x4a5060, eased));
    this.body.setAlpha(1 - eased * 0.25);
    this.shadow.setAlpha(1 - eased * 0.5);
  }

  /** Health bar and tag background, drawn into the shared overlay graphics. */
  drawOverlay(g: Phaser.GameObjects.Graphics): void {
    const unit = this.unit;
    if (!isAlive(unit)) return;
    const ground = this.ground;
    const x = ground.x - BAR_WIDTH / 2 + 8;
    const y = ground.y - HEAD_CLEARANCE - BAR_HEIGHT / 2;
    const fraction = unit.hp / unit.maxHp;
    const isAgent = unit.faction === 'agent';

    // Tag.
    const tagX = x - TAG_SIZE - 3;
    const tagY = ground.y - HEAD_CLEARANCE - TAG_SIZE / 2;
    if (isAgent || unit.alerted) {
      g.fillStyle(isAgent ? this.accent : HEX.hostile, 1);
      g.fillRect(tagX, tagY, TAG_SIZE, TAG_SIZE);
      g.lineStyle(1, 0x000000, 0.6);
      g.strokeRect(tagX, tagY, TAG_SIZE, TAG_SIZE);
    } else {
      // Unalerted guards show a small hostile diamond.
      const cx = tagX + TAG_SIZE / 2;
      const cy = tagY + TAG_SIZE / 2;
      g.fillStyle(HEX.hostile, 0.9);
      g.fillTriangle(cx - 6, cy, cx, cy - 6, cx + 6, cy);
      g.fillTriangle(cx - 6, cy, cx, cy + 6, cx + 6, cy);
    }

    // Segmented bar.
    g.fillStyle(0x05070d, 0.85);
    g.fillRect(x - 1, y - 1, BAR_WIDTH + 2, BAR_HEIGHT + 2);
    g.fillStyle(isAgent ? healthColor(fraction) : HEX.hostile, 1);
    g.fillRect(x, y, BAR_WIDTH * fraction, BAR_HEIGHT);
    g.fillStyle(0x05070d, 0.9);
    for (let i = 1; i < 5; i++) g.fillRect(x + (BAR_WIDTH / 5) * i - 0.5, y, 1, BAR_HEIGHT);
  }

  destroy(): void {
    this.body.destroy();
    this.shadow.destroy();
    this.tag.destroy();
  }
}
