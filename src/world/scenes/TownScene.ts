import Phaser from 'phaser';

import { closedReason } from '../../core/day';
import { characterLook } from '../../core/look';
import { whoIsHere } from '../../core/schedule';
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
  TOWN_COLUMNS,
  TOWN_ROWS,
  TOWN_ZOOM,
  VIEW_COLUMNS,
  buildWalkable,
  buildingAt,
  districtOf,
  doorOf,
  locationAt,
  type TownBuilding,
} from '../../data/town';
import { createCrowd, stepPose, umbrellaTexture, type Crowd, type Stranger } from '../crowd';
import { isRaining } from '../../core/weather';
import { lookTexture } from '../lookTexture';
import { POSE, VIEW, lookFrame } from '../looks';
import { findPath, type Point } from '../pathfinding';
import { canvasPoint, textResolution } from '../pointer';
import type { WorldHooks } from './InteriorScene';
import { skyAt } from '../sky';

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

// Labels and the hover outline sit above the night sky, so they stay readable.
const DEPTH = { ground: 0, building: 1, prop: 2, crowd: 5, player: 6, rain: 7, sky: 8, labels: 8.5, highlight: 9, lock: 10, hud: 20 };

/** How quickly the sky catches up with the clock, per second. */
const SKY_EASE = 1.5;

/**
 * Phaser draws text at 1x and the camera then magnifies it, which left every
 * label blocky. Rendering it at the magnified size keeps it sharp.
 */
const TEXT_RESOLUTION = textResolution(TOWN_ZOOM);

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
  private playerLook = -1;
  /** Which way the character faces and how long they have been walking. */
  private playerView: number = VIEW.down;
  private walkElapsed = 0;
  private highlight?: Phaser.GameObjects.Rectangle;
  private hovered?: TownBuilding;
  /** What the hovered building is and who is in it, or why it is shut. */
  private tip?: Phaser.GameObjects.Text;
  /** The stranger just greeted, to name them if the hello worked. */
  private greeted: Stranger | null = null;
  /** The tip is showing a stranger rather than a building. */
  private tipOnStranger = false;
  /** The day-night wash over the whole town (GDD §11.1). Render only. */
  private sky?: Phaser.GameObjects.Rectangle;
  private skyNow = { r: 0, g: 0, b: 0, a: 0 };
  /** Streaks of rain over the whole town, and the gloom that comes with it. Render only. */
  private rain?: Phaser.GameObjects.TileSprite;
  private gloom?: Phaser.GameObjects.Rectangle;
  private raining = false;
  private playerUmbrella?: Phaser.GameObjects.Image;
  /** Day and minute last seen, to tell a jump in time from a walk. */
  private lastTime = -1;
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

  constructor(
    private readonly store: GameStore,
    private readonly hooks: WorldHooks,
  ) {
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
    // The furniture for rooms inside (InteriorScene), loaded here once with
    // the town so walking through a door never waits on a download.
    this.load.spritesheet('indoor', `${import.meta.env.BASE_URL}assets/indoor/tilemap.png`, {
      frameWidth: TILE_SIZE,
      frameHeight: TILE_SIZE,
      spacing: SHEET_SPACING,
    });
  }

  create(): void {
    // The scene is started again every time the character comes out of a
    // building, and Phaser keeps the same object: clear what the last visit left.
    this.path = [];
    this.playerLook = -1;
    this.playerView = VIEW.down;
    this.walkElapsed = 0;
    this.hovered = undefined;

    this.drawGround();
    this.drawBuildings();
    this.drawProps();

    // The crowd draws from its own RNG, deliberately not the simulation's:
    // decoration must never shift the sequence the game rolls its events from.
    this.crowd = createCrowd(this, TEXTURE, createRng(0x7ac0).next, DEPTH.crowd);

    const world = this.store.getState();
    this.lastLocation = world?.character.location;
    this.tile = doorOf(world?.character.location ?? 'home');

    this.player = this.add.image(centre(this.tile.x), centre(this.tile.y), TEXTURE).setDepth(DEPTH.player);
    this.refreshLook(world);

    this.highlight = this.add
      .rectangle(0, 0, 1, 1)
      .setOrigin(0)
      .setStrokeStyle(1, 0xffd479, 0.95)
      .setFillStyle(0xffd479, 0.12)
      .setDepth(DEPTH.highlight)
      .setVisible(false);
    this.tip = this.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '7px',
        color: '#ece9e1',
        backgroundColor: '#151a26ee',
        padding: { x: 3, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.hud)
      .setResolution(TEXT_RESOLUTION)
      .setVisible(false);

    this.sky = this.add
      .rectangle(0, 0, TOWN_COLUMNS * TILE_SIZE, TOWN_ROWS * TILE_SIZE, 0x000000, 0)
      .setOrigin(0)
      .setDepth(DEPTH.sky);
    if (world) {
      const start = skyAt(world.minuteOfDay);
      this.skyNow = { r: start.colour[0], g: start.colour[1], b: start.colour[2], a: start.alpha };
      this.lastTime = timeKey(world);
    }

    this.buildRain();
    this.playerUmbrella = this.add
      .image(0, 0, umbrellaTexture(this))
      .setTint(0x3d6fb6)
      .setDepth(DEPTH.player + 0.1)
      .setVisible(false);
    this.raining = false;
    this.refreshRain(world);

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
    this.input.on('pointermove', this.onPointerMove, this);
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
    this.paintSky(delta);
    this.fallRain(delta);
  }

  // --- rain (GDD §12) ---------------------------------------------------------

  /** A tile of streaks, drawn rather than downloaded, scrolled to fall. */
  private buildRain(): void {
    if (!this.textures.exists('rain')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.lineStyle(1, 0xbcd4f0, 0.55);
      const rng = createRng(0x4a1d).next;
      for (let i = 0; i < 26; i += 1) {
        const x = rng() * 64;
        const y = rng() * 64;
        g.lineBetween(x, y, x - 2, y + 6);
      }
      g.generateTexture('rain', 64, 64);
      g.destroy();
    }
    const width = TOWN_COLUMNS * TILE_SIZE;
    const height = TOWN_ROWS * TILE_SIZE;
    this.gloom = this.add.rectangle(0, 0, width, height, 0x1d2a3d, 0.22).setOrigin(0).setDepth(DEPTH.rain).setVisible(false);
    this.rain = this.add.tileSprite(0, 0, width, height, 'rain').setOrigin(0).setDepth(DEPTH.rain).setVisible(false);
  }

  private refreshRain(world: WorldState | null): void {
    const raining = world !== null && isRaining(world);
    if (raining === this.raining) return;
    this.raining = raining;
    this.rain?.setVisible(raining);
    this.gloom?.setVisible(raining);
    this.crowd?.setRain(raining);
  }

  private fallRain(delta: number): void {
    if (this.raining && this.rain) {
      this.rain.tilePositionY -= delta * 0.12;
      this.rain.tilePositionX += delta * 0.04;
    }
    const player = this.player;
    const world = this.store.getState();
    const covered = this.raining && player !== undefined && world?.character.inventory.includes('umbrella') === true;
    this.playerUmbrella?.setVisible(covered);
    if (covered && player) this.playerUmbrella?.setPosition(player.x, player.y - 7);
  }

  /** Eases the wash towards the colour of the current hour. */
  private paintSky(delta: number): void {
    const world = this.store.getState();
    if (!this.sky || !world) return;
    const target = skyAt(world.minuteOfDay);
    const t = Math.min(1, (SKY_EASE * delta) / 1000);
    const now = this.skyNow;
    now.r += (target.colour[0] - now.r) * t;
    now.g += (target.colour[1] - now.g) * t;
    now.b += (target.colour[2] - now.b) * t;
    now.a += (target.alpha - now.a) * t;
    this.sky.setFillStyle(Phaser.Display.Color.GetColor(now.r, now.g, now.b), now.a);
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

    this.arrows.left = this.add.text(0, 0, '', style).setOrigin(0.5).setDepth(DEPTH.hud).setResolution(TEXT_RESOLUTION);
    this.arrows.right = this.add.text(0, 0, '', style).setOrigin(0.5).setDepth(DEPTH.hud).setResolution(TEXT_RESOLUTION);
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
        .setDepth(DEPTH.labels)
        .setResolution(TEXT_RESOLUTION);
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
      .setOrigin(0.5)
      .setResolution(TEXT_RESOLUTION);

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

    const point = canvasPoint(this.game, pointer);
    if (!point) return;

    // The district arrows sit on top of the map, so they get the click first.
    const arrow = this.arrowAt(point);
    if (arrow) {
      this.lookAt(this.viewDistrict + (arrow === 'left' ? -1 : 1));
      return;
    }

    // Someone walking past: say hello (GDD §11.6).
    const stranger = this.strangerAt(point);
    if (stranger) {
      this.greeted = stranger;
      this.hooks.greet(stranger.look);
      return;
    }

    const clicked = this.tileAt(point);
    // Anywhere on a building means "go in": walk to its door.
    const building = buildingAt(clicked.x, clicked.y);
    const target = building ? doorOf(building.locationId) : clicked;

    // A click on a tree or the road simply does nothing. Better than walking
    // somewhere the player did not ask for.
    const route = findPath(this.walkable, this.tile, target);
    if (!route) return;
    this.path = route;
    // Already on the doorstep: go straight in.
    if (route.length === 0) this.onArrived();
  };

  private strangerAt(point: { x: number; y: number }): Stranger | null {
    const world = this.cameras.main.getWorldPoint(point.x, point.y);
    return this.crowd?.strangerAt(world.x, world.y) ?? null;
  }

  /** Lights up the building under the pointer, so it is plain what a click does. */
  private onPointerMove = (pointer: Phaser.Input.Pointer): void => {
    const point = canvasPoint(this.game, pointer);
    const stranger = point && !this.isLocked(this.store.getState()) ? this.strangerAt(point) : null;
    if (stranger) {
      this.hovered = undefined;
      this.tipOnStranger = true;
      this.highlight?.setVisible(false);
      this.game.canvas.style.cursor = 'pointer';
      this.tip
        ?.setText('A stranger \u00b7 say hello')
        .setOrigin(0.5, 1)
        .setPosition(stranger.x, stranger.y - 9)
        .setVisible(true);
      return;
    }
    const tile = point ? this.tileAt(point) : null;
    const building =
      tile && !this.isLocked(this.store.getState()) ? buildingAt(tile.x, tile.y) : undefined;
    if (building === this.hovered && !this.tipOnStranger) return;
    this.tipOnStranger = false;

    this.hovered = building;
    this.game.canvas.style.cursor = building ? 'pointer' : '';
    if (!building) {
      this.highlight?.setVisible(false);
      this.tip?.setVisible(false);
      return;
    }
    this.highlight
      ?.setPosition(building.x * TILE_SIZE, building.y * TILE_SIZE)
      .setSize(building.width * TILE_SIZE, building.height * TILE_SIZE)
      .setVisible(true);
    this.tip
      ?.setText(this.describe(building))
      .setPosition(centre(building.x + (building.width - 1) / 2), building.y * TILE_SIZE + (building.y === 0 ? 30 : -2))
      .setOrigin(0.5, building.y === 0 ? 0 : 1)
      .setVisible(true);
  };

  /** "Cafe \u00b7 2 you know inside", or "Cafe \u00b7 Closed \u00b7 opens 07:00". */
  private describe(building: TownBuilding): string {
    const world = this.store.getState();
    const name = label(building.locationId);
    if (!world) return name;
    const closed = closedReason(building.locationId, world.minuteOfDay);
    if (closed) return `${name} \u00b7 ${closed}`;
    const inside = whoIsHere(world, building.locationId).length;
    return inside > 0 ? `${name} \u00b7 ${inside} you know inside` : name;
  }

  private tileAt(canvasPoint: { x: number; y: number }): Point {
    const point = this.cameras.main.getWorldPoint(canvasPoint.x, canvasPoint.y);
    return { x: Math.floor(point.x / TILE_SIZE), y: Math.floor(point.y / TILE_SIZE) };
  }

  private stepAlongPath(delta: number): void {
    const player = this.player;
    const next = this.path[0];
    if (!player || !next) return;

    this.walkElapsed += delta;
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
    if (Math.abs(dx) > Math.abs(dy)) this.playerView = dx < 0 ? VIEW.left : VIEW.right;
    else this.playerView = dy < 0 ? VIEW.up : VIEW.down;
    this.player?.setFrame(lookFrame(this.playerView, stepPose(this.walkElapsed)));
  }

  /** Arriving on a doorstep is what opens that place's menu. */
  private onArrived(): void {
    this.playerView = VIEW.down;
    this.walkElapsed = 0;
    this.player?.setFrame(lookFrame(VIEW.down, POSE.stand));

    const locationId = locationAt(this.tile.x, this.tile.y);
    if (!locationId) return;

    this.lastLocation = locationId;
    this.store.dispatch({ type: 'enterLocation', locationId });

    // Through the door and inside (GDD §11.4) - unless it is shut.
    const world = this.store.getState();
    if (!world || this.isLocked(world)) return;
    const closed = closedReason(locationId, world.minuteOfDay);
    if (closed) {
      this.flash(`${label(locationId)} \u00b7 ${closed}`);
      return;
    }
    this.scene.start('Interior', { locationId });
  }

  /** A short message over the character's head, then gone. Render only. */
  private flash(text: string): void {
    const player = this.player;
    if (!player) return;
    const note = this.add
      .text(player.x, player.y - 10, text, {
        fontFamily: 'monospace',
        fontSize: '7px',
        color: '#ffb454',
        backgroundColor: '#151a26ee',
        padding: { x: 3, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.hud)
      .setResolution(TEXT_RESOLUTION);
    this.time.delayedCall(2200, () => note.destroy());
  }

  // --- reacting to the rest of the game -----------------------------------

  private onStoreChanged = (): void => {
    const world = this.store.getState();
    this.refreshLock(world);
    this.refreshLook(world);
    this.refreshRain(world);
    if (!world) return;
    this.nameGreeted(world);

    const location = world.character.location;
    const time = timeKey(world);
    const clockMoved = time !== this.lastTime;
    this.lastTime = time;
    if (location === this.lastLocation) return;
    this.lastLocation = location;

    // The clock jumped with the move - a working day went by - so the
    // character did not walk there afterwards: they were there all along.
    if (clockMoved) {
      this.path = [];
      this.tile = doorOf(location);
      this.player?.setPosition(centre(this.tile.x), centre(this.tile.y));
      this.lookAt(districtOf(this.tile.x));
      return;
    }

    // Something outside the map moved the character - a location tab, or
    // picking a focus that lives somewhere else. Walk there so the two views
    // never disagree about where the character is standing.
    const route = findPath(this.walkable, this.tile, doorOf(location));
    if (route) this.path = route;
  };

  /** A hello that worked: the stranger now has a name over their head. */
  private nameGreeted(world: WorldState): void {
    const greeted = this.greeted;
    if (!greeted) return;
    const met = world.people.find((person) => person.look === greeted.look);
    if (!met) return;
    this.crowd?.name(greeted.index, met.name.split(' ')[0] ?? met.name, TEXT_RESOLUTION);
    this.greeted = null;
  }

  /** The character's look (GDD §3.2). Cosmetic, so only the sprite cares. */
  private refreshLook(world: WorldState | null): void {
    const look = world ? characterLook(world.character) : 0;
    if (look === this.playerLook || !this.player) return;
    this.playerLook = look;
    this.player.setTexture(lookTexture(this, TEXTURE, look), lookFrame(this.playerView, POSE.stand));
  }

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
    this.input.off('pointermove', this.onPointerMove, this);
    this.crowd?.destroy();
    this.crowd = undefined;
  }
}

/** One number for "which moment of which day", to spot the clock moving. */
function timeKey(world: WorldState): number {
  return world.clockDay * 10_000 + world.minuteOfDay;
}

/** Centre of a tile, in pixels. Sprites are drawn from their middle. */
function centre(tile: number): number {
  return tile * TILE_SIZE + TILE_SIZE / 2;
}

/** The same names the location tabs use, from the same data file. */
function label(locationId: LocationId): string {
  return LOCATIONS.find((l) => l.id === locationId)?.label ?? locationId;
}
