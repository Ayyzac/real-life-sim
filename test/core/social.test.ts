import { describe, expect, it } from 'vitest';

import { createWorld } from '../../src/core/character';
import { feedFor, followersFrom, post, postBlocker } from '../../src/core/social';
import type { WorldState } from '../../src/core/types';
import { BALANCE } from '../../src/data/balance';

const S = BALANCE.social;

function world(charisma = 12): WorldState {
  const base = createWorld({ name: 'Poster', backgroundId: 'scholarship', seed: 37 });
  return {
    ...base,
    minuteOfDay: 20 * 60,
    character: { ...base.character, focusId: 'rest', attributes: { ...base.character.attributes, charisma } },
  };
}

describe('the social app (GDD §12)', () => {
  it('earns followers for a post, more with charisma', () => {
    const quiet = post(world(5));
    const charming = post(world(80));
    expect(quiet.social.followers).toBeGreaterThan(0);
    expect(quiet.social.posts).toBe(1);
    expect(followersFrom(world(80))).toBeGreaterThan(followersFrom(world(5)));
    expect(charming.social.followers).toBeGreaterThan(quiet.social.followers);
  });

  it('takes a few minutes, and lifts the mood only for the first post of the day', () => {
    const start = world();
    const once = post(start);
    const twice = post(once);
    expect(once.minuteOfDay).toBe(start.minuteOfDay + S.postMinutes);
    expect(once.character.stats.mood).toBe(start.character.stats.mood + S.mood);
    expect(twice.character.stats.mood).toBe(once.character.stats.mood);
    expect(postBlocker(twice)).toMatch(/posts a day/);
    expect(post(twice)).toBe(twice);
  });

  it('shows the same feed all day from people you know, with nothing left unfilled', () => {
    const start = world();
    const feed = feedFor(start);
    expect(feedFor(start)).toEqual(feed);
    expect(feed.length).toBeLessThanOrEqual(S.feedLength);
    for (const line of feed) expect(line).not.toMatch(/[{}]/);
    const shapes = feed.map((line) => line.replace(/^[^ :]+/, ''));
    expect(new Set(shapes).size).toBe(shapes.length);
  });
});
