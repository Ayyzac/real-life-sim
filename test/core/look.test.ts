import { describe, expect, it } from 'vitest';

import { createWorld } from '../../src/core/character';
import {
  LOOK_COUNT,
  characterLook,
  decodeLook,
  encodeLook,
  lookFromId,
  lookOf,
} from '../../src/core/look';
import { BODIES, HAIR_COLOURS, SKIN_TONES, TOP_COLOURS } from '../../src/data/looks';

describe('looks (GDD §3.2)', () => {
  it('offers every combination of body, hair, top and skin', () => {
    expect(LOOK_COUNT).toBe(BODIES.length * HAIR_COLOURS.length * TOP_COLOURS.length * SKIN_TONES.length);
  });

  it('decodes back to exactly what was encoded', () => {
    for (let look = 0; look < LOOK_COUNT; look += 97) {
      expect(encodeLook(decodeLook(look))).toBe(look);
    }
  });

  it('turns any number, even nonsense from a hand-edited save, into a real look', () => {
    for (const junk of [-1, LOOK_COUNT, 1e12, Number.NaN, 3.7]) {
      const parts = decodeLook(junk);
      expect(parts.body).toBeGreaterThanOrEqual(0);
      expect(parts.body).toBeLessThan(BODIES.length);
      expect(parts.skin).toBeLessThan(SKIN_TONES.length);
    }
  });

  it('gives somebody the same face every time, without storing it', () => {
    expect(lookFromId('p1a2b3')).toBe(lookFromId('p1a2b3'));
    expect(lookOf({ id: 'p1a2b3' })).toBe(lookFromId('p1a2b3'));
  });

  it('spreads faces out, so a circle of friends is not a row of twins', () => {
    const looks = new Set(Array.from({ length: 50 }, (_, i) => lookFromId(`person-${i}`)));
    expect(looks.size).toBeGreaterThan(45);
  });

  it('keeps a face that was actually seen, such as a greeted stranger', () => {
    expect(lookOf({ id: 'p1a2b3', look: 42 })).toBe(42);
  });

  it('draws a save from before looks existed as the body it picked, in its own colours', () => {
    expect(decodeLook(characterLook({ appearanceRow: 7 }))).toEqual({ body: 2, hair: 0, top: 0, skin: 0 });
  });

  it('remembers the look chosen at character creation', () => {
    const look = encodeLook({ body: 4, hair: 2, top: 5, skin: 3 });
    const world = createWorld({ name: 'Ayu', backgroundId: 'athlete', look, seed: 1 });
    expect(characterLook(world.character)).toBe(look);
  });
});
