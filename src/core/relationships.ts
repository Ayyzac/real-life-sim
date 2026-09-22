import { BALANCE } from '../data/balance';
import { FIRST_NAMES, NPC_JOBS, SURNAMES } from '../data/names';
import type { Memory, Person, RelationKind } from './types';
import type { Rng } from './rng';

/**
 * The people around the player (GDD §10).
 *
 * Pure functions, no React and no Phaser. They age, work, marry, have children
 * and die on their own schedule - the world moves whether or not the player
 * looks at it.
 *
 * The hard constraint running through all of this is size. The save lives in
 * localStorage under a test that keeps it small, so the living are simulated
 * and everyone else is compressed to a single remembered line (§10.3). Without
 * that, seventy years of acquaintances would break saving silently.
 */

const R = BALANCE.relationships;

export function ageYearsOf(person: Person): number {
  return Math.floor(person.ageDays / 365);
}

export function livingCount(people: readonly Person[]): number {
  return people.length;
}

export function partnerOf(people: readonly Person[]): Person | undefined {
  return people.find((p) => p.kind === 'partner');
}

export function childrenOf(people: readonly Person[]): Person[] {
  return people.filter((p) => p.kind === 'child');
}

/** Children still being paid for. Grown-up children stay, but stop costing. */
export function dependentChildren(people: readonly Person[]): Person[] {
  return childrenOf(people).filter(
    (child) => ageYearsOf(child) < R.childDependentUntilAgeYears,
  );
}

export function makeName(rng: Rng): string {
  return `${rng.pick(FIRST_NAMES)} ${rng.pick(SURNAMES)}`;
}

function makeId(rng: Rng): string {
  return `p${Math.floor(rng.next() * 1e9).toString(36)}`;
}

export function makePerson(
  rng: Rng,
  kind: RelationKind,
  ageYears: number,
  closeness: number,
  name = makeName(rng),
): Person {
  return {
    id: makeId(rng),
    name,
    kind,
    ageDays: ageYears * 365,
    closeness,
    job: kind === 'child' ? null : rng.pick(NPC_JOBS),
    neglectedDays: 0,
  };
}

/**
 * Who the player starts life with: two parents and a friend from school.
 *
 * Nobody begins alone. It also means the relationship system has something to
 * do from day one rather than waiting for a chance meeting.
 */
export function startingPeople(rng: Rng): Person[] {
  const surname = rng.pick(SURNAMES);
  return [
    makePerson(rng, 'family', rng.int(44, 56), 70, `${rng.pick(FIRST_NAMES)} ${surname}`),
    makePerson(rng, 'family', rng.int(44, 56), 70, `${rng.pick(FIRST_NAMES)} ${surname}`),
    makePerson(rng, 'friend', rng.int(17, 20), 55, makeName(rng)),
  ];
}

function clampCloseness(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export interface RelationshipDay {
  people: Person[];
  /** Money owed today for dependent children. */
  costPerDay: number;
  /** Mood from having a partner and children around. */
  moodPerDay: number;
}

/**
 * The certain part of a day: everyone gets a day older, closeness drifts, and
 * the family costs what it costs.
 *
 * No dice here on purpose - it keeps this testable to the number, the same
 * reason `applyDailyRules` is separate from the event roll.
 */
export function relationshipsOneDay(
  people: readonly Person[],
  socialising: boolean,
): RelationshipDay {
  const drift = socialising ? R.closenessPerSocialDay : R.closenessDriftPerDay;

  const next = people.map((person) => {
    const closeness = clampCloseness(person.closeness + drift);
    const neglected =
      closeness <= R.driftAwayBelow ? person.neglectedDays + 1 : 0;
    return { ...person, ageDays: person.ageDays + 1, closeness, neglectedDays: neglected };
  });

  const partner = partnerOf(next);
  const dependents = dependentChildren(next);

  return {
    people: next,
    costPerDay: dependents.length * R.childCostPerDay,
    moodPerDay:
      (partner ? R.partnerMoodPerDay : 0) + childrenOf(next).length * R.childMoodPerDay,
  };
}

export interface RelationshipEvent {
  people: Person[];
  memories: Memory[];
  /** Plain-language line for the log, if anything happened. */
  text: string | null;
  tone: 'good' | 'bad' | 'neutral';
  /** Worth keeping decades later. */
  milestone: boolean;
  /** One-off mood change, mostly grief. */
  moodChange: number;
}

const NOTHING: Omit<RelationshipEvent, 'people' | 'memories'> = {
  text: null,
  tone: 'neutral',
  milestone: false,
  moodChange: 0,
};

/** How likely somebody that age is to die today. Mirrors the player's curve. */
export function npcDeathChance(ageYears: number): number {
  const over = ageYears - R.npcDeathStartAgeYears;
  if (over <= 0) return 0;
  return over * R.npcDeathChancePerDayPerYearOver;
}

function remember(person: Person, text: string, day: number): Memory {
  return { name: person.name, kind: person.kind, text, day };
}

function trimMemories(memories: readonly Memory[]): Memory[] {
  return memories.slice(0, R.memoryLimit);
}

/**
 * The part of a day that rolls dice: somebody dies, drifts away, has news, or
 * a new face turns up.
 *
 * At most one thing happens per day, so the log never turns into a wall.
 */
export function rollRelationships(
  people: readonly Person[],
  memories: readonly Memory[],
  day: number,
  married: boolean,
  rng: Rng,
): RelationshipEvent {
  // 1. Old age, taken one person at a time so the eldest is checked first.
  const byAge = [...people].sort((a, b) => b.ageDays - a.ageDays);
  for (const person of byAge) {
    if (person.kind === 'child') continue;
    if (!rng.chance(npcDeathChance(ageYearsOf(person)))) continue;

    const line = `${person.name} died at ${ageYearsOf(person)}.`;
    return {
      people: people.filter((p) => p.id !== person.id),
      memories: trimMemories([remember(person, line, day), ...memories]),
      text: line,
      tone: 'bad',
      milestone: true,
      moodChange: -(person.closeness / 100) * R.griefMoodPerCloseness * 100,
    };
  }

  // 2. Drifting apart. Family and children stay; you do not lose a parent by
  //    forgetting to call.
  const drifted = people.find(
    (p) =>
      (p.kind === 'friend' || p.kind === 'colleague') &&
      p.neglectedDays >= R.driftAwayAfterDays,
  );
  if (drifted) {
    const line = `${drifted.name} drifted out of your life.`;
    return {
      people: people.filter((p) => p.id !== drifted.id),
      memories: trimMemories([remember(drifted, line, day), ...memories]),
      text: line,
      tone: 'neutral',
      milestone: false,
      moodChange: -2,
    };
  }

  // 3. A child, once there is a partner and room for one.
  if (married && childrenOf(people).length < R.maxChildren && rng.chance(R.childChancePerDay)) {
    if (people.length < R.maxLivingPeople) {
      const child = makePerson(rng, 'child', 0, 80);
      const line = `${child.name} was born.`;
      return {
        people: [...people, child],
        memories: [...memories],
        text: line,
        tone: 'good',
        milestone: true,
        moodChange: 18,
      };
    }
  }

  // 4. Somebody's own life moves on. Flavour, but it is what makes them feel
  //    like people rather than counters.
  if (rng.chance(R.npcLifeChancePerDay) && people.length > 0) {
    const person = rng.pick(people);
    if (person.kind !== 'child') {
      const job = rng.pick(NPC_JOBS);
      if (job !== person.job) {
        return {
          people: people.map((p) => (p.id === person.id ? { ...p, job } : p)),
          memories: [...memories],
          text: `${person.name} is working as a ${job} now.`,
          tone: 'neutral',
          milestone: false,
          moodChange: 0,
        };
      }
    }
  }

  // 5. A new face, when there is room for one.
  if (people.length < R.maxLivingPeople && rng.chance(R.meetChancePerDay)) {
    const kind: RelationKind = rng.chance(0.5) ? 'friend' : 'colleague';
    const person = makePerson(rng, kind, rng.int(19, 55), rng.int(15, 35));
    return {
      people: [...people, person],
      memories: [...memories],
      text: `You got to know ${person.name}, a ${person.job}.`,
      tone: 'good',
      milestone: false,
      moodChange: 3,
    };
  }

  return { people: [...people], memories: [...memories], ...NOTHING };
}

/** Everyone who could be married: not family, not a child, close enough. */
export function marriageCandidates(people: readonly Person[]): Person[] {
  if (partnerOf(people)) return [];
  return people.filter(
    (p) =>
      (p.kind === 'friend' || p.kind === 'colleague') &&
      p.closeness >= R.marriageClosenessRequired &&
      ageYearsOf(p) >= R.marriageMinAgeYears,
  );
}

export { R as RELATIONSHIP_BALANCE };
