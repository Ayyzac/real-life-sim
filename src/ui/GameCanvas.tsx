import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';

import { actionBlocker } from '../core/day';
import { greetBlocker } from '../core/talk';
import { findAction } from '../data/actions';
import { BALANCE } from '../data/balance';
import { createPhaserGame } from '../world/phaserGame';
import { runTimed } from './progress';
import { openTalk } from './talk';
import { gameStore } from './useGame';

/**
 * Clicking furniture inside a room does the same as the button in the side
 * panel, timed bar and all - so the world is handed this rather than calling
 * the store itself.
 */
const hooks = {
  perform(actionId: string): void {
    const world = gameStore.getState();
    const action = findAction(actionId);
    if (!world || actionBlocker(world, action) !== null) return;
    runTimed(action.label, action.minutes, { type: 'doAction', actionId });
  },
  talk(personId: string): void {
    openTalk(personId);
  },
  greet(look: number): void {
    const world = gameStore.getState();
    if (!world || greetBlocker(world) !== null) return;
    runTimed('Saying hello', BALANCE.relationships.greet.minutes, { type: 'greetStranger', look });
  },
};

/**
 * The single seam between React and Phaser.
 *
 * React owns the DOM node; Phaser owns everything painted inside it.
 *
 * The bookkeeping below exists because React StrictMode mounts, unmounts and
 * mounts again in development, and a Phaser game does not survive that
 * naively. The scene loads a spritesheet, so the first game is still booting
 * when the unmount arrives, and `destroy()` before boot only sets a flag for a
 * step loop that has not started - so the flag is never read. The result was
 * two live Phaser games stacked in the same container: one drawing the map,
 * the other quietly receiving the clicks, which is why a district arrow moved
 * a camera nobody could see.
 *
 * So the game is created once and kept. The teardown is deferred by a tick:
 * StrictMode's remount happens first and cancels it, while a real unmount lets
 * it through.
 */
export function GameCanvas(): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const teardownRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (teardownRef.current !== null) {
      clearTimeout(teardownRef.current);
      teardownRef.current = null;
    }
    if (!gameRef.current) gameRef.current = createPhaserGame(container, gameStore, hooks);

    return () => {
      teardownRef.current = window.setTimeout(() => {
        gameRef.current?.destroy(true);
        gameRef.current = null;
        teardownRef.current = null;
      }, 0);
    };
  }, []);

  return <div className="game-canvas" ref={containerRef} role="img" aria-label="Town map" />;
}
