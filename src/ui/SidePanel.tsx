import { useState } from 'react';

import type { WorldState } from '../core/types';
import { EventLog } from './EventLog';
import { LocationMenu } from './LocationMenu';
import { People } from './People';

/**
 * Everything the player can look at or do, in three tabs beside the map.
 * Which tab is open is view state only; nothing about it is saved.
 */
type Tab = 'here' | 'people' | 'log';

export function SidePanel({ world, locked }: { world: WorldState; locked: boolean }): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('here');
  const tabs: { id: Tab; label: string }[] = [
    { id: 'here', label: 'Here' },
    { id: 'people', label: `People \u00b7 ${world.people.length}` },
    { id: 'log', label: 'Log' },
  ];

  return (
    <aside className={`side panel ${locked ? 'side--locked' : ''}`} inert={locked}>
      <nav className="side__tabs" role="tablist" aria-label="Panels">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`side__tab ${tab === id ? 'side__tab--on' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="side__body" role="tabpanel">
        {tab === 'here' && <LocationMenu world={world} />}
        {tab === 'people' && <People world={world} />}
        {tab === 'log' && <EventLog entries={world.eventLog} />}
      </div>
    </aside>
  );
}
