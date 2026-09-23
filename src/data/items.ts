import type { ActionDefinition } from './actions';
import type { Needs } from '../core/types';

/**
 * What the Supermarket sells and the bag carries (GDD §12), as data.
 *
 * Eaten or used anywhere, which is the whole point: a snack in the bag means
 * not walking home for lunch. Home cooking stays free, so this is about time
 * and convenience, not survival. Same rules as actions: needs are topped up
 * every time, the treat only counts once a day.
 *
 * Adding something to sell = adding an entry here.
 */
export interface ItemDefinition {
  id: string;
  label: string;
  description: string;
  /** Dollars, before today's deal. */
  price: number;
  /** How long eating, drinking or using it takes. */
  minutes: number;
  needs?: Partial<Needs>;
  effects?: ActionDefinition['effects'];
  /** Kept rather than used up - the umbrella. Nobody needs two. */
  tool?: boolean;
}

export const ITEMS: readonly ItemDefinition[] = [
  {
    id: 'bread',
    label: 'Bread roll',
    description: 'Plain, cheap, and better than nothing.',
    price: 2,
    minutes: 5,
    needs: { hunger: 25 },
  },
  {
    id: 'sandwich',
    label: 'Sandwich',
    description: 'Cheese and something green.',
    price: 4,
    minutes: 10,
    needs: { hunger: 40 },
    effects: { mood: 1 },
  },
  {
    id: 'ready_meal',
    label: 'Ready meal',
    description: 'Rice and curry in a box. A proper lunch, cold or not.',
    price: 6,
    minutes: 15,
    needs: { hunger: 60 },
    effects: { mood: 1 },
  },
  {
    id: 'fruit',
    label: 'Fruit',
    description: 'An apple and a banana. Your body notices.',
    price: 2,
    minutes: 5,
    needs: { hunger: 15, thirst: 10 },
    effects: { health: 0.2 },
  },
  {
    id: 'water_bottle',
    label: 'Bottled water',
    description: 'For when there is no tap.',
    price: 1,
    minutes: 2,
    needs: { thirst: 40 },
  },
  {
    id: 'energy_drink',
    label: 'Energy drink',
    description: 'Tastes of batteries. Works, a bit.',
    price: 3,
    minutes: 5,
    needs: { thirst: 25 },
    effects: { energy: 5 },
  },
  {
    id: 'wet_wipes',
    label: 'Wet wipes',
    description: 'Not a shower. Closer than nothing.',
    price: 3,
    minutes: 5,
    needs: { hygiene: 25 },
  },
  {
    id: 'umbrella',
    label: 'Umbrella',
    description: 'Keeps the rain off. Stays in the bag.',
    price: 12,
    minutes: 0,
    tool: true,
  },
];

export function findItem(id: string): ItemDefinition {
  const item = ITEMS.find((i) => i.id === id);
  if (!item) throw new Error(`Unknown item: ${id}`);
  return item;
}
