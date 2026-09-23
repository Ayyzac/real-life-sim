import { describe, expect, it } from 'vitest';

import { createWorld } from '../../src/core/character';
import { advanceDay } from '../../src/core/clock';
import {
  advanceMarket,
  bankBlocker,
  bankMove,
  bankOneDay,
  buyAsset,
  buyBlocker,
  hourOf,
  netWorth,
  nextPrice,
  normalFrom,
  sellAsset,
} from '../../src/core/finance';
import type { WorldState } from '../../src/core/types';
import { BALANCE } from '../../src/data/balance';
import { ASSETS, findAsset } from '../../src/data/markets';

const B = BALANCE.bank;

function world(state: Partial<WorldState> = {}): WorldState {
  const base = createWorld({ name: 'Trader', backgroundId: 'scholarship', seed: 23 });
  return { ...base, ...state, character: { ...base.character, stats: { ...base.character.stats, money: 1000 } } };
}

/** The same world, some hours later, with the market caught up. */
function later(state: WorldState, hours: number): WorldState {
  const minute = state.minuteOfDay + hours * 60;
  return advanceMarket({ ...state, clockDay: state.clockDay + Math.floor(minute / 1440), minuteOfDay: minute % 1440 });
}

describe('the markets (GDD §12)', () => {
  it('draws its chance from a proper bell curve', () => {
    let sum = 0;
    let squares = 0;
    const n = 20_000;
    for (let i = 0; i < n; i += 1) {
      const z = normalFrom(`test:${i}`);
      sum += z;
      squares += z * z;
    }
    expect(Math.abs(sum / n)).toBeLessThan(0.03);
    expect(Math.sqrt(squares / n)).toBeGreaterThan(0.97);
    expect(Math.sqrt(squares / n)).toBeLessThan(1.03);
  });

  it('moves crypto every hour and stocks only at midnight into a weekday', () => {
    const start = world({ minuteOfDay: 10 * 60 });
    const hourLater = later(start, 1);
    expect(hourLater.market.prices.bcrn).not.toBe(start.market.prices.bcrn);
    expect(hourLater.market.prices.hrbr).toBe(start.market.prices.hrbr);

    // Day 0 is a Monday: the move into Tuesday changes stocks; into Saturday (day 5) it does not.
    const tuesday = later(start, 24);
    expect(tuesday.market.prices.hrbr).not.toBe(start.market.prices.hrbr);
    const friday = advanceMarket({ ...start, clockDay: 4, minuteOfDay: 23 * 60 });
    const saturday = advanceMarket({ ...friday, clockDay: 5, minuteOfDay: 10 * 60 });
    expect(saturday.market.prices.hrbr).toBe(friday.market.prices.hrbr);
  });

  it('comes out the same every time, and leaves the RNG alone', () => {
    const start = world();
    const a = later(start, 50);
    const b = later(start, 50);
    expect(a.market).toEqual(b.market);
    expect(a.rng).toEqual(start.rng);
    expect(advanceMarket(start)).toBe(start);
  });

  it('keeps a month of closing prices for the charts', () => {
    const month = later(world(), 24 * 45);
    for (const asset of ASSETS) expect(month.market.history[asset.id]!.length).toBe(B.historyDays);
    expect(month.market.hour).toBe(hourOf(month));
  });

  it('gives crypto no drift: over a long time it goes nowhere on average', () => {
    const coin = findAsset('rkt');
    let logSum = 0;
    const hours = 20_000;
    let price = coin.startPrice;
    for (let h = 0; h < hours; h += 1) {
      const next = nextPrice(price, coin, `drift:${h}`);
      logSum += Math.log(next / price);
      price = next;
    }
    const perHour = logSum / hours;
    // Expected -sigma^2/2 per hour, within a few standard errors.
    expect(Math.abs(perHour + (coin.volatility ** 2) / 2)).toBeLessThan((4 * coin.volatility) / Math.sqrt(hours));
  });

  it('buys with a fee, never with money you do not have, and sells back with a fee', () => {
    const start = world();
    expect(buyBlocker(start, 'hrbr', 5)).toBe(`At least $${B.minTrade}`);
    expect(buyBlocker(start, 'hrbr', 5000)).toBe('Cannot afford');

    const bought = buyAsset(start, 'hrbr', 100);
    expect(bought.character.stats.money).toBe(900);
    expect(bought.portfolio.hrbr!.cost).toBe(100);

    const sold = sellAsset(bought, 'hrbr', 1);
    expect(sold.portfolio.hrbr).toBeUndefined();
    // Same price both ways: the fees are the whole loss.
    expect(sold.character.stats.money).toBeLessThan(1000);
    expect(sold.character.stats.money).toBeGreaterThan(985);
  });
});

describe('the bank (GDD §12)', () => {
  it('moves money between cash and savings, within what there is', () => {
    const start = world();
    expect(bankBlocker(start, 'deposit', 2000)).toBe('Not that much cash');
    const saved = bankMove(start, 'deposit', 400);
    expect(saved.bank.savings).toBe(400);
    expect(saved.character.stats.money).toBe(600);
    expect(bankBlocker(saved, 'withdraw', 500)).toBe('Not that much saved');
    expect(netWorth(saved)).toBe(netWorth(start));
  });

  it('lends up to its limit and pays itself back a little every day', () => {
    const start = world();
    expect(bankBlocker(start, 'borrow', B.maxLoan + 1)).toMatch(/lends up to/);

    const borrowed = bankMove(start, 'borrow', 1000);
    expect(borrowed.character.stats.money).toBe(2000);
    expect(netWorth(borrowed)).toBe(netWorth(start));

    const day = bankOneDay(borrowed.bank);
    expect(day.payment).toBeGreaterThanOrEqual(B.minPayment);
    expect(day.bank.loan).toBeLessThan(1000);

    let bank = borrowed.bank;
    let paid = 0;
    for (let i = 0; i < 2000 && bank.loan > 0; i += 1) {
      const next = bankOneDay(bank);
      paid += next.payment;
      bank = next.bank;
    }
    expect(bank.loan).toBe(0);
    // Interest makes a loan cost more than it gave.
    expect(paid).toBeGreaterThan(1000);
  });

  it('pays interest on savings and takes the loan payment from cash at bedtime', () => {
    const start = { ...world(), bank: { savings: 10_000, loan: 500 } };
    const next = advanceDay({ ...start, character: { ...start.character, focusId: 'rest' } });
    expect(next.bank.savings).toBeGreaterThan(10_000);
    expect(next.bank.loan).toBeLessThan(500);

    const noLoan = advanceDay({ ...start, bank: { savings: 10_000, loan: 0 }, character: { ...start.character, focusId: 'rest' } });
    expect(noLoan.character.stats.money).toBeGreaterThan(next.character.stats.money);
  });
});
