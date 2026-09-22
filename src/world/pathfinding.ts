/**
 * Walking from one square to another.
 *
 * Plain TypeScript with no Phaser import, so it runs under Vitest with no
 * browser. Click-to-walk without this would send the character straight into
 * the nearest wall, which is the kind of bug a player notices immediately.
 *
 * Breadth-first, not A*. The town is ~350 squares and every step costs the
 * same, so BFS already returns a shortest path and is half the code. If the
 * map ever grows past a few thousand squares, revisit it - not before.
 */

export interface Point {
  x: number;
  y: number;
}

/** Up, down, left, right. No diagonals: they look wrong on a tile grid. */
const STEPS: readonly Point[] = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];

function walkable(grid: readonly (readonly boolean[])[], x: number, y: number): boolean {
  return grid[y]?.[x] === true;
}

/**
 * The shortest route from `from` to `to`, as the squares to step onto in
 * order. `from` is not included; `to` is.
 *
 * Returns an empty array when you are already there, and `null` when there is
 * no route - including when either end is off the map or blocked. Callers must
 * treat `null` as "ignore the click" rather than waiting for something.
 */
export function findPath(
  grid: readonly (readonly boolean[])[],
  from: Point,
  to: Point,
): Point[] | null {
  if (!walkable(grid, from.x, from.y)) return null;
  if (!walkable(grid, to.x, to.y)) return null;
  if (from.x === to.x && from.y === to.y) return [];

  const width = grid[0]?.length ?? 0;
  const key = (x: number, y: number): number => y * width + x;

  // cameFrom[key] is the square we arrived from, or -1 for the start.
  const cameFrom = new Map<number, number>();
  cameFrom.set(key(from.x, from.y), -1);

  // A plain array with a moving head is the queue; shift() would be O(n).
  const queue: Point[] = [from];
  let head = 0;

  while (head < queue.length) {
    const current = queue[head];
    head += 1;
    if (!current) break;

    for (const step of STEPS) {
      const x = current.x + step.x;
      const y = current.y + step.y;
      if (!walkable(grid, x, y)) continue;

      const id = key(x, y);
      if (cameFrom.has(id)) continue;
      cameFrom.set(id, key(current.x, current.y));

      if (x === to.x && y === to.y) return rebuild(cameFrom, key(x, y), width);
      queue.push({ x, y });
    }
  }

  return null;
}

/** Walk the breadcrumbs back to the start, then turn them the right way up. */
function rebuild(cameFrom: Map<number, number>, end: number, width: number): Point[] {
  const path: Point[] = [];
  let id = end;

  while (id !== -1) {
    path.push({ x: id % width, y: Math.floor(id / width) });
    const previous = cameFrom.get(id);
    if (previous === undefined) break;
    id = previous;
  }

  path.pop(); // drop the starting square; the character is already on it
  return path.reverse();
}
