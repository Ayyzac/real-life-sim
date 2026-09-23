import { ageInYears } from '../core/character';
import { BALANCE } from './balance';
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
const hasBusiness = (c: Character): boolean => c.career.type === 'business';
const hasSport = (c: Character): boolean => c.career.type === 'sports';
const working = (c: Character): boolean => c.career.type !== 'none';

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

  // ---------- business owners only (GDD §4.2) ----------
  {
    id: 'busy_season',
    title: 'A run on the place',
    text: 'Word gets round and for a few days you cannot restock fast enough.',
    weight: 11,
    eligibility: hasBusiness,
    effect: { money: 900, energy: -10, mood: 6 },
    tone: 'good',
  },
  {
    id: 'equipment_breaks',
    title: 'Something important breaks',
    text: 'It goes at the worst possible moment, the way these things do.',
    weight: 10,
    eligibility: hasBusiness,
    effect: { money: -650, mood: -8 },
    tone: 'bad',
  },
  {
    id: 'new_competitor',
    title: 'Someone opens up nearby',
    text: 'Newer, shinier, and taking a bite out of your week.',
    weight: 8,
    eligibility: hasBusiness,
    effect: { money: -400, mood: -6 },
    tone: 'bad',
  },
  {
    id: 'bulk_order',
    title: 'A big order comes in',
    text: 'More than you normally handle in a month, and they want it fast.',
    weight: 10,
    eligibility: hasBusiness,
    milestone: true,
    tone: 'neutral',
    choices: [
      {
        id: 'take',
        label: 'Take the order',
        detail: 'Good money. You will not sleep much.',
        effect: { money: 1800, energy: -26, mood: -6, charisma: 0.2 },
        outcome: 'You took the big order and got it out of the door.',
        tone: 'good',
      },
      {
        id: 'decline',
        label: 'Turn it down',
        detail: 'Keeps your week. Costs the money.',
        effect: { mood: -4, energy: 4 },
        outcome: 'You turned down an order that was too big to handle.',
        tone: 'neutral',
      },
    ],
  },

  // ---------- athletes only (GDD §4.3) ----------
  {
    id: 'training_injury',
    title: 'Something goes in training',
    text: 'It is not serious. It is also not nothing, and it will not let you forget it.',
    weight: 11,
    eligibility: hasSport,
    effect: { health: -9, energy: -14, mood: -6 },
    tone: 'bad',
  },
  {
    id: 'crowd_on_your_side',
    title: 'The crowd knows your name',
    text: 'You hear it going up as you come out, and it does something to your legs.',
    weight: 9,
    eligibility: hasSport,
    effect: { mood: 14, energy: 5, charisma: 0.2 },
    tone: 'good',
  },
  {
    id: 'sponsorship_offer',
    title: 'A sponsor comes calling',
    text: 'Decent money to put their name on your kit, and their opinions in your mouth.',
    weight: 9,
    // Sponsors chase athletes who are still going somewhere. Without this a
    // 70-year-old kept getting offers, which paid for a career that should
    // have ended - and quietly made never retiring the better move.
    eligibility: (c) => hasSport(c) && ageInYears(c) <= BALANCE.sports.peakAgeYears + 4,
    milestone: true,
    tone: 'neutral',
    choices: [
      {
        id: 'sign',
        label: 'Sign the deal',
        detail: 'Money now. You will be doing their adverts.',
        effect: { money: 4_000, mood: -8, charisma: 0.4 },
        outcome: 'You signed a sponsorship deal.',
        tone: 'good',
      },
      {
        id: 'refuse',
        label: 'Stay your own',
        detail: 'No money. No leash.',
        effect: { mood: 10 },
        outcome: 'You turned a sponsor down and kept your name to yourself.',
        tone: 'neutral',
      },
    ],
  },

  // ---------- everyday, no decision needed ----------
  {
    id: 'lost_sleep',
    title: 'A week of bad nights',
    text: 'You lie awake doing sums about things you cannot change until morning.',
    weight: 12,
    effect: { energy: -14, mood: -5 },
    tone: 'bad',
  },
  {
    id: 'small_win',
    title: 'Something goes right',
    text: 'Nothing enormous. It carries you through the week anyway.',
    weight: 12,
    effect: { mood: 10, energy: 4 },
    tone: 'good',
  },
  {
    id: 'weather_turns',
    title: 'The weather breaks',
    text: 'Three clear days in a row, and the whole town walks a little slower.',
    weight: 10,
    effect: { mood: 7, health: 0.8 },
    tone: 'good',
  },
  {
    id: 'dental_bill',
    title: 'A tooth goes wrong',
    text: 'It waits until the worst possible week, as they always do.',
    weight: 9,
    effect: { money: -320, mood: -5, health: -2 },
    tone: 'bad',
  },
  {
    id: 'stomach_bug',
    title: 'Something you ate',
    text: 'Two days you will not get back.',
    weight: 11,
    effect: { health: -4, energy: -10, mood: -3 },
    tone: 'bad',
  },
  {
    id: 'long_walk',
    title: 'A long walk with no destination',
    text: 'You get back tired in the good way.',
    weight: 10,
    effect: { mood: 8, health: 1.2, energy: -4 },
    tone: 'good',
  },
  {
    id: 'phone_dies',
    title: 'Your phone gives up',
    text: 'Replacing it is not optional, however much you would like it to be.',
    weight: 9,
    effect: { money: -450, mood: -4 },
    tone: 'bad',
  },
  {
    id: 'tax_refund',
    title: 'Money you had forgotten about',
    text: 'A form you filled in months ago finally does something useful.',
    weight: 8,
    effect: { money: 700, mood: 6 },
    tone: 'good',
  },
  {
    id: 'back_gives_out',
    title: 'Your back goes',
    text: 'You bent down for something ordinary and your body disagreed.',
    weight: 10,
    eligibility: (c) => ageInYears(c) >= 35,
    effect: { health: -7, energy: -12, mood: -6 },
    tone: 'bad',
  },
  {
    id: 'old_friend_calls',
    title: 'An old number rings',
    text: 'Somebody you had not thought about in years, and it is easy again straight away.',
    weight: 9,
    effect: { mood: 13, charisma: 0.15 },
    tone: 'good',
  },
  {
    id: 'sleep_like_a_child',
    title: 'Twelve hours',
    text: 'You go to bed early and wake up a different person.',
    weight: 10,
    effect: { energy: 22, mood: 5, health: 1 },
    tone: 'good',
  },
  {
    id: 'flat_flooded',
    title: 'Water where water should not be',
    text: 'A pipe upstairs, and a week of dealing with it.',
    weight: 7,
    effect: { money: -900, mood: -10, energy: -8 },
    tone: 'bad',
  },
  {
    id: 'good_book',
    title: 'A book you cannot put down',
    text: 'You read it in three nights and think about it for a month.',
    weight: 10,
    effect: { mood: 9, intelligence: 0.15 },
    tone: 'good',
  },
  {
    id: 'argument_with_stranger',
    title: 'A row over nothing',
    text: 'You are still composing better replies two days later.',
    weight: 9,
    effect: { mood: -9, energy: -3 },
    tone: 'bad',
  },
  {
    id: 'neighbour_helps',
    title: 'A neighbour turns up',
    text: 'Unasked, at exactly the right moment, and refuses anything for it.',
    weight: 8,
    effect: { mood: 12, charisma: 0.15 },
    tone: 'good',
  },

  // ---------- work only ----------
  {
    id: 'good_review',
    title: 'A word from above',
    text: 'Somebody senior noticed, and said so where it counts.',
    weight: 9,
    eligibility: hasJob,
    effect: { mood: 12, charisma: 0.2 },
    tone: 'good',
  },
  {
    id: 'awful_week_at_work',
    title: 'A week that will not end',
    text: 'Everything that could go wrong does, and none of it is yours to fix.',
    weight: 11,
    eligibility: hasJob,
    effect: { mood: -12, energy: -12 },
    tone: 'bad',
  },
  {
    id: 'colleague_leaves',
    title: 'Somebody good leaves',
    text: 'The place is measurably worse on Monday.',
    weight: 8,
    eligibility: hasJob,
    effect: { mood: -8 },
    tone: 'neutral',
  },
  {
    id: 'career_doubt',
    title: 'Is this it?',
    text: 'The question arrives on a Tuesday and will not leave.',
    weight: 9,
    eligibility: working,
    effect: { mood: -10, intelligence: 0.1 },
    tone: 'bad',
  },

  // ---------- people (GDD 10) ----------
  {
    id: 'someone_needs_you',
    title: 'Somebody needs you this week',
    text: 'Not an emergency. Just the sort of thing you cannot say no to.',
    weight: 11,
    eligibility: (c) => ageInYears(c) >= 20,
    tone: 'neutral',
    choices: [
      {
        id: 'go',
        label: 'Be there',
        detail: 'Costs you the week. Means something to them.',
        effect: { energy: -14, mood: 10, charisma: 0.25 },
        outcome: 'You dropped everything for somebody, and it mattered.',
        tone: 'good',
      },
      {
        id: 'busy',
        label: 'Say you are busy',
        detail: 'Keeps your week. You will think about it later.',
        effect: { mood: -9 },
        outcome: 'You were too busy when somebody needed you.',
        tone: 'bad',
      },
    ],
  },
  {
    id: 'wedding_invitation',
    title: 'An invitation arrives',
    text: 'Somebody you know is getting married, and it is not cheap to attend.',
    weight: 9,
    eligibility: (c) => ageInYears(c) >= 22,
    tone: 'neutral',
    choices: [
      {
        id: 'attend',
        label: 'Go, and give properly',
        detail: 'A day out and a dent in the account.',
        effect: { money: -600, mood: 15, charisma: 0.2 },
        outcome: 'You went to the wedding and were glad you did.',
        tone: 'good',
      },
      {
        id: 'decline',
        label: 'Send your apologies',
        detail: 'Nobody will say anything about it.',
        effect: { mood: -6 },
        outcome: 'You missed the wedding.',
        tone: 'neutral',
      },
    ],
  },
  {
    id: 'falling_out',
    title: 'A falling out',
    text: 'Something said quickly that neither of you can quite take back.',
    weight: 8,
    effect: { mood: -13 },
    tone: 'bad',
  },
  {
    id: 'quiet_evening_with_people',
    title: 'A good evening',
    text: 'Nothing planned, nobody in a hurry, and it goes on later than it should.',
    weight: 11,
    effect: { mood: 14, energy: -6, charisma: 0.2 },
    tone: 'good',
  },

  // ---------- decisions ----------
  {
    id: 'night_class',
    title: 'A course you could take',
    text: 'Evenings for a term, and the fee up front.',
    weight: 9,
    eligibility: (c) => ageInYears(c) < 60,
    milestone: true,
    tone: 'neutral',
    choices: [
      {
        id: 'enrol',
        label: 'Enrol',
        detail: 'Money and evenings, for something that stays with you.',
        effect: { money: -1_400, energy: -12, intelligence: 1.2 },
        outcome: 'You took a course and finished it.',
        tone: 'good',
      },
      {
        id: 'skip',
        label: 'Not this year',
        detail: 'There is always next year.',
        effect: { mood: -3 },
        outcome: 'You thought about studying and did not.',
        tone: 'neutral',
      },
    ],
  },
  {
    id: 'risky_investment',
    title: 'A friend with a sure thing',
    text: 'They are very confident, which is either reassuring or the whole problem.',
    weight: 8,
    eligibility: (c) => c.stats.money > 5_000,
    milestone: true,
    tone: 'neutral',
    choices: [
      {
        id: 'invest',
        label: 'Put money in',
        detail: 'It might come back. It might not.',
        effect: { money: -3_000, mood: -4 },
        outcome: 'You put money into a friend\u2019s sure thing.',
        tone: 'bad',
      },
      {
        id: 'pass',
        label: 'Politely pass',
        detail: 'Keeps the money. Possibly costs the friendship.',
        effect: { mood: -2 },
        outcome: 'You passed on a friend\u2019s investment.',
        tone: 'neutral',
      },
    ],
  },
  {
    id: 'holiday_offer',
    title: 'A week away, if you want it',
    text: 'Somewhere warm, booked at short notice, and you would have to pay now.',
    weight: 9,
    eligibility: (c) => c.stats.money > 2_000,
    tone: 'neutral',
    choices: [
      {
        id: 'go',
        label: 'Book it',
        detail: 'Expensive. You come back a person again.',
        effect: { money: -2_200, mood: 26, energy: 20, health: 1.5 },
        outcome: 'You took a week away and came back better for it.',
        tone: 'good',
      },
      {
        id: 'stay',
        label: 'Stay home',
        detail: 'The money stays where it is.',
        effect: { mood: -5 },
        outcome: 'You talked yourself out of a holiday.',
        tone: 'neutral',
      },
    ],
  },
  {
    id: 'stray_cat',
    title: 'Something small and hungry',
    text: 'It has decided your doorstep is the place to be.',
    weight: 8,
    tone: 'neutral',
    choices: [
      {
        id: 'keep',
        label: 'Let it in',
        detail: 'Food, vet bills, and company.',
        effect: { money: -260, mood: 18 },
        outcome: 'You took in a stray, and it took you in back.',
        tone: 'good',
      },
      {
        id: 'shoo',
        label: 'Leave it be',
        detail: 'Somebody else will. Probably.',
        effect: { mood: -5 },
        outcome: 'You left the stray where it was.',
        tone: 'neutral',
      },
    ],
  },
];

export function findEvent(id: string): LifeEvent {
  const event = EVENTS.find((e) => e.id === id);
  if (!event) throw new Error(`Unknown event id: ${id}`);
  return event;
}
