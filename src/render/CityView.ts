import Phaser from 'phaser';
import { PROP_BLOCKS_SIGHT, type CityMap } from '../core/cityMap.ts';
import { TILE_HEIGHT, TILE_WIDTH, worldToScreen } from '../core/iso.ts';
import { isAlive, type Unit } from '../core/units.ts';
import { LAMP_POSTS } from './cityStyle.ts';
import { DEPTH, sortedDepth } from './depth.ts';
import { buildingHeight } from './textures/buildings.ts';
import type { CityArt } from './textures/index.ts';
import { LAMP_HEAD_HEIGHT } from './textures/props.ts';

/** A static object tall enough to hide units standing behind it. */
interface Occluder {
  readonly image: Phaser.GameObjects.Image;
  /** x + y of the occluder's tile centre. */
  readonly depthKey: number;
  readonly centreX: number;
  readonly groundY: number;
  readonly halfWidth: number;
  readonly height: number;
}

const UNIT_HALF_WIDTH = 18;
const UNIT_HEIGHT = 100;
/** Vertical overlap (px) needed before an occluder fades; grazing a unit's feet is not enough. */
const MIN_OVERLAP = 24;
const FADED_ALPHA = 0.32;

/** Renders the city from the pre-generated textures and fades buildings that hide units. */
export class CityView {
  private readonly occluders: Occluder[] = [];

  constructor(scene: Phaser.Scene, map: CityMap, art: CityArt) {
    scene.add.image(art.ground.left, art.ground.top, art.ground.key).setOrigin(0, 0).setDepth(DEPTH.ground);

    for (const tile of art.buildings) {
      const centre = { x: tile.tileX + 0.5, y: tile.tileY + 0.5 };
      const screen = worldToScreen(centre);
      const image = scene.add
        .image(screen.x, screen.y, tile.key)
        .setOrigin(tile.originX, tile.originY)
        .setDepth(sortedDepth(centre));
      const building = map.buildings[map.buildingIndex[tile.tileY * map.width + tile.tileX]];
      this.occluders.push({
        image,
        depthKey: centre.x + centre.y,
        centreX: screen.x,
        groundY: screen.y,
        halfWidth: TILE_WIDTH / 2,
        height: buildingHeight(building),
      });
    }

    for (const prop of map.props) {
      const centre = { x: prop.x + 0.5, y: prop.y + 0.5 };
      const screen = worldToScreen(centre);
      const texture = art.props[prop.kind];
      const image = scene.add
        .image(screen.x, screen.y, texture.key)
        .setOrigin(texture.originX, texture.originY)
        .setDepth(sortedDepth(centre));
      if (PROP_BLOCKS_SIGHT[prop.kind]) {
        this.occluders.push({
          image,
          depthKey: centre.x + centre.y,
          centreX: screen.x,
          groundY: screen.y,
          halfWidth: 26,
          height: 110,
        });
      }
    }

    for (const lamp of LAMP_POSTS) {
      const screen = worldToScreen(lamp);
      const tint = Phaser.Display.Color.HexStringToColor(lamp.color).color;
      scene.add
        .image(screen.x, screen.y, art.lamp.key)
        .setOrigin(art.lamp.originX, art.lamp.originY)
        .setDepth(sortedDepth(lamp))
        .setTint(tint);
      scene.add
        .image(screen.x, screen.y - LAMP_HEAD_HEIGHT + 2, 'fx-glow')
        .setDepth(sortedDepth(lamp, 0.1))
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(tint)
        .setAlpha(0.55)
        .setScale(1.3, 0.8);
    }
  }

  /** Eases occluders towards transparency while any living unit stands behind them. */
  update(units: readonly Unit[], dt: number): void {
    const ease = Math.min(1, dt * 10);
    for (const occluder of this.occluders) {
      const hiding = units.some((unit) => isAlive(unit) && this.hides(occluder, unit));
      const target = hiding ? FADED_ALPHA : 1;
      occluder.image.setAlpha(occluder.image.alpha + (target - occluder.image.alpha) * ease);
    }
  }

  private hides(occluder: Occluder, unit: Unit): boolean {
    if (unit.x + unit.y >= occluder.depthKey) return false;
    const screen = worldToScreen(unit);
    const gap = Math.max(0, Math.abs(screen.x - occluder.centreX) - UNIT_HALF_WIDTH);
    if (gap >= occluder.halfWidth) return false;
    // The occluder's silhouette narrows towards its left and right corners like the tile diamond.
    const slope = (gap / (TILE_WIDTH / 2)) * (TILE_HEIGHT / 2);
    const bottom = occluder.groundY + TILE_HEIGHT / 2 - slope;
    const top = occluder.groundY - TILE_HEIGHT / 2 - occluder.height + slope;
    const overlap = Math.min(screen.y, bottom) - Math.max(screen.y - UNIT_HEIGHT, top);
    return overlap > MIN_OVERLAP;
  }
}
