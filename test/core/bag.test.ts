import { describe, expect, it } from 'vitest';

import { buyBlocker, buyItem, consumeBlocker, consumeItem, dealOf, priceOf } from '../../src/core/bag';
import { createWorld } from '../../src/core/character';
import type { Character, WorldState } from '../../src/core/types';
import { BALANCE } from '../../src/data/balance';
import { ITEMS, findItem } from '../../src/data/items';

function world(patch: Partial<Character> = {}, state: Partial<WorldState> = {}): WorldState {
  const base = createWorld({ name: 'Shopper', backgroundId: 'scholarship', seed: 12 });
  return { ...base, minuteOfDay: 10 * 60, ...state, character: { ...base.character, location: 'supermarket', ...patch } };
}

describe('the Supermarket and the bag (GDD §12)', () => {
  it('puts about a quarter of things on offer, the same all day', () => {
    let deals = 0;
    let total = 0;
    for (let day = 0; day < 400; day += 1) {
      for (const item of ITEMS) {
        expect(dealOf(item, day)).toBe(dealOf(item, day));
        if (dealOf(item, day) > 0) deals += 1;
        total += 1;
        expect(priceOf(item, day)).toBeGreaterThanOrEqual(1);
        expect(priceOf(item, day)).toBeLessThanOrEqual(item.price);
      }
    }
    // A $1 bottle of water is never on offer: nothing is ever free.
    expect(deals / total).toBeGreaterThan(0.15);
    expect(deals / total).toBeLessThan(0.3);
    expect(dealOf(findItem('water_bottle'), 3)).toBe(0);
  });

  it('sells only in the shop, while it is open, and only for money you have', () => {
    const sandwich = findItem('sandwich');
    expect(buyBlocker(world(), sandwich)).toBeNull();
    expect(buyBlocker(world({ location: 'home' }), sandwich)).toBe('Only at the Supermarket');
    expect(buyBlocker(world({}, { minuteOfDay: 23 * 60 + 30 }), sandwich)).toMatch(/Closed/);
    const broke = world();
    expect(
      buyBlocker({ ...broke, character: { ...broke.character, stats: { ...broke.character.stats, money: 0 } } }, sandwich),
    ).toBe('Cannot afford');
  });

  it('takes the money and puts it in the bag', () => {
    const before = world();
    const after = buyItem(before, 'sandwich');
    expect(after.character.inventory).toEqual(['sandwich']);
    expect(after.character.stats.money).toBe(before.character.stats.money - priceOf(findItem('sandwich'), before.clockDay));
  });

  it('holds only so much, and one umbrella is plenty', () => {
    const full = world({ inventory: Array.from({ length: BALANCE.bag.slots }, () => 'bread') });
    expect(buyItem(full, 'bread')).toBe(full);

    const covered = world({ inventory: ['umbrella'] });
    expect(buyBlocker(covered, findItem('umbrella'))).toBe('Already have one');
  });

  it('is eaten from anywhere, one at a time, taking its time', () => {
    const before = world({ location: 'gym', inventory: ['sandwich', 'sandwich'] });
    const after = consumeItem(before, 'sandwich');

    expect(after.character.inventory).toEqual(['sandwich']);
    expect(after.minuteOfDay).toBe(before.minuteOfDay + findItem('sandwich').minutes);
    expect(after.character.needs.hunger).toBeGreaterThan(before.character.needs.hunger);
  });

  it('counts the treat once a day, like every action', () => {
    const start = world({ location: 'home', inventory: ['energy_drink', 'energy_drink'] });
    const once = consumeItem(start, 'energy_drink');
    const twice = consumeItem(once, 'energy_drink');

    expect(once.character.stats.energy).toBeGreaterThan(start.character.stats.energy);
    expect(twice.character.stats.energy).toBe(once.character.stats.energy);
    expect(twice.character.needs.thirst).toBeGreaterThan(once.character.needs.thirst - 1);
  });

  it('keeps the umbrella rather than using it up', () => {
    const covered = world({ inventory: ['umbrella'] });
    expect(consumeBlocker(covered, findItem('umbrella'))).toBe('Kept in the bag');
    expect(consumeItem(covered, 'umbrella')).toBe(covered);
  });
});
