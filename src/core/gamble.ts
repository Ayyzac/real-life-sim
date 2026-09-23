import {
  PLAY_MINUTES,
  RED_NUMBERS,
  SLOT_BLANKS,
  SLOT_TABLES,
  TABLE_LIMITS,
  type Venue,
} from '../data/gambling';
import { closedReason, freeUntil, passTime } from './day';
import { restoreRng, type Rng } from './rng';
import type { BlackjackHand, LastBet, WorldState } from './types';

/**
 * The Casino and the phone's slots (GDD §12). Pure functions over WorldState.
 *
 * Unlike the weather or the markets, these ARE real dice rolls from the
 * saved RNG: they are the player's own gamble, like saying hello to a
 * stranger, and a saved roll means reloading the page cannot undo a loss.
 */

export type RouletteBet = 'red' | 'black' | 'odd' | 'even' | number;

function busy(state: WorldState): boolean {
  return state.deceased || state.pendingEvent !== null;
}

/** Why this bet cannot be placed here and now, or null. */
export function betBlocker(
  state: WorldState,
  game: keyof typeof TABLE_LIMITS,
  bet: number,
  venue: Venue = 'casino',
): string | null {
  if (busy(state)) return 'Not now';
  if (venue === 'casino') {
    if (state.character.location !== 'casino') return 'Only at the Casino';
    const closed = closedReason('casino', state.minuteOfDay);
    if (closed) return closed;
  }
  const limits = TABLE_LIMITS[game];
  if (!Number.isFinite(bet) || bet < limits.min) return `Minimum bet $${limits.min}`;
  if (bet > limits.max) return `Maximum bet $${limits.max}`;
  // Nobody takes a bet on money you do not have.
  if (bet > state.character.stats.money) return 'Cannot afford';
  const minutes = game === 'slot' ? PLAY_MINUTES.slot : game === 'roulette' ? PLAY_MINUTES.roulette : PLAY_MINUTES.blackjackDeal;
  if (state.minuteOfDay + minutes > freeUntil(state)) return 'Not enough time';
  if (game === 'blackjack' && state.blackjack) return 'Finish this hand first';
  return null;
}

/** Takes the time, the stake and the winnings, and remembers how it went. */
function settle(state: WorldState, rng: Rng, minutes: number, bet: number, won: number, last: LastBet): WorldState {
  const played = passTime(state, minutes);
  return {
    ...played,
    rng: rng.snapshot(),
    lastBet: last,
    character: {
      ...played.character,
      stats: { ...played.character.stats, money: played.character.stats.money - bet + won },
    },
  };
}

// --- slots -------------------------------------------------------------------

/** Paid back per dollar on average. The house edge is 1 minus this. */
export function slotReturn(venue: Venue): number {
  return SLOT_TABLES[venue].reduce((sum, line) => sum + line.chance * line.pays, 0);
}

export function spinSlot(state: WorldState, bet: number, venue: Venue): WorldState {
  if (betBlocker(state, 'slot', bet, venue) !== null) return state;
  const rng = restoreRng(state.rng);
  let roll = rng.next();
  const line = SLOT_TABLES[venue].find((l) => (roll -= l.chance) < 0);
  const reels = line ? [...line.reels] : blanks(rng);
  const won = line ? bet * line.pays : 0;
  return settle(state, rng, PLAY_MINUTES.slot, bet, won, {
    game: 'slot',
    venue,
    bet,
    won,
    detail: reels.join(' '),
  });
}

/** Three symbols that never make a winning line. */
function blanks(rng: Rng): string[] {
  const first = rng.pick(SLOT_BLANKS);
  const second = rng.pick(SLOT_BLANKS.filter((s) => s !== first));
  return [first, second, rng.pick(SLOT_BLANKS)];
}

// --- roulette ------------------------------------------------------------------

export function rouletteWins(bet: RouletteBet, pocket: number): number {
  if (typeof bet === 'number') return bet === pocket ? 36 : 0;
  if (pocket === 0) return 0;
  const red = RED_NUMBERS.includes(pocket);
  if (bet === 'red') return red ? 2 : 0;
  if (bet === 'black') return red ? 0 : 2;
  if (bet === 'odd') return pocket % 2 === 1 ? 2 : 0;
  return pocket % 2 === 0 ? 2 : 0;
}

export function spinRoulette(state: WorldState, bet: number, on: RouletteBet): WorldState {
  if (betBlocker(state, 'roulette', bet) !== null) return state;
  if (typeof on === 'number' && !(Number.isInteger(on) && on >= 0 && on <= 36)) return state;
  const rng = restoreRng(state.rng);
  const pocket = rng.int(0, 36);
  const won = bet * rouletteWins(on, pocket);
  const colour = pocket === 0 ? 'green' : RED_NUMBERS.includes(pocket) ? 'red' : 'black';
  return settle(state, rng, PLAY_MINUTES.roulette, bet, won, {
    game: 'roulette',
    venue: 'casino',
    bet,
    won,
    detail: `${pocket} ${colour}`,
  });
}

// --- blackjack -----------------------------------------------------------------

/** One card from an endless shoe: 1 is an ace, 11-13 are the faces. */
function draw(rng: Rng): number {
  return rng.int(1, 13);
}

/** Best total for a hand: aces count 11 while that does not bust it. */
export function handValue(cards: readonly number[]): number {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    total += card === 1 ? 1 : Math.min(10, card);
    if (card === 1) aces += 1;
  }
  return aces > 0 && total + 10 <= 21 ? total + 10 : total;
}

function isBlackjack(cards: readonly number[]): boolean {
  return cards.length === 2 && handValue(cards) === 21;
}

export function cardName(card: number): string {
  return card === 1 ? 'A' : card === 11 ? 'J' : card === 12 ? 'Q' : card === 13 ? 'K' : String(card);
}

/** Dealer draws to 17 and stands on it. Then whoever is nearer 21 wins. */
function finish(state: WorldState, rng: Rng, hand: BlackjackHand, minutes: number): WorldState {
  const dealer = [...hand.dealer];
  const player = hand.player;
  const playerTotal = handValue(player);
  if (playerTotal <= 21 && !isBlackjack(player)) {
    while (handValue(dealer) < 17) dealer.push(draw(rng));
  }
  const dealerTotal = handValue(dealer);

  let pays: number;
  if (playerTotal > 21) pays = 0;
  else if (isBlackjack(player)) pays = isBlackjack(dealer) ? 1 : 2.5;
  else if (isBlackjack(dealer)) pays = 0;
  else if (dealerTotal > 21 || playerTotal > dealerTotal) pays = 2;
  else if (playerTotal === dealerTotal) pays = 1;
  else pays = 0;

  const won = Math.floor(hand.bet * pays);
  // The stake was taken at the deal, so nothing more comes off now.
  return {
    ...settle(state, rng, minutes, 0, won, {
      game: 'blackjack',
      venue: 'casino',
      bet: hand.bet,
      won,
      detail: `You ${playerTotal} · dealer ${dealerTotal}`,
    }),
    blackjack: null,
  };
}

export function dealBlackjack(state: WorldState, bet: number): WorldState {
  if (betBlocker(state, 'blackjack', bet) !== null) return state;
  const rng = restoreRng(state.rng);
  const hand: BlackjackHand = { bet, player: [draw(rng), draw(rng)], dealer: [draw(rng), draw(rng)] };
  const staked: WorldState = {
    ...state,
    character: { ...state.character, stats: { ...state.character.stats, money: state.character.stats.money - bet } },
  };
  // A natural on either side settles at once.
  if (isBlackjack(hand.player) || isBlackjack(hand.dealer)) return finish(staked, rng, hand, PLAY_MINUTES.blackjackDeal);
  return { ...passTime(staked, PLAY_MINUTES.blackjackDeal), rng: rng.snapshot(), blackjack: hand, lastBet: null };
}

export function hitBlackjack(state: WorldState): WorldState {
  const hand = state.blackjack;
  if (!hand || busy(state)) return state;
  const rng = restoreRng(state.rng);
  const next = { ...hand, player: [...hand.player, draw(rng)] };
  if (handValue(next.player) > 21) return finish(state, rng, next, PLAY_MINUTES.blackjackMove);
  return { ...passTime(state, PLAY_MINUTES.blackjackMove), rng: rng.snapshot(), blackjack: next };
}

export function standBlackjack(state: WorldState): WorldState {
  const hand = state.blackjack;
  if (!hand || busy(state)) return state;
  return finish(state, restoreRng(state.rng), hand, PLAY_MINUTES.blackjackMove);
}
