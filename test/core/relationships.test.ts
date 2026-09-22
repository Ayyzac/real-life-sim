import { describe, expect, it } from 'vitest';

import { createWorld } from '../../src/core/character';
import { advanceWeek } from '../../src/core/clock';
import { createRng } from '../../src/core/rng';
import {
  RELATIONSHIP_BALANCE,
  ageYearsOf,
  childrenOf,
  dependentChildren,
  makePerson,
  marriageCandidates,
  npcDeathChance,
  partnerOf,
  relationshipsOneDay,
  rollRelationships,
  startingPeople,
} from '../../src/core/relationships';
import type { Person, WorldState } from '../../src/core/types';
import type { Rng } from '../../src/core/rng';
import { playUntilDeath } from '../helpers/play';

const R = RELATIONSHIP_BALANCE;

/**
 * An RNG that always says yes.
 *
 * Rolling a real one until a rare thing happens makes a test that passes or
 * fails on luck. This makes "somebody dies today" a certainty so the test can
 * check what the code does about it.
 */
function certainRng(): Rng {
  return {
    next: () => 0,
    int: (min) => min,
    chance: () => true,
    pick: <T,>(items: readonly T[]): T => items[0] as T,
    snapshot: () => ({ seed: 0, cursor: 0 }),
  };
}

function world(patch: Partial<WorldState> = {}): WorldState {
  return { ...createWorld({ name: 'Social', backgroundId: 'scholarship', seed: 12 }), ...patch };
}

describe('startingPeople', () => {
  it('gives the player a family and a friend, so nobody starts alone', () => {
    const people = startingPeople(createRng(1));

    expect(people.filter((p) => p.kind === 'family')).toHaveLength(2);
    expect(people.filter((p) => p.kind === 'friend')).toHaveLength(1);
  });

  it('gives the two family members the same surname', () => {
    const [first, second] = startingPeople(createRng(4));
    const surname = (name: string): string => name.split(' ')[1]!;

    expect(surname(first!.name)).toBe(surname(second!.name));
  });

  it('is reproducible from a seed', () => {
    const a = startingPeople(createRng(9)).map((p) => p.name);
    const b = startingPeople(createRng(9)).map((p) => p.name);

    expect(a).toEqual(b);
  });
});

describe('relationshipsOneDay', () => {
  const someone = (closeness: number): Person =>
    makePerson(createRng(2), 'friend', 30, closeness);

  it('ages everybody by a day', () => {
    const before = someone(50);

    const after = relationshipsOneDay([before], false).people[0]!;

    expect(after.ageDays).toBe(before.ageDays + 1);
  });

  it('lets closeness fade when nothing is done about it', () => {
    expect(relationshipsOneDay([someone(50)], false).people[0]!.closeness).toBeLessThan(50);
  });

  it('lifts everyone at once on a day spent socialising', () => {
    const people = [someone(30), someone(60)];

    const after = relationshipsOneDay(people, true).people;

    expect(after[0]!.closeness).toBeGreaterThan(30);
    expect(after[1]!.closeness).toBeGreaterThan(60);
  });

  it('keeps closeness inside 0-100', () => {
    expect(relationshipsOneDay([someone(100)], true).people[0]!.closeness).toBe(100);
    expect(relationshipsOneDay([someone(0)], false).people[0]!.closeness).toBe(0);
  });

  it('counts the days somebody has been forgotten', () => {
    const forgotten = someone(0);

    const after = relationshipsOneDay([forgotten], false).people[0]!;

    expect(after.neglectedDays).toBe(1);
  });

  it('forgets the neglect once they are back above the floor', () => {
    // One day of socialising will not rescue somebody at zero - it takes a
    // few - so the test starts them just above the line.
    const mended = { ...someone(R.driftAwayBelow + 5), neglectedDays: 300 };

    const after = relationshipsOneDay([mended], true).people[0]!;

    expect(after.neglectedDays).toBe(0);
  });

  it('charges for dependent children and not for grown ones', () => {
    const rng = createRng(3);
    const small = makePerson(rng, 'child', 4, 90);
    const grown = makePerson(rng, 'child', 30, 90);

    expect(relationshipsOneDay([small], false).costPerDay).toBe(R.childCostPerDay);
    expect(relationshipsOneDay([grown], false).costPerDay).toBe(0);
  });

  it('a partner and children are worth having around', () => {
    const rng = createRng(5);
    const alone = relationshipsOneDay([], false).moodPerDay;
    const family = relationshipsOneDay(
      [makePerson(rng, 'partner', 30, 90), makePerson(rng, 'child', 3, 90)],
      false,
    ).moodPerDay;

    expect(family).toBeGreaterThan(alone);
  });
});

describe('npcDeathChance', () => {
  it('is nothing at all while they are young', () => {
    expect(npcDeathChance(30)).toBe(0);
    expect(npcDeathChance(R.npcDeathStartAgeYears)).toBe(0);
  });

  it('climbs with age', () => {
    expect(npcDeathChance(90)).toBeGreaterThan(npcDeathChance(70));
  });
});

describe('rollRelationships', () => {
  const day = 500;

  it('does nothing on most days', () => {
    const people = [makePerson(createRng(6), 'friend', 30, 50)];

    const outcome = rollRelationships(people, [], day, false, createRng(6));

    expect(outcome.text).toBeNull();
  });

  it('remembers somebody who dies instead of simply deleting them', () => {
    const ancient = { ...makePerson(createRng(7), 'family', 95, 80), ageDays: 95 * 365 };

    const outcome = rollRelationships([ancient], [], day, false, certainRng());

    expect(outcome.people).toHaveLength(0);
    expect(outcome.memories).toHaveLength(1);
    expect(outcome.memories[0]?.text).toContain('died at');
    expect(outcome.moodChange).toBeLessThan(0);
  });

  it('lets a forgotten friend drift away, but never family', () => {
    const rng = createRng(11);
    const friend = { ...makePerson(rng, 'friend', 30, 0), neglectedDays: R.driftAwayAfterDays };
    const parent = { ...makePerson(rng, 'family', 30, 0), neglectedDays: R.driftAwayAfterDays };

    const outcome = rollRelationships([friend, parent], [], day, false, createRng(11));

    expect(outcome.people.map((p) => p.kind)).toEqual(['family']);
    expect(outcome.memories[0]?.text).toContain('drifted out of your life');
  });

  it('never adds anybody once the roster is full', () => {
    // The cap is what keeps the save small enough to write (GDD §10.3).
    const rng = createRng(13);
    const full = Array.from({ length: R.maxLivingPeople }, () =>
      makePerson(rng, 'friend', 30, 50),
    );

    for (let seed = 0; seed < 250; seed += 1) {
      const outcome = rollRelationships(full, [], day, true, createRng(seed));
      expect(outcome.people.length).toBeLessThanOrEqual(R.maxLivingPeople);
    }
  });

  it('keeps only the most recent memories', () => {
    const rng = createRng(17);
    const ancient = { ...makePerson(rng, 'family', 130, 80), ageDays: 130 * 365 };
    const memories = Array.from({ length: R.memoryLimit + 10 }, (_, i) => ({
      name: `Old ${i}`,
      kind: 'friend' as const,
      text: 'gone',
      day: i,
    }));

    const outcome = rollRelationships([ancient], memories, day, false, certainRng());

    expect(outcome.memories.length).toBeLessThanOrEqual(R.memoryLimit);
  });
});

describe('marriageCandidates', () => {
  it('offers only people you are close enough to', () => {
    const rng = createRng(19);
    const close = makePerson(rng, 'friend', 30, R.marriageClosenessRequired);
    const distant = makePerson(rng, 'friend', 30, R.marriageClosenessRequired - 1);

    expect(marriageCandidates([close, distant]).map((p) => p.id)).toEqual([close.id]);
  });

  it('never offers somebody too young to marry', () => {
    const rng = createRng(101);
    const young = makePerson(rng, 'friend', R.marriageMinAgeYears - 1, 100);
    const grown = makePerson(rng, 'friend', R.marriageMinAgeYears, 100);

    expect(marriageCandidates([young, grown]).map((p) => p.id)).toEqual([grown.id]);
  });

  it('never offers family or children', () => {
    const rng = createRng(23);
    const parent = makePerson(rng, 'family', 50, 100);
    const child = makePerson(rng, 'child', 20, 100);

    expect(marriageCandidates([parent, child])).toHaveLength(0);
  });

  it('offers nobody once you are already married', () => {
    const rng = createRng(29);
    const spouse = makePerson(rng, 'partner', 30, 100);
    const friend = makePerson(rng, 'friend', 30, 100);

    expect(marriageCandidates([spouse, friend])).toHaveLength(0);
  });
});

describe('relationships across a lifetime', () => {
  it('starts every new character with somebody', () => {
    expect(world().people.length).toBeGreaterThan(0);
  });

  it('keeps the roster inside its cap for a whole life', () => {
    const end = playUntilDeath(world());

    expect(end.people.length).toBeLessThanOrEqual(R.maxLivingPeople);
    expect(end.memories.length).toBeLessThanOrEqual(R.memoryLimit);
  });

  it('leaves a save small enough for localStorage after a full life', () => {
    // The whole reason the dead are compressed to one line each.
    const end = playUntilDeath(world());

    expect(JSON.stringify(end).length).toBeLessThan(100_000);
  });

  it('people really do come and go over seventy years', () => {
    const end = playUntilDeath(world());

    expect(end.memories.length).toBeGreaterThan(0);
  });

  it('socialising keeps people closer than ignoring them does', () => {
    const attentive = { ...world(), character: { ...world().character, focusId: 'socialize' } };
    const absent = { ...world(), character: { ...world().character, focusId: 'study' } };

    const closeness = (state: WorldState): number =>
      state.people.reduce((total, p) => total + p.closeness, 0);

    expect(closeness(advanceWeek(attentive))).toBeGreaterThan(closeness(advanceWeek(absent)));
  });

  it('a family costs money every week', () => {
    const rng = createRng(31);
    const alone = world();
    const withChild = {
      ...alone,
      people: [...alone.people, makePerson(rng, 'child', 2, 90)],
    };

    expect(advanceWeek(withChild).character.stats.money).toBeLessThan(
      advanceWeek(alone).character.stats.money,
    );
  });
});

describe('helpers', () => {
  it('reads an age in whole years', () => {
    expect(ageYearsOf({ ...makePerson(createRng(1), 'friend', 0, 0), ageDays: 800 })).toBe(2);
  });

  it('finds the partner and the children', () => {
    const rng = createRng(37);
    const people = [
      makePerson(rng, 'partner', 30, 90),
      makePerson(rng, 'child', 2, 90),
      makePerson(rng, 'child', 25, 90),
    ];

    expect(partnerOf(people)?.kind).toBe('partner');
    expect(childrenOf(people)).toHaveLength(2);
    expect(dependentChildren(people)).toHaveLength(1);
  });
});
