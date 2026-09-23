import { decodeLook } from '../core/look';
import { BODIES, HAIR_COLOURS, SKIN_TONES, TOP_COLOURS, type ColourBand } from '../data/looks';
import { SHEET_SPACING, TILE_SIZE } from '../data/town';

/**
 * Paints a look (src/core/look.ts) onto the six bodies in the tilesheet.
 *
 * A look's frames are laid out as a small sheet of its own: four views across
 * (VIEW) and three poses down (POSE). Phaser and the React portraits both use
 * this one sheet, so a person looks the same on the map and in a list.
 */

export const VIEW = { left: 0, down: 1, up: 2, right: 3 } as const;
export const POSE = { stand: 0, stepA: 1, stepB: 2 } as const;
const VIEWS = 4;
const POSES = 3;
/** The body's four views start at this column of the tilesheet. */
const FIRST_COLUMN = 23;

export function lookFrame(view: number, pose: number): number {
  return pose * VIEWS + view;
}

type Rgb = readonly [number, number, number];

function rgb(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

interface Swap {
  from: Rgb;
  to: Rgb;
  fromY: number;
  toY: number;
}

/**
 * Pairs a band's colours with a ramp, both darkest first. A band with fewer
 * shades than the ramp takes the ramp's lighter end.
 */
function swapsFor(band: ColourBand, ramp: readonly string[] | null | undefined): Swap[] {
  if (!ramp) return [];
  const offset = ramp.length - band.colours.length;
  return band.colours.map((colour, i) => ({
    from: rgb(colour),
    to: rgb(ramp[Math.max(0, offset + i)]!),
    fromY: band.fromY,
    toY: band.toY,
  }));
}

/**
 * Repaints raw RGBA pixels in place. Pure, so it is tested without a browser.
 *
 * `pixels` holds whole frames of `TILE_SIZE` rows stacked however the caller
 * likes; bands are matched on the row inside each frame.
 */
export function repaint(pixels: Uint8ClampedArray, width: number, look: number): void {
  const parts = decodeLook(look);
  const body = BODIES[parts.body]!;
  const swaps = [
    ...swapsFor(body.hair, HAIR_COLOURS[parts.hair]),
    ...swapsFor(body.top, TOP_COLOURS[parts.top]),
    ...swapsFor({ colours: body.skin, fromY: 0, toY: TILE_SIZE }, SKIN_TONES[parts.skin]),
  ];
  if (swaps.length === 0) return;

  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] === 0) continue;
    const rowInFrame = Math.floor(i / 4 / width) % TILE_SIZE;
    const swap = swaps.find(
      (s) =>
        rowInFrame >= s.fromY &&
        rowInFrame < s.toY &&
        s.from[0] === pixels[i] &&
        s.from[1] === pixels[i + 1] &&
        s.from[2] === pixels[i + 2],
    );
    if (!swap) continue;
    pixels[i] = swap.to[0];
    pixels[i + 1] = swap.to[1];
    pixels[i + 2] = swap.to[2];
  }
}

const cache = new Map<number, HTMLCanvasElement>();

/** A look's 4x3 frame sheet, painted once and then reused. */
export function lookSheet(tilesheet: CanvasImageSource, look: number): HTMLCanvasElement {
  const cached = cache.get(look);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = VIEWS * TILE_SIZE;
  canvas.height = POSES * TILE_SIZE;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;

  const body = BODIES[decodeLook(look).body]!;
  const stride = TILE_SIZE + SHEET_SPACING;
  for (let pose = 0; pose < POSES; pose += 1) {
    for (let view = 0; view < VIEWS; view += 1) {
      context.drawImage(
        tilesheet,
        (FIRST_COLUMN + view) * stride,
        (body.sheetRow + pose) * stride,
        TILE_SIZE,
        TILE_SIZE,
        view * TILE_SIZE,
        pose * TILE_SIZE,
        TILE_SIZE,
        TILE_SIZE,
      );
    }
  }

  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  repaint(image.data, canvas.width, look);
  context.putImageData(image, 0, 0);

  cache.set(look, canvas);
  return canvas;
}

let sheetPromise: Promise<HTMLImageElement> | null = null;

/** The town tilesheet, for drawing outside Phaser (portraits). Loaded once. */
export function loadTilesheet(): Promise<HTMLImageElement> {
  sheetPromise ??= new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = `${import.meta.env.BASE_URL}assets/town/tilemap.png`;
  });
  return sheetPromise;
}

