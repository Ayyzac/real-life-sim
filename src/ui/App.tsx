import { CharacterCreation } from './CharacterCreation';
import { Dashboard } from './Dashboard';
import { EventDialog } from './EventDialog';
import { EventLog } from './EventLog';
import { GameCanvas } from './GameCanvas';
import { LifeSummary } from './LifeSummary';
import { LocationMenu } from './LocationMenu';
import { TimeControls } from './TimeControls';
import { gameStore, useGame } from './useGame';

export function App(): React.JSX.Element {
  const world = useGame();

  if (world === null) {
    return (
      <main className="app">
        <h1 className="app__title">Real Life Sim</h1>
        <CharacterCreation />
      </main>
    );
  }

  if (world.deceased) {
    return (
      <main className="app">
        <h1 className="app__title">Real Life Sim</h1>
        <LifeSummary world={world} />
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


      <button
        type="button"
        className="btn btn--quiet"
        onClick={() => {
          if (confirm('Delete this character and start over? This cannot be undone.')) {
            gameStore.dispatch({ type: 'reset' });
          }
        }}
      >
        Abandon this life
      </button>

      <footer className="app__footer">
        Phase 2 &mdash; a town you can walk around.
      </footer>
    </main>
  );
}
