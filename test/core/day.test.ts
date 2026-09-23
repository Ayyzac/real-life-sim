import { describe, expect, it } from 'vitest';

import { createWorld } from '../../src/core/character';
import { advanceDay, advanceWeek, applyDailyRules } from '../../src/core/clock';
import {
  actionBlocker,
  bedtimeCost,
  blockPending,
  freeUntil,
  hoursBelow,
  passTime,
  performAction,
  startBlock,
} from '../../src/core/day';
import { GameStore } from '../../src/core/store';
import type { SaveProvider } from '../../src/core/save/SaveProvider';
import { ACTIONS, findAction } from '../../src/data/actions';
import { BALANCE } from '../../src/data/balance';
import { FOCUSES } from '../../src/data/focuses';
import type { Character, WorldState } from '../../src/core/types';

const D = BALANCE.day;

function world(patch: Partial<Character> = {}, state: Partial<WorldState> = {}): WorldState {
  const base = createWorld({ name: 'Hours', backgroundId: 'scholarship', seed: 21 });
  return { ...base, ...state, character: { ...base.character, ...patch } };
}

function storeWith(state: WorldState): GameStore {
  const saves: SaveProvider = { save() {}, load: () => state, clear() {} };
  return new GameStore(saves);
}

describe('the hour-by-hour day (GDD §11)', () => {
  it('starts every life at seven in the morning with ordinary needs', () => {
    const fresh = world();
    expect(fresh.minuteOfDay).toBe(D.wake);
    expect(fresh.character.needs).toEqual(D.morningNeeds);
  });

  it('lets hunger, thirst and hygiene fall only while the clock is played', () => {
    const later = passTime(world(), 120);
    expect(later.minuteOfDay).toBe(D.wake + 120);
    expect(later.character.needs.hunger).toBeCloseTo(D.morningNeeds.hunger + D.needsPerHour.hunger * 2);
    expect(later.character.needs.thirst).toBeCloseTo(D.morningNeeds.thirst + D.needsPerHour.thirst * 2);
  });

  it('makes low needs cost mood and energy, but never health', () => {
    const parched = world({ needs: { hunger: 5, thirst: 5, hygiene: 5 } });
    const later = passTime(parched, 180);

    expect(later.character.stats.mood).toBeLessThan(parched.character.stats.mood);
    expect(later.character.stats.energy).toBeLessThan(parched.character.stats.energy);
    expect(later.character.stats.health).toBe(parched.character.stats.health);
  });

  it('counts only the hours actually spent under the line', () => {
    expect(hoursBelow(30, 10, 4, 20)).toBeCloseTo(2);
    expect(hoursBelow(50, 30, 4, 20)).toBe(0);
    expect(hoursBelow(10, 5, 4, 20)).toBe(4);
  });

  it('never drains needs on days skipped with Advance', () => {
    const skipped = advanceWeek(world({ focusId: 'rest' }));
    expect(skipped.character.needs).toEqual(D.morningNeeds);
    expect(skipped.minuteOfDay).toBe(D.wake);
  });

  it("wakes up to a new morning after sleeping, with the day's treats reset", () => {
    const played = performAction(world({ location: 'home', focusId: 'rest' }), 'cook');
    const slept = advanceDay(played);

    expect(slept.minuteOfDay).toBe(D.wake);
    expect(slept.doneToday).toEqual([]);
    expect(slept.character.needs).toEqual(D.morningNeeds);
  });
});

describe('free time and the working day', () => {
  it('gives someone resting the whole day', () => {
    const resting = world({ focusId: 'rest' });
    expect(blockPending(resting)).toBe(false);
    expect(freeUntil(resting)).toBe(D.latest);
  });

  it('gives a worker only the morning until the working day is done', () => {
    const worker = world({ focusId: 'work' });
    expect(blockPending(worker)).toBe(true);
    expect(freeUntil(worker)).toBe(D.blockStart);
  });

  it("jumps to five o'clock and to the focus's place for the working day", () => {
    const done = startBlock(world({ focusId: 'work', location: 'home' }));

    expect(done.minuteOfDay).toBe(D.blockEnd);
    expect(done.character.location).toBe('work');
    expect(blockPending(done)).toBe(false);
  });

  it('slows hunger and thirst during the working day - lunch is part of it', () => {
    const done = startBlock(world({ focusId: 'work' }));
    const hours = (D.blockEnd - D.wake) / 60;
    expect(done.character.needs.hunger).toBeCloseTo(
      D.morningNeeds.hunger + D.needsPerHour.hunger * hours * D.blockNeedsRate,
    );
  });

  it('refuses an action that would run into the working day', () => {
    const worker = world({ focusId: 'work', location: 'home' }, { minuteOfDay: D.blockStart - 20 });
    expect(actionBlocker(worker, findAction('cook'))).toBe('Not enough time before work');
  });

  it('refuses an action that would run past two in the morning', () => {
    const late = world({ focusId: 'rest', location: 'home' }, { minuteOfDay: D.latest - 10 });
    expect(actionBlocker(late, findAction('cook'))).toBe('Too late tonight');
  });

  it("charges tomorrow's energy for staying up past midnight", () => {
    const late = world({}, { minuteOfDay: D.midnight + 120 });
    expect(bedtimeCost(late).energy).toBe(2 * D.lateNightEnergyPerHour);
  });

  it('charges for going to bed hungry', () => {
    const rested = applyDailyRules(world());
    const tired = applyDailyRules(world({ needs: { hunger: 5, thirst: 60, hygiene: 60 } }));
    expect(tired.character.stats.energy).toBeLessThan(rested.character.stats.energy);
  });
});

describe('actions (src/data/actions.ts)', () => {
  it('feeds you at the end of the meal and moves the clock', () => {
    const before = world({ location: 'home', focusId: 'rest' });
    const after = performAction(before, 'cook');

    expect(after.minuteOfDay).toBe(before.minuteOfDay + findAction('cook').minutes);
    expect(after.character.needs.hunger).toBeGreaterThan(before.character.needs.hunger);
  });

  it('only happens where it belongs', () => {
    const away = world({ location: 'gym', focusId: 'rest' });
    expect(performAction(away, 'cook')).toBe(away);
  });

  it('cannot be paid for with money you do not have', () => {
    const broke = world({ location: 'cafe', focusId: 'rest', stats: { ...world().character.stats, money: 2 } });
    expect(performAction(broke, 'coffee')).toBe(broke);
  });

  it('gives its treat once a day, however often it is repeated', () => {
    const start = world({ location: 'cafe', focusId: 'rest' });
    const one = performAction(start, 'coffee');
    const two = performAction(one, 'coffee');

    expect(one.character.stats.energy).toBeGreaterThan(start.character.stats.energy);
    expect(two.character.stats.energy).toBe(one.character.stats.energy);
    expect(two.character.needs.thirst).toBeGreaterThan(one.character.needs.thirst);
  });

  it('refuses to repeat something that only has a treat to give', () => {
    const once = performAction(world({ location: 'hospital', focusId: 'rest' }), 'checkup');
    expect(actionBlocker(once, findAction('checkup'))).toBe('Already done today');
  });

  it('cannot beat the best focus at raising health or attributes in one day', () => {
    // Playing by hand is rewarded, but it must not become the way to live
    // forever: every treat in the game, once each, stays within one day of
    // the best focus for each number.
    for (const key of ['health', 'intelligence', 'physical', 'charisma'] as const) {
      const byHand = ACTIONS.reduce((sum, action) => sum + Math.max(0, action.effects?.[key] ?? 0), 0);
      const best = Math.max(...FOCUSES.map((focus) => focus.effects[key] ?? 0));
      expect(byHand).toBeLessThanOrEqual(best + 1e-9);
    }
  });

  it('sends the character to bed at two in the morning', () => {
    const base = world({ location: 'home', focusId: 'rest' }, { minuteOfDay: D.latest - 5 });
    const store = storeWith(base);

    store.dispatch({ type: 'doAction', actionId: 'water' });

    expect(store.getState()?.clockDay).toBe(base.clockDay + 1);
    expect(store.getState()?.minuteOfDay).toBe(D.wake);
  });
});
