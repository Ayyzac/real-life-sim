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
  days: number;
  changes: Change[];
  /** New names in the circle, and those who left it. */
  met: string[];
  lost: string[];
}

/** Stat moves smaller than this are rounding noise, not news. */
const STAT_NOISE = 0.5;
/** Attributes move an order of magnitude slower, so they get a finer sieve. */
const ATTRIBUTE_NOISE = 0.05;

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function changesBetween(before: WorldState | null, after: WorldState | null): ChangeReport | null {
  if (!before || !after || after.clockDay <= before.clockDay) return null;
  if (before.character.id !== after.character.id) return null;

  const changes: Change[] = [];
  const b = before.character;
  const a = after.character;

  const money = a.stats.money - b.stats.money;
  if (money !== 0) changes.push({ label: 'money', amount: Math.round(money), money: true });

  for (const key of ['health', 'energy', 'mood'] as const) {
    const delta = a.stats[key] - b.stats[key];
    if (Math.abs(delta) >= STAT_NOISE) changes.push({ label: key, amount: round(delta, 0) });
  }
  for (const key of ['intelligence', 'physical', 'charisma'] as const) {
    const delta = a.attributes[key] - b.attributes[key];
    if (Math.abs(delta) >= ATTRIBUTE_NOISE) changes.push({ label: key, amount: round(delta, 1) });
  }

  const earlier = new Map(before.people.map((person) => [person.id, person]));
  for (const person of after.people) {
    const was = earlier.get(person.id);
    if (!was) continue;
    const delta = person.closeness - was.closeness;
    if (Math.abs(delta) >= STAT_NOISE) changes.push({ label: person.name, amount: round(delta, 0) });
  }

  const now = new Set(after.people.map((person) => person.id));
  return {
    days: after.clockDay - before.clockDay,
    changes,
    met: after.people.filter((person) => !earlier.has(person.id)).map((person) => person.name),
    lost: before.people.filter((person) => !now.has(person.id)).map((person) => person.name),
  };
}
