import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createWorld, SCHEMA_VERSION } from '../../src/core/character';
import {
  LocalStorageSaveProvider,
  SAVE_KEY,
  type StorageLike,
  withKnownIds,
} from '../../src/core/save/LocalStorageSaveProvider';
import { advanceWeek } from '../../src/core/clock';
import { DEFAULT_LIFESTYLE_ID } from '../../src/data/lifestyles';

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

  it('migrates the previous schema rather than discarding it', () => {
    // This test used to assert the opposite. Until Phase 5 an older save was
    // thrown away on the grounds that nobody was playing yet; the user decided
    // on 22 Sep 2026 that a character halfway through a life keeps going.
    // See the migration tests at the bottom of this file.
    const state = createWorld({ name: 'Ayu', backgroundId: 'athlete', seed: 1 });
    storage.setItem(SAVE_KEY, JSON.stringify({ ...state, schemaVersion: SCHEMA_VERSION - 1 }));

    const loaded = saves.load();

    expect(loaded?.character.name).toBe('Ayu');
    expect(loaded?.schemaVersion).toBe(SCHEMA_VERSION);
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

/**
 * Version 2 is the shape the game shipped with through Phases 1-4, before
 * appearance, lifestyle and possessions existed. Real people were playing
 * saves of this shape, so it is written out by hand here rather than
 * generated - a generated one would quietly follow any future change and stop
 * testing the thing that matters.
 */
function version2Save(): string {
  return JSON.stringify({
    schemaVersion: 2,
    clockDay: 140,
    character: {
      id: 'cold',
      name: 'Lestari',
      backgroundId: 'scholarship',
      ageInDays: 140,
      startAgeYears: 18,
      stats: { money: 1_200, health: 70, energy: 55, mood: 60 },
      attributes: { intelligence: 34, physical: 20, charisma: 15 },
      career: { type: 'job', jobId: 'office_clerk', tenureDays: 120, level: 0 },
      focusId: 'work',
      location: 'work',
    },
    rng: { seed: 99, cursor: 12_345 },
    eventLog: [{ day: 0, tone: 'neutral', text: 'Lestari turns 18.' }],
    milestones: [{ day: 0, tone: 'neutral', text: 'Lestari turns 18.' }],
    peakMoney: 1_400,
    pendingEvent: null,
    deceased: false,
  });
}

describe('migrating an older save', () => {
  it('carries a version 2 character across instead of throwing them away', () => {
    storage.data.set(SAVE_KEY, version2Save());

    const loaded = saves.load();

    expect(loaded).not.toBeNull();
    expect(loaded?.character.name).toBe('Lestari');
    expect(loaded?.clockDay).toBe(140);
    expect(loaded?.character.career).toEqual({
      type: 'job',
      jobId: 'office_clerk',
      tenureDays: 120,
      level: 0,
    });
  });

  it('fills the Phase 5 fields as if they had never bought anything', () => {
    storage.data.set(SAVE_KEY, version2Save());

    const loaded = saves.load();

    expect(loaded?.schemaVersion).toBe(SCHEMA_VERSION);
    expect(loaded?.character.owned).toEqual([]);
    expect(loaded?.character.lifestyleId).toBe(DEFAULT_LIFESTYLE_ID);
    expect(typeof loaded?.character.appearanceRow).toBe('number');
  });

  it('lets the migrated character carry on living', () => {
    storage.data.set(SAVE_KEY, version2Save());
    const loaded = saves.load()!;

    const after = advanceWeek(loaded);

    expect(after.clockDay).toBe(147);
    expect(Number.isFinite(after.character.stats.money)).toBe(true);
    expect(after.character.stats.health).toBeGreaterThan(0);
  });

  it('repairs a current save that is missing the newer fields', () => {
    // Hand-edited or half-written files must not reach the daily rules with
    // undefined where a lifestyle should be.
    const broken = JSON.parse(version2Save()) as Record<string, unknown>;
    broken.schemaVersion = SCHEMA_VERSION;
    storage.data.set(SAVE_KEY, JSON.stringify(broken));

    const loaded = saves.load();

    expect(loaded?.character.lifestyleId).toBe(DEFAULT_LIFESTYLE_ID);
    expect(loaded?.character.owned).toEqual([]);
  });

  it('refuses a save from a future version rather than half-reading it', () => {
    const future = JSON.parse(version2Save()) as Record<string, unknown>;
    future.schemaVersion = SCHEMA_VERSION + 1;
    storage.data.set(SAVE_KEY, JSON.stringify(future));

    expect(saves.load()).toBeNull();
  });

  it('refuses a file that parses but is not one of our saves', () => {
    // Valid JSON is not a valid save. Anything that gets past here reaches
    // the daily rules and crashes on a missing `stats`.
    for (const junk of [
      '{"clockDay": 5, "character": "not an object"}',
      '{"clockDay": 5, "character": {}}',
      '{"clockDay": "soon", "character": {"name": "x"}}',
      '{"character": {"name": "x", "ageInDays": 1, "stats": {"money": 1}}}',
      '[1, 2, 3]',
      '"a string"',
      'null',
    ]) {
      storage.setItem(SAVE_KEY, junk);
      expect(saves.load(), junk).toBeNull();
    }
  });

  it('refuses a save so old there is nothing sensible to carry across', () => {
    const ancient = JSON.parse(version2Save()) as Record<string, unknown>;
    ancient.schemaVersion = 1;
    storage.data.set(SAVE_KEY, JSON.stringify(ancient));

    expect(saves.load()).toBeNull();
  });

  it('points ids the game no longer knows back at something real, instead of a blank page', () => {
    const world = createWorld({ name: 'Old', backgroundId: 'scholarship', seed: 9 });
    const stale = {
      ...world,
      pendingEvent: { eventId: 'renamed_event', daysRemaining: 3 },
      character: {
        ...world.character,
        focusId: 'juggling',
        lifestyleId: 'bohemian',
        location: 'moon' as never,
        career: { type: 'job' as const, jobId: 'astronaut', tenureDays: 9, level: 1 },
        owned: ['bicycle', 'time_machine'],
      },
    };

    const fixed = withKnownIds(stale);

    expect(fixed.pendingEvent).toBeNull();
    expect(fixed.character.focusId).toBe('rest');
    expect(fixed.character.lifestyleId).toBe(DEFAULT_LIFESTYLE_ID);
    expect(fixed.character.location).toBe('home');
    expect(fixed.character.career).toEqual({ type: 'none' });
    expect(fixed.character.owned).toEqual(['bicycle']);
  });

  it('repairs stale ids on load, so a renamed event cannot crash the page', () => {
    const world = createWorld({ name: 'Old', backgroundId: 'scholarship', seed: 9 });
    storage.data.set(
      SAVE_KEY,
      JSON.stringify({ ...world, character: { ...world.character, focusId: 'juggling' } }),
    );

    expect(saves.load()?.character.focusId).toBe('rest');
  });
});
