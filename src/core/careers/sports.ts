import { BALANCE } from '../../data/balance';
import { SPORTS, findSport, type SportDefinition } from '../../data/sports';
import { dollars } from '../money';
import type { Attributes, CareerState } from '../types';
import type { Rng } from '../rng';

/**
 * Life as an athlete (GDD §4.3). Pure functions only - no React, no Phaser.
 *
 * Matches are settled by comparing numbers and rolling once, never by playing
 * anything out. Training raises skill; skill and one attribute decide the
 * match; winning raises reputation; reputation raises the purse.
 *
 * Age is the thing that ends a sporting career. Nobody is forced to retire
 * (user decision, 22 Sep 2026) - after the peak age the numbers simply get
 * worse every year until the player decides to do something else.
 */

export function meetsRequirements(attributes: Attributes, sport: SportDefinition): boolean {
  return (Object.entries(sport.requirements) as [keyof Attributes, number][]).every(
    ([attribute, minimum]) => attributes[attribute] >= minimum,
  );
}

/**
 * How much of an athlete's strength survives their age. 1 up to the peak,
 * then falling away to a floor.
 */
export function ageFactor(ageYears: number): number {
  const { peakAgeYears, declinePerYearOver, minAgeFactor } = BALANCE.sports;
  const yearsOver = ageYears - peakAgeYears;
  if (yearsOver <= 0) return 1;
  return Math.max(minAgeFactor, 1 - yearsOver * declinePerYearOver);
}

/** What the athlete brings to a match: skill, an attribute, and their age. */
export function matchStrength(
  sport: SportDefinition,
  skill: number,
  attributes: Attributes,
  ageYears: number,
): number {
  const raw = skill + attributes[sport.keyAttribute] * BALANCE.sports.attributeWeight;
  return raw * ageFactor(ageYears);
}

/**
 * Chance of winning, between 0 and 1.
 *
 * Strength against strength, so an evenly matched fixture is a coin flip and
 * being twice as good wins two times in three. Never 0 or 1: an upset always
 * has to be possible, or the result is not worth rolling for.
 */
export function winChance(strength: number, opponentSkill: number): number {
  const mine = Math.max(1, strength);
  const theirs = Math.max(1, opponentSkill);
  return mine / (mine + theirs);
}

/** Prize for a result, once reputation is taken into account. */
export function prizeFor(sport: SportDefinition, won: boolean, reputation: number): number {
  const base = won ? sport.winPrize : sport.losePrize;
  const bonus = (reputation / 100) * BALANCE.sports.prizeBonusAtFullReputation;
  return Math.round(base * (1 + bonus));
}

/** A day of training: skill up, and one day closer to the next fixture. */
export function trainOneDay(career: CareerState): CareerState {
  if (career.type !== 'sports') return career;
  return {
    ...career,
    skill: Math.min(BALANCE.sports.maxSkill, career.skill + BALANCE.sports.skillPerTrainingDay),
  };
}

export interface MatchResult {
  career: CareerState;
  won: boolean;
  prize: number;
  /** Plain-language line for the event log. */
  text: string;
}

/** True when the athlete has trained enough days for the next fixture. */
export function matchIsDue(career: CareerState): boolean {
  if (career.type !== 'sports') return false;
  return career.daysSinceMatch >= findSport(career.sportId).matchIntervalDays;
}

/**
 * Settles one fixture. Draws exactly once from the seeded RNG, so a replayed
 * save produces the same results.
 */
export function playMatch(
  career: CareerState,
  attributes: Attributes,
  ageYears: number,
  rng: Rng,
): MatchResult {
  if (career.type !== 'sports') {
    return { career, won: false, prize: 0, text: '' };
  }

  const sport = findSport(career.sportId);
  const strength = matchStrength(sport, career.skill, attributes, ageYears);
  const won = rng.next() < winChance(strength, sport.opponentSkill);
  const prize = prizeFor(sport, won, career.reputation);

  const { reputationPerWin, reputationPerLoss } = BALANCE.sports;
  const reputation = Math.min(
    100,
    Math.max(0, career.reputation + (won ? reputationPerWin : reputationPerLoss)),
  );

  return {
    career: {
      ...career,
      reputation,
      daysSinceMatch: 0,
      wins: career.wins + (won ? 1 : 0),
      losses: career.losses + (won ? 0 : 1),
    },
    won,
    prize,
    text: won
      ? `Won at ${sport.name}. Took home ${dollars(prize)}.`
      : `Lost at ${sport.name}. Picked up ${dollars(prize)}.`,
  };
}

export { SPORTS, findSport };
export type { SportDefinition };
