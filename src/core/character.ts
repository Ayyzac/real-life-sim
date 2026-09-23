import { BACKGROUNDS, findBackground } from '../data/backgrounds';
import { BALANCE } from '../data/balance';
import { DEFAULT_FOCUS_ID } from '../data/focuses';
import { DEFAULT_LIFESTYLE_ID } from '../data/lifestyles';
import { decodeLook, encodeLook } from './look';
import { createRng } from './rng';
import { startingPeople } from './relationships';
import { startingMarket } from './finance';
import type { Character, EventLogEntry, WorldState } from './types';

/**
 * 10 since Phase 7H (the casino); 9 added applications and email, 8 the
 * bank and markets, 7 deliveries, 6 the bag, 5 the gym membership, 4 the
 * time of day and needs.
 * Older saves back to version 2 are MIGRATED rather than thrown away - see
 * LocalStorageSaveProvider.
 */
export const SCHEMA_VERSION = 10;

export interface NewGameOptions {
  name: string;
  backgroundId: string;
  /** Pre-Phase 6: which tilesheet row to look like. Ignored when `look` is given. */
  appearanceRow?: number;
  /** Body and colours (src/core/look.ts). Cosmetic only. */
  look?: number;
  /** Pass a fixed seed in tests; omit it and the run is seeded from the clock. */
  seed?: number;
}

/** How many people the tilesheet offers to look like. */
export const APPEARANCE_COUNT = 18;

export const DEFAULT_APPEARANCE_ROW = 3;

/** Whole years lived, derived from days (docs/ARCHITECTURE.md §2). */
export function ageInYears(character: Character): number {
  return character.startAgeYears + Math.floor(character.ageInDays / 365);
}

export function createWorld({ name, backgroundId, appearanceRow, look, seed }: NewGameOptions): WorldState {
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
    needs: { ...BALANCE.day.morningNeeds },
    career: { type: 'none' },
    focusId: DEFAULT_FOCUS_ID,
    location: 'home',
    appearanceRow:
      look === undefined
        ? clampAppearance(appearanceRow ?? DEFAULT_APPEARANCE_ROW)
        : decodeLook(look).body * 3,
    ...(look === undefined ? {} : { look: encodeLook(decodeLook(look)) }),
    lifestyleId: DEFAULT_LIFESTYLE_ID,
    owned: [],
    gymPaidUntil: null,
    inventory: [],
    deliveries: [],
  };

  const birth: EventLogEntry = {
    day: 0,
    tone: 'neutral',
    text: `${character.name} turns ${BALANCE.startAgeYears}. ${background.label}.`,
  };

  return {
    schemaVersion: SCHEMA_VERSION,
    clockDay: 0,
    minuteOfDay: BALANCE.day.wake,
    doneToday: [],
    character,
    rng: rng.snapshot(),
    eventLog: [birth],
    milestones: [birth],
    peakMoney: character.stats.money,
    // Nobody starts life alone (GDD §10.1).
    people: startingPeople(rng),
    memories: [],
    pendingEvent: null,
    deceased: false,
    market: startingMarket({ clockDay: 0, minuteOfDay: BALANCE.day.wake }),
    portfolio: {},
    bank: { savings: 0, loan: 0 },
    applications: [],
    inbox: [],
    blackjack: null,
    lastBet: null,
  };
}

/** Keeps a hand-edited or migrated save from pointing at a sprite row that does not exist. */
export function clampAppearance(row: number): number {
  if (!Number.isFinite(row)) return DEFAULT_APPEARANCE_ROW;
  return Math.min(APPEARANCE_COUNT - 1, Math.max(0, Math.floor(row)));
}

export { BACKGROUNDS };
