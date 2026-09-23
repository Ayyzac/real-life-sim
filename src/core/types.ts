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

/**
 * Hunger, thirst and hygiene, 0-100 (GDD §11.2). Only move while a day is
 * played hour by hour; they never touch health.
 */
export interface Needs {
  hunger: number;
  thirst: number;
  hygiene: number;
}

/** Slow-moving abilities, 0-100. They gate jobs and shift event odds. */
export interface Attributes {
  intelligence: number;
  physical: number;
  charisma: number;
}

export type LocationId =
  | 'home'
  | 'work'
  | 'gym'
  | 'hospital'
  | 'cafe'
  | 'business'
  | 'stadium';

/** Id of an entry in src/data/focuses.ts. */
export type FocusId = string;

/**
 * One career slot per character (docs/ARCHITECTURE.md §5). A job, a business
 * and a sport cannot be held at once - taking one gives up the others.
 */
export type CareerState =
  | { type: 'none' }
  | { type: 'job'; jobId: string; tenureDays: number; level: number }
  | { type: 'business'; businessId: string; daysOpen: number; level: number }
  | {
      type: 'sports';
      sportId: string;
      /** Raised by training. The main number a match is decided on. */
      skill: number;
      /** 0-100. Grows with wins, and scales prize money. */
      reputation: number;
      /** Days since the last match, so fixtures come round on a schedule. */
      daysSinceMatch: number;
      wins: number;
      losses: number;
    };

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
  needs: Needs;
  career: CareerState;
  /** What the character spends their days on until the player changes it. */
  focusId: FocusId;
  location: LocationId;
  /**
   * Which tilesheet row this character looked like before Phase 6. Only read
   * when `look` is missing, for saves made before looks existed.
   */
  appearanceRow: number;
  /** Body and colours, see src/core/look.ts. Purely cosmetic (GDD §3.2). */
  look?: number;
  /** Id of an entry in src/data/lifestyles.ts. Paid for every day. */
  lifestyleId: string;
  /** Ids of entries in src/data/possessions.ts, owned outright. */
  owned: string[];
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

/** How someone came into the player's life (GDD §10). */
export type RelationKind = 'family' | 'friend' | 'colleague' | 'partner' | 'child';

/**
 * One person the player knows, simulated in full while they are alive.
 *
 * Deliberately small: every field here is multiplied by however many people
 * are in the save, and the save has to stay under localStorage's ceiling.
 */
export interface Person {
  id: string;
  name: string;
  kind: RelationKind;
  /** Their own age, counted in days like the player's so it never jolts. */
  ageDays: number;
  /** 0-100. What the player has put into knowing them. */
  closeness: number;
  /** Flavour only - a label, not a JobDefinition. Null for children. */
  job: string | null;
  /** Days spent at rock-bottom closeness, before they drift away for good. */
  neglectedDays: number;
  /**
   * Only set for someone whose face the player already saw (a stranger they
   * greeted). Everyone else's look is worked out from their id.
   */
  look?: number;
}

/**
 * Somebody who has died or drifted away, kept as one line.
 *
 * This is the whole reason the save stays small: the cast keeps changing over
 * seventy years, but only the living are simulated (GDD §10.3).
 */
export interface Memory {
  name: string;
  kind: RelationKind;
  text: string;
  day: number;
}

export interface WorldState {
  /** Bumped whenever the saved shape changes, so old saves can be migrated. */
  schemaVersion: number;
  clockDay: number;
  /**
   * Time of day in minutes after midnight (GDD §11.1). Runs past 1440 when
   * the character stays up after midnight. Back to waking time every morning.
   */
  minuteOfDay: number;
  /**
   * Things already done today, so a treat only counts once (GDD §11.2):
   * action ids, and later who was talked to. Emptied every night.
   */
  doneToday: string[];
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
  /** Everyone the player currently knows, alive and simulated (GDD §10). */
  people: Person[];
  /** One line each for those who have died or drifted away. Trimmed. */
  memories: Memory[];
  /** Non-null while an event is waiting for the player to choose. */
  pendingEvent: PendingEvent | null;
  deceased: boolean;
  /** Plain-language reason, set at the moment of death. */
  deathCause?: string;
  /** The day the character died, for the Life Summary. */
  deathDay?: number;
}
