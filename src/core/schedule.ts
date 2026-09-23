import { LOCATIONS } from '../data/locations';
import { isWeekend } from './day';
import type { LocationId, Person, WorldState } from './types';

/**
 * Where the people the player knows are, hour by hour (GDD §11.4).
 *
 * Worked out from who they are, the day and the hour - never from the
 * simulation's RNG, which is saved: spending it on who happens to be in the
 * Cafe would shift every event that follows. So the same person is in the same
 * place at the same moment every time the game is loaded.
 */

function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

function isOpen(locationId: LocationId, minute: number): boolean {
  const place = LOCATIONS.find((l) => l.id === locationId);
  return !place || (minute >= place.opens && minute < place.closes);
}

/** Where this person is right now, or null when they are off somewhere else. */
export function whereIs(person: Person, clockDay: number, minuteOfDay: number): LocationId | null {
  const hour = Math.floor(minuteOfDay / 60);
  const weekend = isWeekend(clockDay);
  // A fresh roll every day, the same all day: a friend who is at the Cafe
  // this evening stays there for the evening.
  const roll = hash(`${person.id}:${clockDay}`) % 100;
  const evening = hour >= 17 && hour < 22;
  const daytime = hour >= 9 && hour < 17;

  let place: LocationId | null = null;
  switch (person.kind) {
    case 'partner':
    case 'child':
      if (!daytime || weekend) place = 'home';
      break;
    case 'family':
      if (weekend && hour >= 10 && hour < 18 && roll < 35) place = 'cafe';
      else if (evening && roll < 12) place = 'home';
      break;
    case 'friend':
      if (evening) place = roll < 35 ? 'cafe' : roll < 50 ? 'gym' : null;
      else if (weekend && daytime && roll < 25) place = 'cafe';
      break;
    case 'colleague':
      if (!weekend && daytime) place = 'work';
      else if (!weekend && hour >= 17 && hour < 19 && roll < 30) place = 'cafe';
      break;
  }
  return place && isOpen(place, minuteOfDay) ? place : null;
}

/** Everyone the player knows who is at this place right now. */
export function whoIsHere(state: WorldState, locationId: LocationId): Person[] {
  return state.people.filter((person) => whereIs(person, state.clockDay, state.minuteOfDay) === locationId);
}
