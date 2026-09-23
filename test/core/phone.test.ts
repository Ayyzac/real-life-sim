import { describe, expect, it } from 'vitest';

import { createWorld } from '../../src/core/character';
import { headlinesFor } from '../../src/core/news';
import { deliverDue, deliveryPrice, fareTo, orderBlocker, orderFood, takeTaxi, taxiBlocker } from '../../src/core/phone';
import { makePerson } from '../../src/core/relationships';
import { createRng } from '../../src/core/rng';
import type { SaveProvider } from '../../src/core/save/SaveProvider';
import { whoIsHere } from '../../src/core/schedule';
import { GameStore } from '../../src/core/store';
import { talk, talkBlocker } from '../../src/core/talk';
import type { Character, Person, WorldState } from '../../src/core/types';
import { BALANCE } from '../../src/data/balance';
import { findItem } from '../../src/data/items';

function friend(closeness = 50): Person {
  return { ...makePerson(createRng(4), 'friend', 30, closeness), id: 'pal' };
}

function world(patch: Partial<Character> = {}, state: Partial<WorldState> = {}): WorldState {
  const base = createWorld({ name: 'Caller', backgroundId: 'scholarship', seed: 17 });
  return {
    ...base,
    minuteOfDay: 10 * 60,
    people: [friend()],
    ...state,
    character: { ...base.character, focusId: 'rest', ...patch, stats: { ...base.character.stats, money: 500 } },
  };
}

function storeWith(state: WorldState): GameStore {
  const saves: SaveProvider = { save() {}, load: () => state, clear() {} };
  return new GameStore(saves);
}

describe('the taxi (GDD §12)', () => {
  it('charges more the further it goes', () => {
    expect(fareTo('home', 'work')).toBeLessThan(fareTo('home', 'supermarket'));
    expect(fareTo('home', 'work')).toBeGreaterThanOrEqual(BALANCE.phone.taxi.base);
  });

  it('gets there in minutes, poorer, and not through the rain', () => {
    const before = world();
    const after = takeTaxi(before, 'mall');
    expect(after.character.location).toBe('mall');
    expect(after.minuteOfDay).toBe(before.minuteOfDay + BALANCE.phone.taxi.minutes);
    expect(after.character.stats.money).toBe(before.character.stats.money - fareTo('home', 'mall'));
    expect(after.character.needs.hygiene).toBeGreaterThan(before.character.needs.hygiene - 1);
  });

  it('will not take you where you already are, or for money you do not have', () => {
    expect(taxiBlocker(world(), 'home')).toBe('Already here');
    const broke = world();
    const skint = { ...broke, character: { ...broke.character, stats: { ...broke.character.stats, money: 0 } } };
    expect(taxiBlocker(skint, 'mall')).toBe('Cannot afford');
  });
});

describe('food delivery (GDD §12)', () => {
  it('costs more than the shop, and arrives half an hour later', () => {
    const store = storeWith(world());
    const sandwich = findItem('sandwich');
    expect(deliveryPrice(sandwich)).toBeGreaterThan(sandwich.price);

    store.dispatch({ type: 'orderFood', itemId: 'sandwich' });
    expect(store.getState()!.character.deliveries).toHaveLength(1);
    expect(store.getState()!.character.inventory).toEqual([]);

    store.dispatch({ type: 'tick', minutes: BALANCE.phone.delivery.minutes - 1 });
    expect(store.getState()!.character.inventory).toEqual([]);
    store.dispatch({ type: 'tick', minutes: 1 });
    expect(store.getState()!.character.inventory).toEqual(['sandwich']);
    expect(store.getState()!.character.deliveries).toEqual([]);
  });

  it('turns up in the morning if ordered just before bed', () => {
    const late = world({}, { minuteOfDay: 25 * 60 + 50 });
    const ordered = orderFood(late, 'bread');
    const store = storeWith(ordered);
    store.dispatch({ type: 'advanceDay' });
    expect(store.getState()!.character.inventory).toEqual(['bread']);
  });

  it('keeps room in the bag for what is on its way', () => {
    const full = world({
      inventory: Array.from({ length: BALANCE.bag.slots - 1 }, () => 'bread'),
      deliveries: [{ itemId: 'bread', at: 99_999 }],
    });
    expect(orderBlocker(full, findItem('bread'))).toBe('Bag is full');
    expect(orderBlocker(world(), findItem('umbrella'))).toBe('Not delivered');
    expect(deliverDue(world())).toEqual(world());
  });
});

describe('calling and inviting people (GDD §12)', () => {
  it('reaches someone who is not here, for less than being there', () => {
    const away = world();
    expect(talkBlocker(away, away.people[0]!)).toMatch(/not here/);
    expect(talkBlocker(away, away.people[0]!, true)).toBeNull();

    const called = talk(away, 'pal', 'sincere', true);
    expect(called.minuteOfDay).toBe(away.minuteOfDay + BALANCE.relationships.call.minutes);
    expect(called.people[0]!.closeness).not.toBe(away.people[0]!.closeness);
  });

  it('brings a friend home for the evening, and only then', () => {
    const evening = world({}, { minuteOfDay: 19 * 60, people: [friend(60)] });
    expect(whoIsHere(evening, 'home')).toEqual([]);

    const store = storeWith(evening);
    store.dispatch({ type: 'invite', personId: 'pal', outing: 'home' });
    const hosted = store.getState()!;

    expect(hosted.character.location).toBe('home');
    expect(hosted.character.stats.money).toBe(evening.character.stats.money);
    expect(whoIsHere(hosted, 'home').map((p) => p.id)).toEqual(['pal']);
    expect(whoIsHere({ ...hosted, minuteOfDay: 24 * 60 + 30 }, 'home')).toEqual([]);
  });
});

describe('the news (GDD §12)', () => {
  it('is the same all day, with the weather first and two different town stories', () => {
    const today = world();
    const news = headlinesFor(today);
    expect(headlinesFor(today)).toEqual(news);
    expect(news[0]!.tag).toBe('Weather');
    const town = news.filter((h) => h.tag === 'Town');
    expect(town).toHaveLength(2);
    expect(town[0]!.text).not.toBe(town[1]!.text);
  });
});
