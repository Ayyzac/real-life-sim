/**
 * The shape of everything the simulation tracks.
 *
 * Hard rule from docs/ARCHITECTURE.md §4: every type here must be plain JSON -
 * no functions, no class instances, no Map/Set - so the whole WorldState can be
 * written to localStorage with JSON.stringify and read back unchanged.
 */

import type { RngState } from './rng';

/** Stats shown to the player. `money` is unbounded; the rest are 0-100. */
export interface Stats {
  money: number;
  health: number;
  energy: number;
  mood: number;
}

/** Slow-moving abilities, 0-100. They gate jobs and shift event odds. */
export interface Attributes {
  intelligence: number;
  physical: number;
  charisma: number;
}

export type LocationId = 'home' | 'work' | 'gym' | 'hospital' | 'cafe';

/** Id of an entry in src/data/focuses.ts. */
export type FocusId = string;

/**
 * One career slot per character (docs/ARCHITECTURE.md §5). Business and sports
 * arrive in Phases 3 and 4; the union already has room for them.
 */
export type CareerState =
  | { type: 'none' }
  | { type: 'job'; jobId: string; tenureDays: number; level: number };

export interface Character {
  id: string;
  name: string;
  backgroundId: string;
  /** Days lived since the game started, NOT since birth. */
  ageInDays: number;
  /** Age in whole years at character creation. */
  startAgeYears: number;
  stats: Stats;
  attributes: Attributes;
  career: CareerState;
  /** What the character spends their days on until the player changes it. */
  focusId: FocusId;
  location: LocationId;
}

export interface EventLogEntry {
  /** Day the entry was recorded, matching WorldState.clockDay. */
  day: number;
  text: string;
  tone: 'good' | 'bad' | 'neutral';
}

export interface WorldState {
  /** Bumped whenever the saved shape changes, so old saves can be migrated. */
  schemaVersion: number;
  clockDay: number;
  character: Character;
  rng: RngState;
  /** Newest first. Trimmed to keep saves small; the Life Summary reads it. */
  eventLog: EventLogEntry[];
  /** Set once the character dies. Phase 1 Demo B fills this in. */
  deceased: boolean;
}
