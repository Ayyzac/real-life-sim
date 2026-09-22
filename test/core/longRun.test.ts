import { describe, expect, it } from 'vitest';

import { ageInYears, createWorld } from '../../src/core/character';
import { BALANCE } from '../../src/data/balance';
import { FOCUSES } from '../../src/data/focuses';
import type { WorldState } from '../../src/core/types';
import { playUntilDeath, playWeeks, resolveAll } from '../helpers/play';
import { advanceWeek } from '../../src/core/clock';

/**
 * A full life is thousands of clicks. These tests play one out to catch what
 * only breaks after a very long time: numbers drifting out of range, NaN
 * creeping in, logs growing without bound, or a character who never dies.
 */

function fresh(name = 'Marathon', backgroundId = 'athlete', seed = 4242): WorldState {
  return createWorld({ name, backgroundId, seed });
}

/** What an attentive player does: fix whatever is worst, otherwise work. */
function carefulWeek(state: WorldState): WorldState {
  const { health, energy, mood } = state.character.stats;
  const focusId =
    health < 40 ? 'treatment' : energy < 45 ? 'rest' : mood < 35 ? 'socialize' : 'work';

  return resolveAll(
    advanceWeek({
      ...state,
      character: {
        ...state.character,
        focusId,
        career:
          state.character.career.type === 'job'
            ? state.character.career
            : { type: 'job', jobId: 'office_clerk', tenureDays: 0, level: 0 },
      },
    }),
  );
}

function liveCarefully(seed: number): WorldState {
  let state = createWorld({ name: 'Careful', backgroundId: 'scholarship', seed });
  for (let week = 0; week < 6000 && !state.deceased; week += 1) state = carefulWeek(state);
  return state;
}

describe('a whole lifetime', () => {
  it('always ends: nobody lives forever', () => {
    const end = playUntilDeath(fresh());

    expect(end.deceased).toBe(true);
    expect(end.deathCause).toBeTruthy();
    expect(end.deathDay).toBe(end.clockDay);
  });

  it('keeps every stat inside its range and free of NaN', () => {
    const end = playUntilDeath(fresh());

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

  it('never lets the logs grow without bound', () => {
    const end = playUntilDeath(fresh());

    expect(end.eventLog.length).toBeLessThanOrEqual(BALANCE.eventLogLimit);
    expect(end.milestones.length).toBeLessThanOrEqual(BALANCE.milestoneLimit);
  });

  it('leaves a save small enough for localStorage', () => {
    const end = playUntilDeath(fresh());
    // localStorage gives about 5 MB. Anything near that is a design problem.
    expect(JSON.stringify(end).length).toBeLessThan(100_000);
  });

  it('every focus survives a long run without breaking the simulation', () => {
    for (const focus of FOCUSES) {
      let state = createWorld({ name: focus.label, backgroundId: 'scholarship', seed: 11 });
      state = { ...state, character: { ...state.character, focusId: focus.id } };

      state = playWeeks(state, 500);

      expect(Number.isFinite(state.character.stats.money), `${focus.id} money`).toBe(true);
      expect(state.character.stats.health, `${focus.id} health`).toBeGreaterThanOrEqual(0);
      expect(state.character.stats.health, `${focus.id} health`).toBeLessThanOrEqual(100);
    }
  });
});

/**
 * The user asked (22 Sep 2026) for a careful player to die somewhere in their
 * late eighties or early nineties, and a careless one much sooner. That is a
 * balance promise, so it is pinned here: anyone who retunes the mortality
 * curve and breaks the promise gets a red test instead of a silent change.
 */
describe('the agreed shape of a lifespan', () => {
  it('an attentive player reaches their late eighties or nineties', () => {
    for (const seed of [1, 7, 4242]) {
      const end = liveCarefully(seed);
      const age = ageInYears(end.character);

      expect(end.deceased, `seed ${seed} never died`).toBe(true);
      expect(age, `seed ${seed} died at ${age}`).toBeGreaterThanOrEqual(80);
      expect(age, `seed ${seed} died at ${age}`).toBeLessThanOrEqual(100);
    }
  });

  it('a player who only ever works dies far younger than a careful one', () => {
    let reckless = createWorld({ name: 'Reckless', backgroundId: 'scholarship', seed: 1 });
    reckless = {
      ...reckless,
      character: {
        ...reckless.character,
        focusId: 'work',
        career: { type: 'job', jobId: 'office_clerk', tenureDays: 0, level: 0 },
      },
    };
    reckless = playUntilDeath(reckless);

    const recklessAge = ageInYears(reckless.character);
    const carefulAge = ageInYears(liveCarefully(1).character);

    expect(reckless.deceased).toBe(true);
    expect(recklessAge).toBeLessThan(carefulAge - 15);
  });
});
