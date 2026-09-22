import type { Stats } from '../core/types';

/**
 * Things the player can buy and keep (GDD §9.1).
 *
 * Until Phase 5 money had nowhere to go: a careful player died with hundreds
 * of thousands in the bank. These are the first thing it can be spent on, and
 * the prices are deliberately large enough to matter against a whole life's
 * income.
 *
 * Buying is one payment; owning is forever, and some of them cost something to
 * run. Adding one = adding an entry here.
 */

export type PossessionCategory = 'home' | 'vehicle' | 'luxury';

export interface PossessionDefinition {
  id: string;
  name: string;
  blurb: string;
  price: number;
  /**
   * Only one `home` and one `vehicle` at a time - buying a better one replaces
   * what you had, with nothing back. Luxuries stack.
   */
  category: PossessionCategory;
  /** Applied every day for as long as it is owned. */
  perDay: Partial<Pick<Stats, 'energy' | 'mood' | 'health'>>;
  /** Extra energy from the Rest focus specifically: a better place to sleep. */
  restBonusPerDay?: number;
  /** Running costs, charged every day alongside living costs. */
  upkeepPerDay?: number;
}

export const POSSESSIONS: readonly PossessionDefinition[] = [
  {
    id: 'bicycle',
    name: 'Bicycle',
    blurb: 'Gets you across town without the walk. Cheap enough to be an early win.',
    price: 1_500,
    category: 'vehicle',
    perDay: { energy: 1 },
  },
  {
    id: 'car',
    name: 'Second-hand Car',
    blurb: 'Saves you real time and effort, and costs you real money to keep on the road.',
    price: 24_000,
    category: 'vehicle',
    perDay: { energy: 3, mood: 0.3 },
    upkeepPerDay: 7,
  },
  {
    id: 'record_player',
    name: 'Record Player',
    blurb: 'A small, steady pleasure. Not an investment, and not pretending to be.',
    price: 9_000,
    category: 'luxury',
    perDay: { mood: 0.9 },
  },
  {
    id: 'flat',
    name: 'A Flat of Your Own',
    blurb: 'Somewhere that is actually yours. You sleep better for it.',
    price: 90_000,
    category: 'home',
    perDay: { mood: 0.5 },
    restBonusPerDay: 5,
    upkeepPerDay: 5,
  },
  {
    id: 'house',
    name: 'A House With a Garden',
    blurb: 'Room to breathe, and a mortgage-sized hole where your savings used to be.',
    price: 260_000,
    category: 'home',
    perDay: { mood: 1.2, health: 0.1 },
    restBonusPerDay: 9,
    upkeepPerDay: 14,
  },
  {
    id: 'boat',
    name: 'A Boat',
    blurb: 'Nobody needs a boat. That is rather the point of owning one.',
    price: 150_000,
    category: 'luxury',
    perDay: { mood: 2 },
    upkeepPerDay: 18,
  },
];

export function findPossession(id: string): PossessionDefinition {
  const possession = POSSESSIONS.find((p) => p.id === id);
  if (!possession) throw new Error(`Unknown possession id: ${id}`);
  return possession;
}
