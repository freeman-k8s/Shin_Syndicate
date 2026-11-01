import Phaser from 'phaser';
import { inBounds } from '../core/cityMap.ts';
import { screenToWorld, tileCenter, worldToScreen, worldToTile } from '../core/iso.ts';
import type { GridPoint, Vec2 } from '../core/types.ts';
import type { Unit } from '../core/units.ts';
import type { Effects } from '../render/Effects.ts';
import { HEX } from '../render/palette.ts';
import type { GameSession } from '../session.ts';
import { pickUnit } from './picking.ts';

/**
 * Translates mouse input into selection changes and world commands.
 * Left click selects (Shift adds/removes), right click moves or attacks.
 */
export class CommandInput {
  /** What the cursor is over, for hover highlights. */
  hoveredUnit: Unit | undefined;
  hoveredTile: GridPoint | null = null;
  private readonly scene: Phaser.Scene;
  private readonly session: GameSession;
  private readonly effects: Effects;

  constructor(scene: Phaser.Scene, session: GameSession, effects: Effects) {
    this.scene = scene;
    this.session = session;
    this.effects = effects;
    scene.input.mouse?.disableContextMenu();
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
  }

  private worldPoint(pointer: Phaser.Input.Pointer): Vec2 {
    const p = pointer.positionToCamera(this.scene.cameras.main) as Phaser.Math.Vector2;
    return { x: p.x, y: p.y };
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.session.isOverHud(pointer.x, pointer.y)) {
      this.hoveredUnit = undefined;
      this.hoveredTile = null;
      return;
    }
    const point = this.worldPoint(pointer);
    const units = this.session.world.units;
    this.hoveredUnit = pickUnit(units, point, 'agent') ?? pickUnit(units, point, 'guard');
    const tile = worldToTile(screenToWorld(point));
    this.hoveredTile = inBounds(this.session.world.map, tile.x, tile.y) ? tile : null;
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.session.world.status !== 'playing') return;
    if (this.session.isOverHud(pointer.x, pointer.y)) return;
    const point = this.worldPoint(pointer);
    if (pointer.button === 0) this.select(point, pointer.event.shiftKey);
    else if (pointer.button === 2) this.command(point);
  }

  private select(point: Vec2, additive: boolean): void {
    const { selection, world } = this.session;
    const agent = pickUnit(world.units, point, 'agent');
    if (agent) {
      if (additive) selection.toggle(agent.id);
      else selection.selectOnly(agent.id);
    } else if (!additive) {
      selection.clear();
    }
  }

  private command(point: Vec2): void {
    const { selection, world } = this.session;
    if (selection.size === 0) {
      this.session.notify('No agent selected — left-click an agent first', 'warning');
      return;
    }

    const guard = pickUnit(world.units, point, 'guard');
    if (guard) {
      const attackers = world.commandAttack(selection.list(), guard.id);
      if (attackers.length > 0) {
        const ground = worldToScreen(guard);
        this.effects.attackMarker({ x: ground.x, y: ground.y - 50 }, HEX.hostile);
        this.session.notify(`Engaging ${guard.name}`, 'danger');
      }
      return;
    }

    const tile = worldToTile(screenToWorld(point));
    if (!inBounds(world.map, tile.x, tile.y)) {
      this.effects.invalidMarker(point, HEX.invalid);
      this.session.notify('Outside the operation zone', 'warning');
      return;
    }

    const assignments = world.commandMove(selection.list(), tile);
    let reachable = 0;
    assignments.forEach((assignment, index) => {
      if (assignment.destination) {
        reachable++;
        this.effects.moveMarker(worldToScreen(tileCenter(assignment.destination)), HEX.move, index * 0.06);
      }
    });
    if (reachable === 0) {
      this.effects.invalidMarker(worldToScreen(tileCenter(tile)), HEX.invalid);
      this.session.notify('Destination unreachable', 'warning');
    } else {
      this.session.notify(reachable > 1 ? 'Squad moving' : 'Moving', 'info');
    }
  }
}
