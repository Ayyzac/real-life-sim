import type { Attributes } from '../core/types';

/**
 * Ordinary jobs - the career path that is always available (GDD §4.1).
 * Business and sports arrive in Phases 3 and 4 as their own data files.
 *
 * Adding a job = adding an entry here.
 */
export interface JobDefinition {
  id: string;
  title: string;
  /** Paid for each day the character's focus is Work. */
  salaryPerDay: number;
  /** Minimum attributes to be hired. Omitted attributes have no bar. */
  requirements: Partial<Attributes>;
  /** The attribute promotions are judged on. */
  promotionAttribute: keyof Attributes;
  /** Shown on the job board. */
  blurb: string;
}

export const JOBS: readonly JobDefinition[] = [
  {
    id: 'cashier',
    title: 'Cashier',
    salaryPerDay: 38,
    requirements: {},
    promotionAttribute: 'charisma',
    blurb: 'Anyone can start here. Most people do.',
  },
  {
    id: 'warehouse_hand',
    title: 'Warehouse Hand',
    salaryPerDay: 48,
    requirements: { physical: 25 },
    promotionAttribute: 'physical',
    blurb: 'Heavy work, honest pay.',
  },
  {
    id: 'office_clerk',
    title: 'Office Clerk',
    salaryPerDay: 62,
    requirements: { intelligence: 30 },
    promotionAttribute: 'intelligence',
    blurb: 'Quiet, steady, indoors.',
  },
  {
    id: 'sales_rep',
    title: 'Sales Rep',
    salaryPerDay: 78,
    requirements: { charisma: 35, intelligence: 20 },
    promotionAttribute: 'charisma',
    blurb: 'You are only as good as this quarter.',
  },
  {
    id: 'software_developer',
    title: 'Software Developer',
    salaryPerDay: 135,
    requirements: { intelligence: 60 },
    promotionAttribute: 'intelligence',
    blurb: 'Years of study, and it pays for itself.',
  },
];

export function findJob(id: string): JobDefinition {
  const job = JOBS.find((j) => j.id === id);
  if (!job) throw new Error(`Unknown job id: ${id}`);
  return job;
}
