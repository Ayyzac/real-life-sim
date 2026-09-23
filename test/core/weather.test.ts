import { describe, expect, it } from 'vitest';

import { createWorld } from '../../src/core/character';
import type { SaveProvider } from '../../src/core/save/SaveProvider';
import { GameStore } from '../../src/core/store';
import type { WorldState } from '../../src/core/types';
import { caughtInRain, isRaining, rainOn } from '../../src/core/weather';
import { BALANCE } from '../../src/data/balance';

const base = createWorld({ name: 'Drizzle', backgroundId: 'scholarship', seed: 31 });
const id = base.character.id;

/** The first rainy day of this life, at a minute when it is raining. */
function rainyMoment(): WorldState {
  for (let day = 0; day < 100; day += 1) {
    const rain = rainOn(id, day);
    if (rain) return { ...base, clockDay: day, minuteOfDay: rain.from };
  }
  throw new Error('no rain in 100 days');
}

describe('the weather (GDD §12)', () => {
  it('rains on about one day in four, the same way every time', () => {
    let wet = 0;
    for (let day = 0; day < 2000; day += 1) {
      expect(rainOn(id, day)).toEqual(rainOn(id, day));
      const rain = rainOn(id, day);
      if (!rain) continue;
      wet += 1;
      expect(rain.from).toBeGreaterThanOrEqual(6 * 60);
      expect(rain.to).toBeGreaterThan(rain.from);
      expect(rain.to).toBeLessThanOrEqual(BALANCE.day.latest);
    }
    expect(wet / 2000).toBeGreaterThan(0.2);
    expect(wet / 2000).toBeLessThan(0.3);
  });

  it('knows when it is raining and when it is not', () => {
    const wet = rainyMoment();
    const rain = rainOn(id, wet.clockDay)!;
    expect(isRaining(wet)).toBe(true);
    expect(isRaining({ ...wet, minuteOfDay: rain.to })).toBe(false);
  });

  it('leaves someone who walks out without an umbrella grubbier and glummer, said once a day', () => {
    const wet = rainyMoment();
    const once = caughtInRain(wet);
    const twice = caughtInRain(once);

    expect(once.character.needs.hygiene).toBe(wet.character.needs.hygiene + BALANCE.weather.wet.hygiene);
    expect(once.character.stats.mood).toBe(wet.character.stats.mood + BALANCE.weather.wet.mood);
    expect(twice.character.needs.hygiene).toBeLessThan(once.character.needs.hygiene);
    expect(twice.eventLog.length).toBe(once.eventLog.length);
  });

  it('keeps an umbrella carrier dry, and a dry day dry', () => {
    const wet = rainyMoment();
    const covered = { ...wet, character: { ...wet.character, inventory: ['umbrella'] } };
    expect(caughtInRain(covered)).toBe(covered);

    const dry = { ...wet, minuteOfDay: rainOn(id, wet.clockDay)!.to };
    expect(caughtInRain(dry)).toBe(dry);
  });

  it('happens on the way somewhere, through the same door as any move', () => {
    const wet = rainyMoment();
    const saves: SaveProvider = { save() {}, load: () => wet, clear() {} };
    const store = new GameStore(saves);

    store.dispatch({ type: 'enterLocation', locationId: 'cafe' });

    expect(store.getState()!.character.location).toBe('cafe');
    expect(store.getState()!.character.needs.hygiene).toBeLessThan(wet.character.needs.hygiene);
  });
});
