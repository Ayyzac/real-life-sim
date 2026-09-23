import { encodeLook } from '../core/look';
import type { Character, LocationId } from '../core/types';

/**
 * Rooms inside the buildings (GDD §11.4), as data.
 *
 * Every room is the same 14x8 grid seen from the front: two rows of back wall
 * (a wall row, then a row of windows), six rows of floor, and the way out at
 * the bottom middle. What differs is floor, wall and furniture - so a new room
 * is a new entry here, never a new scene.
 *
 * Furniture comes from Kenney's Roguelike Indoors sheet ('indoor', in
 * public/assets/indoor/); floors and walls from the town sheet ('town').
 * Both are 27 tiles wide, index = row * 27 + column. docs/ASSETS.md lists them.
 */

export type Sheet = 'town' | 'indoor';

/**
 * A piece of furniture. `frames` are its tiles row by row, so a 3x2 table is
 * two rows of three. It blocks walking unless `walkable` (rugs, mats). With
 * an `action`, clicking it walks over and does that action.
 */
export interface Piece {
  x: number;
  y: number;
  frames: readonly (readonly number[])[];
  sheet?: Sheet;
  action?: string;
  walkable?: boolean;
}

/** Somebody who works here: not a person the player knows, just a role. */
export interface Staff {
  x: number;
  y: number;
  role: string;
  look: number;
}

export interface Interior {
  id: string;
  label: string;
  floor: { tile: number; sheet: Sheet };
  wall: { tile: number; band: number; tint?: number };
  pieces: readonly Piece[];
  staff?: readonly Staff[];
  /** Where visitors stand, in order of arrival. */
  spots: readonly { x: number; y: number }[];
}

export const ROOM = { columns: 14, rows: 8, wallRows: 2, exit: { x: 7, y: 7 } } as const;

// Tiles used more than once, by name.
const T = {
  beige: { tile: 109, sheet: 'town' as const },
  grey: { tile: 36, sheet: 'town' as const },
  orangeCarpet: { tile: 51, sheet: 'indoor' as const },
  greenCarpet: { tile: 159, sheet: 'indoor' as const },
  brick: { tile: 72, band: 45 },
  orangeWall: { tile: 180, band: 153 },
  concrete: (tint: number) => ({ tile: 41, band: 68, tint }),
};

const I = {
  // One row each: the row below them in the sheet is a second table, not the
  // bottom half of this one.
  longTable: [[0, 1, 2]],
  ovalTable: [[3, 4]],
  piano: [
    [239, 240],
    [266, 267],
  ],
  roundTable: [[7]],
  smallTable: [[58]],
  deskTable: [[112]],
  chairDown: [[54]],
  chairUp: [[55]],
  chairRight: [[56]],
  chairLeft: [[57]],
  whiteChair: [[216]],
  bedOrange: [[171]],
  bedGreen: [[198]],
  counter: [[324, 325, 326]],
  counterShort: [[325]],
  sink: [[332]],
  stove: [[392]],
  fridge: [[416]],
  bottles: [[329, 330]],
  paperCounter: [[331]],
  bookshelf: [[478, 479, 480]],
  plant: [[16]],
  plantTall: [[17]],
  mirror: [[400]],
  cooler: [[129]],
  rugOrange: [[421, 422, 423]],
  rugGreen: [[448, 449, 450]],
  bench: [[166, 167, 168, 169]],
  benchCushion: [[193, 194, 195, 196]],
};

const look = (body: number, hair: number, top: number, skin: number): number =>
  encodeLook({ body, hair, top, skin });

const HOME_ROOM: Interior = {
  id: 'home_room',
  label: 'Your room',
  floor: T.beige,
  wall: T.brick,
  pieces: [
    { x: 1, y: 2, frames: I.bedOrange },
    { x: 1, y: 3, frames: I.plant },
    { x: 3, y: 2, frames: I.smallTable },
    { x: 4, y: 2, frames: I.chairLeft },
    { x: 3, y: 5, frames: I.rugGreen, walkable: true },
    { x: 9, y: 2, frames: I.counterShort },
    { x: 10, y: 2, frames: I.sink, action: 'water' },
    { x: 11, y: 2, frames: I.stove, action: 'cook' },
    { x: 12, y: 2, frames: I.fridge, action: 'cook' },
    { x: 13, y: 5, frames: I.mirror, action: 'shower' },
  ],
  spots: [
    { x: 5, y: 4 },
    { x: 6, y: 5 },
    { x: 9, y: 4 },
  ],
};

const HOME_FLAT: Interior = {
  ...HOME_ROOM,
  id: 'home_flat',
  label: 'Your flat',
  floor: T.greenCarpet,
  pieces: [
    { x: 1, y: 2, frames: I.bedGreen },
    { x: 2, y: 2, frames: I.bedGreen },
    { x: 0, y: 4, frames: I.bookshelf },
    { x: 4, y: 2, frames: I.plantTall },
    { x: 3, y: 5, frames: I.ovalTable },
    { x: 2, y: 5, frames: I.chairRight },
    { x: 5, y: 5, frames: I.chairLeft },
    { x: 9, y: 2, frames: I.counter },
    { x: 12, y: 2, frames: I.sink, action: 'water' },
    { x: 13, y: 2, frames: I.stove, action: 'cook' },
    { x: 13, y: 3, frames: I.fridge, action: 'cook' },
    { x: 13, y: 6, frames: I.mirror, action: 'shower' },
    { x: 9, y: 5, frames: I.rugOrange, walkable: true },
  ],
};

const HOME_HOUSE: Interior = {
  ...HOME_ROOM,
  id: 'home_house',
  label: 'Your house',
  floor: T.orangeCarpet,
  pieces: [
    { x: 0, y: 2, frames: I.bedGreen },
    { x: 1, y: 2, frames: I.bedGreen },
    { x: 3, y: 2, frames: I.piano },
    { x: 0, y: 5, frames: I.bookshelf },
    { x: 5, y: 2, frames: I.plantTall },
    { x: 3, y: 5, frames: I.longTable },
    { x: 2, y: 5, frames: I.chairRight },
    { x: 6, y: 5, frames: I.chairLeft },
    { x: 9, y: 2, frames: I.counter },
    { x: 12, y: 2, frames: I.sink, action: 'water' },
    { x: 13, y: 2, frames: I.stove, action: 'cook' },
    { x: 13, y: 3, frames: I.fridge, action: 'cook' },
    { x: 13, y: 6, frames: I.mirror, action: 'shower' },
    { x: 12, y: 6, frames: I.plant },
    { x: 9, y: 5, frames: I.rugGreen, walkable: true },
  ],
  spots: [
    { x: 7, y: 4 },
    { x: 8, y: 5 },
    { x: 10, y: 4 },
  ],
};

const CAFE: Interior = {
  id: 'cafe',
  label: 'Cafe',
  floor: T.beige,
  wall: T.brick,
  pieces: [
    { x: 1, y: 2, frames: I.bottles, action: 'coffee' },
    { x: 3, y: 2, frames: I.counter, action: 'coffee' },
    { x: 13, y: 2, frames: I.plant },
    { x: 0, y: 2, frames: I.plantTall },
    { x: 2, y: 5, frames: I.roundTable, action: 'cafe_meal' },
    { x: 1, y: 5, frames: I.chairRight },
    { x: 3, y: 5, frames: I.chairLeft },
    { x: 9, y: 4, frames: I.ovalTable, action: 'cafe_meal' },
    { x: 8, y: 4, frames: I.chairRight },
    { x: 11, y: 4, frames: I.chairLeft },
    { x: 12, y: 6, frames: I.roundTable, action: 'cafe_meal' },
    { x: 11, y: 6, frames: I.chairRight },
    { x: 13, y: 6, frames: I.chairLeft },
  ],
  staff: [{ x: 4, y: 3, role: 'Barista', look: look(1, 2, 7, 0) }],
  spots: [
    { x: 1, y: 6 },
    { x: 3, y: 6 },
    { x: 8, y: 5 },
    { x: 11, y: 5 },
    { x: 10, y: 6 },
  ],
};

const HOSPITAL: Interior = {
  id: 'hospital',
  label: 'Hospital',
  floor: T.grey,
  wall: T.concrete(0xa8ded0),
  pieces: [
    { x: 5, y: 2, frames: I.counter, action: 'checkup' },
    { x: 8, y: 2, frames: I.paperCounter, action: 'checkup' },
    { x: 1, y: 2, frames: I.bedGreen },
    { x: 1, y: 4, frames: I.bedGreen },
    { x: 1, y: 6, frames: I.bedGreen },
    { x: 11, y: 5, frames: I.whiteChair },
    { x: 12, y: 5, frames: I.whiteChair },
    { x: 13, y: 5, frames: I.whiteChair },
    { x: 13, y: 2, frames: I.plantTall },
  ],
  staff: [
    { x: 6, y: 3, role: 'Nurse', look: look(1, 1, 6, 2) },
    { x: 2, y: 3, role: 'Doctor', look: look(2, 0, 6, 0) },
  ],
  spots: [
    { x: 11, y: 6 },
    { x: 12, y: 6 },
    { x: 10, y: 4 },
  ],
};

const GYM: Interior = {
  id: 'gym',
  label: 'Gym',
  floor: T.grey,
  wall: T.orangeWall,
  pieces: [
    { x: 1, y: 2, frames: I.mirror },
    { x: 2, y: 2, frames: I.mirror },
    { x: 3, y: 2, frames: I.mirror },
    { x: 1, y: 4, frames: I.rugGreen, walkable: true, action: 'workout' },
    { x: 1, y: 6, frames: I.bench, action: 'workout' },
    { x: 10, y: 2, frames: I.sink, action: 'gym_shower' },
    { x: 11, y: 2, frames: I.mirror, action: 'gym_shower' },
    { x: 13, y: 2, frames: I.cooler, action: 'gym_water' },
    { x: 10, y: 5, frames: I.benchCushion },
  ],
  staff: [{ x: 5, y: 4, role: 'Trainer', look: look(3, 1, 1, 3) }],
  spots: [
    { x: 2, y: 4 },
    { x: 4, y: 5 },
    { x: 11, y: 4 },
  ],
};

const WORK: Interior = {
  id: 'work',
  label: 'Office',
  floor: T.greenCarpet,
  wall: T.concrete(0x8fa8d8),
  pieces: [
    { x: 1, y: 3, frames: I.deskTable },
    { x: 1, y: 4, frames: I.chairUp },
    { x: 3, y: 3, frames: I.deskTable },
    { x: 3, y: 4, frames: I.chairUp },
    { x: 10, y: 3, frames: I.deskTable },
    { x: 10, y: 4, frames: I.chairUp },
    { x: 12, y: 3, frames: I.deskTable },
    { x: 12, y: 4, frames: I.chairUp },
    { x: 0, y: 2, frames: I.bookshelf },
    { x: 11, y: 2, frames: I.bookshelf },
    { x: 6, y: 2, frames: I.cooler },
    { x: 13, y: 6, frames: I.plantTall },
    { x: 0, y: 6, frames: I.plant },
  ],
  staff: [{ x: 7, y: 3, role: 'Receptionist', look: look(4, 5, 7, 1) }],
  spots: [
    { x: 2, y: 4 },
    { x: 4, y: 5 },
    { x: 11, y: 5 },
    { x: 9, y: 4 },
  ],
};

const STADIUM: Interior = {
  id: 'stadium',
  label: 'Changing rooms',
  floor: T.grey,
  wall: T.concrete(0x9fd8a8),
  pieces: [
    { x: 1, y: 3, frames: I.bench },
    { x: 1, y: 5, frames: I.bench },
    { x: 9, y: 3, frames: I.bench },
    { x: 11, y: 2, frames: I.sink },
    { x: 12, y: 2, frames: I.mirror },
    { x: 13, y: 2, frames: I.cooler },
    { x: 9, y: 5, frames: I.rugGreen, walkable: true },
  ],
  staff: [{ x: 6, y: 3, role: 'Coach', look: look(0, 5, 2, 2) }],
  spots: [
    { x: 2, y: 4 },
    { x: 3, y: 6 },
    { x: 10, y: 4 },
  ],
};

/** The shop you own, one fitting per kind of business (GDD §4.2). */
function shop(id: string, label: string, pieces: readonly Piece[]): Interior {
  return {
    id,
    label,
    floor: T.beige,
    wall: T.concrete(0xe8c97a),
    pieces: [{ x: 5, y: 2, frames: I.counter }, { x: 13, y: 6, frames: I.plant }, ...pieces],
    staff: [{ x: 6, y: 3, role: 'Assistant', look: look(5, 3, 3, 1) }],
    spots: [
      { x: 3, y: 5 },
      { x: 9, y: 5 },
      { x: 11, y: 4 },
    ],
  };
}

const MALL: Interior = {
  id: 'mall',
  label: 'Mall',
  floor: T.beige,
  wall: T.orangeWall,
  pieces: [
    { x: 1, y: 2, frames: I.counter, action: 'food_court' },
    { x: 4, y: 2, frames: I.bottles, action: 'bubble_tea' },
    { x: 6, y: 2, frames: I.bookshelf },
    { x: 10, y: 2, frames: [[400, 400, 400, 400]], action: 'cinema' },
    { x: 10, y: 4, frames: [[217, 217, 217, 217]] },
    { x: 10, y: 5, frames: [[217, 217, 217, 217]] },
    { x: 1, y: 5, frames: I.roundTable, action: 'food_court' },
    { x: 0, y: 5, frames: I.chairRight },
    { x: 2, y: 5, frames: I.chairLeft },
    { x: 4, y: 5, frames: I.roundTable, action: 'food_court' },
    { x: 3, y: 5, frames: I.chairRight },
    { x: 5, y: 5, frames: I.chairLeft },
    { x: 6, y: 4, frames: I.rugOrange, walkable: true },
    { x: 13, y: 6, frames: I.plantTall },
  ],
  staff: [
    { x: 2, y: 3, role: 'Cook', look: look(4, 0, 6, 3) },
    { x: 8, y: 3, role: 'Shop', look: look(1, 4, 9, 1) },
  ],
  spots: [
    { x: 1, y: 6 },
    { x: 4, y: 6 },
    { x: 7, y: 5 },
    { x: 9, y: 6 },
    { x: 12, y: 6 },
  ],
};

/** Shelves and a till; the shopping itself is in the Here tab (GDD §12). */
const SUPERMARKET: Interior = {
  id: 'supermarket',
  label: 'Supermarket',
  floor: T.grey,
  wall: T.concrete(0xf2a7a0),
  pieces: [
    { x: 1, y: 2, frames: I.fridge },
    { x: 2, y: 2, frames: I.fridge },
    { x: 3, y: 2, frames: I.cooler },
    { x: 5, y: 2, frames: I.bottles },
    { x: 1, y: 4, frames: I.bookshelf },
    { x: 9, y: 4, frames: I.bookshelf },
    { x: 9, y: 6, frames: I.counter },
    { x: 13, y: 6, frames: I.plant },
  ],
  staff: [{ x: 10, y: 5, role: 'Cashier', look: look(2, 3, 4, 2) }],
  spots: [
    { x: 2, y: 5 },
    { x: 6, y: 3 },
    { x: 12, y: 3 },
  ],
};

const EMPTY_UNIT: Interior = {
  id: 'business_empty',
  label: 'Empty unit',
  floor: T.grey,
  wall: T.concrete(0xe8c97a),
  pieces: [{ x: 12, y: 2, frames: I.plant }],
  spots: [],
};

const BUSINESSES: Record<string, Interior> = {
  market_stall: shop('business_market_stall', 'Market stall', [
    { x: 1, y: 3, frames: I.bottles },
    { x: 10, y: 3, frames: I.bottles },
  ]),
  online_shop: shop('business_online_shop', 'Online shop', [
    { x: 1, y: 3, frames: I.deskTable },
    { x: 1, y: 4, frames: I.chairUp },
    { x: 10, y: 2, frames: I.bookshelf },
  ]),
  repair_workshop: shop('business_repair_workshop', 'Repair workshop', [
    { x: 1, y: 2, frames: I.bench },
    { x: 10, y: 6, frames: I.counter },
  ]),
  laundrette: shop('business_laundrette', 'Laundrette', [
    { x: 1, y: 2, frames: I.stove },
    { x: 2, y: 2, frames: I.stove },
    { x: 3, y: 2, frames: I.stove },
    { x: 10, y: 5, frames: I.benchCushion },
  ]),
  bookshop: shop('business_bookshop', 'Bookshop', [
    { x: 0, y: 2, frames: I.bookshelf },
    { x: 10, y: 2, frames: I.bookshelf },
    { x: 1, y: 6, frames: I.bookshelf },
  ]),
  restaurant: shop('business_restaurant', 'Restaurant', [
    { x: 1, y: 4, frames: I.ovalTable },
    { x: 9, y: 6, frames: I.ovalTable },
    { x: 11, y: 2, frames: I.stove },
    { x: 12, y: 2, frames: I.stove },
  ]),
};

export const INTERIORS: readonly Interior[] = [
  HOME_ROOM,
  HOME_FLAT,
  HOME_HOUSE,
  CAFE,
  HOSPITAL,
  GYM,
  WORK,
  STADIUM,
  MALL,
  SUPERMARKET,
  EMPTY_UNIT,
  ...Object.values(BUSINESSES),
];

/**
 * Which room a place shows for this character: home depends on the home they
 * own (GDD §11.4), the business unit on the business they run.
 */
export function interiorFor(locationId: LocationId, character: Pick<Character, 'owned' | 'career'>): Interior {
  switch (locationId) {
    case 'home':
      if (character.owned.includes('house')) return HOME_HOUSE;
      if (character.owned.includes('flat')) return HOME_FLAT;
      return HOME_ROOM;
    case 'cafe':
      return CAFE;
    case 'hospital':
      return HOSPITAL;
    case 'gym':
      return GYM;
    case 'work':
      return WORK;
    case 'stadium':
      return STADIUM;
    case 'mall':
      return MALL;
    case 'supermarket':
      return SUPERMARKET;
    case 'business':
      return character.career.type === 'business'
        ? (BUSINESSES[character.career.businessId] ?? EMPTY_UNIT)
        : EMPTY_UNIT;
  }
}

/** Walkable squares of a room: floor, rugs and the way out; not walls or furniture. */
export function roomWalkable(interior: Interior): boolean[][] {
  const grid = Array.from({ length: ROOM.rows }, (_, y) =>
    Array.from({ length: ROOM.columns }, () => y >= ROOM.wallRows),
  );
  for (const piece of interior.pieces) {
    if (piece.walkable) continue;
    piece.frames.forEach((row, dy) =>
      row.forEach((_, dx) => {
        const line = grid[piece.y + dy];
        if (line && piece.x + dx < ROOM.columns) line[piece.x + dx] = false;
      }),
    );
  }
  for (const person of interior.staff ?? []) {
    const line = grid[person.y];
    if (line) line[person.x] = false;
  }
  return grid;
}
