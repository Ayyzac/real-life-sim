import { clampAppearance, DEFAULT_APPEARANCE_ROW, SCHEMA_VERSION } from '../character';
import { BUSINESSES } from '../../data/businesses';
import { EVENTS } from '../../data/events';
import { DEFAULT_FOCUS_ID, FOCUSES } from '../../data/focuses';
import { JOBS } from '../../data/jobs';
import { DEFAULT_LIFESTYLE_ID, LIFESTYLES } from '../../data/lifestyles';
import { LOCATIONS } from '../../data/locations';
import { POSSESSIONS } from '../../data/possessions';
import { SPORTS } from '../../data/sports';
import type { CareerState, Character } from '../types';
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
      if (!looksLikeASave(parsed)) return null;

      const migrated = migrate(parsed);
      // Anything we still cannot read is treated as no save at all, so a
      // corrupted or far-future file can never stop the game from opening.
      if (!migrated) return null;

      return withKnownIds(migrated);
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

/**
 * Is this actually one of our saves?
 *
 * Valid JSON is not the same as a valid save. A file that parses but holds
 * something else entirely - a half-written write, a hand-edit, another app
 * using the same key - must be refused here rather than reaching the daily
 * rules and crashing on a missing `stats`.
 */
function looksLikeASave(parsed: Partial<WorldState>): boolean {
  if (typeof parsed.clockDay !== 'number' || !Number.isFinite(parsed.clockDay)) return false;

  const character = parsed.character as Partial<Character> | undefined;
  if (!character || typeof character !== 'object') return false;
  if (typeof character.name !== 'string') return false;
  if (!character.stats || typeof character.stats.money !== 'number') return false;
  if (!character.attributes || typeof character.attributes.intelligence !== 'number') return false;
  if (typeof character.ageInDays !== 'number') return false;

  return true;
}

/**
 * Brings an older save up to the current shape (GDD §9, user decision 22 Sep
 * 2026).
 *
 * Every earlier version bump simply threw old saves away, on the grounds that
 * nobody was playing yet. Phase 5 is the last phase, so that stops here: a
 * character halfway through a life keeps going, with the new fields filled in
 * as if they had simply never bought anything.
 *
 * Returns null for a save too new to understand - better no save than a
 * half-read one.
 */
export function migrate(parsed: Partial<WorldState>): WorldState | null {
  const version = parsed.schemaVersion ?? 0;
  if (version > SCHEMA_VERSION) return null;

  const character = parsed.character as Partial<Character> | undefined;
  if (!character) return null;

  if (version === SCHEMA_VERSION) {
    // Even a current save can have been hand-edited; fill any gap rather than
    // letting undefined reach the daily rules.
    return {
      ...withPhase5World(parsed),
      character: withPhase5Fields(character),
    };
  }

  // Version 2 -> 3: appearance, lifestyle and possessions did not exist.
  if (version === 2) {
    return {
      ...withPhase5World(parsed),
      schemaVersion: SCHEMA_VERSION,
      character: withPhase5Fields(character),
    };
  }

  // Version 1 and below predate the event system; there is nothing sensible
  // to carry across.
  return null;
}

/**
 * A migrated character starts their remembered life from here: they keep
 * everyone they will meet from now on, but the years already lived did not
 * record anybody.
 */
function withPhase5World(parsed: Partial<WorldState>): WorldState {
  return {
    ...(parsed as WorldState),
    people: Array.isArray(parsed.people) ? parsed.people : [],
    memories: Array.isArray(parsed.memories) ? parsed.memories : [],
  };
}

function withPhase5Fields(character: Partial<Character>): Character {
  return {
    ...(character as Character),
    appearanceRow: clampAppearance(character.appearanceRow ?? DEFAULT_APPEARANCE_ROW),
    lifestyleId: character.lifestyleId ?? DEFAULT_LIFESTYLE_ID,
    owned: Array.isArray(character.owned) ? character.owned : [],
  };
}

/** localStorage is absent in tests and can throw on access in private mode. */
function safeLocalStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

const known = (list: readonly { id: string }[], id: string | undefined): boolean =>
  list.some((entry) => entry.id === id);

/**
 * Points every id in the save back at something that exists.
 *
 * A save can outlive the data it names: an event renamed in an update, a
 * hand-edit, a job taken out. The screens look those ids up while drawing,
 * and one missing entry used to throw mid-render and leave a blank page -
 * with the reset button inside the page that failed. Falling back to a
 * default here keeps the game open instead.
 */
export function withKnownIds(state: WorldState): WorldState {
  const character = state.character;
  const career = character.career;
  const careerKnown =
    career.type === 'none' ||
    (career.type === 'job' && known(JOBS, career.jobId)) ||
    (career.type === 'business' && known(BUSINESSES, career.businessId)) ||
    (career.type === 'sports' && known(SPORTS, career.sportId));
  const safeCareer: CareerState = careerKnown ? career : { type: 'none' };

  return {
    ...state,
    pendingEvent:
      state.pendingEvent && known(EVENTS, state.pendingEvent.eventId) ? state.pendingEvent : null,
    character: {
      ...character,
      career: safeCareer,
      focusId: known(FOCUSES, character.focusId) ? character.focusId : DEFAULT_FOCUS_ID,
      lifestyleId: known(LIFESTYLES, character.lifestyleId) ? character.lifestyleId : DEFAULT_LIFESTYLE_ID,
      location: known(LOCATIONS, character.location) ? character.location : 'home',
      owned: character.owned.filter((id) => known(POSSESSIONS, id)),
    },
  };
}
