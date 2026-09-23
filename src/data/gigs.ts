import type { Attributes } from '../core/types';

/**
 * Side work on the laptop (GDD §12), as data. Each gig is played as a short
 * mini-game; how well it goes, times the attribute it leans on, is the pay.
 *
 * About $10-15 for an hour's gig - pocket money next to a job, on purpose:
 * a cashier makes under $5 an hour, but eight of them, every weekday.
 */
export type MiniGame = 'typing' | 'math' | 'memory' | 'sort';

export interface GigDefinition {
  id: string;
  label: string;
  description: string;
  game: MiniGame;
  /** Better at this, better paid. */
  attribute: keyof Attributes;
  /** Dollars for a perfect score at attribute 0. */
  basePay: number;
}

export const GIGS: readonly GigDefinition[] = [
  {
    id: 'data_entry',
    label: 'Data entry',
    description: 'Type the words as they come. Quickly, and right.',
    game: 'typing',
    attribute: 'intelligence',
    basePay: 10,
  },
  {
    id: 'bookkeeping',
    label: 'Bookkeeping',
    description: 'Check the sums for a small shop. Wrong answers cost.',
    game: 'math',
    attribute: 'intelligence',
    basePay: 11,
  },
  {
    id: 'qa_testing',
    label: 'App testing',
    description: 'Find the matching screens. A good memory pays.',
    game: 'memory',
    attribute: 'charisma',
    basePay: 10,
  },
  {
    id: 'warehouse_sort',
    label: 'Parcel sorting',
    description: 'Send each parcel to the right shelf before the belt runs out.',
    game: 'sort',
    attribute: 'physical',
    basePay: 10,
  },
];

export function findGig(id: string): GigDefinition {
  const gig = GIGS.find((g) => g.id === id);
  if (!gig) throw new Error(`Unknown gig: ${id}`);
  return gig;
}
