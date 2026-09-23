import { describe, expect, it } from 'vitest';

import { createWorld } from '../../src/core/character';
import { soundFor } from '../../src/ui/sound';
import type { WorldState } from '../../src/core/types';

/**
 * `soundFor` is the only part of the sound system with a decision in it: what
 * happened, given the world before and after. Everything else is one call to
 * the browser, so this is what is worth pinning.
 */

function base(): WorldState {
  return createWorld({ name: 'Ears', backgroundId: 'scholarship', seed: 5 });
}

describe('soundFor', () => {
  it('says nothing on the very first render', () => {
    expect(soundFor(null, base())).toBeNull();
  });

  it('says nothing when there is no world at all', () => {
    expect(soundFor(base(), null)).toBeNull();
  });

  it('says nothing when nothing changed', () => {
    const world = base();

    expect(soundFor(world, world)).toBeNull();
  });

  it('marks a week going by', () => {
    const before = base();
    const after = { ...before, clockDay: before.clockDay + 7 };

    expect(soundFor(before, after)).toBe('week');
  });

  it('death comes before everything else', () => {
    // A week that kills also advances the clock and writes a log line. One
    // sound, and it should be the one that matters.
    const before = base();
    const after: WorldState = {
      ...before,
      clockDay: before.clockDay + 7,
      deceased: true,
      eventLog: [{ day: 1, tone: 'bad', text: 'died' }, ...before.eventLog],
    };

    expect(soundFor(before, after)).toBe('death');
  });

  it('an event that needs an answer speaks up over a passing week', () => {
    const before = base();
    const after: WorldState = {
      ...before,
      clockDay: before.clockDay + 3,
      pendingEvent: { eventId: 'friend_invites', daysRemaining: 4 },
    };

    expect(soundFor(before, after)).toBe('decide');
  });

  it('buying something has its own sound', () => {
    const before = base();
    const after: WorldState = {
      ...before,
      character: { ...before.character, owned: ['bicycle'] },
    };

    expect(soundFor(before, after)).toBe('buy');
  });

  it('follows the tone of whatever was just written to the log', () => {
    const before = base();
    const good: WorldState = {
      ...before,
      eventLog: [{ day: 1, tone: 'good', text: 'nice' }, ...before.eventLog],
    };
    const bad: WorldState = {
      ...before,
      eventLog: [{ day: 1, tone: 'bad', text: 'awful' }, ...before.eventLog],
    };

    expect(soundFor(before, good)).toBe('good');
    expect(soundFor(before, bad)).toBe('bad');
  });

  it('stays quiet for a log line that is neither good nor bad', () => {
    const before = base();
    const after: WorldState = {
      ...before,
      eventLog: [{ day: 1, tone: 'neutral', text: 'something' }, ...before.eventLog],
    };

    expect(soundFor(before, after)).toBeNull();
  });
});
