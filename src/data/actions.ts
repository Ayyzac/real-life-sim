import type { Attributes, LocationId, Needs, Stats } from '../core/types';

/**
 * Things to do in the free hours of a day (GDD §11), as data.
 *
 * Needs (hunger, thirst, hygiene) are topped up every time. Everything else -
 * mood, energy, health, attributes - only counts the first time each action
 * is done in a day (`WorldState.doneToday`). That one rule is what stops ten
 * coffees becoming ten times the energy, or a daily check-up making a
 * character immortal, without a special case per action.
 *
 * Adding something to do = adding an entry here.
 */
export interface ActionDefinition {
  id: string;
  label: string;
  description: string;
  locationId: LocationId;
  minutes: number;
  /** Dollars. You cannot pay with money you do not have. */
  cost?: number;
  /** Topped up every time. */
  needs?: Partial<Needs>;
  /** The treat: first time each day only. */
  effects?: Partial<Pick<Stats, 'energy' | 'mood' | 'health'>> & Partial<Attributes>;
  /** Has a screen of its own (the clothes shop), so it is not listed with the rest. */
  custom?: boolean;
  /** Gym members only (GDD §12). */
  membersOnly?: boolean;
}

export const ACTIONS: readonly ActionDefinition[] = [
  // Home: free, because food and water are already in the living cost.
  {
    id: 'cook',
    label: 'Cook a meal',
    description: 'Nothing fancy, but it fills you up and costs nothing extra.',
    locationId: 'home',
    minutes: 40,
    needs: { hunger: 55 },
    effects: { mood: 1 },
  },
  {
    id: 'water',
    label: 'Glass of water',
    description: 'Straight from the tap.',
    locationId: 'home',
    minutes: 5,
    needs: { thirst: 45 },
  },
  {
    id: 'shower',
    label: 'Shower',
    description: 'You feel more like a person afterwards.',
    locationId: 'home',
    minutes: 20,
    needs: { hygiene: 70 },
    effects: { mood: 1 },
  },
  // Cafe: quicker and nicer, and it costs.
  {
    id: 'coffee',
    label: 'Coffee',
    description: 'A proper one, made by someone who cares.',
    locationId: 'cafe',
    minutes: 15,
    cost: 5,
    needs: { thirst: 35 },
    effects: { energy: 6, mood: 2 },
  },
  {
    id: 'cafe_meal',
    label: 'Eat out',
    description: 'Someone else cooks, and it shows.',
    locationId: 'cafe',
    minutes: 40,
    cost: 14,
    needs: { hunger: 65, thirst: 15 },
    effects: { mood: 4 },
  },
  // Hospital: the quick fix the Treatment focus is the long version of.
  {
    id: 'checkup',
    label: 'See a doctor',
    description: 'An hour in the waiting room for a proper look-over.',
    locationId: 'hospital',
    minutes: 60,
    cost: 80,
    effects: { health: 1.2 },
  },
  // Gym.
  {
    id: 'workout',
    membersOnly: true,
    label: 'Work out',
    description: 'An hour on the machines. You will want a shower after.',
    locationId: 'gym',
    minutes: 60,
    needs: { hygiene: -30, thirst: -10 },
    effects: { energy: -10, health: 0.4, physical: 0.03, mood: 2 },
  },
  {
    id: 'gym_shower',
    membersOnly: true,
    label: 'Shower at the gym',
    description: 'Cold water, but it does the job.',
    locationId: 'gym',
    minutes: 15,
    needs: { hygiene: 60 },
  },
  {
    id: 'gym_water',
    membersOnly: true,
    label: 'Water fountain',
    description: 'Free, and exactly as good as it sounds.',
    locationId: 'gym',
    minutes: 5,
    needs: { thirst: 30 },
  },
  // Mall (GDD §11.5).
  {
    id: 'food_court',
    label: 'Food court',
    description: 'Noodles, rice, something fried. Quick and filling.',
    locationId: 'mall',
    minutes: 30,
    cost: 12,
    needs: { hunger: 60, thirst: 10 },
    effects: { mood: 2 },
  },
  {
    id: 'bubble_tea',
    label: 'Bubble tea',
    description: 'Mostly sugar. Nobody minds.',
    locationId: 'mall',
    minutes: 10,
    cost: 5,
    needs: { thirst: 40 },
    effects: { mood: 2 },
  },
  {
    id: 'cinema',
    label: 'Watch a film',
    description: 'Two hours somewhere else entirely.',
    locationId: 'mall',
    minutes: 120,
    cost: 15,
    effects: { mood: 8 },
  },
  {
    id: 'buy_clothes',
    label: 'New clothes',
    description: 'A new top. It changes how you look, and a little how you feel.',
    locationId: 'mall',
    minutes: 30,
    cost: 60,
    needs: {},
    effects: { mood: 3 },
    custom: true,
  },
];

export function findAction(id: string): ActionDefinition {
  const action = ACTIONS.find((a) => a.id === id);
  if (!action) throw new Error(`Unknown action: ${id}`);
  return action;
}
