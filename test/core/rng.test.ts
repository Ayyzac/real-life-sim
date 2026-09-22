import { describe, expect, it } from 'vitest';

import { createRng, restoreRng } from '../../src/core/rng';

describe('createRng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createRng(12345);
    const b = createRng(12345);

    const drawsA = Array.from({ length: 20 }, () => a.next());
    const drawsB = Array.from({ length: 20 }, () => b.next());

    expect(drawsA).toEqual(drawsB);
  });

  it('produces different sequences for different seeds', () => {
    const a = Array.from({ length: 10 }, createRng(1).next);
    const b = Array.from({ length: 10 }, createRng(2).next);

    expect(a).not.toEqual(b);
  });

  it('stays inside [0, 1)', () => {
    const rng = createRng(7);

    for (let i = 0; i < 2000; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('int() covers both bounds and never escapes them', () => {
    const rng = createRng(99);
    const seen = new Set<number>();

    for (let i = 0; i < 2000; i += 1) {
      const value = rng.int(1, 6);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
      seen.add(value);
    }

    expect(seen).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });

  it('chance(0) never fires and chance(1) always fires', () => {
    const rng = createRng(3);

    for (let i = 0; i < 200; i += 1) {
      expect(rng.chance(0)).toBe(false);
      expect(rng.chance(1)).toBe(true);
    }
  });

  it('pick() throws on an empty array instead of returning undefined', () => {
    expect(() => createRng(1).pick([])).toThrow(/empty array/);
  });

  it('restores mid-sequence from a snapshot, so a reloaded save continues it', () => {
    const original = createRng(2026);
    for (let i = 0; i < 5; i += 1) original.next();

    const resumed = restoreRng(original.snapshot());

    expect(Array.from({ length: 10 }, resumed.next)).toEqual(
      Array.from({ length: 10 }, original.next),
    );
  });
});
