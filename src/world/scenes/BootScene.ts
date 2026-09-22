import Phaser from 'phaser';

/**
 * Phase 0 placeholder scene.
 *
 * Draws nothing game-related on purpose - its only job is to prove that the
 * Phaser canvas boots and renders inside the React layout. The real world map
 * arrives in Phase 2 (see docs/ROADMAP.md).
 *
 * The gentle bobbing motion is render-only. It never touches simulation state,
 * which by rule only advances when the player presses a button (CLAUDE.md §3).
 */
export class BootScene extends Phaser.Scene {
  private marker?: Phaser.GameObjects.Rectangle;
  private markerBaseY = 0;

  constructor() {
    super('Boot');
  }

  create(): void {
    const { width, height } = this.scale;
    const centerX = width / 2;

    this.add
      .text(centerX, height / 2 - 64, 'Real Life Sim', {
        fontFamily: 'monospace',
        fontSize: '34px',
        color: '#e8edf7',
      })
      .setOrigin(0.5);

    this.add
      .text(centerX, height / 2 - 24, 'Phase 0 - foundation and deploy pipeline', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#7f8ca6',
      })
      .setOrigin(0.5);

    this.markerBaseY = height / 2 + 52;
    this.marker = this.add.rectangle(centerX, this.markerBaseY, 26, 26, 0x6ee7b7);

    this.add
      .text(centerX, height - 28, 'If this box is moving, Phaser is running.', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#5b6780',
      })
      .setOrigin(0.5);
  }

  override update(time: number): void {
    if (!this.marker) return;
    this.marker.y = this.markerBaseY + Math.sin(time / 420) * 14;
  }
}
