import { BODIES, HAIR_COLOURS, SKIN_TONES, TOP_COLOURS } from '../data/looks';
import type { Character } from './types';

/**
 * A look is one number: which body, and which hair, top and skin colours
 * (src/data/looks.ts). One number keeps it to a single small field in the save.
 *
 * Purely cosmetic (GDD §3.2). No rule anywhere reads it.
 */

export interface LookParts {
  body: number;
  hair: number;
  top: number;
  skin: number;
}

export const LOOK_COUNT = BODIES.length * HAIR_COLOURS.length * TOP_COLOURS.length * SKIN_TONES.length;

function wrap(value: number, size: number): number {
  const whole = Number.isFinite(value) ? Math.floor(value) : 0;
  return ((whole % size) + size) % size;
}

export function encodeLook({ body, hair, top, skin }: LookParts): number {
  return (
    wrap(body, BODIES.length) +
    BODIES.length *
      (wrap(hair, HAIR_COLOURS.length) +
        HAIR_COLOURS.length * (wrap(top, TOP_COLOURS.length) + TOP_COLOURS.length * wrap(skin, SKIN_TONES.length)))
  );
}

/** Any number decodes to a valid look, so a hand-edited save cannot break drawing. */
export function decodeLook(look: number): LookParts {
  let rest = wrap(look, LOOK_COUNT);
  const body = rest % BODIES.length;
  rest = Math.floor(rest / BODIES.length);
  const hair = rest % HAIR_COLOURS.length;
  rest = Math.floor(rest / HAIR_COLOURS.length);
  const top = rest % TOP_COLOURS.length;
  const skin = Math.floor(rest / TOP_COLOURS.length);
  return { body, hair, top, skin };
}

/**
 * A stable look from an id (FNV-1a). People met through the simulation get
 * one without the save having to store it, and without drawing from the
 * simulation's RNG - which is saved, so spending it on faces would shift every
 * event that follows.
 */
export function lookFromId(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % LOOK_COUNT;
}

export function lookOf(person: { id: string; look?: number }): number {
  return person.look ?? lookFromId(person.id);
}

/**
 * The player's look. Saves from before Phase 6 only know a sheet row; that row
 * is one of three frames of one body, drawn in its own colours.
 */
export function characterLook(character: Pick<Character, 'look' | 'appearanceRow'>): number {
  return character.look ?? encodeLook({ body: Math.floor(character.appearanceRow / 3), hair: 0, top: 0, skin: 0 });
}
