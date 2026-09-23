import { BALANCE } from '../data/balance';
import type { EventLogEntry } from './types';

/** Newest first, trimmed so the save stays small. */
export function withLogEntry(log: EventLogEntry[], entry: EventLogEntry): EventLogEntry[] {
  return [entry, ...log].slice(0, BALANCE.eventLogLimit);
}

/** Milestones reach back decades, so they are trimmed far more slowly. */
export function withMilestone(log: EventLogEntry[], entry: EventLogEntry): EventLogEntry[] {
  return [entry, ...log].slice(0, BALANCE.milestoneLimit);
}
