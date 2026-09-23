import { describe, expect, it } from 'vitest';

import { createWorld } from '../../src/core/character';
import { actionsHere } from '../../src/core/day';
import { characterLook, decodeLook, encodeLook } from '../../src/core/look';
import { GameStore } from '../../src/core/store';
import type { SaveProvider } from '../../src/core/save/SaveProvider';
import type { Character, WorldState } from '../../src/core/types';
import { findAction } from '../../src/data/actions';

const LOOK = encodeLook({ body: 2, hair: 1, top: 1, skin: 0 });

function world(patch: Partial<Character> = {}, state: Partial<WorldState> = {}): WorldState {
  const base = createWorld({ name: 'Shopper', backgroundId: 'scholarship', look: LOOK, seed: 44 });
  return {
    ...base,
    minuteOfDay: 12 * 60,
    ...state,
    character: {
      ...base.character,
      focusId: 'rest',
      location: 'mall',
      stats: { ...base.character.stats, money: 500 },
      ...patch,
    },
  };
}

function storeWith(state: WorldState): GameStore {
  const saves: SaveProvider = { save() {}, load: () => state, clear() {} };
  return new GameStore(saves);
}

describe('the Mall (GDD §11.5)', () => {
  it('sells a new top: the look changes, and it costs money and time', () => {
    const store = storeWith(world());
    store.dispatch({ type: 'buyClothes', top: 4 });

    const after = store.getState()!;
    const clothes = findAction('buy_clothes');
    expect(decodeLook(characterLook(after.character)).top).toBe(4);
    expect(decodeLook(characterLook(after.character)).body).toBe(2);
    expect(after.character.stats.money).toBe(500 - clothes.cost!);
    expect(after.minuteOfDay).toBe(12 * 60 + clothes.minutes);
    expect(after.eventLog[0]?.text).toBe('Bought some new clothes.');
  });

  it('will not sell the top you are already wearing', () => {
    const before = world();
    const store = storeWith(before);
    store.dispatch({ type: 'buyClothes', top: 1 });
    expect(store.getState()).toBe(before);
  });

  it('only sells clothes at the Mall, while it is open, to someone who can pay', () => {
    for (const shut of [
      world({ location: 'home' }),
      world({}, { minuteOfDay: 23 * 60 }),
      world({ stats: { ...world().character.stats, money: 10 } }),
    ]) {
      const store = storeWith(shut);
      store.dispatch({ type: 'buyClothes', top: 4 });
      expect(store.getState()).toBe(shut);
    }
  });

  it('lists the food court, drinks and films, but keeps the clothes shop on its own screen', () => {
    const ids = actionsHere(world()).map((action) => action.id);
    expect(ids).toEqual(expect.arrayContaining(['food_court', 'bubble_tea', 'cinema']));
    expect(ids).not.toContain('buy_clothes');
  });
});
