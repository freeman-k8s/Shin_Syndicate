import type Phaser from 'phaser';
import { worldToScreen } from './core/iso.ts';
import type { GameSession } from './session.ts';

/**
 * Optional hook for automated browser tests, enabled only with `?debug` in the
 * URL. It exposes the live session and a world → browser pixel conversion.
 */
export interface DebugApi {
  readonly game: Phaser.Game;
  readonly session: GameSession;
  worldToClient(x: number, y: number): { x: number; y: number };
}

declare global {
  interface Window {
    __shin?: DebugApi;
  }
}

export function installDebugHook(scene: Phaser.Scene, session: GameSession): void {
  if (!new URLSearchParams(window.location.search).has('debug')) return;
  window.__shin = {
    game: scene.game,
    session,
    worldToClient(x, y) {
      const camera = scene.cameras.main;
      const s = worldToScreen({ x, y });
      const gameX = (s.x - camera.worldView.x) * camera.zoom + camera.x;
      const gameY = (s.y - camera.worldView.y) * camera.zoom + camera.y;
      const rect = scene.game.canvas.getBoundingClientRect();
      return {
        x: rect.left + (gameX * rect.width) / scene.scale.width,
        y: rect.top + (gameY * rect.height) / scene.scale.height,
      };
    },
  };
}
