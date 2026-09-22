import { CharacterCreation } from './CharacterCreation';
import { Dashboard } from './Dashboard';
import { EventLog } from './EventLog';
import { GameCanvas } from './GameCanvas';
import { LocationMenu } from './LocationMenu';
import { TimeControls } from './TimeControls';
import { gameStore, useGame } from './useGame';

export function App(): React.JSX.Element {
  const world = useGame();

  return (
    <main className="app">
      <h1 className="app__title">Real Life Sim</h1>

      {world === null ? (
        <CharacterCreation />
      ) : (
        <>
          <Dashboard character={world.character} clockDay={world.clockDay} />
          <TimeControls />
          <LocationMenu character={world.character} />
          <EventLog entries={world.eventLog} />

          <details className="panel world">
            <summary className="world__summary">World map (arrives in Phase 2)</summary>
            <GameCanvas />
          </details>

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
        </>
      )}

      <footer className="app__footer">
        Phase 1 Demo A &mdash; random life events, death and the Life Summary land in Demo B.
      </footer>
    </main>
  );
}
