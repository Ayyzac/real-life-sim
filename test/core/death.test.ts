import { describe, expect, it } from 'vitest';

import { ageInYears, createWorld } from '../../src/core/character';
import { advanceDays, advanceWeek, applyDailyRules, resolveEvent } from '../../src/core/clock';
import { buildLifeSummary } from '../../src/core/summary';
import { BALANCE } from '../../src/data/balance';
import type { Character, WorldState } from '../../src/core/types';
import { playUntilDeath } from '../helpers/play';

function world(overrides: Partial<Character> = {}, seed = 31): WorldState {
  const base = createWorld({ name: 'Mortal', backgroundId: 'scholarship', seed });
  return { ...base, character: { ...base.character, ...overrides } };
}

/**
 * A character one small step from the end, at a real age.
 *
 * ageInDays counts days LIVED IN GAME, not years alive, so the offset from
 * BALANCE.startAgeYears matters - getting this wrong silently builds a
 * character 18 years older than intended.
 */
function onTheBrink(ageYears = 80): WorldState {
  const daysLived = Math.max(0, (ageYears - BALANCE.startAgeYears) * 365);
  const state = world({ ageInDays: daysLived, focusId: 'work' });
  state.character.stats.health = 0.2;
  state.character.stats.energy = 60;
  return state;
}

/** Someone young, already critically ill, finished off by one more illness. */
function youngAndFading(ageYears = 30): WorldState {
  const daysLived = Math.max(0, (ageYears - BALANCE.startAgeYears) * 365);
  const state: WorldState = {
    ...world({ ageInDays: daysLived }),
    pendingEvent: { eventId: 'serious_illness', daysRemaining: 0 },
  };
  state.character.stats.health = 4;
  return resolveEvent(state, 'tough_it_out');
}

describe('death', () => {
  it('arrives when health runs out', () => {
    const after = applyDailyRules(onTheBrink());

    expect(after.deceased).toBe(true);
    expect(after.character.stats.health).toBe(0);
  });

  it('records a cause and the day it happened', () => {
    const after = applyDailyRules(onTheBrink());

    expect(after.deathCause).toBeTruthy();
    expect(after.deathDay).toBe(after.clockDay);
  });

  it('describes old age differently from dying young', () => {
    const old = applyDailyRules(onTheBrink(80));
    const young = youngAndFading(30);

    expect(old.deathCause).toMatch(/old age/i);
    expect(young.deceased).toBe(true);
    expect(young.deathCause).not.toMatch(/old age/i);
    expect(young.deathCause).toMatch(/failing/i);
  });

  it('can still take someone young who ignored a long decline', () => {
    const young = youngAndFading(28);

    expect(young.deceased).toBe(true);
    expect(ageInYears(young.character)).toBe(28);
  });

  it('freezes time: nothing advances afterwards', () => {
    const dead = playUntilDeath(world({ focusId: 'work' }));
    const day = dead.clockDay;

    expect(advanceWeek(dead)).toBe(dead);
    expect(advanceDays(dead, 100)).toBe(dead);
    expect(dead.clockDay).toBe(day);
  });

  it('clears any waiting event, so the player is never asked a dead question', () => {
    const brink = {
      ...onTheBrink(),
      pendingEvent: { eventId: 'friend_invites', daysRemaining: 3 },
    };

    // Answering the last question of a life: the choice lands, then so does death.
    const after = resolveEvent(brink, 'stay');

    expect(after.deceased).toBe(true);
    expect(after.pendingEvent).toBeNull();
  });

  it('is never caused by one event out of nowhere', () => {
    // A character in reasonable health cannot be killed by a single illness.
    const healthy = {
      ...world(),
      pendingEvent: { eventId: 'serious_illness', daysRemaining: 0 },
    };
    healthy.character.stats.health = 60;

    const after = resolveEvent(healthy, 'tough_it_out');

    expect(after.deceased).toBe(false);
    expect(after.character.stats.health).toBeGreaterThanOrEqual(BALANCE.eventHealthFloor);
  });

  it('exhaustion alone wears a body down but does not finish it', () => {
    // Studying, not working: since Phase 6 an employee rests every weekend.
    let state = world({ focusId: 'study', ageInDays: 0 });
    state.character.stats.energy = 0;

    // Two years of running on empty, while still young enough that ageing
    // contributes nothing.
    for (let day = 0; day < 730; day += 1) state = applyDailyRules(state);

    expect(state.deceased).toBe(false);
    expect(state.character.stats.health).toBe(BALANCE.exhaustionHealthFloor);
  });
});

describe('the Life Summary', () => {
  it('reports the life that was actually lived', () => {
    const dead = playUntilDeath(
      world({ focusId: 'work', career: { type: 'job', jobId: 'cashier', tenureDays: 0, level: 0 } }),
    );
    const summary = buildLifeSummary(dead);

    expect(summary.name).toBe('Mortal');
    expect(summary.background).toBe('Scholarship Kid');
    expect(summary.ageAtDeath).toBe(ageInYears(dead.character));
    expect(summary.cause).toBe(dead.deathCause);
    expect(summary.finalCareer).toBe('Cashier');
    expect(summary.weeksLived).toBe(Math.floor(dead.character.ageInDays / 7));
  });

  it('remembers the most money ever held, not just what was left', () => {
    const dead = playUntilDeath(world({ focusId: 'work' }));
    const summary = buildLifeSummary(dead);

    expect(summary.peakMoney).toBeGreaterThanOrEqual(summary.finalMoney);
  });

  it('reads forwards: the earliest milestone comes first', () => {
    const dead = playUntilDeath(world({ focusId: 'work' }));
    const summary = buildLifeSummary(dead);

    const days = summary.milestones.map((m) => m.day);
    expect([...days].sort((a, b) => a - b)).toEqual(days);
  });

  it('always leaves a closing line', () => {
    const dead = playUntilDeath(world({ focusId: 'work' }));
    expect(buildLifeSummary(dead).epitaph.length).toBeGreaterThan(0);
  });

  it('says something different about a life cut short', () => {
    const early = youngAndFading(24);
    expect(buildLifeSummary(early).epitaph).toMatch(/cut short/i);
  });

  it('reports no job for someone who never had one', () => {
    const dead = playUntilDeath(world({ focusId: 'work', career: { type: 'none' } }));
    expect(buildLifeSummary(dead).finalCareer).toBeNull();
  });

  it('names a business owner\'s business, not "no job"', () => {
    const dead = playUntilDeath(
      world({ focusId: 'mind_business', career: { type: 'business', businessId: 'market_stall', daysOpen: 0, level: 0 } }),
    );
    expect(buildLifeSummary(dead).finalCareer).toMatch(/^Owner, /);
  });

  it('gives an athlete their sport and record', () => {
    const dead = playUntilDeath(
      world({
        focusId: 'rest',
        career: { type: 'sports', sportId: 'running', skill: 0, reputation: 0, daysSinceMatch: 0, wins: 3, losses: 1 },
      }),
    );
    expect(buildLifeSummary(dead).finalCareer).toBe('Running (3-1)');
  });
});
