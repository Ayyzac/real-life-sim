import { advanceWeek, resolveEvent } from '../../src/core/clock';
import { findEvent, type LifeEvent } from '../../src/core/events';
import type { WorldState } from '../../src/core/types';

/**
 * Test helpers that play the game the way a person does: when a week stops on
 * an event, they answer it and the week carries on.
 *
 * Without this, any test that advances time just freezes at the first event.
 */

/** Which option to take. Defaults to the first one offered. */
export type ChoicePicker = (event: LifeEvent) => string;

const firstChoice: ChoicePicker = (event) => {
  const choice = event.choices?.[0];
  if (!choice) throw new Error(`Event "${event.id}" has no choices to pick`);
  return choice.id;
};

/** Answers every waiting event until the world is running again. */
export function resolveAll(state: WorldState, pick: ChoicePicker = firstChoice): WorldState {
  let next = state;
  let guard = 0;

  while (next.pendingEvent && !next.deceased) {
    next = resolveEvent(next, pick(findEvent(next.pendingEvent.eventId)));
    if ((guard += 1) > 200) throw new Error('pending events never cleared');
  }
  return next;
}

/** Plays `weeks` weeks, answering anything that comes up. Stops at death. */
export function playWeeks(
  state: WorldState,
  weeks: number,
  pick: ChoicePicker = firstChoice,
): WorldState {
  let next = state;
  for (let i = 0; i < weeks; i += 1) {
    if (next.deceased) break;
    next = resolveAll(advanceWeek(next), pick);
  }
  return next;
}

/** Plays until the character dies, or gives up after `maxWeeks`. */
export function playUntilDeath(
  state: WorldState,
  maxWeeks = 6000,
  pick: ChoicePicker = firstChoice,
): WorldState {
  let next = state;
  for (let i = 0; i < maxWeeks && !next.deceased; i += 1) {
    next = resolveAll(advanceWeek(next), pick);
  }
  return next;
}
