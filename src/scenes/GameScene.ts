import Phaser from 'phaser';
import { tileCenter, worldToScreen } from '../core/iso.ts';
import { createMissionWorld } from '../core/scenario.ts';
import { isAlive, type Unit } from '../core/units.ts';
import { installDebugHook } from '../debug.ts';
import { CommandInput } from '../input/CommandInput.ts';
import { CityView } from '../render/CityView.ts';
import { Effects } from '../render/Effects.ts';
import { fillPoly, strokePoly } from '../render/graphics.ts';
import { HEX } from '../render/palette.ts';
import { Rain } from '../render/Rain.ts';
import type { CityArt } from '../render/textures/index.ts';
import { UnitView } from '../render/UnitView.ts';
import { GameSession } from '../session.ts';
import { REGISTRY, SCENES } from './keys.ts';

/** Longest simulated step; protects the simulation after the tab was in the background. */
const MAX_STEP = 0.1;

/** The isometric world: owns the simulation for one play-through and renders it. */
export class GameScene extends Phaser.Scene {
  private session!: GameSession;
  private city!: CityView;
  private views: UnitView[] = [];
  private effects!: Effects;
  private rain!: Rain;
  private commands!: CommandInput;
  private clock = 0;

  constructor() {
    super(SCENES.game);
  }

  create(): void {
    const art = this.registry.get(REGISTRY.cityArt) as CityArt;
    this.session = new GameSession(createMissionWorld());
    this.clock = 0;
    const world = this.session.world;

    this.setupCamera();
    this.city = new CityView(this, world.map, art);
    let agentNumber = 0;
    this.views = world.units.map((unit) => new UnitView(this, unit, unit.faction === 'agent' ? ++agentNumber : 0));
    this.effects = new Effects(this);
    const view = this.cameras.main.worldView;
    this.rain = new Rain(this, new Phaser.Geom.Rectangle(view.x, view.y, view.width, view.height));
    this.commands = new CommandInput(this, this.session, this.effects);

    const keyboard = this.input.keyboard;
    keyboard?.addCapture([Phaser.Input.Keyboard.KeyCodes.SPACE]);
    keyboard?.on('keydown-SPACE', () => this.session.togglePause());
    keyboard?.on('keydown-R', () => this.scene.restart());

    this.session.notify('Eliminate both Halcyon guards', 'info');

    // Restart the HUD so it binds to this play-through's session.
    this.scene.stop(SCENES.hud);
    this.scene.launch(SCENES.hud, { session: this.session });

    installDebugHook(this, this.session);
  }

  private setupCamera(): void {
    const camera = this.cameras.main;
    camera.setBackgroundColor(HEX.background);
    // Fit the whole 16 × 16 block plus the tallest rooftops into the view.
    const left = -16 * 64 - 30;
    const right = 16 * 64 + 30;
    const top = -200;
    const bottom = 16 * 64 + 30;
    const zoom = Math.min(this.scale.width / (right - left), this.scale.height / (bottom - top));
    camera.setZoom(zoom);
    camera.centerOn((left + right) / 2, (top + bottom) / 2);
    camera.preRender(); // refresh worldView now; the rain layer is sized from it
  }

  override update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, MAX_STEP);
    this.clock += dt;
    const { world, selection } = this.session;

    if (!this.session.paused) world.update(dt);
    this.handleWorldEvents();
    selection.prune(world.units);

    this.effects.update(dt);
    for (const view of this.views) view.update(this.session.paused ? 0 : dt);
    this.city.update(world.units, dt);
    this.drawGuides();
    for (const view of this.views) view.drawOverlay(this.effects.overlay);
    this.rain.update(dt);
  }

  private viewOf(unitId: number): UnitView | undefined {
    return this.views.find((view) => view.unit.id === unitId);
  }

  private handleWorldEvents(): void {
    for (const event of this.session.world.drainEvents()) {
      switch (event.type) {
        case 'shot': {
          const shooter = this.viewOf(event.shooterId);
          const target = this.viewOf(event.targetId);
          if (shooter && target) {
            this.effects.shot(shooter.muzzle, target.chest, shooter.accent);
            target.flash();
          }
          break;
        }
        case 'death': {
          const view = this.viewOf(event.unitId);
          if (!view) break;
          this.effects.deathBurst(view.ground, view.accent);
          const name = view.unit.name;
          this.session.notify(
            view.unit.faction === 'guard' ? `${name} neutralised` : `Agent ${name} is down`,
            view.unit.faction === 'guard' ? 'success' : 'danger',
          );
          break;
        }
        case 'alert': {
          const view = this.viewOf(event.unitId);
          if (view) this.session.notify(`${view.unit.name} has spotted the squad`, 'danger');
          break;
        }
        case 'status':
          this.session.paused = false;
          break;
      }
    }
  }

  /** Selection rings, hover highlights, planned paths and guard ranges. */
  private drawGuides(): void {
    const { world, selection } = this.session;
    const fx = this.effects;
    const hovered = this.commands.hoveredUnit;

    if (this.commands.hoveredTile && !hovered && world.status === 'playing') {
      const c = worldToScreen(tileCenter(this.commands.hoveredTile));
      fx.decal.lineStyle(1.5, HEX.friendly, 0.35);
      strokePoly(
        fx.decal,
        [
          { x: c.x, y: c.y - 32 },
          { x: c.x + 64, y: c.y },
          { x: c.x, y: c.y + 32 },
          { x: c.x - 64, y: c.y },
        ],
        true,
      );
    }

    for (const view of this.views) {
      const unit = view.unit;
      if (!isAlive(unit)) continue;
      const ground = view.ground;

      if (unit.faction === 'guard') {
        // Weapon range on the ground; brighter once the guard is alerted.
        const radius = unit.weapon.range * 64 * Math.SQRT2;
        fx.decal.lineStyle(1.5, HEX.hostile, unit.alerted ? 0.32 : 0.12);
        fx.decal.strokeEllipse(ground.x, ground.y, radius * 2, radius);
        if (hovered === unit) fx.ring(ground, 30, HEX.hostile, 0.9, -this.clock * 1.5);
        continue;
      }

      const selected = selection.has(unit.id);
      if (selected) {
        fx.ring(ground, 30, HEX.friendly, 0.95, this.clock * 1.2);
        this.drawPath(unit);
      } else if (hovered === unit) {
        fx.ring(ground, 30, HEX.friendly, 0.45, this.clock * 1.2);
      }

      if (unit.order.kind === 'attack') {
        const target = this.viewOf(unit.order.targetId);
        if (target && isAlive(target.unit)) {
          fx.targetBrackets({ x: target.ground.x, y: target.ground.y - 50 }, HEX.hostile, 0.75, this.clock);
        }
      }
    }
  }

  private drawPath(unit: Unit): void {
    if (unit.path.length === 0) return;
    const g = this.effects.decal;
    const points = [worldToScreen(unit), ...unit.path.map((tile) => worldToScreen(tileCenter(tile)))];
    g.lineStyle(2, HEX.friendly, 0.4);
    strokePoly(g, points, false);
    const end = points[points.length - 1];
    g.fillStyle(HEX.friendly, 0.5);
    fillPoly(
      g,
      [
        { x: end.x, y: end.y - 9 },
        { x: end.x + 18, y: end.y },
        { x: end.x, y: end.y + 9 },
        { x: end.x - 18, y: end.y },
      ]);
  }
}
