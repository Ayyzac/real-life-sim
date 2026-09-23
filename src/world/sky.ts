/**
 * The colour of the sky over the day (GDD §11.1), shared by the map's
 * day-night wash and the day bar at the top of the screen. Pure, no Phaser.
 *
 * Times are minutes after midnight, running past 1440 after midnight. Alpha is
 * how strongly the colour is laid over the map; zero is plain daylight.
 */

export interface SkyStop {
  minute: number;
  colour: readonly [number, number, number];
  alpha: number;
}

export const SKY: readonly SkyStop[] = [
  { minute: 6 * 60, colour: [255, 150, 90], alpha: 0.22 },
  { minute: 8 * 60, colour: [255, 200, 140], alpha: 0 },
  { minute: 16 * 60, colour: [255, 200, 140], alpha: 0 },
  { minute: 18 * 60, colour: [255, 120, 80], alpha: 0.2 },
  { minute: 19 * 60 + 30, colour: [70, 60, 140], alpha: 0.38 },
  { minute: 21 * 60, colour: [20, 28, 70], alpha: 0.5 },
  { minute: 26 * 60, colour: [12, 16, 48], alpha: 0.56 },
];

export function skyAt(minute: number): SkyStop {
  const first = SKY[0]!;
  const last = SKY[SKY.length - 1]!;
  if (minute <= first.minute) return { ...first, minute };
  if (minute >= last.minute) return { ...last, minute };

  const next = SKY.findIndex((stop) => stop.minute > minute);
  const a = SKY[next - 1]!;
  const b = SKY[next]!;
  const t = (minute - a.minute) / (b.minute - a.minute);
  const mix = (x: number, y: number): number => x + (y - x) * t;

  return {
    minute,
    colour: [mix(a.colour[0], b.colour[0]), mix(a.colour[1], b.colour[1]), mix(a.colour[2], b.colour[2])],
    alpha: mix(a.alpha, b.alpha),
  };
}

/**
 * The sky itself, for the day bar: what you would see looking up, rather than
 * the wash laid over the map. Same times as SKY.
 */
export const SKY_BAND: readonly (readonly [number, string])[] = [
  [7 * 60, '#f5a26e'],
  [8 * 60 + 30, '#8ecae6'],
  [16 * 60, '#8ecae6'],
  [18 * 60, '#ee8a6a'],
  [19 * 60 + 30, '#58489a'],
  [21 * 60, '#1e2858'],
  [26 * 60, '#10163a'],
];
