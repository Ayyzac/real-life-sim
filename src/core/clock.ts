import { BALANCE } from '../data/balance';
import { findFocus } from '../data/focuses';
import { workOneDay } from './careers/job';
import { ageInYears } from './character';
import { restoreRng } from './rng';
import type { Attributes, EventLogEntry, Stats, WorldState } from './types';

/**
 * The only thing that moves time forward (docs/ARCHITECTURE.md §2).
 *
 * Every function here is pure: it takes a WorldState and returns a NEW one.
 * That keeps the state serialisable, makes tests trivial, and lets the React
 * layer detect changes by identity instead of deep comparison.
 *
 * Time NEVER advances on its own. These are called from a button press only
 * (CLAUDE.md rule 3).
 */

export const DAYS_PER_WEEK = 7;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampStats(stats: Stats): Stats {
  const { statMin, statMax } = BALANCE;
  return {
    money: Math.round(stats.money),
    health: clamp(stats.health, statMin, statMax),
    energy: clamp(stats.energy, statMin, statMax),
    mood: clamp(stats.mood, statMin, statMax),
  };
}

function clampAttributes(attributes: Attributes): Attributes {
  const { statMin, statMax } = BALANCE;
  return {
    intelligence: clamp(attributes.intelligence, statMin, statMax),
    physical: clamp(attributes.physical, statMin, statMax),
    charisma: clamp(attributes.charisma, statMin, statMax),
  };
}

function withLogEntry(log: EventLogEntry[], entry: EventLogEntry): EventLogEntry[] {
  return [entry, ...log].slice(0, BALANCE.eventLogLimit);
}

/** Health lost purely to ageing. Zero while young, compounding later. */
export function ageingHealthLossPerDay(ageYears: number): number {
  const yearsOver = ageYears - BALANCE.healthDecayStartAgeYears;
  if (yearsOver <= 0) return 0;
  return yearsOver * BALANCE.healthDecayPerDayPerYearOver;
}

/** Advances exactly one day. */
export function advanceDay(state: WorldState): WorldState {
  if (state.deceased) return state;

  const character = state.character;
  const focus = findFocus(character.focusId);
  const { effects } = focus;

  let stats: Stats = { ...character.stats };
  let attributes: Attributes = { ...character.attributes };
  let career = character.career;
  let eventLog = state.eventLog;

  stats.energy += effects.energy ?? 0;
  stats.mood += effects.mood ?? 0;
  stats.health += effects.health ?? 0;
  attributes.intelligence += effects.intelligence ?? 0;
  attributes.physical += effects.physical ?? 0;
  attributes.charisma += effects.charisma ?? 0;

  if (focus.worksJob) {
    const worked = workOneDay(career, attributes);
    career = worked.career;
    stats.money += worked.income;
    if (worked.promotedTo) {
      eventLog = withLogEntry(eventLog, {
        day: state.clockDay,
        tone: 'good',
        text: `Promoted at work: ${worked.promotedTo.title}, level ${worked.promotedTo.level}.`,
      });
    }
  }

  // ponytail: money is allowed to go negative instead of blocking the activity.
  // Simplest honest model for Demo A; a real debt/affordability rule belongs in
  // Phase 5 balancing.
  stats.money -= BALANCE.livingCostPerDay + (focus.costPerDay ?? 0);

  stats.mood += BALANCE.moodDriftPerDay;
  stats.health -= ageingHealthLossPerDay(ageInYears(character));
  if (stats.energy < BALANCE.lowEnergyThreshold) {
    stats.health -= BALANCE.lowEnergyHealthPenaltyPerDay;
  }

  stats = clampStats(stats);
  attributes = clampAttributes(attributes);

  return {
    ...state,
    clockDay: state.clockDay + 1,
    eventLog,
    character: {
      ...character,
      ageInDays: character.ageInDays + 1,
      stats,
      attributes,
      career,
    },
    // The RNG is untouched today; Demo B's EventEngine will draw from it here.
    rng: restoreRng(state.rng).snapshot(),
  };
}

/** Advances several days in a row, stopping early if the character dies. */
export function advanceDays(state: WorldState, days: number): WorldState {
  let next = state;
  for (let i = 0; i < days; i += 1) {
    if (next.deceased) break;
    next = advanceDay(next);
  }
  return next;
}

/** The main button: one week (docs/ARCHITECTURE.md §2). */
export function advanceWeek(state: WorldState): WorldState {
  return advanceDays(state, DAYS_PER_WEEK);
}
