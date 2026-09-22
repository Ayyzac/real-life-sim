import { describe, expect, it } from 'vitest';

import {
  availableJobs,
  isPromotionEarned,
  MAX_JOB_LEVEL,
  meetsRequirements,
  salaryPerDay,
  workOneDay,
} from '../../src/core/careers/job';
import { findJob } from '../../src/data/jobs';
import type { Attributes, CareerState } from '../../src/core/types';

const weak: Attributes = { intelligence: 10, physical: 10, charisma: 10 };
const bright: Attributes = { intelligence: 70, physical: 10, charisma: 10 };

describe('meetsRequirements', () => {
  it('lets anyone take a job with no requirements', () => {
    expect(meetsRequirements(weak, findJob('cashier'))).toBe(true);
  });

  it('rejects a character below the bar', () => {
    expect(meetsRequirements(weak, findJob('software_developer'))).toBe(false);
  });

  it('accepts exactly at the bar, not just above it', () => {
    const exactly: Attributes = { ...weak, intelligence: 30 };
    expect(meetsRequirements(exactly, findJob('office_clerk'))).toBe(true);
  });

  it('requires EVERY listed attribute, not just one', () => {
    // Sales Rep needs charisma 35 AND intelligence 20.
    const charmingButSlow: Attributes = { intelligence: 10, physical: 10, charisma: 90 };
    expect(meetsRequirements(charmingButSlow, findJob('sales_rep'))).toBe(false);
  });
});

describe('availableJobs', () => {
  it('offers only what the character qualifies for', () => {
    expect(availableJobs(weak).map((j) => j.id)).toEqual(['cashier']);
    expect(availableJobs(bright).map((j) => j.id)).toContain('software_developer');
  });
});

describe('salaryPerDay', () => {
  it('pays the base rate at level 0', () => {
    expect(salaryPerDay(findJob('cashier'), 0)).toBe(38);
  });

  it('adds 25% per level', () => {
    expect(salaryPerDay(findJob('cashier'), 2)).toBe(Math.round(38 * 1.5));
  });
});

describe('workOneDay', () => {
  const employed: CareerState = { type: 'job', jobId: 'cashier', tenureDays: 0, level: 0 };

  it('pays the wage and adds a day of tenure', () => {
    const result = workOneDay(employed, weak);

    expect(result.income).toBe(38);
    expect(result.career).toEqual({ ...employed, tenureDays: 1 });
    expect(result.promotedTo).toBeUndefined();
  });

  it('pays nothing when the character has no job', () => {
    const result = workOneDay({ type: 'none' }, weak);

    expect(result.income).toBe(0);
    expect(result.career).toEqual({ type: 'none' });
  });

  it('promotes once both tenure and the attribute are earned', () => {
    const readyCareer: CareerState = {
      type: 'job',
      jobId: 'cashier',
      tenureDays: 179,
      level: 0,
    };
    const charming: Attributes = { ...weak, charisma: 40 };

    const result = workOneDay(readyCareer, charming);

    expect(result.promotedTo).toEqual({ title: 'Cashier', level: 1 });
    expect(result.career).toMatchObject({ level: 1, tenureDays: 180 });
  });

  it('withholds promotion when only the tenure is there', () => {
    const readyCareer: CareerState = {
      type: 'job',
      jobId: 'cashier',
      tenureDays: 179,
      level: 0,
    };

    // Cashier has no entry bar, so level 1 needs charisma 10. This is 5.
    const result = workOneDay(readyCareer, { ...weak, charisma: 5 });

    expect(result.promotedTo).toBeUndefined();
    expect(result.career).toMatchObject({ level: 0 });
  });
});

describe('isPromotionEarned', () => {
  it('never promotes past the top level', () => {
    const maxed: Attributes = { intelligence: 100, physical: 100, charisma: 100 };
    expect(isPromotionEarned(findJob('cashier'), MAX_JOB_LEVEL, 99999, maxed)).toBe(false);
  });
});
