import { describe, expect, it } from 'vitest';

import { dailyUpkeep, replacedBy, withPurchase } from '../../src/core/belongings';
import { createWorld } from '../../src/core/character';
import { advanceDay, advanceWeek } from '../../src/core/clock';
import { LIFESTYLES, findLifestyle } from '../../src/data/lifestyles';
import { POSSESSIONS, findPossession } from '../../src/data/possessions';
import type { Character, WorldState } from '../../src/core/types';

function world(patch: Partial<Character> = {}): WorldState {
  const base = createWorld({ name: 'Owner', backgroundId: 'scholarship', seed: 3 });
  return { ...base, character: { ...base.character, ...patch } };
}

describe('possession data', () => {
  it('has unique ids', () => {
    const ids = POSSESSIONS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never costs more to run than it is worth having', () => {
    // A possession that only drains is a trap, not a choice.
    for (const possession of POSSESSIONS) {
      const gives =
        (possession.perDay.energy ?? 0) +
        (possession.perDay.mood ?? 0) +
        (possession.perDay.health ?? 0) +
        (possession.restBonusPerDay ?? 0);
      expect(gives, possession.id).toBeGreaterThan(0);
    }
  });

  it('prices everything high enough to be worth saving for', () => {
    for (const possession of POSSESSIONS) {
      expect(possession.price, possession.id).toBeGreaterThan(1_000);
    }
  });
});

describe('lifestyle data', () => {
  it('leaves the ordinary life exactly as the game was before', () => {
    // Every balance figure pinned by the older tests assumes this.
    const ordinary = findLifestyle('ordinary');

    expect(ordinary.extraCostPerDay).toBe(0);
    expect(ordinary.perDay).toEqual({});
  });

  it('pays for what it costs: dearer living lifts mood', () => {
    const sorted = [...LIFESTYLES].sort((a, b) => a.extraCostPerDay - b.extraCostPerDay);
    const moods = sorted.map((l) => l.perDay.mood ?? 0);

    expect(moods).toEqual([...moods].sort((a, b) => a - b));
  });
});

describe('withPurchase', () => {
  it('adds a luxury without touching anything else', () => {
    expect(withPurchase(['bicycle'], 'record_player')).toEqual(['bicycle', 'record_player']);
  });

  it('replaces a home rather than collecting them', () => {
    const after = withPurchase(['flat', 'bicycle'], 'house');

    expect(after).toContain('house');
    expect(after).not.toContain('flat');
    expect(after).toContain('bicycle');
  });

  it('replaces a vehicle the same way', () => {
    expect(withPurchase(['bicycle'], 'car')).toEqual(['car']);
  });

  it('never lists the same thing twice', () => {
    expect(withPurchase(['bicycle'], 'bicycle')).toEqual(['bicycle']);
  });
});

describe('replacedBy', () => {
  it('names what a purchase would cost you', () => {
    expect(replacedBy(['flat'], 'house')?.id).toBe('flat');
  });

  it('says nothing when there is nothing to replace', () => {
    expect(replacedBy(['flat'], 'record_player')).toBeNull();
    expect(replacedBy([], 'house')).toBeNull();
  });
});

describe('dailyUpkeep', () => {
  it('is free and does nothing for someone who owns nothing and lives ordinarily', () => {
    const upkeep = dailyUpkeep(world().character);

    expect(upkeep.costPerDay).toBe(0);
    expect(upkeep.restBonusPerDay).toBe(0);
    expect(upkeep.perDay).toEqual({ energy: 0, mood: 0, health: 0 });
  });

  it('adds up everything owned', () => {
    const upkeep = dailyUpkeep(world({ owned: ['car', 'house'] }).character);
    const car = findPossession('car');
    const house = findPossession('house');

    expect(upkeep.costPerDay).toBe((car.upkeepPerDay ?? 0) + (house.upkeepPerDay ?? 0));
    expect(upkeep.restBonusPerDay).toBe(house.restBonusPerDay);
  });

  it('counts the lifestyle as well', () => {
    const luxurious = dailyUpkeep(world({ lifestyleId: 'luxurious' }).character);
    const frugal = dailyUpkeep(world({ lifestyleId: 'frugal' }).character);

    expect(luxurious.costPerDay).toBeGreaterThan(0);
    expect(frugal.costPerDay).toBeLessThan(0);
    expect(luxurious.perDay.mood!).toBeGreaterThan(frugal.perDay.mood!);
  });
});

describe('belongings inside a simulated week', () => {
  it('a better home makes resting worth more', () => {
    // One day, starting worn out: a whole week of rest pins energy at the
    // ceiling either way, and a ceiling hides the difference.
    const tired = { focusId: 'rest', stats: { money: 500, health: 70, energy: 10, mood: 50 } };
    const plain = advanceDay(world(tired));
    const housed = advanceDay(world({ ...tired, owned: ['house'] }));

    expect(housed.character.stats.energy).toBeGreaterThan(plain.character.stats.energy);
  });

  it('but only on the days they actually rest', () => {
    // The rest bonus is for sleeping, not for owning.
    const studying = advanceWeek(world({ focusId: 'study' }));
    const studyingAtHome = advanceWeek(world({ focusId: 'study', owned: ['flat'] }));
    const flat = findPossession('flat');

    const difference = studyingAtHome.character.stats.energy - studying.character.stats.energy;
    expect(difference).toBeLessThan((flat.restBonusPerDay ?? 0) * 7);
  });

  it('upkeep is charged every day, resting or not', () => {
    const plain = advanceWeek(world({ focusId: 'study' }));
    const withBoat = advanceWeek(world({ focusId: 'study', owned: ['boat'] }));

    expect(withBoat.character.stats.money).toBeLessThan(plain.character.stats.money);
  });

  it('a luxurious life costs money and lifts mood', () => {
    const ordinary = advanceWeek(world({ focusId: 'study' }));
    const luxurious = advanceWeek(world({ focusId: 'study', lifestyleId: 'luxurious' }));

    expect(luxurious.character.stats.money).toBeLessThan(ordinary.character.stats.money);
    expect(luxurious.character.stats.mood).toBeGreaterThan(ordinary.character.stats.mood);
  });

  it('a frugal life saves money and wears you down', () => {
    const ordinary = advanceWeek(world({ focusId: 'study' }));
    const frugal = advanceWeek(world({ focusId: 'study', lifestyleId: 'frugal' }));

    expect(frugal.character.stats.money).toBeGreaterThan(ordinary.character.stats.money);
    expect(frugal.character.stats.mood).toBeLessThan(ordinary.character.stats.mood);
  });
});
