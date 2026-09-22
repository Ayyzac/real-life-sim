import { describe, expect, it } from 'vitest';

import { ageInYears, createWorld } from '../../src/core/character';
import { BALANCE } from '../../src/data/balance';
import { FOCUSES } from '../../src/data/focuses';
import type { WorldState } from '../../src/core/types';
import { playUntilDeath, playWeeks, resolveAll } from '../helpers/play';
import { advanceWeek } from '../../src/core/clock';
import { upgradeCost } from '../../src/core/careers/business';
import { findBusiness } from '../../src/data/businesses';

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

/**
 * Plays a whole life running one business: works an ordinary job until the
 * capital is there, then opens up and reinvests when it can comfortably
 * afford to. `neglect` studies instead of minding the shop.
 */
function liveAsOwner(seed: number, businessId: string, neglect: boolean): WorldState {
  const business = findBusiness(businessId);
  let state = createWorld({ name: 'Owner', backgroundId: 'scholarship', seed });

  for (let week = 0; week < 6000 && !state.deceased; week += 1) {
    const { career, stats } = state.character;
    const busy = neglect ? 'study' : 'mind_business';
    let next = state.character;

    if (career.type !== 'business') {
      next =
        stats.money < business.startupCost
          ? {
              ...next,
              focusId: upkeepFocus(state, 'work'),
              career:
                career.type === 'job'
                  ? career
                  : { type: 'job', jobId: 'office_clerk', tenureDays: 0, level: 0 },
            }
          : {
              ...next,
              focusId: upkeepFocus(state, busy),
              stats: { ...stats, money: stats.money - business.startupCost },
              career: { type: 'business', businessId, daysOpen: 0, level: 0 },
            };
    } else {
      const cost = upgradeCost(career.level);
      const grow = cost !== null && stats.money >= cost * 3;
      next = {
        ...next,
        focusId: upkeepFocus(state, busy),
        stats: { ...stats, money: stats.money - (grow && cost !== null ? cost : 0) },
        career: grow ? { ...career, level: career.level + 1 } : career,
      };
    }

    state = resolveAll(advanceWeek({ ...state, character: next }));
  }

  return state;
}

/** Fix whatever is worst first, otherwise get on with `busy`. */
function upkeepFocus(state: WorldState, busy: string): string {
  const { health, energy, mood } = state.character.stats;
  if (health < 40) return 'treatment';
  if (energy < 45) return 'rest';
  if (mood < 35) return 'socialize';
  return busy;
}

/**
 * Business balance, pinned the same way the lifespan is.
 *
 * These numbers were not guessed: whole lifetimes were simulated and read off
 * (docs/ARCHITECTURE.md §11). What is pinned here is the SHAPE - which way
 * round the options come out - rather than exact totals, so tuning stays
 * possible without the tests turning into busywork.
 */
describe('the agreed shape of a business', () => {
  it('rewards minding the shop more than an ordinary job does', () => {
    for (const seed of [1, 4242]) {
      const owner = liveAsOwner(seed, 'repair_workshop', false);
      const employee = liveCarefully(seed);

      expect(owner.peakMoney, `seed ${seed}`).toBeGreaterThan(employee.peakMoney);
    }
  });

  it('makes the dearer business the better one, for someone who turns up', () => {
    // A business that costs more to open has to be worth more to run, or
    // there is no reason to ever buy it.
    const stall = liveAsOwner(1, 'market_stall', false);
    const shop = liveAsOwner(1, 'online_shop', false);
    const workshop = liveAsOwner(1, 'repair_workshop', false);

    expect(shop.peakMoney).toBeGreaterThan(stall.peakMoney);
    expect(workshop.peakMoney).toBeGreaterThan(shop.peakMoney);
  });

  it('lets a workshop nobody runs swallow a lifetime of money', () => {
    // The player chose no automatic bankruptcy (22 Sep 2026), so this is
    // allowed to happen - the Dashboard warning is what stops it happening
    // silently.
    const ignored = liveAsOwner(1, 'repair_workshop', true);

    expect(ignored.character.stats.money).toBeLessThan(0);
  });

  it('keeps a lifetime inside the agreed lifespan whichever career is taken', () => {
    for (const businessId of ['market_stall', 'online_shop', 'repair_workshop']) {
      const end = liveAsOwner(7, businessId, false);
      const age = ageInYears(end.character);

      expect(end.deceased, businessId).toBe(true);
      expect(age, `${businessId} died at ${age}`).toBeGreaterThanOrEqual(80);
      expect(age, `${businessId} died at ${age}`).toBeLessThanOrEqual(100);
    }
  });
});
