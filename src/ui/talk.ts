import { useSyncExternalStore } from 'react';

import type { Verdict } from '../data/dialogue';

/**
 * Which conversation is open, and how the last reply landed. View state only
 * (GDD §11.6): nothing here is saved, and closing the game closes the chat.
 */
export interface OpenTalk {
  personId: string;
  /** On the phone rather than face to face (GDD §12). */
  remote?: boolean;
  /** Set once a reply has been chosen, so the dialog can show how it went. */
  reaction?: { text: string; verdict: Verdict };
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

export function closeTalk(): void {
  set(null);
}

export function setReaction(personId: string, reaction: OpenTalk['reaction']): void {
  set({ personId, remote: current?.remote, reaction });
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
