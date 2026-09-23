import { BALANCE } from '../data/balance';
import { LOCATIONS } from '../data/locations';
import { isWeekend } from './day';
import { hashText } from './hash';
import type { LocationId, Person, WorldState } from './types';

/**
 * Where the people the player knows are, hour by hour (GDD §11.4).
 *
 * Worked out from who they are, the day and the hour - never from the
 * simulation's RNG, which is saved: spending it on who happens to be in the
 * Cafe would shift every event that follows. So the same person is in the same
 * place at the same moment every time the game is loaded.
 */

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
  const roll = hashText(`${person.id}:${clockDay}`) % 100;
  const evening = hour >= 17 && hour < 22;
  const daytime = hour >= 9 && hour < 17;

  let place: LocationId | null = null;
  switch (person.kind) {
    case 'partner':
    case 'child':
      if (!daytime || weekend) place = 'home';
      break;
    case 'family':
      // Never at the player's home uninvited (user decision, 23 Sep 2026):
      // someone who lives alone comes back to an empty flat.
      if (weekend && hour >= 10 && hour < 18 && roll < 40) place = roll < 20 ? 'cafe' : 'mall';
      break;
    case 'friend':
      if (evening) place = roll < 30 ? 'cafe' : roll < 42 ? 'gym' : roll < 55 ? 'mall' : null;
      else if (weekend && daytime && roll < 30) place = roll < 15 ? 'cafe' : 'mall';
      break;
    case 'dating':
      if (evening) place = roll < 45 ? 'cafe' : roll < 70 ? 'mall' : null;
      else if (weekend && daytime && roll < 40) place = 'mall';
      break;
    case 'colleague':
      if (!weekend && daytime) place = 'work';
      else if (!weekend && hour >= 17 && hour < 19 && roll < 30) place = 'cafe';
      break;
  }
  return place && isOpen(place, minuteOfDay) ? place : null;
}

/**
 * Invited home tonight (GDD §12): they stay for the rest of the evening, and
 * are nowhere else meanwhile.
 */
export function hostedTonight(state: Pick<WorldState, 'doneToday' | 'minuteOfDay'>, person: Person): boolean {
  return state.doneToday.includes(`host:${person.id}`) && state.minuteOfDay < BALANCE.day.midnight;
}

/** Everyone the player knows who is at this place right now. */
export function whoIsHere(state: WorldState, locationId: LocationId): Person[] {
  return state.people.filter((person) =>
    hostedTonight(state, person)
      ? locationId === 'home'
      : whereIs(person, state.clockDay, state.minuteOfDay) === locationId,
  );
}
