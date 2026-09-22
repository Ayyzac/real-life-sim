import { BALANCE } from '../data/balance';
import { EVENTS, findEvent, type EventChoice, type LifeEvent } from '../data/events';
import type { Attributes, Character, EventEffect, Stats } from './types';
import type { Rng } from './rng';

/**
 * The generic engine behind life events (ARCHITECTURE §3).
 *
 * It knows nothing about any specific event - adding one means editing
 * src/data/events.ts and nothing here.
 *
 * Pacing note: one roll per day picks AT MOST one event, instead of every
 * event rolling for itself. With a full life running to ~3,700 weeks, letting
 * each of a dozen events roll independently would bury the player. This way
 * the pace is one number, BALANCE.eventChancePerDay.
 */

export function eligibleEvents(character: Character): LifeEvent[] {
  return EVENTS.filter((event) => !event.eligibility || event.eligibility(character));
}

/** Picks one event for today, or null if today is uneventful. */
export function rollEvent(character: Character, rng: Rng): LifeEvent | null {
  if (!rng.chance(BALANCE.eventChancePerDay)) return null;

  const candidates = eligibleEvents(character);
  if (candidates.length === 0) return null;

  const totalWeight = candidates.reduce((sum, event) => sum + event.weight, 0);
  let ticket = rng.next() * totalWeight;

  for (const event of candidates) {
    ticket -= event.weight;
    if (ticket < 0) return event;
  }

  // Floating point can leave a sliver at the very end of the range.
  return candidates[candidates.length - 1] ?? null;
}

/**
 * Applies a one-off effect.
 *
 * Death is always preceded by visible decline (user decision, 22 Sep 2026),
 * so an event cannot take a healthy character straight to zero - it stops at
 * BALANCE.eventHealthFloor and leaves them on the brink.
 *
 * The one exception is someone already below BALANCE.criticalHealth, who an
 * event CAN finish. They have been living on a red warning for a long time;
 * that is the visible decline. Without the exception nothing could kill a
 * character under 45, because exhaustion stops at its own floor and ageing
 * has not begun - they were immortal.
 */
export function applyEffect(character: Character, effect: EventEffect): Character {
  const { statMin, statMax, eventHealthFloor, criticalHealth } = BALANCE;
  const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

  const alreadyCritical = character.stats.health <= criticalHealth;
  const healthFloor = alreadyCritical ? statMin : eventHealthFloor;

  const stats: Stats = {
    money: Math.round(character.stats.money + (effect.money ?? 0)),
    health: clamp(character.stats.health + (effect.health ?? 0), healthFloor, statMax),
    energy: clamp(character.stats.energy + (effect.energy ?? 0), statMin, statMax),
    mood: clamp(character.stats.mood + (effect.mood ?? 0), statMin, statMax),
  };

  const attributes: Attributes = {
    intelligence: clamp(
      character.attributes.intelligence + (effect.intelligence ?? 0),
      statMin,
      statMax,
    ),
    physical: clamp(character.attributes.physical + (effect.physical ?? 0), statMin, statMax),
    charisma: clamp(character.attributes.charisma + (effect.charisma ?? 0), statMin, statMax),
  };

  return { ...character, stats, attributes };
}

/** True when this event stops the week to ask the player something. */
export function needsDecision(event: LifeEvent): boolean {
  return (event.choices?.length ?? 0) > 0;
}

export function findChoice(event: LifeEvent, choiceId: string): EventChoice {
  const choice = event.choices?.find((c) => c.id === choiceId);
  if (!choice) throw new Error(`Event "${event.id}" has no choice "${choiceId}"`);
  return choice;
}

export { EVENTS, findEvent };
export type { EventChoice, LifeEvent };
