import type { Attributes } from '../core/types';

/**
 * Businesses the player can open (GDD §4.2).
 *
 * Deliberately shallow for v1: a business is revenue per day minus cost per
 * day, plus a couple of player decisions. No staff, no supply chains, no AI
 * competitors - those are v2 ideas and explicitly out of scope.
 *
 * Adding a business = adding an entry here. The engine needs no changes.
 */

export interface BusinessDefinition {
  id: string;
  name: string;
  blurb: string;
  /** Money needed up front. The player cannot open one they cannot afford. */
  startupCost: number;
  /** Takings per day with the owner's full attention. */
  revenuePerDay: number;
  /** Rent, stock, power. Charged every day whether you turn up or not. */
  costPerDay: number;
  /**
   * Share of takings that still comes in on days the owner is elsewhere.
   *
   * This is what separates the three: a stall ticks over without you, a
   * workshop does not. Set it low enough and the costs turn the day into a
   * loss, which is the risk the player is taking on.
   */
  neglectedShare: number;
  /** Attributes needed to be allowed to open it. */
  requirements: Partial<Attributes>;
}

export const BUSINESSES: readonly BusinessDefinition[] = [
  {
    id: 'market_stall',
    name: 'Market Stall',
    blurb: 'A table, an awning and whatever you can carry. Cheap to start, and it ticks over without you.',
    startupCost: 1_200,
    revenuePerDay: 52,
    costPerDay: 14,
    neglectedShare: 0.55,
    requirements: {},
  },
  {
    id: 'online_shop',
    name: 'Online Shop',
    blurb: 'Runs from a laptop. Keeps earning while you are busy with something else.',
    startupCost: 4_000,
    revenuePerDay: 92,
    costPerDay: 26,
    neglectedShare: 0.65,
    requirements: { intelligence: 30 },
  },
  {
    id: 'repair_workshop',
    name: 'Repair Workshop',
    blurb: 'Real tools, real rent. Pays well when you are there, bleeds when you are not.',
    startupCost: 9_000,
    revenuePerDay: 150,
    costPerDay: 44,
    neglectedShare: 0.25,
    requirements: { physical: 35 },
  },
  {
    id: 'laundrette',
    name: 'Laundrette',
    blurb: 'Machines do the work. You mostly turn up to empty the coin box.',
    startupCost: 18_000,
    revenuePerDay: 120,
    costPerDay: 34,
    neglectedShare: 0.8,
    requirements: {},
  },
  {
    id: 'bookshop',
    name: 'Bookshop',
    blurb: 'Never going to make you rich. Very pleasant to be in.',
    startupCost: 34_000,
    revenuePerDay: 175,
    costPerDay: 55,
    neglectedShare: 0.55,
    requirements: { intelligence: 40 },
  },
  {
    id: 'restaurant',
    name: 'Restaurant',
    blurb: 'The busiest thing you can own, and the least forgiving of absence.',
    startupCost: 70_000,
    revenuePerDay: 320,
    costPerDay: 110,
    neglectedShare: 0.2,
    requirements: { charisma: 40, physical: 30 },
  },
];

export function findBusiness(id: string): BusinessDefinition {
  const business = BUSINESSES.find((b) => b.id === id);
  if (!business) throw new Error(`Unknown business id: ${id}`);
  return business;
}
