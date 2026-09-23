/**
 * Casino games and online slots (GDD §12), as data.
 *
 * The house always wins on average, and the online slots win more: a casino
 * slot pays back about 92 cents in the dollar, the phone's about 85. No
 * addiction rules (user decision, 23 Sep 2026) - only money in and money out.
 */

export type Venue = 'casino' | 'online';

export interface SlotLine {
  id: string;
  reels: readonly [string, string, string];
  /** Chance per spin. Whatever is left over loses. */
  chance: number;
  /** Paid back per dollar bet, the stake included. */
  pays: number;
}

/** Chance x pays, summed: casino 0.92, online 0.855. Pinned by test. */
export const SLOT_TABLES: Record<Venue, readonly SlotLine[]> = {
  casino: [
    { id: 'sevens', reels: ['7', '7', '7'], chance: 0.003, pays: 60 },
    { id: 'bars', reels: ['BAR', 'BAR', 'BAR'], chance: 0.012, pays: 15 },
    { id: 'cherries', reels: ['♦', '♦', '♦'], chance: 0.05, pays: 5 },
    { id: 'pair', reels: ['♦', '♦', '♪'], chance: 0.155, pays: 2 },
  ],
  // More small wins, fewer big ones: it feels generous and pays back less.
  online: [
    { id: 'sevens', reels: ['7', '7', '7'], chance: 0.002, pays: 60 },
    { id: 'bars', reels: ['BAR', 'BAR', 'BAR'], chance: 0.01, pays: 15 },
    { id: 'cherries', reels: ['♦', '♦', '♦'], chance: 0.045, pays: 5 },
    { id: 'pair', reels: ['♦', '♦', '♪'], chance: 0.18, pays: 2 },
  ],
};

/** What a losing spin shows: three that never line up. */
export const SLOT_BLANKS: readonly string[] = ['7', 'BAR', '♪', '●', '★'];

/** European roulette: one zero. */
export const RED_NUMBERS: readonly number[] = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

export const TABLE_LIMITS = {
  slot: { min: 1, max: 100 },
  roulette: { min: 5, max: 500 },
  blackjack: { min: 10, max: 500 },
} as const;

/** Game minutes each play takes. */
export const PLAY_MINUTES = { slot: 1, roulette: 2, blackjackDeal: 2, blackjackMove: 1 } as const;
