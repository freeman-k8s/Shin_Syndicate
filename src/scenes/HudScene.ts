import Phaser from 'phaser';
import { buildingAt, groundAt, propAt, type CityMap } from '../core/cityMap.ts';
import { isAlive, type Unit } from '../core/units.ts';
import { drawPanel, hudText } from '../hud/widgets.ts';
import { fillPoly, strokePoly } from '../render/graphics.ts';
import { AGENT_ACCENTS, CSS, healthColor, HEX } from '../render/palette.ts';
import { PORTRAIT_TEXTURES } from '../render/textures/characters.ts';
import type { GameSession, MessageTone, ScreenRect } from '../session.ts';
import { SCENES } from './keys.ts';

const W = 1920;
const H = 1080;
const MARGIN = 24;

const TONE_COLORS: Readonly<Record<MessageTone, number>> = {
  info: HEX.friendly,
  warning: 0xffc857,
  success: 0x5cffb0,
  danger: HEX.hostile,
};

interface SquadCard {
  readonly unit: Unit;
  readonly rect: ScreenRect;
  readonly accent: number;
  readonly portrait: Phaser.GameObjects.Image;
  readonly state: Phaser.GameObjects.Text;
  readonly hp: Phaser.GameObjects.Text;
  readonly selected: Phaser.GameObjects.Text;
}

/** Screen-space interface drawn above the world: mission info, squad status, notices and overlays. */
export class HudScene extends Phaser.Scene {
  private session!: GameSession;
  private dynamic!: Phaser.GameObjects.Graphics;
  private cards: SquadCard[] = [];
  private hostilesCount!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private toast!: Phaser.GameObjects.Text;
  private toastAge = Infinity;
  private shownMessageId = 0;
  private pauseLayer!: Phaser.GameObjects.Container;
  private endLayer!: Phaser.GameObjects.Container;
  private endTitle!: Phaser.GameObjects.Text;
  private endSubtitle!: Phaser.GameObjects.Text;
  private endPrompt!: Phaser.GameObjects.Text;
  private endShownFor = 0;
  private readonly minimap = { x: 0, y: 0, tileW: 14, tileH: 7 };
  private readonly objectiveRect: ScreenRect = { x: W - MARGIN - 400, y: 20, width: 400, height: 150 };

  constructor() {
    super(SCENES.hud);
  }

  init(data: { session: GameSession }): void {
    this.session = data.session;
    this.cards = [];
    this.toastAge = Infinity;
    this.shownMessageId = 0;
    this.endShownFor = 0;
  }

  create(): void {
    this.add.image(0, 0, 'fx-vignette').setOrigin(0, 0).setDisplaySize(W, H);
    const panels = this.add.graphics();
    this.dynamic = this.add.graphics().setDepth(1);

    const mapRect = { x: MARGIN, y: 20, width: 330, height: 222 };
    const controlsRect = { x: W - MARGIN - 390, y: H - MARGIN - 156, width: 390, height: 156 };
    drawPanel(panels, mapRect, HEX.friendly);
    drawPanel(panels, this.objectiveRect, HEX.hostile, false);
    drawPanel(panels, controlsRect, HEX.friendly, false);

    this.buildMinimap(panels, mapRect);
    this.buildObjective();
    this.buildControls(controlsRect);
    this.buildSquadCards(panels);

    this.toast = hudText(this, W / 2, 36, '', 18, '#ffffff', { bold: true, spacing: 1, origin: [0.5, 0.5] }).setDepth(3);
    this.buildPauseLayer();
    this.buildEndLayer();

    this.session.hudRects = [mapRect, this.objectiveRect, controlsRect, ...this.cards.map((card) => card.rect)];
  }

  // ---------------------------------------------------------------------------
  // Construction
  // ---------------------------------------------------------------------------

  private buildMinimap(g: Phaser.GameObjects.Graphics, rect: ScreenRect): void {
    hudText(this, rect.x + 18, rect.y + 16, 'MERIDIAN WARD', 19, '#e6fbff', { bold: true, spacing: 3 });
    hudText(this, rect.x + 18, rect.y + 42, 'Sector 7  ·  Halcyon Plaza', 13, '#7fa7b8', { spacing: 1 });
    const map = this.session.world.map;
    this.minimap.x = rect.x + rect.width / 2;
    this.minimap.y = rect.y + 80;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        g.fillStyle(minimapColor(map, x, y), 1);
        fillPoly(g, this.minimapDiamond(x, y));
      }
    }
    g.lineStyle(1, HEX.friendly, 0.35);
    strokePoly(
      g,
      [this.minimapPoint(0, 0), this.minimapPoint(map.width, 0), this.minimapPoint(map.width, map.height), this.minimapPoint(0, map.height)],
      true,
    );
  }

  private buildObjective(): void {
    const r = this.objectiveRect;
    hudText(this, r.x + 22, r.y + 16, 'OBJECTIVE', 13, CSS.crimson, { bold: true, spacing: 4 });
    hudText(this, r.x + 22, r.y + 38, 'Eliminate both Halcyon security guards', 17, '#e6fbff');
    hudText(this, r.x + 22, r.y + 80, 'HOSTILES', 12, '#7fa7b8', { spacing: 3 });
    this.hostilesCount = hudText(this, r.x + 22, r.y + 96, '2', 34, '#ffffff', { bold: true, mono: true });
    this.statusText = hudText(this, r.x + r.width - 22, r.y + 116, '', 14, CSS.teal, {
      bold: true,
      mono: true,
      origin: [1, 0],
    });
  }

  private buildControls(rect: ScreenRect): void {
    hudText(this, rect.x + 20, rect.y + 14, 'CONTROLS', 13, CSS.teal, { bold: true, spacing: 4 });
    const rows: [string, string][] = [
      ['LMB', 'Select agent'],
      ['SHIFT + LMB', 'Add / remove agent'],
      ['RMB ground', 'Move selected agents'],
      ['RMB guard', 'Attack target'],
      ['SPACE  ·  R', 'Pause  ·  Restart'],
    ];
    rows.forEach(([key, action], i) => {
      const y = rect.y + 40 + i * 22;
      hudText(this, rect.x + 20, y, key, 13, CSS.cyan, { bold: true, mono: true });
      hudText(this, rect.x + 168, y, action, 14, '#c6d9e2');
    });
  }

  private buildSquadCards(panels: Phaser.GameObjects.Graphics): void {
    const agents = this.session.world.units.filter((unit) => unit.faction === 'agent');
    agents.forEach((unit, i) => {
      const rect = { x: MARGIN + i * 372, y: H - MARGIN - 128, width: 356, height: 128 };
      const accent = AGENT_ACCENTS[i % AGENT_ACCENTS.length];
      drawPanel(panels, rect, accent.hex);
      const portrait = this.add
        .image(rect.x + 16, rect.y + 24, PORTRAIT_TEXTURES[i % PORTRAIT_TEXTURES.length])
        .setOrigin(0, 0);
      panels.lineStyle(2, accent.hex, 0.9);
      panels.strokeRect(rect.x + 15, rect.y + 23, 86, 86);
      panels.fillStyle(accent.hex, 1);
      panels.fillRect(rect.x + 15, rect.y + 23, 20, 20);
      hudText(this, rect.x + 25, rect.y + 33, String(i + 1), 14, '#05070d', { bold: true, origin: [0.5, 0.5] });
      hudText(this, rect.x + 116, rect.y + 18, unit.name, 22, accent.css, { bold: true, spacing: 3 });
      hudText(this, rect.x + 116, rect.y + 50, `${unit.weapon.name}  ·  DMG ${unit.weapon.damage}  ·  RNG ${unit.weapon.range}`, 12, '#7fa7b8');
      this.cards.push({
        unit,
        rect,
        accent: accent.hex,
        portrait,
        state: hudText(this, rect.x + rect.width - 18, rect.y + 100, '', 12, '#c6d9e2', { bold: true, spacing: 1, origin: [1, 0] }),
        hp: hudText(this, rect.x + 116, rect.y + 100, '', 12, '#c6d9e2', { mono: true }),
        selected: hudText(this, rect.x + rect.width - 18, rect.y + 24, 'SELECTED', 12, accent.css, {
          bold: true,
          spacing: 2,
          origin: [1, 0],
        }),
      });
    });
  }

  private buildPauseLayer(): void {
    const shade = this.add.rectangle(0, 0, W, H, 0x02040a, 0.35).setOrigin(0, 0);
    const band = this.add.rectangle(W / 2, H / 2, W, 120, 0x05090f, 0.8);
    const title = hudText(this, W / 2, H / 2 - 18, 'TACTICAL PAUSE', 40, '#e6fbff', { bold: true, spacing: 10, origin: [0.5, 0.5] });
    const hint = hudText(this, W / 2, H / 2 + 28, 'Simulation halted  ·  orders can still be issued  ·  SPACE to resume', 16, CSS.teal, {
      spacing: 1,
      origin: [0.5, 0.5],
    });
    this.pauseLayer = this.add.container(0, 0, [shade, band, title, hint]).setDepth(5).setVisible(false);
  }

  private buildEndLayer(): void {
    const shade = this.add.rectangle(0, 0, W, H, 0x02040a, 0.62).setOrigin(0, 0);
    const panel = this.add.graphics();
    drawPanel(panel, { x: W / 2 - 380, y: H / 2 - 140, width: 760, height: 280 }, HEX.friendly);
    this.endTitle = hudText(this, W / 2, H / 2 - 62, '', 52, '#ffffff', { bold: true, spacing: 10, origin: [0.5, 0.5] });
    this.endSubtitle = hudText(this, W / 2, H / 2 + 6, '', 18, '#c6d9e2', { origin: [0.5, 0.5] });
    this.endPrompt = hudText(this, W / 2, H / 2 + 76, 'Press  R  to restart the operation', 20, CSS.teal, {
      bold: true,
      spacing: 3,
      origin: [0.5, 0.5],
    });
    this.endLayer = this.add
      .container(0, 0, [shade, panel, this.endTitle, this.endSubtitle, this.endPrompt])
      .setDepth(6)
      .setVisible(false);
  }

  // ---------------------------------------------------------------------------
  // Per-frame refresh
  // ---------------------------------------------------------------------------

  override update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    const { world, selection } = this.session;
    const g = this.dynamic;
    g.clear();

    this.drawMinimapUnits(g);

    // Objective.
    const guards = world.units.filter((unit) => unit.faction === 'guard');
    const remaining = guards.filter(isAlive).length;
    this.hostilesCount.setText(`${remaining}`);
    guards.forEach((guard, i) => {
      const x = this.objectiveRect.x + 78 + i * 30;
      const y = this.objectiveRect.y + 116;
      const alive = isAlive(guard);
      g.fillStyle(HEX.hostile, alive ? 1 : 0.18);
      fillPoly(
        g,
        [
          { x, y: y - 10 },
          { x: x + 10, y },
          { x, y: y + 10 },
          { x: x - 10, y },
        ]);
      if (!alive) {
        g.lineStyle(2, 0xffffff, 0.6);
        g.lineBetween(x - 7, y - 7, x + 7, y + 7);
      }
    });
    const clock = formatTime(world.elapsed);
    const ended = world.status !== 'playing';
    this.statusText.setText(ended ? `■ ENDED  ${clock}` : this.session.paused ? `|| PAUSED  ${clock}` : `● LIVE  ${clock}`);
    setColor(this.statusText, ended ? '#7fa7b8' : this.session.paused ? '#ffc857' : CSS.teal);

    // Squad cards.
    for (const card of this.cards) this.drawCard(g, card, selection.has(card.unit.id));

    this.updateToast(g, dt);
    this.pauseLayer.setVisible(this.session.paused && world.status === 'playing');
    this.updateEndLayer(dt);
  }

  private drawCard(g: Phaser.GameObjects.Graphics, card: SquadCard, selected: boolean): void {
    const { unit, rect } = card;
    const alive = isAlive(unit);
    const fraction = unit.hp / unit.maxHp;

    if (selected && alive) {
      g.lineStyle(2.5, card.accent, 0.95);
      g.strokeRect(rect.x - 3, rect.y - 3, rect.width + 6, rect.height + 6);
    }

    // Health bar with ten segments.
    const bx = rect.x + 116;
    const by = rect.y + 76;
    const bw = 222;
    const bh = 14;
    g.fillStyle(0x02050a, 1);
    g.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
    g.fillStyle(healthColor(fraction), alive ? 1 : 0);
    g.fillRect(bx, by, bw * fraction, bh);
    g.fillStyle(0x02050a, 1);
    for (let i = 1; i < 10; i++) g.fillRect(bx + (bw / 10) * i - 1, by, 2, bh);

    card.hp.setText(`HP ${String(Math.ceil(unit.hp)).padStart(3, ' ')} / ${unit.maxHp}`);
    card.selected.setVisible(selected && alive);
    card.state.setText(alive ? describeState(unit) : 'SIGNAL LOST');
    setColor(card.state, alive ? (unit.order.kind === 'attack' ? CSS.crimson : '#c6d9e2') : CSS.crimson);
    card.portrait.setTint(alive ? 0xffffff : 0x3a3f4a);

    if (!alive) {
      g.fillStyle(0x000000, 0.45);
      g.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
  }

  private drawMinimapUnits(g: Phaser.GameObjects.Graphics): void {
    const { world, selection } = this.session;
    let agentIndex = 0;
    for (const unit of world.units) {
      const p = this.minimapPoint(unit.x, unit.y);
      if (unit.faction === 'agent') {
        const accent = AGENT_ACCENTS[agentIndex++ % AGENT_ACCENTS.length].hex;
        if (!isAlive(unit)) {
          g.fillStyle(0x4a5060, 1);
          g.fillCircle(p.x, p.y, 3);
          continue;
        }
        if (selection.has(unit.id)) {
          g.lineStyle(1.5, accent, 0.9);
          g.strokeCircle(p.x, p.y, 7);
        }
        g.fillStyle(accent, 1);
        g.fillCircle(p.x, p.y, 4);
      } else {
        if (!isAlive(unit)) {
          g.lineStyle(1.5, 0x8a3040, 1);
          g.lineBetween(p.x - 3, p.y - 3, p.x + 3, p.y + 3);
          g.lineBetween(p.x - 3, p.y + 3, p.x + 3, p.y - 3);
          continue;
        }
        if (unit.alerted) {
          const pulse = 6 + Math.sin(world.elapsed * 8) * 2;
          g.lineStyle(1.5, HEX.hostile, 0.8);
          g.strokeCircle(p.x, p.y, pulse);
        }
        g.fillStyle(HEX.hostile, 1);
        g.fillCircle(p.x, p.y, 4);
      }
    }
  }

  private updateToast(g: Phaser.GameObjects.Graphics, dt: number): void {
    const message = this.session.message;
    if (message && message.id !== this.shownMessageId) {
      this.shownMessageId = message.id;
      this.toastAge = 0;
      this.toast.setText(message.text.toUpperCase());
      this.toast.setColor(`#${TONE_COLORS[message.tone].toString(16).padStart(6, '0')}`);
    }
    this.toastAge += dt;
    const alpha = this.toastAge < 2.2 ? 1 : Math.max(0, 1 - (this.toastAge - 2.2) / 0.5);
    this.toast.setAlpha(alpha);
    if (alpha <= 0 || !message) return;
    const width = this.toast.width + 60;
    g.fillStyle(0x05090f, 0.78 * alpha);
    g.fillRect(W / 2 - width / 2, 18, width, 36);
    g.fillStyle(TONE_COLORS[message.tone], alpha);
    g.fillRect(W / 2 - width / 2, 18, 4, 36);
    g.fillRect(W / 2 + width / 2 - 4, 18, 4, 36);
  }

  private updateEndLayer(dt: number): void {
    const { world } = this.session;
    if (world.status === 'playing') {
      this.endLayer.setVisible(false);
      return;
    }
    if (!this.endLayer.visible) {
      const victory = world.status === 'victory';
      const survivors = world.living('agent').length;
      this.endTitle.setText(victory ? 'MISSION COMPLETE' : 'SQUAD TERMINATED');
      this.endTitle.setColor(victory ? '#5cffb0' : CSS.crimson);
      this.endSubtitle.setText(
        victory
          ? `Both guards neutralised in ${formatTime(world.elapsed)}  ·  agents surviving ${survivors} / 2`
          : `Both agents lost after ${formatTime(world.elapsed)}  ·  hostiles remaining ${world.living('guard').length}`,
      );
      this.endLayer.setVisible(true).setAlpha(0);
      this.endShownFor = 0;
    }
    this.endShownFor += dt;
    this.endLayer.setAlpha(Math.min(1, this.endShownFor / 0.6));
    this.endPrompt.setAlpha(0.6 + Math.sin(this.endShownFor * 4) * 0.4);
  }

  // ---------------------------------------------------------------------------
  // Minimap projection
  // ---------------------------------------------------------------------------

  private minimapPoint(x: number, y: number): { x: number; y: number } {
    const m = this.minimap;
    return { x: m.x + ((x - y) * m.tileW) / 2, y: m.y + ((x + y) * m.tileH) / 2 };
  }

  private minimapDiamond(x: number, y: number): { x: number; y: number }[] {
    return [this.minimapPoint(x, y), this.minimapPoint(x + 1, y), this.minimapPoint(x + 1, y + 1), this.minimapPoint(x, y + 1)];
  }
}

function minimapColor(map: CityMap, x: number, y: number): number {
  if (buildingAt(map, x, y)) return 0x2b4256;
  if (propAt(map, x, y)) return 0x3d4452;
  switch (groundAt(map, x, y)) {
    case 'road':
    case 'crosswalk':
      return 0x0b1018;
    case 'plaza':
      return 0x1c3440;
    default:
      return 0x18212e;
  }
}

function describeState(unit: Unit): string {
  switch (unit.order.kind) {
    case 'move':
      return 'MOVING';
    case 'attack':
      return 'ENGAGING';
    default:
      return unit.targetId !== null ? 'RETURNING FIRE' : 'STANDING BY';
  }
}

/**
 * Text colour changes make Phaser redraw the text and re-upload its texture,
 * so only apply them when the colour actually changes.
 */
function setColor(text: Phaser.GameObjects.Text, color: string): void {
  if (text.style.color !== color) text.setColor(color);
}

function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}
