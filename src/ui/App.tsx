import { GameCanvas } from './GameCanvas';

export function App(): React.JSX.Element {
  return (
    <main className="app">
      <header className="app__header">
        <h1 className="app__title">Real Life Sim</h1>
        <p className="app__subtitle">
          Phase 0 &mdash; nothing to play yet. This page exists to prove the build and deploy
          pipeline works end to end.
        </p>
      </header>

      <GameCanvas />

      <footer className="app__footer">Next up: Phase 1 &mdash; the core life loop.</footer>
    </main>
  );
}
