import { describe, expect, it } from 'vitest';

import { findPath, type Point } from '../../src/world/pathfinding';

/** '.' walks, '#' blocks. Easier to read than nested boolean arrays. */
function grid(...rows: string[]): boolean[][] {
  return rows.map((row) => [...row].map((char) => char === '.'));
}

function stepsAreAdjacent(path: readonly Point[], from: Point): boolean {
  let previous = from;
  for (const step of path) {
    const distance = Math.abs(step.x - previous.x) + Math.abs(step.y - previous.y);
    if (distance !== 1) return false;
    previous = step;
  }
  return true;
}

describe('findPath', () => {
  it('finds a route across open ground', () => {
    const map = grid('.....', '.....', '.....');

    const path = findPath(map, { x: 0, y: 0 }, { x: 4, y: 2 });

    expect(path).not.toBeNull();
    expect(path?.at(-1)).toEqual({ x: 4, y: 2 });
  });

  it('returns the shortest route, not just any route', () => {
    const map = grid('.....', '.....', '.....');

    const path = findPath(map, { x: 0, y: 0 }, { x: 4, y: 2 });

    // Four across plus two down, with no diagonals allowed.
    expect(path).toHaveLength(6);
  });

  it('leaves out the starting square and includes the destination', () => {
    const map = grid('...');

    const path = findPath(map, { x: 0, y: 0 }, { x: 2, y: 0 });

    expect(path).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
  });

  it('only ever steps to a neighbouring square', () => {
    const map = grid('.....', '.###.', '.....', '.###.', '.....');
    const from = { x: 0, y: 0 };

    const path = findPath(map, from, { x: 4, y: 4 });

    expect(path).not.toBeNull();
    expect(stepsAreAdjacent(path ?? [], from)).toBe(true);
  });

  it('walks around a wall instead of through it', () => {
    const map = grid('..#..', '..#..', '.....');

    const path = findPath(map, { x: 0, y: 0 }, { x: 4, y: 0 });

    expect(path).not.toBeNull();
    for (const step of path ?? []) {
      expect(map[step.y]?.[step.x]).toBe(true);
    }
  });

  it('gives up on a walled-off destination rather than hanging', () => {
    const map = grid('..#..', '..#..', '..#..');

    expect(findPath(map, { x: 0, y: 0 }, { x: 4, y: 0 })).toBeNull();
  });

  it('refuses a destination that is itself blocked', () => {
    const map = grid('...', '.#.', '...');

    expect(findPath(map, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeNull();
  });

  it('refuses to start from a blocked square', () => {
    const map = grid('...', '.#.', '...');

    expect(findPath(map, { x: 1, y: 1 }, { x: 0, y: 0 })).toBeNull();
  });

  it('refuses squares off the edge of the map', () => {
    const map = grid('...', '...');

    expect(findPath(map, { x: 0, y: 0 }, { x: 9, y: 0 })).toBeNull();
    expect(findPath(map, { x: 0, y: 0 }, { x: 0, y: -1 })).toBeNull();
    expect(findPath(map, { x: -1, y: 0 }, { x: 0, y: 0 })).toBeNull();
  });

  it('returns an empty path when you are already there', () => {
    const map = grid('...');

    expect(findPath(map, { x: 1, y: 0 }, { x: 1, y: 0 })).toEqual([]);
  });

  it('handles a one-square-wide corridor', () => {
    const map = grid('.###', '....', '###.', '....');

    const path = findPath(map, { x: 0, y: 0 }, { x: 3, y: 3 });

    expect(path).not.toBeNull();
    expect(path?.at(-1)).toEqual({ x: 3, y: 3 });
  });
});
