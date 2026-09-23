import { BALANCE } from '../data/balance';
import { FEED_LINES, MY_POSTS } from '../data/social';
import { freeUntil, passTime } from './day';
import { hashText } from './hash';
import type { WorldState } from './types';

/**
 * The social app (GDD §12). Posting takes a little time, earns followers -
 * more with charisma - and the first post of the day lifts the mood a touch.
 * Worked out from the life and the day, never from the saved RNG.
 */

const S = BALANCE.social;

function clamp(value: number): number {
  return Math.min(BALANCE.statMax, Math.max(BALANCE.statMin, value));
}

export function postsToday(state: WorldState): number {
  return state.doneToday.filter((entry) => entry === 'post').length;
}

export function postBlocker(state: WorldState): string | null {
  if (state.deceased || state.pendingEvent !== null) return 'Not now';
  if (postsToday(state) >= S.postsPerDay) return `${S.postsPerDay} posts a day is plenty`;
  if (state.minuteOfDay + S.postMinutes > freeUntil(state)) return 'Not enough time';
  return null;
}

/** What today's next post says. */
export function nextCaption(state: WorldState): string {
  return MY_POSTS[hashText(`post:${state.character.id}:${state.clockDay}:${postsToday(state)}`) % MY_POSTS.length]!;
}

/** New followers from a post: a little luck, and charisma. */
export function followersFrom(state: WorldState): number {
  const luck = hashText(`followers:${state.character.id}:${state.clockDay}:${postsToday(state)}`) % 100;
  return Math.round((S.baseFollowers + state.character.attributes.charisma * S.followersPerCharisma) * (0.5 + luck / 100));
}

export function post(state: WorldState): WorldState {
  if (postBlocker(state) !== null) return state;
  const first = postsToday(state) === 0;
  const gained = followersFrom(state);
  const played = passTime(state, S.postMinutes);
  const { stats, attributes } = played.character;
  return {
    ...played,
    doneToday: [...played.doneToday, 'post'],
    social: { followers: state.social.followers + gained, posts: state.social.posts + 1 },
    character: {
      ...played.character,
      stats: { ...stats, mood: clamp(stats.mood + (first ? S.mood : 0)) },
      attributes: { ...attributes, charisma: clamp(attributes.charisma + (first ? S.charisma : 0)) },
    },
  };
}

/** A few posts from the people the player knows, the same all day. */
export function feedFor(state: WorldState): string[] {
  const grownUps = state.people.filter((person) => person.job !== null);
  // Consecutive lines from a daily starting point, so nobody posts the same thing.
  const first = hashText(`feed:${state.character.id}:${state.clockDay}`);
  return grownUps
    .map((person) => ({ person, order: hashText(`feed:${person.id}:${state.clockDay}`) }))
    .sort((a, b) => a.order - b.order)
    .slice(0, S.feedLength)
    .map(({ person }, i) =>
      FEED_LINES[(first + i) % FEED_LINES.length]!.replaceAll('{name}', person.name.split(' ')[0] ?? person.name).replaceAll(
        '{job}',
        person.job ?? 'worker',
      ),
    );
}
