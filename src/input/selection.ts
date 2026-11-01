import { isAlive, type Unit } from '../core/units.ts';

/** Which friendly agents the player currently commands. Pure state, no input handling. */
export class Selection {
  private readonly ids = new Set<number>();

  get size(): number {
    return this.ids.size;
  }

  has(id: number): boolean {
    return this.ids.has(id);
  }

  list(): number[] {
    return [...this.ids];
  }

  /** Plain click: select only this agent. */
  selectOnly(id: number): void {
    this.ids.clear();
    this.ids.add(id);
  }

  /** Shift-click: add the agent, or remove it if it is already selected. */
  toggle(id: number): void {
    if (this.ids.has(id)) this.ids.delete(id);
    else this.ids.add(id);
  }

  clear(): void {
    this.ids.clear();
  }

  /** Drops agents that have died or no longer exist. */
  prune(units: readonly Unit[]): void {
    for (const id of this.ids) {
      const unit = units.find((candidate) => candidate.id === id);
      if (!unit || !isAlive(unit)) this.ids.delete(id);
    }
  }
}
