import { BALANCE } from '../data/balance';
import { findFocus } from '../data/focuses';
import { workOneDay } from './careers/job';
import { ageInYears } from './character';
import { applyEffect, findChoice, findEvent, needsDecision, rollEvent } from './events';
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
 *
 * A week can STOP PART-WAY. When an event needs the player to decide, the
 * remaining days are parked in state.pendingEvent.daysRemaining and the week
 * resumes from resolveEvent(). Because that lives in WorldState, closing the
 * browser mid-decision loses nothing (user decision, 22 Sep 2026).
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

function withMilestone(log: EventLogEntry[], entry: EventLogEntry): EventLogEntry[] {
  return [entry, ...log].slice(0, BALANCE.milestoneLimit);
}

/** Health lost purely to ageing. Zero while young, compounding later. */
export function ageingHealthLossPerDay(ageYears: number): number {
  const yearsOver = ageYears - BALANCE.healthDecayStartAgeYears;
  if (yearsOver <= 0) return 0;
  return yearsOver * BALANCE.healthDecayPerDayPerYearOver;
}

function deathCause(ageYears: number): string {
  if (ageYears >= 70) return `Died peacefully at ${ageYears}, of old age.`;
  if (ageYears >= 50) return `Died at ${ageYears}, after years of failing health.`;
  return `Died at ${ageYears}. Their health had been failing for a long time.`;
}

/**
 * Ends the life if health has run out.
 *
 * Death only ever arrives this way - through health reaching zero after a
 * visible decline. No event can kill outright; see applyEffect in events.ts.
 */
function checkDeath(state: WorldState): WorldState {
  if (state.deceased || state.character.stats.health > 0) return state;

  const age = ageInYears(state.character);
  const cause = deathCause(age);
  const entry: EventLogEntry = { day: state.clockDay, tone: 'bad', text: cause };

  return {
    ...state,
    deceased: true,
    deathCause: cause,
    deathDay: state.clockDay,
    pendingEvent: null,
    eventLog: withLogEntry(state.eventLog, entry),
    milestones: withMilestone(state.milestones, entry),
  };
}

/**
 * The certain part of a day: the focus, the job, the bills, ageing.
 *
 * Kept separate from the dice roll on purpose. These are the rules that must
 * hold every single day, and splitting them out means they can be tested
 * exactly, without an event randomly turning up and changing the numbers.
 */
export function applyDailyRules(state: WorldState): WorldState {
  const character = state.character;
  const focus = findFocus(character.focusId);
  const { effects } = focus;

  let stats: Stats = { ...character.stats };
  let attributes: Attributes = { ...character.attributes };
  let career = character.career;
  let eventLog = state.eventLog;
  let milestones = state.milestones;

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
      const entry: EventLogEntry = {
        day: state.clockDay,
        tone: 'good',
        text: `Promoted at work: ${worked.promotedTo.title}, level ${worked.promotedTo.level}.`,
      };
      eventLog = withLogEntry(eventLog, entry);
      milestones = withMilestone(milestones, entry);
    }
  }

  // ponytail: money is allowed to go negative instead of blocking the activity.
  // Simplest honest model for now; a real affordability rule belongs in
  // Phase 5 balancing.
  stats.money -= BALANCE.livingCostPerDay + (focus.costPerDay ?? 0);

  stats.mood += BALANCE.moodDriftPerDay;
  stats.health -= ageingHealthLossPerDay(ageInYears(character));
  if (stats.energy < BALANCE.lowEnergyThreshold && stats.health > BALANCE.exhaustionHealthFloor) {
    stats.health = Math.max(
      BALANCE.exhaustionHealthFloor,
      stats.health - BALANCE.lowEnergyHealthPenaltyPerDay,
    );
  }

  const afterRules: WorldState = {
    ...state,
    clockDay: state.clockDay + 1,
    eventLog,
    milestones,
    character: {
      ...character,
      ageInDays: character.ageInDays + 1,
      stats: clampStats(stats),
      attributes: clampAttributes(attributes),
      career,
    },
  };

  return checkDeath({
    ...afterRules,
    peakMoney: Math.max(afterRules.peakMoney, afterRules.character.stats.money),
  });
}

/** A full day: the certain rules above, then at most one random event. */
function simulateOneDay(state: WorldState): WorldState {
  const rng = restoreRng(state.rng);
  let next = applyDailyRules(state);
  if (next.deceased) return { ...next, rng: rng.snapshot() };

  const event = rollEvent(next.character, rng);
  if (event) {
    if (needsDecision(event)) {
      // Stop here. The caller records how many days are still owed.
      next = { ...next, pendingEvent: { eventId: event.id, daysRemaining: 0 } };
    } else {
      const updated = applyEffect(next.character, event.effect ?? {});
      const entry: EventLogEntry = {
        day: next.clockDay,
        tone: event.tone,
        text: `${event.title}. ${event.text}`,
      };
      next = {
        ...next,
        character: updated,
        eventLog: withLogEntry(next.eventLog, entry),
        milestones: event.milestone ? withMilestone(next.milestones, entry) : next.milestones,
      };
    }
  }

  next = {
    ...next,
    rng: rng.snapshot(),
    peakMoney: Math.max(next.peakMoney, next.character.stats.money),
  };

  return checkDeath(next);
}

/**
 * Advances up to `days` days, stopping early on death or on an event that
 * needs an answer.
 */
export function advanceDays(state: WorldState, days: number): WorldState {
  if (state.deceased || state.pendingEvent) return state;

  let next = state;
  for (let i = 0; i < days; i += 1) {
    next = simulateOneDay(next);
    if (next.deceased) break;
    if (next.pendingEvent) {
      next = {
        ...next,
        pendingEvent: { ...next.pendingEvent, daysRemaining: days - i - 1 },
      };
      break;
    }
  }
  return next;
}

export function advanceDay(state: WorldState): WorldState {
  return advanceDays(state, 1);
}

/** The main button: one week (docs/ARCHITECTURE.md §2). */
export function advanceWeek(state: WorldState): WorldState {
  return advanceDays(state, DAYS_PER_WEEK);
}

/**
 * Answers the waiting event and plays out the rest of the interrupted week.
 */
export function resolveEvent(state: WorldState, choiceId: string): WorldState {
  const pending = state.pendingEvent;
  if (!pending) return state;

  const event = findEvent(pending.eventId);
  const choice = findChoice(event, choiceId);
  const character = applyEffect(state.character, choice.effect);
  const entry: EventLogEntry = {
    day: state.clockDay,
    tone: choice.tone,
    text: choice.outcome,
  };

  const resolved: WorldState = checkDeath({
    ...state,
    character,
    eventLog: withLogEntry(state.eventLog, entry),
    milestones: event.milestone ? withMilestone(state.milestones, entry) : state.milestones,
    pendingEvent: null,
    peakMoney: Math.max(state.peakMoney, character.stats.money),
  });

  return advanceDays(resolved, pending.daysRemaining);
}
