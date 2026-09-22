import { useSyncExternalStore } from 'react';

import { GameStore } from '../core/store';
import type { WorldState } from '../core/types';

/**
 * One store for the whole app. React reads it through useSyncExternalStore -
 * React's own built-in for exactly this, so no state library is needed.
 *
 * The UI never calls the simulation directly: it reads state here and sends
 * intents through gameStore.dispatch (CLAUDE.md rule 5).
 */
export const gameStore = new GameStore();

const getServerSnapshot = (): WorldState | null => null;

export function useGame(): WorldState | null {
  return useSyncExternalStore(gameStore.subscribe, gameStore.getState, getServerSnapshot);
}
