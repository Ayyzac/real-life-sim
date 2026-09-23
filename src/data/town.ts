import type { LocationId } from '../core/types';

/**
 * The town, as data (CLAUDE.md rule 2).
 *
 * Nothing here knows about Phaser. The scene reads these numbers and draws
 * them; the pathfinder reads the same numbers and walks them. Moving a
 * building or adding a tree is an edit to this file, never to the engine.
 *
 * Tile indices come from the Kenney RPG Urban Pack sheet in
 * public/assets/town/. The sheet is 27 tiles wide with 1px between tiles, so
 * index = row * 27 + column. docs/ASSETS.md lists the ones picked out here.
 */

export const TILE_SIZE = 16;
export const SHEET_COLUMNS = 27;
/** The spaced tilesheet, chosen over the packed one to avoid texture bleed. */
export const SHEET_SPACING = 1;

/**
 * The town is two districts side by side. One district fills the screen
 * exactly (25x14 tiles at 16px, drawn at 2x = 800x448); the camera slides
 * between them.
 *
 * Phase 2 recorded "no moving camera, no bigger map" and also that adding one
 * later would be cheap. This is that later (user request, 22 Sep 2026).
 */
export const VIEW_COLUMNS = 25;
export const TOWN_ROWS = 14;
export const TOWN_ZOOM = 2;

export interface District {
  id: string;
  label: string;
  /** Left-hand column of this district in the full grid. */
  x: number;
}

export const DISTRICTS: readonly District[] = [
  { id: 'downtown', label: 'Downtown', x: 0 },
  { id: 'eastside', label: 'Eastside', x: VIEW_COLUMNS },
];

export const TOWN_COLUMNS = DISTRICTS.length * VIEW_COLUMNS;

/** Which district a column belongs to. */
export function districtOf(x: number): number {
  return Math.min(DISTRICTS.length - 1, Math.max(0, Math.floor(x / VIEW_COLUMNS)));
}

/** One character in the `GROUND` art below. */
export interface GroundTile {
  tile: number;
  walkable: boolean;
}

/**
 * The floor of the town. Buildings and trees are drawn on top of it, so every
 * square has something underneath and nothing shows through.
 *
 * Roads are deliberately NOT walkable: the two crossings are the only way over,
 * which is what makes the map worth pathfinding through at all.
 */
export const GROUND_TILES: Readonly<Record<string, GroundTile>> = {
  g: { tile: 28, walkable: true }, // grass
  '.': { tile: 36, walkable: true }, // pavement
  '=': { tile: 440, walkable: false }, // asphalt
  '-': { tile: 433, walkable: false }, // asphalt, centre line
  z: { tile: 435, walkable: true }, // painted crossing
};

/**
 * 50 characters per row, 14 rows - both districts in one grid, so the
 * character can simply walk from one to the other and the pathfinder needs to
 * know nothing about districts at all.
 */
export const GROUND: readonly string[] = [
  'gggggggggggggggggggggggggggggggggggggggggggggggggg',
  'gggggggggggggggggggggggggggggggggggggggggggggggggg',
  'gggggggggggggggggggggggggggggggggggggggggggggggggg',
  'gggggggggggggggggggggggggggggggggggggggggggggggggg',
  '..................................................',
  '=======zz=======zz==============zz=======zz=======',
  '-------zz-------zz--------------zz-------zz-------',
  '=======zz=======zz==============zz=======zz=======',
  '..................................................',
  'gggggggggggggggggggggggggggggggggggggggggggggggggg',
  'gggggggggggggggggggggggggggggggggggggggggggggggggg',
  'gggggggggggggggggggggggggggggggggggggggggggggggggg',
  'gggggggggggggggggggggggggggggggggggggggggggggggggg',
  '..................................................',
];

/**
 * A place on the map. Drawn as a block of `wallTile` with one row of
 * `bandTile` for windows and a single `doorTile` on the bottom row.
 *
 * The door square is walkable, and arriving on it is what opens the location's
 * menu. Every other square of the building blocks.
 */
export interface TownBuilding {
  locationId: LocationId;
  /** Top-left corner, in tiles. */
  x: number;
  y: number;
  width: number;
  height: number;
  wallTile: number;
  /** Row of windows, drawn at `y + 1`. */
  bandTile: number;
  doorTile: number;
  /** Absolute column of the door. It always sits on the bottom row. */
  doorX: number;
  /**
   * Optional repaint. The pack's concrete wall is the same grey as the
   * pavement, so an untinted concrete building reads as an empty square
   * rather than a building.
   */
  tint?: number;
}

export const BUILDINGS: readonly TownBuilding[] = [
  // North side of the road: doors face down onto the pavement at row 4.
  { locationId: 'home', x: 1, y: 0, width: 5, height: 4, wallTile: 72, bandTile: 45, doorTile: 255, doorX: 3 },
  { locationId: 'work', x: 9, y: 0, width: 5, height: 4, wallTile: 41, bandTile: 68, doorTile: 443, doorX: 11, tint: 0x8fa8d8 },
  { locationId: 'gym', x: 17, y: 0, width: 5, height: 4, wallTile: 180, bandTile: 153, doorTile: 310, doorX: 19 },
  // South side: doors face down onto the pavement at row 13.
  { locationId: 'cafe', x: 3, y: 9, width: 5, height: 4, wallTile: 72, bandTile: 45, doorTile: 336, doorX: 5 },
  { locationId: 'business', x: 9, y: 9, width: 5, height: 4, wallTile: 41, bandTile: 68, doorTile: 312, doorX: 11, tint: 0xe8c97a },
  { locationId: 'hospital', x: 15, y: 9, width: 6, height: 4, wallTile: 41, bandTile: 68, doorTile: 257, doorX: 17, tint: 0xa8ded0 },
  // Eastside. Deliberately the biggest building in town.
  { locationId: 'stadium', x: 29, y: 0, width: 9, height: 4, wallTile: 41, bandTile: 68, doorTile: 338, doorX: 33, tint: 0x9fd8a8 },
];

/** Scenery. Blocks walking, so keep them off the pavement. */
export interface TownProp {
  x: number;
  y: number;
  tile: number;
}

export const PROPS: readonly TownProp[] = [
  { x: 0, y: 1, tile: 291 },
  { x: 7, y: 0, tile: 292 },
  { x: 7, y: 2, tile: 345 },
  { x: 15, y: 1, tile: 291 },
  { x: 23, y: 2, tile: 346 },
  { x: 24, y: 0, tile: 292 },
  { x: 1, y: 10, tile: 238 },
  { x: 0, y: 11, tile: 291 },
  { x: 24, y: 10, tile: 346 },
  { x: 22, y: 10, tile: 292 },
  { x: 23, y: 11, tile: 345 },
  { x: 26, y: 1, tile: 292 },
  { x: 27, y: 2, tile: 291 },
  { x: 39, y: 1, tile: 346 },
  { x: 47, y: 2, tile: 291 },
  { x: 26, y: 10, tile: 238 },
  { x: 30, y: 10, tile: 291 },
  { x: 34, y: 11, tile: 292 },
  { x: 44, y: 10, tile: 345 },
  { x: 48, y: 11, tile: 346 },
];

/**
 * How busy the town looks. Pure decoration - the crowd never touches the
 * simulation, so these numbers only cost frames, never balance.
 */
export const CROWD = {
  people: 40,
  cars: 14,
  /** Pavement rows the crowd walks along, top to bottom. */
  walkRows: [4, 8, 13],
  /** Middle of each traffic lane, in pixels from the top of the map. */
  laneY: { eastbound: 88, westbound: 120 },
} as const;

/**
 * Cars are two tiles by two: [top-left, top-right, bottom-left, bottom-right].
 * The pack draws them NOSE-DOWN - lamps, windscreen, wheels and shadow are all
 * on the bottom edge - so a car driving across the screen is that sprite turned
 * a quarter turn with its bottom leading. Until Phase 6 this said nose-up, and
 * every car in town drove backwards.
 */
export const CAR_TILES: readonly (readonly [number, number, number, number])[] = [
  [447, 448, 474, 475],
  [450, 451, 477, 478],
];

/** Paint jobs, so eight cars are not eight identical cars. */
export const CAR_TINTS: readonly number[] = [
  0xffffff, 0x7fb2ff, 0xffe066, 0x8de08d, 0xd0d0d8, 0xc98cff,
];

/** Where a character standing in `locationId` is drawn: on that door. */
export function doorOf(locationId: LocationId): { x: number; y: number } {
  const building = BUILDINGS.find((b) => b.locationId === locationId);
  if (!building) throw new Error(`No building for location: ${locationId}`);
  return { x: building.doorX, y: building.y + building.height - 1 };
}

/** The building covering this square, if any. */
export function buildingAt(x: number, y: number): TownBuilding | undefined {
  return BUILDINGS.find(
    (b) => x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height,
  );
}

/** The location whose door is on this square, if any. */
export function locationAt(x: number, y: number): LocationId | null {
  const building = BUILDINGS.find(
    (b) => b.doorX === x && b.y + b.height - 1 === y,
  );
  return building ? building.locationId : null;
}

/**
 * Which squares can be walked on: the ground says yes, and no building or prop
 * is standing there. Doors are the one exception - they are the way in.
 *
 * Built fresh from the data above rather than stored, so the two can never
 * drift apart.
 */
export function buildWalkable(): boolean[][] {
  const grid: boolean[][] = GROUND.map((row) =>
    [...row].map((char) => GROUND_TILES[char]?.walkable ?? false),
  );

  for (const building of BUILDINGS) {
    const doorY = building.y + building.height - 1;
    for (let y = building.y; y < building.y + building.height; y += 1) {
      for (let x = building.x; x < building.x + building.width; x += 1) {
        const isDoor = x === building.doorX && y === doorY;
        const row = grid[y];
        if (row) row[x] = isDoor;
      }
    }
  }

  for (const prop of PROPS) {
    const row = grid[prop.y];
    if (row) row[prop.x] = false;
  }

  return grid;
}
