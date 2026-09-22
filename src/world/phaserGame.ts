import Phaser from 'phaser';

import type { GameStore } from '../core/store';
import { TILE_SIZE, TOWN_COLUMNS, TOWN_ROWS, TOWN_ZOOM } from '../data/town';
import { TownScene } from './scenes/TownScene';

/** The map at 2x fills the canvas exactly, so no camera scrolling is needed. */
export const GAME_WIDTH = TOWN_COLUMNS * TILE_SIZE * TOWN_ZOOM;
export const GAME_HEIGHT = TOWN_ROWS * TILE_SIZE * TOWN_ZOOM;

/**
 * Creates the Phaser game instance. Called only from src/ui/GameCanvas.tsx,
 * which also owns destroying it.
 *
 * The store is handed in rather than imported so the world layer keeps talking
 * to the simulation through one explicit seam (CLAUDE.md rule 5) and never
 * reaches into the React side of the app.
 */
export function createPhaserGame(parent: HTMLElement, store: GameStore): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#12161f',
    pixelArt: true,
    // No sound until Phase 5. Leaving audio on makes Phaser open an
    // AudioContext that it then talks to after destroy(), which throws
    // "Cannot suspend a closed AudioContext" on every StrictMode remount.
    audio: { noAudio: true },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [new TownScene(store)],
  });
}
