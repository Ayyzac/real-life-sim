import { gameStore } from './useGame';

/**
 * The only thing that moves time (CLAUDE.md rule 3). There is no timer
 * anywhere in this project - nothing happens until one of these is pressed.
 *
 * A week is the main button: a full life is roughly 3,000 of these clicks, so
 * the day button is for the moments the player wants to slow down.
 */
export function TimeControls(): React.JSX.Element {
  return (
    <div className="time">
      <button
        type="button"
        className="btn btn--primary btn--big"
        onClick={() => gameStore.dispatch({ type: 'advanceWeek' })}
      >
        Advance Week
      </button>
      <button
        type="button"
        className="btn"
        onClick={() => gameStore.dispatch({ type: 'advanceDay' })}
      >
        Advance Day
      </button>
    </div>
  );
}
