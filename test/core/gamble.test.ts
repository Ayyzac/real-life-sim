import { describe, expect, it } from 'vitest';

import { createWorld } from '../../src/core/character';
import {
  betBlocker,
  dealBlackjack,
  handValue,
  hitBlackjack,
  rouletteWins,
  slotReturn,
  spinRoulette,
  spinSlot,
  standBlackjack,
} from '../../src/core/gamble';
import type { Character, WorldState } from '../../src/core/types';
import { TABLE_LIMITS, type Venue } from '../../src/data/gambling';

function world(patch: Partial<Character> = {}, state: Partial<WorldState> = {}, seed = 41): WorldState {
  const base = createWorld({ name: 'Punter', backgroundId: 'scholarship', seed });
  return {
    ...base,
    minuteOfDay: 20 * 60,
    ...state,
    character: {
      ...base.character,
      focusId: 'rest',
      location: 'casino',
      ...patch,
      stats: { ...base.character.stats, money: 1_000_000 },
    },
  };
}

/** Plays `spins` slot spins in a row and returns paid-back per dollar bet. */
function playSlots(venue: Venue, spins: number): number {
  let state = world();
  let bet = 0;
  let won = 0;
  for (let i = 0; i < spins; i += 1) {
    state = spinSlot({ ...state, minuteOfDay: 20 * 60 }, 10, venue);
    bet += 10;
    won += state.lastBet!.won;
  }
  return won / bet;
}

describe('the Casino and online slots (GDD §12)', () => {
  it('always lets the house win, and online wins more', () => {
    expect(slotReturn('casino')).toBeCloseTo(0.92, 3);
    expect(slotReturn('online')).toBeCloseTo(0.855, 3);

    const casino = playSlots('casino', 50_000);
    const online = playSlots('online', 50_000);
    expect(casino).toBeLessThan(1);
    expect(Math.abs(casino - 0.92)).toBeLessThan(0.04);
    expect(Math.abs(online - 0.855)).toBeLessThan(0.04);
  });

  it('takes bets only at the Casino while open, within limits, and never on credit', () => {
    expect(betBlocker(world(), 'slot', 10)).toBeNull();
    expect(betBlocker(world({ location: 'home' }), 'slot', 10)).toBe('Only at the Casino');
    expect(betBlocker(world({ location: 'home' }), 'slot', 10, 'online')).toBeNull();
    expect(betBlocker(world({}, { minuteOfDay: 10 * 60 }), 'roulette', 10)).toMatch(/Closed/);
    expect(betBlocker(world(), 'roulette', TABLE_LIMITS.roulette.max + 1)).toMatch(/Maximum/);
    const broke = world();
    const skint = { ...broke, character: { ...broke.character, stats: { ...broke.character.stats, money: 3 } } };
    expect(betBlocker(skint, 'slot', 5)).toBe('Cannot afford');
  });

  it('pays roulette the way the table says', () => {
    expect(rouletteWins('red', 1)).toBe(2);
    expect(rouletteWins('black', 1)).toBe(0);
    expect(rouletteWins('even', 0)).toBe(0);
    expect(rouletteWins(17, 17)).toBe(36);
    expect(rouletteWins(17, 18)).toBe(0);
  });

  it('rolls real, saved dice and takes the time', () => {
    const before = world();
    const after = spinRoulette(before, 10, 'red');
    expect(after.rng).not.toEqual(before.rng);
    expect(after.minuteOfDay).toBe(before.minuteOfDay + 2);
    expect(after.character.stats.money - before.character.stats.money).toBe(after.lastBet!.won - 10);
  });

  it('counts blackjack hands properly', () => {
    expect(handValue([1, 13])).toBe(21);
    expect(handValue([1, 1, 9])).toBe(21);
    expect(handValue([1, 5, 10])).toBe(16);
    expect(handValue([10, 12, 5])).toBe(25);
  });

  it('plays a blackjack hand from the deal to the dealer', () => {
    let hands = 0;
    for (let seed = 1; seed < 400 && hands < 20; seed += 1) {
      const start = world({}, {}, seed);
      const dealt = dealBlackjack(start, 50);
      if (!dealt.blackjack) {
        // A natural on either side settles at once: 3:2, a push, or a loss.
        expect([0, 50, 125]).toContain(dealt.lastBet!.won);
        continue;
      }
      hands += 1;
      expect(dealt.character.stats.money).toBe(start.character.stats.money - 50);
      expect(betBlocker(dealt, 'blackjack', 50)).toBe('Finish this hand first');

      const done = handValue(dealt.blackjack.player) < 12 ? hitBlackjack(dealt) : standBlackjack(dealt);
      const settled = done.blackjack ? standBlackjack(done) : done;
      expect(settled.blackjack).toBeNull();
      expect([0, 50, 100]).toContain(settled.lastBet!.won);
    }
    expect(hands).toBeGreaterThan(10);
  });
});
