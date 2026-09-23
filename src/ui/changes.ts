import type { WorldState } from '../core/types';

/**
 * What an Advance Day / Advance Week just did, worked out by comparing the
 * world before and after - the same trick as `soundFor` in ./sound.ts, so a
 * new rule shows up here without anybody remembering to report it.
 *
 * The user asked for this after picking Socialise and seeing nothing happen:
 * the numbers moved, but nothing on screen said so (GDD §11.7).
 */

export interface Change {
  label: string;
  /** Rounded amount, ready to print. */
  amount: number;
  /** Money is shown as money; everything else as points. */
  money?: boolean;
}

export interface ChangeReport {
  /** Whole days that passed; 0 for something done within the day. */
  days: number;
  /** Minutes that passed within the day, when `days` is 0. */
  minutes: number;
  changes: Change[];
  /** New names in the circle, and those who left it. */
  met: string[];
  lost: string[];
}

/** Attributes move an order of magnitude slower, so they get a finer sieve. */
const ATTRIBUTE_NOISE = 0.05;

/** Rounded for display; anything that rounds to nothing is not news. */
function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor || 0;
}

export function changesBetween(before: WorldState | null, after: WorldState | null): ChangeReport | null {
  if (!before || !after || before.character.id !== after.character.id) return null;
  const days = after.clockDay - before.clockDay;
  const minutes = after.minuteOfDay - before.minuteOfDay;
  if (days < 0 || (days === 0 && minutes <= 0)) return null;

  const changes: Change[] = [];
  const b = before.character;
  const a = after.character;

  const money = a.stats.money - b.stats.money;
  if (money !== 0) changes.push({ label: 'money', amount: Math.round(money), money: true });

  for (const key of ['health', 'energy', 'mood'] as const) {
    const delta = round(a.stats[key] - b.stats[key], 0);
    if (delta !== 0) changes.push({ label: key, amount: delta });
  }
  // Within a day, needs are the news. Across a night they reset to morning,
  // which is not something the player did.
  if (days === 0) {
    for (const key of ['hunger', 'thirst', 'hygiene'] as const) {
      const delta = round(a.needs[key] - b.needs[key], 0);
      if (delta !== 0) changes.push({ label: key, amount: delta });
    }
  }
  for (const key of ['intelligence', 'physical', 'charisma'] as const) {
    const delta = a.attributes[key] - b.attributes[key];
    if (Math.abs(delta) >= ATTRIBUTE_NOISE) changes.push({ label: key, amount: round(delta, 1) });
  }

  const earlier = new Map(before.people.map((person) => [person.id, person]));
  for (const person of after.people) {
    const was = earlier.get(person.id);
    if (!was) continue;
    const delta = round(person.closeness - was.closeness, 0);
    if (delta !== 0) changes.push({ label: person.name, amount: delta });
  }

  const now = new Set(after.people.map((person) => person.id));
  return {
    days,
    minutes: days === 0 ? minutes : 0,
    changes,
    met: after.people.filter((person) => !earlier.has(person.id)).map((person) => person.name),
    lost: before.people.filter((person) => !now.has(person.id)).map((person) => person.name),
  };
}
