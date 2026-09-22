import { useEffect, useRef } from 'react';

import { createPhaserGame } from '../world/phaserGame';
import { gameStore } from './useGame';

/**
 * The single seam between React and Phaser.
 *
 * React owns the DOM node; Phaser owns everything painted inside it. The
 * cleanup below also makes this safe under React StrictMode, which mounts
 * effects twice in development.
 */
export function GameCanvas(): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const game = createPhaserGame(container, gameStore);
    return () => {
      game.destroy(true);
    };
  }, []);

  return <div className="game-canvas" ref={containerRef} role="img" aria-label="Town map" />;
}
