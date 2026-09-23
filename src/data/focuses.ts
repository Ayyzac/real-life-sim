import type { Attributes, FocusId, LocationId, Stats } from '../core/types';

/**
 * What the character does with their days.
 *
 * Attributes move an order of magnitude slower than stats on purpose: a stat
 * swings inside a week, an attribute is a career's worth of effort. Raising
 * Intelligence from 12 to the 60 a developer needs is thousands of study days.
 *
 * The focus stays put until the player changes it - with roughly 3,000 clicks
 * in a full life, forcing a re-pick every week would be punishing. Effects are
 * PER DAY; the engine applies them once per simulated day.
 *
 * Adding an activity = adding an entry here. No engine changes.
 */
export interface FocusDefinition {
  id: FocusId;
  label: string;
  description: string;
  locationId: LocationId;
  /** Per-day changes. Omitted keys mean no change. */
  effects: Partial<Pick<Stats, 'energy' | 'mood' | 'health'>> & Partial<Attributes>;
  /** Money spent per day on top of living costs. */
  costPerDay?: number;
  /** Income comes from the job system (src/core/careers/job.ts) instead. */
  worksJob?: boolean;
  /**
   * Minding the shop. A business earns every day either way; this is what
   * turns the reduced takings into the full ones
   * (src/core/careers/business.ts).
   */
  runsBusiness?: boolean;
  /**
   * Training. Raises the athlete's skill and is what brings the next fixture
   * closer (src/core/careers/sports.ts).
   */
  trainsSport?: boolean;
  /**
   * This is the focus that actually recovers you. A better home makes it
   * worth more (src/core/belongings.ts).
   */
  restores?: boolean;
  /**
   * Time spent on people. This is what keeps closeness up
   * (src/core/relationships.ts).
   */
  socialises?: boolean;
  /** Gym members only (GDD §12). */
  membersOnly?: boolean;
  /**
   * The button that starts the 09:00-17:00 block (GDD §11.1), in the
   * player's words. Resting has no block, so no button.
   */
  startLabel?: string;
}

export const FOCUSES: readonly FocusDefinition[] = [
  {
    id: 'rest',
    label: 'Rest',
    description: 'Sleep, recover, do nothing much. The only real way back to full energy.',
    locationId: 'home',
    effects: { energy: 16, mood: 1.2, health: 0.25 },
    restores: true,
  },
  {
    id: 'work',
    startLabel: 'Go to work',
    label: 'Work',
    description: 'Put in the hours at your job. No job means no pay.',
    locationId: 'work',
    effects: { energy: -5, mood: -0.5 },
    worksJob: true,
  },
  {
    id: 'mind_business',
    startLabel: 'Open the shop',
    label: 'Mind the shop',
    description: 'Be there all day. Your business takes full money instead of ticking over.',
    locationId: 'business',
    effects: { energy: -6, mood: -0.3, charisma: 0.025 },
    runsBusiness: true,
  },
  {
    id: 'train',
    startLabel: 'Go to training',
    label: 'Train',
    description: 'Drill, repeat, recover. Raises your sporting skill and brings the next fixture closer.',
    locationId: 'stadium',
    effects: { energy: -10, mood: -0.4, health: 0.3, physical: 0.03 },
    trainsSport: true,
  },
  {
    id: 'study',
    startLabel: 'Hit the books',
    label: 'Study',
    description: 'Grind through books. Raises Intelligence, which unlocks better jobs.',
    locationId: 'home',
    effects: { energy: -7, mood: -0.5, intelligence: 0.05 },
  },
  {
    id: 'exercise',
    startLabel: 'Go to the gym',
    label: 'Exercise',
    description: 'Train hard. Raises Physical and slowly repairs your health.',
    locationId: 'gym',
    membersOnly: true,
    effects: { energy: -9, mood: 0.4, health: 0.55, physical: 0.045 },
  },
  {
    id: 'socialize',
    startLabel: 'Go out with people',
    label: 'Socialize',
    description: 'See people. The fastest way to lift a sinking mood, but it costs.',
    locationId: 'cafe',
    effects: { energy: -5, mood: 4, charisma: 0.035 },
    costPerDay: 12,
    socialises: true,
  },
  {
    id: 'treatment',
    startLabel: 'Go to the hospital',
    label: 'Get treatment',
    description: 'Let the doctors fix you. Effective and expensive.',
    locationId: 'hospital',
    effects: { energy: 4, health: 1.6 },
    costPerDay: 45,
  },
];

export const DEFAULT_FOCUS_ID: FocusId = 'rest';

export function findFocus(id: FocusId): FocusDefinition {
  const focus = FOCUSES.find((f) => f.id === id);
  if (!focus) throw new Error(`Unknown focus id: ${id}`);
  return focus;
}
