import { ITEMS } from '../data/items';
import { PEOPLE_LINES, TOWN_HEADLINES } from '../data/news';
import { dealOf } from './bag';
import { hhmm } from './day';
import { hashText } from './hash';
import { rainOn } from './weather';
import type { WorldState } from './types';

/**
 * Today's headlines on the phone (GDD §12). Worked out from the world and
 * the day, never saved and never drawn from the RNG: reading the news must
 * not change the news.
 */

export interface Headline {
  tag: 'Weather' | 'Deals' | 'Town' | 'People' | 'Markets';
  text: string;
}

export function forecastLine(characterId: string, clockDay: number, when: 'Today' | 'Tomorrow'): string {
  const rain = rainOn(characterId, clockDay);
  return rain
    ? `${when}: rain from ${hhmm(rain.from)} to ${hhmm(rain.to)}. Take an umbrella.`
    : `${when}: dry all day.`;
}

function pick<T>(list: readonly T[], key: string): T {
  return list[hashText(key) % list.length]!;
}

export function headlinesFor(state: WorldState): Headline[] {
  const { clockDay, character } = state;
  const headlines: Headline[] = [
    { tag: 'Weather', text: forecastLine(character.id, clockDay, 'Today') },
  ];

  const best = ITEMS.map((item) => ({ item, off: dealOf(item, clockDay) }))
    .filter((deal) => deal.off > 0)
    .sort((a, b) => b.off - a.off)[0];
  if (best) headlines.push({ tag: 'Deals', text: `Supermarket: ${best.item.label} $${best.off} off today.` });

  const grownUps = state.people.filter((person) => person.job !== null);
  if (grownUps.length > 0) {
    const person = pick(grownUps, `news:person:${clockDay}`);
    const line = pick(PEOPLE_LINES, `news:line:${clockDay}`);
    headlines.push({
      tag: 'People',
      text: line.replaceAll('{name}', person.name.split(' ')[0] ?? person.name).replaceAll('{job}', person.job ?? 'worker'),
    });
  }

  // Two town stories a day, never the same one twice.
  const first = hashText(`news:town:${clockDay}`) % TOWN_HEADLINES.length;
  const second = (first + 1 + (hashText(`news:town2:${clockDay}`) % (TOWN_HEADLINES.length - 1))) % TOWN_HEADLINES.length;
  headlines.push({ tag: 'Town', text: TOWN_HEADLINES[first]! }, { tag: 'Town', text: TOWN_HEADLINES[second]! });

  return headlines;
}
