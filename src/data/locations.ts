import type { LocationId } from '../core/types';

/**
 * Places in town. In Phase 1 these are menu tabs; in Phase 2 they become real
 * spots on the Phaser map and walking into one opens the same menu
 * (docs/ROADMAP.md Phase 2).
 */
export interface LocationDefinition {
  id: LocationId;
  label: string;
  blurb: string;
  /**
   * Opening hours in minutes after midnight (GDD §11.4). Past midnight keeps
   * counting, so 26 * 60 is 02:00 - the latest anyone is up.
   */
  opens: number;
  closes: number;
}

const ALWAYS = { opens: 0, closes: 26 * 60 };

export const LOCATIONS: readonly LocationDefinition[] = [
  { id: 'home', label: 'Home', blurb: 'Sleep it off, or hit the books.', ...ALWAYS },
  { id: 'work', label: 'Work', blurb: 'Find a job, or put in the hours.', opens: 7 * 60, closes: 19 * 60 },
  { id: 'gym', label: 'Gym', blurb: 'Trade energy for muscle.', opens: 6 * 60, closes: 22 * 60 },
  { id: 'cafe', label: 'Cafe', blurb: 'People are good for you. They cost money.', opens: 7 * 60, closes: 22 * 60 },
  {
    id: 'business',
    label: 'Business',
    blurb: 'Your own shop. Or the empty unit where one could be.',
    opens: 8 * 60,
    closes: 20 * 60,
  },
  { id: 'hospital', label: 'Hospital', blurb: 'Expensive, but it works.', ...ALWAYS },
  {
    id: 'stadium',
    label: 'Stadium',
    blurb: 'Where an athlete trains, and where the fixtures are.',
    opens: 6 * 60,
    closes: 22 * 60,
  },
  {
    id: 'mall',
    label: 'Mall',
    blurb: 'Food, films, clothes, and the bigger things money buys.',
    opens: 10 * 60,
    closes: 22 * 60,
  },
];
