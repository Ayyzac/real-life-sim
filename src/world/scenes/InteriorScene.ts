import Phaser from 'phaser';

import { actionBlocker } from '../../core/day';
import { characterLook, lookOf } from '../../core/look';
import { whoIsHere } from '../../core/schedule';
import type { GameStore } from '../../core/store';
import type { LocationId, Person, WorldState } from '../../core/types';
import { findAction } from '../../data/actions';
import { interiorFor, ROOM, roomWalkable, type Interior, type Piece, type Sheet } from '../../data/interiors';
import { TILE_SIZE } from '../../data/town';
import { stepPose } from '../crowd';
import { lookTexture } from '../lookTexture';
import { POSE, VIEW, lookFrame } from '../looks';
import { findPath, type Point } from '../pathfinding';
import { canvasPoint, textResolution } from '../pointer';

/**
 * Inside a building (GDD §11.4): one generic scene that draws whichever room
 * src/data/interiors.ts says this place has.
 *
 * Talks to the simulation the same way the town does - `getState`,
 * `subscribe`, `dispatch` (CLAUDE.md rule 5). Actions go through `hooks` so
 * they play with the same timed bar as the buttons in the side panel.
 *
 * Being inside is view state only. It is not saved: loading the game puts
 * the character back outside the door.
 */

export interface WorldHooks {
  /** Do an action from src/data/actions.ts, with the on-screen timing. */
  perform(actionId: string): void;
}

export const TEXTURES: Record<Sheet, string> = { town: 'town', indoor: 'indoor' };

/** 14x8 tiles at 3.5x fills the 800x448 canvas. */
const ROOM_ZOOM = 3.5;
const WALK_SPEED = 5;
const DEPTH = { floor: 0, piece: 1, highlight: 2, people: 3, labels: 4, tip: 6 };
const TEXT = textResolution(ROOM_ZOOM);

interface Hotspot {
  x: number;
  y: number;
  width: number;
  height: number;
  tip: () => string;
  action?: string;
  exit?: boolean;
  /** A person the player knows; redrawn whenever the clock moves. */
  visitor?: boolean;
}

export class InteriorScene extends Phaser.Scene {
  private locationId: LocationId = 'home';
  private interior!: Interior;
  private walkable: boolean[][] = [];
  private hotspots: Hotspot[] = [];
  private player?: Phaser.GameObjects.Image;
  private playerView: number = VIEW.up;
  private walkElapsed = 0;
  private tile: Point = { ...ROOM.exit };
  private path: Point[] = [];
  /** What to do on arrival: an action, or leaving. */
  private errand: { action?: string; exit?: boolean } | null = null;
  private visitors: Phaser.GameObjects.GameObject[] = [];
  private highlight?: Phaser.GameObjects.Rectangle;
  private tipText?: Phaser.GameObjects.Text;
  private unsubscribe?: () => void;
  private lastTime = -1;

  constructor(
    private readonly store: GameStore,
    private readonly hooks: WorldHooks,
  ) {
    super('Interior');
  }

  init(data: { locationId: LocationId }): void {
    this.locationId = data.locationId;
    this.tile = { ...ROOM.exit };
    this.path = [];
    this.errand = null;
    this.visitors = [];
    this.hotspots = [];
  }

  create(): void {
    const world = this.store.getState();
    if (!world) return;
    this.interior = interiorFor(this.locationId, world.character);
    this.walkable = roomWalkable(this.interior);

    this.drawRoom();
    this.drawStaff();

    this.player = this.add
      .image(centre(this.tile.x), centre(this.tile.y), lookTexture(this, TEXTURES.town, characterLook(world.character)))
      .setFrame(lookFrame(VIEW.up, POSE.stand))
      .setDepth(DEPTH.people);

    this.highlight = this.add
      .rectangle(0, 0, 1, 1)
      .setOrigin(0)
      .setStrokeStyle(1, 0xffd479, 0.95)
      .setFillStyle(0xffd479, 0.14)
      .setDepth(DEPTH.highlight)
      .setVisible(false);
    this.tipText = this.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '5px',
        color: '#ece9e1',
        backgroundColor: '#151a26ee',
        padding: { x: 2, y: 1 },
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.tip)
      .setResolution(TEXT)
      .setVisible(false);

    this.placeVisitors(world);
    this.lastTime = timeKey(world);

    const camera = this.cameras.main;
    camera.setZoom(ROOM_ZOOM);
    camera.centerOn((ROOM.columns * TILE_SIZE) / 2, (ROOM.rows * TILE_SIZE) / 2);
    camera.setBackgroundColor('#0e1119');

    // Literal names on purpose: Phaser's event constants come through this
    // build as undefined (docs/ARCHITECTURE.md §11, Phase 2).
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.unsubscribe = this.store.subscribe(this.onStoreChanged);
    this.events.once('shutdown', this.teardown, this);
    this.events.once('destroy', this.teardown, this);
  }

  override update(_time: number, delta: number): void {
    this.stepAlongPath(delta);
  }

  // --- drawing ------------------------------------------------------------

  private drawRoom(): void {
    const { floor, wall } = this.interior;
    for (let y = 0; y < ROOM.rows; y += 1) {
      for (let x = 0; x < ROOM.columns; x += 1) {
        const isWall = y < ROOM.wallRows;
        const image = isWall
          ? this.add.image(x * TILE_SIZE, y * TILE_SIZE, TEXTURES.town, y === 0 ? wall.tile : wall.band)
          : this.add.image(x * TILE_SIZE, y * TILE_SIZE, TEXTURES[floor.sheet], floor.tile);
        image.setOrigin(0).setDepth(DEPTH.floor);
        if (isWall && wall.tint !== undefined) image.setTint(wall.tint);
      }
    }

    // The way out: a mat, and a label so it is never a guess.
    const exit = ROOM.exit;
    this.add
      .image(exit.x * TILE_SIZE, exit.y * TILE_SIZE, TEXTURES.indoor, floor.tile === 51 ? 159 : 51)
      .setOrigin(0)
      .setDepth(DEPTH.piece);
    this.label(centre(exit.x), exit.y * TILE_SIZE + 4, 'Exit', '#ffc861');
    this.hotspots.push({ x: exit.x, y: exit.y, width: 1, height: 1, exit: true, tip: () => 'Go back outside' });

    for (const piece of this.interior.pieces) this.drawPiece(piece);
  }

  private drawPiece(piece: Piece): void {
    const texture = TEXTURES[piece.sheet ?? 'indoor'];
    piece.frames.forEach((row, dy) =>
      row.forEach((frame, dx) => {
        this.add
          .image((piece.x + dx) * TILE_SIZE, (piece.y + dy) * TILE_SIZE, texture, frame)
          .setOrigin(0)
          .setDepth(DEPTH.piece);
      }),
    );
    if (!piece.action) return;

    const actionId = piece.action;
    this.hotspots.push({
      x: piece.x,
      y: piece.y,
      width: piece.frames[0]?.length ?? 1,
      height: piece.frames.length,
      action: actionId,
      tip: () => {
        const action = findAction(actionId);
        const world = this.store.getState();
        const why = world ? actionBlocker(world, action) : null;
        const cost = action.cost ? ` · $${action.cost}` : '';
        return why ? `${action.label} — ${why}` : `${action.label} · ${action.minutes} min${cost}`;
      },
    });
  }

  private drawStaff(): void {
    for (const person of this.interior.staff ?? []) {
      this.add
        .image(centre(person.x), centre(person.y), lookTexture(this, TEXTURES.town, person.look), lookFrame(VIEW.down, POSE.stand))
        .setDepth(DEPTH.people);
      this.label(centre(person.x), person.y * TILE_SIZE - 1, person.role, '#8d96aa');
    }
  }

  /** The people the player knows who are here right now, with their names. */
  private placeVisitors(world: WorldState): void {
    for (const object of this.visitors) object.destroy();
    this.visitors = [];
    this.hotspots = this.hotspots.filter((spot) => !spot.visitor);

    const here: Person[] = whoIsHere(world, this.locationId);
    here.slice(0, this.interior.spots.length).forEach((person, i) => {
      const spot = this.interior.spots[i]!;
      const sprite = this.add
        .image(centre(spot.x), centre(spot.y), lookTexture(this, TEXTURES.town, lookOf(person)), lookFrame(VIEW.down, POSE.stand))
        .setDepth(DEPTH.people);
      const name = this.label(centre(spot.x), spot.y * TILE_SIZE - 1, person.name.split(' ')[0] ?? person.name, '#ffffff');
      this.visitors.push(sprite, name);
      this.hotspots.push({
        x: spot.x,
        y: spot.y,
        width: 1,
        height: 1,
        visitor: true,
        tip: () => `${person.name} · ${person.kind}`,
      });
    });
  }

  private label(x: number, y: number, text: string, color: string): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, text, { fontFamily: 'monospace', fontSize: '4px', color, backgroundColor: '#0e1119aa', padding: { x: 1, y: 0 } })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.labels)
      .setResolution(TEXT);
  }

  // --- input --------------------------------------------------------------

  private tileAt(pointer: Phaser.Input.Pointer): Point | null {
    const point = canvasPoint(this.game, pointer);
    if (!point) return null;
    const world = this.cameras.main.getWorldPoint(point.x, point.y);
    return { x: Math.floor(world.x / TILE_SIZE), y: Math.floor(world.y / TILE_SIZE) };
  }

  private hotspotAt(tile: Point): Hotspot | undefined {
    return this.hotspots.find(
      (spot) => tile.x >= spot.x && tile.x < spot.x + spot.width && tile.y >= spot.y && tile.y < spot.y + spot.height,
    );
  }

  private locked(): boolean {
    const world = this.store.getState();
    return !world || world.deceased || world.pendingEvent !== null;
  }

  private onPointerMove = (pointer: Phaser.Input.Pointer): void => {
    const tile = this.tileAt(pointer);
    const spot = tile && !this.locked() ? this.hotspotAt(tile) : undefined;
    this.game.canvas.style.cursor = spot?.action || spot?.exit ? 'pointer' : '';
    if (!spot) {
      this.highlight?.setVisible(false);
      this.tipText?.setVisible(false);
      return;
    }
    this.highlight
      ?.setPosition(spot.x * TILE_SIZE, spot.y * TILE_SIZE)
      .setSize(spot.width * TILE_SIZE, spot.height * TILE_SIZE)
      .setVisible(true);
    this.tipText
      ?.setText(spot.tip())
      .setPosition(Phaser.Math.Clamp((spot.x + spot.width / 2) * TILE_SIZE, 30, ROOM.columns * TILE_SIZE - 30), Math.max(8, spot.y * TILE_SIZE - 5))
      .setVisible(true);
  };

  private onPointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (this.locked()) return;
    const tile = this.tileAt(pointer);
    if (!tile) return;

    const spot = this.hotspotAt(tile);
    if (spot?.exit) return this.walkTo(ROOM.exit, { exit: true });
    if (spot?.action) return this.walkTo(this.besideOf(spot), { action: spot.action });
    this.walkTo(tile, null);
  };

  /** The nearest free square next to a piece of furniture, to stand at while using it. */
  private besideOf(spot: Hotspot): Point {
    const candidates: Point[] = [];
    for (let y = spot.y - 1; y <= spot.y + spot.height; y += 1) {
      for (let x = spot.x - 1; x <= spot.x + spot.width; x += 1) {
        if (this.walkable[y]?.[x]) candidates.push({ x, y });
      }
    }
    // Walkable mats are used standing on them.
    if (this.walkable[spot.y]?.[spot.x]) candidates.unshift({ x: spot.x, y: spot.y });
    let best: Point = this.tile;
    let bestLength = Infinity;
    for (const candidate of candidates) {
      const route = findPath(this.walkable, this.tile, candidate);
      if (route && route.length < bestLength) {
        best = candidate;
        bestLength = route.length;
      }
    }
    return best;
  }

  private walkTo(target: Point, errand: { action?: string; exit?: boolean } | null): void {
    const route = findPath(this.walkable, this.tile, target);
    if (!route) return;
    this.errand = errand;
    this.path = route;
    if (route.length === 0) this.arrive();
  }

  private stepAlongPath(delta: number): void {
    const player = this.player;
    const next = this.path[0];
    if (!player || !next) return;

    this.walkElapsed += delta;
    const targetX = centre(next.x);
    const targetY = centre(next.y);
    const dx = targetX - player.x;
    const dy = targetY - player.y;
    this.playerView = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? VIEW.left : VIEW.right) : dy < 0 ? VIEW.up : VIEW.down;
    player.setFrame(lookFrame(this.playerView, stepPose(this.walkElapsed)));

    const step = (WALK_SPEED * TILE_SIZE * delta) / 1000;
    const remaining = Math.hypot(dx, dy);
    if (remaining <= step) {
      player.setPosition(targetX, targetY);
      this.tile = { x: next.x, y: next.y };
      this.path.shift();
      if (this.path.length === 0) this.arrive();
      return;
    }
    player.setPosition(player.x + (dx / remaining) * step, player.y + (dy / remaining) * step);
  }

  private arrive(): void {
    this.walkElapsed = 0;
    this.player?.setFrame(lookFrame(this.playerView, POSE.stand));
    const errand = this.errand;
    this.errand = null;
    if (errand?.exit) {
      this.scene.start('Town');
      return;
    }
    if (errand?.action) this.hooks.perform(errand.action);
  }

  // --- the rest of the game -----------------------------------------------

  private onStoreChanged = (): void => {
    const world = this.store.getState();
    if (!world) return;

    // Somewhere else now - a tab, or the working day - or the room itself
    // changed, such as a new home. Show the right room.
    const room = interiorFor(world.character.location, world.character);
    if (world.character.location !== this.locationId || room.id !== this.interior.id) {
      this.scene.restart({ locationId: world.character.location });
      return;
    }

    const time = timeKey(world);
    if (time !== this.lastTime) {
      this.lastTime = time;
      this.placeVisitors(world);
    }
  };

  private teardown(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.input.off('pointerdown', this.onPointerDown, this);
    this.input.off('pointermove', this.onPointerMove, this);
    this.game.canvas.style.cursor = '';
  }
}

function centre(tile: number): number {
  return tile * TILE_SIZE + TILE_SIZE / 2;
}

function timeKey(world: WorldState): number {
  return world.clockDay * 10_000 + world.minuteOfDay;
}
