import { beforeEach, describe, expect, it } from 'vitest';

import { advanceDay } from '../../src/core/clock';
import { actionBlocker } from '../../src/core/day';
import { gymRenewal, isGymMember } from '../../src/core/gym';
import type { SaveProvider } from '../../src/core/save/SaveProvider';
import { GameStore } from '../../src/core/store';
import type { WorldState } from '../../src/core/types';
import { findAction } from '../../src/data/actions';
import { BALANCE } from '../../src/data/balance';

const G = BALANCE.gym;

function noSaves(): SaveProvider {
  return { save: () => {}, load: () => null, clear: () => {} };
}

describe('gym membership (GDD §12)', () => {
  let store: GameStore;
  const state = (): WorldState => store.getState()!;

  beforeEach(() => {
    store = new GameStore(noSaves());
    store.dispatch({ type: 'newGame', name: 'Lifter', backgroundId: 'athlete', seed: 3 });
  });

  it('keeps the machines, showers and water for members', () => {
    store.dispatch({ type: 'enterLocation', locationId: 'gym' });
    for (const id of ['workout', 'gym_shower', 'gym_water']) {
      expect(actionBlocker({ ...state(), minuteOfDay: 10 * 60 }, findAction(id)), id).toBe('Members only');
    }

    store.dispatch({ type: 'joinGym' });
    expect(actionBlocker({ ...state(), minuteOfDay: 10 * 60 }, findAction('workout'))).toBeNull();
  });

  it('takes the first month up front, and only from money you have', () => {
    const before = state().character.stats.money;
    store.dispatch({ type: 'joinGym' });

    expect(isGymMember(state().character)).toBe(true);
    expect(state().character.stats.money).toBe(before - G.fee);
    expect(state().character.gymPaidUntil).toBe(state().clockDay + G.days);

    const broke = new GameStore(noSaves());
    broke.dispatch({ type: 'newGame', name: 'Broke', backgroundId: 'athlete', seed: 3 });
    const poor = broke.getState()!;
    const skint = new GameStore({ save: () => {}, clear: () => {}, load: () => ({
      ...poor,
      character: { ...poor.character, stats: { ...poor.character.stats, money: G.fee - 1 } },
    }) });
    skint.dispatch({ type: 'joinGym' });
    expect(skint.getState()!.character.gymPaidUntil).toBeNull();
  });

  it('renews itself every 30 days, even into debt, until cancelled', () => {
    expect(gymRenewal({ gymPaidUntil: null }, 100)).toEqual({ cost: 0, gymPaidUntil: null });
    expect(gymRenewal({ gymPaidUntil: 30 }, 29)).toEqual({ cost: 0, gymPaidUntil: 30 });
    expect(gymRenewal({ gymPaidUntil: 30 }, 30)).toEqual({ cost: G.fee, gymPaidUntil: 60 });

    store.dispatch({ type: 'joinGym' });
    const world = state();
    const withMember = advanceDay({ ...world, character: { ...world.character, gymPaidUntil: world.clockDay } });
    const without = advanceDay({ ...world, character: { ...world.character, gymPaidUntil: null } });
    expect(without.character.stats.money - withMember.character.stats.money).toBe(G.fee);
    expect(withMember.character.gymPaidUntil).toBe(world.clockDay + G.days);
  });

  it('will not train at the gym without a membership, and stops the training on cancelling', () => {
    store.dispatch({ type: 'setFocus', focusId: 'exercise' });
    expect(state().character.focusId).not.toBe('exercise');

    store.dispatch({ type: 'joinGym' });
    store.dispatch({ type: 'setFocus', focusId: 'exercise' });
    expect(state().character.focusId).toBe('exercise');

    store.dispatch({ type: 'leaveGym' });
    expect(isGymMember(state().character)).toBe(false);
    expect(state().character.focusId).toBe('rest');
  });
});
