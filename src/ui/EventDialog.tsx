import { findEvent } from '../core/events';
import type { PendingEvent } from '../core/types';
import { money, signed } from './format';
import { gameStore } from './useGame';

/**
 * Shown when a week stopped to ask the player something. Nothing else on the
 * screen is usable until it is answered - the week is literally paused.
 */
export function EventDialog({ pending }: { pending: PendingEvent }): React.JSX.Element {
  const event = findEvent(pending.eventId);
  const daysLeft = pending.daysRemaining;

  return (
    <section className="panel event" role="alertdialog" aria-labelledby="event-title">
      <h2 className="event__title" id="event-title">
        {event.title}
      </h2>
      <p className="event__text">{event.text}</p>

      <div className="choices">
        {event.choices?.map((choice) => (
          <button
            key={choice.id}
            type="button"
            className="choice"
            onClick={() => gameStore.dispatch({ type: 'chooseEventOption', choiceId: choice.id })}
          >
            <strong className="choice__title">{choice.label}</strong>
            <span className="choice__text">{choice.detail}</span>
            <span className="choice__effects">
              {choice.effect.money !== undefined && (
                <span className={choice.effect.money >= 0 ? 'eff eff--up' : 'eff eff--down'}>
                  {money(choice.effect.money)}
                </span>
              )}
              {(['health', 'energy', 'mood'] as const).map((key) => {
                const value = choice.effect[key];
                if (value === undefined) return null;
                return (
                  <span key={key} className={value >= 0 ? 'eff eff--up' : 'eff eff--down'}>
                    {key} {signed(value)}
                  </span>
                );
              })}
            </span>
          </button>
        ))}
      </div>

      {daysLeft > 0 && (
        <p className="event__resume">
          {daysLeft} {daysLeft === 1 ? 'day' : 'days'} of this week still to play once you decide.
        </p>
      )}
    </section>
  );
}
