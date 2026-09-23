import { BALANCE } from '../data/balance';
import type { Character } from './types';

/**
 * Gym membership (GDD §12, user decision 23 Sep 2026): a subscription that
 * renews itself every 30 days until the player stops it. Renewing on its own
 * is what keeps a week on autopilot from losing the gym without anyone
 * noticing.
 */

const G = BALANCE.gym;

export function isGymMember(character: Pick<Character, 'gymPaidUntil'>): boolean {
  return character.gymPaidUntil !== null;
}

/**
 * The fee due today, if the paid month has run out. Charged like the living
 * cost, so it can take the player into debt - bills do not stop because the
 * money has.
 */
export function gymRenewal(
  character: Pick<Character, 'gymPaidUntil'>,
  clockDay: number,
): { cost: number; gymPaidUntil: number | null } {
  const paidUntil = character.gymPaidUntil;
  if (paidUntil === null || clockDay < paidUntil) return { cost: 0, gymPaidUntil: paidUntil };
  return { cost: G.fee, gymPaidUntil: paidUntil + G.days };
}
