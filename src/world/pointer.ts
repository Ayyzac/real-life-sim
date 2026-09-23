import type Phaser from 'phaser';

/**
 * Where a click landed on the canvas, measured fresh from the DOM.
 *
 * Phaser caches the canvas position and only re-reads it on a window resize.
 * This canvas sits under React panels whose height changes whenever a dialog
 * opens or a list grows, so the cached position goes stale and clicks land
 * somewhere else entirely - it once read clicks 500 pixels off. Every scene
 * uses this instead of `pointer.worldX` (docs/ARCHITECTURE.md §11, Phase 2).
 */
export function canvasPoint(game: Phaser.Game, pointer: Phaser.Input.Pointer): { x: number; y: number } | null {
  const event = pointer.event as MouseEvent & { changedTouches?: TouchList };
  const touch = event.changedTouches?.[0];
  const clientX = touch ? touch.clientX : event.clientX;
  const clientY = touch ? touch.clientY : event.clientY;
  if (typeof clientX !== 'number' || typeof clientY !== 'number') return null;

  const canvas = game.canvas;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;

  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height),
  };
}

/** Text drawn at the camera's magnification, so it stays sharp. */
export function textResolution(zoom: number): number {
  return zoom * (globalThis.devicePixelRatio || 1);
}
