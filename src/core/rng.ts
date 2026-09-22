/**
 * Deterministic seeded random number generator (mulberry32).
 *
 * docs/ARCHITECTURE.md §6 requires one seeded RNG instead of scattered
 * Math.random() calls, so bugs can be reproduced from a saved seed and tests
 * stay stable. It also allows "implementasi sendiri", which this is - a
 * dependency would buy us nothing for ~15 lines.
 *
 * The state is a single uint32, so it serialises into the save file and a
 * reloaded game continues the exact same random sequence.
 */

export interface RngState {
  /** The seed the run started from. Kept for bug reports. */
  readonly seed: number;
  /** Current internal state; advances on every draw. */
  readonly cursor: number;
}

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  /** True with probability `p` (0 = never, 1 = always). */
  chance(p: number): boolean;
  /** Picks one element. Throws on an empty array rather than returning undefined. */
  pick<T>(items: readonly T[]): T;
  /** Serialisable snapshot for the save file. */
  snapshot(): RngState;
}

export function createRng(seed: number, cursor: number = seed): Rng {
  let state = cursor >>> 0;
  const startSeed = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: <T,>(items: readonly T[]): T => {
      if (items.length === 0) throw new Error('rng.pick called with an empty array');
      return items[Math.floor(next() * items.length)] as T;
    },
    snapshot: () => ({ seed: startSeed, cursor: state }),
  };
}

export function restoreRng(state: RngState): Rng {
  return createRng(state.seed, state.cursor);
}
