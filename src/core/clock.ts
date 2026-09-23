import { BALANCE } from '../data/balance';
import { LINES } from '../data/dialogue';
import { dailyUpkeep } from './belongings';
import { DEFAULT_FOCUS_ID, findFocus } from '../data/focuses';
import { tradeOneDay } from './careers/business';
import { matchIsDue, playMatch, trainOneDay } from './careers/sports';
import { partnerOf, relationshipsOneDay, rollRelationships } from './relationships';
import { workOneDay } from './careers/job';
import { gymRenewal } from './gym';
import { ageInYears } from './character';
import { bedtimeCost, isWeekend, morningNeeds, SKIPPED_WORK } from './day';
import { withLogEntry, withMilestone } from './log';
import { applyEffect, findChoice, findEvent, needsDecision, rollEvent } from './events';
import { restoreRng, type Rng } from './rng';
import type { Attributes, EventLogEntry, Stats, WorldState } from './types';

/**
 * The only thing that moves time forward (docs/ARCHITECTURE.md §2).
 *
 * Every function here is pure: it takes a WorldState and returns a NEW one.
 * That keeps the state serialisable, makes tests trivial, and lets the React
 * layer detect changes by identity instead of deep comparison.
 *
 * Whole days only pass when the player sleeps or skips; the running clock
 * within a day lives in src/core/day.ts and is driven from the UI
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
  // Weekends are off for employees, and a skipped day is simply not worked
  // (GDD §11.3). The weekend is lived as a rest day; a skipped day as nothing
  // in particular, so skipping is never a way to recover.
  const weekendOff = focus.worksJob === true && isWeekend(state.clockDay);
  const skipped = focus.worksJob === true && state.doneToday.includes(SKIPPED_WORK);
  const today = weekendOff ? findFocus(DEFAULT_FOCUS_ID) : skipped ? null : focus;
  const effects = today?.effects ?? {};

  let stats: Stats = { ...character.stats };
  let attributes: Attributes = { ...character.attributes };
  let career = character.career;
  let eventLog = state.eventLog;
  let milestones = state.milestones;

  // Bedtime (GDD §11.2): going to bed hungry, or long after midnight, costs.
  // A day skipped with Advance was never played, so this is always zero for it.
  const bedtime = bedtimeCost(state);
  stats.energy += bedtime.energy;
  stats.mood += bedtime.mood;

  stats.energy += effects.energy ?? 0;
  stats.mood += effects.mood ?? 0;
  stats.health += effects.health ?? 0;
  attributes.intelligence += effects.intelligence ?? 0;
  attributes.physical += effects.physical ?? 0;
  attributes.charisma += effects.charisma ?? 0;

  if (focus.worksJob && !skipped) {
    // A weekend still counts as time in the job - only the pay stops.
    const worked = workOneDay(career, attributes);
    career = worked.career;
    if (!weekendOff) stats.money += worked.income;
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

  // A business trades every day, attended or not (GDD §4.2). Minding the shop
  // takes the full day's money; anything else takes the reduced share while
  // the costs stay the same, so an ignored business can run at a loss.
  if (career.type === 'business') {
    const traded = tradeOneDay(career, focus.runsBusiness === true);
    career = traded.career;
    stats.money += traded.profit;
  }

  // Training is the only thing that brings the next fixture closer, so a week
  // spent resting delays the match rather than forfeiting it.
  if (career.type === 'sports' && focus.trainsSport) {
    career = trainOneDay(career);
    if (career.type === 'sports') {
      career = { ...career, daysSinceMatch: career.daysSinceMatch + 1 };
    }
  }

  // The people around the character, every day (GDD §10): everyone ages,
  // closeness fades unless it is kept up, and the family costs what it costs.
  const social = relationshipsOneDay(state.people, today?.socialises === true);
  stats.mood += social.moodPerDay;
  if (social.breakup) {
    const entry: EventLogEntry = {
      day: state.clockDay,
      tone: 'bad',
      text: LINES.breakup.replace('{name}', social.breakup.name),
    };
    eventLog = withLogEntry(eventLog, entry);
    milestones = withMilestone(milestones, entry);
    stats.mood += BALANCE.relationships.breakupMood;
  }

  // What the character owns and how they live, every day (GDD §9). A better
  // home is worth more on the days they actually rest in it.
  const upkeep = dailyUpkeep(character);
  stats.energy += upkeep.perDay.energy ?? 0;
  stats.mood += upkeep.perDay.mood ?? 0;
  stats.health += upkeep.perDay.health ?? 0;
  if (today?.restores) stats.energy += upkeep.restBonusPerDay;

  // ponytail: money is allowed to go negative instead of blocking the activity.
  // Buying, however, is not: you cannot spend money you do not have (store.ts).
  stats.money -= BALANCE.livingCostPerDay + (today?.costPerDay ?? 0) + upkeep.costPerDay + social.costPerDay;

  // The gym renews itself every 30 days until it is stopped (GDD §12).
  const gym = gymRenewal(character, state.clockDay);
  stats.money -= gym.cost;

  // Marks for missed work fade on their own (GDD §11.3).
  if (career.type === 'job' && (career.strikes ?? 0) > 0) {
    career = { ...career, strikes: Math.max(0, (career.strikes ?? 0) - BALANCE.work.strikeFadePerDay) };
  }

  // Owing money wears on you (GDD §9.4). It presses rather than kills: the
  // health floor keeps debt from being a death sentence on its own.
  if (stats.money < 0) {
    stats.mood += BALANCE.debt.moodPerDay;
    if (stats.health > BALANCE.debt.healthFloor) {
      stats.health = Math.max(BALANCE.debt.healthFloor, stats.health + BALANCE.debt.healthPerDay);
    }
  }

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
    // A new morning (GDD §11.1).
    minuteOfDay: BALANCE.day.wake,
    doneToday: [],
    people: social.people,
    eventLog,
    milestones,
    character: {
      ...character,
      needs: morningNeeds(),
      ageInDays: character.ageInDays + 1,
      stats: clampStats(stats),
      attributes: clampAttributes(attributes),
      career,
      gymPaidUntil: gym.gymPaidUntil,
    },
  };

  return checkDeath({
    ...afterRules,
    peakMoney: Math.max(afterRules.peakMoney, afterRules.character.stats.money),
  });
}

/**
 * Settles a fixture if one has come round.
 *
 * Kept out of applyDailyRules on purpose: that function holds the rules that
 * are certain every day, and a match is a dice roll. Mixing them would make
 * the daily rules impossible to test exactly - the same reason random events
 * live out here too.
 */
function playDueMatch(state: WorldState, rng: Rng): WorldState {
  const character = state.character;
  if (!matchIsDue(character.career)) return state;

  const result = playMatch(character.career, character.attributes, ageInYears(character), rng);
  const entry: EventLogEntry = {
    day: state.clockDay,
    tone: result.won ? 'good' : 'bad',
    text: result.text,
  };

  return {
    ...state,
    eventLog: withLogEntry(state.eventLog, entry),
    character: {
      ...character,
      career: result.career,
      stats: clampStats({ ...character.stats, money: character.stats.money + result.prize }),
    },
  };
}

/**
 * The part of other people's lives that is down to chance: somebody dies,
 * drifts away, has news, or a new face turns up.
 *
 * Out here with the event roll rather than in applyDailyRules, for the same
 * reason matches are: the certain rules have to stay testable to the number.
 */
function rollOtherLives(state: WorldState, rng: Rng): WorldState {
  const outcome = rollRelationships(
    state.people,
    state.memories,
    state.clockDay,
    partnerOf(state.people) !== undefined,
    rng,
    state.character.career.type === 'job',
  );
  if (!outcome.text) return state;

  const entry: EventLogEntry = { day: state.clockDay, tone: outcome.tone, text: outcome.text };
  const stats = clampStats({
    ...state.character.stats,
    mood: state.character.stats.mood + outcome.moodChange,
  });

  return {
    ...state,
    people: outcome.people,
    memories: outcome.memories,
    eventLog: withLogEntry(state.eventLog, entry),
    milestones: outcome.milestone ? withMilestone(state.milestones, entry) : state.milestones,
    character: { ...state.character, stats },
  };
}

/** A full day: the certain rules above, then at most one random event. */
function simulateOneDay(state: WorldState): WorldState {
  const rng = restoreRng(state.rng);
  let next = applyDailyRules(state);
  if (next.deceased) return { ...next, rng: rng.snapshot() };

  next = playDueMatch(next, rng);
  next = rollOtherLives(next, rng);

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
