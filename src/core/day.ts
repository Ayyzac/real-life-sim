import { ACTIONS, findAction, type ActionDefinition } from '../data/actions';
import { BALANCE } from '../data/balance';
import { findFocus } from '../data/focuses';
import { LOCATIONS } from '../data/locations';
import type { Needs, Stats, WorldState } from './types';

/**
 * One day, hour by hour (GDD §11). Pure functions over WorldState.
 *
 * The clock inside a day only moves when the player does something here. A
 * day skipped with Advance never passes through these functions, so its needs
 * never fall - it is lived sensibly by assumption. That is what lets the
 * hour-by-hour day sit on top of the old day-at-a-time rules without
 * disturbing a single lifetime balance test.
 *
 * Nothing here touches health downwards, so nothing here can kill: death still
 * only comes through the daily rules, after a visible decline.
 */

const D = BALANCE.day;

function clamp(value: number): number {
  return Math.min(BALANCE.statMax, Math.max(BALANCE.statMin, value));
}

/** Every focus except resting takes up the working day (GDD §11.1). */
export function hasBlock(focusId: string): boolean {
  return findFocus(focusId).restores !== true;
}

/** The working day has not happened yet today. */
export function blockPending(state: WorldState): boolean {
  return hasBlock(state.character.focusId) && state.minuteOfDay < D.blockEnd;
}

/** When the current stretch of free time runs out, in minutes after midnight. */
export function freeUntil(state: WorldState): number {
  if (!blockPending(state)) return D.latest;
  return Math.max(state.minuteOfDay, D.blockStart);
}

/**
 * Hours out of `hours` that a steadily changing value spends under `low`,
 * going from `start` to `end`.
 */
export function hoursBelow(start: number, end: number, hours: number, low: number): number {
  if (hours <= 0) return 0;
  if (start < low && end < low) return hours;
  if (start >= low && end >= low) return 0;
  const crossing = (low - start) / (end - start);
  return start >= low ? hours * (1 - crossing) : hours * crossing;
}

/**
 * Plays `minutes` of the clock. Needs fall at `rate` times the normal pace,
 * and every hour one of them spends under the line costs mood (and, for
 * hunger and thirst, energy).
 */
export function passTime(state: WorldState, minutes: number, rate = 1): WorldState {
  if (minutes <= 0) return state;
  const hours = minutes / 60;
  const before = state.character.needs;
  const after: Needs = {
    hunger: clamp(before.hunger + D.needsPerHour.hunger * hours * rate),
    thirst: clamp(before.thirst + D.needsPerHour.thirst * hours * rate),
    hygiene: clamp(before.hygiene + D.needsPerHour.hygiene * hours * rate),
  };

  const starving =
    hoursBelow(before.hunger, after.hunger, hours, D.lowNeed) +
    hoursBelow(before.thirst, after.thirst, hours, D.lowNeed);
  const grubby = hoursBelow(before.hygiene, after.hygiene, hours, D.lowNeed);
  const stats = state.character.stats;

  return {
    ...state,
    minuteOfDay: state.minuteOfDay + minutes,
    character: {
      ...state.character,
      needs: after,
      stats: {
        ...stats,
        mood: clamp(stats.mood + D.lowNeedPerHour.mood * (starving + grubby)),
        energy: clamp(stats.energy + D.lowNeedPerHour.energy * starving),
      },
    },
  };
}

function busy(state: WorldState): boolean {
  return state.deceased || state.pendingEvent !== null;
}

function placeName(locationId: string): string {
  return LOCATIONS.find((l) => l.id === locationId)?.label ?? locationId;
}

/** Why an action cannot be done right now, in the player's words - or null. */
export function actionBlocker(state: WorldState, action: ActionDefinition): string | null {
  if (busy(state)) return 'Not now';
  if (state.character.location !== action.locationId) return `Only at the ${placeName(action.locationId)}`;
  if (!action.needs && state.doneToday.includes(action.id)) return 'Already done today';
  if (state.minuteOfDay + action.minutes > freeUntil(state)) {
    return blockPending(state) ? 'Not enough time before work' : 'Too late tonight';
  }
  if ((action.cost ?? 0) > state.character.stats.money) return 'Cannot afford';
  return null;
}

/** The actions on offer where the character is standing. */
export function actionsHere(state: WorldState): readonly ActionDefinition[] {
  return ACTIONS.filter((action) => action.locationId === state.character.location);
}

/**
 * Does one thing from src/data/actions.ts. The time passes first, then the
 * result lands - you are fed at the end of the meal, not the start.
 */
export function performAction(state: WorldState, actionId: string): WorldState {
  const action = findAction(actionId);
  if (actionBlocker(state, action) !== null) return state;

  const firstToday = !state.doneToday.includes(action.id);
  const played = passTime(state, action.minutes);
  const { stats, attributes, needs } = played.character;
  const treat = firstToday ? (action.effects ?? {}) : {};
  const topUp = action.needs ?? {};

  return {
    ...played,
    doneToday: firstToday ? [...played.doneToday, action.id] : played.doneToday,
    character: {
      ...played.character,
      needs: {
        hunger: clamp(needs.hunger + (topUp.hunger ?? 0)),
        thirst: clamp(needs.thirst + (topUp.thirst ?? 0)),
        hygiene: clamp(needs.hygiene + (topUp.hygiene ?? 0)),
      },
      stats: {
        money: stats.money - (action.cost ?? 0),
        health: clamp(stats.health + (treat.health ?? 0)),
        energy: clamp(stats.energy + (treat.energy ?? 0)),
        mood: clamp(stats.mood + (treat.mood ?? 0)),
      },
      attributes: {
        intelligence: clamp(attributes.intelligence + (treat.intelligence ?? 0)),
        physical: clamp(attributes.physical + (treat.physical ?? 0)),
        charisma: clamp(attributes.charisma + (treat.charisma ?? 0)),
      },
    },
  };
}

/**
 * Goes to work (or training, or the books) until 17:00. The day's focus
 * effects still land at bedtime through the daily rules, exactly as when the
 * day is skipped; this only moves the clock, and the character.
 */
export function startBlock(state: WorldState): WorldState {
  if (busy(state) || !blockPending(state)) return state;
  const played = passTime(state, D.blockEnd - state.minuteOfDay, D.blockNeedsRate);
  return {
    ...played,
    character: { ...played.character, location: findFocus(state.character.focusId).locationId },
  };
}

/** What tonight costs tomorrow: bed hungry or thirsty, and every hour past midnight. */
export function bedtimeCost(state: WorldState): Pick<Stats, 'energy' | 'mood'> {
  const { needs } = state.character;
  const hungry = needs.hunger < D.lowNeed || needs.thirst < D.lowNeed;
  const lateHours = Math.max(0, state.minuteOfDay - D.midnight) / 60;
  return {
    energy: lateHours * D.lateNightEnergyPerHour + (hungry ? D.hungryBedtime.energy : 0),
    mood: hungry ? D.hungryBedtime.mood : 0,
  };
}

/** A new morning: waking time, the usual morning needs, nothing done yet. */
export function morningNeeds(): Needs {
  return { ...D.morningNeeds };
}
