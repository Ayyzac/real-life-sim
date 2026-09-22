import { describe, expect, it, vi } from 'vitest';

import { EventBus } from '../../src/core/bus';

interface TestEvents {
  dayAdvanced: { day: number };
  gameReset: null;
}

describe('EventBus', () => {
  it('delivers the payload to every handler of that event', () => {
    const bus = new EventBus<TestEvents>();
    const first = vi.fn();
    const second = vi.fn();
    const unrelated = vi.fn();

    bus.on('dayAdvanced', first);
    bus.on('dayAdvanced', second);
    bus.on('gameReset', unrelated);

    bus.emit('dayAdvanced', { day: 3 });

    expect(first).toHaveBeenCalledExactlyOnceWith({ day: 3 });
    expect(second).toHaveBeenCalledExactlyOnceWith({ day: 3 });
    expect(unrelated).not.toHaveBeenCalled();
  });

  it('stops delivering after the returned unsubscribe is called', () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();

    const unsubscribe = bus.on('dayAdvanced', handler);
    bus.emit('dayAdvanced', { day: 1 });
    unsubscribe();
    bus.emit('dayAdvanced', { day: 2 });

    expect(handler).toHaveBeenCalledExactlyOnceWith({ day: 1 });
  });

  it('lets a handler unsubscribe itself mid-emit without skipping the others', () => {
    const bus = new EventBus<TestEvents>();
    const second = vi.fn();

    const unsubscribeSelf = bus.on('dayAdvanced', () => unsubscribeSelf());
    bus.on('dayAdvanced', second);

    expect(() => bus.emit('dayAdvanced', { day: 1 })).not.toThrow();
    expect(second).toHaveBeenCalledOnce();
  });

  it('drops every handler on clear()', () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();

    bus.on('dayAdvanced', handler);
    bus.clear();
    bus.emit('dayAdvanced', { day: 1 });

    expect(handler).not.toHaveBeenCalled();
  });

  it('emitting an event nobody listens to is a no-op', () => {
    const bus = new EventBus<TestEvents>();

    expect(() => bus.emit('gameReset', null)).not.toThrow();
  });
});
