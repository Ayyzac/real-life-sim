import type { Attributes, Stats } from '../core/types';

/**
 * Where the character comes from (GDD §3.2). Kept deliberately small: a few
 * starting numbers, not a backstory generator.
 */
export interface BackgroundDefinition {
  id: string;
  label: string;
  description: string;
  /** Added on top of BALANCE.startAttributes. */
  attributeBonus: Partial<Attributes>;
  /** Added on top of BALANCE.startStats / startMoney. */
  statBonus: Partial<Stats>;
}

export const BACKGROUNDS: readonly BackgroundDefinition[] = [
  {
    id: 'scholarship',
    label: 'Scholarship Kid',
    description: 'Sharp, and broke. Better jobs are within reach sooner.',
    attributeBonus: { intelligence: 18 },
    statBonus: { money: -150 },
  },
  {
    id: 'family_business',
    label: 'Family Business',
    description: 'Money to start with and a way with people. No special talent.',
    attributeBonus: { charisma: 10 },
    statBonus: { money: 800 },
  },
  {
    id: 'athlete',
    label: 'School Athlete',
    description: 'Strong and healthy. The gym and physical work come easy.',
    attributeBonus: { physical: 18 },
    statBonus: { health: 8 },
  },
];

export function findBackground(id: string): BackgroundDefinition {
  const background = BACKGROUNDS.find((b) => b.id === id);
  if (!background) throw new Error(`Unknown background id: ${id}`);
  return background;
}
