import type Phaser from 'phaser';

import { TILE_SIZE } from '../data/town';
import { lookSheet } from './looks';

/**
 * Makes sure a look has a Phaser texture, and returns its key.
 *
 * Frame numbers are `lookFrame(view, pose)` from ./looks. Kept out of looks.ts
 * so that file stays importable in tests, where Phaser cannot load.
 */
export function lookTexture(scene: Phaser.Scene, tilesheetKey: string, look: number): string {
  const key = `look-${look}`;
  if (scene.textures.exists(key)) return key;

  const source = scene.textures.get(tilesheetKey).getSourceImage() as CanvasImageSource;
  const sheet = lookSheet(source, look);
  const texture = scene.textures.addCanvas(key, sheet);
  if (!texture) return key;

  const columns = sheet.width / TILE_SIZE;
  const rows = sheet.height / TILE_SIZE;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      texture.add(row * columns + column, 0, column * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }
  return key;
}
