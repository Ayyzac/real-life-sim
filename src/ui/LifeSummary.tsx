import { buildLifeSummary } from '../core/summary';
import type { WorldState } from '../core/types';
import { money, weekNumber } from './format';
import { gameStore } from './useGame';

/**
 * The closing screen (GDD §6). Nothing here carries into the next character -
 * that is the design, not an omission.
 */
export function LifeSummary({ world }: { world: WorldState }): React.JSX.Element {
  const life = buildLifeSummary(world);

  return (
    <section className="panel summary">
      <p className="summary__label">A life ends</p>
      <h2 className="summary__name">{life.name}</h2>
      <p className="summary__cause">{life.cause}</p>

      <dl className="summary__facts">
        <div>
          <dt>Age</dt>
          <dd>{life.ageAtDeath}</dd>
        </div>
        <div>
          <dt>Weeks lived</dt>
          <dd>{life.weeksLived.toLocaleString('en-US')}</dd>
        </div>
        <div>
          <dt>Ended with</dt>
          <dd>{money(life.finalMoney)}</dd>
        </div>
        <div>
          <dt>Most ever held</dt>
          <dd>{money(life.peakMoney)}</dd>
        </div>
        <div>
          <dt>Last job</dt>
          <dd>{life.finalJob ?? 'None'}</dd>
        </div>
        <div>
          <dt>Started as</dt>
          <dd>{life.background}</dd>
        </div>
        <div>
          <dt>Family</dt>
          <dd>{life.household ?? 'None'}</dd>
        </div>
      </dl>

      {life.survivors.length > 0 && (
        <>
          <h3 className="panel__subtitle">Who was still there</h3>
          <p className="panel__hint">
            {life.survivors.map((person) => person.name).join(' · ')}
          </p>
        </>
      )}

      {life.memories.length > 0 && (
        <>
          <h3 className="panel__subtitle">Who they lost along the way</h3>
          <ul className="log__list">
            {life.memories.map((memory, index) => (
              <li key={`${memory.name}-${index}`} className="log__item">
                <span className="log__week">W{weekNumber(memory.day)}</span>
                <span>{memory.text}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="panel__subtitle">The moments that stuck</h3>
      <ul className="log__list summary__milestones">
        {life.milestones.map((entry, index) => (
          <li key={`${entry.day}-${index}`} className={`log__item log__item--${entry.tone}`}>
            <span className="log__week">W{weekNumber(entry.day)}</span>
            <span>{entry.text}</span>
          </li>
        ))}
      </ul>

      <p className="summary__epitaph">{life.epitaph}</p>

      <button
        type="button"
        className="btn btn--primary btn--wide"
        onClick={() => gameStore.dispatch({ type: 'reset' })}
      >
        Begin a new life
      </button>
      <p className="panel__hint summary__reset-note">
        Nothing carries over. The next character starts from nothing, on purpose.
      </p>
    </section>
  );
}
