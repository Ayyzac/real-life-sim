import { useEffect, useRef } from 'react';

import { CharacterCreation } from './CharacterCreation';
import { Dashboard } from './Dashboard';
import { EventDialog } from './EventDialog';
import { EventLog } from './EventLog';
import { GameCanvas } from './GameCanvas';
import { LifeSummary } from './LifeSummary';
import { LocationMenu } from './LocationMenu';
import { Settings } from './Settings';
import { TimeControls } from './TimeControls';
import { play, preload, soundFor } from './sound';
import { useGame } from './useGame';
import type { WorldState } from '../core/types';

/**
 * Makes the noise for whatever just happened.
 *
 * One place, working from the state itself, so a new kind of event makes a
 * sound without anybody having to remember to add a line for it.
 */
function useSound(world: WorldState | null): void {
  const previous = useRef<WorldState | null>(null);

  useEffect(() => {
    preload();
  }, []);

  useEffect(() => {
    const name = soundFor(previous.current, world);
    previous.current = world;
    if (name) play(name);
  }, [world]);
}

export function App(): React.JSX.Element {
  const world = useGame();
  useSound(world);

  if (world === null) {
    return (
      <main className="app">
        <h1 className="app__title">Real Life Sim</h1>
        <CharacterCreation />
        <Settings />
      </main>
    );
  }

  if (world.deceased) {
    return (
      <main className="app">
        <h1 className="app__title">Real Life Sim</h1>
        <LifeSummary world={world} />
        <Settings />
      </main>
    );
  }

  // A waiting event freezes the week: no time controls, no changing your focus
  // and no job hunting until it is answered.
  const waiting = world.pendingEvent !== null;

  return (
    <main className="app">
      <h1 className="app__title">Real Life Sim</h1>

      <Dashboard character={world.character} clockDay={world.clockDay} people={world.people} />

      <section className="panel world">
        <GameCanvas />
        <p className="panel__hint">Click a building to walk there. Doors open the menu below.</p>
      </section>

      {waiting ? (
        <EventDialog pending={world.pendingEvent!} />
      ) : (
        <>
          <TimeControls />
          <LocationMenu world={world} />
        </>
      )}

      <EventLog entries={world.eventLog} />

      <Settings />

      <footer className="app__footer">A life, one week at a time.</footer>
    </main>
  );
}
