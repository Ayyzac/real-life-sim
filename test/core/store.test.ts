import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GameStore } from '../../src/core/store';
import { MAX_BUSINESS_LEVEL, upgradeCost } from '../../src/core/careers/business';
import { findBusiness } from '../../src/data/businesses';
import type { SaveProvider } from '../../src/core/save/SaveProvider';
import type { WorldState } from '../../src/core/types';

/** In-memory SaveProvider: no browser, no localStorage. */
function memorySaves(initial: WorldState | null = null): SaveProvider & { current: WorldState | null } {
  return {
    current: initial,
    save(state) {
      this.current = state;
    },
    load() {
      return this.current;
    },
    clear() {
      this.current = null;
    },
  };
}

let saves: ReturnType<typeof memorySaves>;
let store: GameStore;

beforeEach(() => {
  saves = memorySaves();
  store = new GameStore(saves);
});

describe('GameStore', () => {
  it('starts with no world when there is nothing saved', () => {
    expect(store.getState()).toBeNull();
  });

  it('loads an existing save on construction, so a refresh keeps progress', () => {
    const fresh = new GameStore(memorySaves());
    fresh.dispatch({ type: 'newGame', name: 'Ayu', backgroundId: 'athlete', seed: 5 });
    const savedState = fresh.getState();

    const reopened = new GameStore(memorySaves(savedState));

    expect(reopened.getState()).toEqual(savedState);
  });

  it('notifies subscribers and autosaves on every change', () => {
    const listener = vi.fn();
    store.subscribe(listener);

    store.dispatch({ type: 'newGame', name: 'Ayu', backgroundId: 'athlete', seed: 5 });

    expect(listener).toHaveBeenCalledOnce();
    expect(saves.current).toEqual(store.getState());
  });

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();

    store.dispatch({ type: 'newGame', name: 'Ayu', backgroundId: 'athlete', seed: 5 });

    expect(listener).not.toHaveBeenCalled();
  });

  it('advances a week and replaces the state object', () => {
    store.dispatch({ type: 'newGame', name: 'Ayu', backgroundId: 'athlete', seed: 5 });
    const before = store.getState();

    store.dispatch({ type: 'advanceWeek' });

    expect(store.getState()).not.toBe(before);
    expect(store.getState()?.clockDay).toBe(7);
  });

  it('ignores time intents when no character exists', () => {
    const listener = vi.fn();
    store.subscribe(listener);

    store.dispatch({ type: 'advanceWeek' });

    expect(store.getState()).toBeNull();
    expect(listener).not.toHaveBeenCalled();
  });

  it('setFocus also moves the character to that focus location', () => {
    store.dispatch({ type: 'newGame', name: 'Ayu', backgroundId: 'athlete', seed: 5 });

    store.dispatch({ type: 'setFocus', focusId: 'exercise' });

    expect(store.getState()?.character.focusId).toBe('exercise');
    expect(store.getState()?.character.location).toBe('gym');
  });

  it('re-selecting the same focus changes nothing and notifies nobody', () => {
    store.dispatch({ type: 'newGame', name: 'Ayu', backgroundId: 'athlete', seed: 5 });
    const before = store.getState();
    const listener = vi.fn();
    store.subscribe(listener);

    store.dispatch({ type: 'setFocus', focusId: before!.character.focusId });

    expect(store.getState()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it('hires the player into a job they qualify for', () => {
    store.dispatch({ type: 'newGame', name: 'Ayu', backgroundId: 'athlete', seed: 5 });

    store.dispatch({ type: 'takeJob', jobId: 'cashier' });

    expect(store.getState()?.character.career).toEqual({
      type: 'job',
      jobId: 'cashier',
      tenureDays: 0,
      level: 0,
    });
  });

  it('refuses a job the character is not qualified for', () => {
    store.dispatch({ type: 'newGame', name: 'Ayu', backgroundId: 'athlete', seed: 5 });
    const before = store.getState();

    store.dispatch({ type: 'takeJob', jobId: 'software_developer' });

    expect(store.getState()).toBe(before);
  });

  it('quitting leaves the character unemployed', () => {
    store.dispatch({ type: 'newGame', name: 'Ayu', backgroundId: 'athlete', seed: 5 });
    store.dispatch({ type: 'takeJob', jobId: 'cashier' });

    store.dispatch({ type: 'quitJob' });

    expect(store.getState()?.character.career).toEqual({ type: 'none' });
  });

  it('walking into a place moves the character without changing their focus', () => {
    store.dispatch({ type: 'newGame', name: 'Ayu', backgroundId: 'athlete', seed: 5 });
    const focusBefore = store.getState()?.character.focusId;

    store.dispatch({ type: 'enterLocation', locationId: 'gym' });

    expect(store.getState()?.character.location).toBe('gym');
    expect(store.getState()?.character.focusId).toBe(focusBefore);
  });

  it('ignores walking somewhere the character already is', () => {
    store.dispatch({ type: 'newGame', name: 'Ayu', backgroundId: 'athlete', seed: 5 });
    store.dispatch({ type: 'enterLocation', locationId: 'gym' });
    const before = store.getState();

    store.dispatch({ type: 'enterLocation', locationId: 'gym' });

    expect(store.getState()).toBe(before);
  });

  it('refuses to move while an event is waiting for an answer', () => {
    // Without this guard the map would be a way to walk out of a stopped week
    // and never answer the question.
    store.dispatch({ type: 'newGame', name: 'Ayu', backgroundId: 'athlete', seed: 5 });
    const world = store.getState()!;
    const stuck: WorldState = {
      ...world,
      pendingEvent: { eventId: 'friend_invites', daysRemaining: 3 },
    };
    const blocked = new GameStore(memorySaves(stuck));

    blocked.dispatch({ type: 'enterLocation', locationId: 'hospital' });

    expect(blocked.getState()?.character.location).toBe(world.character.location);
  });

  it('refuses to move once the character is dead', () => {
    store.dispatch({ type: 'newGame', name: 'Ayu', backgroundId: 'athlete', seed: 5 });
    const world = store.getState()!;
    const dead = new GameStore(memorySaves({ ...world, deceased: true }));

    dead.dispatch({ type: 'enterLocation', locationId: 'hospital' });

    expect(dead.getState()?.character.location).toBe(world.character.location);
  });

  // ---------- business (GDD §4.2) ----------

  /** A fresh world with enough cash to actually open something. */
  function rich(money: number, patch: Partial<WorldState['character']> = {}): GameStore {
    store.dispatch({ type: 'newGame', name: 'Ayu', backgroundId: 'athlete', seed: 5 });
    const world = store.getState()!;
    return new GameStore(
      memorySaves({
        ...world,
        character: { ...world.character, stats: { ...world.character.stats, money }, ...patch },
      }),
    );
  }

  it('opening a business pays for it and takes the career slot', () => {
    const shop = rich(5_000);

    shop.dispatch({ type: 'openBusiness', businessId: 'market_stall' });

    expect(shop.getState()?.character.career).toEqual({
      type: 'business',
      businessId: 'market_stall',
      daysOpen: 0,
      level: 0,
    });
    expect(shop.getState()?.character.stats.money).toBe(5_000 - findBusiness('market_stall').startupCost);
  });

  it('refuses a business the character cannot pay for', () => {
    const shop = rich(100);
    const before = shop.getState();

    shop.dispatch({ type: 'openBusiness', businessId: 'market_stall' });

    expect(shop.getState()).toBe(before);
  });

  it('refuses a business the character is not qualified for', () => {
    // The athlete background has the money here but not the intelligence.
    const shop = rich(50_000, { attributes: { intelligence: 10, physical: 40, charisma: 10 } });
    const before = shop.getState();

    shop.dispatch({ type: 'openBusiness', businessId: 'online_shop' });

    expect(shop.getState()).toBe(before);
  });

  it('refuses to open a business while the character still has a job', () => {
    const shop = rich(50_000);
    shop.dispatch({ type: 'takeJob', jobId: 'cashier' });
    const before = shop.getState();

    shop.dispatch({ type: 'openBusiness', businessId: 'market_stall' });

    expect(shop.getState()).toBe(before);
  });

  it('refuses to take a job while the character owns a business', () => {
    // Without this the business, and the money spent on it, would vanish.
    const shop = rich(50_000);
    shop.dispatch({ type: 'openBusiness', businessId: 'market_stall' });
    const before = shop.getState();

    shop.dispatch({ type: 'takeJob', jobId: 'cashier' });

    expect(shop.getState()).toBe(before);
  });

  it('refuses to open a business while an event is waiting', () => {
    const shop = rich(50_000);
    const world = shop.getState()!;
    const stuck = new GameStore(
      memorySaves({ ...world, pendingEvent: { eventId: 'friend_invites', daysRemaining: 2 } }),
    );

    stuck.dispatch({ type: 'openBusiness', businessId: 'market_stall' });

    expect(stuck.getState()?.character.career).toEqual({ type: 'none' });
  });

  it('investing costs money and grows the business', () => {
    const shop = rich(50_000);
    shop.dispatch({ type: 'openBusiness', businessId: 'market_stall' });
    const afterOpening = shop.getState()!.character.stats.money;

    shop.dispatch({ type: 'upgradeBusiness' });

    expect(shop.getState()?.character.career).toMatchObject({ level: 1 });
    expect(shop.getState()?.character.stats.money).toBe(afterOpening - upgradeCost(0)!);
  });

  it('refuses an investment the character cannot pay for', () => {
    const shop = rich(1_300);
    shop.dispatch({ type: 'openBusiness', businessId: 'market_stall' });
    const before = shop.getState();

    shop.dispatch({ type: 'upgradeBusiness' });

    expect(shop.getState()).toBe(before);
  });

  it('stops investing at the top level, so money cannot buy endless income', () => {
    const shop = rich(500_000);
    shop.dispatch({ type: 'openBusiness', businessId: 'market_stall' });
    for (let i = 0; i < 10; i += 1) shop.dispatch({ type: 'upgradeBusiness' });

    expect(shop.getState()?.character.career).toMatchObject({ level: MAX_BUSINESS_LEVEL });
  });

  it('closing a business gives nothing back and leaves the character unemployed', () => {
    const shop = rich(5_000);
    shop.dispatch({ type: 'openBusiness', businessId: 'market_stall' });
    const afterOpening = shop.getState()!.character.stats.money;

    shop.dispatch({ type: 'closeBusiness' });

    expect(shop.getState()?.character.career).toEqual({ type: 'none' });
    expect(shop.getState()?.character.stats.money).toBe(afterOpening);
  });

  it('closing a business also stops minding it, instead of a hidden focus that drains energy', () => {
    const shop = rich(5_000);
    shop.dispatch({ type: 'openBusiness', businessId: 'market_stall' });
    shop.dispatch({ type: 'setFocus', focusId: 'mind_business' });

    shop.dispatch({ type: 'closeBusiness' });

    expect(shop.getState()?.character.focusId).toBe('rest');
  });

  it('giving up a career leaves an unrelated focus alone', () => {
    const shop = rich(5_000);
    shop.dispatch({ type: 'openBusiness', businessId: 'market_stall' });
    shop.dispatch({ type: 'setFocus', focusId: 'study' });

    shop.dispatch({ type: 'closeBusiness' });

    expect(shop.getState()?.character.focusId).toBe('study');
  });

  // ---------- sport (GDD §4.3) ----------

  it('taking up a sport starts an athlete from nothing', () => {
    const club = rich(0, { attributes: { intelligence: 12, physical: 40, charisma: 30 } });

    club.dispatch({ type: 'joinSport', sportId: 'running' });

    expect(club.getState()?.character.career).toEqual({
      type: 'sports',
      sportId: 'running',
      skill: 0,
      reputation: 0,
      daysSinceMatch: 0,
      wins: 0,
      losses: 0,
    });
  });

  it('refuses a sport the character is not fit enough for', () => {
    const club = rich(0, { attributes: { intelligence: 12, physical: 10, charisma: 10 } });
    const before = club.getState();

    club.dispatch({ type: 'joinSport', sportId: 'football' });

    expect(club.getState()).toBe(before);
  });

  it('refuses to take up a sport while another career is held', () => {
    const club = rich(50_000, { attributes: { intelligence: 12, physical: 40, charisma: 30 } });
    club.dispatch({ type: 'openBusiness', businessId: 'market_stall' });
    const before = club.getState();

    club.dispatch({ type: 'joinSport', sportId: 'running' });

    expect(club.getState()).toBe(before);
  });

  it('refuses to take a job while the character is an athlete', () => {
    const club = rich(0, { attributes: { intelligence: 12, physical: 40, charisma: 30 } });
    club.dispatch({ type: 'joinSport', sportId: 'running' });
    const before = club.getState();

    club.dispatch({ type: 'takeJob', jobId: 'cashier' });

    expect(club.getState()).toBe(before);
  });

  it('refuses to take up a sport while an event is waiting', () => {
    const club = rich(0, { attributes: { intelligence: 12, physical: 40, charisma: 30 } });
    const world = club.getState()!;
    const stuck = new GameStore(
      memorySaves({ ...world, pendingEvent: { eventId: 'friend_invites', daysRemaining: 2 } }),
    );

    stuck.dispatch({ type: 'joinSport', sportId: 'running' });

    expect(stuck.getState()?.character.career).toEqual({ type: 'none' });
  });

  it('retiring records the record and leaves the character unemployed', () => {
    const club = rich(0, { attributes: { intelligence: 12, physical: 40, charisma: 30 } });
    club.dispatch({ type: 'joinSport', sportId: 'running' });
    club.dispatch({ type: 'setFocus', focusId: 'train' });

    club.dispatch({ type: 'leaveSport' });

    expect(club.getState()?.character.focusId).toBe('rest');

    expect(club.getState()?.character.career).toEqual({ type: 'none' });
    expect(club.getState()?.milestones[0]?.text).toContain('Retired from Running');
  });

  // ---------- belongings and lifestyle (GDD §9) ----------

  it('buying takes the money and records what was bought', () => {
    const shopper = rich(5_000);

    shopper.dispatch({ type: 'buyPossession', possessionId: 'bicycle' });

    expect(shopper.getState()?.character.owned).toEqual(['bicycle']);
    expect(shopper.getState()?.character.stats.money).toBe(5_000 - 1_500);
  });

  it('refuses a purchase the character cannot pay for', () => {
    // Living costs may push you into debt; shopping may not.
    const shopper = rich(100);
    const before = shopper.getState();

    shopper.dispatch({ type: 'buyPossession', possessionId: 'bicycle' });

    expect(shopper.getState()).toBe(before);
  });

  it('refuses to buy the same thing twice', () => {
    const shopper = rich(50_000);
    shopper.dispatch({ type: 'buyPossession', possessionId: 'bicycle' });
    const before = shopper.getState();

    shopper.dispatch({ type: 'buyPossession', possessionId: 'bicycle' });

    expect(shopper.getState()).toBe(before);
  });

  it('a better home replaces the old one, with nothing back', () => {
    const shopper = rich(500_000);
    shopper.dispatch({ type: 'buyPossession', possessionId: 'flat' });
    const afterFlat = shopper.getState()!.character.stats.money;

    shopper.dispatch({ type: 'buyPossession', possessionId: 'house' });

    expect(shopper.getState()?.character.owned).toEqual(['house']);
    expect(shopper.getState()?.character.stats.money).toBe(afterFlat - 260_000);
  });

  it('refuses to buy while an event is waiting', () => {
    const shopper = rich(50_000);
    const world = shopper.getState()!;
    const stuck = new GameStore(
      memorySaves({ ...world, pendingEvent: { eventId: 'friend_invites', daysRemaining: 1 } }),
    );

    stuck.dispatch({ type: 'buyPossession', possessionId: 'bicycle' });

    expect(stuck.getState()?.character.owned).toEqual([]);
  });

  it('changing how you live is free and takes effect at once', () => {
    store.dispatch({ type: 'newGame', name: 'Ayu', backgroundId: 'athlete', seed: 5 });
    const before = store.getState()!.character.stats.money;

    store.dispatch({ type: 'setLifestyle', lifestyleId: 'luxurious' });

    expect(store.getState()?.character.lifestyleId).toBe('luxurious');
    expect(store.getState()?.character.stats.money).toBe(before);
  });

  it('ignores choosing the life you are already living', () => {
    store.dispatch({ type: 'newGame', name: 'Ayu', backgroundId: 'athlete', seed: 5 });
    const before = store.getState();

    store.dispatch({ type: 'setLifestyle', lifestyleId: before!.character.lifestyleId });

    expect(store.getState()).toBe(before);
  });

  it('remembers the face chosen at character creation', () => {
    store.dispatch({ type: 'newGame', name: 'Ayu', backgroundId: 'athlete', appearanceRow: 11, seed: 5 });

    expect(store.getState()?.character.appearanceRow).toBe(11);
  });

  it('reset wipes both the world and the save file', () => {
    store.dispatch({ type: 'newGame', name: 'Ayu', backgroundId: 'athlete', seed: 5 });

    store.dispatch({ type: 'reset' });

    expect(store.getState()).toBeNull();
    expect(saves.current).toBeNull();
  });

  it('quitting a job also stops going to work', () => {
    store.dispatch({ type: 'newGame', name: 'Ayu', backgroundId: 'athlete', seed: 5 });
    store.dispatch({ type: 'takeJob', jobId: 'cashier' });
    store.dispatch({ type: 'setFocus', focusId: 'work' });

    store.dispatch({ type: 'quitJob' });

    expect(store.getState()?.character.focusId).toBe('rest');
  });

  it('keeps the log trimmed however many things the player does between weeks', () => {
    store.dispatch({ type: 'newGame', name: 'Ayu', backgroundId: 'athlete', seed: 5 });
    for (let i = 0; i < 100; i += 1) {
      store.dispatch({ type: 'takeJob', jobId: 'cashier' });
      store.dispatch({ type: 'quitJob' });
    }

    const world = store.getState()!;
    expect(world.eventLog.length).toBeLessThanOrEqual(80);
    expect(world.milestones.length).toBeLessThanOrEqual(60);
  });

  it('writes money in the log as money', () => {
    const shop = new GameStore(memorySaves());
    shop.dispatch({ type: 'newGame', name: 'Ayu', backgroundId: 'athlete', seed: 5 });
    const world = shop.getState()!;
    const funded = new GameStore(
      memorySaves({ ...world, character: { ...world.character, stats: { ...world.character.stats, money: 5_000 } } }),
    );

    funded.dispatch({ type: 'buyPossession', possessionId: 'bicycle' });

    expect(funded.getState()?.eventLog[0]?.text).toBe('Bought Bicycle for $1,500.');
  });
});
