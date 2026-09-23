import { BALANCE } from '../data/balance';
import { findItem, type ItemDefinition } from '../data/items';
import { closedReason, freeUntil, landEffects, passTime } from './day';
import { hashText } from './hash';
import type { WorldState } from './types';

/**
 * The bag and the Supermarket (GDD §12). Pure functions over WorldState.
 *
 * Deals are worked out from the day, never from the saved RNG: a price tag
 * must not shift the dice for everything that follows.
 */

function busy(state: WorldState): boolean {
  return state.deceased || state.pendingEvent !== null;
}

/**
 * Whole dollars off today, or 0. The same all day, for everyone. Prices are
 * whole dollars, so a deal is always at least a dollar - "20% off" a $2 roll
 * that still costs $2 is not a deal - and never makes anything free.
 */
export function dealOf(item: ItemDefinition, clockDay: number): number {
  const { dealChance, dealSizes } = BALANCE.bag;
  const roll = hashText(`deal:${item.id}:${clockDay}`) % 100;
  if (roll >= dealChance * 100) return 0;
  const percent = dealSizes[roll % dealSizes.length]!;
  return Math.min(item.price - 1, Math.max(1, Math.round((item.price * percent) / 100)));
}

/** What it costs today. */
export function priceOf(item: ItemDefinition, clockDay: number): number {
  return item.price - dealOf(item, clockDay);
}

export function buyBlocker(state: WorldState, item: ItemDefinition): string | null {
  if (busy(state)) return 'Not now';
  if (state.character.location !== 'supermarket') return 'Only at the Supermarket';
  const closed = closedReason('supermarket', state.minuteOfDay);
  if (closed) return closed;
  if (item.tool && state.character.inventory.includes(item.id)) return 'Already have one';
  if (state.character.inventory.length >= BALANCE.bag.slots) return 'Bag is full';
  // Like any purchase, not on money you do not have.
  if (priceOf(item, state.clockDay) > state.character.stats.money) return 'Cannot afford';
  return null;
}

export function buyItem(state: WorldState, itemId: string): WorldState {
  const item = findItem(itemId);
  if (buyBlocker(state, item) !== null) return state;
  const { character } = state;
  return {
    ...state,
    character: {
      ...character,
      inventory: [...character.inventory, item.id],
      stats: { ...character.stats, money: character.stats.money - priceOf(item, state.clockDay) },
    },
  };
}

export function consumeBlocker(state: WorldState, item: ItemDefinition): string | null {
  if (busy(state)) return 'Not now';
  if (item.tool) return 'Kept in the bag';
  if (!state.character.inventory.includes(item.id)) return 'None in the bag';
  if (state.minuteOfDay + item.minutes > freeUntil(state)) return 'Not enough time';
  return null;
}

/** Eats, drinks or uses one, wherever the character is. */
export function consumeItem(state: WorldState, itemId: string): WorldState {
  const item = findItem(itemId);
  if (consumeBlocker(state, item) !== null) return state;

  const key = `item:${item.id}`;
  const firstToday = !state.doneToday.includes(key);
  const played = passTime(state, item.minutes);
  const inventory = [...played.character.inventory];
  inventory.splice(inventory.indexOf(item.id), 1);

  return landEffects(
    {
      ...played,
      doneToday: firstToday ? [...played.doneToday, key] : played.doneToday,
      character: { ...played.character, inventory },
    },
    item.needs ?? {},
    firstToday ? (item.effects ?? {}) : {},
    0,
  );
}
