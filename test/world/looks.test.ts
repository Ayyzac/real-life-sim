import { describe, expect, it } from 'vitest';

import { encodeLook } from '../../src/core/look';
import { BODIES, HAIR_COLOURS } from '../../src/data/looks';
import { repaint } from '../../src/world/looks';

/** One 16x16 frame, every pixel the same colour. */
function frame(hex: string): Uint8ClampedArray {
  const value = Number.parseInt(hex.slice(1), 16);
  const pixels = new Uint8ClampedArray(16 * 16 * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = (value >> 16) & 255;
    pixels[i + 1] = (value >> 8) & 255;
    pixels[i + 2] = value & 255;
    pixels[i + 3] = 255;
  }
  return pixels;
}

function colourAt(pixels: Uint8ClampedArray, x: number, y: number): string {
  const i = (y * 16 + x) * 4;
  return `#${[pixels[i], pixels[i + 1], pixels[i + 2]].map((v) => v!.toString(16).padStart(2, '0')).join('')}`;
}

describe('repainting a look', () => {
  it('leaves a body in its own colours untouched', () => {
    const pixels = frame(BODIES[0]!.hair.colours[1]!);
    const before = pixels.slice();
    repaint(pixels, 16, encodeLook({ body: 0, hair: 0, top: 0, skin: 0 }));
    expect(pixels).toEqual(before);
  });

  it('repaints hair, but not shoes that happen to share its colour', () => {
    // Body 0's hair is the same orange as its shoes - the reason colours are
    // only matched inside a band of rows.
    const body = BODIES[0]!;
    const orange = body.hair.colours[1]!;
    const pixels = frame(orange);

    repaint(pixels, 16, encodeLook({ body: 0, hair: 1, top: 0, skin: 0 }));

    expect(colourAt(pixels, 8, 4)).toBe(HAIR_COLOURS[1]![2]);
    expect(colourAt(pixels, 8, 15)).toBe(orange);
  });

  it('never touches transparent pixels', () => {
    const pixels = frame(BODIES[0]!.hair.colours[1]!);
    pixels.fill(0);
    repaint(pixels, 16, encodeLook({ body: 0, hair: 3, top: 3, skin: 3 }));
    expect(pixels.every((v) => v === 0)).toBe(true);
  });
});
