import { useEffect, useState, useSyncExternalStore } from 'react';

import type { GameIntent } from '../core/store';
import { gameStore } from './useGame';

/**
 * The on-screen time something takes (GDD §11.1): a bar fills and the clock
 * runs while the character eats, works or showers.
 *
 * Nothing here moves the simulation on its own (CLAUDE.md rule 3). The player
 * clicked; the intent is only held back for the length of the animation, then
 * sent once. State still changes exactly once per click.
 */

export interface Progress {
  label: string;
  minutes: number;
  fromMinute: number;
  startedAt: number;
  durationMs: number;
}

let current: Progress | null = null;
/** What the last timed thing was called, so the result can be titled with it. */
let lastLabel: string | null = null;
const listeners = new Set<() => void>();

function set(next: Progress | null): void {
  current = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** 15 minutes shows for about half a second, an hour for one, and nothing for more than three. */
export function animationMs(minutes: number): number {
  return Math.min(3000, 250 + (minutes / 60) * 750);
}

/** Plays the bar for `minutes` of game time, then sends `intent`. */
export function runTimed(label: string, minutes: number, intent: GameIntent): void {
  const state = gameStore.getState();
  if (current || !state) return;

  const durationMs = prefersReducedMotion() ? 0 : animationMs(minutes);
  lastLabel = label;
  set({ label, minutes, fromMinute: state.minuteOfDay, startedAt: performance.now(), durationMs });
  window.setTimeout(() => {
    gameStore.dispatch(intent);
    set(null);
  }, durationMs);
}

/** Something is being timed right now; the clock waits for it. */
export function timing(): boolean {
  return current !== null;
}

export function useProgress(): Progress | null {
  return useSyncExternalStore(subscribe, () => current);
}

export function lastTimedLabel(): string | null {
  return lastLabel;
}

/**
 * The clock as the player should see it: running forward during an
 * animation, the real time otherwise.
 */
export function useShownMinute(realMinute: number): number {
  const progress = useProgress();
  const [shown, setShown] = useState(realMinute);

  useEffect(() => {
    if (!progress) {
      setShown(realMinute);
      return;
    }
    let frame = 0;
    const tick = (): void => {
      const t = progress.durationMs === 0 ? 1 : Math.min(1, (performance.now() - progress.startedAt) / progress.durationMs);
      setShown(progress.fromMinute + progress.minutes * t);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [progress, realMinute]);

  return shown;
}
