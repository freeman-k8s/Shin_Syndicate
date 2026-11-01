import { Selection } from './input/selection.ts';
import type { World } from './core/world.ts';

export type MessageTone = 'info' | 'warning' | 'success' | 'danger';

export interface HudMessage {
  readonly id: number;
  readonly text: string;
  readonly tone: MessageTone;
}

/** Screen rectangle (in game canvas pixels) covered by a HUD panel. */
export interface ScreenRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * State shared by the world scene and the HUD scene for one play-through:
 * the simulation, the player's selection, pause state and the latest notice.
 */
export class GameSession {
  readonly world: World;
  readonly selection = new Selection();
  paused = false;
  message: HudMessage | null = null;
  /** HUD panels register themselves here so clicks on them do not reach the map. */
  hudRects: ScreenRect[] = [];
  private nextMessageId = 1;

  constructor(world: World) {
    this.world = world;
  }

  notify(text: string, tone: MessageTone = 'info'): void {
    this.message = { id: this.nextMessageId++, text, tone };
  }

  togglePause(): void {
    if (this.world.status !== 'playing') return;
    this.paused = !this.paused;
  }

  isOverHud(x: number, y: number): boolean {
    return this.hudRects.some((r) => x >= r.x && y >= r.y && x <= r.x + r.width && y <= r.y + r.height);
  }
}
