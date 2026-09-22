import { findBackground } from '../data/backgrounds';
import { findJob } from '../data/jobs';
import { ageInYears } from './character';
import type { Attributes, EventLogEntry, WorldState } from './types';

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
  finalJob: string | null;
  attributes: Attributes;
  /** Oldest first, so the summary reads forwards like a life does. */
  milestones: EventLogEntry[];
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
  const employed = career.type === 'job';

  if (ageAtDeath < 40) return 'A life cut short. There was so much still ahead.';
  if (peakMoney >= 250_000) return 'They wanted for nothing, in the end.';
  if (employed && career.level >= 2) return 'They were good at what they did, and people knew it.';
  if (attributes.intelligence >= 70) return 'They never stopped learning.';
  if (attributes.physical >= 70) return 'They stayed strong to the last.';
  if (attributes.charisma >= 70) return 'A room was warmer for them being in it.';
  if (ageAtDeath >= 85) return 'A long, ordinary life. Most people would take it.';
  return 'An ordinary life, lived all the way through.';
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
    finalJob: character.career.type === 'job' ? findJob(character.career.jobId).title : null,
    attributes: character.attributes,
    milestones: [...state.milestones].reverse(),
    epitaph: epitaphFor(state, ageAtDeath, state.peakMoney),
  };
}
