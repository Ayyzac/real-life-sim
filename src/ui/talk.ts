import { useSyncExternalStore } from 'react';

import type { Offer } from '../data/conversations';
import type { Verdict } from '../data/dialogue';

/**
 * Which conversation is open, where it has got to, and how the last answer
 * landed. View state only (GDD §11.6, §12): nothing here is saved, and
 * closing the game closes the chat.
 */
export interface OpenTalk {
  /** Someone the player knows... */
  personId?: string;
  /** ...or a stranger in the street, known only by their face. */
  strangerLook?: number;
  /** On the phone rather than face to face. */
  remote?: boolean;
  /** The topic under way and the line they have just said; none = choosing. */
  topicId?: string;
  nodeId?: string;
  /** How the last answer went, shown above whatever comes next. */
  reaction?: { text: string; verdict: Verdict };
  /** Something the last answer opened the door to. */
  offer?: Offer;
  /** Answers that suited a stranger, so far. */
  good?: number;
}

let current: OpenTalk | null = null;
const listeners = new Set<() => void>();

function set(next: OpenTalk | null): void {
  current = next;
  for (const listener of listeners) listener();
}

export function openTalk(personId: string, remote = false): void {
  set({ personId, remote });
}

export function openStranger(look: number): void {
  set({ strangerLook: look, topicId: 'stranger', nodeId: 'start', good: 0 });
}

export function closeTalk(): void {
  set(null);
}

/** Moves the conversation along, keeping who it is with. */
export function updateTalk(patch: Partial<OpenTalk>): void {
  if (current) set({ ...current, ...patch });
}

export function useTalk(): OpenTalk | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}
