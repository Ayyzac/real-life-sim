import { useState } from 'react';

import {
  bankBlocker,
  buyBlocker,
  changeToday,
  feeRate,
  holdingValue,
  netWorth,
  portfolioValue,
  type BankMove,
} from '../../core/finance';
import type { WorldState } from '../../core/types';
import { BALANCE } from '../../data/balance';
import { ASSETS, type AssetDefinition } from '../../data/markets';
import { money } from '../format';
import { gameStore } from '../useGame';

/** The bank and the two markets on the phone and laptop (GDD §12). */

const B = BALANCE.bank;

function price(value: number): string {
  if (value >= 100) return money(value);
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(4)}`;
}

function percent(fraction: number): string {
  const value = Math.round(fraction * 1000) / 10;
  return `${value > 0 ? '+' : ''}${value}%`;
}

function AmountInput({ value, onChange }: { value: number; onChange: (next: number) => void }): React.JSX.Element {
  return (
    <label className="amount">
      Amount $
      <input
        type="number"
        min={0}
        step={10}
        value={Number.isFinite(value) ? value : ''}
        onChange={(event) => onChange(Math.floor(Number(event.target.value)))}
      />
    </label>
  );
}

/** The last month of closes and today, as a small line. */
function Sparkline({ values }: { values: readonly number[] }): React.JSX.Element | null {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 60},${18 - ((v - min) / span) * 16}`).join(' ');
  const up = values[values.length - 1]! >= values[0]!;
  return (
    <svg className="spark" viewBox="0 0 60 20" aria-hidden="true">
      <polyline points={points} fill="none" stroke={up ? 'var(--good)' : 'var(--bad)'} strokeWidth="1.5" />
    </svg>
  );
}

function Market({ world, kind }: { world: WorldState; kind: AssetDefinition['kind'] }): React.JSX.Element {
  const [amount, setAmount] = useState(100);
  const assets = ASSETS.filter((asset) => asset.kind === kind);

  return (
    <>
      <p className="panel__hint">
        {kind === 'stock'
          ? 'Prices move once a trading day. Over years they tend to creep up.'
          : 'Prices move every hour, both ways, hard. On average they go nowhere.'}{' '}
        Fee {Math.round(feeRate(assets[0]!) * 1000) / 10}% each way. Cash {money(world.character.stats.money)}.
      </p>
      <AmountInput value={amount} onChange={setAmount} />
      <div className="device__list">
        {assets.map((asset) => {
          const now = world.market.prices[asset.id] ?? asset.startPrice;
          const change = changeToday(world.market, asset.id);
          const held = world.portfolio[asset.id];
          const value = holdingValue(world, asset.id);
          const why = buyBlocker(world, asset.id, amount);
          return (
            <div key={asset.id} className="asset">
              <div className="asset__head">
                <strong>{asset.name}</strong> <span className="badge">{asset.ticker}</span>
                <span className="asset__price">{price(now)}</span>
                <span className={change >= 0 ? 'eff eff--up' : 'eff eff--down'}>{percent(change)}</span>
              </div>
              <div className="asset__body">
                <Sparkline values={[...(world.market.history[asset.id] ?? []), now]} />
                <span className="choice__text">{asset.blurb}</span>
              </div>
              {held && (
                <p className="asset__held">
                  Yours: {money(value)}{' '}
                  <span className={value >= held.cost ? 'eff eff--up' : 'eff eff--down'}>
                    {value >= held.cost ? '+' : ''}
                    {money(value - held.cost)}
                  </span>
                </p>
              )}
              <div className="person__actions">
                <button
                  type="button"
                  className="btn btn--small"
                  disabled={why !== null}
                  title={why ?? undefined}
                  onClick={() => gameStore.dispatch({ type: 'buyAsset', assetId: asset.id, dollars: amount })}
                >
                  Buy {money(amount)}
                </button>
                {held && (
                  <>
                    <button
                      type="button"
                      className="btn btn--small"
                      onClick={() => gameStore.dispatch({ type: 'sellAsset', assetId: asset.id, share: 0.5 })}
                    >
                      Sell half
                    </button>
                    <button
                      type="button"
                      className="btn btn--small"
                      onClick={() => gameStore.dispatch({ type: 'sellAsset', assetId: asset.id, share: 1 })}
                    >
                      Sell all
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function Stocks({ world }: { world: WorldState }): React.JSX.Element {
  return <Market world={world} kind="stock" />;
}

export function Crypto({ world }: { world: WorldState }): React.JSX.Element {
  return <Market world={world} kind="crypto" />;
}

const MOVES: { move: BankMove; label: string }[] = [
  { move: 'deposit', label: 'Save' },
  { move: 'withdraw', label: 'Take out' },
  { move: 'borrow', label: 'Borrow' },
  { move: 'repay', label: 'Repay' },
];

export function Bank({ world }: { world: WorldState }): React.JSX.Element {
  const [amount, setAmount] = useState(100);
  const { savings, loan } = world.bank;

  return (
    <>
      <ul className="news">
        <li className="news__item">
          Cash <strong>{money(world.character.stats.money)}</strong> &middot; Savings <strong>{money(savings)}</strong>
        </li>
        <li className="news__item">
          Investments <strong>{money(portfolioValue(world))}</strong> &middot; Loan{' '}
          <strong className={loan > 0 ? 'hud__money--debt' : ''}>{money(loan)}</strong>
        </li>
        <li className="news__item">
          Worth <strong>{money(netWorth(world))}</strong>
        </li>
      </ul>
      <p className="panel__hint">
        Savings earn {B.savingsRate * 100}% a year. The bank lends up to {money(B.maxLoan)} at {B.loanRate * 100}% a
        year, paid back by itself every day: at least {money(B.minPayment)} or {B.paymentShare * 100}% of what is owed.
      </p>
      <AmountInput value={amount} onChange={setAmount} />
      <div className="person__actions">
        {MOVES.map(({ move, label }) => {
          const why = bankBlocker(world, move, amount);
          return (
            <button
              key={move}
              type="button"
              className="btn btn--small"
              disabled={why !== null}
              title={why ?? undefined}
              onClick={() => gameStore.dispatch({ type: 'bank', move, amount })}
            >
              {label}
            </button>
          );
        })}
      </div>
    </>
  );
}
