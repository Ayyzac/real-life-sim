import { findBackground } from '../data/backgrounds';
import { findBusiness } from '../data/businesses';
import { findJob } from '../data/jobs';
import { findSport } from '../data/sports';
import { ageInYears } from './character';
import type { Attributes, CareerState, EventLogEntry, Memory, Person, WorldState } from './types';
import { childrenOf, partnerOf } from './relationships';

/**
 * The closing screen (GDD §6): a life read back to the player.
 *
 * Pure data in, pure data out, so it can be tested without a browser and the
 * UI only has to lay it out.
 */

export interface LifeSummary {
  name: string;
  background: string;
  ageAtDeath: number;
  yearsLived: number;
  weeksLived: number;
  cause: string;
  finalMoney: number;
  peakMoney: number;
  finalCareer: string | null;
  attributes: Attributes;
  /** Oldest first, so the summary reads forwards like a life does. */
  milestones: EventLogEntry[];
  /** Who was still there at the end (GDD §10). */
  survivors: Person[];
  /** Everyone who died or drifted away, newest first. */
  memories: Memory[];
  /** Partner and children, in plain words, or null for a life lived alone. */
  household: string | null;
  /** One line that tries to sum the whole thing up. */
  epitaph: string;
}

/**
 * Picks a closing line from what the character actually did. Deliberately
 * about the shape of the life rather than a score - there is no score, and
 * nothing carries over (GDD §6).
 */
function epitaphFor(state: WorldState, ageAtDeath: number, peakMoney: number): string {
  const { career, attributes } = state.character;
  const established = career.type !== 'none' && career.type !== 'sports' ? career.level >= 2 : false;
  const champion = career.type === 'sports' && career.wins >= 100;
  const children = childrenOf(state.people).length;

  if (ageAtDeath < 40) return 'A life cut short. There was so much still ahead.';
  // People come before money in the closing line, because they should.
  // Children alone are enough: simulation shows a partner usually dies first,
  // and "married for sixty years" should not be erased by outliving them.
  if (children > 0) return 'They raised a family, and that was the point.';
  if (partnerOf(state.people)) return 'They were not alone at the end.';
  if (state.people.length === 0) return 'They outlived everyone they knew.';
  if (peakMoney >= 250_000) return 'They wanted for nothing, in the end.';
  if (established || champion) return 'They were good at what they did, and people knew it.';
  if (attributes.intelligence >= 70) return 'They never stopped learning.';
  if (attributes.physical >= 70) return 'They stayed strong to the last.';
  if (attributes.charisma >= 70) return 'A room was warmer for them being in it.';
  if (ageAtDeath >= 85) return 'A long, ordinary life. Most people would take it.';
  return 'An ordinary life, lived all the way through.';
}

function householdLine(people: readonly Person[]): string | null {
  const partner = partnerOf(people);
  const children = childrenOf(people).length;
  if (!partner && children === 0) return null;

  const parts: string[] = [];
  if (partner) parts.push(`married to ${partner.name}`);
  if (children > 0) parts.push(`${children} ${children === 1 ? 'child' : 'children'}`);
  return parts.join(', ');
}

/** What they were doing at the end, whichever of the three careers it was. */
function careerTitle(career: CareerState): string | null {
  switch (career.type) {
    case 'job':
      return findJob(career.jobId).title;
    case 'business':
      return `Owner, ${findBusiness(career.businessId).name}`;
    case 'sports':
      return `${findSport(career.sportId).name} (${career.wins}-${career.losses})`;
    case 'none':
      return null;
  }
}

export function buildLifeSummary(state: WorldState): LifeSummary {
  const { character } = state;
  const ageAtDeath = ageInYears(character);

  return {
    name: character.name,
    background: findBackground(character.backgroundId).label,
    ageAtDeath,
    yearsLived: ageAtDeath - character.startAgeYears,
    weeksLived: Math.floor(character.ageInDays / 7),
    cause: state.deathCause ?? 'Their life came to an end.',
    finalMoney: character.stats.money,
    peakMoney: state.peakMoney,
    finalCareer: careerTitle(character.career),
    attributes: character.attributes,
    milestones: [...state.milestones].reverse(),
    survivors: state.people,
    memories: state.memories,
    household: householdLine(state.people),
    epitaph: epitaphFor(state, ageAtDeath, state.peakMoney),
  };
}
