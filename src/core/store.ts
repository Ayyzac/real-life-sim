import { findFocus } from '../data/focuses';
import { EventBus } from './bus';
import { meetsRequirements } from './careers/job';
import { findJob } from '../data/jobs';
import { advanceDay, advanceWeek } from './clock';
import { createWorld, type NewGameOptions } from './character';
import { LocalStorageSaveProvider } from './save/LocalStorageSaveProvider';
import type { SaveProvider } from './save/SaveProvider';
import type { FocusId, WorldState } from './types';

/**
 * The single seam between the simulation and everything that draws it.
 *
 * CLAUDE.md rule 5 says layers may only talk through one explicit message bus.
 * So the React UI (and, from Phase 2, the Phaser world) never calls the engine
 * directly: it sends an intent through `dispatch` and hears about the result by
 * subscribing. Neither side reaches into the other's internals.
 *
 * State is replaced, never mutated, so React can detect a change by identity.
 */

export type GameIntent =
  | { type: 'newGame'; name: string; backgroundId: string; seed?: number }
  | { type: 'advanceDay' }
  | { type: 'advanceWeek' }
  | { type: 'setFocus'; focusId: FocusId }
  | { type: 'takeJob'; jobId: string }
  | { type: 'quitJob' }
  | { type: 'reset' };

interface StoreEvents {
  changed: WorldState | null;
}

export class GameStore {
  private readonly bus = new EventBus<StoreEvents>();
  private state: WorldState | null;

  constructor(private readonly saves: SaveProvider = new LocalStorageSaveProvider()) {
    this.state = saves.load();
  }

  /** Current world, or null when no character exists yet. */
  getState = (): WorldState | null => this.state;

  /** Returns an unsubscribe function, as useSyncExternalStore expects. */
  subscribe = (listener: () => void): (() => void) => this.bus.on('changed', listener);

  dispatch = (intent: GameIntent): void => {
    const next = this.reduce(intent);
    if (next === this.state) return;

    this.state = next;
    // Autosave on every change (ARCHITECTURE §7). One write per player action
    // rather than one per simulated day - a week is 7 days but still one click.
    if (next) this.saves.save(next);
    else this.saves.clear();

    this.bus.emit('changed', next);
  };

  private reduce(intent: GameIntent): WorldState | null {
    const state = this.state;

    switch (intent.type) {
      case 'newGame':
        return createWorld(intent satisfies NewGameOptions);

      case 'reset':
        return null;

      case 'advanceDay':
        return state ? advanceDay(state) : state;

      case 'advanceWeek':
        return state ? advanceWeek(state) : state;

      case 'setFocus': {
        if (!state || state.deceased) return state;
        const focus = findFocus(intent.focusId);
        if (state.character.focusId === focus.id) return state;
        return {
          ...state,
          character: { ...state.character, focusId: focus.id, location: focus.locationId },
        };
      }

      case 'takeJob': {
        if (!state || state.deceased) return state;
        const job = findJob(intent.jobId);
        // Guard here too: the UI hides jobs you cannot get, but the store is
        // the thing that has to be right.
        if (!meetsRequirements(state.character.attributes, job)) return state;

        return {
          ...state,
          eventLog: [
            { day: state.clockDay, tone: 'good', text: `Hired as ${job.title}.` },
            ...state.eventLog,
          ],
          character: {
            ...state.character,
            career: { type: 'job', jobId: job.id, tenureDays: 0, level: 0 },
          },
        };
      }

      case 'quitJob': {
        if (!state || state.character.career.type !== 'job') return state;
        const job = findJob(state.character.career.jobId);
        return {
          ...state,
          eventLog: [
            { day: state.clockDay, tone: 'neutral', text: `Quit the ${job.title} job.` },
            ...state.eventLog,
          ],
          character: { ...state.character, career: { type: 'none' } },
        };
      }
    }
  }
}
