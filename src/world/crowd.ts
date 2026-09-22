import Phaser from 'phaser';

import {
  CAR_TILES,
  CAR_TINTS,
  CROWD,
  NPC_SHEET_ROWS,
  TILE_SIZE,
  TOWN_COLUMNS,
  personFrames,
} from '../data/town';

/**
 * The people and traffic that make the town look inhabited.
 *
 * Decoration only. Nothing here reads or writes simulation state, so it does
 * not break CLAUDE.md rule 3: that rule stops the *simulation* running on a
 * timer, and these are render frames, the same as any animation.
 *
 * Everyone moves in a straight line along a fixed row and wraps around at the
 * edge. No pathfinding, no collisions - a crowd that has to think is a crowd
 * that costs frames, and the player is never going to interact with it.
 */

const PERSON_SPEED = { min: 8, max: 20 };
const CAR_SPEED = { min: 34, max: 58 };
const MARGIN = TILE_SIZE * 2;

interface Walker {
  object: Phaser.GameObjects.GameObject & { x: number; setFlipX?: (v: boolean) => unknown };
  speed: number;
}

export interface Crowd {
  update(deltaMs: number): void;
  destroy(): void;
}

export function createCrowd(
  scene: Phaser.Scene,
  texture: string,
  rng: () => number,
  depth: number,
): Crowd {
  const width = TOWN_COLUMNS * TILE_SIZE;
  const walkers: Walker[] = [];
  const objects: Phaser.GameObjects.GameObject[] = [];

  const pick = <T,>(list: readonly T[]): T => list[Math.floor(rng() * list.length)]!;
  const between = (min: number, max: number): number => min + rng() * (max - min);

  for (let i = 0; i < CROWD.people; i += 1) {
    const row = CROWD.walkRows[i % CROWD.walkRows.length]!;
    const frames = personFrames(pick(NPC_SHEET_ROWS));
    const goingRight = rng() < 0.5;

    const person = scene.add
      .image(rng() * width, row * TILE_SIZE + TILE_SIZE / 2, texture, frames.side)
      .setDepth(depth)
      .setFlipX(!goingRight);

    walkers.push({ object: person, speed: between(PERSON_SPEED.min, PERSON_SPEED.max) * (goingRight ? 1 : -1) });
    objects.push(person);
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
    // Nose-up sprite, quarter-turned: east is +90, west is -90.
    car.setAngle(goingRight ? 90 : -90);

    walkers.push({ object: car, speed: between(CAR_SPEED.min, CAR_SPEED.max) * (goingRight ? 1 : -1) });
    objects.push(car);
  }

  return {
    update(deltaMs: number): void {
      const seconds = deltaMs / 1000;
      for (const walker of walkers) {
        walker.object.x += walker.speed * seconds;
        if (walker.speed > 0 && walker.object.x > width + MARGIN) walker.object.x = -MARGIN;
        else if (walker.speed < 0 && walker.object.x < -MARGIN) walker.object.x = width + MARGIN;
      }
    },
    destroy(): void {
      for (const object of objects) object.destroy();
      walkers.length = 0;
      objects.length = 0;
    },
  };
}
