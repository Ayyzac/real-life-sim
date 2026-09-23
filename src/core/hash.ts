/**
 * A stable number from a piece of text (FNV-1a).
 *
 * For things that must look varied but come out the same every time - a
 * face, where someone is this evening, what they say first - without drawing
 * from the simulation's RNG, which is saved: spending it on those would shift
 * every event that follows.
 */
export function hashText(text: string): number {
  let value = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}
