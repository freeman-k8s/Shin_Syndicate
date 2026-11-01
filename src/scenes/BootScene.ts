import Phaser from 'phaser';
import { createCityMap } from '../core/cityMap.ts';
import { createAllTextures } from '../render/textures/index.ts';
import { REGISTRY, SCENES } from './keys.ts';

/** Generates every procedural texture once, then starts the mission. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  create(): void {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, 'ESTABLISHING UPLINK…', {
        fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
        fontSize: '22px',
        color: '#35f2d0',
      })
      .setOrigin(0.5)
      .setLetterSpacing(6);
    // Let the loading text render before the (synchronous) texture generation starts.
    this.time.delayedCall(30, () => {
      this.registry.set(REGISTRY.cityArt, createAllTextures(this, createCityMap()));
      this.scene.start(SCENES.game);
    });
  }
}
