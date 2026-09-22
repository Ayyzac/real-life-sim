import { BACKGROUNDS, findBackground } from '../data/backgrounds';
import { BALANCE } from '../data/balance';
import { DEFAULT_FOCUS_ID } from '../data/focuses';
import { createRng } from './rng';
import type { Character, EventLogEntry, WorldState } from './types';

export const SCHEMA_VERSION = 2;

export interface NewGameOptions {
  name: string;
  backgroundId: string;
  /** Pass a fixed seed in tests; omit it and the run is seeded from the clock. */
  seed?: number;
}

/** Whole years lived, derived from days (docs/ARCHITECTURE.md §2). */
export function ageInYears(character: Character): number {
  return character.startAgeYears + Math.floor(character.ageInDays / 365);
}

export function createWorld({ name, backgroundId, seed }: NewGameOptions): WorldState {
  const background = findBackground(backgroundId);
  const actualSeed = seed ?? (Date.now() >>> 0);
  const rng = createRng(actualSeed);

  const character: Character = {
    id: `c${Math.floor(rng.next() * 1e9).toString(36)}`,
    name: name.trim() || 'Nobody',
    backgroundId: background.id,
    ageInDays: 0,
    startAgeYears: BALANCE.startAgeYears,
    stats: {
      money: BALANCE.startMoney + (background.statBonus.money ?? 0),
      health: BALANCE.startStats.health + (background.statBonus.health ?? 0),
      energy: BALANCE.startStats.energy + (background.statBonus.energy ?? 0),
      mood: BALANCE.startStats.mood + (background.statBonus.mood ?? 0),
    },
    attributes: {
      intelligence:
        BALANCE.startAttributes.intelligence + (background.attributeBonus.intelligence ?? 0),
      physical: BALANCE.startAttributes.physical + (background.attributeBonus.physical ?? 0),
      charisma: BALANCE.startAttributes.charisma + (background.attributeBonus.charisma ?? 0),
    },
    career: { type: 'none' },
    focusId: DEFAULT_FOCUS_ID,
    location: 'home',
  };

  const birth: EventLogEntry = {
    day: 0,
    tone: 'neutral',
    text: `${character.name} turns ${BALANCE.startAgeYears}. ${background.label}.`,
  };

  return {
    schemaVersion: SCHEMA_VERSION,
    clockDay: 0,
    character,
    rng: rng.snapshot(),
    eventLog: [birth],
    milestones: [birth],
    peakMoney: character.stats.money,
    pendingEvent: null,
    deceased: false,
  };
}

export { BACKGROUNDS };
