import { buyBlocker, consumeBlocker, dealOf, priceOf } from '../core/bag';
import type { WorldState } from '../core/types';
import { BALANCE } from '../data/balance';
import { ITEMS, type ItemDefinition } from '../data/items';
import { duration, money, signed } from './format';
import { runTimed, useProgress } from './progress';
import { gameStore } from './useGame';

/** What an item does, as the little tags every action shows. */
function Effects({ item, spent }: { item: ItemDefinition; spent: boolean }): React.JSX.Element {
  const needs = Object.entries(item.needs ?? {}) as [string, number][];
  const treat = Object.entries(item.effects ?? {}) as [string, number][];
  return (
    <span className="choice__effects">
      {needs.map(([key, value]) => (
        <span key={key} className="eff eff--up">
          {key} {signed(value)}
        </span>
      ))}
      {treat.map(([key, value]) => (
        <span key={key} className={`eff ${value >= 0 ? 'eff--up' : 'eff--down'} ${spent ? 'eff--spent' : ''}`}>
          {key} {signed(value)}
        </span>
      ))}
      {item.tool && <span className="eff eff--up">keeps the rain off</span>}
    </span>
  );
}

/** The Supermarket's shelves, in the Here tab (GDD §12). */
export function Shop({ world }: { world: WorldState }): React.JSX.Element {
  const busy = useProgress() !== null;
  const bag = world.character.inventory.length;

  return (
    <>
      <h3 className="panel__subtitle">
        Shelves <span className="panel__count">bag {bag}/{BALANCE.bag.slots}</span>
      </h3>
      <div className="jobs">
        {ITEMS.map((item) => {
          const deal = dealOf(item, world.clockDay);
          const blocker = buyBlocker(world, item);
          return (
            <div key={item.id} className="job">
              <div>
                <strong>{item.label}</strong>{' '}
                <span className="job__pay">
                  {deal > 0 && <s className="price__was">{money(item.price)}</s>} {money(priceOf(item, world.clockDay))}
                </span>
                {deal > 0 && <span className="badge">{money(deal)} off</span>}
                <p className="choice__text">{item.description}</p>
                <Effects item={item} spent={false} />
              </div>
              <button
                type="button"
                className="btn"
                disabled={busy || blocker !== null}
                title={blocker ?? undefined}
                onClick={() => gameStore.dispatch({ type: 'buyItem', itemId: item.id })}
              >
                {blocker === 'Already have one' ? 'Have one' : blocker === 'Bag is full' ? 'Bag full' : 'Buy'}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** What the character is carrying, usable anywhere. */
export function Bag({ world }: { world: WorldState }): React.JSX.Element {
  const busy = useProgress() !== null;
  const counts = new Map<string, number>();
  for (const id of world.character.inventory) counts.set(id, (counts.get(id) ?? 0) + 1);
  const carried = ITEMS.filter((item) => counts.has(item.id));

  return (
    <section>
      <p className="panel__hint">
        {world.character.inventory.length}/{BALANCE.bag.slots} slots. Eat and drink from here anywhere; the
        Supermarket sells more.
      </p>
      {carried.length === 0 && <p className="panel__hint">The bag is empty.</p>}
      <div className="actions__list">
        {carried.map((item) => {
          const blocker = consumeBlocker(world, item);
          const spent = world.doneToday.includes(`item:${item.id}`);
          return (
            <button
              key={item.id}
              type="button"
              className="action"
              disabled={busy || blocker !== null}
              onClick={() => runTimed(item.label, item.minutes, { type: 'useItem', itemId: item.id })}
              title={item.description}
            >
              <span className="action__head">
                <strong>
                  {item.label} &times;{counts.get(item.id)}
                </strong>
                {!item.tool && <span className="action__time">{duration(item.minutes)}</span>}
              </span>
              <Effects item={item} spent={spent} />
              {blocker && !item.tool && <span className="action__why">{blocker}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
