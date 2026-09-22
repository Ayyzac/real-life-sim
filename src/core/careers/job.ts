import { BALANCE } from '../../data/balance';
import { findJob, JOBS, type JobDefinition } from '../../data/jobs';
import type { Attributes, CareerState } from '../types';

/**
 * Ordinary employment (GDD §4.1). Pure functions only - no React, no Phaser.
 * Called once per simulated day from src/core/clock.ts when the focus is Work.
 */

export function meetsRequirements(attributes: Attributes, job: JobDefinition): boolean {
  return (Object.entries(job.requirements) as [keyof Attributes, number][]).every(
    ([attribute, minimum]) => attributes[attribute] >= minimum,
  );
}

/** Jobs the character could be hired for right now. */
export function availableJobs(attributes: Attributes): JobDefinition[] {
  return JOBS.filter((job) => meetsRequirements(attributes, job));
}

/** Pay per day at this job and level, rounded to whole money. */
export function salaryPerDay(job: JobDefinition, level: number): number {
  return Math.round(job.salaryPerDay * (1 + level * BALANCE.promotion.salaryBonusPerLevel));
}

/** Attribute score needed to reach the given level at this job. */
export function promotionBar(job: JobDefinition, level: number): number {
  const entryBar = job.requirements[job.promotionAttribute] ?? 0;
  return entryBar + level * BALANCE.promotion.attributeBonusPerLevel;
}

export const MAX_JOB_LEVEL = BALANCE.promotion.tenureDaysRequired.length - 1;

/**
 * Whether the character has earned the next level: enough days served AND
 * enough of the attribute the job judges (GDD §4.1).
 */
export function isPromotionEarned(
  job: JobDefinition,
  level: number,
  tenureDays: number,
  attributes: Attributes,
): boolean {
  const nextLevel = level + 1;
  if (nextLevel > MAX_JOB_LEVEL) return false;

  const daysRequired = BALANCE.promotion.tenureDaysRequired[nextLevel];
  if (daysRequired === undefined || tenureDays < daysRequired) return false;

  return attributes[job.promotionAttribute] >= promotionBar(job, nextLevel);
}

export interface JobDayResult {
  career: CareerState;
  /** Money earned this day. */
  income: number;
  /** Set when the character was promoted today. */
  promotedTo?: { title: string; level: number };
}

/** One worked day: pay the wage, add tenure, check for promotion. */
export function workOneDay(career: CareerState, attributes: Attributes): JobDayResult {
  if (career.type !== 'job') return { career, income: 0 };

  const job = findJob(career.jobId);
  const income = salaryPerDay(job, career.level);
  const tenureDays = career.tenureDays + 1;

  if (isPromotionEarned(job, career.level, tenureDays, attributes)) {
    const level = career.level + 1;
    return {
      career: { ...career, tenureDays, level },
      income,
      promotedTo: { title: job.title, level },
    };
  }

  return { career: { ...career, tenureDays }, income };
}

export { JOBS, findJob };
export type { JobDefinition };
