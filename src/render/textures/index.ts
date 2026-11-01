import type Phaser from 'phaser';
import type { CityMap, PropKind } from '../../core/cityMap.ts';
import { createBuildingTextures, type TileSprite } from './buildings.ts';
import { createCharacterTextures, createEffectTextures } from './characters.ts';
import { createGroundTexture, type GroundTexture } from './ground.ts';
import { createLampTexture, createPropTextures, type PropTexture } from './props.ts';

/** Where the generated city textures go; produced once at boot and reused on restart. */
export interface CityArt {
  readonly ground: GroundTexture;
  readonly buildings: readonly TileSprite[];
  readonly props: Readonly<Record<PropKind, PropTexture>>;
  readonly lamp: PropTexture;
}

export function createAllTextures(scene: Phaser.Scene, map: CityMap): CityArt {
  createEffectTextures(scene);
  createCharacterTextures(scene);
  return {
    ground: createGroundTexture(scene, map),
    buildings: createBuildingTextures(scene, map),
    props: createPropTextures(scene),
    lamp: createLampTexture(scene),
  };
}
