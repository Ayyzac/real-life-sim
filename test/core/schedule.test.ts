import { describe, expect, it } from 'vitest';

import { createWorld } from '../../src/core/character';
import { makePerson } from '../../src/core/relationships';
import { createRng } from '../../src/core/rng';
import { whereIs, whoIsHere } from '../../src/core/schedule';
import type { Person, RelationKind } from '../../src/core/types';

function person(kind: RelationKind, id = `p-${kind}`): Person {
  return { ...makePerson(createRng(1), kind, 30, 50), id };
}

describe('where people are (GDD §11.4)', () => {
  it('puts the same person in the same place at the same moment, every time', () => {
    const friend = person('friend');
    for (let day = 0; day < 30; day += 1) {
      expect(whereIs(friend, day, 19 * 60)).toBe(whereIs(friend, day, 19 * 60));
    }
  });

  it('keeps a partner at home in the evening', () => {
    expect(whereIs(person('partner'), 2, 20 * 60)).toBe('home');
  });

  it('has colleagues at work on weekdays, and never at the weekend', () => {
    const colleague = person('colleague');
    expect(whereIs(colleague, 1, 11 * 60)).toBe('work');
    expect(whereIs(colleague, 5, 11 * 60)).toBeNull();
  });

  it('never puts anyone in a place that is shut', () => {
    for (let n = 0; n < 60; n += 1) {
      const friend = person('friend', `friend-${n}`);
      expect(whereIs(friend, n, 23 * 60)).not.toBe('cafe');
    }
  });

  it('sends friends out some evenings, not all of them', () => {
    const friend = person('friend');
    const evenings = Array.from({ length: 60 }, (_, day) => whereIs(friend, day, 19 * 60));
    expect(evenings.some((place) => place !== null)).toBe(true);
    expect(evenings.some((place) => place === null)).toBe(true);
  });

  it('lists who is at a place from the world itself', () => {
    const base = createWorld({ name: 'Host', backgroundId: 'scholarship', seed: 7 });
    const partner = person('partner');
    const world = { ...base, minuteOfDay: 20 * 60, people: [partner] };
    expect(whoIsHere(world, 'home').map((p) => p.id)).toEqual([partner.id]);
  });
});
