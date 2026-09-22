import { describe, expect, it } from 'vitest';

import { ageInYears, createWorld } from '../../src/core/character';
import { advanceDay, advanceDays, advanceWeek, ageingHealthLossPerDay } from '../../src/core/clock';
import { BALANCE } from '../../src/data/balance';
import { findFocus } from '../../src/data/focuses';
import { findJob } from '../../src/data/jobs';
import type { WorldState } from '../../src/core/types';

// Read the tuning instead of repeating it, so balancing cannot silently
// invalidate these tests.
const CASHIER_DAILY = findJob('cashier').salaryPerDay;
const REST_ENERGY = findFocus('rest').effects.energy!;
const WORK_ENERGY = findFocus('work').effects.energy!;
const SOCIALIZE_COST = findFocus('socialize').costPerDay!;

/** A fixed seed keeps every run of these tests identical. */
function world(overrides: Partial<WorldState['character']> = {}): WorldState {
  const base = createWorld({ name: 'Tester', backgroundId: 'athlete', seed: 2026 });
  return { ...base, character: { ...base.character, ...overrides } };
}

describe('advanceDay', () => {
  it('moves the calendar and the character exactly one day', () => {
    const before = world();
    const after = advanceDay(before);

    expect(after.clockDay).toBe(before.clockDay + 1);
    expect(after.character.ageInDays).toBe(before.character.ageInDays + 1);
  });

  it('returns a new object and leaves the old state untouched', () => {
    const before = world();
    const beforeMoney = before.character.stats.money;

    const after = advanceDay(before);

    expect(after).not.toBe(before);
    expect(before.character.stats.money).toBe(beforeMoney);
  });

  it('charges living costs every day, working or not', () => {
    const before = world({ focusId: 'rest' });
    const after = advanceDay(before);

    expect(after.character.stats.money).toBe(
      before.character.stats.money - BALANCE.livingCostPerDay,
    );
  });

  it('pays a wage when the focus is Work and the character has a job', () => {
    const before = world({
      focusId: 'work',
      career: { type: 'job', jobId: 'cashier', tenureDays: 0, level: 0 },
    });
    const after = advanceDay(before);

    expect(after.character.stats.money).toBe(
      before.character.stats.money + CASHIER_DAILY - BALANCE.livingCostPerDay,
    );
    expect(after.character.career).toMatchObject({ tenureDays: 1 });
  });

  it('pays nothing for working while unemployed, but still charges living costs', () => {
    const before = world({ focusId: 'work', career: { type: 'none' } });
    const after = advanceDay(before);

    expect(after.character.stats.money).toBe(
      before.character.stats.money - BALANCE.livingCostPerDay,
    );
  });

  it('restores energy when resting and drains it when working', () => {
    const tired = world({ focusId: 'rest' });
    tired.character.stats.energy = 40;
    expect(advanceDay(tired).character.stats.energy).toBe(40 + REST_ENERGY);

    const working = world({
      focusId: 'work',
      career: { type: 'job', jobId: 'cashier', tenureDays: 0, level: 0 },
    });
    working.character.stats.energy = 40;
    expect(advanceDay(working).character.stats.energy).toBe(40 + WORK_ENERGY);
  });

  it('never lets a stat leave the 0-100 range', () => {
    const state = world({ focusId: 'rest' });
    state.character.stats.energy = 99;
    state.character.stats.health = 100;

    const after = advanceDay(state);

    expect(after.character.stats.energy).toBeLessThanOrEqual(BALANCE.statMax);
    expect(after.character.stats.health).toBeLessThanOrEqual(BALANCE.statMax);
    expect(after.character.stats.mood).toBeGreaterThanOrEqual(BALANCE.statMin);
  });

  it('costs health while energy sits below the exhaustion line', () => {
    const exhausted = world({ focusId: 'study' });
    exhausted.character.stats.energy = 5;
    exhausted.character.stats.health = 50;

    const after = advanceDay(exhausted);

    expect(after.character.stats.health).toBeCloseTo(50 - BALANCE.lowEnergyHealthPenaltyPerDay, 5);
  });

  it('charges the extra cost of a paid activity on top of living costs', () => {
    const before = world({ focusId: 'socialize' });
    const after = advanceDay(before);

    expect(after.character.stats.money).toBe(
      before.character.stats.money - BALANCE.livingCostPerDay - SOCIALIZE_COST,
    );
  });

  it('does nothing once the character is dead', () => {
    const dead = { ...world(), deceased: true };
    expect(advanceDay(dead)).toBe(dead);
  });
});

describe('advanceWeek', () => {
  it('is exactly seven days', () => {
    const before = world();

    expect(advanceWeek(before).clockDay).toBe(before.clockDay + 7);
    expect(advanceWeek(before)).toEqual(advanceDays(before, 7));
  });

  it('a full working week on the entry job nets a small profit', () => {
    const before = world({
      focusId: 'work',
      career: { type: 'job', jobId: 'cashier', tenureDays: 0, level: 0 },
    });

    const after = advanceWeek(before);
    const earned = after.character.stats.money - before.character.stats.money;

    expect(earned).toBe(7 * (CASHIER_DAILY - BALANCE.livingCostPerDay));
    // The point of the number: a full working week is a PROFIT, but a thin one.
    expect(earned).toBeGreaterThan(0);
    expect(earned).toBeLessThan(200);
  });
});

describe('ageInYears', () => {
  it('starts at the configured age', () => {
    expect(ageInYears(world().character)).toBe(BALANCE.startAgeYears);
  });

  it('gains a year every 365 days', () => {
    const aged = advanceDays(world(), 365);
    expect(ageInYears(aged.character)).toBe(BALANCE.startAgeYears + 1);
  });
});

describe('ageingHealthLossPerDay', () => {
  it('is zero for the young', () => {
    expect(ageingHealthLossPerDay(20)).toBe(0);
    expect(ageingHealthLossPerDay(BALANCE.healthDecayStartAgeYears)).toBe(0);
  });

  it('grows the older the character gets', () => {
    expect(ageingHealthLossPerDay(60)).toBeGreaterThan(ageingHealthLossPerDay(50));
    expect(ageingHealthLossPerDay(80)).toBeGreaterThan(ageingHealthLossPerDay(60));
  });
});
