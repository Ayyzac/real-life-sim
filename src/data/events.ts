import { ageInYears } from '../core/character';
import type { Character, EventEffect, EventLogEntry } from '../core/types';

/**
 * Life events (GDD §2 step 4, ARCHITECTURE §3).
 *
 * Adding an event = adding an entry here. EventEngine reads this list and
 * needs no changes. `eligibility` is a plain function: these definitions are
 * CODE, never saved state, so functions are fine here - only WorldState has to
 * stay JSON-serialisable.
 *
 * Events with `choices` stop the week and wait for the player. Events without
 * apply immediately and are only reported.
 */

export interface EventChoice {
  id: string;
  label: string;
  /** Shown under the label so the player can weigh it up. */
  detail: string;
  effect: EventEffect;
  /** Line written to the log after picking this. */
  outcome: string;
  tone: EventLogEntry['tone'];
}

export interface LifeEvent {
  id: string;
  title: string;
  /** What happened, in plain language. */
  text: string;
  /** Relative likelihood among all eligible events. */
  weight: number;
  /** Who this can happen to. Omitted means anyone. */
  eligibility?: (character: Character) => boolean;
  /** Applied immediately when there are no choices. */
  effect?: EventEffect;
  /** When present, the week stops and the player decides. */
  choices?: EventChoice[];
  tone: EventLogEntry['tone'];
  /** Worth remembering in the Life Summary decades later. */
  milestone?: boolean;
}

const hasJob = (c: Character): boolean => c.career.type === 'job';

export const EVENTS: readonly LifeEvent[] = [
  // ---------- everyday, no decision needed ----------
  {
    id: 'common_cold',
    title: 'A bad cold',
    text: 'You spend the week under a blanket feeling sorry for yourself.',
    weight: 14,
    effect: { health: -6, energy: -12, mood: -4 },
    tone: 'bad',
  },
  {
    id: 'good_sleep',
    title: 'A genuinely good night',
    text: 'You sleep like a stone and wake up human again.',
    weight: 12,
    effect: { energy: 18, mood: 5 },
    tone: 'good',
  },
  {
    id: 'found_money',
    title: 'Money in an old coat',
    text: 'A folded note in a pocket you had forgotten about.',
    weight: 7,
    effect: { money: 90, mood: 4 },
    tone: 'good',
  },
  {
    id: 'lost_wallet',
    title: 'Your wallet is gone',
    text: 'You retrace your steps twice. It does not turn up.',
    weight: 7,
    effect: { money: -140, mood: -8 },
    tone: 'bad',
  },
  {
    id: 'work_bonus',
    title: 'A bonus lands',
    text: 'Someone upstairs noticed you did more than you had to.',
    weight: 8,
    eligibility: hasJob,
    effect: { money: 320, mood: 10 },
    tone: 'good',
    milestone: true,
  },
  {
    id: 'burnout',
    title: 'You have nothing left',
    text: 'Running yourself into the ground finally catches up with you.',
    weight: 12,
    eligibility: (c) => c.stats.energy < 25,
    effect: { mood: -14, health: -7 },
    tone: 'bad',
  },
  {
    id: 'aching_joints',
    title: 'Your body is keeping score',
    text: 'Things that never used to hurt now hurt in the morning.',
    weight: 10,
    eligibility: (c) => ageInYears(c) >= 55,
    effect: { health: -5, mood: -3 },
    tone: 'bad',
  },
  {
    id: 'quiet_contentment',
    title: 'An ordinary good week',
    text: 'Nothing happens, and it turns out that is exactly what you needed.',
    weight: 9,
    effect: { mood: 8 },
    tone: 'neutral',
  },

  // ---------- decisions ----------
  {
    id: 'friend_invites',
    title: 'A friend calls you out',
    text: 'They are in town for one night only and want to see you.',
    weight: 12,
    tone: 'neutral',
    choices: [
      {
        id: 'go',
        label: 'Go out',
        detail: 'Costs money and a night of sleep.',
        effect: { money: -90, mood: 20, energy: -12, charisma: 0.3 },
        outcome: 'You went out with a friend. Worth it.',
        tone: 'good',
      },
      {
        id: 'stay',
        label: 'Stay in',
        detail: 'Keeps your money and your energy.',
        effect: { mood: -6, energy: 6 },
        outcome: 'You stayed in. It was the sensible call.',
        tone: 'neutral',
      },
    ],
  },
  {
    id: 'serious_illness',
    title: 'This is more than a cold',
    text: 'It has not gone away on its own, and it is getting worse.',
    weight: 11,
    eligibility: (c) => c.stats.health < 65,
    milestone: true,
    tone: 'bad',
    choices: [
      {
        id: 'treat',
        label: 'Pay for proper treatment',
        detail: 'Expensive, but it works.',
        effect: { money: -650, health: 22, energy: -6 },
        outcome: 'You paid for treatment and recovered.',
        tone: 'good',
      },
      {
        id: 'tough_it_out',
        label: 'Tough it out',
        detail: 'Costs nothing now. Costs you later.',
        effect: { health: -14, mood: -10 },
        outcome: 'You toughed out a real illness. Your body remembers.',
        tone: 'bad',
      },
    ],
  },
  {
    id: 'car_trouble',
    title: 'The car will not start',
    text: 'The mechanic sucks air through his teeth before he says a number.',
    weight: 9,
    tone: 'neutral',
    choices: [
      {
        id: 'repair',
        label: 'Pay for the repair',
        detail: 'Painful, but done with.',
        effect: { money: -380, mood: -5 },
        outcome: 'You paid to fix the car.',
        tone: 'neutral',
      },
      {
        id: 'walk',
        label: 'Do without it',
        detail: 'Free, but everything takes longer.',
        effect: { energy: -14, mood: -9 },
        outcome: 'You went without a car for a while.',
        tone: 'neutral',
      },
    ],
  },
  {
    id: 'training_course',
    title: 'A course comes up',
    text: 'A short evening course. It is not cheap and it is not easy.',
    weight: 9,
    eligibility: (c) => c.stats.money > 500 && c.attributes.intelligence < 85,
    milestone: true,
    tone: 'neutral',
    choices: [
      {
        id: 'enrol',
        label: 'Enrol',
        detail: 'Money and energy now, better jobs later.',
        effect: { money: -450, energy: -15, intelligence: 2.5, mood: -4 },
        outcome: 'You took an evening course and finished it.',
        tone: 'good',
      },
      {
        id: 'skip',
        label: 'Give it a miss',
        detail: 'Nothing gained, nothing lost.',
        effect: {},
        outcome: 'You let the course go.',
        tone: 'neutral',
      },
    ],
  },
  {
    id: 'overtime_offer',
    title: 'They ask you to stay late',
    text: 'Extra hours, extra pay, and a week you will not get back.',
    weight: 10,
    eligibility: hasJob,
    tone: 'neutral',
    choices: [
      {
        id: 'accept',
        label: 'Take the hours',
        detail: 'Good money, real cost.',
        effect: { money: 400, energy: -22, mood: -8 },
        outcome: 'You worked the extra hours.',
        tone: 'neutral',
      },
      {
        id: 'decline',
        label: 'Say no',
        detail: 'Your evenings stay yours.',
        effect: { mood: 4 },
        outcome: 'You turned down overtime.',
        tone: 'neutral',
      },
    ],
  },
  {
    id: 'family_needs_help',
    title: 'Family needs money',
    text: 'They would not ask if it were not serious.',
    weight: 8,
    eligibility: (c) => c.stats.money > 300,
    milestone: true,
    tone: 'neutral',
    choices: [
      {
        id: 'help',
        label: 'Send what you can',
        detail: 'It hurts. You do it anyway.',
        effect: { money: -500, mood: 12 },
        outcome: 'You helped family through a hard patch.',
        tone: 'good',
      },
      {
        id: 'refuse',
        label: 'Say you cannot',
        detail: 'Keeps the money. Not the feeling.',
        effect: { mood: -16 },
        outcome: 'You could not help family when they asked.',
        tone: 'bad',
      },
    ],
  },
];

export function findEvent(id: string): LifeEvent {
  const event = EVENTS.find((e) => e.id === id);
  if (!event) throw new Error(`Unknown event id: ${id}`);
  return event;
}
