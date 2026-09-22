import Phaser from 'phaser';

import { clampAppearance, DEFAULT_APPEARANCE_ROW } from '../../core/character';
import { createRng } from '../../core/rng';
import type { GameStore } from '../../core/store';
import type { LocationId, WorldState } from '../../core/types';
import { LOCATIONS } from '../../data/locations';
import {
  BUILDINGS,
  DISTRICTS,
  GROUND,
  GROUND_TILES,
  PROPS,
  SHEET_SPACING,
  TILE_SIZE,
  TOWN_ROWS,
  TOWN_ZOOM,
  VIEW_COLUMNS,
  buildWalkable,
  districtOf,
  doorOf,
  locationAt,
  personFrames,
} from '../../data/town';
import { createCrowd, type Crowd } from '../crowd';
import { findPath, type Point } from '../pathfinding';

/**
 * The town map: the Phase 2 replacement for the Phase 0 placeholder.
 *
 * It talks to the simulation exactly the way the React UI does - reading
 * through `store.getState()`, listening through `store.subscribe`, and asking
 * for changes through `store.dispatch` (CLAUDE.md rule 5). It never calls the
 * engine, and the engine has no idea it exists.
 *
 * The map and the location tabs are two doors onto one piece of state: click a
 * building and the character walks there and the tab follows; click a tab and
 * the character walks there on the map.
 */

const TEXTURE = 'town';
/** Tiles per second. Fast enough not to be a wait, slow enough to read. */
const WALK_SPEED = 6;

const DEPTH = { ground: 0, building: 1, prop: 2, crowd: 5, player: 6, lock: 10, hud: 20 };

/** One district exactly fills the canvas, so the view is 800x448 pixels. */
const VIEW_WIDTH = VIEW_COLUMNS * TILE_SIZE * TOWN_ZOOM;
const VIEW_HEIGHT = TOWN_ROWS * TILE_SIZE * TOWN_ZOOM;

/**
 * Where the two district arrows sit, in canvas pixels.
 *
 * They are hit-tested by hand inside the one pointer handler rather than with
 * Phaser's setInteractive, because Phaser's own hit testing reads the same
 * stale pointer position that made map clicks land hundreds of pixels away.
 * One reliable path in, for everything.
 */
const ARROW_HALF = { x: 62, y: 44 };

/** How long the slide between districts takes, in milliseconds. */
const PAN_DURATION = 380;
/**
 * Camera scroll that puts district `d` exactly on screen.
 *
 * Phaser positions a zoomed camera as if it were unzoomed and then magnifies
 * about the centre, so scrollX is NOT simply the left edge of the view. Using
 * it as if it were showed half of one district and half of the next.
 */
function scrollForDistrict(d: number): number {
  const districtWidth = VIEW_COLUMNS * TILE_SIZE;
  return d * districtWidth + districtWidth / 2 - VIEW_WIDTH / 2;
}

const ARROW_CENTRE = {
  left: { x: 74, y: VIEW_HEIGHT / 2 },
  right: { x: VIEW_WIDTH - 74, y: VIEW_HEIGHT / 2 },
};

export class TownScene extends Phaser.Scene {
  private readonly walkable = buildWalkable();
  private player?: Phaser.GameObjects.Image;
  private playerFrames = personFrames(DEFAULT_APPEARANCE_ROW);
  private crowd?: Crowd;
  private lockOverlay?: Phaser.GameObjects.Container;
  private arrows: { left?: Phaser.GameObjects.Text; right?: Phaser.GameObjects.Text } = {};
  /** Which district the camera is looking at. View state, never saved. */
  private viewDistrict = 0;
  /** The camera slide: where from, where to, and how far through it is. */
  private targetScrollX = 0;
  private panFrom = 0;
  private panElapsed = PAN_DURATION;

  /** Squares still to step onto, and where the character is heading overall. */
  private path: Point[] = [];
  private tile: Point = { x: 0, y: 0 };
  private unsubscribe?: () => void;
  private lastLocation?: LocationId;

  constructor(private readonly store: GameStore) {
    super('Town');
  }

  preload(): void {
    // BASE_URL keeps this working under the /real-life-sim/ path on GitHub
    // Pages as well as at the root in development.
    this.load.spritesheet(TEXTURE, `${import.meta.env.BASE_URL}assets/town/tilemap.png`, {
      frameWidth: TILE_SIZE,
      frameHeight: TILE_SIZE,
      spacing: SHEET_SPACING,
    });
  }

  create(): void {
    this.drawGround();
    this.drawBuildings();
    this.drawProps();

    // The crowd draws from its own RNG, deliberately not the simulation's:
    // decoration must never shift the sequence the game rolls its events from.
    this.crowd = createCrowd(this, TEXTURE, createRng(0x7ac0).next, DEPTH.crowd);

    const world = this.store.getState();
    // The player picked a face at character creation (GDD §3.2); it is
    // cosmetic, so nothing else in the scene cares which one.
    this.playerFrames = personFrames(
      clampAppearance(world?.character.appearanceRow ?? DEFAULT_APPEARANCE_ROW),
    );
    this.lastLocation = world?.character.location;
    this.tile = doorOf(world?.character.location ?? 'home');

    this.player = this.add
      .image(centre(this.tile.x), centre(this.tile.y), TEXTURE, this.playerFrames.down)
      .setDepth(DEPTH.player);

    this.buildLockOverlay();
    this.refreshLock(world);

    const camera = this.cameras.main;
    camera.setZoom(TOWN_ZOOM);
    this.viewDistrict = districtOf(this.tile.x);
    camera.centerOn(
      this.viewDistrict * VIEW_COLUMNS * TILE_SIZE + (VIEW_COLUMNS * TILE_SIZE) / 2,
      (TOWN_ROWS * TILE_SIZE) / 2,
    );
    this.targetScrollX = camera.scrollX;

    this.buildArrows();

    // Literal event names on purpose: Phaser.Input.Events.POINTER_DOWN comes
    // through this build as undefined, which registers a listener that never
    // fires and reports no error at all.
    this.input.on('pointerdown', this.onPointerDown, this);
    this.unsubscribe = this.store.subscribe(this.onStoreChanged);

    this.events.once('shutdown', this.teardown, this);
    this.events.once('destroy', this.teardown, this);
  }

  override update(_time: number, delta: number): void {
    this.crowd?.update(delta);
    this.stepAlongPath(delta);
    this.followPlayer();
    this.slideCamera(delta);
    this.placeHud();
  }

  // --- districts ----------------------------------------------------------

  private buildArrows(): void {
    const style = {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#e8edf7',
      backgroundColor: '#1b2231cc',
      padding: { x: 4, y: 3 },
    } as const;

    this.arrows.left = this.add.text(0, 0, '', style).setOrigin(0.5).setDepth(DEPTH.hud);
    this.arrows.right = this.add.text(0, 0, '', style).setOrigin(0.5).setDepth(DEPTH.hud);
    this.refreshArrowLabels();
  }

  private refreshArrowLabels(): void {
    const previous = DISTRICTS[this.viewDistrict - 1];
    const next = DISTRICTS[this.viewDistrict + 1];

    this.arrows.left?.setText(previous ? `< ${previous.label}` : '').setVisible(Boolean(previous));
    this.arrows.right?.setText(next ? `${next.label} >` : '').setVisible(Boolean(next));
  }

  /**
   * Slides the view to another district. The character stays where they are:
   * this is looking around, not walking.
   */
  private lookAt(district: number): void {
    const clamped = Math.min(DISTRICTS.length - 1, Math.max(0, district));
    if (clamped === this.viewDistrict) return;

    this.viewDistrict = clamped;
    this.refreshArrowLabels();
    this.panFrom = this.cameras.main.scrollX;
    this.targetScrollX = scrollForDistrict(clamped);
    this.panElapsed = 0;
  }

  /**
   * Slides the camera towards the district being looked at.
   *
   * Done by hand rather than with this.tweens: a tween on the camera moved it
   * a few pixels and stopped, the same kind of quiet no-op as Phaser's
   * undefined event constants. Five lines here always work.
   */
  private slideCamera(delta: number): void {
    if (this.panElapsed >= PAN_DURATION) return;

    this.panElapsed += delta;
    const t = Math.min(1, this.panElapsed / PAN_DURATION);
    // Ease in and out, so the slide starts and stops gently.
    const eased = t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
    this.cameras.main.scrollX = this.panFrom + (this.targetScrollX - this.panFrom) * eased;
  }

  /** Keeps the character on screen when they walk into the other district. */
  private followPlayer(): void {
    if (this.path.length === 0) return;
    const walkingTo = this.path[this.path.length - 1];
    if (walkingTo) this.lookAt(districtOf(walkingTo.x));
  }

  /**
   * Pins the arrows and the lock notice to the view.
   *
   * Recomputed from the camera every frame rather than relying on scroll
   * factors, which interact with camera zoom in ways that are easy to get
   * subtly wrong and hard to notice.
   */
  private placeHud(): void {
    const camera = this.cameras.main;
    const left = camera.getWorldPoint(ARROW_CENTRE.left.x, ARROW_CENTRE.left.y);
    const right = camera.getWorldPoint(ARROW_CENTRE.right.x, ARROW_CENTRE.right.y);

    this.arrows.left?.setPosition(left.x, left.y);
    this.arrows.right?.setPosition(right.x, right.y);

    const centre = camera.getWorldPoint(VIEW_WIDTH / 2, VIEW_HEIGHT / 2);
    this.lockOverlay?.setPosition(centre.x, centre.y);
  }

  // --- drawing ------------------------------------------------------------

  private drawGround(): void {
    GROUND.forEach((row, y) => {
      [...row].forEach((char, x) => {
        const ground = GROUND_TILES[char];
        if (!ground) return;
        this.add
          .image(x * TILE_SIZE, y * TILE_SIZE, TEXTURE, ground.tile)
          .setOrigin(0)
          .setDepth(DEPTH.ground);
      });
    });
  }

  private drawBuildings(): void {
    for (const building of BUILDINGS) {
      const doorY = building.y + building.height - 1;

      for (let y = building.y; y < building.y + building.height; y += 1) {
        for (let x = building.x; x < building.x + building.width; x += 1) {
          const isDoor = x === building.doorX && y === doorY;
          const frame = isDoor
            ? building.doorTile
            : y === building.y + 1
              ? building.bandTile
              : building.wallTile;

          const image = this.add
            .image(x * TILE_SIZE, y * TILE_SIZE, TEXTURE, frame)
            .setOrigin(0)
            .setDepth(DEPTH.building);
          // The door keeps its own colours; only the walls get repainted.
          if (building.tint !== undefined && !isDoor) image.setTint(building.tint);
        }
      }

      // On the building's own top row, not above it: the northern buildings
      // start at row 0, so anything above them is off the map.
      this.add
        .text(centre(building.x + (building.width - 1) / 2), centre(building.y), label(building.locationId), {
          fontFamily: 'monospace',
          fontSize: '8px',
          color: '#e8edf7',
          backgroundColor: '#1b2231',
          padding: { x: 2, y: 1 },
        })
        .setOrigin(0.5)
        .setDepth(DEPTH.building);
    }
  }

  private drawProps(): void {
    for (const prop of PROPS) {
      this.add
        .image(prop.x * TILE_SIZE, prop.y * TILE_SIZE, TEXTURE, prop.tile)
        .setOrigin(0)
        .setDepth(DEPTH.prop);
    }
  }

  private buildLockOverlay(): void {
    // Sized to the view and moved with the camera, so it covers whichever
    // district is on screen.
    const width = VIEW_COLUMNS * TILE_SIZE;
    const height = TOWN_ROWS * TILE_SIZE;

    const shade = this.add.rectangle(0, 0, width, height, 0x0b0e16, 0.62);
    const text = this.add
      .text(0, 0, 'Answer the question first', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#ffd479',
      })
      .setOrigin(0.5);

    this.lockOverlay = this.add.container(0, 0, [shade, text]).setDepth(DEPTH.lock).setVisible(false);
  }

  /** The arrow a click landed on, if any. Canvas pixels, like the arrows. */
  private arrowAt(point: { x: number; y: number }): 'left' | 'right' | null {
    for (const side of ['left', 'right'] as const) {
      if (!this.arrows[side]?.visible) continue;
      const centre = ARROW_CENTRE[side];
      if (
        Math.abs(point.x - centre.x) <= ARROW_HALF.x &&
        Math.abs(point.y - centre.y) <= ARROW_HALF.y
      ) {
        return side;
      }
    }
    return null;
  }

  // --- walking ------------------------------------------------------------

  private onPointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (this.isLocked(this.store.getState())) return;

    const canvasPoint = this.toCanvasPoint(pointer);
    if (!canvasPoint) return;

    // The district arrows sit on top of the map, so they get the click first.
    const arrow = this.arrowAt(canvasPoint);
    if (arrow) {
      this.lookAt(this.viewDistrict + (arrow === 'left' ? -1 : 1));
      return;
    }

    const point = this.cameras.main.getWorldPoint(canvasPoint.x, canvasPoint.y);
    const target = {
      x: Math.floor(point.x / TILE_SIZE),
      y: Math.floor(point.y / TILE_SIZE),
    };

    // A click on a wall, a tree or the road simply does nothing. Better than
    // walking somewhere the player did not ask for.
    const route = findPath(this.walkable, this.tile, target);
    if (route) this.path = route;
  };

  /**
   * Where the click landed on the canvas, measured fresh from the DOM.
   *
   * Phaser caches the canvas position and only re-reads it on a window resize.
   * This canvas sits under a React panel whose height changes whenever an event
   * dialog opens or the job list grows, so the cached position goes stale and
   * clicks land somewhere else entirely - it was reading clicks as far as 500
   * pixels off, including above the top of the map.
   */
  private toCanvasPoint(pointer: Phaser.Input.Pointer): { x: number; y: number } | null {
    const event = pointer.event as MouseEvent & { changedTouches?: TouchList };
    const touch = event.changedTouches?.[0];
    const clientX = touch ? touch.clientX : event.clientX;
    const clientY = touch ? touch.clientY : event.clientY;
    if (typeof clientX !== 'number' || typeof clientY !== 'number') return null;

    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  private stepAlongPath(delta: number): void {
    const player = this.player;
    const next = this.path[0];
    if (!player || !next) return;

    const targetX = centre(next.x);
    const targetY = centre(next.y);
    const step = (WALK_SPEED * TILE_SIZE * delta) / 1000;

    this.faceTowards(targetX - player.x, targetY - player.y);

    const remaining = Phaser.Math.Distance.Between(player.x, player.y, targetX, targetY);
    if (remaining <= step) {
      player.setPosition(targetX, targetY);
      this.tile = { x: next.x, y: next.y };
      this.path.shift();
      if (this.path.length === 0) this.onArrived();
      return;
    }

    const angle = Math.atan2(targetY - player.y, targetX - player.x);
    player.setPosition(player.x + Math.cos(angle) * step, player.y + Math.sin(angle) * step);
  }

  private faceTowards(dx: number, dy: number): void {
    const player = this.player;
    if (!player) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      player.setFrame(this.playerFrames.side);
      player.setFlipX(dx < 0);
      return;
    }
    player.setFlipX(false);
    player.setFrame(dy < 0 ? this.playerFrames.up : this.playerFrames.down);
  }

  /** Arriving on a doorstep is what opens that place's menu. */
  private onArrived(): void {
    this.player?.setFrame(this.playerFrames.down);
    this.player?.setFlipX(false);

    const locationId = locationAt(this.tile.x, this.tile.y);
    if (!locationId) return;

    this.lastLocation = locationId;
    this.store.dispatch({ type: 'enterLocation', locationId });
  }

  // --- reacting to the rest of the game -----------------------------------

  private onStoreChanged = (): void => {
    const world = this.store.getState();
    this.refreshLock(world);
    if (!world) return;

    const location = world.character.location;
    if (location === this.lastLocation) return;
    this.lastLocation = location;

    // Something outside the map moved the character - a location tab, or
    // picking a focus that lives somewhere else. Walk there so the two views
    // never disagree about where the character is standing.
    const route = findPath(this.walkable, this.tile, doorOf(location));
    if (route) this.path = route;
  };

  private isLocked(world: WorldState | null): boolean {
    return world === null || world.deceased || world.pendingEvent !== null;
  }

  private refreshLock(world: WorldState | null): void {
    const locked = this.isLocked(world);
    this.lockOverlay?.setVisible(locked);
    if (locked) this.path = [];
  }

  private teardown(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.input.off('pointerdown', this.onPointerDown, this);
    this.crowd?.destroy();
    this.crowd = undefined;
  }
}

/** Centre of a tile, in pixels. Sprites are drawn from their middle. */
function centre(tile: number): number {
  return tile * TILE_SIZE + TILE_SIZE / 2;
}

/** The same names the location tabs use, from the same data file. */
function label(locationId: LocationId): string {
  return LOCATIONS.find((l) => l.id === locationId)?.label ?? locationId;
}
