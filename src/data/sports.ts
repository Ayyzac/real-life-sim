import type { Attributes } from '../core/types';

/**
 * Sports an athlete can take up (GDD §4.3).
 *
 * Matches are decided by comparing numbers plus a little luck - never a
 * real-time action game. That is a scope decision, not a shortcut: the whole
 * project is a menu-and-map life sim.
 *
 * Adding a sport = adding an entry here. The engine needs no changes.
 */

export interface SportDefinition {
  id: string;
  name: string;
  blurb: string;
  /** Days between fixtures. Only counted down on days the athlete trains. */
  matchIntervalDays: number;
  /** How good the opposition is, on the same scale as the athlete's skill. */
  opponentSkill: number;
  /** Prize for winning, before reputation is taken into account. */
  winPrize: number;
  /** Consolation money for turning up and losing. */
  losePrize: number;
  /** The attribute that counts alongside raw skill in this sport. */
  keyAttribute: keyof Attributes;
  /** Attributes needed before a club will take you at all. */
  requirements: Partial<Attributes>;
}

export const SPORTS: readonly SportDefinition[] = [
  {
    id: 'running',
    name: 'Running',
    blurb: 'Nobody to blame, nobody to carry you. Races come round often and pay modestly.',
    matchIntervalDays: 21,
    opponentSkill: 30,
    winPrize: 2_200,
    losePrize: 60,
    keyAttribute: 'physical',
    requirements: { physical: 20 },
  },
  {
    id: 'basketball',
    name: 'Basketball',
    blurb: 'A squad sport. Fewer fixtures, bigger purses, and the crowd notices you.',
    matchIntervalDays: 28,
    opponentSkill: 42,
    winPrize: 4_000,
    losePrize: 150,
    keyAttribute: 'physical',
    requirements: { physical: 32 },
  },
  {
    id: 'football',
    name: 'Football',
    blurb: 'The big one. The hardest to break into, and the only one that makes anyone rich.',
    matchIntervalDays: 35,
    opponentSkill: 55,
    winPrize: 7_500,
    losePrize: 250,
    keyAttribute: 'physical',
    requirements: { physical: 40, charisma: 25 },
  },
];

export function findSport(id: string): SportDefinition {
  const sport = SPORTS.find((s) => s.id === id);
  if (!sport) throw new Error(`Unknown sport id: ${id}`);
  return sport;
}
