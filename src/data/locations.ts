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
}

export const LOCATIONS: readonly LocationDefinition[] = [
  { id: 'home', label: 'Home', blurb: 'Sleep it off, or hit the books.' },
  { id: 'work', label: 'Work', blurb: 'Find a job, or put in the hours.' },
  { id: 'gym', label: 'Gym', blurb: 'Trade energy for muscle.' },
  { id: 'cafe', label: 'Cafe', blurb: 'People are good for you. They cost money.' },
  { id: 'hospital', label: 'Hospital', blurb: 'Expensive, but it works.' },
];
