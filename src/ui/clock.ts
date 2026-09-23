import { useEffect, useSyncExternalStore } from 'react';

import type { GameStore } from '../core/store';
import { timing } from './progress';

/**
 * The clock that runs on its own (GDD §12, CLAUDE.md rule 3).
 *
 * This is the one timer in the project, and it lives here in the UI on
 * purpose: it only sends `tick` intents through the store, the same door as
 * any click, so the simulation core stays timer-free and testable.
 *
 * One game hour is one real minute at 1x. The clock stops for anything that
 * needs the player's attention - a dialog, a timed action, the phone - and
 * when the tab is hidden, so time never runs away behind their back.
 */

/** Real milliseconds per game minute at 1x. */
export const MS_PER_GAME_MINUTE = 1000;
export const SPEEDS = [1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];

const SPEED_KEY = 'real-life-sim:speed';
const INTERVAL_MS = 250;
/** A stalled tab or a debugger pause must not dump an hour on the player. */
const MAX_STEP_MS = 1000;

/**
 * How many whole game minutes a stretch of real time is worth, and what is
 * left over for next time.
 */
export function minutesDue(elapsedMs: number, speed: number, carryMs: number): { minutes: number; carryMs: number } {
  const total = carryMs + Math.min(MAX_STEP_MS, Math.max(0, elapsedMs)) * speed;
  const minutes = Math.floor(total / MS_PER_GAME_MINUTE);
  return { minutes, carryMs: total - minutes * MS_PER_GAME_MINUTE };
}

interface ClockView {
  paused: boolean;
  speed: Speed;
  /** Something other than the pause button is holding the clock. */
  held: boolean;
}

let view: ClockView = { paused: false, speed: readSpeed(), held: false };
const holds = new Set<string>();
const listeners = new Set<() => void>();

function publish(next: Partial<ClockView>): void {
  view = { ...view, ...next };
  for (const listener of listeners) listener();
}

function readSpeed(): Speed {
  try {
    const saved = Number(localStorage.getItem(SPEED_KEY));
    return (SPEEDS as readonly number[]).includes(saved) ? (saved as Speed) : 1;
  } catch {
    return 1;
  }
}

export function setSpeed(speed: Speed): void {
  // The device's preference, like the volume: not part of the save.
  try {
    localStorage.setItem(SPEED_KEY, String(speed));
  } catch {
    // Losing the preference is survivable.
  }
  publish({ speed, paused: false });
}

export function togglePause(): void {
  publish({ paused: !view.paused });
}

export function holdClock(reason: string): void {
  holds.add(reason);
  publish({ held: true });
}

export function releaseClock(reason: string): void {
  holds.delete(reason);
  publish({ held: holds.size > 0 });
}

/** Holds the clock for as long as `active` is true - a dialog, a phone. */
export function useHoldClock(reason: string, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    holdClock(reason);
    return () => releaseClock(reason);
  }, [reason, active]);
}

export function useClock(): ClockView {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => view,
  );
}

/** Starts the clock. Returns the function that stops it again. */
export function startClock(store: GameStore): () => void {
  let last = performance.now();
  let carryMs = 0;

  const step = (): void => {
    const now = performance.now();
    const elapsed = now - last;
    last = now;

    const world = store.getState();
    const running =
      world !== null &&
      !world.deceased &&
      world.pendingEvent === null &&
      !view.paused &&
      holds.size === 0 &&
      !timing() &&
      !document.hidden;
    if (!running) {
      carryMs = 0;
      return;
    }

    const due = minutesDue(elapsed, view.speed, carryMs);
    carryMs = due.carryMs;
    if (due.minutes > 0) store.dispatch({ type: 'tick', minutes: due.minutes });
  };

  const id = window.setInterval(step, INTERVAL_MS);
  const saveIfHidden = (): void => {
    if (document.hidden) store.flush();
  };
  window.addEventListener('pagehide', store.flush);
  document.addEventListener('visibilitychange', saveIfHidden);

  return () => {
    window.clearInterval(id);
    window.removeEventListener('pagehide', store.flush);
    document.removeEventListener('visibilitychange', saveIfHidden);
  };
}
