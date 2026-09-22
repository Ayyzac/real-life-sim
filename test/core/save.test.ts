import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createWorld, SCHEMA_VERSION } from '../../src/core/character';
import {
  LocalStorageSaveProvider,
  SAVE_KEY,
  type StorageLike,
} from '../../src/core/save/LocalStorageSaveProvider';
import { advanceWeek } from '../../src/core/clock';

/** Stand-in for localStorage so the core stays testable without a browser. */
function fakeStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

let storage: ReturnType<typeof fakeStorage>;
let saves: LocalStorageSaveProvider;

beforeEach(() => {
  storage = fakeStorage();
  saves = new LocalStorageSaveProvider(storage);
});

describe('LocalStorageSaveProvider', () => {
  it('returns null when nothing has been saved', () => {
    expect(saves.load()).toBeNull();
  });

  it('survives a full round trip unchanged', () => {
    const state = advanceWeek(createWorld({ name: 'Ayu', backgroundId: 'scholarship', seed: 7 }));

    saves.save(state);

    expect(saves.load()).toEqual(state);
  });

  it('writes to the documented key', () => {
    saves.save(createWorld({ name: 'Ayu', backgroundId: 'athlete', seed: 1 }));
    expect(storage.data.has(SAVE_KEY)).toBe(true);
  });

  it('treats a corrupted save as no save instead of crashing', () => {
    storage.setItem(SAVE_KEY, '{ this is not json');
    expect(saves.load()).toBeNull();
  });

  it('discards a save written by an older schema', () => {
    const state = createWorld({ name: 'Ayu', backgroundId: 'athlete', seed: 1 });
    storage.setItem(SAVE_KEY, JSON.stringify({ ...state, schemaVersion: SCHEMA_VERSION - 1 }));

    expect(saves.load()).toBeNull();
  });

  it('discards a save that parses but is missing the character', () => {
    storage.setItem(SAVE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, clockDay: 3 }));
    expect(saves.load()).toBeNull();
  });

  it('clear() removes the save', () => {
    saves.save(createWorld({ name: 'Ayu', backgroundId: 'athlete', seed: 1 }));
    saves.clear();

    expect(saves.load()).toBeNull();
  });

  it('does not throw when storage is unavailable, as in private browsing', () => {
    const unavailable = new LocalStorageSaveProvider(null);
    const state = createWorld({ name: 'Ayu', backgroundId: 'athlete', seed: 1 });

    expect(() => unavailable.save(state)).not.toThrow();
    expect(unavailable.load()).toBeNull();
    expect(() => unavailable.clear()).not.toThrow();
  });

  it('does not throw when the storage quota is exceeded', () => {
    const full: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: vi.fn(),
    };
    const provider = new LocalStorageSaveProvider(full);

    expect(() =>
      provider.save(createWorld({ name: 'Ayu', backgroundId: 'athlete', seed: 1 })),
    ).not.toThrow();
  });

  it('keeps the RNG position, so reloading continues the same random sequence', () => {
    const state = advanceWeek(createWorld({ name: 'Ayu', backgroundId: 'athlete', seed: 99 }));
    saves.save(state);

    expect(saves.load()?.rng).toEqual(state.rng);
  });
});
