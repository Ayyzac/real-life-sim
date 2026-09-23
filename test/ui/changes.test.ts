import { describe, expect, it } from 'vitest';

import { createWorld } from '../../src/core/character';
import type { WorldState } from '../../src/core/types';
import { changesBetween } from '../../src/ui/changes';

function world(): WorldState {
  return createWorld({ name: 'Report', backgroundId: 'scholarship', seed: 3 });
}

describe('what an advance changed (GDD §11.7)', () => {
  it('says nothing when no time passed', () => {
    const before = world();
    const after = { ...before, character: { ...before.character, focusId: 'socialize' } };
    expect(changesBetween(before, after)).toBeNull();
  });

  it('reports money, stats and closeness that moved', () => {
    const before = world();
    const friend = before.people[0]!;
    const after: WorldState = {
      ...before,
      clockDay: before.clockDay + 7,
      people: before.people.map((p) => (p.id === friend.id ? { ...p, closeness: p.closeness + 6 } : p)),
      character: {
        ...before.character,
        stats: { ...before.character.stats, money: before.character.stats.money - 84, energy: before.character.stats.energy - 35 },
      },
    };

    const report = changesBetween(before, after)!;

    expect(report.days).toBe(7);
    expect(report.changes).toContainEqual({ label: 'money', amount: -84, money: true });
    expect(report.changes).toContainEqual({ label: 'energy', amount: -35 });
    expect(report.changes).toContainEqual({ label: friend.name, amount: 6 });
  });

  it('names people who arrived and people who were lost', () => {
    const before = world();
    const [gone, ...rest] = before.people;
    const newcomer = { ...rest[0]!, id: 'new-person', name: 'Newcomer Lee' };
    const after: WorldState = { ...before, clockDay: before.clockDay + 1, people: [...rest, newcomer] };

    const report = changesBetween(before, after)!;

    expect(report.met).toEqual(['Newcomer Lee']);
    expect(report.lost).toEqual([gone!.name]);
  });

  it('does not compare two different lives', () => {
    const before = world();
    const after = { ...createWorld({ name: 'Other', backgroundId: 'scholarship', seed: 4 }), clockDay: 7 };
    expect(changesBetween(before, after)).toBeNull();
  });

  it('reports what something done within the day changed, needs included', () => {
    const before = world();
    const after: WorldState = {
      ...before,
      minuteOfDay: before.minuteOfDay + 15,
      character: {
        ...before.character,
        needs: { ...before.character.needs, thirst: before.character.needs.thirst + 35 },
      },
    };

    const report = changesBetween(before, after)!;

    expect(report.days).toBe(0);
    expect(report.minutes).toBe(15);
    expect(report.changes).toContainEqual({ label: 'thirst', amount: 35 });
  });
});
