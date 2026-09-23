import { describe, expect, it } from 'vitest';

import {
  MAX_BUSINESS_LEVEL,
  findBusiness,
  meetsRequirements,
  profitPerDay,
  revenuePerDay,
  tradeOneDay,
  upgradeCost,
} from '../../src/core/careers/business';
import { advanceWeek, DAYS_PER_WEEK } from '../../src/core/clock';
import { createWorld } from '../../src/core/character';
import { BUSINESSES } from '../../src/data/businesses';
import type { CareerState, WorldState } from '../../src/core/types';

const stall = findBusiness('market_stall');
const workshop = findBusiness('repair_workshop');

function owning(businessId: string, focusId: string, level = 0): WorldState {
  const world = createWorld({ name: 'Owner', backgroundId: 'family_business', seed: 11 });
  const career: CareerState = { type: 'business', businessId, daysOpen: 0, level };
  return { ...world, character: { ...world.character, career, focusId } };
}

describe('business data', () => {
  it('has unique ids', () => {
    const ids = BUSINESSES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never offers a business that a cheaper one beats at everything', () => {
    // Raw takings are the wrong measure once businesses differ in how much
    // survives neglect: the laundrette is dear because it runs itself, not
    // because it out-earns a workshop. What must hold is that paying more
    // buys you an advantage SOMEWHERE, or nobody would ever buy it.
    for (const dear of BUSINESSES) {
      for (const cheap of BUSINESSES) {
        if (cheap.startupCost >= dear.startupCost) continue;

        const betterMinded =
          profitPerDay(dear, 0, true) > profitPerDay(cheap, 0, true);
        const betterAlone =
          profitPerDay(dear, 0, false) > profitPerDay(cheap, 0, false);

        expect(
          betterMinded || betterAlone,
          `${dear.id} costs more than ${cheap.id} but is worse at both`,
        ).toBe(true);
      }
    }
  });

  it('is worth running: every business pays while minded', () => {
    for (const business of BUSINESSES) {
      expect(profitPerDay(business, 0, true), business.id).toBeGreaterThan(0);
    }
  });
});

describe('profitPerDay', () => {
  it('pays more when the owner is there', () => {
    expect(profitPerDay(stall, 0, true)).toBeGreaterThan(profitPerDay(stall, 0, false));
  });

  it('charges the running costs either way', () => {
    // Takings shrink when ignored; costs do not. That is the whole mechanic.
    const attended = profitPerDay(stall, 0, true);
    const ignored = profitPerDay(stall, 0, false);

    expect(attended).toBeCloseTo(stall.revenuePerDay - stall.costPerDay);
    expect(ignored).toBeCloseTo(stall.revenuePerDay * stall.neglectedShare - stall.costPerDay);
  });

  it('lets an expensive business lose money when it is ignored', () => {
    // The point of the workshop: real rent. Walking away from it costs money.
    expect(profitPerDay(workshop, 0, false)).toBeLessThan(0);
    expect(profitPerDay(workshop, 0, true)).toBeGreaterThan(0);
  });

  it('earns more at higher levels', () => {
    expect(revenuePerDay(stall, 1)).toBeGreaterThan(revenuePerDay(stall, 0));
    expect(profitPerDay(stall, 2, true)).toBeGreaterThan(profitPerDay(stall, 1, true));
  });
});

describe('upgradeCost', () => {
  it('gets more expensive each level', () => {
    const costs = Array.from({ length: MAX_BUSINESS_LEVEL }, (_, i) => upgradeCost(i));

    expect(costs.every((c) => c !== null)).toBe(true);
    for (let i = 1; i < costs.length; i += 1) {
      expect(costs[i]!).toBeGreaterThan(costs[i - 1]!);
    }
  });

  it('runs out at the top level, so money cannot buy unlimited income', () => {
    expect(upgradeCost(MAX_BUSINESS_LEVEL)).toBeNull();
  });
});

describe('tradeOneDay', () => {
  it('counts the days it has been open', () => {
    const career: CareerState = { type: 'business', businessId: stall.id, daysOpen: 4, level: 0 };

    const result = tradeOneDay(career, true);

    expect(result.career).toEqual({ ...career, daysOpen: 5 });
  });

  it('does nothing to a character who has no business', () => {
    const career: CareerState = { type: 'job', jobId: 'cashier', tenureDays: 3, level: 0 };

    const result = tradeOneDay(career, true);

    expect(result).toEqual({ career, profit: 0 });
  });
});

describe('meetsRequirements', () => {
  it('keeps a business locked until the attribute is there', () => {
    const weak = { intelligence: 10, physical: 10, charisma: 10 };
    const strong = { intelligence: 10, physical: 40, charisma: 10 };

    expect(meetsRequirements(weak, workshop)).toBe(false);
    expect(meetsRequirements(strong, workshop)).toBe(true);
  });
});

describe('a business inside a simulated week', () => {
  it('earns money even while the character is doing something else', () => {
    const before = owning(stall.id, 'study');

    const after = advanceWeek(before);

    // Study costs money on its own, so compare against the same week with no
    // business rather than against the starting balance.
    const noBusiness = advanceWeek({
      ...before,
      character: { ...before.character, career: { type: 'none' } },
    });
    expect(after.character.stats.money).toBeGreaterThan(noBusiness.character.stats.money);
  });

  it('earns more when the character minds the shop', () => {
    const minded = advanceWeek(owning(stall.id, 'mind_business'));
    const ignored = advanceWeek(owning(stall.id, 'study'));

    expect(minded.character.stats.money).toBeGreaterThan(ignored.character.stats.money);
  });

  it('drains money from an expensive business nobody is running', () => {
    const before = owning(workshop.id, 'rest');

    const after = advanceWeek(before);
    const noBusiness = advanceWeek({
      ...before,
      character: { ...before.character, career: { type: 'none' } },
    });

    expect(after.character.stats.money).toBeLessThan(noBusiness.character.stats.money);
  });

  it('keeps counting the weeks it has been open', () => {
    const after = advanceWeek(owning(stall.id, 'mind_business'));

    expect(after.character.career).toMatchObject({ type: 'business', daysOpen: DAYS_PER_WEEK });
  });
});
