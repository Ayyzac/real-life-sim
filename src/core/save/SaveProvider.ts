import type { WorldState } from '../types';

/**
 * How the game persists (docs/ARCHITECTURE.md §7). Everything else talks to
 * this interface, never to localStorage directly, so swapping the backing
 * store later touches one file.
 */
export interface SaveProvider {
  save(state: WorldState): void;
  /** null when there is nothing to load, or the save is unreadable. */
  load(): WorldState | null;
  clear(): void;
}
