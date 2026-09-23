import { blockPending, hasBlock } from '../core/day';
import type { WorldState } from '../core/types';
import { BALANCE } from '../data/balance';
import { findFocus } from '../data/focuses';
import { duration } from './format';
import { runTimed, useProgress } from './progress';
import { gameStore } from './useGame';

/**
 * The only things that move time (CLAUDE.md rule 3): start the working day,
 * sleep, or skip a week. There is no timer anywhere in this project.
 *
 * The main button follows the day. Before work it starts work; after, it
 * goes to bed. Skipping a week is always there for the player who would
 * rather let the character get on with it (GDD §11.1).
 */
export function DayControls({ world }: { world: WorldState }): React.JSX.Element {
  const progress = useProgress();
  const focus = findFocus(world.character.focusId);
  const working = blockPending(world);
  const busy = progress !== null;
  const blockMinutes = BALANCE.day.blockEnd - world.minuteOfDay;

  return (
    <div className="controls">
      {progress ? (
        <div className="progress" role="status" aria-live="polite">
          <span className="progress__label">
            {progress.label} &middot; {duration(progress.minutes)}
          </span>
          <span className="progress__track">
            <span className="progress__fill" style={{ animationDuration: `${progress.durationMs}ms` }} />
          </span>
        </div>
      ) : (
        <p className="controls__hint">
          {working
            ? `${focus.label} runs 09:00–17:00. Until then the morning is yours.`
            : hasBlock(focus.id)
              ? `${focus.label} is done for today and counts when you sleep. The evening is yours.`
              : 'A free day. Sleep when you are done.'}
        </p>
      )}

      <div className="controls__buttons">
        {working ? (
          <button
            type="button"
            className="btn btn--primary btn--big"
            disabled={busy}
            onClick={() => runTimed(focus.startLabel ?? focus.label, blockMinutes, { type: 'startBlock' })}
          >
            {focus.startLabel ?? focus.label} <span className="btn__sub">until 17:00</span>
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--primary btn--big"
            disabled={busy}
            onClick={() => gameStore.dispatch({ type: 'advanceDay' })}
          >
            Sleep <span className="btn__sub">next day</span>
          </button>
        )}
        {working && (
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => gameStore.dispatch({ type: 'advanceDay' })}
            title="Live today without playing it, and wake up tomorrow"
          >
            Skip today
          </button>
        )}
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => gameStore.dispatch({ type: 'advanceWeek' })}
          title="Live the next seven days without playing them"
        >
          Skip a week
        </button>
      </div>
    </div>
  );
}
