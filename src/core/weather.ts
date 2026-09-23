import { BALANCE } from '../data/balance';
import { hashText } from './hash';
import { withLogEntry } from './log';
import type { WorldState } from './types';

/**
 * The weather (GDD §12). Worked out from the life and the day, never from the
 * saved RNG, and never saved: a rainy afternoon must not shift the dice for
 * everything that follows. The same day rains the same way every time it is
 * loaded, so the forecast is always right.
 */

const W = BALANCE.weather;

export interface Rain {
  from: number;
  to: number;
}

/** When it rains today, or null for a dry day. */
export function rainOn(characterId: string, clockDay: number): Rain | null {
  const roll = hashText(`rain:${characterId}:${clockDay}`);
  if (roll % 100 >= W.rainChance * 100) return null;
  const startHour = W.earliestHour + (Math.floor(roll / 100) % W.startSpreadHours);
  const hours = W.minHours + (Math.floor(roll / 10_000) % (W.maxHours - W.minHours + 1));
  const from = startHour * 60;
  return { from, to: Math.min(BALANCE.day.latest, from + hours * 60) };
}

export function isRaining(state: Pick<WorldState, 'clockDay' | 'minuteOfDay' | 'character'>): boolean {
  const rain = rainOn(state.character.id, state.clockDay);
  return rain !== null && state.minuteOfDay >= rain.from && state.minuteOfDay < rain.to;
}

/**
 * Walking somewhere in the rain without an umbrella (GDD §12): a little
 * grubbier and a little glummer. Said once a day in the log, felt every trip.
 */
export function caughtInRain(state: WorldState): WorldState {
  if (!isRaining(state) || state.character.inventory.includes('umbrella')) return state;
  const { character } = state;
  const said = state.doneToday.includes('wet');
  return {
    ...state,
    doneToday: said ? state.doneToday : [...state.doneToday, 'wet'],
    eventLog: said
      ? state.eventLog
      : withLogEntry(state.eventLog, {
          day: state.clockDay,
          tone: 'bad',
          text: 'Got caught in the rain. An umbrella from the Supermarket would help.',
        }),
    character: {
      ...character,
      needs: { ...character.needs, hygiene: Math.max(BALANCE.statMin, character.needs.hygiene + W.wet.hygiene) },
      stats: { ...character.stats, mood: Math.max(BALANCE.statMin, character.stats.mood + W.wet.mood) },
    },
  };
}
