/**
 * Minimal typed event bus.
 *
 * This is the ONLY channel between the simulation core, the React UI
 * (src/ui) and the Phaser world (src/world) - see docs/ARCHITECTURE.md §1.
 * Layers must never reach into each other's internals directly.
 *
 * Like everything in src/core, this file must stay free of React and Phaser
 * imports so it can be tested headlessly with Vitest.
 */

export type Handler<T> = (payload: T) => void;

/** Unsubscribes a handler registered with {@link EventBus.on}. */
export type Unsubscribe = () => void;

export class EventBus<Events> {
  private handlers: { [K in keyof Events]?: Set<Handler<Events[K]>> } = {};

  /** Registers a handler and returns a function that removes it again. */
  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): Unsubscribe {
    const set = (this.handlers[event] ??= new Set<Handler<Events[K]>>());
    set.add(handler);
    return () => {
      set.delete(handler);
    };
  }

  /** Calls every handler registered for this event, in registration order. */
  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    // Copy first: a handler is allowed to unsubscribe itself while running.
    const set = this.handlers[event];
    if (!set) return;
    for (const handler of [...set]) handler(payload);
  }

  /** Removes every handler. Used when tearing a game session down. */
  clear(): void {
    this.handlers = {};
  }
}
