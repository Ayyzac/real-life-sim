import { useEffect, useRef, useState } from 'react';

import { ChangeReport } from './ChangeReport';
import { changesBetween, type ChangeReport as Report } from './changes';
import { CharacterCreation } from './CharacterCreation';
import { DayControls } from './DayControls';
import { EventDialog } from './EventDialog';
import { GameCanvas } from './GameCanvas';
import { Hud } from './Hud';
import { LifeSummary } from './LifeSummary';
import { Settings } from './Settings';
import { SidePanel } from './SidePanel';
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

/** The last Advance's before-and-after, kept until the next one (GDD §11.7). */
function useChangeReport(world: WorldState | null): Report | null {
  const previous = useRef<WorldState | null>(world);
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    const before = previous.current;
    previous.current = world;
    const next = changesBetween(before, world);
    if (next) setReport(next);
    else if (!world || before?.character.id !== world.character.id) setReport(null);
  }, [world]);

  return report;
}

export function App(): React.JSX.Element {
  const world = useGame();
  useSound(world);
  const report = useChangeReport(world);

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
    <main className="app app--play">
      <h1 className="sr-only">Real Life Sim</h1>

      <Hud world={world} />

      <div className="play">
        <div className="play__main">
          <section className="panel world">
            <GameCanvas />
            <p className="panel__hint">Click a building to walk there. The Here tab shows what you can do inside.</p>
          </section>

          {waiting ? <EventDialog pending={world.pendingEvent!} /> : <DayControls world={world} />}
          {report && <ChangeReport report={report} />}
        </div>

        <SidePanel world={world} locked={waiting} />
      </div>

      <Settings />
      <footer className="app__footer">A life, one day at a time.</footer>
    </main>
  );
}
