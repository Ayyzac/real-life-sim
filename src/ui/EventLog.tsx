import type { EventLogEntry } from '../core/types';
import { weekNumber } from './format';

/** Recent history. Phase 1 Demo B fills this with random life events. */
export function EventLog({ entries }: { entries: EventLogEntry[] }): React.JSX.Element {
  return (
    <section className="log">
      <h2 className="panel__subtitle">Recent</h2>
      {entries.length === 0 ? (
        <p className="panel__hint">Nothing has happened yet.</p>
      ) : (
        <ul className="log__list">
          {entries.slice(0, 30).map((entry, index) => (
            <li key={`${entry.day}-${index}`} className={`log__item log__item--${entry.tone}`}>
              <span className="log__week">W{weekNumber(entry.day)}</span>
              <span>{entry.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
