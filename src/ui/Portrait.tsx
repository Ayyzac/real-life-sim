import { useEffect, useRef } from 'react';

import { TILE_SIZE } from '../data/town';
import { POSE, VIEW, loadTilesheet, lookSheet } from '../world/looks';

/**
 * Someone's face: the standing, front-facing frame of their look.
 *
 * Painted from the same look sheet the map uses (src/world/looks.ts), so a
 * person in a list is recognisably the person walking about in town.
 */
export function Portrait({
  look,
  scale = 3,
  className = '',
}: {
  look: number;
  scale?: number;
  className?: string;
}): React.JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let live = true;
    void loadTilesheet().then((tilesheet) => {
      const context = canvas.current?.getContext('2d');
      if (!live || !context) return;
      context.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
      context.drawImage(
        lookSheet(tilesheet, look),
        VIEW.down * TILE_SIZE,
        POSE.stand * TILE_SIZE,
        TILE_SIZE,
        TILE_SIZE,
        0,
        0,
        TILE_SIZE,
        TILE_SIZE,
      );
    });
    return () => {
      live = false;
    };
  }, [look]);

  return (
    <canvas
      ref={canvas}
      className={`portrait ${className}`}
      aria-hidden="true"
      width={TILE_SIZE}
      height={TILE_SIZE}
      style={{ width: TILE_SIZE * scale, height: TILE_SIZE * scale }}
    />
  );
}
