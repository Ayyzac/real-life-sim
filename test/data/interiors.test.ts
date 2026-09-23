import { describe, expect, it } from 'vitest';

import { findAction } from '../../src/data/actions';
import { INTERIORS, ROOM, interiorFor, roomWalkable, type Interior } from '../../src/data/interiors';
import { LOCATIONS } from '../../src/data/locations';
import { findPath } from '../../src/world/pathfinding';

/** Which place a room belongs to, from its id. */
function placeOf(room: Interior): string {
  return room.id.split('_')[0]!;
}

describe('rooms inside buildings (GDD §11.4)', () => {
  it('gives every place in town a room', () => {
    const character = { owned: [], career: { type: 'none' as const } };
    for (const place of LOCATIONS) {
      expect(interiorFor(place.id, character)).toBeTruthy();
    }
  });

  it('keeps every piece of furniture inside the room and off the back wall', () => {
    for (const room of INTERIORS) {
      for (const piece of room.pieces) {
        const width = piece.frames[0]?.length ?? 0;
        expect(piece.x, room.id).toBeGreaterThanOrEqual(0);
        expect(piece.x + width, room.id).toBeLessThanOrEqual(ROOM.columns);
        expect(piece.y, room.id).toBeGreaterThanOrEqual(ROOM.wallRows);
        expect(piece.y + piece.frames.length, room.id).toBeLessThanOrEqual(ROOM.rows);
      }
    }
  });

  it('never blocks the way out', () => {
    for (const room of INTERIORS) {
      expect(roomWalkable(room)[ROOM.exit.y]?.[ROOM.exit.x], room.id).toBe(true);
    }
  });

  it('lets the player reach every visitor spot from the door', () => {
    for (const room of INTERIORS) {
      const grid = roomWalkable(room);
      for (const spot of room.spots) {
        expect(findPath(grid, ROOM.exit, spot), `${room.id} ${spot.x},${spot.y}`).not.toBeNull();
      }
    }
  });

  it('lets the player reach every piece of furniture that does something', () => {
    for (const room of INTERIORS) {
      const grid = roomWalkable(room);
      for (const piece of room.pieces.filter((p) => p.action)) {
        const width = piece.frames[0]?.length ?? 1;
        const beside: { x: number; y: number }[] = [];
        for (let y = piece.y - 1; y <= piece.y + piece.frames.length; y += 1) {
          for (let x = piece.x - 1; x <= piece.x + width; x += 1) {
            if (grid[y]?.[x]) beside.push({ x, y });
          }
        }
        const reachable = beside.some((square) => findPath(grid, ROOM.exit, square) !== null);
        expect(reachable, `${room.id} ${piece.action}`).toBe(true);
      }
    }
  });

  it('only offers actions that exist, at the place they belong to', () => {
    for (const room of INTERIORS) {
      for (const piece of room.pieces.filter((p) => p.action)) {
        const action = findAction(piece.action!);
        expect(action.locationId, `${room.id} ${piece.action}`).toBe(placeOf(room));
      }
    }
  });

  it('shows the home the character owns', () => {
    const career = { type: 'none' as const };
    expect(interiorFor('home', { owned: [], career }).id).toBe('home_room');
    expect(interiorFor('home', { owned: ['flat'], career }).id).toBe('home_flat');
    expect(interiorFor('home', { owned: ['flat', 'house'], career }).id).toBe('home_house');
  });

  it('fits out the business unit for the business being run', () => {
    const owner = { owned: [], career: { type: 'business' as const, businessId: 'bookshop', daysOpen: 0, level: 0 } };
    expect(interiorFor('business', owner).id).toBe('business_bookshop');
    expect(interiorFor('business', { owned: [], career: { type: 'none' as const } }).id).toBe('business_empty');
  });
});
