import { BALANCE } from '../data/balance';
import { LINES, OPENERS, TRAITS, type Opener, type ReplyStyle, type Trait, type Verdict } from '../data/dialogue';
import { LOCATIONS } from '../data/locations';
import { closedReason, freeUntil, passTime } from './day';
import { hashText } from './hash';
import { withLogEntry, withMilestone } from './log';
import { ageYearsOf, makePerson } from './relationships';
import { restoreRng } from './rng';
import { whereIs, whoIsHere } from './schedule';
import type { LocationId, Person, WorldState } from './types';

/**
 * Talking to people, dating, going out, and saying hello to strangers
 * (GDD §11.6). Pure functions over WorldState.
 *
 * What people say is written in advance (src/data/dialogue.ts) and picked by
 * hash, never generated and never drawn from the saved RNG. Only a stranger's
 * answer to a hello is a real dice roll: it is the player's own action, the
 * same as any event, so it may spend the RNG.
 */

const R = BALANCE.relationships;
const T = R.talk;

function clamp(value: number): number {
  return Math.min(BALANCE.statMax, Math.max(BALANCE.statMin, value));
}

function busy(state: WorldState): boolean {
  return state.deceased || state.pendingEvent !== null;
}

export function firstName(person: Pick<Person, 'name'>): string {
  return person.name.split(' ')[0] ?? person.name;
}

/** Their nature, fixed for life, from their id. */
export function traitOf(person: Pick<Person, 'id'>): Trait {
  return TRAITS[hashText(`trait:${person.id}`) % TRAITS.length]!;
}

/** Worked out yet? Until then the game shows "???". */
export function traitKnown(person: Person): boolean {
  return (person.traitHints ?? 0) >= T.revealAfter;
}

export function verdictFor(person: Person, style: ReplyStyle): Verdict {
  return traitOf(person).likes[style];
}

function timeOfDay(minute: number): 'morning' | 'afternoon' | 'evening' {
  if (minute < 12 * 60) return 'morning';
  if (minute < 17 * 60) return 'afternoon';
  return 'evening';
}

/** What they say first today. The same all day, so the dialog is stable. */
export function openerFor(state: WorldState, person: Person): Opener {
  const young = person.kind === 'child' && ageYearsOf(person) < 13;
  const tod = timeOfDay(state.minuteOfDay);
  const fits = OPENERS.filter(
    (o) =>
      (o.young ?? false) === young &&
      (!o.kinds || o.kinds.includes(person.kind)) &&
      (o.minCloseness === undefined || person.closeness >= o.minCloseness) &&
      (o.maxCloseness === undefined || person.closeness <= o.maxCloseness) &&
      (!o.when || o.when === tod) &&
      (!o.job || person.job !== null),
  );
  const pool = fits.length > 0 ? fits : OPENERS.filter((o) => !o.young && !o.kinds);
  return pool[hashText(`${person.id}:${state.clockDay}`) % pool.length]!;
}

/** Fills the placeholders in a line of dialogue. */
export function fillLine(text: string, person: Person, state: WorldState): string {
  const place = LOCATIONS.find((l) => l.id === state.character.location)?.label ?? 'here';
  return text
    .replaceAll('{name}', firstName(person))
    .replaceAll('{full}', person.name)
    .replaceAll('{job}', person.job ?? 'nothing in particular')
    .replaceAll('{place}', place)
    .replaceAll('{time}', timeOfDay(state.minuteOfDay));
}

/** Charisma helps; being unwashed does not (GDD §11.2). */
function warmth(state: WorldState): number {
  const charm = 0.75 + state.character.attributes.charisma / 200;
  return state.character.needs.hygiene < BALANCE.day.lowNeed ? charm / 2 : charm;
}

function fitsInDay(state: WorldState, minutes: number): boolean {
  return state.minuteOfDay + minutes <= freeUntil(state);
}

function withPerson(state: WorldState, id: string, change: (person: Person) => Person): Person[] {
  return state.people.map((p) => (p.id === id ? change(p) : p));
}

// --- talking -------------------------------------------------------------

/** Why they cannot be talked to right now, or null. */
export function talkBlocker(state: WorldState, person: Person): string | null {
  if (busy(state)) return 'Not now';
  if (!whoIsHere(state, state.character.location).some((p) => p.id === person.id)) {
    return `${firstName(person)} is not here`;
  }
  if (state.doneToday.includes(`talk:${person.id}`)) return 'Already talked today';
  if (!fitsInDay(state, T.minutes)) return 'Not enough time';
  return null;
}

export function talk(state: WorldState, personId: string, style: ReplyStyle): WorldState {
  const person = state.people.find((p) => p.id === personId);
  if (!person || talkBlocker(state, person) !== null) return state;

  const verdict = verdictFor(person, style);
  const raw = T[verdict];
  const change = raw > 0 ? raw * warmth(state) : raw;
  const played = passTime(state, T.minutes);

  return {
    ...played,
    doneToday: [...played.doneToday, `talk:${person.id}`],
    people: withPerson(played, person.id, (p) => ({
      ...p,
      closeness: clamp(p.closeness + change),
      traitHints: (p.traitHints ?? 0) + (verdict === 'good' ? 1 : 0),
    })),
    character: {
      ...played.character,
      stats: {
        ...played.character.stats,
        mood: clamp(played.character.stats.mood + (verdict === 'bad' ? 0 : T.mood)),
      },
    },
  };
}

// --- dating --------------------------------------------------------------

/** Already seeing someone, or married: one at a time (GDD §11.6). */
function taken(people: readonly Person[]): boolean {
  return people.some((p) => p.kind === 'dating' || p.kind === 'partner');
}

export function canAskOut(state: WorldState, person: Person): boolean {
  return (
    !busy(state) &&
    (person.kind === 'friend' || person.kind === 'colleague') &&
    person.closeness >= R.askOutCloseness &&
    ageYearsOf(person) >= R.marriageMinAgeYears &&
    !taken(state.people) &&
    !state.doneToday.includes(`ask:${person.id}`) &&
    whoIsHere(state, state.character.location).some((p) => p.id === person.id) &&
    fitsInDay(state, 10)
  );
}

/** Whether they would say yes: closeness, nudged by their nature. */
export function wouldSayYes(person: Person): boolean {
  const trait = traitOf(person).id;
  const nudge = trait === 'romantic' ? 10 : trait === 'serious' ? -5 : 0;
  return person.closeness + nudge >= R.acceptCloseness;
}

export function askOut(state: WorldState, personId: string): WorldState {
  const person = state.people.find((p) => p.id === personId);
  if (!person || !canAskOut(state, person)) return state;

  const played = { ...passTime(state, 10), doneToday: [...state.doneToday, `ask:${person.id}`] };
  const stats = played.character.stats;

  if (wouldSayYes(person)) {
    const entry = { day: state.clockDay, tone: 'good' as const, text: `Started seeing ${person.name}.` };
    return {
      ...played,
      eventLog: withLogEntry(played.eventLog, entry),
      milestones: withMilestone(played.milestones, entry),
      people: withPerson(played, person.id, (p) => ({ ...p, kind: 'dating' })),
      character: { ...played.character, stats: { ...stats, mood: clamp(stats.mood + 5) } },
    };
  }

  return {
    ...played,
    eventLog: withLogEntry(played.eventLog, {
      day: state.clockDay,
      tone: 'bad',
      text: fillLine(LINES.askOutNo, person, state),
    }),
    people: withPerson(played, person.id, (p) => ({ ...p, closeness: clamp(p.closeness - 5) })),
    character: { ...played.character, stats: { ...stats, mood: clamp(stats.mood - 3) } },
  };
}

// --- going out -----------------------------------------------------------

export type Outing = 'dinner' | 'film';

export const OUTINGS: Record<Outing, { label: string; place: LocationId; verb: string }> = {
  dinner: { label: 'Dinner at the Cafe', place: 'cafe', verb: 'Had dinner with' },
  film: { label: 'A film at the Mall', place: 'mall', verb: 'Saw a film with' },
};

/** Why this outing cannot happen now, or null. The phone works from anywhere. */
export function inviteBlocker(state: WorldState, person: Person, outing: Outing): string | null {
  if (busy(state)) return 'Not now';
  if (state.doneToday.includes(`invite:${person.id}`)) return 'Already asked today';
  if (person.kind === 'child' && ageYearsOf(person) < 13) return 'Too young to go out';
  const place = OUTINGS[outing].place;
  const closed = closedReason(place, state.minuteOfDay);
  if (closed) return closed;
  const closes = LOCATIONS.find((l) => l.id === place)?.closes ?? BALANCE.day.latest;
  if (state.minuteOfDay + R.invite.minutes > closes) return 'Closes too soon';
  if (!fitsInDay(state, R.invite.minutes)) return 'Not enough time';
  if (state.character.stats.money < R.invite.cost) return 'Cannot afford';
  return null;
}

/** What they will say: yes, busy at work, or not close enough yet. */
export function inviteOutcome(state: WorldState, person: Person): 'yes' | 'busy' | 'no' {
  if (person.closeness < R.invite.minCloseness) return 'no';
  if (whereIs(person, state.clockDay, state.minuteOfDay) === 'work') return 'busy';
  return 'yes';
}

/** How long the call and whatever follows takes: a quick no, or the outing. */
export function inviteMinutes(state: WorldState, person: Person): number {
  return inviteOutcome(state, person) === 'yes' ? R.invite.minutes : 5;
}

export function invite(state: WorldState, personId: string, outing: Outing): WorldState {
  const person = state.people.find((p) => p.id === personId);
  if (!person || inviteBlocker(state, person, outing) !== null) return state;

  const asked = { ...state, doneToday: [...state.doneToday, `invite:${person.id}`] };
  const declined = (line: string): WorldState => ({
    ...passTime(asked, 5),
    eventLog: withLogEntry(asked.eventLog, { day: state.clockDay, tone: 'neutral', text: fillLine(line, person, state) }),
  });
  const answer = inviteOutcome(state, person);
  if (answer === 'no') return declined(LINES.inviteNo);
  if (answer === 'busy') return declined(LINES.inviteBusy);

  const trip = OUTINGS[outing];
  const played = passTime(asked, R.invite.minutes);
  const stats = played.character.stats;
  return {
    ...played,
    eventLog: withLogEntry(played.eventLog, { day: state.clockDay, tone: 'good', text: `${trip.verb} ${person.name}.` }),
    people: withPerson(played, person.id, (p) => ({
      ...p,
      closeness: clamp(p.closeness + R.invite.closeness * warmth(state)),
    })),
    character: {
      ...played.character,
      location: trip.place,
      stats: { ...stats, money: stats.money - R.invite.cost, mood: clamp(stats.mood + R.invite.mood) },
    },
  };
}

// --- strangers -----------------------------------------------------------

export function greetsToday(state: WorldState): number {
  return state.doneToday.filter((entry) => entry === 'greet').length;
}

export function greetBlocker(state: WorldState): string | null {
  if (busy(state)) return 'Not now';
  if (greetsToday(state) >= R.greet.perDay) return 'Enough hellos for one day';
  if (!fitsInDay(state, R.greet.minutes)) return 'Not enough time';
  return null;
}

/** The chance a hello turns into someone you know. */
export function greetChance(state: WorldState): number {
  const g = R.greet;
  const chance = Math.min(g.maxChance, g.baseChance + state.character.attributes.charisma * g.charismaPerPoint);
  return state.character.needs.hygiene < BALANCE.day.lowNeed ? chance / 2 : chance;
}

/**
 * Says hello to someone walking past (GDD §11.6). If it goes well they join
 * the people you know, wearing the face you saw.
 */
export function greetStranger(state: WorldState, look: number): WorldState {
  if (greetBlocker(state) !== null) return state;

  const rng = restoreRng(state.rng);
  const hit = rng.chance(greetChance(state));
  const played = { ...passTime(state, R.greet.minutes), doneToday: [...state.doneToday, 'greet'] };
  const log = (text: string, tone: 'good' | 'neutral'): WorldState['eventLog'] =>
    withLogEntry(played.eventLog, { day: state.clockDay, tone, text });

  if (!hit) return { ...played, rng: rng.snapshot(), eventLog: log(LINES.greetMissed, 'neutral') };

  const stranger = { ...makePerson(rng, 'friend', rng.int(19, 55), R.greet.closeness), look };
  if (state.people.length >= R.maxLivingPeople) {
    return { ...played, rng: rng.snapshot(), eventLog: log(fillLine(LINES.greetFull, stranger, state), 'neutral') };
  }
  const stats = played.character.stats;
  return {
    ...played,
    rng: rng.snapshot(),
    people: [...played.people, stranger],
    eventLog: log(fillLine(LINES.greetMet, stranger, state), 'good'),
    character: { ...played.character, stats: { ...stats, mood: clamp(stats.mood + 2) } },
  };
}
