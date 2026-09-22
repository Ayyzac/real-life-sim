import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GameStore } from '../../src/core/store';
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

  it('reset wipes both the world and the save file', () => {
    store.dispatch({ type: 'newGame', name: 'Ayu', backgroundId: 'athlete', seed: 5 });

    store.dispatch({ type: 'reset' });

    expect(store.getState()).toBeNull();
    expect(saves.current).toBeNull();
  });
});
