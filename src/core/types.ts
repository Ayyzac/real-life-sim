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

/**
 * A one-off change from a life event, as opposed to the per-day rates in
 * src/data/focuses.ts. Structured values, never free text (ARCHITECTURE §3).
 */
export interface EventEffect {
  money?: number;
  health?: number;
  energy?: number;
  mood?: number;
  intelligence?: number;
  physical?: number;
  charisma?: number;
}

/**
 * An event that stopped the week because it needs an answer. Lives in the
 * saved state so closing the browser mid-decision loses nothing.
 */
export interface PendingEvent {
  eventId: string;
  /** Days of the current advance still owed once the choice is made. */
  daysRemaining: number;
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
  /** Newest first. Trimmed to keep saves small; drives the Recent panel. */
  eventLog: EventLogEntry[];
  /**
   * The handful of moments worth remembering at the end: jobs taken,
   * promotions, serious illness. Trimmed separately and far more slowly than
   * eventLog, because the Life Summary has to reach back decades.
   */
  milestones: EventLogEntry[];
  /** Highest money ever held. The Life Summary reports it. */
  peakMoney: number;
  /** Non-null while an event is waiting for the player to choose. */
  pendingEvent: PendingEvent | null;
  deceased: boolean;
  /** Plain-language reason, set at the moment of death. */
  deathCause?: string;
  /** The day the character died, for the Life Summary. */
  deathDay?: number;
}
