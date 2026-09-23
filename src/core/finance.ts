import { BALANCE } from '../data/balance';
import { ASSETS, findAsset, type AssetDefinition } from '../data/markets';
import { isWeekend } from './day';
import { hashText } from './hash';
import { withLogEntry } from './log';
import type { Bank, Market, WorldState } from './types';

/**
 * The bank and the markets (GDD §12). Pure functions over WorldState.
 *
 * Prices move by numbers worked out from the life, the asset and the hour -
 * never from the saved RNG, so a market running in the background cannot
 * shift a single event, and every lifetime balance test stays exactly as it
 * was. The same life sees the same prices every time it is loaded.
 */

const B = BALANCE.bank;

function busy(state: WorldState): boolean {
  return state.deceased || state.pendingEvent !== null;
}

// --- markets -------------------------------------------------------------

/** Hours since the life began. Past midnight keeps counting, like the clock. */
export function hourOf(state: Pick<WorldState, 'clockDay' | 'minuteOfDay'>): number {
  return state.clockDay * 24 + Math.floor(state.minuteOfDay / 60);
}

/**
 * Stirs a hash so neighbouring keys land far apart (murmur3's finaliser).
 * FNV alone is fine for picking a face, but keys that differ only in the
 * hour came out measurably lopsided - enough to give crypto a trend it is
 * not supposed to have. Found by test, not by eye.
 */
function mix(value: number): number {
  let h = value;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** A standard normal number from a key (Box-Muller over two hashes). */
export function normalFrom(key: string): number {
  const u1 = (mix(hashText(`${key}:u`)) + 1) / 4_294_967_297;
  const u2 = mix(hashText(`${key}:v`)) / 4_294_967_296;
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export function nextPrice(price: number, asset: AssetDefinition, key: string): number {
  const { drift, volatility } = asset;
  const moved = price * Math.exp(drift - (volatility * volatility) / 2 + volatility * normalFrom(key));
  return Math.max(0.0001, Math.round(moved * 10_000) / 10_000);
}

export function startingMarket(state: Pick<WorldState, 'clockDay' | 'minuteOfDay'>): Market {
  const prices: Record<string, number> = {};
  const history: Record<string, number[]> = {};
  for (const asset of ASSETS) {
    prices[asset.id] = asset.startPrice;
    history[asset.id] = [asset.startPrice];
  }
  return { prices, history, hour: hourOf(state) };
}

/**
 * Brings prices up to the current hour: crypto every hour, stocks once at
 * each midnight into a weekday, and a closing price kept for every day.
 * Returns the same world when the hour has not changed, so it can run after
 * every change.
 */
export function advanceMarket(state: WorldState): WorldState {
  const target = hourOf(state);
  const market = state.market;
  if (target <= market.hour) return state;

  const prices = { ...market.prices };
  const history = { ...market.history };
  const id = state.character.id;

  for (let hour = market.hour + 1; hour <= target; hour += 1) {
    if (hour % 24 === 0) {
      const day = hour / 24;
      for (const asset of ASSETS) {
        history[asset.id] = [...(history[asset.id] ?? []), prices[asset.id]!].slice(-B.historyDays);
      }
      if (!isWeekend(day)) {
        for (const asset of ASSETS) {
          if (asset.kind === 'stock') prices[asset.id] = nextPrice(prices[asset.id]!, asset, `${id}:${asset.id}:d${day}`);
        }
      }
    }
    for (const asset of ASSETS) {
      if (asset.kind === 'crypto') prices[asset.id] = nextPrice(prices[asset.id]!, asset, `${id}:${asset.id}:h${hour}`);
    }
  }

  return { ...state, market: { prices, history, hour: target } };
}

/** Change since the last close, as a fraction: 0.04 is 4% up. */
export function changeToday(market: Market, assetId: string): number {
  const closes = market.history[assetId] ?? [];
  const last = closes[closes.length - 1];
  const now = market.prices[assetId];
  return last && now !== undefined ? now / last - 1 : 0;
}

export function feeRate(asset: AssetDefinition): number {
  return asset.kind === 'crypto' ? B.cryptoFee : B.stockFee;
}

export function holdingValue(state: WorldState, assetId: string): number {
  return (state.portfolio[assetId]?.units ?? 0) * (state.market.prices[assetId] ?? 0);
}

export function buyBlocker(state: WorldState, assetId: string, dollars: number): string | null {
  if (busy(state)) return 'Not now';
  if (!Number.isFinite(dollars) || dollars < B.minTrade) return `At least $${B.minTrade}`;
  // Like any purchase, not with money you do not have.
  if (dollars > state.character.stats.money) return 'Cannot afford';
  findAsset(assetId);
  return null;
}

export function buyAsset(state: WorldState, assetId: string, dollars: number): WorldState {
  if (buyBlocker(state, assetId, dollars) !== null) return state;
  const asset = findAsset(assetId);
  const units = (dollars * (1 - feeRate(asset))) / state.market.prices[asset.id]!;
  const held = state.portfolio[asset.id] ?? { units: 0, cost: 0 };
  return {
    ...state,
    portfolio: { ...state.portfolio, [asset.id]: { units: held.units + units, cost: held.cost + dollars } },
    character: {
      ...state.character,
      stats: { ...state.character.stats, money: state.character.stats.money - dollars },
    },
  };
}

/** Sells `share` of what is held (1 = everything), after the fee. */
export function sellAsset(state: WorldState, assetId: string, share: number): WorldState {
  const held = state.portfolio[assetId];
  if (busy(state) || !held || held.units <= 0 || !(share > 0 && share <= 1)) return state;
  const asset = findAsset(assetId);
  const units = held.units * share;
  const proceeds = Math.floor(units * state.market.prices[asset.id]! * (1 - feeRate(asset)));
  const rest = { units: held.units - units, cost: held.cost * (1 - share) };
  const portfolio = { ...state.portfolio };
  if (share === 1) delete portfolio[asset.id];
  else portfolio[asset.id] = rest;

  return {
    ...state,
    portfolio,
    character: {
      ...state.character,
      stats: { ...state.character.stats, money: state.character.stats.money + proceeds },
    },
  };
}

// --- bank ------------------------------------------------------------------

export function portfolioValue(state: WorldState): number {
  return Object.keys(state.portfolio).reduce((sum, id) => sum + holdingValue(state, id), 0);
}

/** Everything owned, less what is owed. What the Life Summary calls the peak. */
export function netWorth(state: WorldState): number {
  return Math.round(state.character.stats.money + state.bank.savings + portfolioValue(state) - state.bank.loan);
}

export type BankMove = 'deposit' | 'withdraw' | 'borrow' | 'repay';

export function bankBlocker(state: WorldState, move: BankMove, amount: number): string | null {
  if (busy(state)) return 'Not now';
  if (!Number.isFinite(amount) || amount <= 0) return 'Enter an amount';
  const { money } = state.character.stats;
  const { savings, loan } = state.bank;
  switch (move) {
    case 'deposit':
      return amount > money ? 'Not that much cash' : null;
    case 'withdraw':
      return amount > savings ? 'Not that much saved' : null;
    case 'borrow':
      return loan + amount > B.maxLoan ? `The bank lends up to $${B.maxLoan.toLocaleString('en-US')}` : null;
    case 'repay':
      return amount > loan ? 'You do not owe that much' : amount > money ? 'Not that much cash' : null;
  }
}

export function bankMove(state: WorldState, move: BankMove, amount: number): WorldState {
  if (bankBlocker(state, move, amount) !== null) return state;
  const sign = move === 'deposit' || move === 'repay' ? -1 : 1;
  const bank = { ...state.bank };
  if (move === 'deposit') bank.savings += amount;
  if (move === 'withdraw') bank.savings -= amount;
  if (move === 'borrow') bank.loan += amount;
  if (move === 'repay') bank.loan -= amount;

  const withMoney: WorldState = {
    ...state,
    bank,
    character: {
      ...state.character,
      stats: { ...state.character.stats, money: state.character.stats.money + sign * amount },
    },
  };
  return move === 'borrow'
    ? {
        ...withMoney,
        eventLog: withLogEntry(state.eventLog, {
          day: state.clockDay,
          tone: 'neutral',
          text: `Borrowed $${amount.toLocaleString('en-US')} from the bank. It is paid back a little every day.`,
        }),
      }
    : withMoney;
}

/**
 * A day at the bank: interest on savings, interest on the loan, and the
 * day's repayment taken from cash. The repayment is a bill like any other,
 * so it can put the character into debt.
 */
export function bankOneDay(bank: Bank): { bank: Bank; payment: number } {
  const savings = Math.round(bank.savings * (1 + B.savingsRate / 365) * 100) / 100;
  if (bank.loan <= 0) return { bank: { savings, loan: 0 }, payment: 0 };
  const owed = bank.loan * (1 + B.loanRate / 365);
  const payment = Math.min(Math.ceil(owed), Math.max(B.minPayment, Math.ceil(owed * B.paymentShare)));
  return { bank: { savings, loan: Math.max(0, Math.round((owed - payment) * 100) / 100) }, payment };
}
