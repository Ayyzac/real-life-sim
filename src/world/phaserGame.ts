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
    // No sound until Phase 5. Leaving audio on makes Phaser open an
    // AudioContext that it then talks to after destroy(), which throws
    // "Cannot suspend a closed AudioContext" on every StrictMode remount.
    audio: { noAudio: true },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene],
  });
}
