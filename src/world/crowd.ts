import Phaser from 'phaser';

import { LOOK_COUNT } from '../core/look';
import { CAR_TILES, CAR_TINTS, CROWD, TILE_SIZE, TOWN_COLUMNS } from '../data/town';
import { lookTexture } from './lookTexture';
import { POSE, VIEW, lookFrame } from './looks';

/**
 * The people and traffic that make the town look inhabited.
 *
 * Decoration only. Nothing here reads or writes simulation state, so it does
 * not break CLAUDE.md rule 3: that rule stops the *simulation* running on a
 * timer, and these are render frames, the same as any animation.
 *
 * Everyone moves in a straight line along a fixed row and wraps around at the
 * edge. No pathfinding, no collisions - a crowd that has to think is a crowd
 * that costs frames.
 */

const PERSON_SPEED = { min: 8, max: 20 };
const CAR_SPEED = { min: 34, max: 58 };
const MARGIN = TILE_SIZE * 2;
/** How long each walking step is shown, in milliseconds. */
export const STEP_MS = 220;

interface Walker {
  object: Phaser.GameObjects.Image | Phaser.GameObjects.Container;
  speed: number;
  /** Set for people, who swap between their two walking frames. */
  view?: number;
  /** So forty people do not all step in time. */
  phase: number;
  /** People only: how they look, so a hello can carry the face over. */
  look?: number;
  /** A name, once the player has got to know them. Follows them about. */
  label?: Phaser.GameObjects.Text;
}

/** A stranger under the pointer. */
export interface Stranger {
  index: number;
  look: number;
  x: number;
  y: number;
}

export interface Crowd {
  update(deltaMs: number): void;
  destroy(): void;
  /** The person walking at this point of the map, if any. */
  strangerAt(x: number, y: number): Stranger | null;
  /** Puts a name over someone the player has just met. */
  name(index: number, text: string, resolution: number): void;
}

export function createCrowd(
  scene: Phaser.Scene,
  texture: string,
  rng: () => number,
  depth: number,
): Crowd {
  const width = TOWN_COLUMNS * TILE_SIZE;
  const walkers: Walker[] = [];
  let elapsed = 0;

  const pick = <T,>(list: readonly T[]): T => list[Math.floor(rng() * list.length)]!;
  const between = (min: number, max: number): number => min + rng() * (max - min);

  for (let i = 0; i < CROWD.people; i += 1) {
    const row = CROWD.walkRows[i % CROWD.walkRows.length]!;
    const look = Math.floor(rng() * LOOK_COUNT);
    const goingRight = rng() < 0.5;
    const view = goingRight ? VIEW.right : VIEW.left;

    const person = scene.add
      .image(rng() * width, row * TILE_SIZE + TILE_SIZE / 2, lookTexture(scene, texture, look), lookFrame(view, POSE.stand))
      .setDepth(depth);

    walkers.push({
      object: person,
      speed: between(PERSON_SPEED.min, PERSON_SPEED.max) * (goingRight ? 1 : -1),
      view,
      phase: rng() * STEP_MS * 2,
      look,
    });
  }

  for (let i = 0; i < CROWD.cars; i += 1) {
    const goingRight = i % 2 === 0;
    const tiles = pick(CAR_TILES);
    const tint = pick(CAR_TINTS);
    const y = goingRight ? CROWD.laneY.eastbound : CROWD.laneY.westbound;

    const half = TILE_SIZE / 2;
    const parts = tiles.map((tile, corner) =>
      scene.add
        .image(corner % 2 === 0 ? -half : half, corner < 2 ? -half : half, texture, tile)
        .setTint(tint),
    );
    const car = scene.add.container(rng() * width, y, parts).setDepth(depth);
    // Nose-down sprite (src/data/town.ts), so the bottom has to lead: a
    // quarter turn anticlockwise points it east, clockwise points it west.
    car.setAngle(goingRight ? -90 : 90);

    walkers.push({ object: car, speed: between(CAR_SPEED.min, CAR_SPEED.max) * (goingRight ? 1 : -1), phase: 0 });
  }

  return {
    update(deltaMs: number): void {
      elapsed += deltaMs;
      const seconds = deltaMs / 1000;

      for (const walker of walkers) {
        walker.object.x += walker.speed * seconds;
        if (walker.speed > 0 && walker.object.x > width + MARGIN) walker.object.x = -MARGIN;
        else if (walker.speed < 0 && walker.object.x < -MARGIN) walker.object.x = width + MARGIN;
        if (walker.view !== undefined && walker.object instanceof Phaser.GameObjects.Image) {
          walker.object.setFrame(lookFrame(walker.view, stepPose(elapsed + walker.phase)));
        }
        walker.label?.setPosition(walker.object.x, walker.object.y - 9);
      }
    },
    destroy(): void {
      for (const walker of walkers) {
        walker.object.destroy();
        walker.label?.destroy();
      }
      walkers.length = 0;
    },
    strangerAt(x: number, y: number): Stranger | null {
      const index = walkers.findIndex(
        (walker) =>
          walker.look !== undefined &&
          !walker.label &&
          Math.abs(walker.object.x - x) <= TILE_SIZE / 2 &&
          Math.abs(walker.object.y - y) <= TILE_SIZE / 2,
      );
      const walker = walkers[index];
      if (!walker || walker.look === undefined) return null;
      return { index, look: walker.look, x: walker.object.x, y: walker.object.y };
    },
    name(index: number, text: string, resolution: number): void {
      const walker = walkers[index];
      if (!walker || walker.label) return;
      walker.label = scene.add
        .text(walker.object.x, walker.object.y - 9, text, {
          fontFamily: 'monospace',
          fontSize: '6px',
          color: '#ffffff',
          backgroundColor: '#0e1119aa',
          padding: { x: 1, y: 0 },
        })
        .setOrigin(0.5, 1)
        .setDepth(depth + 0.5)
        .setResolution(resolution);
    },
  };
}

/** Which walking frame to show at a given moment. */
export function stepPose(ms: number): number {
  return Math.floor(ms / STEP_MS) % 2 === 0 ? POSE.stepA : POSE.stepB;
}
