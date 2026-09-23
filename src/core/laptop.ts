import { BALANCE } from '../data/balance';
import { findGig } from '../data/gigs';
import { findJob, type JobDefinition } from '../data/jobs';
import { meetsRequirements } from './careers/job';
import { freeUntil, passTime } from './day';
import { hashText } from './hash';
import type { Attributes, Email, WorldState } from './types';

/**
 * The laptop (GDD §12): job applications answered by email, emails to
 * people, and side work. Pure functions over WorldState.
 *
 * Whether an application succeeds is worked out from the life, the job and
 * the day - not the saved RNG - so applying cannot shift the dice for
 * anything else.
 */

const L = BALANCE.laptop;

function busy(state: WorldState): boolean {
  return state.deceased || state.pendingEvent !== null;
}

function clamp(value: number): number {
  return Math.min(BALANCE.statMax, Math.max(BALANCE.statMin, value));
}

/** Bought at the Mall, used at home (user decision, 23 Sep 2026). */
export function laptopBlocker(state: WorldState): string | null {
  if (busy(state)) return 'Not now';
  if (!state.character.owned.includes('laptop')) return 'You do not own a laptop';
  if (state.character.location !== 'home') return 'The laptop is at home';
  return null;
}

export function withEmail(inbox: readonly Email[], email: Omit<Email, 'id' | 'read'>): Email[] {
  const id = `${email.day}-${inbox.length}-${hashText(email.subject) % 1000}`;
  return [{ ...email, id, read: false }, ...inbox].slice(0, L.inboxLimit);
}

export function unread(inbox: readonly Email[]): number {
  return inbox.filter((email) => !email.read).length;
}

// --- applying for jobs -----------------------------------------------------

/** The better you clear the bar, the likelier the yes. */
export function hireChance(attributes: Attributes, job: JobDefinition): number {
  const margins = (Object.entries(job.requirements) as [keyof Attributes, number][]).map(
    ([attribute, minimum]) => attributes[attribute] - minimum,
  );
  const margin = margins.length > 0 ? Math.min(...margins) : L.noBarMargin;
  return Math.min(L.maxHireChance, Math.max(L.minHireChance, L.baseHireChance + margin * L.hireChancePerPoint));
}

export function applyBlocker(state: WorldState, jobId: string): string | null {
  const laptop = laptopBlocker(state);
  if (laptop) return laptop;
  const job = findJob(jobId);
  const career = state.character.career;
  if (career.type === 'business' || career.type === 'sports') return 'Give up your career first';
  if (career.type === 'job' && career.jobId === job.id) return 'Your job already';
  if (!meetsRequirements(state.character.attributes, job)) return 'Not qualified yet';
  if (state.applications.some((a) => a.jobId === job.id)) return 'Applied - wait for the email';
  if (state.applications.length >= L.maxApplications) return `${L.maxApplications} applications at a time`;
  return null;
}

export function applyForJob(state: WorldState, jobId: string): WorldState {
  if (applyBlocker(state, jobId) !== null) return state;
  return { ...state, applications: [...state.applications, { jobId, day: state.clockDay }] };
}

/**
 * Overnight, every application gets its answer by email (called from the
 * daily rules). A yes is an offer to accept within a few days.
 */
export function answerApplications(state: WorldState): Pick<WorldState, 'applications' | 'inbox'> {
  let inbox = state.inbox;
  for (const application of state.applications) {
    const job = findJob(application.jobId);
    const chance = hireChance(state.character.attributes, job);
    const yes = hashText(`hire:${state.character.id}:${job.id}:${application.day}`) % 100 < chance * 100;
    inbox = withEmail(
      inbox,
      yes
        ? {
            day: state.clockDay + 1,
            from: `Hiring, ${job.title}`,
            subject: `Offer: ${job.title}`,
            body: `We would like to offer you the ${job.title} position, starting whenever you are ready. The offer stands for ${L.offerDays} days.`,
            offer: { jobId: job.id, expires: state.clockDay + 1 + L.offerDays },
          }
        : {
            day: state.clockDay + 1,
            from: `Hiring, ${job.title}`,
            subject: `Your application: ${job.title}`,
            body: 'Thank you for applying. We have decided to go with another candidate this time.',
          },
    );
  }
  return { applications: [], inbox };
}

export function offerBlocker(state: WorldState, email: Email): string | null {
  if (busy(state)) return 'Not now';
  if (!email.offer) return 'Nothing to accept';
  if (state.clockDay > email.offer.expires) return 'The offer has expired';
  return null;
}

// --- emailing people ---------------------------------------------------------

export function emailBlocker(state: WorldState, personId: string): string | null {
  const laptop = laptopBlocker(state);
  if (laptop) return laptop;
  if (!state.people.some((p) => p.id === personId)) return 'No address';
  if (state.doneToday.includes(`email:${personId}`)) return 'Already wrote today';
  if (state.minuteOfDay + L.emailMinutes > freeUntil(state)) return 'Not enough time';
  return null;
}

/** A proper note to someone: less than a talk, more than nothing. */
export function emailPerson(state: WorldState, personId: string): WorldState {
  if (emailBlocker(state, personId) !== null) return state;
  const played = passTime(state, L.emailMinutes);
  return {
    ...played,
    doneToday: [...played.doneToday, `email:${personId}`],
    people: played.people.map((p) => (p.id === personId ? { ...p, closeness: clamp(p.closeness + L.emailCloseness) } : p)),
  };
}

// --- side work -----------------------------------------------------------------

export function gigsToday(state: WorldState): number {
  return state.doneToday.filter((entry) => entry === 'gig').length;
}

/** What a gig pays for a score between 0 and 1. */
export function gigPay(state: WorldState, gigId: string, score: number): number {
  const gig = findGig(gigId);
  const clamped = Math.min(1, Math.max(0, Number.isFinite(score) ? score : 0));
  return Math.round(gig.basePay * clamped * (1 + state.character.attributes[gig.attribute] / 100));
}

export function gigBlocker(state: WorldState): string | null {
  const laptop = laptopBlocker(state);
  if (laptop) return laptop;
  if (gigsToday(state) >= L.gigsPerDay) return `${L.gigsPerDay} gigs a day is plenty`;
  if (state.character.stats.energy < L.gigEnergyNeeded) return 'Too tired';
  if (state.minuteOfDay + L.gigMinutes > freeUntil(state)) return 'Not enough time';
  return null;
}

export function doGig(state: WorldState, gigId: string, score: number): WorldState {
  if (gigBlocker(state) !== null) return state;
  const pay = gigPay(state, gigId, score);
  const played = passTime(state, L.gigMinutes);
  const stats = played.character.stats;
  return {
    ...played,
    doneToday: [...played.doneToday, 'gig'],
    character: {
      ...played.character,
      stats: { ...stats, money: stats.money + pay, energy: clamp(stats.energy + L.gigEnergy) },
    },
  };
}

