import { describe, expect, it } from 'vitest';

import {
  ageFactor,
  findSport,
  matchIsDue,
  matchStrength,
  meetsRequirements,
  playMatch,
  prizeFor,
  trainOneDay,
  winChance,
} from '../../src/core/careers/sports';
import { advanceWeek, DAYS_PER_WEEK } from '../../src/core/clock';
import { createWorld } from '../../src/core/character';
import { createRng } from '../../src/core/rng';
import { BALANCE } from '../../src/data/balance';
import { SPORTS } from '../../src/data/sports';
import type { CareerState, WorldState } from '../../src/core/types';

const running = findSport('running');
const football = findSport('football');

const strongAthlete = { intelligence: 12, physical: 80, charisma: 30 };

function competing(sportId: string, focusId: string, patch: Partial<Extract<CareerState, { type: 'sports' }>> = {}): WorldState {
  const world = createWorld({ name: 'Athlete', backgroundId: 'athlete', seed: 9 });
  const career: CareerState = {
    type: 'sports',
    sportId,
    skill: 40,
    reputation: 0,
    daysSinceMatch: 0,
    wins: 0,
    losses: 0,
    ...patch,
  };
  return { ...world, character: { ...world.character, career, focusId } };
}

describe('sports data', () => {
  it('has unique ids', () => {
    const ids = SPORTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('pays more where the opposition is harder', () => {
    const sorted = [...SPORTS].sort((a, b) => a.opponentSkill - b.opponentSkill);
    const prizes = sorted.map((s) => s.winPrize);

    expect(prizes).toEqual([...prizes].sort((a, b) => a - b));
  });

  it('always pays a win far better than a loss', () => {
    for (const sport of SPORTS) {
      expect(sport.winPrize, sport.id).toBeGreaterThan(sport.losePrize * 5);
    }
  });
});

describe('ageFactor', () => {
  it('leaves a young athlete untouched', () => {
    expect(ageFactor(20)).toBe(1);
    expect(ageFactor(BALANCE.sports.peakAgeYears)).toBe(1);
  });

  it('falls away after the peak', () => {
    const peak = BALANCE.sports.peakAgeYears;

    expect(ageFactor(peak + 5)).toBeLessThan(1);
    expect(ageFactor(peak + 10)).toBeLessThan(ageFactor(peak + 5));
  });

  it('stops at a floor: a veteran is worse, not absent', () => {
    expect(ageFactor(95)).toBe(BALANCE.sports.minAgeFactor);
    expect(ageFactor(95)).toBeGreaterThan(0);
  });
});

describe('matchStrength', () => {
  it('counts skill and the sport’s own attribute', () => {
    const weak = matchStrength(running, 40, { ...strongAthlete, physical: 20 }, 25);
    const strong = matchStrength(running, 40, strongAthlete, 25);

    expect(strong).toBeGreaterThan(weak);
  });

  it('is worth less once the athlete is past their peak', () => {
    const young = matchStrength(running, 40, strongAthlete, 25);
    const old = matchStrength(running, 40, strongAthlete, 60);

    expect(old).toBeLessThan(young);
  });
});

describe('winChance', () => {
  it('is a coin flip between equals', () => {
    expect(winChance(50, 50)).toBeCloseTo(0.5);
  });

  it('favours the stronger side without ever being certain', () => {
    expect(winChance(200, 10)).toBeGreaterThan(0.9);
    expect(winChance(200, 10)).toBeLessThan(1);
    expect(winChance(1, 500)).toBeGreaterThan(0);
  });
});

describe('prizeFor', () => {
  it('pays a win better than a loss', () => {
    expect(prizeFor(running, true, 0)).toBeGreaterThan(prizeFor(running, false, 0));
  });

  it('pays a known name more for the same result', () => {
    expect(prizeFor(running, true, 100)).toBeGreaterThan(prizeFor(running, true, 0));
  });
});

describe('trainOneDay', () => {
  it('raises skill', () => {
    const career: CareerState = {
      type: 'sports', sportId: 'running', skill: 10, reputation: 0, daysSinceMatch: 0, wins: 0, losses: 0,
    };

    expect((trainOneDay(career) as { skill: number }).skill).toBeGreaterThan(10);
  });

  it('stops at the ceiling, so training cannot run away forever', () => {
    const career: CareerState = {
      type: 'sports', sportId: 'running', skill: BALANCE.sports.maxSkill, reputation: 0, daysSinceMatch: 0, wins: 0, losses: 0,
    };

    expect((trainOneDay(career) as { skill: number }).skill).toBe(BALANCE.sports.maxSkill);
  });

  it('does nothing to someone who is not an athlete', () => {
    const career: CareerState = { type: 'job', jobId: 'cashier', tenureDays: 1, level: 0 };

    expect(trainOneDay(career)).toBe(career);
  });
});

describe('matchIsDue', () => {
  it('waits for the fixture to come round', () => {
    const base = { type: 'sports' as const, sportId: 'running', skill: 0, reputation: 0, wins: 0, losses: 0 };

    expect(matchIsDue({ ...base, daysSinceMatch: running.matchIntervalDays - 1 })).toBe(false);
    expect(matchIsDue({ ...base, daysSinceMatch: running.matchIntervalDays })).toBe(true);
  });

  it('is never due for someone with no sport', () => {
    expect(matchIsDue({ type: 'none' })).toBe(false);
  });
});

describe('playMatch', () => {
  const career: CareerState = {
    type: 'sports', sportId: 'running', skill: 60, reputation: 10, daysSinceMatch: 30, wins: 2, losses: 1,
  };

  it('records the result and resets the clock to the next fixture', () => {
    const result = playMatch(career, strongAthlete, 25, createRng(1));
    const after = result.career as Extract<CareerState, { type: 'sports' }>;

    expect(after.daysSinceMatch).toBe(0);
    expect(after.wins + after.losses).toBe(4);
    expect(result.prize).toBeGreaterThan(0);
    expect(result.text).toContain('Running');
  });

  it('moves reputation the right way and keeps it inside 0-100', () => {
    const hopeless: CareerState = { ...career, skill: 0, reputation: 0 };
    const star: CareerState = { ...career, skill: 100, reputation: 100 };

    const lost = playMatch(hopeless, { intelligence: 1, physical: 1, charisma: 1 }, 80, createRng(3));
    const won = playMatch(star, strongAthlete, 20, createRng(3));

    for (const outcome of [lost, won]) {
      const after = outcome.career as Extract<CareerState, { type: 'sports' }>;
      expect(after.reputation).toBeGreaterThanOrEqual(0);
      expect(after.reputation).toBeLessThanOrEqual(100);
    }
  });

  it('is reproducible from the same seed', () => {
    const a = playMatch(career, strongAthlete, 25, createRng(77));
    const b = playMatch(career, strongAthlete, 25, createRng(77));

    expect(a.won).toBe(b.won);
    expect(a.prize).toBe(b.prize);
  });

  it('a stronger athlete wins more often than a weaker one', () => {
    const count = (skill: number): number => {
      const rng = createRng(2024);
      let wins = 0;
      for (let i = 0; i < 400; i += 1) {
        if (playMatch({ ...career, skill }, strongAthlete, 25, rng).won) wins += 1;
      }
      return wins;
    };

    expect(count(100)).toBeGreaterThan(count(5));
  });
});

describe('meetsRequirements', () => {
  it('keeps the big sport shut until the athlete is good enough', () => {
    expect(meetsRequirements({ intelligence: 50, physical: 20, charisma: 50 }, football)).toBe(false);
    expect(meetsRequirements({ intelligence: 1, physical: 45, charisma: 30 }, football)).toBe(true);
  });
});

describe('an athlete inside a simulated week', () => {
  it('training raises skill and brings the fixture closer', () => {
    const after = advanceWeek(competing('running', 'train'));
    const career = after.character.career as Extract<CareerState, { type: 'sports' }>;

    expect(career.skill).toBeGreaterThan(40);
    expect(career.daysSinceMatch).toBeGreaterThan(0);
  });

  it('resting delays the fixture instead of wasting it', () => {
    const after = advanceWeek(competing('running', 'rest'));
    const career = after.character.career as Extract<CareerState, { type: 'sports' }>;

    expect(career.daysSinceMatch).toBe(0);
    expect(career.skill).toBe(40);
  });

  it('plays the fixture and pays out when it comes round', () => {
    const before = competing('running', 'train', {
      skill: 90,
      daysSinceMatch: running.matchIntervalDays - 1,
    });

    const after = advanceWeek(before);
    const career = after.character.career as Extract<CareerState, { type: 'sports' }>;

    expect(career.wins + career.losses).toBeGreaterThan(0);
    expect(after.eventLog.some((e) => e.text.includes('Running'))).toBe(true);
  });

  it('never plays more than one fixture in a week', () => {
    // The clock resets on every result, so a backlog cannot build up.
    const before = competing('running', 'train', { daysSinceMatch: 200 });

    const after = advanceWeek(before);
    const career = after.character.career as Extract<CareerState, { type: 'sports' }>;

    expect(career.wins + career.losses).toBe(1);
    expect(career.daysSinceMatch).toBeLessThan(DAYS_PER_WEEK);
  });
});
