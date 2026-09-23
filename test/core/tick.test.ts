import { describe, expect, it, vi } from 'vitest';

import { createWorld } from '../../src/core/character';
import { freeUntil, tick } from '../../src/core/day';
import type { SaveProvider } from '../../src/core/save/SaveProvider';
import { GameStore } from '../../src/core/store';
import type { Character, WorldState } from '../../src/core/types';
import { BALANCE } from '../../src/data/balance';

const D = BALANCE.day;

function world(patch: Partial<Character> = {}, state: Partial<WorldState> = {}): WorldState {
  const base = createWorld({ name: 'Clock', backgroundId: 'scholarship', seed: 21 });
  return { ...base, ...state, character: { ...base.character, ...patch } };
}

function storeWith(state: WorldState): { store: GameStore; save: ReturnType<typeof vi.fn> } {
  const save = vi.fn();
  const saves: SaveProvider = { save, load: () => state, clear() {} };
  return { store: new GameStore(saves), save };
}

describe('the clock running on its own (GDD §12)', () => {
  it('lets time pass, and needs with it', () => {
    const before = world({ focusId: 'rest' });
    const after = tick(before, 30);

    expect(after.minuteOfDay).toBe(before.minuteOfDay + 30);
    expect(after.character.needs.hunger).toBeLessThan(before.character.needs.hunger);
  });

  it('stops at 09:00 and waits while the working day has not started', () => {
    const morning = world({ focusId: 'study' }, { minuteOfDay: 8 * 60 + 50 });

    const atNine = tick(morning, 30);
    expect(atNine.minuteOfDay).toBe(D.blockStart);
    expect(freeUntil(atNine)).toBe(D.blockStart);
    expect(tick(atNine, 30)).toBe(atNine);
  });

  it('does nothing while an event waits for an answer', () => {
    const waiting = world({}, { pendingEvent: { eventId: 'x', daysRemaining: 0 } });
    expect(tick(waiting, 10)).toBe(waiting);
  });

  it('puts the character to bed at 02:00', () => {
    const late = world({ focusId: 'rest' }, { minuteOfDay: D.latest - 5 });
    const { store } = storeWith(late);

    store.dispatch({ type: 'tick', minutes: 10 });

    expect(store.getState()!.clockDay).toBe(late.clockDay + 1);
    expect(store.getState()!.minuteOfDay).toBe(D.wake);
  });

  it('writes the save once per game hour, not every second', () => {
    const { store, save } = storeWith(world({ focusId: 'rest' }, { minuteOfDay: 10 * 60 }));

    for (let i = 0; i < 59; i += 1) store.dispatch({ type: 'tick', minutes: 1 });
    expect(save).not.toHaveBeenCalled();

    store.dispatch({ type: 'tick', minutes: 1 });
    expect(save).toHaveBeenCalledTimes(1);

    store.flush();
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('remembers that a world came from the clock, so the screen can ignore it', () => {
    const { store } = storeWith(world({ focusId: 'rest' }, { minuteOfDay: 10 * 60 }));
    store.dispatch({ type: 'tick', minutes: 1 });
    expect(store.causeOf(store.getState()!)).toBe('tick');
  });
});
