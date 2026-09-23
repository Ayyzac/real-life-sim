import type { WorldState } from '../core/types';

/**
 * Sound effects (GDD §8, user decision 22 Sep 2026: effects, no music).
 *
 * Deliberately NOT played through Phaser. Phase 0 turned Phaser's audio off
 * because it opens an AudioContext it then talks to after destroy(), which
 * threw on every StrictMode remount. Plain `Audio` elements avoid that whole
 * problem rather than solving it, and the sounds have nothing to do with the
 * map anyway.
 *
 * Nothing calls this per-sound from the components. Instead it watches the
 * world state and works out what just happened, so a new kind of event makes
 * a noise without anybody remembering to add a line.
 */

const NAMES = ['week', 'good', 'bad', 'decide', 'buy', 'death'] as const;
export type SoundName = (typeof NAMES)[number];

export const VOLUME_KEY = 'real-life-sim:volume';
const DEFAULT_VOLUME = 0.5;

const clips = new Map<SoundName, HTMLAudioElement>();
let volume = readVolume();

function readVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    if (raw === null) return DEFAULT_VOLUME;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : DEFAULT_VOLUME;
  } catch {
    // Private browsing, or storage switched off. A default is fine.
    return DEFAULT_VOLUME;
  }
}

export function getVolume(): number {
  return volume;
}

/**
 * Volume lives in its own localStorage key, not in the save file.
 *
 * It belongs to the device, not the character: it should survive starting a
 * new life, and it should not travel inside a save or force a schema bump.
 */
export function setVolume(next: number): void {
  volume = Math.min(1, Math.max(0, next));
  try {
    localStorage.setItem(VOLUME_KEY, String(volume));
  } catch {
    // Losing the preference is survivable; crashing is not.
  }
}

export function play(name: SoundName): void {
  if (volume <= 0) return;

  try {
    let clip = clips.get(name);
    if (!clip) {
      clip = new Audio(`${import.meta.env.BASE_URL}assets/sfx/${name}.ogg`);
      clips.set(name, clip);
    }
    clip.volume = volume;
    clip.currentTime = 0;
    // Browsers reject playback until the page has been interacted with. Every
    // one of these follows a click, but a rejected promise must never bubble.
    void clip.play().catch(() => undefined);
  } catch {
    // No audio device, or a codec the browser will not take. Play on silently.
  }
}

/**
 * Works out what just happened, by comparing the new world with the last one.
 *
 * At most one sound per change: a week that brings a death, an event and a
 * payment should make one noise, not three.
 */
export function soundFor(before: WorldState | null, after: WorldState | null): SoundName | null {
  if (!after) return null;
  // First load, or a brand new character: say nothing.
  if (!before) return null;

  if (after.deceased && !before.deceased) return 'death';
  if (after.pendingEvent && !before.pendingEvent) return 'decide';
  if (after.character.owned.some((id) => !before.character.owned.includes(id))) return 'buy';

  const newest = after.eventLog[0];
  if (newest && newest !== before.eventLog[0]) {
    if (newest.tone === 'good') return 'good';
    if (newest.tone === 'bad') return 'bad';
  }

  if (after.clockDay > before.clockDay) return 'week';
  return null;
}

/** Hands the browser the files before they are first needed. */
export function preload(): void {
  for (const name of NAMES) {
    if (clips.has(name)) continue;
    try {
      const clip = new Audio(`${import.meta.env.BASE_URL}assets/sfx/${name}.ogg`);
      clip.preload = 'auto';
      clips.set(name, clip);
    } catch {
      return;
    }
  }
}
