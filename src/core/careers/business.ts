import { BALANCE } from '../../data/balance';
import { BUSINESSES, findBusiness, type BusinessDefinition } from '../../data/businesses';
import type { Attributes, CareerState } from '../types';

/**
 * Running your own business (GDD §4.2). Pure functions only - no React, no
 * Phaser. Called once per simulated day from src/core/clock.ts.
 *
 * The rule that makes a business different from a job: it takes money every
 * day whether the owner turns up or not, but only part of it. Costs are
 * charged in full regardless. A neglected business therefore earns less, and
 * an expensive neglected business loses money outright.
 *
 * There is no automatic bankruptcy (user decision, 22 Sep 2026): a failing
 * business keeps bleeding until the player closes it. The UI warns them.
 */

export function meetsRequirements(
  attributes: Attributes,
  business: BusinessDefinition,
): boolean {
  return (Object.entries(business.requirements) as [keyof Attributes, number][]).every(
    ([attribute, minimum]) => attributes[attribute] >= minimum,
  );
}

/** The highest level a business can be grown to. */
export const MAX_BUSINESS_LEVEL = BALANCE.business.upgradeCost.length - 1;

/**
 * What the next round of promotion costs, or null at the top.
 *
 * Levels are capped on purpose. An open-ended "spend money to earn more" loop
 * turns into an infinite money printer the moment the player has savings.
 */
export function upgradeCost(level: number): number | null {
  const next = level + 1;
  if (next > MAX_BUSINESS_LEVEL) return null;
  return BALANCE.business.upgradeCost[next] ?? null;
}

/** Takings per day at this level, before the neglect discount. */
export function revenuePerDay(business: BusinessDefinition, level: number): number {
  return business.revenuePerDay * (1 + level * BALANCE.business.revenueBonusPerLevel);
}

/**
 * Profit for one day. Negative is allowed and is the point: it is what
 * neglecting a big business feels like.
 */
export function profitPerDay(
  business: BusinessDefinition,
  level: number,
  attended: boolean,
): number {
  const share = attended ? 1 : business.neglectedShare;
  return revenuePerDay(business, level) * share - business.costPerDay;
}

export interface BusinessDayResult {
  career: CareerState;
  /** Money in (or out) today. */
  profit: number;
}

/** One day of trading. `attended` means the player's focus was the shop. */
export function tradeOneDay(career: CareerState, attended: boolean): BusinessDayResult {
  if (career.type !== 'business') return { career, profit: 0 };

  const business = findBusiness(career.businessId);
  return {
    career: { ...career, daysOpen: career.daysOpen + 1 },
    profit: profitPerDay(business, career.level, attended),
  };
}

export { BUSINESSES, findBusiness };
export type { BusinessDefinition };
