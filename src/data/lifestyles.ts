import type { Stats } from '../core/types';

/**
 * How well the character chooses to live (GDD §9.2).
 *
 * Unlike a possession, this is not bought once - it is paid for every single
 * day, and it can be dialled back down when money gets tight. That makes it
 * the sink that responds to how the player is actually doing, rather than one
 * big decision taken years earlier.
 *
 * `ordinary` costs nothing extra and changes nothing: it is exactly how the
 * game behaved before Phase 5, so every balance figure pinned by the existing
 * tests still describes a character living an ordinary life.
 */

export interface LifestyleDefinition {
  id: string;
  label: string;
  description: string;
  /** Added to living costs every day. Negative means living more cheaply. */
  extraCostPerDay: number;
  /** Applied every day. */
  perDay: Partial<Pick<Stats, 'mood' | 'health'>>;
}

export const LIFESTYLES: readonly LifestyleDefinition[] = [
  {
    id: 'frugal',
    label: 'Frugal',
    description: 'Cut everything back to the bone. Cheaper, and it wears on you.',
    extraCostPerDay: -8,
    perDay: { mood: -0.35 },
  },
  {
    id: 'ordinary',
    label: 'Ordinary',
    description: 'Nothing special, nothing missing. What most people do.',
    extraCostPerDay: 0,
    perDay: {},
  },
  {
    id: 'comfortable',
    label: 'Comfortable',
    description: 'Better food, fewer worries, the occasional treat.',
    extraCostPerDay: 30,
    perDay: { mood: 0.7 },
  },
  {
    id: 'luxurious',
    label: 'Luxurious',
    description: 'The good life, billed daily. It costs what you think it costs.',
    extraCostPerDay: 110,
    perDay: { mood: 1.8, health: 0.2 },
  },
];

export const DEFAULT_LIFESTYLE_ID = 'ordinary';

export function findLifestyle(id: string): LifestyleDefinition {
  const lifestyle = LIFESTYLES.find((l) => l.id === id);
  if (!lifestyle) throw new Error(`Unknown lifestyle id: ${id}`);
  return lifestyle;
}
