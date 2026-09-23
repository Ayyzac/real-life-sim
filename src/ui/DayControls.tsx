import { blockPending, blockToday, canSkipWork, isWeekend } from '../core/day';
import type { WorldState } from '../core/types';
import { BALANCE } from '../data/balance';
import { findFocus } from '../data/focuses';
import { ProgressBar } from './ProgressBar';
import { runTimed, useProgress } from './progress';
import { gameStore } from './useGame';

/**
 * The big moves in a day: start the working day, sleep, or skip a week. The
 * clock runs on its own in between (src/ui/clock.ts) and stops at 09:00 until
 * the player picks one of these (GDD §12).
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
        <ProgressBar />
      ) : (
        <p className="controls__hint">
          {working && world.minuteOfDay >= BALANCE.day.blockStart
            ? `It is 09:00. The clock waits until you go${canSkipWork(world) ? ' or skip it' : ''}.`
            : working
            ? `${focus.label} runs 09:00–17:00. Until then the morning is yours.`
            : blockToday(world)
              ? `${focus.label} is done for today and counts when you sleep. The evening is yours.`
              : focus.worksJob && isWeekend(world.clockDay)
                ? 'The weekend. No work today, and it counts as a rest day.'
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
        {canSkipWork(world) && (
          <button
            type="button"
            className="btn btn--risky"
            disabled={busy}
            onClick={() => gameStore.dispatch({ type: 'skipWork' })}
            title="The day is yours, but it is not paid and your boss will notice. Five marks and you are out."
          >
            Skip work
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
