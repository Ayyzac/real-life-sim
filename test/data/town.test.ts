import { describe, expect, it } from 'vitest';

import { LOCATIONS } from '../../src/data/locations';
import {
  BUILDINGS,
  GROUND,
  GROUND_TILES,
  PROPS,
  TOWN_COLUMNS,
  TOWN_ROWS,
  buildWalkable,
  doorOf,
  locationAt,
} from '../../src/data/town';
import { findPath } from '../../src/world/pathfinding';

/**
 * These are map-validity tests, not gameplay tests. A town where one door
 * cannot be reached looks perfectly fine on screen and simply never lets the
 * player in - so the map has to be checked by machine, not by eye.
 */
describe('town map', () => {
  it('is a rectangle of the declared size', () => {
    expect(GROUND).toHaveLength(TOWN_ROWS);
    for (const row of GROUND) {
      expect(row).toHaveLength(TOWN_COLUMNS);
    }
  });

  it('uses only ground characters that have a tile', () => {
    for (const row of GROUND) {
      for (const char of row) {
        expect(GROUND_TILES[char], `no tile for '${char}'`).toBeDefined();
      }
    }
  });

  it('keeps every building and prop inside the map', () => {
    for (const building of BUILDINGS) {
      expect(building.x).toBeGreaterThanOrEqual(0);
      expect(building.y).toBeGreaterThanOrEqual(0);
      expect(building.x + building.width).toBeLessThanOrEqual(TOWN_COLUMNS);
      expect(building.y + building.height).toBeLessThanOrEqual(TOWN_ROWS);
    }

    for (const prop of PROPS) {
      expect(prop.x).toBeGreaterThanOrEqual(0);
      expect(prop.y).toBeGreaterThanOrEqual(0);
      expect(prop.x).toBeLessThan(TOWN_COLUMNS);
      expect(prop.y).toBeLessThan(TOWN_ROWS);
    }
  });

  it('gives every location exactly one building', () => {
    const ids = BUILDINGS.map((b) => b.locationId);

    expect([...ids].sort()).toEqual(LOCATIONS.map((l) => l.id).sort());
  });

  it('puts each door on its own building and nowhere else', () => {
    for (const building of BUILDINGS) {
      expect(building.doorX).toBeGreaterThanOrEqual(building.x);
      expect(building.doorX).toBeLessThan(building.x + building.width);

      const door = doorOf(building.locationId);
      expect(locationAt(door.x, door.y)).toBe(building.locationId);
    }
  });

  it('never stands two buildings on the same square', () => {
    const taken = new Set<string>();

    for (const building of BUILDINGS) {
      for (let y = building.y; y < building.y + building.height; y += 1) {
        for (let x = building.x; x < building.x + building.width; x += 1) {
          expect(taken.has(`${x},${y}`), `overlap at ${x},${y}`).toBe(false);
          taken.add(`${x},${y}`);
        }
      }
    }
  });

  it('never stands a prop inside a building or on the pavement', () => {
    const walkable = buildWalkable();

    for (const prop of PROPS) {
      expect(GROUND[prop.y]?.[prop.x], `prop at ${prop.x},${prop.y}`).toBe('g');
      expect(walkable[prop.y]?.[prop.x]).toBe(false);
    }
  });

  it('leaves every door walkable and the rest of the building solid', () => {
    const walkable = buildWalkable();

    for (const building of BUILDINGS) {
      const doorY = building.y + building.height - 1;

      for (let y = building.y; y < building.y + building.height; y += 1) {
        for (let x = building.x; x < building.x + building.width; x += 1) {
          const isDoor = x === building.doorX && y === doorY;
          expect(walkable[y]?.[x], `${x},${y}`).toBe(isDoor);
        }
      }
    }
  });

  it('lets the character walk from any door to any other door', () => {
    const walkable = buildWalkable();
    const doors = LOCATIONS.map((l) => doorOf(l.id));

    for (const from of doors) {
      for (const to of doors) {
        const path = findPath(walkable, from, to);
        expect(path, `no route from ${from.x},${from.y} to ${to.x},${to.y}`).not.toBeNull();
      }
    }
  });

  it('keeps the road off limits except at the crossings', () => {
    const walkable = buildWalkable();

    for (let y = 0; y < TOWN_ROWS; y += 1) {
      for (let x = 0; x < TOWN_COLUMNS; x += 1) {
        const char = GROUND[y]?.[x];
        if (char === '=' || char === '-') expect(walkable[y]?.[x]).toBe(false);
        if (char === 'z') expect(walkable[y]?.[x]).toBe(true);
      }
    }
  });

  it('makes crossing the road the only way between the two sides', () => {
    const walkable = buildWalkable();
    // Seal the crossings and the north and south sides should fall apart.
    for (let y = 0; y < TOWN_ROWS; y += 1) {
      for (let x = 0; x < TOWN_COLUMNS; x += 1) {
        if (GROUND[y]?.[x] === 'z') {
          const row = walkable[y];
          if (row) row[x] = false;
        }
      }
    }

    expect(findPath(walkable, doorOf('home'), doorOf('cafe'))).toBeNull();
  });
});
