import { SCHEMA_VERSION } from '../character';
import type { WorldState } from '../types';
import type { SaveProvider } from './SaveProvider';

export const SAVE_KEY = 'real-life-sim:save:v1';

/**
 * Anything with the three localStorage methods we use. Injectable so the core
 * stays testable headlessly - see test/core/save.test.ts.
 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * One save slot, in the browser (CLAUDE.md: no server, no cloud saves).
 *
 * Every operation is wrapped: private browsing, a full quota, or a save file
 * corrupted by a half-finished write must never crash the game. A bad save is
 * treated as "no save" so the player can always start fresh.
 */
export class LocalStorageSaveProvider implements SaveProvider {
  constructor(
    private readonly storage: StorageLike | null = safeLocalStorage(),
    private readonly key: string = SAVE_KEY,
  ) {}

  save(state: WorldState): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(this.key, JSON.stringify(state));
    } catch {
      // Quota exceeded or storage disabled: losing the autosave is survivable,
      // crashing mid-play is not.
    }
  }

  load(): WorldState | null {
    if (!this.storage) return null;
    try {
      const raw = this.storage.getItem(this.key);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as Partial<WorldState>;
      // Place for migration logic when the shape changes (ARCHITECTURE §7).
      // Until then an older save is discarded rather than half-read.
      if (parsed.schemaVersion !== SCHEMA_VERSION) return null;
      if (!parsed.character || typeof parsed.clockDay !== 'number') return null;

      return parsed as WorldState;
    } catch {
      return null;
    }
  }

  clear(): void {
    if (!this.storage) return;
    try {
      this.storage.removeItem(this.key);
    } catch {
      // Nothing useful to do; the next save overwrites it anyway.
    }
  }
}

/** localStorage is absent in tests and can throw on access in private mode. */
function safeLocalStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
