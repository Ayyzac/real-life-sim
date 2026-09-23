import { useState } from 'react';

import { betBlocker, cardName, handValue, slotReturn, type RouletteBet } from '../core/gamble';
import type { LastBet, WorldState } from '../core/types';
import { TABLE_LIMITS, type Venue } from '../data/gambling';
import { useHoldClock } from './clock';
import { money } from './format';
import { gameStore } from './useGame';

/**
 * The Casino's tables, in the Here tab, and the same slot machine on the
 * phone (GDD §12). The clock waits while you play; every bet costs a minute
 * or two of game time instead.
 */

function Bet({ value, onChange }: { value: number; onChange: (next: number) => void }): React.JSX.Element {
  return (
    <label className="amount">
      Bet $
      <input
        type="number"
        min={1}
        value={Number.isFinite(value) ? value : ''}
        onChange={(event) => onChange(Math.floor(Number(event.target.value)))}
      />
    </label>
  );
}

function Outcome({ last }: { last: LastBet }): React.JSX.Element {
  const net = last.won - last.bet;
  return (
    <p className={`casino__result ${net > 0 ? 'casino__result--win' : net < 0 ? 'casino__result--lose' : ''}`}>
      <span className="casino__detail">{last.detail}</span>{' '}
      {net > 0 ? `Won ${money(net)}` : net < 0 ? `Lost ${money(-net)}` : 'Stake back'}
    </p>
  );
}

export function SlotMachine({ world, venue }: { world: WorldState; venue: Venue }): React.JSX.Element {
  const [bet, setBet] = useState<number>(TABLE_LIMITS.slot.min * 5);
  const why = betBlocker(world, 'slot', bet, venue);
  const last = world.lastBet?.game === 'slot' && world.lastBet.venue === venue ? world.lastBet : null;

  return (
    <div className="casino__game">
      <h4 className="casino__title">
        {venue === 'online' ? 'Online slots' : 'Slot machine'}{' '}
        <span className="panel__count">pays back {Math.round(slotReturn(venue) * 100)}% on average</span>
      </h4>
      <div className="casino__reels" aria-live="polite">
        {(last?.detail ?? '? ? ?').split(' ').map((symbol, index) => (
          <span key={index} className="casino__reel">
            {symbol}
          </span>
        ))}
      </div>
      {last && <Outcome last={last} />}
      <div className="person__actions">
        <Bet value={bet} onChange={setBet} />
        <button
          type="button"
          className="btn btn--primary btn--small"
          disabled={why !== null}
          title={why ?? undefined}
          onClick={() => gameStore.dispatch({ type: 'spinSlot', bet, venue })}
        >
          Spin
        </button>
        {why && <span className="action__why">{why}</span>}
      </div>
    </div>
  );
}

const OUTSIDE_BETS: { on: RouletteBet; label: string }[] = [
  { on: 'red', label: 'Red' },
  { on: 'black', label: 'Black' },
  { on: 'odd', label: 'Odd' },
  { on: 'even', label: 'Even' },
];

function Roulette({ world }: { world: WorldState }): React.JSX.Element {
  const [bet, setBet] = useState<number>(TABLE_LIMITS.roulette.min * 2);
  const [number, setNumber] = useState(17);
  const why = betBlocker(world, 'roulette', bet);
  const last = world.lastBet?.game === 'roulette' ? world.lastBet : null;
  const spin = (on: RouletteBet): void => gameStore.dispatch({ type: 'spinRoulette', bet, on });

  return (
    <div className="casino__game">
      <h4 className="casino__title">
        Roulette <span className="panel__count">one zero &middot; colours pay 1:1, a number 35:1</span>
      </h4>
      {last && <Outcome last={last} />}
      <div className="person__actions">
        <Bet value={bet} onChange={setBet} />
        {OUTSIDE_BETS.map(({ on, label }) => (
          <button key={label} type="button" className="btn btn--small" disabled={why !== null} title={why ?? undefined} onClick={() => spin(on)}>
            {label}
          </button>
        ))}
        <label className="amount">
          No.
          <input
            type="number"
            min={0}
            max={36}
            value={number}
            onChange={(event) => setNumber(Math.min(36, Math.max(0, Math.floor(Number(event.target.value)))))}
          />
        </label>
        <button type="button" className="btn btn--small" disabled={why !== null} title={why ?? undefined} onClick={() => spin(number)}>
          On {number}
        </button>
      </div>
      {why && <p className="action__why">{why}</p>}
    </div>
  );
}

function Blackjack({ world }: { world: WorldState }): React.JSX.Element {
  const [bet, setBet] = useState<number>(TABLE_LIMITS.blackjack.min * 2);
  const hand = world.blackjack;
  const why = betBlocker(world, 'blackjack', bet);
  const last = world.lastBet?.game === 'blackjack' ? world.lastBet : null;

  return (
    <div className="casino__game">
      <h4 className="casino__title">
        Blackjack <span className="panel__count">dealer stands on 17 &middot; blackjack pays 3:2</span>
      </h4>
      {hand ? (
        <>
          <p className="casino__hand">
            Dealer: <span className="casino__cards">{cardName(hand.dealer[0]!)} ?</span>
          </p>
          <p className="casino__hand">
            You: <span className="casino__cards">{hand.player.map(cardName).join(' ')}</span> ({handValue(hand.player)})
            &middot; bet {money(hand.bet)}
          </p>
          <div className="person__actions">
            <button type="button" className="btn btn--small btn--primary" onClick={() => gameStore.dispatch({ type: 'hitBlackjack' })}>
              Hit
            </button>
            <button type="button" className="btn btn--small" onClick={() => gameStore.dispatch({ type: 'standBlackjack' })}>
              Stand
            </button>
          </div>
        </>
      ) : (
        <>
          {last && <Outcome last={last} />}
          <div className="person__actions">
            <Bet value={bet} onChange={setBet} />
            <button
              type="button"
              className="btn btn--small btn--primary"
              disabled={why !== null}
              title={why ?? undefined}
              onClick={() => gameStore.dispatch({ type: 'dealBlackjack', bet })}
            >
              Deal
            </button>
            {why && <span className="action__why">{why}</span>}
          </div>
        </>
      )}
    </div>
  );
}

/** Everything at the Casino. The clock waits while you are at the tables. */
export function CasinoSection({ world }: { world: WorldState }): React.JSX.Element {
  useHoldClock('casino', true);
  return (
    <>
      <h3 className="panel__subtitle">Tables</h3>
      <p className="panel__hint">
        Cash {money(world.character.stats.money)}. Every game here pays back less than it takes, over time. Bet what you
        can lose.
      </p>
      <SlotMachine world={world} venue="casino" />
      <Roulette world={world} />
      <Blackjack world={world} />
    </>
  );
}

export function OnlineSlots({ world }: { world: WorldState }): React.JSX.Element {
  return (
    <>
      <p className="panel__hint">
        Open all night, anywhere. Pays back less than the Casino&rsquo;s machines. Cash {money(world.character.stats.money)}.
      </p>
      <SlotMachine world={world} venue="online" />
    </>
  );
}
