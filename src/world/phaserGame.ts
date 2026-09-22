import Phaser from 'phaser';

import { BootScene } from './scenes/BootScene';

export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 450;

/**
 * Creates the Phaser game instance. Called only from src/ui/GameCanvas.tsx,
 * which also owns destroying it.
 */
export function createPhaserGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#12161f',
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene],
  });
}
