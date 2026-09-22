import { describe, expect, it } from 'vitest';

import { createWorld } from '../../src/core/character';
import { advanceWeek, resolveEvent } from '../../src/core/clock';
import {
  applyEffect,
  eligibleEvents,
  findChoice,
  findEvent,
  needsDecision,
  rollEvent,
} from '../../src/core/events';
import { createRng } from '../../src/core/rng';
import { EVENTS } from '../../src/data/events';
import { BALANCE } from '../../src/data/balance';
import type { Character, WorldState } from '../../src/core/types';
import { resolveAll } from '../helpers/play';

function world(overrides: Partial<Character> = {}, seed = 99): WorldState {
  const base = createWorld({ name: 'Eventful', backgroundId: 'scholarship', seed });
  return { ...base, character: { ...base.character, ...overrides } };
}

describe('event data', () => {
  it('has unique ids', () => {
    const ids = EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every event either an effect or choices, never neither', () => {
    for (const event of EVENTS) {
      const hasOutcome = event.effect !== undefined || (event.choices?.length ?? 0) > 0;
      expect(hasOutcome, `event "${event.id}" does nothing`).toBe(true);
    }
  });

  it('gives every choice a unique id within its event', () => {
    for (const event of EVENTS) {
      const ids = event.choices?.map((c) => c.id) ?? [];
      expect(new Set(ids).size, `event "${event.id}" has duplicate choice ids`).toBe(ids.length);
    }
  });

  it('uses positive weights, or the weighted pick breaks', () => {
    for (const event of EVENTS) expect(event.weight, `event "${event.id}"`).toBeGreaterThan(0);
  });
});

describe('eligibleEvents', () => {
  it('hides job events from the unemployed', () => {
    const jobless = world({ career: { type: 'none' } }).character;
    expect(eligibleEvents(jobless).map((e) => e.id)).not.toContain('work_bonus');
  });

  it('offers job events once employed', () => {
    const employed = world({
      career: { type: 'job', jobId: 'cashier', tenureDays: 0, level: 0 },
    }).character;
    expect(eligibleEvents(employed).map((e) => e.id)).toContain('work_bonus');
  });

  it('only offers serious illness to someone already unwell', () => {
    const healthy = world().character;
    healthy.stats.health = 90;
    expect(eligibleEvents(healthy).map((e) => e.id)).not.toContain('serious_illness');

    const unwell = world().character;
    unwell.stats.health = 40;
    expect(eligibleEvents(unwell).map((e) => e.id)).toContain('serious_illness');
  });

  it('only mentions aching joints to the middle-aged and older', () => {
    const young = world().character;
    expect(eligibleEvents(young).map((e) => e.id)).not.toContain('aching_joints');

    const older = world({ ageInDays: 40 * 365 }).character;
    expect(eligibleEvents(older).map((e) => e.id)).toContain('aching_joints');
  });
});

describe('rollEvent', () => {
  it('leaves most days uneventful', () => {
    const character = world().character;
    const rng = createRng(2026);

    let fired = 0;
    const days = 20_000;
    for (let i = 0; i < days; i += 1) if (rollEvent(character, rng)) fired += 1;

    // Should land near the configured rate, give or take sampling noise.
    const rate = fired / days;
    expect(rate).toBeGreaterThan(BALANCE.eventChancePerDay * 0.85);
    expect(rate).toBeLessThan(BALANCE.eventChancePerDay * 1.15);
  });

  it('never returns an event the character is ineligible for', () => {
    const jobless = world({ career: { type: 'none' } }).character;
    jobless.stats.health = 100;
    jobless.stats.energy = 100;
    const rng = createRng(5);

    for (let i = 0; i < 20_000; i += 1) {
      const event = rollEvent(jobless, rng);
      if (!event) continue;
      expect(event.eligibility?.(jobless) ?? true).toBe(true);
    }
  });

  it('is deterministic for a given seed', () => {
    const character = world().character;
    const a = createRng(7);
    const b = createRng(7);

    const runA = Array.from({ length: 300 }, () => rollEvent(character, a)?.id ?? null);
    const runB = Array.from({ length: 300 }, () => rollEvent(character, b)?.id ?? null);

    expect(runA).toEqual(runB);
  });
});

describe('applyEffect', () => {
  it('adds the listed changes', () => {
    const before = world().character;
    const after = applyEffect(before, { money: 100, mood: 5 });

    expect(after.stats.money).toBe(before.stats.money + 100);
    expect(after.stats.mood).toBe(before.stats.mood + 5);
  });

  it('leaves untouched values alone', () => {
    const before = world().character;
    const after = applyEffect(before, { money: 10 });

    expect(after.stats.health).toBe(before.stats.health);
    expect(after.attributes).toEqual(before.attributes);
  });

  it('cannot kill a healthy character outright: health stops above zero', () => {
    const before = world().character;
    before.stats.health = 70;

    const after = applyEffect(before, { health: -999 });

    expect(after.stats.health).toBe(BALANCE.eventHealthFloor);
    expect(after.stats.health).toBeGreaterThan(0);
  });

  it('CAN finish off someone already critically ill', () => {
    const before = world().character;
    before.stats.health = BALANCE.criticalHealth - 1;

    const after = applyEffect(before, { health: -999 });

    expect(after.stats.health).toBe(0);
  });

  it('draws the line exactly at the critical threshold', () => {
    const justAbove = world().character;
    justAbove.stats.health = BALANCE.criticalHealth + 1;
    expect(applyEffect(justAbove, { health: -999 }).stats.health).toBe(BALANCE.eventHealthFloor);

    const atTheLine = world().character;
    atTheLine.stats.health = BALANCE.criticalHealth;
    expect(applyEffect(atTheLine, { health: -999 }).stats.health).toBe(0);
  });

  it('clamps the other stats to their range', () => {
    const before = world().character;

    expect(applyEffect(before, { energy: 999 }).stats.energy).toBe(BALANCE.statMax);
    expect(applyEffect(before, { mood: -999 }).stats.mood).toBe(BALANCE.statMin);
  });

  it('does not mutate the character it was given', () => {
    const before = world().character;
    const money = before.stats.money;

    applyEffect(before, { money: -500 });

    expect(before.stats.money).toBe(money);
  });
});

describe('needsDecision and findChoice', () => {
  it('flags only events that offer choices', () => {
    expect(needsDecision(findEvent('friend_invites'))).toBe(true);
    expect(needsDecision(findEvent('common_cold'))).toBe(false);
  });

  it('throws loudly on an unknown choice rather than silently doing nothing', () => {
    expect(() => findChoice(findEvent('friend_invites'), 'nonsense')).toThrow(/no choice/);
  });

  it('throws on an unknown event id', () => {
    expect(() => findEvent('nope')).toThrow(/Unknown event/);
  });
});

/**
 * The part the user specifically asked for: a week that stops mid-way, and
 * picks up exactly where it left off once the player answers.
 */
describe('a week that stops for a decision', () => {
  function playUntilPaused(): { before: WorldState; paused: WorldState } {
    let state = world({ focusId: 'rest' });
    for (let week = 0; week < 500; week += 1) {
      const before = state;
      const next = advanceWeek(state);
      if (next.pendingEvent) return { before, paused: next };
      state = next;
    }
    throw new Error('no event paused a week within 500 weeks');
  }

  it('stops part-way and remembers the days it still owes', () => {
    const { before, paused } = playUntilPaused();
    const daysPlayed = paused.clockDay - before.clockDay;

    expect(paused.pendingEvent).not.toBeNull();
    expect(daysPlayed).toBeGreaterThan(0);
    expect(daysPlayed + paused.pendingEvent!.daysRemaining).toBe(7);
  });

  it('refuses to advance again until it is answered', () => {
    const { paused } = playUntilPaused();
    expect(advanceWeek(paused)).toBe(paused);
  });

  it('plays out the rest of the week once answered', () => {
    const { before, paused } = playUntilPaused();
    const resumed = resolveAll(paused);

    expect(resumed.pendingEvent).toBeNull();
    expect(resumed.clockDay).toBe(before.clockDay + 7);
  });

  it('applies the chosen option, and only that option', () => {
    const paused: WorldState = {
      ...world(),
      pendingEvent: { eventId: 'friend_invites', daysRemaining: 0 },
    };
    const before = paused.character.stats;

    const stayedIn = resolveEvent(paused, 'stay');
    const wentOut = resolveEvent(paused, 'go');

    // Staying in costs nothing; going out costs money.
    expect(stayedIn.character.stats.money).toBe(before.money);
    expect(wentOut.character.stats.money).toBe(before.money - 90);
    expect(wentOut.character.stats.mood).toBeGreaterThan(stayedIn.character.stats.mood);
  });

  it('writes the outcome to the log', () => {
    const paused: WorldState = {
      ...world(),
      pendingEvent: { eventId: 'friend_invites', daysRemaining: 0 },
    };

    const after = resolveEvent(paused, 'go');

    expect(after.eventLog[0]?.text).toContain('went out with a friend');
  });

  it('does nothing when there is no event waiting', () => {
    const calm = world();
    expect(resolveEvent(calm, 'go')).toBe(calm);
  });

  it('survives being saved and loaded mid-decision', () => {
    const { paused } = playUntilPaused();

    const reloaded = JSON.parse(JSON.stringify(paused)) as WorldState;

    expect(reloaded.pendingEvent).toEqual(paused.pendingEvent);
    expect(resolveAll(reloaded).clockDay).toBe(resolveAll(paused).clockDay);
  });
});
