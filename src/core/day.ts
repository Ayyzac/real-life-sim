import { ACTIONS, findAction, type ActionDefinition } from '../data/actions';
import { BALANCE } from '../data/balance';
import { DEFAULT_FOCUS_ID, findFocus } from '../data/focuses';
import { findJob } from '../data/jobs';
import { LOCATIONS } from '../data/locations';
import { isGymMember } from './gym';
import { withLogEntry, withMilestone } from './log';
import type { EventLogEntry, Needs, Stats, WorldState } from './types';

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
const W = BALANCE.work;

/** Marks today in `doneToday` as a day off work taken without asking. */
export const SKIPPED_WORK = 'skipped-work';

/** Day 0 of every life is a Monday, so days 5 and 6 of each week are the weekend. */
export function isWeekend(clockDay: number): boolean {
  return clockDay % 7 >= 5;
}

/** "07:00", for messages written by the simulation. */
export function hhmm(minute: number): string {
  const wrapped = minute % (24 * 60);
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

function clamp(value: number): number {
  return Math.min(BALANCE.statMax, Math.max(BALANCE.statMin, value));
}

/**
 * Whether today has a 09:00-17:00 block at all (GDD §11.1, §11.3). Resting
 * never does. An employee's weekend, or a day they skipped, does not either.
 */
export function blockToday(state: WorldState): boolean {
  const focus = findFocus(state.character.focusId);
  if (focus.restores) return false;
  if (focus.worksJob && (isWeekend(state.clockDay) || state.doneToday.includes(SKIPPED_WORK))) return false;
  return true;
}

/** The working day has not happened yet today. */
export function blockPending(state: WorldState): boolean {
  return blockToday(state) && state.minuteOfDay < D.blockEnd;
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

function place(locationId: string): (typeof LOCATIONS)[number] | undefined {
  return LOCATIONS.find((l) => l.id === locationId);
}

function placeName(locationId: string): string {
  return place(locationId)?.label ?? locationId;
}

/** Why a place is closed at this minute, or null while it is open (GDD §11.4). */
export function closedReason(locationId: string, minute: number): string | null {
  const hours = place(locationId);
  if (!hours) return null;
  if (minute < hours.opens || minute >= hours.closes) return `Closed \u00b7 opens ${hhmm(hours.opens)}`;
  return null;
}

/** Why an action cannot be done right now, in the player's words - or null. */
export function actionBlocker(state: WorldState, action: ActionDefinition): string | null {
  if (busy(state)) return 'Not now';
  if (state.character.location !== action.locationId) return `Only at the ${placeName(action.locationId)}`;
  if (action.membersOnly && !isGymMember(state.character)) return 'Members only';
  if (!action.needs && state.doneToday.includes(action.id)) return 'Already done today';
  const closed = closedReason(action.locationId, state.minuteOfDay);
  if (closed) return closed;
  const closes = place(action.locationId)?.closes ?? D.latest;
  if (closes < D.latest && state.minuteOfDay + action.minutes > closes) return `Closes at ${hhmm(closes)}`;
  if (state.minuteOfDay + action.minutes > freeUntil(state)) {
    return blockPending(state) ? 'Not enough time before work' : 'Too late tonight';
  }
  if ((action.cost ?? 0) > state.character.stats.money) return 'Cannot afford';
  return null;
}

/** The actions on offer where the character is standing. */
export function actionsHere(state: WorldState): readonly ActionDefinition[] {
  return ACTIONS.filter((action) => action.locationId === state.character.location && !action.custom);
}

/**
 * The clock running on its own (GDD §12): up to `minutes` pass, but never
 * past the next thing that has to happen - the start of the working day, or
 * 02:00. At 09:00 it simply stops until the player goes to work or skips it.
 *
 * Whatever drives the clock lives outside the core (src/ui/clock.ts); this
 * only says what a stretch of time does.
 */
export function tick(state: WorldState, minutes: number): WorldState {
  if (busy(state)) return state;
  return passTime(state, Math.min(minutes, freeUntil(state) - state.minuteOfDay));
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
  const focus = findFocus(state.character.focusId);
  const unwashed = focus.worksJob === true && state.character.needs.hygiene < D.lowNeed;

  const played = passTime(state, D.blockEnd - state.minuteOfDay, D.blockNeedsRate);
  const arrived = { ...played, character: { ...played.character, location: focus.locationId } };
  return unwashed ? withStrike(arrived, W.unwashedStrike, 'Turned up to work unwashed. People noticed.') : arrived;
}

/** Whether skipping work is on offer right now: a working weekday, before it starts. */
export function canSkipWork(state: WorldState): boolean {
  return (
    !busy(state) &&
    state.character.career.type === 'job' &&
    findFocus(state.character.focusId).worksJob === true &&
    blockPending(state)
  );
}

/**
 * Takes the day off without asking (GDD §11.3). The day is free, it is not
 * paid, and it leaves a mark. Marks fade; enough of them and the job is gone.
 */
export function skipWork(state: WorldState): WorldState {
  if (!canSkipWork(state)) return state;
  const skipped = { ...state, doneToday: [...state.doneToday, SKIPPED_WORK] };
  return withStrike(skipped, 1, 'Skipped work today.');
}

/** Adds a mark against the job, with the warning and the sack when they come. */
function withStrike(state: WorldState, amount: number, why: string): WorldState {
  const career = state.character.career;
  if (career.type !== 'job') return state;

  const before = career.strikes ?? 0;
  const strikes = before + amount;
  const day = state.clockDay;
  let eventLog = withLogEntry(state.eventLog, { day, tone: 'bad', text: why });
  const job = findJob(career.jobId);

  if (strikes >= W.fireAtStrikes) {
    const fired: EventLogEntry = { day, tone: 'bad', text: `Fired from the ${job.title} job for missing work.` };
    const focus = findFocus(state.character.focusId);
    return {
      ...state,
      eventLog: withLogEntry(eventLog, fired),
      milestones: withMilestone(state.milestones, fired),
      character: {
        ...state.character,
        career: { type: 'none' },
        focusId: focus.worksJob ? DEFAULT_FOCUS_ID : focus.id,
      },
    };
  }

  if (before < W.warnAtStrikes && strikes >= W.warnAtStrikes) {
    eventLog = withLogEntry(eventLog, {
      day,
      tone: 'bad',
      text: `Your boss has had a word about your attendance. Keep missing days and you will be let go.`,
    });
  }

  return { ...state, eventLog, character: { ...state.character, career: { ...career, strikes } } };
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
