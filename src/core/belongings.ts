import { findLifestyle } from '../data/lifestyles';
import { findPossession, POSSESSIONS, type PossessionDefinition } from '../data/possessions';
import type { Character, Stats } from './types';

/**
 * What a character owns and how they choose to live (GDD §9).
 *
 * Pure functions, no React and no Phaser. Everything here is derived from the
 * list of owned ids rather than stored alongside it, so the two can never
 * drift apart - the same reasoning as the town's walkable grid.
 */

export interface DailyUpkeep {
  /** Stat changes applied every day from possessions and lifestyle together. */
  perDay: Partial<Pick<Stats, 'energy' | 'mood' | 'health'>>;
  /** Money charged every day on top of living costs. */
  costPerDay: number;
  /** Extra energy the Rest focus gives, from a better place to sleep. */
  restBonusPerDay: number;
}

export function ownedPossessions(character: Character): PossessionDefinition[] {
  return character.owned.map(findPossession);
}

/** Everything owning things and living a certain way costs and gives, per day. */
export function dailyUpkeep(character: Character): DailyUpkeep {
  const lifestyle = findLifestyle(character.lifestyleId);

  let energy = 0;
  let mood = lifestyle.perDay.mood ?? 0;
  let health = lifestyle.perDay.health ?? 0;
  let costPerDay = lifestyle.extraCostPerDay;
  let restBonusPerDay = 0;

  for (const possession of ownedPossessions(character)) {
    energy += possession.perDay.energy ?? 0;
    mood += possession.perDay.mood ?? 0;
    health += possession.perDay.health ?? 0;
    costPerDay += possession.upkeepPerDay ?? 0;
    restBonusPerDay += possession.restBonusPerDay ?? 0;
  }

  return { perDay: { energy, mood, health }, costPerDay, restBonusPerDay };
}

/**
 * The list of owned ids after buying `id`.
 *
 * Only one home and one vehicle at a time: buying a better one replaces what
 * was there, with nothing back. That keeps the shop honest - an upgrade is a
 * real decision, not a collection.
 */
export function withPurchase(owned: readonly string[], id: string): string[] {
  const bought = findPossession(id);
  const kept =
    bought.category === 'luxury'
      ? owned
      : owned.filter((ownedId) => findPossession(ownedId).category !== bought.category);

  return kept.includes(id) ? [...kept] : [...kept, id];
}

/** What this purchase would replace, if anything. */
export function replacedBy(owned: readonly string[], id: string): PossessionDefinition | null {
  const bought = findPossession(id);
  if (bought.category === 'luxury') return null;

  const existing = owned
    .map(findPossession)
    .find((p) => p.category === bought.category && p.id !== id);
  return existing ?? null;
}

export { POSSESSIONS, findPossession };
export type { PossessionDefinition };
