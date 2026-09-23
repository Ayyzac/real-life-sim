import { dealOf, priceOf } from '../../core/bag';
import { lookOf } from '../../core/look';
import { forecastLine, headlinesFor } from '../../core/news';
import { deliverable, deliveryPrice, fareTo, orderBlocker, taxiBlocker } from '../../core/phone';
import { OUTINGS, firstName, inviteBlocker, inviteMinutes, talkBlocker, type Outing } from '../../core/talk';
import type { WorldState } from '../../core/types';
import { BALANCE } from '../../data/balance';
import { ITEMS } from '../../data/items';
import { LOCATIONS } from '../../data/locations';
import { duration, money } from '../format';
import { Portrait } from '../Portrait';
import { runTimed, useProgress } from '../progress';
import { openTalk } from '../talk';
import { gameStore } from '../useGame';
import { closeDevice } from './device';

/**
 * The apps (GDD §12), as a list: adding an app = adding an entry here. `on`
 * says which device shows it; the laptop gets everything the phone has.
 */
export interface DeviceApp {
  id: string;
  label: string;
  icon: string;
  on: 'phone' | 'laptop' | 'both';
  Component: (props: { world: WorldState }) => React.JSX.Element;
}

const OUTING_BUTTON: Record<Outing, string> = { dinner: 'Dinner', film: 'Film', home: 'Come over' };

function Contacts({ world }: { world: WorldState }): React.JSX.Element {
  const busy = useProgress() !== null;
  if (world.people.length === 0) return <p className="panel__hint">No numbers saved.</p>;

  return (
    <div className="device__list">
      {world.people.map((person) => {
        const name = firstName(person);
        const callBlocker = talkBlocker(world, person, true);
        return (
          <div key={person.id} className="contact">
            <Portrait look={lookOf(person)} scale={2} className="person__face" />
            <div className="contact__main">
              <strong>{person.name}</strong>
              <span className="person__closeness">closeness {Math.round(person.closeness)}</span>
              <div className="person__actions">
                <button
                  type="button"
                  className="btn btn--small"
                  disabled={busy || callBlocker !== null}
                  title={callBlocker ?? `Call ${name}`}
                  onClick={() => {
                    closeDevice();
                    openTalk(person.id, true);
                  }}
                >
                  Call
                </button>
                {(Object.keys(OUTINGS) as Outing[]).map((outing) => {
                  const why = inviteBlocker(world, person, outing);
                  const cost = OUTINGS[outing].cost;
                  return (
                    <button
                      key={outing}
                      type="button"
                      className="btn btn--small"
                      disabled={busy || why !== null}
                      title={why ?? `${OUTINGS[outing].label}${cost > 0 ? `, ${money(cost)} for two` : ''}`}
                      onClick={() =>
                        runTimed(`${OUTINGS[outing].label} with ${name}`, inviteMinutes(world, person), {
                          type: 'invite',
                          personId: person.id,
                          outing,
                        })
                      }
                    >
                      {OUTING_BUTTON[outing]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function News({ world }: { world: WorldState }): React.JSX.Element {
  return (
    <ul className="news">
      {headlinesFor(world).map((headline, index) => (
        <li key={index} className="news__item">
          <span className="badge">{headline.tag}</span> {headline.text}
        </li>
      ))}
    </ul>
  );
}

function Deals({ world }: { world: WorldState }): React.JSX.Element {
  const deals = ITEMS.filter((item) => dealOf(item, world.clockDay) > 0);
  return (
    <>
      <p className="panel__hint">At the Supermarket today (Eastside, 07:00&ndash;23:00).</p>
      {deals.length === 0 && <p className="panel__hint">Nothing on offer today.</p>}
      <ul className="news">
        {deals.map((item) => (
          <li key={item.id} className="news__item">
            <strong>{item.label}</strong> <s className="price__was">{money(item.price)}</s>{' '}
            {money(priceOf(item, world.clockDay))}
          </li>
        ))}
      </ul>
    </>
  );
}

function Weather({ world }: { world: WorldState }): React.JSX.Element {
  const id = world.character.id;
  return (
    <ul className="news">
      <li className="news__item">{forecastLine(id, world.clockDay, 'Today')}</li>
      <li className="news__item">{forecastLine(id, world.clockDay + 1, 'Tomorrow')}</li>
      <li className="news__item panel__hint">
        {world.character.inventory.includes('umbrella') ? 'Your umbrella is in the bag.' : 'No umbrella in the bag.'}
      </li>
    </ul>
  );
}

function Taxi({ world }: { world: WorldState }): React.JSX.Element {
  const busy = useProgress() !== null;
  const here = world.character.location;
  return (
    <>
      <p className="panel__hint">
        Door to door in {duration(BALANCE.phone.taxi.minutes)}, and dry.
      </p>
      <div className="device__list">
        {LOCATIONS.filter((place) => place.id !== here).map((place) => {
          const why = taxiBlocker(world, place.id);
          return (
            <button
              key={place.id}
              type="button"
              className="action"
              disabled={busy || why !== null}
              onClick={() => runTimed(`Taxi to the ${place.label}`, BALANCE.phone.taxi.minutes, { type: 'taxi', locationId: place.id })}
            >
              <span className="action__head">
                <strong>{place.label}</strong>
                <span className="action__time">{money(fareTo(here, place.id))}</span>
              </span>
              {why && <span className="action__why">{why}</span>}
            </button>
          );
        })}
      </div>
    </>
  );
}

function Delivery({ world }: { world: WorldState }): React.JSX.Element {
  const busy = useProgress() !== null;
  const { inventory, deliveries } = world.character;
  return (
    <>
      <p className="panel__hint">
        Brought to you in {duration(BALANCE.phone.delivery.minutes)}, wherever you are. Bag{' '}
        {inventory.length + deliveries.length}/{BALANCE.bag.slots}.
        {deliveries.length > 0 && ` ${deliveries.length} on the way.`}
      </p>
      <div className="device__list">
        {ITEMS.filter(deliverable).map((item) => {
          const why = orderBlocker(world, item);
          return (
            <button
              key={item.id}
              type="button"
              className="action"
              disabled={busy || why !== null}
              onClick={() => gameStore.dispatch({ type: 'orderFood', itemId: item.id })}
            >
              <span className="action__head">
                <strong>{item.label}</strong>
                <span className="action__time">{money(deliveryPrice(item))}</span>
              </span>
              {why && <span className="action__why">{why}</span>}
            </button>
          );
        })}
      </div>
    </>
  );
}

export const APPS: readonly DeviceApp[] = [
  { id: 'contacts', label: 'Contacts', icon: '☎', on: 'both', Component: Contacts },
  { id: 'news', label: 'News', icon: '☷', on: 'both', Component: News },
  { id: 'deals', label: 'Deals', icon: '%', on: 'both', Component: Deals },
  { id: 'weather', label: 'Weather', icon: '☂', on: 'both', Component: Weather },
  { id: 'taxi', label: 'Taxi', icon: '▣', on: 'phone', Component: Taxi },
  { id: 'delivery', label: 'Food', icon: '☕', on: 'both', Component: Delivery },
];
