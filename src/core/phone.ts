import { BALANCE } from '../data/balance';
import { findItem, type ItemDefinition } from '../data/items';
import { doorOf } from '../data/town';
import { freeUntil, passTime } from './day';
import { withLogEntry } from './log';
import type { LocationId, WorldState } from './types';

/**
 * The phone's errands (GDD §12): a taxi across town and food brought to you.
 * Pure functions over WorldState. Calling and inviting people live with the
 * rest of talking, in ./talk.ts.
 */

const P = BALANCE.phone;

function busy(state: WorldState): boolean {
  return state.deceased || state.pendingEvent !== null;
}

/** Minutes since the life began: a delivery can be due tomorrow morning. */
export function absoluteMinute(state: Pick<WorldState, 'clockDay' | 'minuteOfDay'>): number {
  return state.clockDay * 24 * 60 + state.minuteOfDay;
}

// --- taxi --------------------------------------------------------------------

/** Door to door, by the grid: short hops are cheap, crossing town is not. */
export function fareTo(from: LocationId, to: LocationId): number {
  const a = doorOf(from);
  const b = doorOf(to);
  return Math.round(P.taxi.base + P.taxi.perTile * (Math.abs(a.x - b.x) + Math.abs(a.y - b.y)));
}

export function taxiBlocker(state: WorldState, to: LocationId): string | null {
  if (busy(state)) return 'Not now';
  if (state.character.location === to) return 'Already here';
  if (state.minuteOfDay + P.taxi.minutes > freeUntil(state)) return 'Not enough time';
  if (fareTo(state.character.location, to) > state.character.stats.money) return 'Cannot afford';
  return null;
}

/** There in minutes, dry, and poorer. */
export function takeTaxi(state: WorldState, to: LocationId): WorldState {
  if (taxiBlocker(state, to) !== null) return state;
  const fare = fareTo(state.character.location, to);
  const ridden = passTime(state, P.taxi.minutes);
  return {
    ...ridden,
    character: {
      ...ridden.character,
      location: to,
      stats: { ...ridden.character.stats, money: ridden.character.stats.money - fare },
    },
  };
}

// --- food delivery -----------------------------------------------------------

/** What can be ordered: anything to eat or drink, not the umbrella. */
export function deliverable(item: ItemDefinition): boolean {
  return !item.tool;
}

/** Dearer than the shop, and a fee on top. */
export function deliveryPrice(item: ItemDefinition): number {
  return Math.ceil(item.price * P.delivery.markup) + P.delivery.fee;
}

export function orderBlocker(state: WorldState, item: ItemDefinition): string | null {
  if (busy(state)) return 'Not now';
  if (!deliverable(item)) return 'Not delivered';
  const { inventory, deliveries } = state.character;
  if (inventory.length + deliveries.length >= BALANCE.bag.slots) return 'Bag is full';
  if (deliveryPrice(item) > state.character.stats.money) return 'Cannot afford';
  return null;
}

export function orderFood(state: WorldState, itemId: string): WorldState {
  const item = findItem(itemId);
  if (orderBlocker(state, item) !== null) return state;
  const { character } = state;
  return {
    ...state,
    character: {
      ...character,
      stats: { ...character.stats, money: character.stats.money - deliveryPrice(item) },
      deliveries: [...character.deliveries, { itemId: item.id, at: absoluteMinute(state) + P.delivery.minutes }],
    },
  };
}

/**
 * Hands over whatever has arrived. Returns the same world when nothing has,
 * so it can run after every change without anyone noticing.
 */
export function deliverDue(state: WorldState): WorldState {
  const now = absoluteMinute(state);
  const { deliveries } = state.character;
  const arrived = deliveries.filter((order) => order.at <= now);
  if (arrived.length === 0) return state;

  const names = arrived.map((order) => findItem(order.itemId).label.toLowerCase());
  return {
    ...state,
    eventLog: withLogEntry(state.eventLog, {
      day: state.clockDay,
      tone: 'good',
      text: `Delivered: ${names.join(', ')}. It is in your bag.`,
    }),
    character: {
      ...state.character,
      inventory: [...state.character.inventory, ...arrived.map((order) => order.itemId)],
      deliveries: deliveries.filter((order) => order.at > now),
    },
  };
}
