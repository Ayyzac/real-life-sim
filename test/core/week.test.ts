import { describe, expect, it } from 'vitest';

import { createWorld } from '../../src/core/character';
import { applyDailyRules } from '../../src/core/clock';
import {
  actionBlocker,
  blockPending,
  blockToday,
  canSkipWork,
  closedReason,
  isWeekend,
  skipWork,
  startBlock,
} from '../../src/core/day';
import { findAction } from '../../src/data/actions';
import { BALANCE } from '../../src/data/balance';
import type { Character, WorldState } from '../../src/core/types';

const W = BALANCE.work;

function worker(patch: Partial<Character> = {}, state: Partial<WorldState> = {}): WorldState {
  const base = createWorld({ name: 'Nine To Five', backgroundId: 'scholarship', seed: 33 });
  return {
    ...base,
    ...state,
    character: {
      ...base.character,
      focusId: 'work',
      career: { type: 'job', jobId: 'cashier', tenureDays: 0, level: 0 },
      ...patch,
    },
  };
}

function strikesOf(state: WorldState): number {
  return state.character.career.type === 'job' ? (state.character.career.strikes ?? 0) : -1;
}

describe('weekends (GDD §11.3)', () => {
  it('starts every life on a Monday, so days 5 and 6 are the weekend', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(isWeekend)).toEqual([false, false, false, false, false, true, true, false]);
  });

  it('gives an employee no working day at the weekend', () => {
    expect(blockToday(worker({}, { clockDay: 5 }))).toBe(false);
    expect(blockToday(worker({}, { clockDay: 4 }))).toBe(true);
  });

  it('keeps the weekend for everyone else: study, training and the shop carry on', () => {
    expect(blockToday(worker({ focusId: 'study' }, { clockDay: 6 }))).toBe(true);
  });
});

describe('skipping work (GDD §11.3)', () => {
  it('is only on offer on a working day, before work starts', () => {
    expect(canSkipWork(worker())).toBe(true);
    expect(canSkipWork(worker({}, { clockDay: 5 }))).toBe(false);
    expect(canSkipWork(startBlock(worker()))).toBe(false);
    expect(canSkipWork(worker({ focusId: 'study' }))).toBe(false);
  });

  it('frees the day and leaves a mark', () => {
    const skipped = skipWork(worker());
    expect(blockPending(skipped)).toBe(false);
    expect(strikesOf(skipped)).toBe(1);
    expect(skipped.eventLog[0]?.text).toContain('Skipped work');
  });

  it('pays nothing for a skipped day, and does not count it as a rest day either', () => {
    const worked = applyDailyRules(worker());
    const skipped = applyDailyRules(skipWork(worker()));

    expect(skipped.character.stats.money).toBeLessThan(worked.character.stats.money);
    expect(skipped.character.career).toMatchObject({ tenureDays: 0 });

    const rested = applyDailyRules(worker({ focusId: 'rest' }));
    expect(skipped.character.stats.energy).toBeLessThan(rested.character.stats.energy);
  });

  it('warns at three marks, and lets you go at five', () => {
    let state = worker({ career: { type: 'job', jobId: 'cashier', tenureDays: 0, level: 0, strikes: 2 } });
    state = skipWork(state);
    expect(state.eventLog.some((entry) => entry.text.includes('Your boss has had a word'))).toBe(true);
    expect(state.character.career.type).toBe('job');

    state = skipWork({
      ...state,
      doneToday: [],
      character: { ...state.character, career: { type: 'job', jobId: 'cashier', tenureDays: 0, level: 0, strikes: 4 } },
    });
    expect(state.character.career).toEqual({ type: 'none' });
    expect(state.character.focusId).toBe('rest');
    expect(state.milestones[0]?.text).toContain('Fired');
  });

  it('lets marks fade on their own', () => {
    const marked = worker({ career: { type: 'job', jobId: 'cashier', tenureDays: 0, level: 0, strikes: 1 } });
    let state = marked;
    for (let day = 0; day < 30; day += 1) state = applyDailyRules(state);
    expect(strikesOf(state)).toBeCloseTo(0);
  });

  it('counts turning up unwashed as half a missed day', () => {
    const grubby = worker({ needs: { hunger: 60, thirst: 60, hygiene: 5 } });
    expect(strikesOf(startBlock(grubby))).toBe(W.unwashedStrike);
    expect(strikesOf(startBlock(worker()))).toBe(0);
  });
});

describe('opening hours (GDD §11.4)', () => {
  it('shuts the Cafe at night and opens it in the morning', () => {
    expect(closedReason('cafe', 23 * 60)).toBe('Closed · opens 07:00');
    expect(closedReason('cafe', 6 * 60)).toBe('Closed · opens 07:00');
    expect(closedReason('cafe', 12 * 60)).toBeNull();
  });

  it('never shuts home or the hospital', () => {
    expect(closedReason('home', 25 * 60)).toBeNull();
    expect(closedReason('hospital', 25 * 60)).toBeNull();
  });

  it('refuses something that would still be going at closing time', () => {
    const late = worker({ focusId: 'rest', location: 'cafe' }, { minuteOfDay: 22 * 60 - 20 });
    expect(actionBlocker(late, findAction('cafe_meal'))).toBe('Closes at 22:00');
    expect(actionBlocker(late, findAction('coffee'))).toBeNull();
  });
});
