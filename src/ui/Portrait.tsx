import { SHEET_SPACING, TILE_SIZE, personFrames } from '../data/town';

/**
 * One of the tilesheet's people, drawn with CSS instead of Phaser.
 *
 * The character creation screen needs faces before any Phaser game exists, so
 * it slices the same spritesheet with background-position. One source of
 * truth for the frames: `personFrames`, exactly as the map uses.
 */
const STRIDE = TILE_SIZE + SHEET_SPACING;
const SHEET_WIDTH = 458;
const SHEET_HEIGHT = 305;

export function Portrait({
  row,
  scale = 3,
  className = '',
}: {
  row: number;
  scale?: number;
  className?: string;
}): React.JSX.Element {
  const frame = personFrames(row).down;
  const column = frame % 27;
  const sheetRow = Math.floor(frame / 27);

  return (
    <span
      className={`portrait ${className}`}
      aria-hidden="true"
      style={{
        width: TILE_SIZE * scale,
        height: TILE_SIZE * scale,
        backgroundImage: `url(${import.meta.env.BASE_URL}assets/town/tilemap.png)`,
        backgroundSize: `${SHEET_WIDTH * scale}px ${SHEET_HEIGHT * scale}px`,
        backgroundPosition: `-${column * STRIDE * scale}px -${sheetRow * STRIDE * scale}px`,
      }}
    />
  );
}
