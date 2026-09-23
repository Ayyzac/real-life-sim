import { useSyncExternalStore } from 'react';

/**
 * Which device is open - the phone or the laptop - and which app is on it.
 * View state only: nothing here is saved, and closing the game closes it.
 */
export type DeviceKind = 'phone' | 'laptop';

export interface OpenDevice {
  kind: DeviceKind;
  /** Null for the home screen. */
  app: string | null;
}

let current: OpenDevice | null = null;
const listeners = new Set<() => void>();

function set(next: OpenDevice | null): void {
  current = next;
  for (const listener of listeners) listener();
}

export function openDevice(kind: DeviceKind, app: string | null = null): void {
  set({ kind, app });
}

export function openApp(app: string | null): void {
  if (current) set({ ...current, app });
}

export function closeDevice(): void {
  set(null);
}

export function useDevice(): OpenDevice | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}
