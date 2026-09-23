/**
 * How people look, as data (GDD §3.2, §11).
 *
 * The town tilesheet holds six people, each drawn in three frames (standing
 * and two walking steps) and four views. Everybody in the game is one of those
 * six bodies with some of its colours swapped: hair, top and skin. Six bodies x
 * 8 hair x 10 tops x 5 skins is 2,400 looks, with no extra art to download, and
 * the map and the portraits always agree because both repaint the same pixels.
 *
 * Colours are matched exactly and only inside a band of rows, because the
 * pack reuses colours between parts - body 0's hair is the same orange as its
 * shoes, body 2's shirt the same as body 0's hair. Rows are counted inside one
 * 16px frame, top = 0. Every list runs darkest to lightest.
 */

export interface ColourBand {
  colours: readonly string[];
  /** First row repainted. */
  fromY: number;
  /** Row after the last one repainted. */
  toY: number;
}

export interface Body {
  /** The standing frame's row in the tilesheet; the steps follow below it. */
  sheetRow: number;
  hair: ColourBand;
  top: ColourBand;
  skin: readonly string[];
}

/** Checked pixel by pixel against the sheet on 23 Sep 2026. */
export const BODIES: readonly Body[] = [
  {
    sheetRow: 0,
    hair: { colours: ['#c57652', '#dc8652'], fromY: 0, toY: 10 },
    top: { colours: ['#369069', '#42a379'], fromY: 9, toY: 13 },
    skin: ['#e29779', '#f1b089', '#ffc8a1', '#ffc999'],
  },
  {
    sheetRow: 3,
    hair: { colours: ['#c57652', '#dc8652'], fromY: 0, toY: 13 },
    top: { colours: ['#a54240', '#c2504d'], fromY: 9, toY: 13 },
    skin: ['#f1b089', '#ffc8a1', '#ffc999'],
  },
  {
    sheetRow: 6,
    // Grey hair and beard.
    hair: { colours: ['#5c6278', '#7a77a4', '#a09cca'], fromY: 0, toY: 13 },
    top: { colours: ['#c57652', '#dc8652'], fromY: 9, toY: 13 },
    skin: ['#f1b089', '#ffc8a1', '#ffc999'],
  },
  {
    sheetRow: 9,
    // Wears a hat, which keeps its colour. The overalls run to the ankles.
    hair: { colours: ['#373733', '#60605a'], fromY: 0, toY: 10 },
    top: { colours: ['#7a77a4', '#918eb9', '#a19dcc'], fromY: 9, toY: 16 },
    skin: ['#71482f', '#955f3e', '#b4734a'],
  },
  {
    sheetRow: 12,
    // Bald, so "hair" is the beard.
    hair: { colours: ['#dc8652'], fromY: 0, toY: 13 },
    top: { colours: ['#898ca6', '#aaa8bd'], fromY: 9, toY: 13 },
    skin: ['#f1b089', '#ffc8a1', '#ffc999'],
  },
  {
    sheetRow: 15,
    // The orange headband keeps its colour.
    hair: { colours: ['#373733', '#50504a', '#60605a'], fromY: 0, toY: 13 },
    top: { colours: ['#a9673b', '#c77b47'], fromY: 9, toY: 13 },
    skin: ['#f1b089', '#ffc8a1', '#ffc999'],
  },
];

/**
 * Replacement ramps. `null` keeps the body's own colours, so every body
 * dressed in its defaults looks exactly like the sheet.
 */
export const HAIR_COLOURS: readonly (readonly string[] | null)[] = [
  null,
  ['#1f1f24', '#2e2e35', '#44444d'], // black
  ['#4a2c1c', '#6b4128', '#8a5835'], // brown
  ['#a8502e', '#c57652', '#dc8652'], // ginger
  ['#b88a3a', '#dcb456', '#f2d27a'], // blonde
  ['#6f7280', '#9a9daa', '#c3c5cf'], // grey
  ['#7a1f24', '#a3303a', '#c64650'], // red
  ['#2d3f7a', '#3f58a8', '#5a78cf'], // dyed blue
];

export const TOP_COLOURS: readonly (readonly string[] | null)[] = [
  null,
  ['#2f7a55', '#369069', '#42a379'], // green
  ['#8a3432', '#a54240', '#c2504d'], // red
  ['#2f4f8f', '#3d65b0', '#5a82d0'], // blue
  ['#b08a26', '#d4a935', '#eac552'], // yellow
  ['#5b3f86', '#7454a8', '#9272c8'], // purple
  ['#9fa3ad', '#cfd2d8', '#eceef2'], // white
  ['#26262b', '#34343b', '#46464f'], // black
  ['#b35a24', '#d8722f', '#ef8f45'], // orange
  ['#b04f7a', '#d06c98', '#e88db4'], // pink
];

export const SKIN_TONES: readonly (readonly string[] | null)[] = [
  null,
  ['#e8a38a', '#f7c4a5', '#ffd9bd', '#ffe0c4'], // fair
  ['#b86f4c', '#cf8a5e', '#e0a476', '#e8ae80'], // tan
  ['#71482f', '#955f3e', '#b4734a', '#c0805a'], // brown
  ['#4a2c1e', '#643c28', '#7e4f35', '#8a5a3e'], // dark
];
