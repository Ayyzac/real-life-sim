import { describe, expect, it } from 'vitest';

import { createWorld } from '../../src/core/character';
import { applyDailyRules } from '../../src/core/clock';
import { makePerson } from '../../src/core/relationships';
import { createRng } from '../../src/core/rng';
import { whoIsHere } from '../../src/core/schedule';
import {
  askOut,
  canAskOut,
  fillLine,
  greetChance,
  greetStranger,
  invite,
  inviteBlocker,
  talkBlocker,
  talkTurn,
  topicFits,
  topicsFor,
  traitKnown,
  traitOf,
  verdictFor,
  wouldSayYes,
} from '../../src/core/talk';
import type { Person, RelationKind, WorldState } from '../../src/core/types';
import { BALANCE } from '../../src/data/balance';
import { TOPICS, type Topic } from '../../src/data/conversations';
import { CALL_REACTIONS, LINES, REACTIONS, TRAITS, type ReplyStyle } from '../../src/data/dialogue';

const R = BALANCE.relationships;
const STYLES: ReplyStyle[] = ['joke', 'sincere', 'curious'];

/** A partner at home in the evening is always "here" - handy for talking. */
function person(kind: RelationKind = 'partner', closeness = 50, id = 'p-test'): Person {
  return { ...makePerson(createRng(3), kind, 30, closeness), id };
}

function world(people: Person[], patch: Partial<WorldState> = {}): WorldState {
  const base = createWorld({ name: 'Talker', backgroundId: 'scholarship', seed: 12 });
  return {
    ...base,
    minuteOfDay: 20 * 60,
    people,
    ...patch,
    character: { ...base.character, focusId: 'rest', location: 'home', ...(patch.character ?? {}) },
  };
}

function closenessOf(state: WorldState, id: string): number {
  return state.people.find((p) => p.id === id)!.closeness;
}

/** Someone whose nature likes (or dislikes) a given style, found by trying ids. */
function personWho(verdict: 'good' | 'bad', style: ReplyStyle, kind: RelationKind = 'partner', closeness = 50): Person {
  for (let n = 0; n < 500; n += 1) {
    const candidate = person(kind, closeness, `p-${n}`);
    if (verdictFor(candidate, style) === verdict) return candidate;
  }
  throw new Error('no such person');
}

/** The reply of this style on the first line of the everyday topic. */
function replyIndex(style: ReplyStyle): number {
  return TOPICS.find((t) => t.id === 'day')!.nodes.start!.replies.findIndex((r) => r.style === style);
}

/** One answer on the opening line of "How the day went". */
function say(state: WorldState, id: string, style: ReplyStyle, remote = false): WorldState {
  return talkTurn(state, id, 'day', 'start', replyIndex(style), remote);
}

describe('conversations (GDD §11.6, §12)', () => {
  it('gives everyone a nature that never changes', () => {
    const p = person();
    expect(traitOf(p)).toBe(traitOf(p));
    expect(TRAITS).toContain(traitOf(p));
  });

  it('only talks to someone who is actually here', () => {
    const friend = person('friend', 50, 'far-away');
    const state = world([friend], { minuteOfDay: 8 * 60 });
    expect(whoIsHere(state, 'home')).toHaveLength(0);
    expect(talkBlocker(state, friend)).toContain('not here');
    expect(say(state, friend.id, 'joke')).toBe(state);
  });

  it('moves closeness by how well the answer suits them', () => {
    const likesJokes = personWho('good', 'joke');
    const hatesJokes = personWho('bad', 'joke');

    const up = say(world([likesJokes]), likesJokes.id, 'joke');
    const down = say(world([hatesJokes]), hatesJokes.id, 'joke');

    expect(closenessOf(up, likesJokes.id)).toBeGreaterThan(50);
    expect(closenessOf(down, hatesJokes.id)).toBe(50 + R.talk.bad);
  });

  it('takes a few minutes a turn, and each turn today counts for less', () => {
    const p = personWho('good', 'sincere');
    const first = say(world([p]), p.id, 'sincere');
    expect(first.minuteOfDay).toBe(20 * 60 + R.talk.minutes);

    const gainFirst = closenessOf(first, p.id) - 50;
    const second = talkTurn(first, p.id, 'day', 'nice', 1);
    const gainSecond = closenessOf(second, p.id) - closenessOf(first, p.id);
    expect(gainSecond).toBeGreaterThan(0);
    expect(gainSecond).toBeLessThan(gainFirst);
  });

  it('will not start the same topic twice in a day, and runs out of talk eventually', () => {
    const p = person();
    const once = say(world([p]), p.id, 'sincere');
    expect(say(once, p.id, 'sincere')).toBe(once);
    expect(topicsFor(once, p).some((t) => t.id === 'day')).toBe(false);

    const talkedOut = { ...once, doneToday: Array.from({ length: R.talk.maxTurnsPerDay }, () => `talk:${p.id}`) };
    expect(talkBlocker(talkedOut, p)).toBe('Talked enough for today');
  });

  it('works out who they are after answers that land', () => {
    let p = personWho('good', 'curious');
    let state = world([p]);
    for (let day = 0; day < R.talk.revealAfter; day += 1) {
      state = say({ ...state, doneToday: [] }, p.id, 'curious');
    }
    p = state.people[0]!;
    expect(traitKnown(p)).toBe(true);
  });

  it('lands softer when unwashed', () => {
    const p = personWho('good', 'joke');
    const clean = say(world([p]), p.id, 'joke');
    const base = world([p]);
    const grubby = say({ ...base, character: { ...base.character, needs: { ...base.character.needs, hygiene: 5 } } }, p.id, 'joke');
    expect(closenessOf(grubby, p.id)).toBeLessThan(closenessOf(clean, p.id));
  });

  it('offers only topics that suit the person, the same all day, and young children only their own', () => {
    for (const kind of ['family', 'friend', 'colleague', 'dating', 'partner', 'child'] as const) {
      const p = person(kind, 75, `${kind}-x`);
      const state = world([p]);
      const offered = topicsFor(state, p);
      expect(offered.length, kind).toBeGreaterThan(0);
      expect(offered.length).toBeLessThanOrEqual(R.talk.topicsOffered);
      expect(topicsFor(state, p)).toEqual(offered);
      for (const topic of offered) expect(topicFits(topic, p)).toBe(true);
    }
    const kid = { ...person('child', 80, 'kid'), ageDays: 6 * 365 };
    expect(topicsFor(world([kid]), kid).every((t) => t.young)).toBe(true);
  });
});

describe('the conversation trees (GDD §12)', () => {
  const reachable = (topic: Topic): Set<string> => {
    const seen = new Set<string>();
    const walk = (id: string): void => {
      if (seen.has(id)) return;
      seen.add(id);
      for (const reply of topic.nodes[id]!.replies) if (reply.next) walk(reply.next);
    };
    walk(topic.start);
    return seen;
  };

  it('leads every answer somewhere real, and every line can be reached', () => {
    for (const topic of TOPICS) {
      expect(topic.nodes[topic.start], topic.id).toBeDefined();
      for (const [id, node] of Object.entries(topic.nodes)) {
        expect(new Set(node.replies.map((r) => r.style)).size, `${topic.id}.${id}`).toBe(3);
        for (const reply of node.replies) {
          if (reply.next) expect(topic.nodes[reply.next], `${topic.id}.${id} -> ${reply.next}`).toBeDefined();
        }
      }
      expect([...reachable(topic)].sort(), topic.id).toEqual(Object.keys(topic.nodes).sort());
    }
  });

  it('always ends: no conversation goes round in circles', () => {
    for (const topic of TOPICS) {
      const depth = (id: string, trail: string[]): number => {
        expect(trail, `${topic.id} loops at ${id}`).not.toContain(id);
        const nexts = topic.nodes[id]!.replies.map((r) => r.next).filter((n): n is string => Boolean(n));
        return 1 + Math.max(0, ...nexts.map((n) => depth(n, [...trail, id])));
      };
      expect(depth(topic.start, [])).toBeLessThanOrEqual(6);
    }
  });

  it('never leaves a placeholder unfilled', () => {
    const p = { ...person('colleague', 80, 'filler'), job: 'baker' };
    const state = world([p]);
    for (const topic of TOPICS) {
      for (const node of Object.values(topic.nodes)) {
        for (const text of [node.npc, ...node.replies.map((r) => r.text)]) {
          expect(fillLine(text, p, state), topic.id).not.toMatch(/[{}]/);
        }
      }
    }
  });

  it('has a reaction for every outcome, in person and on the phone', () => {
    for (const style of STYLES) {
      for (const verdict of ['good', 'neutral', 'bad'] as const) {
        expect(REACTIONS[style][verdict].length).toBeGreaterThan(0);
        expect(CALL_REACTIONS[style][verdict].length).toBeGreaterThan(0);
      }
    }
    expect(LINES.talkedOut).toBeTruthy();
  });

  it('lets a good first impression help a stranger say yes', () => {
    const state = world([]);
    expect(greetChance(state, 2)).toBeGreaterThan(greetChance(state, 0));
    expect(greetChance(state, 99)).toBe(greetChance(state, 2));
  });
});

describe('dating (GDD §11.6)', () => {
  it('can ask out a close friend who is here, one person at a time', () => {
    const friend = { ...person('friend', 80, 'close-friend') };
    // Friends are out some evenings; find one when this friend is at the Cafe.
    const state = world([friend], { character: { location: 'cafe' } as never });
    const evening = Array.from({ length: 40 }, (_, day) => ({ ...state, clockDay: day })).find(
      (s) => whoIsHere(s, 'cafe').length > 0,
    )!;
    expect(canAskOut(evening, friend)).toBe(true);
    expect(canAskOut({ ...evening, people: [friend, person('partner', 90, 'spouse')] }, friend)).toBe(false);
  });

  it('turns a yes into seeing each other, and a no into a little distance', () => {
    const keen = person('friend', 90, 'keen');
    const unsure = person('friend', 60, 'unsure');
    expect(wouldSayYes(keen)).toBe(true);
    expect(wouldSayYes(unsure)).toBe(traitOf(unsure).id === 'romantic');
  });

  it('ends things with someone you have let go cold for too long', () => {
    let state = world([person('dating', R.breakupBelow - 5, 'cold')]);
    for (let day = 0; day < R.breakupAfterDays; day += 1) state = applyDailyRules(state);
    expect(state.people[0]!.kind).toBe('friend');
    expect(state.eventLog.some((entry) => entry.text.includes('ended things'))).toBe(true);
  });

  it('never breaks up a marriage', () => {
    let state = world([person('partner', 0, 'spouse')]);
    for (let day = 0; day < R.breakupAfterDays + 5; day += 1) state = applyDailyRules(state);
    expect(state.people[0]!.kind).toBe('partner');
  });

  it('says yes to asking out through the store when close enough', () => {
    const friend = person('friend', 95, 'yes-please');
    const base = world([friend], { character: { location: 'cafe' } as never });
    const evening = Array.from({ length: 40 }, (_, day) => ({ ...base, clockDay: day })).find(
      (s) => whoIsHere(s, 'cafe').length > 0,
    )!;
    const after = askOut(evening, friend.id);
    expect(after.people[0]!.kind).toBe('dating');
    expect(after.milestones[0]?.text).toContain('Started seeing');
  });
});

describe('going out by phone (GDD §11.6)', () => {
  it('takes you both to dinner, paid for two, and brings you closer', () => {
    const p = person('friend', 50, 'diner');
    const state = world([p], { minuteOfDay: 18 * 60, clockDay: 5 });
    const after = invite(state, p.id, 'dinner');

    expect(after.character.location).toBe('cafe');
    expect(after.character.stats.money).toBe(state.character.stats.money - R.invite.cost);
    expect(closenessOf(after, p.id)).toBeGreaterThan(50);
    expect(after.minuteOfDay).toBe(18 * 60 + R.invite.minutes);
  });

  it('is turned down by someone you are not close to', () => {
    const p = person('friend', 10, 'stranger-ish');
    const state = world([p], { minuteOfDay: 18 * 60 });
    const after = invite(state, p.id, 'film');
    expect(after.character.location).toBe('home');
    expect(after.eventLog[0]?.text).toContain('excuse');
  });

  it('cannot book somewhere that is shut', () => {
    const p = person('friend', 60, 'night-owl');
    expect(inviteBlocker(world([p], { minuteOfDay: 23 * 60 }), p, 'dinner')).toContain('Closed');
  });
});

describe('saying hello to strangers (GDD §11.6)', () => {
  it('sometimes makes a new friend who keeps the face you saw, and sometimes not', () => {
    const outcomes = Array.from({ length: 30 }, (_, seed) => {
      const base = createWorld({ name: 'Hello', backgroundId: 'scholarship', seed });
      return greetStranger({ ...base, minuteOfDay: 12 * 60 }, 777);
    });
    const met = outcomes.filter((s) => s.people.some((p) => p.look === 777));
    expect(met.length).toBeGreaterThan(0);
    expect(met.length).toBeLessThan(outcomes.length);
    expect(met[0]!.eventLog[0]?.text).toContain('You got talking to');
  });

  it('stops after three hellos a day', () => {
    let state = { ...createWorld({ name: 'Hello', backgroundId: 'scholarship', seed: 3 }), minuteOfDay: 12 * 60 };
    for (let n = 0; n < 5; n += 1) state = greetStranger(state, 100 + n);
    expect(state.doneToday.filter((d) => d === 'greet')).toHaveLength(R.greet.perDay);
  });

  it('never grows the circle past its limit', () => {
    const full = Array.from({ length: R.maxLivingPeople }, (_, n) => person('friend', 50, `full-${n}`));
    for (let seed = 0; seed < 20; seed += 1) {
      const base = createWorld({ name: 'Busy', backgroundId: 'scholarship', seed });
      const after = greetStranger({ ...base, minuteOfDay: 12 * 60, people: full }, 5);
      expect(after.people).toHaveLength(R.maxLivingPeople);
    }
    expect(LINES.greetFull).toBeTruthy();
  });
});
