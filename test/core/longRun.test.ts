import { describe, expect, it } from 'vitest';

import { ageInYears, createWorld } from '../../src/core/character';
import { advanceWeek } from '../../src/core/clock';
import { BALANCE } from '../../src/data/balance';
import { FOCUSES } from '../../src/data/focuses';
import type { WorldState } from '../../src/core/types';

/**
 * A full life is roughly 3,000 clicks of Advance Week. These tests play that
 * out to catch anything that only breaks after thousands of ticks: numbers
 * drifting out of range, NaN creeping in, or the log growing without bound.
 */

const LIFETIME_WEEKS = 3000;

function playLife(mutate: (state: WorldState, week: number) => WorldState): WorldState {
  let state = createWorld({ name: 'Marathon', backgroundId: 'athlete', seed: 4242 });
  for (let week = 0; week < LIFETIME_WEEKS; week += 1) {
    state = advanceWeek(mutate(state, week));
  }
  return state;
}

describe('a full lifetime of ticks', () => {
  it('keeps every stat inside its range and free of NaN', () => {
    // Alternate work and rest, the loop a real player falls into.
    const end = playLife((state, week) => ({
      ...state,
      character: {
        ...state.character,
        focusId: week % 3 === 2 ? 'rest' : 'work',
        career: { type: 'job', jobId: 'cashier', tenureDays: state.clockDay, level: 0 },
      },
    }));

    for (const [name, value] of Object.entries(end.character.stats)) {
      expect(Number.isFinite(value), `${name} is not finite`).toBe(true);
    }
    for (const key of ['health', 'energy', 'mood'] as const) {
      expect(end.character.stats[key]).toBeGreaterThanOrEqual(BALANCE.statMin);
      expect(end.character.stats[key]).toBeLessThanOrEqual(BALANCE.statMax);
    }
    for (const value of Object.values(end.character.attributes)) {
      expect(value).toBeGreaterThanOrEqual(BALANCE.statMin);
      expect(value).toBeLessThanOrEqual(BALANCE.statMax);
    }
  });

  it('ages the character into their seventies', () => {
    const end = playLife((state) => state);
    // 3000 weeks = 21000 days = 57 years on top of the starting age.
    expect(ageInYears(end.character)).toBe(BALANCE.startAgeYears + 57);
  });

  it('never lets the event log grow without bound', () => {
    const end = playLife((state, week) => ({
      ...state,
      character: {
        ...state.character,
        focusId: 'work',
        // Constantly near a promotion, so log entries keep being written.
        career: { type: 'job', jobId: 'cashier', tenureDays: 179 + week, level: 0 },
      },
    }));

    expect(end.eventLog.length).toBeLessThanOrEqual(BALANCE.eventLogLimit);
  });

  it('every focus survives a lifetime without breaking the simulation', () => {
    for (const focus of FOCUSES) {
      let state = createWorld({ name: focus.label, backgroundId: 'scholarship', seed: 11 });
      state = { ...state, character: { ...state.character, focusId: focus.id } };

      for (let week = 0; week < 500; week += 1) state = advanceWeek(state);

      expect(Number.isFinite(state.character.stats.money), `${focus.id} money`).toBe(true);
      expect(state.character.stats.health, `${focus.id} health`).toBeGreaterThanOrEqual(0);
      expect(state.character.stats.health, `${focus.id} health`).toBeLessThanOrEqual(100);
    }
  });

  it('the save stays small enough for localStorage after a full life', () => {
    const end = playLife((state) => state);
    const bytes = JSON.stringify(end).length;

    // localStorage gives about 5 MB. Anything near that is a design problem.
    expect(bytes).toBeLessThan(100_000);
  });
});
